import isolate from '@cycle/isolate'
import { castArray } from './fp.js'
import { isElement } from './dynamictypes.js'
import { pragma, Fragment } from './reactpragma.js'
import resolveShorthandOutput from './resolveShorthandOutput.js'
import resolveStateMapper from './resolveStateMapper.js'
import getConditionalCmp from './getConditionalCmp.js'
import resolvePathScope from './resolvePathScope.js'
import wrapVdom from './wrapVdom.js'

function resolveScopeProp (vdom, powercycle) {
  if (!isElement(vdom) || !vdom.props.scope) {
    return false
  }

  wrapVdom(
    vdom,
    (type, props, children) =>
      isolate(
        resolveShorthandOutput(powercycle)(
          () => pragma(type, props, ...castArray(children))
        ),
        resolvePathScope(vdom.props.scope)
      ),
    ['scope'],
    {}
  )

  return true
}

function resolveIfProp (vdom, powercycle) {
  if (!isElement(vdom) || !({}).hasOwnProperty.call(vdom.props, 'if')) {
    return false
  }

  const cond = vdom.props.if

  wrapVdom(
    vdom,
    (type, props, children) => sources => {
      return getConditionalCmp(
        resolveStateMapper(cond, sources),
        cond => sources => powercycle(
          cond
            ? pragma(type, props, ...castArray(children))
            : pragma(Fragment),
          null,
          sources
        )
      )(sources)
    },
    ['if'],
    {}
  )

  return true
}

export default function resolveScopeOrIfProp (vdom, powercycle) {
  if (!isElement(vdom)) {
    return false
  }

  const relevantProps = Object.keys(vdom.props)
    .filter(prop => ['if', 'scope'].includes(prop))

  for (let key of relevantProps) {
    if (key === 'if' && resolveIfProp(vdom, powercycle) === true) {
      return true
    }
    if (key === 'scope' && resolveScopeProp(vdom, powercycle) === true) {
      return true
    }
  }

  return false
}

