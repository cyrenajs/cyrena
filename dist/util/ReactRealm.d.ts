export declare function ReactRealm(_sources: any): {
    react: import("xstream").Stream<any>;
    state: import("xstream").Stream<unknown>;
};
export declare function useCycleState(sources: any): (number | ((state: any) => void))[];
