# Powercycle

Powercycle is an extension for the wonderful framework Cycle.js. It powers it up to the next level so it almost looks like a new framework! It puts the view in the center, to make composition as easy and trivial as it is in React - while keeping all the benefits of a purely functional-reactive environment. Any regular Cycle.js and React component can be included seamlessly in a Powercycle app.

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

## Motivation




## Guide

1. [Installation](#installation)
1. [Getting Started](#getting-started)
1. [Static VDOM composition](#static-vdom-composition)
1. [Streams and components everywhere](#streams-and-components-everywhere)
1. [Lenses](#lenses)
1. [React realms](#react-realms)
1. [Collection](#collection)
1. [Helpers, Shortcuts and Tips](#helpers-shortcuts-and-tips)

### Installation

Install powercycle and its peer dependencies:

`npm install powercycle @cycle/react react xstream`

Install the usual Cycle/react dependencies:

`npm install @cycle/run @cycle/react-dom @cycle/state`

### Getting Started

Besides following the [Installation](#installation) steps, make sure that your setup can handle JSX, because Powercycle was made with JSX in mind. Powercycle has its own JSX pragma, so you have to specify the pragma in your setup. One way of doing it is importing the default export from the powercycle package:

```jsx
import withPower from 'powercycle'
/** @jsx withPower.pragma */
/** @jsxFrag withPower.Fragment */
```

Obviously you can skip using JSX, if you really wish, but you'll still need the pragma.

Now that we're done with the setup, we're ready to start using the extension.

### Static VDOM composition

We've seen the default import above named `withPower`, but let's forget that for now. Powercycle's core utility is the `component` function, which takes 3 arguments, and returns a regular Cycle.js _sinks_ object. (Don't pick on the name `component`; at the end of the day, you won't even need to use this function.)

1. The first argument is a static VDOM, which can contain streams and other components (even inline components!). We'll see them later.
1. The second argument is the sinks object, which contains all of the sink channels for the current component, except the view channel.
1. The third argument is the sources object which Powercycle will pass to all of the components found in the VDOM.

Let's see an example:

```jsx
// Regular Cycle.js component
function ParentCmp(sources) {

  const childCmpSinks = Child(sources)

  return {
    react: xs.combine(state$
      .map(state => <div>{state}</div>)
    state: reducer$
  }
}
```

becomes:

```jsx
function MyComponent(sources) {
  // ...
  return component(
    <div>{state$}</div>
    { state: reducer$ },
    sources
  )
}
```

### Streams and components everywhere

The precise rules for where and how dynamic values can appear in a VDOM:
* streams can be placed among VDOM children and props, even deeply nested
* components be placed as VDOM nodes
* inline components can be placed as VDOM child


### Lenses

Any VDOM component can have a `lens` prop, which will act as a regular Cycle.js lens for the given component.

### React realms

React components can be included in the VDOM by wrapping them in the ReactRealm component. To use the state from the Cycle.js environment, Powercycle contains as `useCycleState` hook. You can put any content inside the opening and closing `<ReactRealm>` tags, but everything there 

### Collection

Powercycle has a `Collection` component which makes handling dynamic lists easy and trivial. By default, you don't need to provide any props to the `Collection` component. It uses the state channel as its input, so make sure that you scope down the state with a [`lens`](#lenses) prop either on the `Collection` component or somewhere above. The `Collection` component will take its VDOM children as a fragment as its item component, so you can put anything between the opening and closing `<Collection>` tags.

### Helpers, Shortcuts and Tips

* *map*
  The `map` utility function is a handy helper to get the state in the VDOM. It has 2 signatures:
  * map(mapperFn, <sources>)
  * map(mapperFn)
* *get*
* *View selection shortcuts*
* *How to opt-out from the Powercycle control
  Just return with a regular sinks object, and the underlaying components will not be controlled by Powercycle.
