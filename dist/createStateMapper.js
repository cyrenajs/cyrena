import { STATE_MAPPER } from './dynamictypes.js';
export default function createStateMapper(fn) {
    return Object.assign(fn, {
        [STATE_MAPPER]: true
    });
}
//# sourceMappingURL=createStateMapper.js.map