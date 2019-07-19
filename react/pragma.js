import { jsxFactory } from '@cycle/react-dom'
export { Fragment } from 'react'

import uniqueId from 'lodash/uniqueId'
import defaultTo from 'lodash/defaultTo'
// import clone from 'lodash/clone'

export const VDOM_ELEMENT_FLAG = Symbol('powercycle.element')

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

export function pragma(node, props, ...children) {
  let element = jsxFactory.createElement(node, props, ...children)

  return {
    // We don't need it here as of now, as we have to clone the placeholder path
    // on every propagation anyway to trigger change detection in React.
    // ...deFreezeElement(element),
    ...element,
    [VDOM_ELEMENT_FLAG]: true
  }
}
