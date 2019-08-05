import { pragma, Fragment } from '../reactpragma.js'
import { makeCollection } from '@cycle/state'
import { powercycle, CONFIG, isolate } from '../powercycle.js'
import { getPathLens } from '../shortcuts.js'
import { get } from '../util.js'
import {
  clone, uniqueId, omit, mapValues, castArray, assign
} from '../lodashpolyfills.js'

export const COLLECTION_DELETE =
  prevState => undefined

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

const identityLens = {
  get: state => state,
  set: (state, childState) => childState
}

export function Collection (sources) {
  const outerStateName = sources.props.outerstate === undefined
    ? 'outerState'
    : sources.props.outerstate
  const channel = sources.props.channel || 'state'

  const forLens = !sources.props.for
    ? identityLens
    : getPathLens(sources.props.for)

  const collectionCmp = makeCollection({
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

  // This part wraps the item states in an object which provides access to all
  // the needed information for the item:
  // - item - the item state itself
  // - index - the item index in the collection
  // - collection - the collection array
  // - outerState - the whole outer state
  //
  // The regular state sink of the item receives reducers of this wrapper object.
  // The lens will read the 'item' key, but the collection and outerState keys
  // can be returned modified as well. The lens will detect if there's a change
  // on these outer objects, and takes that into account. This is a bit smelly
  // from and FP standpoint, but it keeps user code terse and clear without
  // having to rely on convoluted outerState: ev$ -> ev$.compose(state) stuff.
  // However, that solution keeps being available too.
  const listCmpWithSpecialItemScope = [collectionCmp]
    .map(list => {
      return isolate(list, {
        state: {
          get: state => {
            return forLens.get(state)
              .map((item, index, collection) => ({
                item, index, collection, outerState: state
              }))
          },
          set: (state, childState) => {
            let outerStateChanged = false
            let collectionChanged = false

            const collection = forLens.get(state)

            const setterForItemWrap = (state, childState) =>
              childState.map(record => {
                if (state !== record.outerState) {
                  outerStateChanged = { value: record.outerState }
                }
                if (collection !== record.collection) {
                  collectionChanged = { value: record.collection }
                }

                return record.item
              })

            const result =
              forLens.set(state, setterForItemWrap(state, childState))

            if (collectionChanged) {
              return forLens.set(state, collectionChanged.value)
            }
            if (outerStateChanged) {
              return outerStateChanged.value
            }

            return result
          }
        }
      })
    })

    // Add outerState to sources
    .map(list =>
      outerStateName
        ? sources => {
            // outerStateWrapperLens =
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
  [0]

  return pragma(
    listCmpWithSpecialItemScope,
    null,
    ...castArray(sources.props.children)
  )
}
