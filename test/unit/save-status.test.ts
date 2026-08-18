import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { autosaveRig, editContent, MARKER_B, settleDebounce } from './autosave-rig';
import { deferred, fakeDoc, fakeHandle, loadedDoc, savedBytesFor } from './document-controller-fakes';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('autosave failure', () => {
  it('reports once, stops autosaving, and leaves the status on unsaved', async () => {
    const { controller, host, doc, store, failures } = autosaveRig();
    store.get = () => Promise.reject(new Error('IndexedDB unavailable'));
    await controller.present(loadedDoc('a'));

    await editContent(host, doc);
    await settleDebounce();

    expect(failures).toHaveLength(1);
    // The status has to keep saying the work is not in the file, because it
    // is not, and Ctrl+S is now the only thing that will put it there.
    expect(controller.saveStatus.state()).toBe('unsaved');

    // No retry loop: further edits, and further time, add nothing.
    await editContent(host, doc);
    await settleDebounce();
    await settleDebounce();
    expect(failures).toHaveLength(1);
    expect(controller.saveStatus.state()).toBe('unsaved');
  });

  it('gives a newly opened document its own chance to autosave', async () => {
    const { controller, host, doc, store } = autosaveRig();
    const second = fakeHandle();
    const workingGet = store.get;
    store.get = () => Promise.reject(new Error('IndexedDB unavailable'));
    await controller.present(loadedDoc('a'));
    await editContent(host, doc);
    await settleDebounce();

    store.rows.set('b', second.handle);
    store.get = workingGet;
    const nextDoc = fakeDoc(MARKER_B);
    host.host.open = () => Promise.resolve(nextDoc.proxy);
    await controller.present(loadedDoc('b'));

    await editContent(host, nextDoc);
    await settleDebounce();
    expect(second.written).toEqual([savedBytesFor(MARKER_B)]);
  });
});

describe('save status', () => {
  it('walks from unsaved to saving to saved across one autosave', async () => {
    const { controller, host, doc, store } = autosaveRig();
    const gate = deferred<void>();
    await controller.present(loadedDoc('a'));
    // Open, untouched and never saved: there is nothing true to say yet.
    expect(controller.saveStatus.state()).toBe('none');

    const seen: string[] = [];
    controller.saveStatus.subscribe((status) => seen.push(status), new AbortController().signal);

    store.get = async (identity) => {
      await gate.promise;
      return store.rows.get(identity);
    };
    await editContent(host, doc);
    // During the debounce window the edit genuinely is not in the file.
    expect(controller.saveStatus.state()).toBe('unsaved');

    await settleDebounce();
    expect(controller.saveStatus.state()).toBe('saving');

    gate.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(controller.saveStatus.state()).toBe('saved');
    expect(seen).toEqual(['unsaved', 'saving', 'saved']);
  });

  it('reports saving and saved for a manual save too', async () => {
    const { controller, host, doc, store } = autosaveRig();
    const gate = deferred<void>();
    await controller.present(loadedDoc('a'));
    await editContent(host, doc);
    store.get = async (identity) => {
      await gate.promise;
      return store.rows.get(identity);
    };

    const saving = controller.save();
    expect(controller.saveStatus.state()).toBe('saving');

    gate.resolve();
    await saving;
    expect(controller.saveStatus.state()).toBe('saved');
  });

  it('stops reporting to a toolbar whose signal has aborted', async () => {
    const { controller, host, doc } = autosaveRig();
    const abort = new AbortController();
    const seen: string[] = [];
    controller.saveStatus.subscribe((status) => seen.push(status), abort.signal);
    await controller.present(loadedDoc('a'));

    // A new document rebuilds the toolbar, and the readout it replaced must
    // stop being written to or every open would leave another one live.
    abort.abort();
    const before = seen.length;
    await editContent(host, doc);
    await settleDebounce();

    expect(seen).toHaveLength(before);
    expect(seen).toContain('none');
  });
});
