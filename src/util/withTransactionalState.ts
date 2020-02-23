import { withState } from '@cycle/state'
import xs from 'xstream'
import sampleCombine from 'xstream/extra/sampleCombine'
import withPower from '../powercycle'

export const makeAction = name => payload => [name, payload]

export function withTransactionalState (reducer, cmp) {
  // @ts-ignore
  return withState(sources => {
    const sinks = withPower(cmp)(sources)

    // @ts-ignore
    sinks.state =
    // @ts-ignore
      (sinks.state || xs.never())
        .compose(
          sampleCombine(sources.state.stream.startWith(undefined))
        )
        .map(([actionOrReducer, prevState]) => {
          if (typeof actionOrReducer === 'function') {
            console.warn('withTransactionalState: function reducer received ' +
              'instead of action.', actionOrReducer)

            return actionOrReducer
          } else {
            return () => reducer(prevState, actionOrReducer)
          }
        })
        .startWith(() => reducer(undefined, []))

    return sinks
  })
}
