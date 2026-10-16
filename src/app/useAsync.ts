import { useEffect, useState, type DependencyList } from 'react'

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; value: T }

export function useAsync<T> (load: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' })
  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    load().then(
      value => { if (!cancelled) setState({ status: 'ready', value }) },
      (error: unknown) => { if (!cancelled) setState({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) }) }
    )
    return () => { cancelled = true }
  }, deps)
  return state
}
