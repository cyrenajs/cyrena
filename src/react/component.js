import xs, { Stream, MemoryStream } from 'xstream'
import { h } from '@cycle/react'
import {
  makePragma,
  component as powerCycleComponent
} from '../component.js'
import { createElement, Fragment, useState, useEffect } from 'react'

export const pragma = makePragma(h)

const CONFIG = {
  vdomProp: 'react',
  combineFn: streams => xs.combine(...streams),
  mergeFn: streams => xs.merge(...streams),
  isStreamFn: val => val && val instanceof Stream || val instanceof MemoryStream
}

export function ReactRealm (sources) {
  const reducer$ = xs.create({
    start: function () {},
    stop: function () {}
  })

  return {
    react: xs.of(
      createElement(
        Fragment,
        null,
        [sources.props.children]
          .flat()
          .map((cmp, idx) =>
            cmp && cmp.$$typeof === Symbol.for('react.element')
              ? {
                ...cmp,
                key: cmp.key != null ? cmp.key : idx,
                props: { ...cmp.props, sources: { ...sources, reducer$ } }
              }
              : cmp
          )
      )
    ),
    state: reducer$
  }
}

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

export function Scope (sources) {
  return component(
    createElement(Fragment, null, sources.props.children),
    null,
    sources
  )
}

export function withPower (Cmp) {
  return function (sources) {
    return component(createElement(Cmp), null, sources)
  }
}

export function component (vdom, eventSinks, sources, config) {
  return powerCycleComponent(vdom, { ...CONFIG, sources, eventSinks, ...config })
}
