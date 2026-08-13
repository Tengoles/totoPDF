export interface Store<T> {
  get(): T;
  set(patch: Partial<T>): void;
  subscribe(listener: (state: T) => void): () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<(state: T) => void>();

  return {
    get: () => state,
    set(patch) {
      const changed = (Object.keys(patch) as (keyof T)[]).some(
        (key) => !Object.is(state[key], patch[key]),
      );
      if (!changed) {
        return;
      }
      state = { ...state, ...patch };
      for (const listener of listeners) {
        listener(state);
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
