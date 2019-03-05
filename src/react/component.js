import xs, { Stream } from 'xstream'
import { h } from '@cycle/react'
import { makePragma, component as powerCycleComponent} from '../component.js'
import { createElement, Fragment, useState, useEffect } from 'react'
import cloneDeepWith from 'lodash/cloneDeepWith'

export const pragma = makePragma(h)

const CONFIG = {
  vdomProp: 'react',
  combineFn: streams => xs.combine(...streams),
  mergeFn: streams => xs.merge(...streams),
  isStreamFn: val => val instanceof Stream
}

const isReactComponent = val =>
  val && val.$$typeof === Symbol.for('react.element') &&
    typeof val.type === 'function'

// This cycle component does the followings:
// - prepares a reducer$ stream early to have it in the sinks object
// - traverses the sub-vdom deeply, regardless of component boundaries
//   (they're all react components, we're not invoking them), and amends the
//   components' props objects with the necessary cycle information, later
//   used in the hooks
export function ReactRealm (sources) {
  const reducer$ = xs.create({
    start: function () {},
    stop: function () {}
  })

  const subVdomWithAmendedProps = cloneDeepWith(
    sources.props.children,
    val => isReactComponent(val)
      ? {
        ...val,
        props: {
          ...val.props,
          sources: { ...sources, reducer$ }
        }
      }
      : undefined
  )

  return {
    react: xs.of(
      createElement(Fragment, null, subVdomWithAmendedProps)
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

// This is just a dummy component to serve as a lens boundary for
// a sub-vdom. Use lens prop on it, just as on any other cycle component
export function Scope (sources) {
  return component(
    createElement(Fragment, null, sources.props.children),
    null,
    sources
  )
}

// Wrapper for any cycle component for the convenience of shorthand
// return values. An initial component() call remembers the sources object,
// and passes it through every invocation through the component() call tree.
export function withPower (Cmp) {
  return function (sources) {
    return component(createElement(Cmp), null, sources)
  }
}

export function component (vdom, eventSinks, sources, config) {
  return powerCycleComponent(vdom, { ...CONFIG, sources, eventSinks, ...config })
}
