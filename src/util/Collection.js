import { pragma, Fragment } from '../reactpragma.js'
import { makeCollection } from '@cycle/state'
import { powercycle, CONFIG } from '../powercycle.js'
import { resolveDotSeparatedScope } from '../shortcuts.js'
import isolate from '@cycle/isolate'
import { get } from '../util.js'
import {
  clone, uniqueId, omit, mapValues, castArray
} from '../lodashpolyfills.js'

export const COLLECTION_DELETE =
  prevState => undefined

const itemWrapperLens = {
  get: state => state.map((item, index) => {
    return {
      item,
      index,
      collection: state
    }
  }),
  set: (state, childState) => {
    return childState.map(record => record.item)
  }
}

const CollectionItem = sources =>
  powercycle(
    pragma(
      Fragment,
      null,
      sources.props.children
    ),
    null,
    sources
  )

export function Collection (sources) {
  const noWrap = sources.props.nowrap
  const outerStateName = sources.props.outerstate === undefined
    ? 'outerState'
    : sources.props.outerstate

  const listSinks = [0]
    .map(() =>
      makeCollection({
        item: CollectionItem,

        // I'm not sure what it's for. From cycle's source, it seems like that it
        // serves as an isolation base, but we already have isolation on the items...
        // itemKey: (childState, index) => String(index),

        channel: sources.props.channel || 'state',

        itemScope: sources.props.itemscope || (key => key),

        collectSinks: instances =>
          // We collect all the channels (keys) from the sources as a base for
          // pickMerge
          [clone(sources)]
            // 'props' is added to sources in powercycle(), but it's not a
            // channel
            .map(omit(['props']))
            // Add the outerstate key (value doesn't matter)
            .map(sources => ({ ...sources, [outerStateName]: 1 }))
            .map(mapValues((src, channel) => instances.pickMerge(channel)))
            // ...and pickCombine the vdom channel
            .map(sinks => ({
              ...sinks,
              [CONFIG.vdomProp]: instances
                .pickCombine(CONFIG.vdomProp)
                .map(itemVdoms =>
                  itemVdoms.map((vdom, idx) => ({
                    ...vdom,
                    key: String(idx)
                  }))
                )
            }))
          [0]
      })
    )

    // Wrap items in a record, holding 3 keys: item, index, collection
    .map(list =>
      noWrap
        ? list
        : isolate(list, {
            state: itemWrapperLens
          })
    )

    // Resolve 'for' prop. The 'for' prop has the same effect of 'scope', except
    // that it doesn't scope down the outerState stream in the items so they
    // can have full access to the outer state
    .map(list =>
      sources.props.for
        ? isolate(list, resolveDotSeparatedScope(sources.props.for))
        : list
    )

    // Add outerState to sources
    .map(list =>
      outerStateName
        ? sources => {
            const sinks = list({
              // de-proxy proxyfied sources object
              ...clone(sources),
              // It only works with streams, donno why
              [outerStateName]: sources.state.stream,
            })

            return {
              ...sinks,
              state: CONFIG.mergeFn([sinks.state, sinks[outerStateName]])
            }
          }
        : list
    )

    .map(list => pragma(list, null, ...castArray(sources.props.children)))
  [0]

  return listSinks
}
