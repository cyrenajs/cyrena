import { h } from '@cycle/react'
export { Fragment } from 'react'

import uniqueId from 'lodash/uniqueId'
import defaultTo from 'lodash/defaultTo'

export const VDOM_ELEMENT_FLAG = Symbol('powercycle.element')
export const VDOM_ELEMENT_KEY_PROP = Symbol('powercycle.key')
export const VDOM_INLINE_CMP = Symbol('powercycle.inline-cmp')

export function pragma(node, attr, ...children) {
  const key = attr && attr.key

  // React pragma convert key attribs to string so it's just better to
  // set it undefined to avoid having an [object Object] key
  if (attr && typeof attr.key !== 'string') {
    attr.key = undefined
  }

  const vdom = h(
    node,
    {
      ...attr,
      // Enforce key presence to suppress warnings coming from react pragma.
      // Not sure if it's a good idea, but for now it just frees us from
      // those annoying warnings... Collection is handling its item keys
      // on its own.
      key: defaultTo(key, 'power-pragma-autokey-' + uniqueId())
    },
    children.map((el, idx) => {
      if (typeof el === 'function') {
        el[VDOM_INLINE_CMP] = true
      }
      return el
    })
  )

  return {
    ...vdom,
    key: vdom.key,
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
