import { pragma, Fragment } from '../reactpragma.js'
import { makeCollection } from '@cycle/state'
import { powercycle, CONFIG } from '../powercycle.js'
import { resolveDotSeparatedScope } from '../shortcuts.js'
import isolate from '@cycle/isolate'
import { get } from '../util.js'
import {
  clone, uniqueId, omit, mapValues, castArray, assign
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

export const CollectionItem = sources =>
  powercycle(
    pragma(Fragment, null, ...castArray(sources.props.children)),
    null,
    sources
  )

// Collect all the channels (keys) from the sources as a base for pickMerge
export const collectSinksBasedOnSource = sources => instances => {
  // Make sure that the sources object is de-proxyfied
  return [clone(sources)]
    // 'props' is a special source prop, and not a channel
    .map(omit(['props']))
    // pickMerge the event channels based on the sources keys
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
}

export function Collection (sources) {
  const noWrap = sources.props.nowrap
  const outerStateName = sources.props.outerstate === undefined
    ? 'outerState'
    : sources.props.outerstate
  const channel = sources.props.channel || 'state'

  const listSinks = [0]
    .map(() =>
      makeCollection({
        item: CollectionItem,
        // I'm not sure what it's for. From cycle's source, it seems like that it
        // serves as an isolation base, but we already have isolation on the items...
        // itemKey: (childState, index) => String(index),
        channel,
        itemScope: sources.props.itemscope || (key => key),
        collectSinks: collectSinksBasedOnSource({
          ...sources,
          // Value doesn't matter here, just add the outerstate key for pickMerge
          ...outerStateName && { [outerStateName]: 1 }
        })
      })
    )

    // Wrap items in a record, holding 3 keys: item, index, collection
    .map(list =>
      noWrap
        ? list
        : isolate(list, {
            [channel]: itemWrapperLens
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
              ...sources,
              // It only works with streams, donno why
              [outerStateName]: sources[channel].stream,
            })

            return {
              ...sinks,
              [channel]: CONFIG.mergeFn([sinks[channel], sinks[outerStateName]])
            }
          }
        : list
    )

    .map(list => pragma(list, null, ...castArray(sources.props.children)))
  [0]

  return listSinks
}
