export declare function Debug(): any;
export declare const pickLens: (...keys: any[]) => {
    get: (obj: any) => any;
    set: (outer: any, inner: any) => any;
};
export declare const mergeWith: (src: any) => (obj: any) => any;
export declare function request(url$: any, sources: any): {
    request$: any;
    content$: any;
    isLoading$: import("xstream").MemoryStream<unknown>;
    errorMessage$: any;
};
export declare const $map: (fn: any, src?: any) => any;
export declare const $get: (key: any, src: any) => any;
