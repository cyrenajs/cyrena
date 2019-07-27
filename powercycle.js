import {
  clone, castArray, compact, omit, mapValues,
  zip, mergeWith, uniqueId, get, set, without
} from './util/lodash-polyfills.js'

import xs, { Stream } from 'xstream'
import isolate from '@cycle/isolate'
export { makeDOMDriver } from '@cycle/react-dom'

import {
  pragma,
  Fragment,
  VDOM_ELEMENT_FLAG,
} from './react/pragma'

export { pragma, Fragment } from './react/pragma'

import {
  resolveDotSeparatedScope,
  powerUpSources,
  depowerSources,
  injectAutoSel,
  resolveScopeOnDomElements,
  resolveEventProps
} from './util/shortcuts'

export const CONFIG = {
  vdomProp: 'react',
  combineFn: streams => xs.combine(...streams),
  mergeFn: streams => xs.merge(...streams)
}

export const STREAM_CALLBACK =
  Symbol('powercycle.streamCallback')

function isComponentNode (node) {
  return node && typeof node.type === 'function'
}

function isElement (val) {
  return val && (
    val[VDOM_ELEMENT_FLAG] ||
    // Our pragma is not called in case of react Fragments, so we still
    // need to specifically check for react elements - but luckily it doesn't
    // need additional dependency in this module, so it's okay
    val.$$typeof === Symbol.for('react.element')
  )
}

function isStream (val) {
  let _isStream = val instanceof Stream

  if (!_isStream && /^(?:Memory)Stream$/i.test(get(val, ['constructor', 'name']))) {
    console.warn('Powercycle\'s stream detection failed on an object with an ' +
      'instanceof check, but it pretty much seems like a stream. It\'s probably ' +
      'a double xstream instance problem on codesandbox.')
    return true
  }

  return _isStream
}

function isVdomChild (path) {
  // Map to string before join to prevent errors on symbol keys (from our pragma)
  return /^0(?:\.props\.children(?:\.\d+)?)*$/.test(path.map(String).join('.'))
}

function isInlineComponent (val, path) {
  return typeof val === 'function' && !val[STREAM_CALLBACK] && isVdomChild(path)
}

function isStreamCallback (val) {
  return typeof val === 'function' && val[STREAM_CALLBACK]
}

// Allow shortcut return value, like: return <div>...</div>
// or with sinks: return [<div>...</div>, { state: ... }]
// In the shortcut form, there's no need to pass the sources object, as it's
// the same as what the component gets from the calling part - which is not
// true for isolation'd components of course, but as we take over the
// cmp invocation job, including isolation, we can still intercept the
// sources object. The shorthand return form requires at least one initial
// powercycle() call at the top of the hierarchy, which can be achieved with
// the withPower() utility as well
const resolveShorthandOutput = cmp => sources => {
  const output = castArray(cmp(powerUpSources(sources)))

  return isElement(output[0])
    // it's a shorthand return value: vdom, eventSinks, optional sources
    ? powercycle(
      output[0],
      output[1],
      output[2] || sources
    )
    // it's a regular cyclejs sinks object
    : output[0]
}

// Traverses the tree and returns with a flat list of stream records
function traverse (action, obj, path = [], root = null, acc = []) {
  let [_acc, stop] = action(acc, obj, path, root || obj)

  if (!stop && obj && typeof obj === 'object') {
    for (let k of [...Object.keys(obj), ...Object.getOwnPropertySymbols(obj)]) {
      _acc = traverse(action, obj[k], [...path, k], root || obj, _acc)
    }
  }

  return _acc
}

function handleScope(cmp, props = {}, vdomProp) {
  return props.scope
    ? isolate(cmp, resolveDotSeparatedScope(props.scope))
    // Automatically isolate component vdoms unless 'noscope' is specified
    : !props.noscope
      ? isolate(cmp, {
          [vdomProp]: uniqueId(),
          '*': null
        })
      : cmp
}

const makeTraverseAction = config => (acc, val, path, root) => {
  const _isStream = isStream(val)
  const _isRegularCmp = isComponentNode(val)
  const _isInlineCmp = isInlineComponent(val, path)
  const _isCmp = _isRegularCmp || _isInlineCmp
  const _isStreamCallback = isStreamCallback(val)

  // This mutates the vdom (val)
  resolveScopeOnDomElements(val)

  // This mutates the vdom (val)
  resolveEventProps(val, config.mergeFn)

  if (!_isStream && !_isCmp && !_isStreamCallback) {
    // The boolean is to tell the traversal to go on
    return [acc, false]
  }

  const regularCmp =
    _isRegularCmp && resolveShorthandOutput(val.type) ||
    _isInlineCmp && resolveShorthandOutput(val)

  const cmp =
    _isCmp && handleScope(regularCmp, val.props, config.vdomProp)

  // We pass key and props in the sources object
  const sources = (_isCmp || _isStreamCallback) && {
    ...config.sources,
    // Merge outer props onto inner. Normally the outer one (val.props)
    // should be sufficient, but isolation wrapping makes it lost, and so we
    // have to dig it out from args
    props: {
      ...config.sources.props,
      ...val.props
    }
  }

  const sinks = _isCmp && cmp(sources)

  const _val = _isStreamCallback
    ? val(sources)
    : val

  acc.push({ val: _val, path, isCmp: _isCmp, sinks })

  // Return with the accumulator object, and a second boolean value tells
  // the traversal to stop
  return [acc, true]
}

function getCmpAutoKey (cmpId, path) {
  return `pc-cmp-autokey-#${cmpId}-` +
    without(path, 'props', 'children').join('.')
}

function clonePath (path, vdom) {
  let node = vdom

  for (let i = 0; i < path.length; i++) {
    node[path[i]] = clone(node[path[i]])
    node = node[path[i]]
  }

  return vdom
}

const makePowercycle = config =>
  function powercycle (vdom, eventSinks, sources) {
    // Wrap it in an array to make path-based substitution work with root streams.
    let root = [injectAutoSel(vdom)]

    const traverseAction = makeTraverseAction({
      ...config,
      sources: depowerSources(sources)
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
              info.autoKey = info.autoKey || getCmpAutoKey(cmpId, info.path)
              _val = { ..._val, key: info.autoKey }
            }

            // It serves two purposes here:
            // 1. de-freeze the vdom, frozen by React
            // 2. change object references to avoid reconciliation bailouts, e.g.
            // at react/packages/react-reconciler/src/ReactFiberBeginWork.js:2387
            // oldProps.children === newProps.children
            root = clonePath(info.path, root)

            set(root, info.path, _val)

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
export const power = powercycle
export const component = powercycle

// Wrapper for any cycle component for the convenience of shorthand
// return values. An initial powercycle() call makes the component managed,
// so the sources object is passed to every component child in the tree.
export default Object.assign(
  Cmp => sources => powercycle(pragma(Cmp), null, sources),
  { pragma, Fragment }
)
