import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDebouncedRecorder, openJournal } from '../../src/core/recovery-journal';

// Fake timers are scoped to the debounce describe block below, not applied
// globally: fake-indexeddb schedules its request/transaction callbacks via
// setImmediate, which vi.useFakeTimers() also fakes. A plain record/read/clear
// test that never advances timers would hang forever waiting on IndexedDB
// itself, not on anything this suite is trying to test.
describe('journal', () => {
  it('returns undefined when nothing was recorded', async () => {
    const journal = await openJournal('journal-test-1');
    await expect(journal.read('unknown')).resolves.toBeUndefined();
  });

  it('records and reads back a payload with its timestamp', async () => {
    const journal = await openJournal('journal-test-2');
    await journal.record('doc-a', '{"a":1}', 1000);
    expect(await journal.read('doc-a')).toEqual({
      identity: 'doc-a',
      savedAt: 1000,
      payload: '{"a":1}',
    });
  });

  it('clears an entry after a successful save', async () => {
    const journal = await openJournal('journal-test-3');
    await journal.record('doc-a', '{}', 1000);
    await journal.clear('doc-a');
    await expect(journal.read('doc-a')).resolves.toBeUndefined();
  });

  it('commits writes, so a fresh connection sees them', async () => {
    const first = await openJournal('journal-test-6');
    await first.record('doc-a', '{"durable":true}', 1000);

    const second = await openJournal('journal-test-6');
    expect((await second.read('doc-a'))?.payload).toBe('{"durable":true}');
  });
});

describe('createDebouncedRecorder', () => {
  // The journal is opened before timers are faked: opening an IndexedDB
  // connection needs real setImmediate ticks to complete, and nothing about
  // "does the debounce fire once after the quiet period" depends on how the
  // connection itself was opened.
  afterEach(() => vi.useRealTimers());

  it('writes once after the quiet period, keeping the last payload', async () => {
    const journal = await openJournal('journal-test-4');
    vi.useFakeTimers();
    const record = createDebouncedRecorder(journal, 'doc-a', 1000);

    record('first', 10);
    record('second', 20);
    await vi.advanceTimersByTimeAsync(1000);
    // Back to real timers before reading: the debounced write above just
    // opened its own IndexedDB transaction, which needs real setImmediate
    // ticks to settle, same as opening the connection did.
    vi.useRealTimers();

    expect((await journal.read('doc-a'))?.payload).toBe('second');
  });

  it('does not write before the quiet period elapses', async () => {
    const journal = await openJournal('journal-test-5');
    vi.useFakeTimers();
    const record = createDebouncedRecorder(journal, 'doc-a', 1000);

    record('first', 10);
    await vi.advanceTimersByTimeAsync(400);
    vi.useRealTimers();

    await expect(journal.read('doc-a')).resolves.toBeUndefined();
  });
});
