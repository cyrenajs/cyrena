/**
 * A special merger for withLocalState, which remembers the keys in the global
 * state and extracts those keys to the global channel, leaving the rest for
 * the local. This is basically saying that 'every value goes where the key
 * was first defined'. It encourages a good practice that define initial state
 * keys in an initial xs.of(() => ...) reducer.
 */
export declare function createDefaultStateMerger(): {
    merge: (global: any, local: any) => any;
    extract: (state: any) => {
        global: any;
        local: any;
    };
};
/**
 * Based on jvanbruegge's withLocalState
 * at https://github.com/cyclejs/cyclejs/issues/882
 * https://gist.github.com/jvanbruegge/9af17f4f5fca8bb3e6198ebe65afac55
 *
 * The inner component only sees the main state channel. The merger object works
 * like a lens, where 'merge' is the 'get', and 'extract' is the 'set'. The
 * extract method receives the merged state and expects an object with a 'global'
 * and 'local' key. The merge method receives the global and local states, and
 * expects a merged state.
 *
 * const customMerger = {
 *   merge: (g, l) => ({ ...l, { authToken: g.authToken }),
 *   extract: t => ({ global: { authToken: t.authToken }, local: omit(['authToken'], t) })
 * }
 * export const Login = withLocalState(LoginComponent, customMerger);
 *
 * Our version has some improvements over Jan's implementation. Both channels
 * are initiated with an empty startWith, which guarantees that an initial
 * reducer initalState$ = xs.of(prev => ({ ...prev, ...localKeys })) will work
 * properly (with the original solution, a delay was needed as a workaround).
 * Then, we drop these two initial emits in the component state. The component
 * MUST create an xs.of-style initial reducer. On the output side, the reducer
 * will receive the correct global state from the sampleCombine. I'm tired to
 * explain it now, but the pieces are correctly put together now.
 *
 * Currently there's no parameter for custom mergers, because we believe that
 * this solution is good for every case.
 */
export declare function _withLocalState(cmp: any): import("@cycle/state").MainFn<import("@cycle/state/lib/cjs/withState").Forbid<any, "_localState">, import("@cycle/state/lib/cjs/withState").Omit<any, "_localState">>;
export declare function withLocalState(cmp: any): import("@cycle/state").MainFn<import("@cycle/state/lib/cjs/withState").Forbid<any, "_localState">, import("@cycle/state/lib/cjs/withState").Omit<any, "_localState">>;
