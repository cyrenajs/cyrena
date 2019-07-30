import { jsxFactory } from '@cycle/react-dom'
export { Fragment } from 'react'
import { clone } from '../util/lodashpolyfills.js'
import { VDOM_ELEMENT_FLAG } from '../lib/dynamictypes.js'

// De-freeze the vdom element which React freezes. It allows us to fill-up
// placeholders, though it's not needed for that purpose atm, because
// path-cloning is a must to avoid bailout in renders. But it might be useful
// for being able to mutate the tree during static travere.
function deFreezeElement(element) {
  const el = clone(element)

  if (el.props) {
    el.props = clone(el.props)
  }

  // if (el.props.children && typeof el.props.children !== 'function') {
  //   el.props.children = clone(el.props.children)
  // }

  return el
}

export function pragma(node, props, ...children) {
  let element = jsxFactory.createElement(node, props, ...children)

  return {
    // We don't need it here as of now, as we have to clone the placeholder path
    // on every propagation anyway to trigger change detection in React.
    ...deFreezeElement(element),
    // ...element,
    [VDOM_ELEMENT_FLAG]: true
  }
}
