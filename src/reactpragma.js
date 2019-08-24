import { jsxFactory } from '@cycle/react-dom'
export { Fragment } from 'react'
import { clone } from './fp.js'
import { createElement } from './dynamictypes.js'
import { resolvePlaceholder } from './shortcuts.js'

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
  const $children = children.map(resolvePlaceholder)

  let element = jsxFactory.createElement(node, props, ...$children)

  // We don't need it here as of now, as we have to clone the placeholder path
  // on every propagation anyway to trigger change detection in React.
  // return creteElement({ ...deFreezeElement(element) })
  return createElement({ ...element })
}
