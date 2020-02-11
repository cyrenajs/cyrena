import { castArray } from './fp.js'
import { pragma, Fragment } from './reactpragma.js'

export default function wrapInComponent(powercycle) {
  return (...values) => sources => {
    return powercycle(
      pragma(Fragment, null, ...castArray(values)),
      null,
      sources
    )
  }
}
