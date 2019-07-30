export const clone = obj =>
  Array.isArray(obj) ? [...obj] :
  typeof obj === 'object' ? { ...obj } :
  obj

let _uniqueId = 0

export const uniqueId = () =>
  `${++_uniqueId}`

export const castArray = value =>
  Array.isArray(value) ? value : [value]

export const compact = array =>
  array.filter(value => value)

export const omit = keys => obj =>
  keys.reduce((cum, key) => (delete cum[key], cum), { ...obj })

export const mapValues = fn => obj =>
  Object.keys(obj).reduce(
    (cum, key) => ({ ...cum, [key]: fn(obj[key], key) }),
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

export const set = (obj, path, val) =>
  Object.assign(obj, {
    [path[0]]: path.length > 1
      ? set(obj[path[0]] || {}, path.slice(1), val)
      : val
  })

export const without = (arr, ...values) =>
  arr.filter(val => !values.includes(val))

export const pick = (obj, keys) =>
  keys.reduce((cum, key) => obj[key] ? ({ ...cum, [key]: obj[key] }) : cum, {})

export const forEach = (obj, fn) =>
  Object.entries(obj).forEach(([key, value]) => fn(value, key))

// It differs from the Lodash version!
export const defaultTo = (val, defaultValFn) =>
    val == null ? defaultValFn() : val

export const cloneDeepWith = (obj, customizer) =>
  defaultTo(
    customizer(obj),
    () => Array.isArray(obj) ? obj.map(prop => cloneDeepWith(prop, customizer)) :
      typeof obj === 'object' ? mapValues(prop => cloneDeepWith(prop, customizer))(obj) :
      obj
  )
