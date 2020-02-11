import xs, { MemoryStream } from 'xstream'
import getDynamicCmp from './getDynamicCmp.js'
import { isStream } from './dynamictypes.js'

export default function getConditionalCmp (cond, getCmp) {
  const cond$ = isStream(cond)
    ? cond
    // xs.of() is insufficient, because it must be a memory stream
    : xs.create().startWith(cond)

  if (!(cond$ instanceof MemoryStream)) {
    console.warn('Conditional stream should be a MemoryStream')
  }

  return getDynamicCmp (
    cond$.fold(
      (acc, next) => ({ cond: next, key: String(Boolean(next)) }),
      { cond: false, key: 'false' }
    ),
    next => getCmp(next.cond)
  )

}
