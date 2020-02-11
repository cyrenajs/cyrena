import { PLACEHOLDER, RESOLVE, BASE_STREAM } from './placeholder.js'
import createStateMapper from './createStateMapper.js'

export default function resolvePlaceholder (val) {
  if (val && val[PLACEHOLDER] && val[BASE_STREAM]) {
    return val[RESOLVE]()
  }

  if (val && val[PLACEHOLDER]) {
    return createStateMapper(val[RESOLVE])
  }

  return val
}

