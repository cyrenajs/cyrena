export const identity = <T>(val: T): T => val

export const isObject = (val: unknown) =>
  val && typeof val === 'object'

// It differs from the Lodash version
export const defaultTo = (val: unknown, getDefaultValue: () => unknown) =>
  val == null ? getDefaultValue() : val

interface Mapper {
  (val: unknown, key: string | number): any
}

export const mapValues = (fn: Mapper) => (obj: unknown) =>
  !isObject(obj)
    ? obj :
  Array.isArray(obj)
    ? obj.map(fn)
    : Object.keys(obj as object).reduce(
        (cum, key) => ({ ...cum, [key]: fn(obj[key], key) }),
        {}
      )

export const clone = mapValues(identity)

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
    clone(obj)
  )

export const pickBy = (fn: any = identity) => obj =>
  Object.keys(Object(obj)).reduce(
    (cum, key) => fn(obj[key], key)
      ? Object.assign(cum, { [key]: obj[key] })
      : cum,
    {}
  )

export const pick = keys => obj =>
  castArray(keys).reduce(
    (cum, key) => Reflect.has(obj, key)
      ? Object.assign(cum, { [key]: obj[key] })
      : cum,
    {}
  )

export const zip = (...arrays) =>
  arrays[0].map((...[, idx]) => arrays.map(arr => arr[idx]))

export const merge = (obj, src, customizer = (...[, newVal]) => newVal) =>
  Object.keys(src).reduce((cum, key) =>
    Object.assign(cum, { [key]: customizer(cum[key], src[key]) }),
    clone(obj)
  )

// This is quite sophisticated, I mean the condition in the customizer. It's
// tuned for collection item reducers. You can slice a collection (oldVal and
// newVal are both arrays), and you can modify individual items by merging an
// object onto the array with the corresponding index keys.
export const mergeDeep = (obj, src, customizer = (...[, newVal]) => newVal) => {
  return merge(obj, src, (oldVal, _newVal) => {
    const newVal = customizer(oldVal, _newVal)

    return Array.isArray(oldVal) && Array.isArray(newVal) ||
      !isObject(oldVal) || !isObject(newVal)
        ? newVal
        : mergeDeep(oldVal, newVal, customizer)
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

export const arrayPush = newItem => baseArr =>
  [...baseArr, newItem]


// export const cloneWithPreserveGettersSetters = obj =>
//   Object.defineProperties({}, Object.getOwnPropertyDescriptors(obj))

// export const template = (str, config) => data =>
//   str.replace(/\$\{(.*?)\}/g, (...args) =>
//     get(args[1].split('.'))(data) ?? config?.notFound?.(args[1])
//   )

// export const matches = obj => item =>
//   Object.keys(obj).reduce((cum, next) => cum && obj[next] === item[next], true)
