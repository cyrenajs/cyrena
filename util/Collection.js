import uniqueId from 'lodash/uniqueId'
import omit from 'lodash/fp/omit'

import { pragma, Fragment } from '../react/pragma'
import { makeCollection } from '@cycle/state'
import { powercycle, isolate } from '../component'
import { get } from './index'

export const COLLECTION_DELETE =
  prevState => undefined

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
  const indexKey = sources.props.indexKey || 'index'
  const idKey = sources.props.idKey || 'id'

  const innerFragmentKey = sources.key || uniqueId()

  const List = makeCollection({
    item: CollectionItem(idKey),

    // I'm not sure what it's for. From cycle's source, it seems like that it
    // serves as an isolation base, but we already have isolation on the items...
    // itemKey: (childState, index) => String(index),

    itemScope: key => key,
    collectSinks: instances => {
      return ({
        react: instances
          .pickCombine('react')
          .map(itemVdoms => pragma(
            Fragment,
            { key: innerFragmentKey },
            itemVdoms.map((vdom, idx) => ({
              ...vdom,
              key: String(idx)
            }))
          )),
        state: instances.pickMerge('state')
      })
    }
  })

  const addIndexLens = {
    get: state => state.map((record, idx) => {
      if (!record[idKey]) {
        console.warn(
          `Collection item is expecting id key (${idKey}). You can provide an ` +
          `empty object for it, like: id: {}`
        )
      }

      return { ...record, [indexKey]: idx }
    }),
    set: (state, childState) => childState.map(omit(indexKey))
  };

  const listCmp = isolate(List, { state: addIndexLens })

  // Wrap it in a fragment to prevent
  // 'missing unique key warning from react in case of having adjacent elements
  // to the Collection. makeCollection generates a Context.Provider element,
  // which can't have key
  return pragma(Fragment, null, pragma(listCmp, null, sources.props.children))
}
