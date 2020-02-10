import isStateMapper from './isStateMapper.js'
import resolvePlaceholder from './resolvePlaceholder.js'

export default function resolveStateMapper (fn, src) {
  const _fn = resolvePlaceholder(fn)
  return isStateMapper(_fn)
    ? src.state.stream.map(_fn)
    : _fn
}
