export declare const identity: <T>(val: T) => T;
export declare const isObject: (val: any) => boolean;
export declare const defaultTo: (val: any, getDefaultValue: any) => any;
export declare const mapValues: (fn: any) => (obj: any) => any;
export declare const clone: (obj: any) => any;
export declare const cloneDeepWith: (customizer: any) => (obj: any) => any;
export declare const uniqueId: () => string;
export declare const castArray: (value: any) => any[];
export declare const compact: (array: any) => any;
export declare const omit: (keys: any) => (obj: any) => any;
export declare const pickBy: (fn?: any) => (obj: any) => {};
export declare const pick: (keys: any) => (obj: any) => any;
export declare const zip: (...arrays: any[]) => any;
export declare const merge: (obj: any, src: any, customizer?: (__0_0: any, __0_1: any) => any) => any;
export declare const mergeDeep: (obj: any, src: any, customizer?: (__0_0: any, __0_1: any) => any) => any;
export declare const get: (path: any) => (obj: any) => any;
export declare function clonePath(obj: any, path: any): any;
export declare const set: (obj: any, path: any, val: any) => any;
export declare const without: (values: any) => (arr: any) => any;
export declare const forEach: (obj: any, fn: any) => void;
export declare const not: (predicate: any) => (...args: any[]) => boolean;
export declare const arrayPush: (newItem: any) => (baseArr: any) => any[];