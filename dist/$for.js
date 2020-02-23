import { pragma } from './reactpragma.js';
import { Collection } from './util/Collection.js';
export default function $for(base, vdom) {
    return pragma(Collection, { for: base }, vdom);
}
//# sourceMappingURL=$for.js.map