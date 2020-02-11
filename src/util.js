import xs from 'xstream'
import { pragma } from './reactpragma.js'
import { get as _get, pick, uniqueId, mergeDeep } from './fp.js'
import isStateMapper from './isStateMapper.js'
import createStateMapper from './createStateMapper.js'
import resolvePlaceholder from './resolvePlaceholder.js'
import { isStream } from './dynamictypes.js'
import { PLACEHOLDER, RESOLVE } from './placeholder.js'

export function Debug (sources) {
  return pragma('pre', null, $map(JSON.stringify))
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
