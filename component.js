import clone from 'lodash/clone'
import cloneDeep from 'lodash/cloneDeep'
import cloneDeepWith from 'lodash/cloneDeepWith'
import zip from 'lodash/zip'
import mapValues from 'lodash/fp/mapValues'
import castArray from 'lodash/castArray'
import mergeWith from 'lodash/mergeWith'
import compact from 'lodash/compact'
import pick from 'lodash/pick'
import omit from 'lodash/omit'
import _get from 'lodash/get'
import set from 'lodash/set'
import defaultTo from 'lodash/defaultTo'
import isObject from 'lodash/isObject'
import isPlainObject from 'lodash/isPlainObject'
import escapeRegExp from 'lodash/escapeRegExp'
import dropRight from 'lodash/dropRight'
import last from 'lodash/last'
import uniqueId from 'lodash/uniqueId'

import xs from 'xstream'
import cycleIsolate from '@cycle/isolate'

import {
  pragma,
  Fragment,
  VDOM_ELEMENT_FLAG,
  VDOM_ELEMENT_KEY_PROP,
  VDOM_INLINE_CMP
} from './react/pragma'

export { pragma, Fragment } from './react/pragma'

const CONFIG = {
  vdomProp: 'react',
  combineFn: streams => xs.combine(...streams),
  mergeFn: streams => xs.merge(...streams)
}

const isComponentNode = node =>
  node && typeof node.type === 'function'

const isElement = val =>
  val && (
    val[VDOM_ELEMENT_FLAG] ||
    // Our pragma is not called in case of react Fragments, so we still
    // need to specifically check for react elements - but luckily it doesn't
    // need additional dependency in this module, so it's okay
    val.$$typeof === Symbol.for('react.element')
  )

const isMostProbablyStream = val =>
  Boolean(
    val &&
    typeof val === 'object' &&
    !val[VDOM_ELEMENT_FLAG] &&
    !isPlainObject(val) &&
    !Array.isArray(val)
  )

const isInlineComponent = (val, path) =>
  val && val[VDOM_INLINE_CMP]

export const isolate = (Cmp, lens) => sources =>
  component(
    pragma(cycleIsolate(Cmp, lens), null, ...castArray(sources.props.children)),
    null,
    sources
  )

// Power-ups the sources object to make all these shorthands available:
// sources.react.select('input').events('change').map(ev => ev.target.value)
// sources.sel.input.events('change').map(ev => ev.target.value)
// sources.sel.input.change.map(ev => ev.target.value)
// sources.sel.input.change['target.value']
const eventsProxy = (target, prop) => {
  const selector = typeof prop === 'symbol' && Symbol.keyFor(prop) || prop
  return new Proxy(target.react.select(selector), {
    get: (target, prop) => target[prop] ||
      new Proxy(target.events(prop), {
        get: (target, prop) => target[prop] ||
          target.map(ev => _get(ev, prop))
      })
  })
}

export const sel = name => Symbol.for(name)

export function powerUpSources (sources) {
  return new Proxy({ ...sources }, {
    get: (target, prop) =>
      prop === 'sel' && !target[prop]
        ? new Proxy({}, {
            get: (dummy, prop) => eventsProxy(target, prop)
          })
        : typeof prop === 'symbol'
          ? eventsProxy(target, prop)
          : target[prop]
  })
}

const depowerSources = clone

// Allow shortcut return value, like: return <div>...</div>
// or with sinks: return [<div>...</div>, { state: ... }]
// In the shortcut form, there's no need to pass the sources object, as it's
// the same as what the component gets from the calling part - which is not
// true for isolation'd components of course, but as we take over the
// cmp invocation job, including isolation, we can still intercept the
// sources object. The shorthand return form requires at least one initial
// component() call at the top of the hierarchy, which can be achieved with
// the withPower() utility as well
const resolveShorthandOutput = cmp => sources => {
  const output = castArray(cmp(powerUpSources(sources)))

  return isElement(output[0])
    // it's a shorthand return value
    ? component(output[0], output[1], output[2] || sources)
    // it's a regular cyclejs sinks object
    : output[0]
}

// Support dot-separated deep lenses - not sure how much of a real world usecase
// We choose a careful strategy here, ie. if there's no dot, we stay with the
// string version
const getLens = path => path && (
  path.split('.').length < 2 ? path : {
    state: {
      get: state => _get(state, path),
      set: (state, childState) => set(state, path, childState)
    },
    '*': path
  }
)

const traverse = (action, obj, path = [], acc = []) => {
  let [_acc, stop] = action(acc, obj, path)

  if (!stop && obj && typeof obj === 'object') {
    for (let k of [...Object.keys(obj), ...Object.getOwnPropertySymbols(obj)]) {
      _acc = traverse(action, obj[k], [...path, k], _acc)
    }
  }

  return _acc
}

const makeTraverseAction = config => (acc, val, path) => {
  const isStream = isMostProbablyStream(val)
  const isCmp = isComponentNode(val)
  const isInlineCmp = isInlineComponent(val, path)

  if (isStream || isCmp || isInlineCmp) {
    const lens = isCmp && getLens(val.props.lens)

    const regularCmp =
      isCmp && resolveShorthandOutput(val.type) ||
      isInlineCmp && resolveShorthandOutput(val)

    const cmp = (isCmp || isInlineCmp) && (
      lens
        ? isolate(regularCmp, lens)
        // Automatically isolate component vdoms unless 'noscope' is specified
        : _get(val, 'props.noscope')
          ? regularCmp
          : cycleIsolate(regularCmp, {
            [config.vdomProp]: path.join('.'),
            '*': null
          })
      )

    // We pass key and props in the sources object
    const sources = (isCmp || isInlineCmp) && {
      ...config.sources,
      // Merge outer props onto inner. Normally the outer one (val.props)
      // should be sufficient, but lens wrapping makes it lost, and so we
      // have to dig it out from args
      props: {
        ...config.sources.props,
        ...val.props
      },
      key: val[VDOM_ELEMENT_KEY_PROP]
    }

    const sinks =
      (isCmp || isInlineCmp) && cmp(sources)

    const _path = last(path) === VDOM_ELEMENT_KEY_PROP
      ? [...dropRight(path), 'key']
      : path

    acc.push({ val, path: _path, isCmp: isCmp || isInlineCmp, sinks })
  }

  // Return with the accumulator object, and a second boolean value which
  // tells if the traversal should stop at this branch
  return [acc, isStream || isCmp || isInlineCmp]
}

const cloneDeepVdom = vdom => cloneDeepWith(vdom, value => {
  if (
    isMostProbablyStream(value) ||
    value && value.$$typeof === Symbol.for('react.forward_ref')
  ) {
    return value
  }
})

const makeComponent = config => (vdom, eventSinks, sources) => {
  // Wrap it in an array to make path-based substitution work with root
  // streams
  const root = [vdom]

  const streamInfoRecords = traverse(
    makeTraverseAction({ ...config, sources: depowerSources(sources) }),
    root
  )

  // Get the signal streams (the ones which need to be combined)
  const signalStreams = streamInfoRecords.map(node =>
    node.isCmp
      ? node.sinks[config.vdomProp]
      : node.val
  )

  // Combine the vdom and stream node streams,
  // and place their values into the original structure
  const vdom$ = config.combineFn(signalStreams)
    .map(signalValues => {
      // I know it hurts. But it seems like React re-freezes the vdom tree
      // between render loops. Needs more investigation in React's codebase
      // why and how this happens
      const _root = cloneDeepVdom(root)

      zip(signalValues, streamInfoRecords).forEach(([val, info]) => {
        if (isElement(val) && !val.key) {
          // info.path.join('.') would be nice, but produces "0" keys on sibling
          // lens-ed components. uniqueId is not a good idea, it causes focus
          // loss. Object instance seems to work nicely. We could make a unique
          // string from it with a WeakMap, or do a better job digging out the
          // parent path and appending our path to it; but for now, it just works.
          val = { ...val, key: info }
        }
        set(_root, info.path, val)

        // // A way to catch error caused by frozen react vdom
        // if (_get(_root, info.path) !== val) {
        //   console.error('Can\'t write value into VDOM.')
        // }
      })

      return _root[0]
    })

  // Gather all event sinks (all but vdom) and merge them together by type
  const allEventSinks =
    [streamInfoRecords]
      .map(xs => xs.filter(rec => rec.isCmp))
      .map(xs => xs.map(rec => rec.sinks))
      .map(xs => [eventSinks || {}, ...xs])
      .map(xs => xs.reduce(
        (acc, next) => mergeWith(
          acc,
          omit(next, config.vdomProp),
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

export const component = makeComponent(CONFIG)

// Wrapper for any cycle component for the convenience of shorthand
// return values. An initial component() call makes the component 'controlled',
// so the sources object is passed to every component child in the tree.
export default Object.assign(
  Cmp => sources => component(pragma(Cmp), null, sources),
  { pragma, Fragment }
)
