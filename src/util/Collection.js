import { pragma } from '../reactpragma.js'
import { makeCollection, Instances } from '@cycle/state'
import { CONFIG } from '../powercycle.js'
import isolate from '@cycle/isolate'

import {
  getPathLens,
  resolveStateMapper,
  resolveShorthandOutput
} from '../shortcuts.js'

import { wrapInComponent } from '../util.js'

import {
  omit, mapValues, castArray, uniqueId, get
} from '../fp.js'

// Returns with a collection component based on the given stream. Options is
// either a function returning a ShorthandComponent or a config object.
// Options.key specficies the key upon which it decides if a component
// should be recreated or not, on a stream emit. Options.itemCmp is the item
// component. The item components will receive the following props in
// sources.props: index, item, collection. It's a cleaner solution for
// collections than the Collection component, still doing a state-based contract.
export const collection = (stream, options) => {
  const itemCmp = typeof options === 'function'
    ? options
    : options.itemCmp

  const getKey =
    typeof options.itemKey === 'function'
      ? options.itemKey :
    typeof options.itemKey === 'string'
      ? get(options.itemKey) :
    options.itemKey === null
      ? () => uniqueId() :
    (item, idx) => idx

  return sources => {
    const _stream = resolveStateMapper(stream, sources)

    const instances$ = _stream.fold(function (acc, nextArr) {
      const keys = new Set()

      const nextInstArray = nextArr.reduce((cum, nextRecord, idx) => {
        const key = getKey(nextRecord, idx)

        keys.add(key)

        if (!acc.dict.has(key)) {
          const sinks = resolveShorthandOutput(itemCmp)({
            ...sources,
            props: {
              ...sources.props,
              index: idx, // todo: it should be a stream
              item$: _stream.map(coll => coll[idx]).startWith(nextRecord),
              collection$: _stream.startWith(nextArr)
            }
          })

          acc.dict.set(key, sinks)
        }

        return cum.concat({ ...acc.dict.get(key), _key: key })
      }, [])

      acc.dict.forEach((_, key) => {
        if (!keys.has(key)) {
          acc.dict.delete(key)
        }
      })

      keys.clear()

      return { dict: acc.dict, arr: nextInstArray }

    }, { dict: new Map(), arr: [] })

    return collectSinksBasedOnSource(sources)(new Instances(instances$))
  }
}

export const COLLECTION_DELETE =
  prevState => undefined

export const CollectionItem = sources =>
  wrapInComponent(sources.props.children)(sources)

// Collect all the channels (keys) from the sources as a base for pickMerge
export const collectSinksBasedOnSource = sources => instances => {
  // Make sure that the sources object is de-proxyfied
  // Update: seems like it's not needed
  // return [clone(sources)]
  return [sources]
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

    // It might be relevant, when a collection item sink calculates something
    // based on the initial value.
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
    // @todo: use withLocalState on the item instead
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
