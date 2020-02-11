import { typeSymbols, SEL_ROOT } from './dynamictypes.js'
import { get } from './fp.js'

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
export default function powerUpSources (sources) {
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

