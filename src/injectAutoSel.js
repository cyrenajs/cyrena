import { omit } from './fp.js'
import { SEL_ROOT } from './dynamictypes.js'
import { pragma } from './reactpragma.js'

// Injects sel={SEL_ROOT} automatically on the root element of the VDOM
// It's used internally with powerUpSources
export default function injectAutoSel (vdom) {
  return typeof vdom.type !== 'string' || vdom.props.sel
    ? vdom
    : pragma(
        vdom.type,
        { ...omit(['key'])(vdom.props), sel: SEL_ROOT },
        vdom.props.children
      )
}
