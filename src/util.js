import { castArray, get as _get, uniqueId, omit, pick } from './lodashpolyfills.js'
import { pragma, Fragment } from './reactpragma.js'
import { powercycle, CONFIG } from './powercycle.js'

import {
  Collection,
  collectSinksBasedOnSource
} from './util/Collection.js'

import {
  withState,
  Instances,
  StateSource
} from '@cycle/state'

import xs from 'xstream'
import sampleCombine from 'xstream/extra/sampleCombine'

import {
  resolve$Proxy,
  isStateMapper,
  createStateMapper,
  resolveStateMapper,
  resolveShorthandOutput
} from './shortcuts.js'

import {
  isStream
} from './dynamictypes.js'

// This is just a dummy component to serve as a lens or collection item
// container for a sub-vdom.
export function Scope (sources) {
  return wrapInComponent(sources.props.children)(sources)
}

export function getDynamicCmp (stream, getCmp) {
  return sources => {
    const _stream = resolveStateMapper(stream, sources)

    const instances$ = _stream.fold(function (acc, next) {
      const key = next && next.key || uniqueId()
      const cmp = getCmp(next)
      const sinks = cmp(sources)

      acc.dict.clear()
      acc.dict.set(key, sinks)

      return { dict: acc.dict, arr: [{ ...sinks, _key: key }] }
    }, { dict: new Map(), arr: [] })

    return collectSinksBasedOnSource(sources)(new Instances(instances$))
  }
}

export function wrapInComponent(...values) {
  return sources => {
    return powercycle(
      pragma(Fragment, null, ...castArray(values)),
      null,
      sources
    )
  }
}

// Helper function to easily access state parts in the vdom.
// src can be any of these 4:
// - stream
// - $ proxy
// If src is a sources object, then the mapper will occur on
// src.state.stream
export const $map = (_fn, src) => {
  const _src = resolve$Proxy(src)
  const fn = resolve$Proxy(_fn)

  return (
    isStream(_src)
      ? _src.map(fn) :

    isStateMapper(_src)
      ? createStateMapper(state => fn(_src(state))) :

    typeof fn === 'function'
      ? createStateMapper(fn) :

    createStateMapper(() => fn)
  )
}

export const $get = (key, src) =>
  $map(
    streamVal => key ? _get(streamVal, key.split('.')) : streamVal,
    src
  )

export const $for = (base, vdom) => {
  return pragma(Collection, { for: base }, vdom)
}




/**
 * Based on jvanbruegge's withLocalState
 * at https://github.com/cyclejs/cyclejs/issues/882
 * https://gist.github.com/jvanbruegge/9af17f4f5fca8bb3e6198ebe65afac55
 *
 * The inner component only see the main state channel. The merger object works
 * like a lens, where 'merge' is the 'get', and 'extract' is the 'set'. The
 * extract method receives the merged state and expects an object with a 'global'
 * and 'local' key. The merge method receives the global and local states, and
 * expects a merged state.
 * const customMerger = {
 *   merge: (g, l) => ({ ...l, { authToken: g.authToken }),
 *   extract: t => ({ global: { authToken: t.authToken }, local: omit(['authToken'], t) })
 * }
 * export const Login = withLocalState(LoginComponent, customMerger);
 */
export function _withLocalState(localKeys, cmp) {
  const defaultMerger = {
    merge: (global, local) => ({ ...global, ...local }),
    extract: state => ({
      global: omit(localKeys)(state),
      local: pick(localKeys)(state)
    })
  }

  const stateChannel = 'state'
  const localChannel = '_localState'

  const wrapper = function WithLocalState(sources) {
    const merger = defaultMerger

    const state$ = xs
      .combine(
        sources[stateChannel].stream,
        sources[localChannel].stream
      )
      .map(([g, l]) => merger.merge(g, l))
      .startWith(undefined)
      .remember()

    const sinks = cmp({
      ...omit([localChannel])(sources),
      [stateChannel]: new StateSource(state$, 'withLocalState')
    })

    const updated$ = !sinks[stateChannel] ? xs.never() :
      sinks[stateChannel]
        .compose(sampleCombine(state$))
        .map(([reducer, state]) => merger.extract(reducer(state)))

    const global$ = updated$.map(s => state => ({ ...state, ...s.global }))
    const local$ = updated$.map(s => state => ({ ...state, ...s.local }))

    return {
      ...sinks,
      [stateChannel]: global$,
      [localChannel]: local$
    }
  }

  return withState(wrapper, localChannel)
}

export function withLocalState(localKeys) {
  return cmp => {
    return _withLocalState(localKeys, resolveShorthandOutput(cmp))
  }
}
