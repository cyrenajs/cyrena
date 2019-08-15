import { useState, useEffect } from 'react'
import { pragma, Fragment } from '../reactpragma.js'
import xs from 'xstream'
import {
  clone, castArray, cloneDeepWith
} from '../fp.js'

const isReactComponent = val =>
  val && val.$$typeof === Symbol.for('react.element') &&
    typeof val.type === 'function'

// This cycle component does the followings:
// - prepares a reducer$ stream early to have it in the sinks object
// - traverses the sub-vdom deeply, regardless of component boundaries
//   (they're all react components, we're not invoking them), and amends the
//   components' props objects with the necessary cycle information, later
//   used in the hooks
export function ReactRealm (_sources) {
  const reducer$ = xs.create({
    start: function () {},
    stop: function () {}
  })

  const subVdomWithAmendedProps = cloneDeepWith(
    val => {
      if (isReactComponent(val)) {
        const sources = Object.assign(clone(_sources), { reducer$ })
        return { ...val, props: { ...val.props, sources }}
      }
    }
  )(_sources.props.children)

  return {
    react: xs.of(
      pragma(Fragment, null, ...castArray(subVdomWithAmendedProps))
    ),
    state: reducer$
  }
}

// React hook to handle cycle state. The sources object is passed
// to every react component in props under a ReactRealm component.
export function useCycleState (sources) {
  const [state, setState] = useState(0)

  useEffect(() => {
    sources.state.stream.subscribe({
      next: state => { setState(state) }
    })
  }, [])

  return [
    state,
    state => {
      sources.reducer$.shamefullySendNext(() => state)
    }
  ]
}
