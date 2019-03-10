import cloneDeepWith from 'lodash/cloneDeepWith'
import zip from 'lodash/zip'
import mapValues from 'lodash/fp/mapValues'
import castArray from 'lodash/castArray'
import mergeWith from 'lodash/mergeWith'
import compact from 'lodash/compact'
import pick from 'lodash/pick'
import omit from 'lodash/omit'
import get from 'lodash/get'
import set from 'lodash/set'
import defaultTo from 'lodash/defaultTo'
import isObject from 'lodash/isObject'
import isPlainObject from 'lodash/isPlainObject'
import escapeRegExp from 'lodash/escapeRegExp'
import dropRight from 'lodash/dropRight'
import last from 'lodash/last'
import uniqueId from 'lodash/uniqueId'
import clone from 'lodash/clone'

import cycleIsolate from '@cycle/isolate'

const VDOM_ELEMENT_FLAG = Symbol('powercycle.element')
const VDOM_ELEMENT_KEY_PROP = Symbol('powercycle.key')
const VDOM_INLINE_CMP = Symbol('powercycle.inline-cmp')

// Fragment is not used here, but conceptually it's closely tied to pragma
export function makePragma (originalPragma, Fragment) {
  return (node, attr, ...children) => {
    const key = attr && attr.key

    // React pragma convert key attribs to string so it's just better to
    // set it undefined to avoid having an [object Object] key
    if (attr && typeof attr.key !== 'string') {
      attr.key = undefined
    }

    const ret = ({
      ...originalPragma(
        node,
        {
          ...attr,
          // Enforce key presence to suppress warnings coming from react pragma.
          // Not sure if it's a good idea, but for now it just frees us from
          // those annoying warnings... Collection is handling its item keys
          // on its own.
          key: defaultTo(key, 'power-pragma-autokey-' + uniqueId())
        },
        children.map((el, idx) => {
          if (typeof el === 'function') {
            el[VDOM_INLINE_CMP] = true
          }
          return el
        })
      ),
      [VDOM_ELEMENT_FLAG]: true,
      [VDOM_ELEMENT_KEY_PROP]: key
    })

    return ret
  }
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

// Power-ups the sources object for shorthands like:
// sources.react.select(input).events('change') -> sources[input].change
// sources.react.select('input').events('change') -> sources[sel('input')].change
// sources.react.select('input').events('change') -> sources.sel.input.change
const eventsProxy = (target, prop) => {
  const selector = typeof prop === 'symbol' && Symbol.keyFor(prop) || prop
  return new Proxy(target.react.select(selector), {
    get: (target, prop) => target.events(prop)
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
const resolveShorthandOutput = (config, cmp) => sources => {
  const output = castArray(cmp(powerUpSources(sources)))

  return isElement(output[0])
    // it's a shorthand return value
    ? powerCycleComponent(output[0], {
      ...config,
      eventSinks: output[1],
      sources: output[2] || sources
    })
    // it's a regular cyclejs sinks object
    : output[0]
}

// Support dot-separated deep lenses - not sure how much of a real world usecase
// We choose a careful strategy here, ie. if there's no dot, we stay with the
// string version
const getLens = path => path && (
  path.split('.').length < 2 ? path : {
    state: {
      get: state => get(state, path),
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
      isCmp && resolveShorthandOutput(config, val.type) ||
      isInlineCmp && resolveShorthandOutput(config, val)

    const cmp = (isCmp || isInlineCmp) && (
      lens
        ? config.isolateFn(regularCmp, lens)
        // Automatically isolate component vdoms unless 'noscope' is specified
        : get(val, 'props.noscope')
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

const cloneDeepVdom = obj => cloneDeepWith(obj, value => {
  if (
    isMostProbablyStream(value) ||
    value && value.$$typeof === Symbol.for('react.forward_ref')
  ) {
    return value
  }
})

export function powerCycleComponent (vdom, config) {

  // This one-time clone is needed to be able to
  // amend the read-only react vdom with auto generated keys
  const root = [cloneDeepVdom(vdom)]

  const streamInfoRecords = traverse(
    makeTraverseAction({ ...config, sources: depowerSources(config.sources) }),
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
      // It's needed to make react detect changes
      const _root = cloneDeepVdom(root)

      zip(signalValues, streamInfoRecords).forEach(([val, info]) => {
        if (isElement(val) && !val.key) {
          // Due to heavy auto-scoping, these elements are often context.providers
          // and this is our last chance to provide them with keys
          val = { ...val, key: info.path.join('.') }
        }
        set(_root, info.path, val)
      })

      return _root[0]
    })

  // Gather all event sinks (all but vdom) and merge them together by type
  const eventSinks =
    [streamInfoRecords]
      .map(xs => xs.filter(rec => rec.isCmp))
      .map(xs => xs.map(rec => rec.sinks))
      .map(xs => [config.eventSinks || {}, ...xs])
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
    ...eventSinks
  }
}
