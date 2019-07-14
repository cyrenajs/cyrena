import { jsxFactory } from '@cycle/react-dom'
export { Fragment } from 'react'

import uniqueId from 'lodash/uniqueId'
import defaultTo from 'lodash/defaultTo'

export const VDOM_ELEMENT_FLAG = Symbol('powercycle.element')
export const VDOM_ELEMENT_KEY_PROP = Symbol('powercycle.key')

// Currently unused, but the purpose is to get runtime information about the
// Object.freeze usage on React elements.
export const CYCLE_REACT_ELEMENTS_WRITABLE =
  Object.getOwnPropertyDescriptor(
    jsxFactory.createElement('div'),
    'type'
  ).writable


export function pragma(node, attr, ...children) {
  const key = attr && attr.key

  // React pragma convert key attribs to string so it's just better to
  // set it undefined to avoid having an [object Object] key
  if (attr && typeof attr.key !== 'string') {
    attr.key = undefined
  }

  const props = {
    ...attr,
    // Enforce key presence to suppress warnings coming from react pragma.
    // Not sure if it's a good idea, but for now it just frees us from
    // those annoying warnings... Collection is handling its item keys
    // on its own.
    key: defaultTo(key, 'power-pragma-autokey-' + uniqueId())
  }

  const jsx = jsxFactory.createElement(node, props, ...children)

  return {
    ...jsx,
    // props: vdom.props && {
    //   ...vdom.props,
    //   // ...cloneDeep(omit(vdom.props, 'children')),
    //   // children: clone(vdom.props.children)
    //   style: vdom.props.style && {
    //     ...vdom.props.style
    //   },
    //   children: Array.isArray(vdom.props.children)
    //     ? [...vdom.props.children]
    //     : isPlainObject(vdom.props.children)
    //       ? { ...vdom.props.children }
    //       : vdom.props.children
    // },
    [VDOM_ELEMENT_FLAG]: true,
    [VDOM_ELEMENT_KEY_PROP]: key
  }
}
