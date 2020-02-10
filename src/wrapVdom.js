import {
  omit
} from './fp.js'

import {
  Fragment
} from './reactpragma.js'

export default function wrapVdom (vdom, getInlineCmp, propsToRemove, outerProps) {
  const type = vdom.type
  const children = vdom.props.children
  const props = omit(['children', ...propsToRemove])(vdom.props)

  vdom.type = Fragment
  vdom.props = {
    children: Object.assign(getInlineCmp(type, props, children), {
      props: outerProps,
      key: vdom.key
    })
  }
}
