import { wrapInComponent } from '../powercycle.js'

// This is just a dummy component to serve as a lens or collection item
// container for a sub-vdom.
export function Scope (sources) {
  return wrapInComponent(sources.props.children)(sources)
}

