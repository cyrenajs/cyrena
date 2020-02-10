import resolveShorthandOutput from './resolveShorthandOutput.js'

export default function resolveShorthandComponent (shorthandComponent) {
  return resolveShorthandOutput(
    typeof shorthandComponent === 'function'
      ? shorthandComponent
      : () => shorthandComponent
  )
}
