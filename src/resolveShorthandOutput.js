import { castArray } from './fp.js'
import { isElement, isPrimitive } from './dynamictypes.js'
import { pragma, Fragment } from './reactpragma.js'
import powerUpSources from './powerUpSources.js'

// Allow shortcut return value, like: return <div>...</div>
// or with sinks: return [<div>...</div>, { state: ... }]
// In the shortcut form, there's no need to pass the sources object, as it's
// the same as what the component gets from the calling part - which is not
// true for isolation'd components of course, but as we take over the
// cmp invocation job, including isolation, we can still intercept the
// sources object. The shorthand return form requires at least one initial
// powercycle() call at the top of the hierarchy, which can be achieved with
// the withPower() utility as well
export default function resolveShorthandOutput(powercycle) {
  return cmp => sources => {
    const output = castArray(cmp(powerUpSources(sources)))

    return isElement(output[0]) || isPrimitive(output[0])
      ? // it's a shorthand return value
        powercycle(
          isPrimitive(output[0])
            ? pragma(Fragment, null, output[0])
            : output[0],
          output[1],
          output[2] || sources
        )
      : // it's a regular cyclejs sinks object
        output[0]
  }
}
