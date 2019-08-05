import { Stream } from 'xstream'
import { get } from './lodashpolyfills.js'

export const VDOM_ELEMENT_FLAG = Symbol('powercycle.element')
export const STREAM_CALLBACK = Symbol('powercycle.streamCallback')
export const $_PROXY_GET_PATH = Symbol('powercycle.$ProxyGetPath')
export const $_PROXY_BASE_STREAM = Symbol('powercycle.$ProxyBaseStream')

// This is only needed to allow such shortcuts with shortcuts/powerUpSources:
// sources[inc].click
// The value of this seems borderline. We can later remove this support and
// with it this list.
export const typeSymbols = [
  VDOM_ELEMENT_FLAG,
  STREAM_CALLBACK,
  $_PROXY_GET_PATH,
  $_PROXY_BASE_STREAM
]

export function isComponentNode (node) {
  return node &&
    node[VDOM_ELEMENT_FLAG] &&
    typeof node.type === 'function'
}

export function isElement (val) {
  return val && (
    val[VDOM_ELEMENT_FLAG] ||
    // Our pragma is not called in case of react Fragments, so we still
    // need to specifically check for react elements - but luckily it doesn't
    // need additional dependency in this module, so it's okay
    val.$$typeof === Symbol.for('react.element')
  )
}

export function isStream (val) {
  let _isStream = val instanceof Stream

  if (!_isStream && /^(?:Memory)Stream$/i.test(get(val, ['constructor', 'name']))) {
    console.warn('Powercycle\'s stream detection failed on an object with an ' +
      'instanceof check, but it pretty much seems like a stream. It\'s probably ' +
      'a double xstream instance problem on codesandbox.')
    return true
  }

  return _isStream
}

export function isDomElement(node) {
  return node && node[VDOM_ELEMENT_FLAG] && (
    typeof node.type === 'string' ||
    // Dom node with sel
    node.type && node.type.$$typeof === Symbol.for('react.forward_ref')
  )
}

export function isVdomChild (path) {
  // Map to string before join to prevent errors on symbol keys (from our pragma)
  return /^0(?:\.props\.children(?:\.\d+)?)*$/.test(path.map(String).join('.'))
}

export function isInlineComponent (val, path) {
  return typeof val === 'function' &&
    !val[STREAM_CALLBACK] &&
    isVdomChild(path)
}

export function isStreamCallback (val) {
  return typeof val === 'function' &&
    val[STREAM_CALLBACK]
}

// It could be recursive for safety, assuming that there might be cases
// with nested stream callback wrapping, but I couldn't produce so far an
// example, where this non-recursive version didn't work well.
export function resolveStreamCallback (value, src) {
  return isStreamCallback(value)
    ? value(src) // resolveStreamCallback(value(src), src)
    : value
}

export function wrapInStreamCallback (fn) {
  return Object.assign(fn, { [STREAM_CALLBACK]: true })
}
