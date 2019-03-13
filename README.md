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
<details>
    <summary>Click to expand</summary>

React and Cycle.js have separate benefits and compromises, and I wanted to bring together the benefits.

### React

React's benefits are that it's view-based, and imperative. Imperative means that the developer works with first-order values and nudges the application further by calling setState imperatively. This is by far the most accessible way for developers to proceed and get things done.

Being view-based means, that when we see a piece of React code, we immediately recognize the structure of the app or component by having a glimpse on the JSX part.

But all this comes at the price of an unconventional programming model, where the render function gets called many times by the runtime. And having the ability to return with completely different output VDOMs based on different inputs, defeats the purpose of the JSX as a structural overview. In idiomatic React code, most of the JSX is conceptually static hierarchy, which contains changing bits and pieces. But in reality, not just the changing parts, but all the conceptually static parts, too, are re-evaluated and matched with the previous output. Sometimes it needs special awarenes. And this reasoning goes for the logic as well, with the well-known [Rules of Hooks](https://reactjs.org/docs/hooks-rules.html). This might not be a big deal, you might think, but what I think is that we can do it better.

### Cycle.js

Cycle.js is a purely functional-reactive framework, and I won't detail how useful this fact is. It's also quite mature in its current state. Components are static, they're called once, and not by a runtime, but simply by the app. The downside of it is that it's _not view-based_. Sure, we do have the view part, and it can even be JSX, but unfortunately this view part is not in the static scope. It's in the same iteratee-realm in which React is. But here it comes with a serious consequence: there's no composition! You have to do even basic composition with cumbersome boilerplate.

This led me to explore the possibilities to make something as simple and composoble as React, but as _right_ as Cycle.js. And this is Powercycle.

</details>

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

1. The first argument is a static VDOM, which can contain streams and other components (even inline components! We'll see them later).
1. The second argument is the sinks object, which contains all of the sinks for the current component, _except the view_. 
1. The third argument is the sources object which Powercycle will pass to all of the components found in the VDOM.

Let's see a simple example:

```jsx
// Regular Cycle.js component
function Cmp(sources) {
  const state$ = sources.state.stream
  
  return {
    react: state$.map(state => <div>{state}</div>),
    state: xs.merge(reducer$ /* , other reducers */)
  }
}

function ParentCmp(sources) {
  const state$ = sources.state.stream
  
  const childSinks = ChildCmp(sources)

  return {
    react: xs.combine(state$, childSinks.react)
      .map(([state, childVdom]) =>
        <div>
          State: {JSON.stringify(state)}<br />
          Child:<br />
          {childVdom}
        </div>
      ),
    state: xs.merge(reducer$, childSinks.state)
  }
}
```

With becomes:

```jsx
function ParentCmp(sources) {
  // ...
  return component(
    <div{state$}</div>,
    null,
    sources
  )
}
```

Now you might ask why it useful at all
Let's see what 
* Combines the streams and the components' view sinks, and substitutes them back to the original structure.
* Merges all the non-view sinks from the components found in the VDOM and the provided sinks object

#### Shorthand return from components

Powercycle will collect all the streams and components from the VDOM, executes the components and collect their sink streams as well, and creates a VDOM stream which updates when any of the streams or the view stream of the components emits. It's important to note that Powercycles stops the VDOM traversal on component nodes - just as you'd expect. The underlying VDOM part for a component node is handled by that enclosing component, which receives the VDOM children in `sources.props.children`. Also you can get the rest of the VDOM props in `sources.props`.

#### withPower

As you can 

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
