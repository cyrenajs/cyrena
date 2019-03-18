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
* [Scope](https://codesandbox.io/s/jll2kjolk3)
* [Todo List - simple](https://codesandbox.io/s/n7m44yjo0j)
* [Todo List - advanced](https://codesandbox.io/s/2wv3r9ojqp)
* [React component with Cycle state](https://codesandbox.io/s/74lnv0wy3j)
* [A full showcase](https://codesandbox.io/s/nkl4y01600)

## Motivation
<details>
    <summary>Click to expand</summary>

React and Cycle.js have separate advantages and compromises, and I wanted to bring the good parts together.

<h3>React</h3>

<p>React's benefits are that it's view-based, and imperative. Imperative means that the developer works with first-order values and nudges the application further by calling setState imperatively. This is by far the most accessible way for developers to proceed and get things done.</p>

<p>Being view-based means, that when we see a piece of React code, we immediately recognize the structure of the app or component by having a glimpse on the JSX part.</p>

<p>But all this comes at the price of an unconventional programming model, where the render function gets called many times by the runtime. And having the ability to return with completely different output VDOMs based on different inputs, defeats the purpose of the JSX as a structural overview. In idiomatic React code, most of the JSX is conceptually a static hierarchy, which contains changing bits and pieces. But in reality, not just the changing parts, but all the conceptually static parts, too, are re-evaluated and matched with the previous output. Sometimes it needs special awarenes. And this reasoning goes for the logic as well, with the well-known <a href="https://reactjs.org/docs/hooks-rules.html">Rules of Hooks</a>. This might not be a big deal, you might think, but what I think is that we can do it better.</p>

<h3>Cycle.js</h3>

<p>Cycle.js is a purely functional-reactive framework, and I won't detail how useful this fact is. It's also quite mature in its current state. Components are static, they're called once, and not by a runtime, but simply by the app author. The downside of it is that it's <em>not view-based</em>. Sure, we do have the view part, and it can even be JSX, but unfortunately this view part is not in the static scope. It's in the same iteratee-realm in which React is. But here it comes with a serious consequence: there's no easy composition! You can't put throw in components in the VDOM tree. You have to do cumbersome boilerplate even for basic composition.</p>

<p>This led me to explore the possibilities to make something as simple and composoble as React, but as <em>right</em> in its programming model as Cycle.js. This pursue resulted in Powercycle.</p>

</details>

## Guide

1. [Installation](#installation)
1. [Getting Started](#getting-started)
1. [Static VDOM composition](#static-vdom-composition)
1. [Streams and components everywhere](#streams-and-components-everywhere)
1. [Scopes](#scopes)
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

We've seen the default import above named `withPower`, but let's forget that for now. Powercycle's core utility is the `powercycle` function, which takes 3 arguments, and returns a regular Cycle.js _sinks_ object. (Don't pick on the name `powercycle`; at the end of the day, you won't even need to use this function.)

1. The first argument is a static VDOM, which can contain streams and other components (even inline components! We'll see them later).
1. The second argument is the sinks object, which contains all of the sinks for the current component, _except the view_. 
1. The third argument is the sources object which Powercycle will pass to the components during the VDOM traversal.

Let's see a basic example of an atomic component:

```jsx
// Regular Cycle.js component
function Cmp(sources) {
  const state$ = sources.state.stream
  
  return {
    react: state$.map(state => <div>{state}</div>)
  }
}
```

It turns into:

```jsx
function Cmp(sources) {
  const state$ = sources.state.stream

  return powercycle(
    <div>{state$}</div>,
    null,
    sources
  )
}
```

At the moment it doesn't seem to be much useful, but what happens when you want to include a child component, for example a Panel, in which you want to wrap the content. It leads to serious boilerplate:

```jsx
function Cmp(sources) {
  const state$ = sources.state.stream
  
  const panelSinks = Panel({ ...sources, props: { title: 'State' }})
  
  return {
    react: panelSinks.react.map(panelVdom =>
      <div>
        State in a panel:
        {panelVdom}
      </div>
    )
  }
}
```

With Powercycle, it remains an atomic step:

```jsx
function Cmp(sources) {
  const state$ = sources.state.stream

  return powercycle(
    <div>
      State in a panel:
      <Panel title="State">
        {state$}
      </Panel>
    </div>
    null,
    sources
  )
}
```

You can see the limitation in the first version: you can't put content and pass props to the Panel component in the VDOM. Wrapping a section of a content into a container is not a trivial action – you have to declare and manually invoke every related component separately from the VDOM. In the Powercycle example you might now have an idea how easy it can go with composition. The `powercycle` function will invoke the Panel component with passing the sources object to it (given as the 3rd parameter). Whenever the Panel component's view stream updates, the outer component will update as well. We'll see more powerful examples in the next sections, but let's not rush ahead.

How do we define our other sinks then, which are not the view? This is what the second argument is for:

```jsx
function Cmp(sources) {
  const state$ = sources.state.stream

  return powercycle(
    <div>
      State in a panel:
      <Panel title="State">
        {state$}
      </Panel>
    </div>
    {
      state: ...,
      http: ...
    },
    sources
  )
}
```

Let's wrap up what the `powercycle` function does exactly:

1. It traverses the VDOM and searches for streams and components (see section [Streams and components everywhere](#streams-and-components-everywhere) for details).
1. It creates a view stream for the outer component which combines all the view streams in the given VDOM, and updates with the original VDOM structure.
1. It collects all the non-view sink channels which were found in the inner components' sinks objects, and merges them all by channel. It also adds the sinks of the second argument to the merges. The result sinks object will be the return value of the `powercycle` function.

#### Shorthand return from components

From the last example of the previous section we learned that the VDOM traversal stops at the Panel component. The Panel component can do anything with the state$ stream which it received through `sources.props.children`. It can even dismiss it. This is the same behavior as you can find in React. In order to see the state in the app, the Panel component must include its `sources.props.children` in its VDOM:

```jsx
function Panel(sources) {
  return powercycle(
    <div className="some panel styling">
      <h2 className="title">{sources.props.title}</h2>
      {sources.props.children}
    </div>,
    null,
    sources
  )
}
```

One important fact to realize here is that the Panel component is not invoked by the app developer, but by Powercycle. So Powercycle sees its output, and it can automatically call the powercycle function on it, so we have less to type:

```jsx
function Panel(sources) {
  return [
    <div className="some panel styling">
      <h2 className="title">{sources.props.title}</h2>
      {sources.props.children}
    </div>,
    null,
    sources
  ]
}
```

This convenience shortcut changes the regular signature of a Cycle.js component's output, but we'll see how it hugely pays off. We can even omit the sources object too, because Powercycle already has it from the first `powercycle` call. If there's no non-view sink channel for the component, we can omit the second parameter too and the array wrapping, so this results in as simple as this:

```jsx
function Panel(sources) {
  return (
    <div className="some panel styling">
      <h2 className="title">{sources.props.title}</h2>
      {sources.props.children}
    </div>
  )
}
```

#### withPower

Every component which returns with the shortcut return format, conveys the same amount of information as a regular Cycle.js component, it's just 'controlled' by Powercycle. The only thing we have to watch out for, is to have a root `powercycle` call to have the VDOM 'controlled'. It turns out, we can wrap our main component in a higher order function to do this:

```jsx
import withPower from 'powercycle'
/** @jsx withPower.pragma */
/** @jsxFrag withPower.Fragment */

// ...

run(withPower(main), drivers)
```

With the `withPower` function, you don't ever need to use the powercycle function! You can just return with the VDOM, or with an array containing the VDOM and the event sinks object.

### Streams and components everywhere

Powercycle collects streams and components from the VDOM according to the following rules:

1. When it finds a stream as a _VDOM child_, it collects the stream:
```jsx
function main (sources) {
  // ...
  return (
    <div>{state$}</div>
  )
}
```

2. When it finds a stream in a prop of a _plain DOM (e.g. a 'div') element_, it collects the stream:
```jsx
function main (sources) {
  // ...
  return (
    <div style={ { background: color$ } }>...</div>
  )
}
```

3. When it finds a _component (e.g. Panel) element_, it invokes it with the sources objects, and collects its sinks. It doesn't continue the traversal under the component element. It passes the props object as `sources.props`. The inner component can access the children as `sources.props.children`:
```jsx
function Panel (sources) {
  return (
    <>
      <h1>{sources.props.title}</h1>
      {sources.props.children}
    </>
}

function main (sources) {
  return (
    <div>
      <Panel title="My Panel">...</Panel>
    </div>
  )
}
```

4. When it finds a _function as a VDOM child_, it's interpreted as an _inline component_. Powercycle will invoke the component with the sources object and collects its sinks, just like as it were a component element:
```jsx
function main (sources) {
  return (
    <div>
      {sources => {
        return [
          <div>...</div>,
          { state: ... }
        ]
      }}
    </div>
  )
}
```

### Scopes

Any VDOM component can have a `scope` prop, which will act as a regular [Cycle.js isolation scope](https://cycle.js.org/api/state.html#cycle-state-source-usage-how-to-share-data-among-components-or-compute-derived-data) for the given component. As components act as boundaries in the Powercycle traversal, a scope will not just affect the component, but the complete sub-VDOM under it as well.

```jsx
function ShowState(sources) {
  return (
    <pre>{sources.state.stream.map(JSON.stringify)}</pre>
  )
}

function main(sources) {
  const reducer$ = xs.of(() => ({
    foo: { bar: { baz: 5 } }
  }))

  return [
    <ShowState scope='foo' />,
    { state: reducer$ }
  ]
  // will show {"bar":{"baz":5}}"
}
```

Unlike the regular Cycle.js scope parameter, the `scope` prop can be a nested lens:

```jsx
  return [
    <ShowState scope='foo.bar' />,
    { state: reducer$ }
  ]
  // will show {"baz":5}"
```

And of course it can be a full scope object:

```jsx
  return [
    <ShowState scope={ { state: {
      get: state => JSON.stringify(state.foo.bar),
      set: (state, childState) => ({ ...state, foo: JSON.parse(childState)})
    } }} />
    { state: reducer$ }
  ]
  // will show "{\"baz\":5}"
```

#### Automatic view scoping

By default, every component in Powercycle is scoped on the view channel. If you need to lift this rule occasionally, you can provide a `noscope` prop the component. The reason for this rule to make string VDOM selectors safe by default. String VDOM selectors are useful, because they eliminate the necessity of boilerplate Symbol declarations. Take a look at this inline component, which is inside a `Collection` item:

```jsx
  {src => [
    <button sel='remove'>Remove</button>,
    { state: src.sel.remove.click.mapTo(COLLECTION_DELETE) }
  ]}
```

[See the Todo example](https://codesandbox.io/s/2wv3r9ojqp)

### React realms

React components can be included in the VDOM by wrapping them in the ReactRealm component. To use the state from the Cycle.js environment, Powercycle offers the `useCycleState` hook. You can put any content inside the opening and closing `<ReactRealm>` tags, they won't be traversed by Powercycle. That part of the VDOM will go directly into the React engine:

```jsx
import { ReactRealm, useCycleState } from 'powercycle/util/ReactRealm'

function ReactCounter(props) {
  const [count, setCount] = useCycleState(props.sources)

  return (
    <div>
      <div>Counter: {count}</div>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  )
}

function main(sources) {
  const state$ = sources.state.stream

  const reducer$ = xs.of(() => ({
    counter: 5
  }))

  return [
    <div>
      <ReactRealm scope='counter'>
        We're under a React realm!
        <ReactCounter />
      </ReactRealm>
      <pre>{state$.map(JSON.stringify)}</pre>
    </div>,
    { state: reducer$ }
  ]
}
```

### Collection

Powercycle has a `Collection` component which makes handling dynamic lists easy and trivial. By default, you don't need to provide any props to the `Collection` component. It uses the state channel as its input, so make sure that you [scope down the state](#scopes) either on the `Collection` component or somewhere above. The `Collection` component will take its VDOM children as a fragment as its item component, so you can put anything between the opening and closing `<Collection>` tags. The Collection package also has a const for item removal reducer:

```jsx
<Collection>
  <pre>
    <Combobox />

    {src => [
      <button sel='remove'>Remove</button>,
      { state: src.sel.remove.click.mapTo(COLLECTION_DELETE) }
    ]}
  </pre>
</Collection>
```

[See the Todo app for an example](https://codesandbox.io/s/2wv3r9ojqp)

### Helpers, Shortcuts and Tips

* `map`
  The `map` utility function is a handy helper to get the state in the VDOM. It has 2 signatures:
  * `map(mapperFn, <sources>)`
  
  If the sources object is provided as the second parameter, the `map` function returns with a stream which maps `sources.state.stream` over the `mapperFn`, so it's a shortcut for `<sources>.state.stream.map(mapperFn)`:
  
  ```jsx
  function ShowState(sources) {
    return (
      <Code>{map(JSON.stringify, sources)}</Code>
      {/* <Code>{sources.state.stream.map(JSON.stringify)}</Code> */}
    )
  }
  ```
    
  * `map(mapperFn)`

  If the sources object is omitted, then the `map` function returns with an inline component, which has the content of `sources.state.strea`, mapped over `mapperFn`, so it's a shortcut for `{ sources => <>{map(mapperFn, sources)}</> }`:

  ```jsx
  function ShowState(sources) {
    return (
      <Code>{map(JSON.stringify)}</Code>
      {/* <Code>{sources => <>{map(JSON.stringify, sources)}</>}</Code> */}
    )
  }
  ```
  
  Note, that in props, you can only use it with the sources object, as inline components are not applicable as props:

* `get`

  The `get` function works exactly like `map` regarding its signature. The only difference is that it uses a Lodash getter as the mapperFn. It's a convenient shortcut for getting a chunk of the state:
  
  ```jsx
  function ShowColor(sources) {
    const reducer$ = xs.of(() => ({
      color: 'red'
    }))

    return (
      <pre style={ { background: get('color', sources) } }>It's {get('color')}</pre>
    )
  }
  ```
  
  When the `get` function is called with no or empty parameter, it returns with the state object itself:

  ```jsx
  function ShowColor(sources) {
    const reducer$ = xs.of(() => ({
      color: 'red'
    }))

    return (
      <Scope scope='color'>
        <pre style={ { background: get('', sources) } }>It's {get()}</Code>
      </Scope>
    )
  }
  ```

* *View selection shortcuts*

  View selection has a convenience shortcut. Instead of writing

  `sources.react.select('input').events('change').map(ev => ev.target.value)`
  
  You can write just:

  `sources.sel.input.change['target.value']
  
  Example:

  ```jsx
  <Collection>
    <pre>
      <Combobox />

      {src => [
        <button sel='remove' style={ { float: 'right' } }>Remove</button>,
        { state: src.sel.remove.click.mapTo(COLLECTION_DELETE) }
      ]}

      <br />

      {src =>
        <div style={ { color: get('color', src) } }>
          <ShowState />
        </div>
      }
    </pre>
  </Collection>
  ```

* *How to opt-out from the Powercycle control*

  You can opt-out from Powercycle at any place in the VDOM by just returning a regular sinks object. The underlying components will not be controlled by Powercycle.
