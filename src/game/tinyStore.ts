import { useSyncExternalStore } from 'react'

// 微型 zustand 风格状态库(去掉外部依赖)
export type SetFn<S> = (p: Partial<S> | ((s: S) => Partial<S>)) => void

export interface StoreHook<S> {
  (): S
  <T>(sel: (s: S) => T): T
  getState: () => S
  setState: SetFn<S>
  subscribe: (l: () => void) => () => void
}

export function create<S extends object>(
  init: (set: SetFn<S>, get: () => S) => S,
): StoreHook<S> {
  let state: S
  const listeners = new Set<() => void>()
  const get = () => state
  const set: SetFn<S> = (p) => {
    const patch = typeof p === 'function' ? (p as (s: S) => Partial<S>)(state) : p
    if (!patch) return
    state = { ...state, ...patch }
    listeners.forEach(l => l())
  }
  state = init(set, get)
  const subscribe = (l: () => void) => {
    listeners.add(l)
    return () => { listeners.delete(l) }
  }
  function useStore(): S
  function useStore<T>(sel: (s: S) => T): T
  function useStore<T>(sel?: (s: S) => T) {
    return useSyncExternalStore(
      subscribe,
      () => (sel ? sel(state) : state),
      () => (sel ? sel(state) : state),
    )
  }
  const hook = useStore as StoreHook<S>
  hook.getState = get
  hook.setState = set
  hook.subscribe = subscribe
  return hook
}
