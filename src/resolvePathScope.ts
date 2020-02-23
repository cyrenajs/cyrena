import getPathLens from './getPathLens.js'

// Support dot-separated deep scopes - not sure how much of a real world usecase
// We choose a careful strategy here, ie. if there's no dot, we stay with the
// string version
export default function resolvePathScope(scope: string | Object) {
  return typeof scope !== 'string'
    ? scope
    : {
        state: getPathLens(scope),
        '*': scope
      }
}
