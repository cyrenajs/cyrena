import { castArray, get as _get } from './lodashpolyfills.js'
import { pragma, Fragment } from './reactpragma.js'
import { powercycle, CONFIG } from './powercycle.js'
import { Collection } from './util/Collection.js'
import { STREAM_CALLBACK } from './dynamictypes.js'

// This is just a dummy component to serve as a lens or collection item
// container for a sub-vdom.
export function Scope (sources) {
  return pragma(Fragment, null, ...castArray(sources.props.children))
}

export function getConditionalCmpEl(cond, children) {
  return pragma(
    Collection,
    {
      itemscope: () => null,
      nowrap: true,
      outerstate: false,
      scope: {
        state: {
          get: state => cond(state) ? [state] : [],
          set: (state, inner) => inner[0]
        }
      }
    },
    ...castArray(children)
  )
}

export function If ({ props }) {
  return pragma(
    Fragment,
    null,
    getConditionalCmpEl(props.cond, props.then || props.children),
    getConditionalCmpEl(state => !props.cond(state), props.else)
  )
}

// Helper function to easily access state parts in the vdom.
// If src is provided, it'll use that as the sources object and return
// with a stream. If it's omitted, it will instead create an inline
// component
export const map = (fn, src) =>
  src
    ? src.state.stream.map(fn)
    : Object.assign(src => map(fn, src), { [STREAM_CALLBACK]: true })

export const get = (key, src) =>
  map(state => key ? _get(state, key.split('.')) : state, src)
