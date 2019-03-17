import castArray from 'lodash/castArray'
import _get from 'lodash/get'

import { pragma, Fragment } from '../react/pragma'
import { powercycle } from '../powercycle'

// This is just a dummy component to serve as a lens or collection item
// container for a sub-vdom.
export function Scope (sources) {
  return powercycle(
    pragma(Fragment, null, ...castArray(sources.props.children)),
    null,
    sources
  )
}

// Helper function to easily access state parts in the vdom.
// If src is provided, it'll use that as the sources object and return
// with a stream. If it's omitted, it will instead create an inline
// component
export const map = (fn, src) =>
  src
    ? src.state.stream.map(fn)
    : src => pragma(Fragment, null, src.state.stream.map(fn))

export const get = (key, src) =>
  map(state => _get(state, key, state), src)
