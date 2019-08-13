// It differs from the Lodash version!
export const defaultTo = (val, defaultValFn) =>
  val == null ? defaultValFn() : val

export const mapValues = fn => obj =>
  !obj || typeof obj !== 'object' ? obj : (
    Array.isArray(obj)
      ? obj.map(fn)
      : Object.keys(obj).reduce(
          (cum, key) => ({ ...cum, [key]: fn(obj[key], key) }),
          {}
        )
  )

export const clone = obj =>
  mapValues(x => x)(obj)

export const cloneDeepWith = (obj, customizer) =>
  defaultTo(
    customizer(obj),
    () => mapValues(prop => cloneDeepWith(prop, customizer))(obj)
  )

let _uniqueId = 0

export const uniqueId = () =>
  `${++_uniqueId}`

export const castArray = value =>
  Array.isArray(value) ? value : [value]

export const compact = array =>
  array.filter(value => value)

export const omit = keys => obj =>
  castArray(keys).reduce((cum, key) => (delete cum[key], cum), { ...obj })

export const pick = keys => obj =>
  castArray(keys).reduce(
    (cum, key) => Reflect.has(obj, key) ? ({ ...cum, [key]: obj[key] }) : cum,
    {}
  )

export const zip = (...arrays) =>
  arrays[0].map((val, idx) => arrays.map(arr => arr[idx]))

export const mergeWith = (obj, src, customizer) =>
  Object.keys(src).reduce((cum, key) =>
    ({ ...cum, [key]: customizer(cum[key], src[key]) }),
    obj
  )

export const get = (obj, path) =>
  path.reduce((cum, key) => (cum || {})[key], obj)

// This is not lodash
export function clonePath (obj, path) {
  let root = clone(obj)
  let node = root

  for (let i = 0; i < path.length; i++) {
    node[path[i]] = clone(node[path[i]])
    node = node[path[i]]
  }

  return root
}

export const set = (obj, path, val) =>
  Object.assign(obj, {
    [path[0]]: path.length > 1
      ? set(obj[path[0]] || {}, path.slice(1), val)
      : val
  })

export const without = (arr, ...values) =>
  arr.filter(val => !values.includes(val))

export const forEach = (obj, fn) =>
  Object.entries(obj).forEach(([key, value]) => fn(value, key))
