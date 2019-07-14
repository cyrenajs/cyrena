import clone from 'lodash/clone'
import _get from 'lodash/get'
import set from 'lodash/set'
import omit from 'lodash/omit'
import mapValues from 'lodash/mapValues'
import pick from 'lodash/pick'
import forEach from 'lodash/forEach'

import {
  pragma,
  Fragment,
} from '../react/pragma'

// Support dot-separated deep scopes - not sure how much of a real world usecase
// We choose a careful strategy here, ie. if there's no dot, we stay with the
// string version
export function resolveDotSeparatedScope(scope) {
  return typeof scope !== 'string'
    ? scope
    : scope.split('.').length < 2 ? scope : {
      state: {
        get: state => _get(state, scope),
        set: (state, childState) => clone(set(state, scope, childState))
      },
      '*': scope
    }
}

const SEL_ROOT = Symbol('ROOT')

const eventsProxy = (target, prop) => {
  const selector = typeof prop === 'symbol' && Symbol.keyFor(prop) || prop

  return new Proxy(target.react.select(selector), {
    get: (target, prop) =>
      target[prop] ||
      new Proxy(target.events(prop), {
        get: (target, prop) =>
          target[prop] ||
          target.map(ev => _get(ev, prop))
      })
  })
}

// Power-ups the sources object to make all these shorthands available:
//   sources.react.select('input').events('change').map(ev => ev.target.value)
//   sources.sel.input.events('change').map(ev => ev.target.value)
//   sources.sel.input.change.map(ev => ev.target.value)
//   sources.sel.input.change['target.value']
// And for root elements:
//   sources.el.change['target.value']
export function powerUpSources (sources) {
  return new Proxy(sources, {
    get: (target, prop) => {
      return target[prop] ||
        prop === 'el' && eventsProxy(target, SEL_ROOT) ||
        prop === 'sel' && new Proxy({}, {
          get: (dummy, prop) => eventsProxy(target, prop)
        }) ||
        typeof prop === 'symbol' && eventsProxy(target, prop) ||
        undefined
    }
  })
}

export const depowerSources = clone

// Injects sel={SEL_ROOT} automatically on the root element of the VDOM
// It's used internally with powerUpSources
export function injectAutoSel(vdom) {
  return typeof vdom.type !== 'string' || vdom.props.sel
    ? vdom
    : pragma(
        vdom.type,
        { ...omit(vdom.props, 'key'), sel: SEL_ROOT },
        vdom.props.children
      )
}

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

// Makes these shortcuts available:
//   {src => [<button>Inc</button>, { state: src.el.click.mapTo(1) }]}
//   <button onClick={{ state: ev => ev.mapTo(1) }}>Inc</button>
//   <button onClick={ev => ev.mapTo(1)}>Inc</button>
export function transformVdomWithEventProps(vdom, mergeFn) {
  if (!vdom || typeof vdom.type !== 'string') {
    return
  }

  const eventProps = pick(vdom.props, EVENT_PROPS)

  if (Object.keys(eventProps).length === 0) {
    return
  }

  const type = vdom.type
  const children = vdom.props.children
  const props = omit(
    vdom.props,
    ['key', 'children', ...Object.keys(eventProps)]
  )

  const getSinks = sources => {
    const sinks = {}

    forEach(eventProps, (handler, propKey) => {
      const _handler = typeof handler === 'function'
        ? { state: handler }
        : handler

      const eventNameDom = propKey.replace(/^on/, '').toLowerCase()

      forEach(_handler, (makeStreamFn, channel) => {
        const stream = makeStreamFn(sources.el[eventNameDom])

        sinks[channel] = !sinks[channel]
          ? stream
          : mergeFn(sinks[channel], stream)
      })
    })

    return [
      pragma(type, props, children),
      sinks
    ]
  }

  vdom.type = Fragment
  vdom.props = {
    children: sources => getSinks(sources)
  }
}
