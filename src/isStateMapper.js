import { STATE_MAPPER } from './dynamictypes.js'

export default function isStateMapper (fn) {
  return typeof fn === 'function' &&
    fn[STATE_MAPPER]
}
