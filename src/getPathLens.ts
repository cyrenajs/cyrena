import { clone, get, set } from './fp.js'

export default function getPathLens (path: string) {
  const pathArr = path.split('.')

  return {
    get: get(pathArr),
    set: (state, childState) => clone(set(state, pathArr, childState))
  }
}
