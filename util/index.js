import castArray from 'lodash/castArray'
import _get from 'lodash/get'

import { pragma, Fragment } from '../react/pragma'
import { powercycle, CONFIG, INLINE_CMP } from '../powercycle'

// This is just a dummy component to serve as a lens or collection item
// container for a sub-vdom.
export function Scope (sources) {
  return powercycle(
    pragma(Fragment, null, ...castArray(sources.props.children)),
    null,
    sources
  )
}

// An inline component which is flagged with noscope to avoid altering the
// functor value in the powercycle traverse action. This solution enables the
// usage of get('key') in DOM element props. E.g.: <input value={get('text')} />
// This is specifically made for the get/map shortcuts, not for general usage.
// The tricky thing with callback placeholders in DOM props is that if we handle
// them separately in the traverse action based on its path, and make it just
// return with a stream, then it will be prone to scoping.
function makeTransparentInlineCmp(fn) {
  return Object.assign(
    src => ({ [CONFIG.vdomProp]: fn(src) }),
    {
      [INLINE_CMP]: true,
      props: { noscope: true }
    }
  )
}

export const $ = makeTransparentInlineCmp

// Helper function to easily access state parts in the vdom.
// If src is provided, it'll use that as the sources object and return
// with a stream. If it's omitted, it will instead create an inline
// component
export const map = (fn, src) =>
  src
    ? src.state.stream.map(fn)
    : makeTransparentInlineCmp(src => map(fn, src))

export const get = (key, src) =>
  map(state => key ? _get(state, key) : state, src)
