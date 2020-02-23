/**
 * The type system in powercycle is a 4-level ladder:
 *
 * - Component :: SourcesObject -> SinksObject
 *   Any function
 * - InlineComponent :: SourcesObject -> SinksObject
 *   Any function
 * - StateMapper :: State -> State
 *   Produced mainly with the $map function - function with a symbol flag
 * - StateReference :: Proxy sugar which resolves to a StateMapper in
 *   powercycle::traverseAction
 * - StreamReference :: Proxy sugar which resolves to a Stream in
 *   powercycle::traverseAction
 */
export declare const VDOM_ELEMENT_FLAG: unique symbol;
export declare const STATE_MAPPER: unique symbol;
export declare const SEL_ROOT: unique symbol;
export declare const typeSymbols: symbol[];
export declare function isPrimitive(val: any): boolean;
export declare function isComponentNode(node: any): boolean;
export declare function isElement(val: any): any;
export declare function isStream(val: any): boolean;
export declare function isDomElement(node: any): boolean;
export declare function isVdomChildPath(path: any): boolean;
export declare function isInlineComponent(val: any, path: any): boolean;
export declare function createElement(vdom: any): any;
