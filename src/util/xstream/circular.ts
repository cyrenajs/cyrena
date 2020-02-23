import xs, { Stream } from 'xstream'

// Just a declarative version of xs.imitate
export default function circular<T1, T2>(
  s1: (s2$: Stream<T2>) => Stream<T1>,
  s2: (s1$: Stream<T1>) => Stream<T2>
): any {
  const proxy$ = xs.create() as Stream<T2>

  const stream1$ = s1(proxy$)
  const stream2$ = s2(stream1$)

  proxy$.imitate(stream2$)

  return [stream1$, stream2$]
}
