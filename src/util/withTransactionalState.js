import { withState } from '@cycle/state'
import withPower from 'powercycle'
import xs from 'xstream'
import sampleCombine from 'xstream/extra/sampleCombine'

export function withTransactionalState (reducerOrActionsObject, cmp) {
  const reducer = typeof reducer === 'function'
    ? makeReducer(reducerOrActionsObject)
    : reducerOrActionsObject

  return withState(sources => {
    const sinks = withPower(cmp)(sources)

    sinks.state =
      (sinks.state || xs.never())
        .compose(sampleCombine(sources.state.stream))
        .map(([actionOrReducer, prevState]) => {

          if (typeof actionOrReducer === 'function') {
            return actionOrReducer

          } else {
            return () => reducer(prevState, actionOrReducer)

          }
        })
        .startWith(() => reducer(undefined, []))

    return sinks
  })
}
