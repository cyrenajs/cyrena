import {
  clone, castArray, compact, omit, mapValues,
  zip, mergeWith, uniqueId, get, set, without,
  clonePath
} from './lodashpolyfills.js'

import xs, { Stream } from 'xstream'
import cycleIsolate from '@cycle/isolate'
export { makeDOMDriver } from '@cycle/react-dom'

import {
  isComponentNode,
  isElement,
  isStream,
  isVdomChildPath,
  isInlineComponent,
  isStreamCallback,
  resolveStreamCallback,
  markSourcesObject
} from './dynamictypes.js'

import { pragma, Fragment } from './reactpragma.js'
export { pragma, Fragment } from './reactpragma.js'

import {
  resolveShorthandOutput,
  resolvePathScope,
  depowerSources,
  injectAutoSel,
  resolveScopeOrIfProp,
  resolveEventProps,
  resolve$Proxy
} from './shortcuts.js'

export const CONFIG = {
  vdomProp: 'react',
  combineFn: streams => xs.combine(...streams),
  mergeFn: streams => xs.merge(...streams)
}

export function isolate (component, scope) {
  return cycleIsolate(
    sources => component(markSourcesObject(sources)),
    scope
  )
}

// Traverses the tree and returns with a flat list of stream records
function traverse (action, obj, path = [], root = null, acc = []) {
  let [_acc, stop] = action(acc, obj, path, root || obj)

  if (!stop && obj && typeof obj === 'object') {
    for (let key of [...Object.keys(obj), ...Object.getOwnPropertySymbols(obj)]) {
      _acc = traverse(action, obj[key], [...path, key], root || obj, _acc)
    }
  }

  return _acc
}

// Automatically isolate component vdoms unless 'noscope' is specified
function handleAutoScope(cmp, props = {}, vdomProp) {
  return props.noscope
    ? cmp
    : isolate(cmp, {
        [vdomProp]: uniqueId(),
        '*': null
      })
}

const makeTraverseAction = config => (acc, __val, path, root) => {
  const val = resolve$Proxy(__val)

  const _isStream = isStream(val)
  const _isRegularCmp = isComponentNode(val)
  const _isInlineCmp = isInlineComponent(val, path)
  const _isCmp = _isRegularCmp || _isInlineCmp
  const _isStreamCallback = isStreamCallback(val)

  // These mutate the vdom (val)
  if (resolveScopeOrIfProp(val, config) === true) {
    return [acc, false]
  }

  if (resolveEventProps(val, config) === true) {
    return [acc, false]
  }

  if (!_isStream && !_isCmp && !_isStreamCallback) {
    // The boolean is to tell the traversal to go on
    return [acc, false]
  }

  const regularCmp =
    _isRegularCmp && resolveShorthandOutput(val.type) ||
    _isInlineCmp && resolveShorthandOutput(val)

  const cmp =
    _isCmp && handleAutoScope(regularCmp, val.props, config.vdomProp)

  // We pass key and props in the sources object
  const sources = (_isCmp || _isStreamCallback) && markSourcesObject({
    ...config.sources,

    // Previously this looked like below, with the reasoning that isolation
    // wrapping makes outer props lost, but I actually couldn't reproduce that.
    // Besides that, it certainly causes an issue that outer components'
    // props can appear on their immediate children, so for now it's best to
    // remove it.
    // props: {
    //   ...config.sources.props,
    //   ...val.props
    // }

    props: val.props
  })

  const sinks = _isCmp && cmp(sources)

  const _val = resolveStreamCallback(val, sources)

  acc.push({ val: _val, path, isCmp: _isCmp, sinks })

  // Return with the accumulator object, and a second boolean value tells
  // the traversal to stop
  return [acc, true]
}

function getCmpAutoKey (cmpId, path) {
  return `pc-cmp-autokey-#${cmpId}-` +
    without(path, 'props', 'children').join('.')
}

const makePowercycle = config =>
  function powercycle (vdom, eventSinks, sources) {
    // Wrap it in an array to make path-based substitution work with root streams.
    let root = [injectAutoSel(vdom)]

    const traverseAction = makeTraverseAction({
      ...config,
      sources: markSourcesObject(sources)
    })

    const placeholders = traverse(traverseAction, root)

    // Get the signal streams (the ones which need to be combined)
    const signalStreams = placeholders.map(node =>
      node.isCmp
        ? node.sinks[config.vdomProp]
        : node.val
    )

    const cmpId = uniqueId()

    // Combine the vdom and stream node streams,
    // and place their values into the original structure
    const vdom$ = config.combineFn(signalStreams)
      .map(signalValues => {
        zip(signalValues, placeholders)
          .forEach(([val, info]) => {
            // Bailout on unchanged placeholder values
            if (Reflect.has(info, 'lastValue') && info.lastValue === val) {
              return
            }
            info.lastValue = val

            let _val = val

            if (isElement(val) && !val.key) {
              // info.path.join('.') would be nice, but produces "0" keys on sibling
              // isolated components. uniqueId is not a good idea, it triggers a
              // total re-render and causes focus loss. A uniqueId based on the
              // stream record instance is a nice option, but even better, we use
              // the placeholder's path relative to the cmp, and combine it with
              // the cmp id
              _val = { ..._val, key:
                get(root, [...info.path, 'key']) ||
                getCmpAutoKey(cmpId, info.path)
              }
            }

            // It serves two purposes here:
            // 1. de-freeze the vdom, frozen by React
            // 2. change object references to avoid reconciliation bailouts, e.g.
            // at react/packages/react-reconciler/src/ReactFiberBeginWork.js:2387
            // oldProps.children === newProps.children
            root = set(clonePath(root, info.path), info.path, _val)

            // A way to catch error caused by frozen react vdom/props/etc. object
            // if (get(root, info.path) !== _val) {
            //   console.error('Can\'t write value into VDOM: ', _val, info.path)
            // }
          })

          return root[0]
        })

    // Gather all event sinks (all but vdom) and merge them together by type
    const allEventSinks =
      [placeholders]
        .map(xs => xs.filter(rec => rec.isCmp))
        .map(xs => xs.map(rec => rec.sinks))
        .map(xs => [eventSinks || {}, ...xs])
        .map(xs => xs.reduce(
          (acc, next) => mergeWith(
            acc,
            omit([config.vdomProp])(next),
            (addition, src) => compact([...castArray(addition), src])
          ),
          {}
        ))
        .map(mapValues(sinks => config.mergeFn(sinks)))
        [0]

    return {
      [config.vdomProp]: vdom$,
      ...allEventSinks
    }
  }

export const powercycle = makePowercycle(CONFIG)
export const component = powercycle

// Wrapper for any cycle component for the convenience of shorthand
// return values. An initial powercycle() call makes the component managed,
// so the sources object is passed to every component child in the tree.
export default Object.assign(
  Cmp => sources => powercycle(pragma(Cmp), null, sources),
  { pragma, Fragment }
)
