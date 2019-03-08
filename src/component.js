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

import isolate from '@cycle/isolate'

const VDOM_ELEMENT_FLAG = Symbol('powercycle.element')
const VDOM_ELEMENT_KEY_PROP = Symbol('powercycle.key')
const VDOM_INLINE_CMP = Symbol('powercycle.inline-cmp')

export const makePragma = pragma => (node, attr, ...children) => {
  const key = attr && attr.key

  // React pragma convert key attribs to string so it's just better to
  // set it undefined to avoid having an [object Object] key
  if (attr && typeof attr.key !== 'string') {
    attr.key = undefined
  }

  const ret = ({
    ...pragma(
      node,
      {
        ...attr,
        key: defaultTo(key, 'power-pragma-autokey-' + uniqueId())
      },
      // Enforce key presence to suppress warnings coming from react pragma.
      // Not sure if it's a good idea, since in ReactDomains, the warning is
      // obviously legit...
      children.flat().map((el, idx) => {
        if (typeof el === 'function') {
          el[VDOM_INLINE_CMP] = true
        }
        return el
        // Seems like we don't need it, clean it up if stable
        // return isObject(el)
        //   ? Object.assign(el, { key: defaultTo(key, 'power-pragma-autokey-' + uniqueId()) })
        //   : el
      })
    ),
    [VDOM_ELEMENT_FLAG]: true,
    [VDOM_ELEMENT_KEY_PROP]: key
  })

  return ret
}

const isComponentNode = node =>
  node && typeof node.type === 'function'

const isElement = val =>
  val && (
    val[VDOM_ELEMENT_FLAG] ||
    // Our pragma is not called in case of react fragments, so we still
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
export const makePowerSources = sources =>
  new Proxy(sources, {
    get: (target, prop) => typeof prop === 'symbol'
      ? new Proxy(target.react.select(prop), {
          get: (target, prop) => target.events(prop)
        })
      : Reflect.get(target, prop)
  })

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
  const output = castArray(cmp(makePowerSources(sources)))

  return isElement(output[0])
    // it's a shorthand return value
    ? component(output[0], {
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

  // Add key props to prevent React warnings
  if (isElement(val)) {
    // debugger
    val.key = defaultTo(val.key, 'powercycle-traverse-autokey-' + uniqueId())
  }

  if (isStream || isCmp || isInlineCmp) {
    const lens = isCmp && getLens(val.props.lens)

    const regularCmp =
      isCmp && resolveShorthandOutput(config, val.type) ||
      isInlineCmp && resolveShorthandOutput(config, val)

    const cmp = (isCmp || isInlineCmp) &&
      (lens ? isolate(regularCmp, lens) : regularCmp)

    // We pass key and props in the sources object
    const sources = (isCmp || isInlineCmp) && {
      ...config.sources,
      props: val.props,
      key: val[VDOM_ELEMENT_KEY_PROP]
    }

    // We put it in an array to handle different output styles below
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

export function component (vdom, config) {

  // This one-time clone is needed to be able to
  // amend the read-only react vdom with auto generated keys
  const root = [cloneDeepVdom(vdom)]

  const streamInfoRecords = traverse(makeTraverseAction(config), root)

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
