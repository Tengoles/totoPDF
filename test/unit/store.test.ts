import { describe, expect, it, vi } from 'vitest';
import { createStore } from '../../src/ui/store';

describe('createStore', () => {
  it('exposes the initial state', () => {
    expect(createStore({ count: 0 }).get()).toEqual({ count: 0 });
  });

  it('merges patches rather than replacing state', () => {
    const store = createStore({ count: 0, name: 'a' });
    store.set({ count: 1 });
    expect(store.get()).toEqual({ count: 1, name: 'a' });
  });

  it('notifies subscribers on change', () => {
    const store = createStore({ count: 0 });
    const listener = vi.fn();
    store.subscribe(listener);
    store.set({ count: 1 });
    expect(listener).toHaveBeenCalledWith({ count: 1 });
  });

  it('does not notify when no value actually changed', () => {
    const store = createStore({ count: 0 });
    const listener = vi.fn();
    store.subscribe(listener);
    store.set({ count: 0 });
    expect(listener).not.toHaveBeenCalled();
  });

  it('stops notifying after unsubscribe', () => {
    const store = createStore({ count: 0 });
    const listener = vi.fn();
    store.subscribe(listener)();
    store.set({ count: 1 });
    expect(listener).not.toHaveBeenCalled();
  });
});
