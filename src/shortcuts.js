import {
  clone, omit, get, set, pick, forEach, castArray
} from './fp.js'

import xs from 'xstream'

import {
  VDOM_ELEMENT_FLAG,
  STATE_MAPPER,
  typeSymbols,
  isElement,
  isStream,
  isDomElement
} from './dynamictypes.js'

import {
  PLACEHOLDER,
  RESOLVE,
  BASE_STREAM
} from './placeholder.js'

import {
  pragma,
  Fragment
} from './reactpragma.js'

import {
  powercycle
} from './powercycle.js'

import isolate from '@cycle/isolate'

import {
  getConditionalCmp
} from './util/logical.js'

import {
  $get
} from './util.js'

// Allow shortcut return value, like: return <div>...</div>
// or with sinks: return [<div>...</div>, { state: ... }]
// In the shortcut form, there's no need to pass the sources object, as it's
// the same as what the component gets from the calling part - which is not
// true for isolation'd components of course, but as we take over the
// cmp invocation job, including isolation, we can still intercept the
// sources object. The shorthand return form requires at least one initial
// powercycle() call at the top of the hierarchy, which can be achieved with
// the withPower() utility as well
export const resolveShorthandOutput = cmp => sources => {
  const output = castArray(cmp(powerUpSources(sources)))

  return isElement(output[0])
    // it's a shorthand return value: vdom, eventSinks, optional sources
    ? powercycle(
      output[0],
      output[1],
      output[2] || sources
    )
    // it's a regular cyclejs sinks object
    : output[0]
}

export function getPathLens(path) {
  const pathArr = path.split('.')

  return {
    get: get(pathArr),
    set: (state, childState) => clone(set(state, pathArr, childState))
  }
}

// Support dot-separated deep scopes - not sure how much of a real world usecase
// We choose a careful strategy here, ie. if there's no dot, we stay with the
// string version
export function resolvePathScope(scope) {
  return typeof scope !== 'string'
    ? scope
    : {
      state: getPathLens(scope),
      '*': scope
    }
}

const SEL_ROOT = Symbol('ROOT')

function eventsProxy (target, prop) {
  const selector = typeof prop === 'symbol' && Symbol.keyFor(prop) || prop

  return new Proxy(target.react.select(selector), {
    get: (target, prop) =>
      target[prop] ||
      new Proxy(target.events(prop), {
        get: (target, prop) =>
          target[prop] ||
          target.map(ev => {
            return get(prop.split('.'))(ev)
          })
      })
  })
}

// Power-ups the sources object to make all these shorthands available:
//   sources.react.select('input').events('change').map(ev => ev.target.value)
//   sources.sel.input.events('change').map(ev => ev.target.value)
//   sources.sel.input.change.map(ev => ev.target.value)
//   sources.sel.input.change['target.value']
//   sources[input].change['target.value']
// And for root elements:
//   sources.el.change['target.value']
export function powerUpSources (sources) {
  return new Proxy(sources, {
    get: (target, prop) => {
      return (
        target[prop] ? target[prop] :
        typeSymbols.includes(prop) ? target[prop] :
        prop === 'el' ? eventsProxy(target, SEL_ROOT) :
        prop === 'sel' ? new Proxy({}, {
          get: (dummy, prop) => eventsProxy(target, prop)
        }) :
        typeof prop === 'symbol' ? eventsProxy(target, prop) :
        undefined
      )
    }
  })
}

// Injects sel={SEL_ROOT} automatically on the root element of the VDOM
// It's used internally with powerUpSources
export function injectAutoSel(vdom) {
  return typeof vdom.type !== 'string' || vdom.props.sel
    ? vdom
    : pragma(
        vdom.type,
        { ...omit(['key'])(vdom.props), sel: SEL_ROOT },
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

function wrapVdom(vdom, getInlineCmp, propsToRemove, outerProps) {
  const type = vdom.type
  const children = vdom.props.children
  const props = omit(['children', ...propsToRemove])(vdom.props)

  vdom.type = Fragment
  vdom.props = {
    children: Object.assign(getInlineCmp(type, props, children), {
      props: outerProps,
      key: vdom.key
    })
  }
}

export function resolveScopeProp(vdom) {
  if (!isElement(vdom) || !vdom.props.scope) {
    return
  }

  wrapVdom(
    vdom,
    (type, props, children) =>
      isolate(
        resolveShorthandOutput(
          sources => pragma(type, props, ...castArray(children))
        ),
        resolvePathScope(vdom.props.scope)
      ),
    ['scope'],
    {}
  )

  return true
}

export function resolveIfProp(vdom) {
  if (!isElement(vdom) || !vdom.props.if) {
    return
  }

  const cond = vdom.props.if

  wrapVdom(
    vdom,
    (type, props, children) =>

      sources => {

        return getConditionalCmp(
          resolveStateMapper(resolve$Proxy(cond), sources),
          cond => {
            return sources => {
              return powercycle(
                cond
                  ? pragma(type, props, ...castArray(children))
                  : pragma(Fragment),
                null,
                sources
              )
            }
          }
        )(sources)

      }

      ,
    ['if'],
    {}
  )

  return true
}

export function resolveScopeOrIfProp(vdom) {
  if (!isElement(vdom)) {
    return
  }

  const relevantProps = Object.keys(vdom.props)
    .filter(prop => ['if', 'scope'].includes(prop))

  for (let key of relevantProps) {
    if (key === 'if' && resolveIfProp(vdom) === true) {
      return true
    }
    if (key === 'scope' && resolveScopeProp(vdom) === true) {
      return true
    }
  }
}

// Makes these shortcuts available for the following:
//   {src => [<button>Inc</button>, { state: src.el.click.mapTo(prev => prev + 1) }]}
//
// 1. A special sink definition where we define sink keys and event$-to-sink$
//    mappers:
//     <button onClick={{ state: ev$ => ev$.mapTo(prev => prev + 1) }}>Inc</button>
// 2. A callback which maps from event to state:
//     <button onClick={ev => prev => prev + 1}>Inc</button>
export function resolveEventProps(vdom, { mergeFn }) {
  if (!isDomElement(vdom)) {
    return
  }

  const eventProps = pick(EVENT_PROPS)(vdom.props)

  if (Object.keys(eventProps).length === 0) {
    return
  }

  // We have to generate a unique sel, because we can't scope down the
  // generated inline component. See the comment at the bottom.
  const sel = vdom.props.sel || Symbol('eventprop-autosel')

  const getInlineCmp = (type, props, children) => sources => {
    const sinks = {}

    forEach(eventProps, (handler, propKey) => {
      const _handler = typeof handler === 'function'
        ? { state: stream => stream.map(handler) }
        : handler

      const eventNameDom = propKey.replace(/^on/, '').toLowerCase()

      forEach(_handler, (handler, channel) => {
        const stream = handler(sources.sel[sel][eventNameDom])

        sinks[channel] = !sinks[channel]
          ? stream
          : mergeFn(sinks[channel], stream)
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

export function resolve$Proxy (val) {
  if (val && val[PLACEHOLDER] && val[BASE_STREAM]) {
    return val[RESOLVE]()
  }

  if (val && val[PLACEHOLDER]) {
    return createStateMapper(val[RESOLVE])
  }

  return val
}

export function createStateMapper (fn) {
  return Object.assign(fn, {
    [STATE_MAPPER]: true
  })
}

export function isStateMapper (fn) {
  return typeof fn === 'function' &&
    fn[STATE_MAPPER]
}

export function resolveStateMapper (fn, src) {
  const _fn = resolve$Proxy(fn)
  return isStateMapper(_fn)
    ? src.state.stream.map(_fn)
    : _fn
}
