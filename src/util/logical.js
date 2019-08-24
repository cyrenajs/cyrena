import { pragma } from '../reactpragma.js'
import { powercycle } from '../powercycle.js'

import {
  $map, getDynamicCmp, wrapInComponent
} from '../util.js'

import {
  isStateMapper,
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
  const andReducer = (acc, next) => acc && next
  const combined = $combine(...conditions)

  if (isStream(combined)) {
    return combined.map(values => values.reduce(andReducer, true))
  }

  return $map(
    state => combined(state).reduce(andReducer, true)
  )
}

export const $combine = (...mappers) => {
  if (mappers.every(isStream)) {
    return xs.combine(...mappers)
  }

  if (!mappers.some(isStream)) {
    return $map(state => {
      return mappers.map(mapper => {
        return $map(mapper)(state)
      })
    })
  }

  throw new Error(
    'Powercycle/$combine: mixing state mappers and streams is not yet supported.'
  )
}

export const $or = (...conditions) => {
  return $not($and(...conditions.map($not)))
}

export const $eq = (...args) => {
  return $map(
    values => values[0] === values[1],
    $combine(args[0], args.length > 1 ? args[1] : $)
  )
}
