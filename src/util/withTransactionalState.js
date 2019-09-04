import { withState } from '@cycle/state'
import withPower from 'powercycle'
import xs from 'xstream'
import sampleCombine from 'xstream/extra/sampleCombine'

export const makeAction = name => payload => [name, payload]

export function withTransactionalState (reducer, cmp) {
  return withState(sources => {
    const sinks = withPower(cmp)(sources)

    sinks.state =
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
