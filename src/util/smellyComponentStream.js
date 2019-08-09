import xs from 'xstream';
import { Instances } from '@cycle/state'
import { collectSinksBasedOnSource } from './Collection.js'
import { uniqueId, castArray } from '../lodashpolyfills.js'
import { pragma } from '../reactpragma.js'
import { powercycle } from '../powercycle.js'
import {
  resolve$Proxy,
  resolveShorthandOutput
} from '../shortcuts.js'

import {
  resolveStreamCallback
} from '../dynamictypes.js'


/**
 * This allows to use managed VDOMs/VDOM-sinks object pairs or components as
 * stream emit values. It returns a component.
 *
 * As every emit will completely replaces the previous one,
 * a completely new render will take place as well, so focus will be lost. Its
 * only meaningful use case might be where this focus loss is not a problem, but
 * we need output streams of clicks for example. A Collection is probably still
 * a better tool for the job, and this is, though looks tempting, is just a
 * smelly thing, as it switches us back to the iterative-world from static land.
 *
 * There are very hacky workarounds to prevent focus loss, like defining react
 * keys on the elements, but then a whole new class of issues will appear: the
 * old component's sinks (and their DOM listeners) will be dismantled, and the
 * new ones will not work on the non-rerendered old DOM elements, so input fields
 * become seemingly read-only. It also creates an app-level dependency on React
 * which we don't want.
 *
 * But just for the record, further very hacky mitigation for the "read-only"
 * issue would be to prevent acc.dict.clear(), so the old streams (and listeners)
 * keep working on the old DOM nodes, but then it leads to a memory and stream
 * leak with the ever-growing sink dict.
 *
 * A mitigation of the ever-growing sink dict would be to just prevent acc.dict.set
 * after the first one (if dict.size === 0 {...}), but then we have to make
 * super-super sure that the component does not get rerendered by React.
 *
 * All-in-all, you should probably never use this function.
 */
export function smellyComponentStream (stream) {
  return sources => {
    const _stream = resolveStreamCallback(resolve$Proxy(stream), sources)

    const instances$ = _stream.fold(function (acc, next) {
      const key = uniqueId()

      const cmp = resolveShorthandOutput(
        typeof next === 'function' ? next : () => next
      )

      acc.dict.clear()

      const sinks = cmp(sources)

      acc.dict.set(key, sinks)

      return { dict: acc.dict, arr: [{ ...sinks, _key: key }] }
    }, { dict: new Map(), arr: [] })

    return collectSinksBasedOnSource(sources)(new Instances(instances$))
  }
}
