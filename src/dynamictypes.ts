/**
 * The type system in powercycle is a 4-level ladder:
 *
 * - Component :: SourcesObject -> SinksObject
 *   Any function
 * - InlineComponent :: SourcesObject -> SinksObject
 *   Any function
 * - StateMapper :: State -> State
 *   Produced mainly with the $map function - function with a symbol flag
 * - StateReference :: Proxy sugar which resolves to a StateMapper in
 *   powercycle::traverseAction
 * - StreamReference :: Proxy sugar which resolves to a Stream in
 *   powercycle::traverseAction
 */

import { Stream } from 'xstream'
import { get } from './fp.js'
import { isPlaceholder } from './placeholder.js'

export const VDOM_ELEMENT_FLAG = Symbol('powercycle.element')
export const STATE_MAPPER = Symbol('powercycle.state_mapper')

export const SEL_ROOT = Symbol('ROOT')

// This is only needed to allow such shortcuts with shortcuts/powerUpSources:
// sources[inc].click
// The value of this seems borderline. We can later remove this support and
// with it this list.
export const typeSymbols = [
  VDOM_ELEMENT_FLAG,
  STATE_MAPPER
]

export function isPrimitive(val) {
  return val == null || typeof val === 'string' || typeof val === 'boolean' ||
    typeof val === 'number'
}

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

  if (!_isStream && !isPlaceholder(val) &&
    /^(?:Memory)Stream$/i.test(get(['constructor', 'name'])(val))
  ) {
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

export function isVdomChildPath (path) {
  // Map to string before join to prevent errors on symbol keys (from our pragma)
  return /^0(?:\.props\.children(?:\.\d+)?)*$/.test(path.map(String).join('.'))
}

export function isInlineComponent (val, path) {
  return typeof val === 'function' &&
    !val[STATE_MAPPER] &&
    isVdomChildPath(path)
}

export function createElement (vdom) {
  return Object.assign(vdom, {
    [VDOM_ELEMENT_FLAG]: true
  })
}
