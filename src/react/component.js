import xs from 'xstream'
import { h } from '@cycle/react'
import { Fragment, useState, useEffect } from 'react'
import cloneDeepWith from 'lodash/cloneDeepWith'
import clone from 'lodash/clone'

import omit from 'lodash/fp/omit'
import _get from 'lodash/get'
import castArray from 'lodash/castArray'
import uniqueId from 'lodash/uniqueId'

import { makeCollection } from '@cycle/state'
import cycleIsolate from '@cycle/isolate'

import {
  makePragma,
  makePowerSources,
  powerCycleComponent
} from '../component.js'

export const pragma = makePragma(h, Fragment)

const CONFIG = {
  vdomProp: 'react',
  combineFn: streams => xs.combine(...streams),
  mergeFn: streams => xs.merge(...streams),
  isolateFn: isolate
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
export function ReactRealm (_sources) {
  const reducer$ = xs.create({
    start: function () {},
    stop: function () {}
  })

  const subVdomWithAmendedProps = cloneDeepWith(
    _sources.props.children,
    function (val) {
      if (isReactComponent(val)) {
        const sources = Object.assign(clone(_sources), { reducer$ })
        return { ...val, props: { ...val.props, sources }}
      }
    }
  )

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

// This is just a dummy component to serve as a lens or collection item
// container for a sub-vdom.
export function Scope (sources) {
  return component(
    pragma(Fragment, null, ...castArray(sources.props.children)),
    null,
    sources
  )
}

export function isolate(Cmp, lens) {
  return function (sources) {
    return component(
      pragma(
        Fragment,
        null,
        pragma(cycleIsolate(Cmp, lens), null, sources.props.children)
      ),
      null,
      sources
    )
  }
}

const COLLECTION_ITEM_ID = Symbol('powercycle.collection-item-id')

export function CollectionItem (sources) {
  return component(
    pragma(
      Fragment,
      { key: get(COLLECTION_ITEM_ID, sources) },
      sources.props.children
    ),
    null,
    sources
  )
}

export function Collection (sources) {
  const itemsMap = new WeakMap()

  const uniqeId = (function* () {
    let id = 1
    while (1) yield id++
  })()

  const List = makeCollection({
    item: CollectionItem,
    collectSinks: instances => {
      return ({
        react: instances
          .pickCombine('react')
          .map(itemVdoms => pragma(
            Fragment,
            null,
            itemVdoms)
          ),
        state: instances.pickMerge('state')
      })
    }
  })

  const indexKey = sources.props.indexKey || 'index'

  const addIndexLens = {
    get: state => state.map((record, idx) => {
      record[indexKey] = idx
      if (!itemsMap.has(record)) {
        itemsMap.set(record, uniqeId.next().value)
      }
      record[COLLECTION_ITEM_ID] = itemsMap.get(record)

      return record
    }),
    set: (state, childState) => childState.map(state => {
      delete state[indexKey]
      return state
    })
  };

  const listCmp = isolate(List, { state: addIndexLens })

  // Wrap it in a fragment to prevent
  // 'missing unique key warning from react in case of having adjacent elements
  // to the Collection. makeCollection generates a Context.Provider element,
  // which can't have key
  return pragma(Fragment, null, pragma(listCmp, null, sources.props.children))
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

// Wrapper for any cycle component for the convenience of shorthand
// return values. An initial component() call remembers the sources object,
// and passes it through every invocation through the component() call tree.
export function withPower (Cmp) {
  return function (sources) {
    return component(pragma(Cmp), null, sources)
  }
}

export function component (vdom, eventSinks, sources, config) {
  return powerCycleComponent(vdom, { ...CONFIG, sources, eventSinks, ...config })
}
