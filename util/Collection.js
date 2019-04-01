import uniqueId from 'lodash/uniqueId'
import omit from 'lodash/fp/omit'
import clone from 'lodash/clone'
import mapValues from 'lodash/mapValues'

import { pragma, Fragment } from '../react/pragma'
import { makeCollection } from '@cycle/state'
import { powercycle, resolveDotSeparatedScope, CONFIG } from '../powercycle'
import isolate from '@cycle/isolate'
import { get } from './index'

export const COLLECTION_DELETE =
  prevState => undefined

const getIndexInjectorLens = (idKey, indexKey) => ({
  get: state => state.map((record, idx) => {
    if (!record[idKey]) {
      console.warn(
        `Collection item is expecting id key (${idKey}). You can provide an ` +
        `empty object for it, like: id: {}`
      )
    }

    if (record[indexKey] !== undefined) {
      console.warn(
        `Collection item already has an '${indexKey}' property. Choose another ` +
        `index key on the Collection by specifying the indexkey prop.`
      )
    }

    return { [indexKey]: idx, ...record }
  }),
  set: (state, childState) => childState.map(omit(indexKey))
})

const CollectionItem = idKey => sources =>
  powercycle(
    pragma(
      Fragment,
      { key: get(idKey, sources) },
      sources.props.children
    ),
    null,
    sources
  )

export function Collection (sources) {
  const indexKey = sources.props.indexkey || '$index'
  const idKey = sources.props.idkey || 'id'
  const outerStateName = sources.props.outerstate || 'outerState'

  // The vdom key of the item fragment wrapper
  const innerFragmentKey = sources.key || uniqueId()

  const List = [0]
    .map(() =>
      makeCollection({
        item: CollectionItem(idKey),

        // I'm not sure what it's for. From cycle's source, it seems like that it
        // serves as an isolation base, but we already have isolation on the items...
        // itemKey: (childState, index) => String(index),

        itemScope: sources.props.itemScope || (key => key),
        // channel: sources.props.itemScope && 'itemState',
        // channel: 'itemState',

        collectSinks: instances =>
          [clone(sources)]
            // pickMerge all channels found in sources except props and key...
            .map(omit(['props', 'key']))
            .map(sources => ({
              ...sources,
              [outerStateName]: 1
            }))
            .map(sources =>
              mapValues(
                sources,
                (src, channel) => instances.pickMerge(channel)
              )
            )
            // ...and pickCombine the vdom channel
            .map(sinks => ({
              ...sinks,
              [CONFIG.vdomProp]: instances
                .pickCombine(CONFIG.vdomProp)
                .map(itemVdoms => pragma(
                  Fragment,
                  { key: innerFragmentKey },
                  itemVdoms.map((vdom, idx) => ({
                    ...vdom,
                    key: String(idx)
                  }))
                ))
            }))
          [0]
      })
    )

    // Inject $index properties in the items. This is not optional, because we
    // need an idKey for react vdom reasons (see CollectionItem), and we can
    // only check for their existense here. Injecting index into sources is
    // also not an alternative, because collection items run once, and sources
    // does not refresh. So for now, we have to live with this O(N) expense.
    .map(list =>
      isolate(list, {
        state: getIndexInjectorLens(idKey, indexKey)
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
    .map(list => _sources => {
      const sinks = list({
        // de-proxy proxyfied sources object
        ...clone(_sources),
        // It only works with streams, donno why
        [outerStateName]: _sources.state.stream,
      })

      return {
        ...sinks,
        state: CONFIG.mergeFn([sinks.state, sinks[outerStateName]])
      }
    })

    // Wrap it in a fragment to prevent 'missing unique key' warning from react
    // in case of having adjacent elements to the Collection. makeCollection
    // generates a Context.Provider element, which can't have key.
    .map(list =>
      pragma(Fragment, null, pragma(list, null, sources.props.children))
    )
  [0]

  return List
}
