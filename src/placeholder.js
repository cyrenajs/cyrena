export const PLACEHOLDER = Symbol('powercycle.placeholder')
export const RESOLVE_PATH = Symbol('powercycle.placeholder_path')
export const RESOLVE = Symbol('powercycle.placeholder_resolve')
export const BASE_STREAM = Symbol('powercycle.placeholder_base_stream')

import xs from 'xstream'
import { identity } from './fp.js'

function reduce (resolvePath, base) {
  return resolvePath.reduce(
    (cum, next, idx, arr) => [...cum, next(...cum.slice(-2))],
    [base]
  ).slice(-1)[0]
}

export const $ = (function $$ (_resolvePath, baseStream) {
  const resolvePath = _resolvePath || [identity]

  const $proxyTarget = Object.assign(
    function () {},
    { [PLACEHOLDER]: true,
      [RESOLVE_PATH]: resolvePath,
      [BASE_STREAM]: baseStream,
      [RESOLVE]: baseStream
        ? () => baseStream.map(base => reduce(resolvePath, base))
        : base => reduce(resolvePath, base)
    }
  )

  return new Proxy($proxyTarget, {
    get (target, prop) {
      // better stop on all symbols here to prevent false positives on other
      // symbol-based type checks
      return typeof prop === 'symbol'
        ? target[prop]
        : $$([...resolvePath, (thisArg, base) => base[prop]], baseStream)
    },
    apply (target, thisArg, args) {
      if (target[RESOLVE_PATH].length === 1 && args[0]) {
        return $$(resolvePath, args[0])
      }

      return $$(
        [...resolvePath, (thisArg, base) => {
          return base.apply(thisArg, args)
        }],
        baseStream
      )
    }
  })
})()
