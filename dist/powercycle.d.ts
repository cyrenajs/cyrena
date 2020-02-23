/// <reference types="react" />
export { makeDOMDriver } from '@cycle/react-dom';
import { pragma } from './reactpragma.js';
export { pragma, Fragment } from './reactpragma.js';
export declare function resolveShorthandOutput(cmd: any): (sources: any) => any;
export declare function resolveShorthandComponent(cmd: any): (sources: any) => any;
export declare function wrapInComponent(...values: any[]): (sources: any) => any;
export declare const powercycle: (vdom: any, eventSinks: any, sources: any) => any;
export declare const component: (vdom: any, eventSinks: any, sources: any) => any;
declare const _default: ((Cmp: any) => (sources: any) => any) & {
    pragma: typeof pragma;
    Fragment: React.ExoticComponent<{
        children?: React.ReactNode;
    }>;
    createElement: typeof pragma;
};
export default _default;
