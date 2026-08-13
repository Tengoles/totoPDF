import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { ENCRYPTED_REASON } from '../../src/core/document-capabilities';
import { createDocumentController } from '../../src/viewer/document-controller';
import {
  deferred,
  fakeBridge,
  fakeDoc,
  fakeHandle,
  fakeHost,
  fakeJournal,
  fakePdf,
  fakeStore,
  loadedDoc,
  savedBytesFor,
  sequencedOpen,
} from './document-controller-fakes';

const A = 0x41;
const B = 0x42;
const PASSWORD_ERROR = new Error('This PDF is password protected.');

afterEach(() => {
  vi.unstubAllGlobals();
});

function controllerFor(
  open: (bytes: Uint8Array) => Promise<PDFDocumentProxy>,
  store = fakeStore(),
  journal = fakeJournal(),
) {
  const host = fakeHost(open);
  return {
    controller: createDocumentController(host.host, fakeBridge, store, journal),
    host,
    store,
    journal,
  };
}

describe('present', () => {
  it('leaves the open document entirely in place when the next open fails', async () => {
    const { controller } = controllerFor(sequencedOpen(fakePdf(A), PASSWORD_ERROR));

    await controller.present(loadedDoc('a'));
    const before = controller.capabilities();

    await expect(controller.present(loadedDoc('b'))).rejects.toThrow(PASSWORD_ERROR);

    expect(controller.currentOrigin()).toEqual({ kind: 'dropped', fileName: 'a.pdf' });
    expect(controller.capabilities()).toEqual(before);
  });

  it('denies every capability while an open is in flight', async () => {
    const pending = deferred<PDFDocumentProxy>();
    const { controller } = controllerFor(() => pending.promise);

    const presenting = controller.present(loadedDoc('a'));
    expect(controller.capabilities()).toEqual({
      canSave: false,
      canHighlight: false,
      reasons: [],
    });

    pending.resolve(fakePdf(A));
    await presenting;
    expect(controller.capabilities().canSave).toBe(true);
  });

  it('releases the previous document only after an open succeeds', async () => {
    const { controller, host } = controllerFor(
      sequencedOpen(fakePdf(A), PASSWORD_ERROR, fakePdf(B)),
    );

    await controller.present(loadedDoc('a'));
    expect(host.releaseCount()).toBe(1);

    await expect(controller.present(loadedDoc('b'))).rejects.toThrow(PASSWORD_ERROR);
    expect(host.releaseCount()).toBe(1);

    await controller.present(loadedDoc('c'));
    expect(host.releaseCount()).toBe(2);
  });
});

describe('save', () => {
  it('reports no document when nothing is open', async () => {
    const { controller } = controllerFor(sequencedOpen(fakePdf(A)));
    await expect(controller.save()).resolves.toBe('no-document');
  });

  it('refuses an encrypted document even though Ctrl+S bypasses the disabled button', async () => {
    const { controller } = controllerFor(sequencedOpen(fakePdf(A, { encrypted: true })));
    await controller.present(loadedDoc('a'));
    await expect(controller.save()).rejects.toThrow(ENCRYPTED_REASON);
  });

  // F1: present() used to assign `current` before awaiting host.open, so a
  // failed open left the previous document's proxy paired with the new
  // document's identity -- and the save resolved that identity's handle.
  it('writes the open document into the open document file after a failed switch', async () => {
    const store = fakeStore();
    const a = fakeHandle();
    const b = fakeHandle();
    store.rows.set('a', a.handle);
    store.rows.set('b', b.handle);
    const { controller } = controllerFor(sequencedOpen(fakePdf(A), PASSWORD_ERROR), store);

    await controller.present(loadedDoc('a'));
    await expect(controller.present(loadedDoc('b'))).rejects.toThrow(PASSWORD_ERROR);

    await expect(controller.save()).resolves.toBe('saved');
    expect(b.written).toHaveLength(0);
    expect(a.written).toEqual([savedBytesFor(A)]);
  });

  // F1, the asynchronous half: a document switch that lands mid-save must not
  // redirect that save onto the newly opened document's file.
  it('stays on the document captured when save was called', async () => {
    const store = fakeStore();
    const a = fakeHandle();
    const b = fakeHandle();
    store.rows.set('a', a.handle);
    store.rows.set('b', b.handle);
    const gate = deferred<void>();
    store.get = async (identity) => {
      await gate.promise;
      return store.rows.get(identity);
    };

    const journal = fakeJournal();
    const { controller } = controllerFor(sequencedOpen(fakePdf(A), fakePdf(B)), store, journal);
    await controller.present(loadedDoc('a'));

    const saving = controller.save();
    await controller.present(loadedDoc('b'));
    gate.resolve();

    await expect(saving).resolves.toBe('saved');
    expect(a.written).toEqual([savedBytesFor(A)]);
    expect(b.written).toHaveLength(0);
    // The journal entry cleared is the saved document's, not the open one's.
    expect(journal.cleared).toEqual(['a']);
  });

  // F4: showSaveFilePicker and requestPermission need transient user
  // activation, which expires while a large book's bytes are being built.
  it('settles the handle and its permission before building the bytes', async () => {
    const log: string[] = [];
    const store = fakeStore(log);
    store.rows.set('a', fakeHandle(log).handle);
    const { controller } = controllerFor(sequencedOpen(fakePdf(A)), store);

    await controller.present(loadedDoc('a'));
    await expect(controller.save()).resolves.toBe('saved');

    expect(log).toEqual(['handle', 'permission', 'write']);
  });

  // F8: holding Ctrl+S fires the shortcut every few milliseconds.
  it('skips a save while one is still in flight', async () => {
    const store = fakeStore();
    const target = fakeHandle();
    store.rows.set('a', target.handle);
    const gate = deferred<void>();
    store.get = async (identity) => {
      await gate.promise;
      return store.rows.get(identity);
    };
    const { controller } = controllerFor(sequencedOpen(fakePdf(A)), store);
    await controller.present(loadedDoc('a'));

    const first = controller.save();
    await expect(controller.save()).resolves.toBe('already-saving');
    await expect(controller.save()).resolves.toBe('already-saving');

    gate.resolve();
    await expect(first).resolves.toBe('saved');
    expect(target.written).toHaveLength(1);
  });

  it('clears the in-flight latch after a save fails', async () => {
    const store = fakeStore();
    const target = fakeHandle();
    store.rows.set('a', target.handle);
    let failNext = true;
    store.get = (identity) => {
      if (failNext) {
        failNext = false;
        return Promise.reject(new Error('IndexedDB unavailable'));
      }
      return Promise.resolve(store.rows.get(identity));
    };
    const { controller } = controllerFor(sequencedOpen(fakePdf(A)), store);
    await controller.present(loadedDoc('a'));

    await expect(controller.save()).rejects.toThrow('IndexedDB unavailable');
    await expect(controller.save()).resolves.toBe('saved');
    expect(target.written).toHaveLength(1);
  });

  // F10: a row that is no longer a usable handle used to throw a TypeError
  // inside queryPermission on every save, with no way out.
  it('re-picks the file when the stored row cannot be written through', async () => {
    const store = fakeStore();
    store.rows.set('a', { name: 'a.pdf' } as unknown as FileSystemFileHandle);
    const picked = fakeHandle();
    const showSaveFilePicker = vi.fn().mockResolvedValue(picked.handle);
    vi.stubGlobal('window', { showSaveFilePicker });

    const { controller } = controllerFor(sequencedOpen(fakePdf(A)), store);
    await controller.present(loadedDoc('a'));

    await expect(controller.save()).resolves.toBe('saved');
    expect(showSaveFilePicker).toHaveBeenCalledOnce();
    expect(picked.written).toEqual([savedBytesFor(A)]);
    expect(store.rows.get('a')).toBe(picked.handle);
  });
});

describe('isDirty', () => {
  it('is false until an editor change and false again after a save', async () => {
    const store = fakeStore();
    store.rows.set('a', fakeHandle().handle);
    const doc = fakeDoc(A);
    const { controller, host } = controllerFor(sequencedOpen(doc.proxy), store);

    await controller.present(loadedDoc('a'));
    expect(controller.isDirty()).toBe(false);

    doc.edit();
    host.emitEditingChange();
    expect(controller.isDirty()).toBe(true);

    await expect(controller.save()).resolves.toBe('saved');
    expect(controller.isDirty()).toBe(false);
  });

  // 'editingstateschanged' also fires when an editor is merely selected. The
  // tab-close warning used to treat that as unsaved work and cry wolf over a
  // document nobody had changed.
  it('stays clean when an editor is only selected, leaving the content alone', async () => {
    const { controller, host } = controllerFor(sequencedOpen(fakePdf(A)));

    await controller.present(loadedDoc('a'));
    host.emitEditingChange();

    expect(controller.isDirty()).toBe(false);
  });

  it('reports the newly opened document as clean, not the saved one', async () => {
    const store = fakeStore();
    store.rows.set('a', fakeHandle().handle);
    const gate = deferred<void>();
    store.get = async (identity) => {
      await gate.promise;
      return store.rows.get(identity);
    };
    const a = fakeDoc(A);
    const b = fakeDoc(B);
    const { controller, host } = controllerFor(sequencedOpen(a.proxy, b.proxy), store);

    await controller.present(loadedDoc('a'));
    a.edit();
    host.emitEditingChange();

    const saving = controller.save();
    await controller.present(loadedDoc('b'));
    b.edit();
    host.emitEditingChange();
    gate.resolve();
    await saving;

    // Document b has unsaved edits; a's save says nothing about them.
    expect(controller.isDirty()).toBe(true);
  });
});
