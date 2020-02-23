import { clone, get, set } from './fp.js';
export default function getPathLens(path) {
    const pathArr = path.split('.');
    return {
        get: get(pathArr),
        set: (state, childState) => clone(set(state, pathArr, childState))
    };
}
//# sourceMappingURL=getPathLens.js.map