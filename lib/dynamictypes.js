import { Stream } from 'xstream'
import {
  get
} from '../util/lodashpolyfills.js'

export const VDOM_ELEMENT_FLAG =
  Symbol('powercycle.element')

export const STREAM_CALLBACK =
  Symbol('powercycle.streamCallback')

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
