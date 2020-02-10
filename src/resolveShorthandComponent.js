import resolveShorthandOutput from './resolveShorthandOutput.js'

export default function resolveShorthandComponent (shorthandComponent, powercycle) {
  const cmp =
    typeof shorthandComponent === 'function'
      ? shorthandComponent
      : () => shorthandComponent

  return resolveShorthandOutput(cmp, powercycle)
}
