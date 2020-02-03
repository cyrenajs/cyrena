import { pragma, Fragment } from './reactpragma.js'
import { powercycle } from './powercycle.js'

import {
  castArray,
  get as _get,
  pick,
  uniqueId,
  mergeDeep
} from './fp.js'

import {
  Collection,
  collectSinksBasedOnSource
} from './util/Collection.js'

import {
  Instances,
} from '@cycle/state'

import {
  resolvePlaceholder,
  isStateMapper,
  createStateMapper,
  resolveStateMapper,
} from './shortcuts.js'

import {
  isStream
} from './dynamictypes.js'

import {
  PLACEHOLDER,
  RESOLVE
} from './placeholder.js'

import xs from 'xstream'

// This is just a dummy component to serve as a lens or collection item
// container for a sub-vdom.
export function Scope (sources) {
  return wrapInComponent(sources.props.children)(sources)
}

export function Debug (sources) {
  return pragma('pre', null, $map(JSON.stringify))
}

export function getDynamicCmp (stream, getCmp) {
  return sources => {
    const _stream = resolveStateMapper(stream, sources)

    const instances$ = _stream.fold(function (acc, next) {
      const key = next && next.key || uniqueId()
      const cmp = getCmp(next)
      const sinks = cmp(sources)

      acc.dict.clear()
      acc.dict.set(key, sinks)

      return { dict: acc.dict, arr: [{ ...sinks, _key: key }] }
    }, { dict: new Map(), arr: [] })

    return collectSinksBasedOnSource(sources)(new Instances(instances$))
  }
}

export function wrapInComponent(...values) {
  return sources => {
    return powercycle(
      pragma(Fragment, null, ...castArray(values)),
      null,
      sources
    )
  }
}

export const pickLens = (...keys) => ({
  get: pick(keys),
  set: (outer, inner) => ({ ...outer, ...pick(keys)(inner) })
})

// This is a handy tool to keep reducers short and terse. It is basically a
// lodash-like deep merger, but it detects $ proxies and resolves them with
// the target object (which is the previousState in reducers). Keep in mind
// that it name conflicts with the mergeWith function in fp.js. That version is
// just a shallow merger
export const mergeWith = src => obj => {
  return mergeDeep(obj, src, (oldVal, newVal) => {
    return newVal && newVal[PLACEHOLDER]
      ? newVal[RESOLVE](obj)
      : newVal
  })
}

export function request (url$, sources) {
  const category = uniqueId()

  const request$ = url$.map(url => ({ url, category }))

  const response$ =
    sources.HTTP
      .select(category)
      .map(resp$ => resp$.replaceError(err => xs.of(err)))
      .flatten()

  const content$ =
    response$
      .filter(resp => !(resp instanceof Error))
      .map(resp => JSON.parse(resp.text))
      .remember()

  const isLoading$ = xs.merge(
    request$.mapTo(true),
    response$.mapTo(false)
  ).startWith(false)

  const errorMessage$ =
    response$
      .filter(resp => resp instanceof Error)
      .startWith('')

  return { request$, content$, isLoading$, errorMessage$ }
}


// Helper function to easily access state parts in the vdom.
export const $map = (fn, src) => {
  const _src = resolvePlaceholder(src)
  const _fn = resolvePlaceholder(fn)

  return (
    isStream(_src)
      ? _src.map(_fn) :

    isStateMapper(_src)
      ? createStateMapper(state => _fn(_src(state))) :

    typeof _fn === 'function'
      ? createStateMapper(_fn) :

    createStateMapper(() => _fn)
  )
}

export const $get = (key, src) =>
  $map(
    streamVal => key ? _get(key.split('.'))(streamVal) : streamVal,
    src
  )

export const $for = (base, vdom) => {
  return pragma(Collection, { for: base }, vdom)
}
