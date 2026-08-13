import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { openHandleStore } from '../../src/core/file-handles';

const fakeHandle = (name: string) => ({ name, kind: 'file' }) as unknown as FileSystemFileHandle;

describe('handle store', () => {
  it('returns undefined for an unknown identity', async () => {
    const store = await openHandleStore('totopdf-test-1');
    await expect(store.get('nope')).resolves.toBeUndefined();
  });

  it('round-trips a handle by identity', async () => {
    const store = await openHandleStore('totopdf-test-2');
    await store.put('hash-a', fakeHandle('a.pdf'));
    const found = await store.get('hash-a');
    expect(found?.name).toBe('a.pdf');
  });

  it('overwrites an existing identity rather than duplicating it', async () => {
    const store = await openHandleStore('totopdf-test-3');
    await store.put('hash-a', fakeHandle('old.pdf'));
    await store.put('hash-a', fakeHandle('new.pdf'));
    expect((await store.get('hash-a'))?.name).toBe('new.pdf');
  });

  it('removes a handle', async () => {
    const store = await openHandleStore('totopdf-test-4');
    await store.put('hash-a', fakeHandle('a.pdf'));
    await store.remove('hash-a');
    await expect(store.get('hash-a')).resolves.toBeUndefined();
  });
});
