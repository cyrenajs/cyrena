export const isObject = val =>
  val && typeof val === 'object'

// It differs from the Lodash version!
export const defaultTo = (val, getDefaultValue) =>
  val == null ? getDefaultValue() : val

export const mapValues = fn => obj =>
  !isObject(obj) ? obj : (
    Array.isArray(obj)
      ? obj.map(fn)
      : Object.keys(obj).reduce(
          (cum, key) => ({ ...cum, [key]: fn(obj[key], key) }),
          {}
        )
  )

export const clone = mapValues(x => x)

export const cloneDeepWith = customizer => obj =>
  defaultTo(
    customizer(obj),
    () => mapValues(prop => cloneDeepWith(customizer)(prop))(obj)
  )

let _uniqueId = 0

export const uniqueId = () =>
  `${++_uniqueId}`

export const castArray = value =>
  Array.isArray(value) ? value : [value]

export const compact = array =>
  array.filter(value => value)

export const omit = keys => obj =>
  castArray(keys).reduce(
    (cum, key) => (delete cum[key], cum),
    { ...obj }
  )

export const pick = keys => obj =>
  castArray(keys).reduce(
    (cum, key) => Reflect.has(obj, key) ? ({ ...cum, [key]: obj[key] }) : cum,
    {}
  )

export const zip = (...arrays) =>
  arrays[0].map((val, idx) => arrays.map(arr => arr[idx]))

export const merge = (obj, src, customizer = (oldVal, newVal) => newVal) =>
  Object.keys(src).reduce((cum, key) =>
    ({ ...cum, [key]: customizer(cum[key], src[key]) }),
    clone(obj)
  )

export const mergeDeep = (obj, src, customizer = (oldVal, newVal) => newVal) => {
  return merge(obj, src, (oldVal, newVal) => {
    const _newVal = customizer(oldVal, newVal)
    return isObject(oldVal) && !Array.isArray(oldVal) &&
       isObject(_newVal) && !Array.isArray(_newVal)
      ? mergeDeep(oldVal, _newVal, customizer)
      : _newVal
  })
}

export const get = path => obj =>
  castArray(path).reduce(
    (cum, key) => (cum || {})[key],
    obj
  )

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

export const without = values => arr =>
  arr.filter(val => !values.includes(val))

export const forEach = (obj, fn) =>
  Object.entries(obj).forEach(
    ([key, value]) => fn(value, key)
  )

export const not = predicate => (...args) =>
  !predicate(...args)

export const arrayPush = newItem => baseArr => {
  return [...baseArr, newItem]
}

export const identity = x => x
