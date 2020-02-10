import { resolveShorthandComponent } from '../powercycle.js'

import getDynamicCmp from '../getDynamicCmp.js'

/**
 * Allows to use a stream of components as one component. This a monad bind
 * basically. The emit value can be a component function or simply a VDOM or
 * pair of [VDOM, sinks].
 *
 * As every emit will completely replaces the previous wrapped component,
 * a completely new render will take place as well, so focus will be lost. Its
 * only meaningful use case might be where this focus loss is not a problem, but
 * we need output streams of clicks for example. A Collection is probably still
 * a better tool for the job, and this is, though looks tempting, is just a
 * smelly thing, as it switches us back to the iterative-world from static land.
 *
 * It's also DAMN SLOW, relative to the O(logx(N)) fastness of powercycle.
 *
 * There are very hacky workarounds to prevent focus loss, like defining react
 * keys on the elements, but then a whole new class of issues will appear: the
 * old component's sinks (and their DOM listeners) will be dismantled, and the
 * new ones will not work on the non-rerendered old DOM elements, so input fields
 * become seemingly read-only. It also creates an app-level dependency on React
 * which we don't want.
 *
 * But just for the record, further very hacky mitigation for the "read-only"
 * problem would be to prevent acc.dict.clear(), so the old streams (and listeners)
 * keep working on the old DOM nodes, but then it leads to a memory and stream
 * leak with the ever-growing sink dict.
 *
 * And in turn, a mitigation of the ever-growing sink dict (this is super hacky
 * now) would be to just prevent acc.dict.set after the first one
 * (if dict.size === 0 {...}), but then we have to make sure that the component
 * does not get rerendered by React.
 *
 * This hell of lifecycle management comes from the very model of the iterative
 * world, so you should probably just never use this function.
 */
export function smellyComponentStream (stream) {
  return getDynamicCmp(stream, resolveShorthandComponent)
}
