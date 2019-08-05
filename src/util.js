import { castArray, get as _get, uniqueId } from './lodashpolyfills.js'
import { pragma, Fragment } from './reactpragma.js'
import { powercycle, CONFIG } from './powercycle.js'
import { collectSinksBasedOnSource } from './util/Collection.js'
import { makeCollection } from '@cycle/state'
import xs from 'xstream'

import {
  resolve$Proxy
} from './shortcuts.js'

import {
  isStream,
  isStreamCallback,
  resolveStreamCallback,
  wrapInStreamCallback
} from './dynamictypes.js'

// This is just a dummy component to serve as a lens or collection item
// container for a sub-vdom.
export function Scope (sources) {
  return pragma(Fragment, null, ...castArray(sources.props.children))
}

export function getConditionalCmp (cond$, children) {
  const conditionStateChannel = '$$$cond' + uniqueId()

  return sources => {
    const collection = makeCollection({
      item: sources => powercycle(
        pragma(Fragment, null, ...castArray(children)),
        null,
        sources
      ),
      itemScope: () => ({ '*': null }),
      channel: conditionStateChannel,
      collectSinks: collectSinksBasedOnSource(sources)
    })

    return collection({
      ...sources,
      [conditionStateChannel]: { stream: cond$.map(cond => cond ? [{}] : []) }
    })
  }
}

export function If (sources) {
  const cond$ = resolveStreamCallback(resolve$Proxy(sources.props.cond), sources)

  const thenVdom = sources.props.then || sources.props.children
  const elseVdom = sources.props.else

  return pragma(
    Fragment,
    null,
    getConditionalCmp(cond$, thenVdom),
    getConditionalCmp(cond$.map(cond => !cond), elseVdom)
  )
}

// Helper function to easily access state parts in the vdom.
// src can be any of these 4:
// - stream
// - stream callback
// - $ proxy
// - sources object
// If src is a sources object, then the mapper will occur on
// src.state.stream
export const $map = (fn, src) => {
  const _src = resolve$Proxy(src)

  return (
    isStream(_src)
      ? _src.map(fn) :

    isStreamCallback(_src)
      ? wrapInStreamCallback(src =>
          $map(fn, resolveStreamCallback(_src, src))
        ) :

    _src
      ? $map(fn, _src.state.stream) :

    wrapInStreamCallback(src => $map(fn, src))
  )
}

export const $get = (key, src) =>
  $map(
    streamVal => key ? _get(streamVal, key.split('.')) : streamVal,
    src
  )

export const $if = ($cond, $then, $else) => {
  return $map(cond => cond ? $then : $else, $cond)
}

export const $not = $cond => {
  return $map(cond => !cond, $cond)
}

export const $combine = (...sources) => {
  const _sources = sources.map(resolve$Proxy)

  if (_sources.some(isStreamCallback)) {
    return wrapInStreamCallback(
      src => $combine(..._sources.map(_src => resolveStreamCallback(_src, src)))
    )
  }

  const sourceStreams = _sources.map(
    src => isStream(src) ? src : src.state.stream
  )

  return xs.combine(...sourceStreams)
}

export const $and = (...conditions) => {
  return $map(
    conditions => conditions.reduce((cum, next) => cum && next),
    $combine(...conditions)
  )
}

export const $or = (...conditions) => {
  return $not($and(...conditions.map($not)))
}

export const map = $map
export const get = $get
