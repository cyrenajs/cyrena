import xs from 'xstream'

// Just a declarative version of xs.imitate
export default function circular (s1, s2) {
  const proxy$ = xs.create()

  const stream1$ = s1(proxy$)
  const stream2$ = s2(stream1$)

  proxy$.imitate(stream2$)

  return [stream1$, stream2$]
}
