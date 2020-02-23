import CONFIG from './CONFIG.js'
import { omit, mapValues } from './fp.js'

// Collect all the channels (keys) from the sources as a base for pickMerge
export default function collectSinksBasedOnSource(sources) {
  return instances => {
    // Make sure that the sources object is de-proxyfied
    // Update: seems like it's not needed
    // return [clone(sources)]
    return (
      [sources]
        // 'props' is a special source prop, and not a channel
        .map(omit(['props']))
        // pickMerge the event channels based on the sources keys
        .map(mapValues((...[, channel]) => instances.pickMerge(channel)))
        // ...and pickCombine the vdom channel
        .map(sinks => ({
          ...sinks,
          [CONFIG.vdomProp]: instances
            .pickCombine(CONFIG.vdomProp)
            .map(itemVdoms =>
              itemVdoms.map((vdom, idx) => ({
                ...vdom,
                key: String(idx)
              }))
            )
        }))[0]
    )
  }
}
