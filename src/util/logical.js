import { pragma } from '../reactpragma.js'
import { powercycle } from '../powercycle.js'

import {
  $map, getDynamicCmp, wrapInComponent
} from '../util.js'

import {
  resolveStateMapper
} from '../shortcuts.js'

import {
  $
} from '../placeholder.js'

import {
  isStream
} from '../dynamictypes.js'

import xs, { MemoryStream } from 'xstream'

export function getConditionalCmp (cond, getCmp) {
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

export function If (sources) {
  const cond$ = resolveStateMapper(sources.props.cond, sources)

  const thenVdom = sources.props.then || sources.props.children
  const elseVdom = sources.props.else

  return pragma(getConditionalCmp(cond$, cond => {
    return wrapInComponent(cond ? thenVdom : elseVdom)
  }))
}

export const $if = ($cond, $then, $else) => {
  return $map(cond => cond ? $then : $else, $cond)
}

export const $not = src => {
  return $map(val => !val, src)
}

export const $and = (...conditions) => {
  return $map(
    state => {
      return $combine(...conditions)(state).reduce((acc, next) => acc && next, true)
    }
  )
}

export const $combine = (...mappers) => {
  return $map(state => {
    return mappers.map(mapper => {
      return $map(mapper)(state)
    })
  })
}

export const $or = (...conditions) => {
  return $not($and(...conditions.map($not)))
}

export const $eq = (val1, val2) => {
  return $map(
    values => {
      return values[0] === values[1]
    },
    $combine(val1, val2 !== undefined ? val2 : $)
  )
}
