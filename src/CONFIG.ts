import xs, { Stream } from 'xstream'

export default {
  vdomProp: 'react',
  combineFn: <T>(streams: Stream<T>[]) => xs.combine(...streams),
  mergeFn: <T>(streams: Stream<T>[]) => xs.merge(...streams)
}
