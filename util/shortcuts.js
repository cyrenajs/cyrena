import clone from 'lodash/clone'
import _get from 'lodash/get'
import omit from 'lodash/omit'

import {
  pragma,
  Fragment
} from '../react/pragma'

const SEL_ROOT = Symbol('ROOT')

// Power-ups the sources object to make all these shorthands available:
// sources.react.select('input').events('change').map(ev => ev.target.value)
// sources.sel.input.events('change').map(ev => ev.target.value)
// sources.sel.input.change.map(ev => ev.target.value)
// sources.sel.input.change['target.value']
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

export function injectAutoSel(vdom) {
  return typeof vdom.type !== 'string' || vdom.props.sel
    ? vdom
    : pragma(
        vdom.type,
        { ...omit(vdom.props, 'key'), sel: SEL_ROOT },
        vdom.props.children
      )
}
