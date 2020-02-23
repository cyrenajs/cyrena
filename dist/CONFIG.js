import xs from 'xstream';
export default {
    vdomProp: 'react',
    combineFn: streams => xs.combine(...streams),
    mergeFn: streams => xs.merge(...streams)
};
//# sourceMappingURL=CONFIG.js.map