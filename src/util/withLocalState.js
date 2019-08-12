import xs from 'xstream'
import sampleCombine from 'xstream/extra/sampleCombine'

import {
  withState,
  StateSource
} from '@cycle/state'

import {
  resolveShorthandOutput
} from '../shortcuts.js'

import { omit, pick } from '../lodashpolyfills.js'

/**
 * A special merger for withLocalState, which remembers the keys in the global
 * state and extracts those keys to the global channel, leaving the rest for
 * the local. This is basically saying that 'every value goes where the key
 * was first defined'. It encourages a good practice that define initial state
 * keys in an initial xs.of(() => ...) reducer.
 */
export function createDefaultStateMerger () {
  let prevGlobal
  return {
    merge: (global, local) => {
      return { ...global, ...local }
    },
    extract: state => {
      const globalKeys = Object.keys(prevGlobal || {})

      return {
        global: pick(globalKeys)(state),
        local: omit(globalKeys)(state)
      }
    }
  }
}

/**
 * Based on jvanbruegge's withLocalState
 * at https://github.com/cyclejs/cyclejs/issues/882
 * https://gist.github.com/jvanbruegge/9af17f4f5fca8bb3e6198ebe65afac55
 *
 * The inner component only sees the main state channel. The merger object works
 * like a lens, where 'merge' is the 'get', and 'extract' is the 'set'. The
 * extract method receives the merged state and expects an object with a 'global'
 * and 'local' key. The merge method receives the global and local states, and
 * expects a merged state.
 *
 * const customMerger = {
 *   merge: (g, l) => ({ ...l, { authToken: g.authToken }),
 *   extract: t => ({ global: { authToken: t.authToken }, local: omit(['authToken'], t) })
 * }
 * export const Login = withLocalState(LoginComponent, customMerger);
 *
 * Our version has a minor fix (startWith added to the global channel), and
 * currently there's no parameter for custom mergers, because we believe that
 * the above one is a good-for-all one.
 */
export function _withLocalState(cmp) {
  const stateChannel = 'state'
  const localChannel = '_localState'

  const wrapper = function WithLocalState(sources) {
    const merger = createDefaultStateMerger()

    // Combine the 2 channels into 1 stream with the merger
    const state$ = xs
      .combine(
        sources[stateChannel].stream.startWith(undefined),
        sources[localChannel].stream.startWith(undefined)
      )
      .map(([g, l]) => merger.merge(g, l))
      .remember()

    const sinks = cmp({
      ...omit([localChannel])(sources),
      [stateChannel]: new StateSource(state$, 'withLocalState')
    })

    // Convert the emitted reducers back to state values and run
    // it through extract
    const updated$ = !sinks[stateChannel] ? xs.never() :
      sinks[stateChannel]
        .compose(sampleCombine(state$))
        .map(([reducer, state]) => merger.extract(reducer(state)))

    // Convert the extracted state values back to reducers for the separate
    // channels
    const global$ = updated$.map(extractedState => prevState => {
      return { ...prevState, ...extractedState.global }
    })
    const local$ = updated$.map(extractedState => prevState => {
      return { ...prevState, ...extractedState.local }
    })

    return {
      ...sinks,
      [stateChannel]: global$,
      [localChannel]: local$
    }
  }

  return withState(wrapper, localChannel)
}

export function withLocalState(cmp) {
  return _withLocalState(resolveShorthandOutput(cmp))
}
