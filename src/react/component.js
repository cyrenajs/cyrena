import xs from 'xstream'
import { h } from '@cycle/react'
import { createElement, Fragment, useState, useEffect } from 'react'
import cloneDeepWith from 'lodash/cloneDeepWith'

import { makeCollection } from '@cycle/state'

import {
  makePragma,
  component as powerCycleComponent
} from '../component.js'


export const pragma = makePragma(h)

const CONFIG = {
  vdomProp: 'react',
  combineFn: streams => xs.combine(...streams),
  mergeFn: streams => xs.merge(...streams)
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

// This is just a dummy component to serve as a lens or collection boundary for
// a sub-vdom.
export function Scope (sources) {
  return component(
    createElement(Fragment, null, sources.props.children),
    null,
    sources
  )
}

export function Collection (sources) {
  const List = makeCollection({
    item: Scope,
    itemKey: (childState, index) => String(index), // or, e.g., childState.key
    itemScope: key => key, // use `key` string as the isolation scope
    collectSinks: instances => {
      return {
        react: instances
          .pickCombine('react')
          .map(itemVNodes => createElement(Fragment, null, itemVNodes)),
        state: instances.pickMerge('state')
      }
    }
  })

  return List(sources)
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
