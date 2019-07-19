import { jsxFactory } from '@cycle/react-dom'
export { Fragment } from 'react'

import uniqueId from 'lodash/uniqueId'
import defaultTo from 'lodash/defaultTo'
// import clone from 'lodash/clone'

export const VDOM_ELEMENT_FLAG = Symbol('powercycle.element')
export const VDOM_ELEMENT_KEY_PROP = Symbol('powercycle.key')

// De-freeze the vdom element to allow placeholder fill-ups. Not needed
// at the moment, but I just leave it here for reference.
// function deFreezeElement(element) {
//   const el = clone(element)
//
//   if (el.props) {
//     el.props = clone(el.props)
//   }
//
//   if (el.props.children && typeof el.props.children !== 'function') {
//     el.props.children = clone(el.props.children)
//   }
//
//   return el
// }

export function pragma(node, attr, ...children) {
  const key = attr && attr.key

  const props = {
    ...attr,
    // Enforce key presence to suppress warnings coming from react pragma.
    // Not sure if it's a good idea, but for now it just frees us from
    // those annoying warnings... Collection is handling its item keys
    // on its own. This is probably for sibling DOM elements, but I'm not sure.
    key: defaultTo(key, 'pc-pragma-autokey-' + uniqueId())
  }

  let element = jsxFactory.createElement(node, props, ...children)

  return {
    // We don't need it here as of now, as we have to clone the placeholder path
    // on every propagation anyway to trigger change detection in React.
    // ...deFreezeElement(element),
    ...element,
    [VDOM_ELEMENT_FLAG]: true,
    [VDOM_ELEMENT_KEY_PROP]: key
  }
}
