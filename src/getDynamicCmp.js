import collectSinksBasedOnSource from './collectSinksBasedOnSource.js'

import {
  Instances,
} from '@cycle/state'

import {
  uniqueId
} from './fp.js'

import resolveStateMapper from './resolvePlaceholder.js'

export default function getDynamicCmp (stream, getCmp) {
  return sources => {
    const _stream = resolveStateMapper(stream, sources)

    const instances$ = _stream.fold(function (acc, next) {
      const key = next && next.key || uniqueId()
      const cmp = getCmp(next)
      const sinks = cmp(sources)

      acc.dict.clear()
      acc.dict.set(key, sinks)

      return { dict: acc.dict, arr: [{ ...sinks, _key: key }] }
    }, { dict: new Map(), arr: [] })

    return collectSinksBasedOnSource(sources)(new Instances(instances$))
  }
}

