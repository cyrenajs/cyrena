# Powercycle
Powercycle is an extension for the wonderful framework Cycle.js which puts the view in the center, to make composition as it meant to be.

```jsx
function Timer(sources) {
  return (
    <h2>Timer: {xs.periodic(1000)}</h2>
  )
}
```

See the examples below:
* [Hello World](https://codesandbox.io/s/94n4j2vxmw)
* [Timer](https://codesandbox.io/s/1znx4w2xwq)
* [Counter](https://codesandbox.io/s/5w53z5401p)
* [Todo List - simple](https://codesandbox.io/s/n7m44yjo0j)
* [Todo List - advanced](https://codesandbox.io/s/2wv3r9ojqp)
* [A full showcase](https://codesandbox.io/s/nkl4y01600)

## Introduction

Powercycle is an extension for the wonderful framework Cycle.js which puts the view in the center, to make composition as it meant to be. It also brings seamless React integration with Cycle state, and many more fun features. It removes the usual boilerplates Cycle.js has, and the mental obstacles which new-learners face. Any regular Cycle.js component can be included in a Powercycle app. Powercycle currently only supports the React VDOM driver.

## Installation

Install powercycle and its peer dependencies:

`npm install powercycle @cycle/react react xstream`

Install the usual Cycle/react dependencies:

`npm install @cycle/run @cycle/react-dom @cycle/state`

## Guide

1. [Getting Started](#getting-started)
1. [Static VDOM composition](#static-vdom-composition)
1. [Streams and components everywhere](#streams-and-components-everywhere)
1. [Lenses](#lenses)
1. [React realms](#react-realms)
1. [Collection](#collection)
1. [Shortcuts and Helpers](#shortcuts-and-helpers)

### Getting Started

Make sure you followed the [Installation](#installation) steps to get the necessary packages at hand, and that your setup can handle JSX, because Powercycle was made with JSX in mind. Powercycle has its own JSX pragma, so you have to import the pragma and the fragment symbol.

### Static VDOM composition

Powercycle's core utility is the `component` function, which takes 3 arguments, and returns a regular Cycle.js sinks object. (Don't pick on the name, at the end of the day, you won't even need to use this function. But let's go step by step.) The first argument is a static VDOM, which can contain streams in any position, Cycle.js components as elements, and even inline components! The second argument is the sinks object, which contains all the sink channels apart from the view. The third argument is the sources object which Powercycle will pass to all of the components found in the VDOM.

```jsx
function MyComponent(sources) {
  // ...
  return {
    react: state$.map(state => <div>{state}</div>)
    state: reducer$
  }
}
```

becomes:

```jsx
function MyComponent(sources) {
  // ...
  return component(
    <div>{$state}</div>
    { state: reducer$ },
    sources
  )
}
```


Soon to be filled

### Streams and components everywhere

Soon to be filled

### Lenses

Soon to be filled

### React realms

Soon to be filled

### Collection

Soon to be filled

### Shortcuts and Helpers

Soon to be filled
