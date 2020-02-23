export default function getPathLens(path: any): {
    get: (obj: any) => any;
    set: (state: any, childState: any) => any;
};
