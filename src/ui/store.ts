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
      // for...in over a generic gives key: Extract<keyof T, string>, so this
      // needs no cast -- unlike Object.keys, which widens to string.
      let changed = false;
      for (const key in patch) {
        if (!Object.is(state[key], patch[key])) {
          changed = true;
          break;
        }
      }
      if (!changed) {
        return;
      }
      state = { ...state, ...patch };
      // Snapshot: a listener may subscribe or unsubscribe during dispatch.
      for (const listener of [...listeners]) {
        listener(state);
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
