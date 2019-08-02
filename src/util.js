import { castArray, get as _get, uniqueId } from './lodashpolyfills.js'
import { pragma, Fragment } from './reactpragma.js'
import { powercycle, CONFIG } from './powercycle.js'
import { STREAM_CALLBACK } from './dynamictypes.js'
import { collectSinksBasedOnSource } from './util/Collection.js'
import { makeCollection } from '@cycle/state'

// This is just a dummy component to serve as a lens or collection item
// container for a sub-vdom.
export function Scope (sources) {
  return pragma(Fragment, null, ...castArray(sources.props.children))
}

export function getConditionalCmp (cond$, children) {
  const conditionStateChannel = '$$$cond' + uniqueId()

  return sources => {
    const collection = makeCollection({
      item: sources => powercycle(
        pragma(Fragment, null, ...castArray(children)),
        null,
        sources
      ),
      itemScope: () => ({ '*': null }),
      channel: conditionStateChannel,
      collectSinks: collectSinksBasedOnSource(sources)
    })

    return collection({
      ...sources,
      [conditionStateChannel]: { stream: cond$.map(cond => cond ? [{}] : []) }
    })
  }
}

export function If (sources) {
  const cond$ = sources.props.cond[STREAM_CALLBACK]
    ? sources.props.cond(sources)
    : sources.props.cond

  const thenVdom = sources.props.then || sources.props.children
  const elseVdom = sources.props.else

  return pragma(
    Fragment,
    null,
    getConditionalCmp(cond$, thenVdom),
    getConditionalCmp(cond$.map(cond => !cond), elseVdom)
  )
}


// Helper function to easily access state parts in the vdom.
// If src is provided, it'll use that as the sources object and return
// with a stream. If it's omitted, it will instead create an inline
// component
export const map = (fn, src) =>
  src
    ? src.state.stream.map(fn)
    : Object.assign(src => map(fn, src), { [STREAM_CALLBACK]: true })

export const get = (key, src) =>
  map(state => key ? _get(state, key.split('.')) : state, src)
