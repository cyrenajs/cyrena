import resolveShorthandOutput from './resolveShorthandOutput.js';
export default function resolveShorthandComponent(powercycle) {
    return shorthandComponent => {
        const cmp = typeof shorthandComponent === 'function'
            ? shorthandComponent
            : () => shorthandComponent;
        return resolveShorthandOutput(powercycle)(cmp);
    };
}
//# sourceMappingURL=resolveShorthandComponent.js.map