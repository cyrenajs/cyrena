import { omit, pick, pickBy, forEach, compact } from './fp.js'
import { isDomElement, isComponentNode } from './dynamictypes.js'
import { isPlaceholder, RESOLVE } from './placeholder.js'
import { pragma } from './reactpragma.js'
import resolveShorthandComponent from './resolveShorthandComponent.js'
import getPathLens from './getPathLens.js'
import CONFIG from './CONFIG.js'

// Support dot-separated deep scopes - not sure how much of a real world usecase
// We choose a careful strategy here, ie. if there's no dot, we stay with the
// string version
export function resolvePathScope (scope) {
  return typeof scope !== 'string'
    ? scope
    : {
      state: getPathLens(scope),
      '*': scope
    }
}

import wrapVdom from './wrapVdom.js'

// Copied from https://reactjs.org/docs/events.html
const EVENT_PROPS = (
  'Copy|Cut|Paste|CompositionEnd|CompositionStart|CompositionUpdate|KeyDown|' +
  'KeyPress|KeyUp|Focus|Blur|Change|Input|Invalid|Submit|Click|ContextMenu|' +
  'DoubleClick|Drag|DragEnd|DragEnter|DragExit|DragLeave|DragOver|DragStart|' +
  'Drop|MouseDown|MouseEnter|MouseLeave|MouseMove|MouseOut|MouseOver|MouseUp|' +
  'PointerDown|PointerMove|PointerUp|PointerCancel|GotPointerCapture|' +
  'LostPointerCapture|PointerEnter|PointerLeave|PointerOver|PointerOut|' +
  'TouchCancel|TouchEnd|TouchMove|TouchStart|Scroll|Wheel|Abort|CanPlay|' +
  'CanPlayThrough|DurationChange|Emptied|Encrypted|Ended|Error|LoadedData|' +
  'LoadedMetadata|LoadStart|Pause|Play|Playing|Progress|RateChange|Seeked|' +
  'Seeking|Stalled|Suspend|TimeUpdate|VolumeChange|Waiting|Load|Error|' +
  'AnimationStart|AnimationEnd|AnimationIteration|TransitionEnd|Toggle'
).split('|').map(ev => 'on' + ev)

// Makes these shortcuts available for the following:
//   {src => [<button>Inc</button>, { state: src.el.click.mapTo(prev => prev + 1) }]}
//
// 1. A special sink definition where we define sink keys and event$-to-sink$
//    mappers:
//     <button onClick={{ state: ev$ => ev$.mapTo(prev => prev + 1) }}>Inc</button>
// 2. A callback which maps from event to state:
//     <button onClick={ev => prev => prev + 1}>Inc</button>
function resolveDomEventProps (vdom) {
  const eventProps = pick(EVENT_PROPS)(vdom.props)

  if (Object.keys(eventProps).length === 0) {
    return
  }

  // We have to generate a unique sel, because we can't scope down the
  // generated inline component. See the comment at the bottom.
  const sel = vdom.props.sel || Symbol('eventprop-autosel')

  const getInlineCmp = (type, props, children) => sources => {
    const sinks = {}

    forEach(eventProps, (_handlers, propKey) => {
      const handlers = typeof _handlers === 'function'
        ? { state: stream => stream.map(_handlers) }
        : _handlers

      const eventNameDom = propKey.replace(/^on/, '').toLowerCase()

      forEach(handlers, (handler, channel) => {
        const stream = isPlaceholder(handler)
          ? handler[RESOLVE](sources.sel[sel][eventNameDom])
          : handler(sources.sel[sel][eventNameDom])

        sinks[channel] = !sinks[channel]
          ? stream
          : CONFIG.mergeFn(sinks[channel], stream)
      })
    })

    return [
      pragma(type, { ...props, sel }, children),
      sinks
    ]
  }

  wrapVdom(
    vdom,
    getInlineCmp,
    Object.keys(eventProps),
    // We must prevent scoping here! Otherwise in this case the HTTP sink will
    // not get the click stream:
    // {src => [
    //   <button onClick={...}>click me</button>,
    //   { HTTP: src.el.click. ... }
    // ]}
    { noscope: true }
  )

  return true
}

function resolveComponentEventProps (vdom, powercycle) {
  const eventProps =
    pickBy((cfg, prop) => /^on(?:$|-|[A-Z])/.test(prop))(vdom.props)

  const getTriplets = cfg =>
    Object.keys(cfg).reduce(
      (cum, channel) => Object.keys(cfg[channel]).reduce(
        (cum, event) => [...cum, [channel, event, cfg[channel][event]]], []
      ), []
    )

  // channel, filter key, translation (payload-to-action fn)
  const triplets = Object.keys(eventProps).reduce(
    (cum, next) => cum.concat(getTriplets(
      next === 'on'
        ? vdom.props['on'] :
      /^on-/.test(next)
        ? { [next.replace(/^on-/, '')]: vdom.props[next] } :
      { state: { [next.replace(/^on/, '').toLowerCase()]: vdom.props[next] }}
    )),
    []
  )

  if (triplets.length > 0) {
    const cmp = vdom.type

    vdom.props = omit(Object.keys(eventProps))(vdom.props)
    vdom.type = sources => {
      const sinks = resolveShorthandComponent(powercycle)(cmp)(sources)

      sinks.state = CONFIG.mergeFn(compact(
        triplets.map(([channel, event, payloadToAction]) =>
          sinks[channel] && sinks[channel]
            .filter(([cmpEvent]) => cmpEvent === event)
            .map(([, payload]) => payloadToAction(payload))
        )
      ))

      return sinks
    }
  }
}

export default function resolveEventProps (vdom, powercycle) {
  if (isDomElement(vdom)) {
    return resolveDomEventProps(vdom)
  } else if (isComponentNode(vdom)) {
    return resolveComponentEventProps(vdom, powercycle)
  }
}
