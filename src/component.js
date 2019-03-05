import cloneDeepWith from 'lodash/cloneDeepWith'
import zip from 'lodash/zip'
import mapValues from 'lodash/fp/mapValues'
import castArray from 'lodash/castArray'
import mergeWith from 'lodash/mergeWith'
import compact from 'lodash/compact'
import pick from 'lodash/pick'
import omit from 'lodash/omit'
import set from 'lodash/set'
import defaultTo from 'lodash/defaultTo'
import isObject from 'lodash/isObject'

import isolate from '@cycle/isolate'

const VDOM_ELEMENT_FLAG = Symbol('powercycle.element')

export const makePragma = pragma => (node, attr, ...children) =>
  ({
    ...pragma(
      node,
      { ...attr },
      // Enforce key presence to suppress warnings coming from react pragma.
      // Not sure if it's a good idea, since in ReactDomains, the warning is
      // obviously legit...
      children.map((c, key) => isObject(c) ? Object.assign(c, { key }) : c)
    ),
    [VDOM_ELEMENT_FLAG]: true
  })

const isComponentNode = node =>
  node && typeof node.type === 'function'

const isElement = val =>
  val && val[VDOM_ELEMENT_FLAG]

const traverse = (action, obj, path = [], acc = []) => {
  let [_acc, stop] = action(acc, obj, path)

  if (!stop && typeof obj === 'object') {
    for (let k in obj) {
      _acc = traverse(action, obj[k], [...path, k], _acc)
    }
  }

  return _acc
}

const makeTraverseAction = config => (acc, val, path) => {
  const isStream = config.isStreamFn(val)
  const isCmp = isComponentNode(val)

  // Add key props to prevent React warnings
  if (isElement(val)) {
    val.key = defaultTo(val.key, path[path.length - 1])
  }

  if (isStream || isCmp) {
    const lens = isCmp && val.props.lens
    const cmp = isCmp &&
      (lens ? isolate(val.type, lens) : val.type)

    // We put it in an array to handle different output styles below
    const cmpOutput = castArray(
      isCmp && cmp({ ...config.sources, ...pick(val, ['key', 'props']) })
    )

    // Allow shortcut return value, like: return <div>...</div>
    // or with sinks: return [<div>...</div>, { state: ... }]
    // In the shortcut form, there's no need to pass the sources object, as it
    // can be accessed from the config - which eventually comes from any
    // initial component() call at the top of the hierarchy, or with the
    // withPower() utility.
    const sinks = isElement(cmpOutput[0])
      // it's a shorthand return value
      ? component(cmpOutput[0], {
        ...config,
        eventSinks: cmpOutput[1],
        sources: cmpOutput[2] || config.sources
      })
      // it's a regular cycljs sinks object
      : cmpOutput[0]

    acc.push({ val, path, isCmp, ...isCmp && { sinks } })
  }

  return [acc, isStream || isCmp]
}

export function component (vdom, config) {
  const cloneDeep = obj => cloneDeepWith(
    obj,
    value => config.isStreamFn(value) ? value : undefined
  )

  // This one-time clone is needed to be able to
  // amend the read-only react vdom with auto generated keys
  const root = [cloneDeep(vdom)]

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
      const _root = cloneDeep(root)

      zip(signalValues, streamInfoRecords).forEach(([val, info]) => {
        set(
          _root,
          info.path,
          info.isCmp ? { ...val, key: defaultTo(info.val.key, val.key) } : val
        )
      })

      return _root[0]
    })

  // Gather all event sinks (all but vdom) and merge them together by type
  const eventSinks =
    [streamInfoRecords]
      .map(xs => xs.filter(info => info.isCmp))
      .map(xs => xs.map(info => info.sinks))
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
