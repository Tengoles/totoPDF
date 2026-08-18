import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDocumentController } from '../../src/viewer/document-controller';
import { autosaveRig, editContent, MARKER_A, settleDebounce } from './autosave-rig';
import {
  deferred,
  fakeBridge,
  fakeDoc,
  fakeHandle,
  fakeHost,
  fakeJournal,
  fakeStore,
  loadedDoc,
  savedBytesFor,
  sequencedOpen,
} from './document-controller-fakes';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('autosave triggering', () => {
  it('writes the file once the debounce elapses after a content change', async () => {
    const { controller, host, doc, target } = autosaveRig();
    await controller.present(loadedDoc('a'));

    await editContent(host, doc);
    expect(target.written).toHaveLength(0);

    await settleDebounce();
    expect(target.written).toEqual([savedBytesFor(MARKER_A)]);
  });

  it('coalesces a burst of changes into one write', async () => {
    const { controller, host, doc, target } = autosaveRig();
    await controller.present(loadedDoc('a'));

    await editContent(host, doc);
    await vi.advanceTimersByTimeAsync(1500);
    await editContent(host, doc);
    await vi.advanceTimersByTimeAsync(1500);
    await editContent(host, doc);
    expect(target.written).toHaveLength(0);

    await settleDebounce();
    expect(target.written).toHaveLength(1);
  });

  // 'editingstateschanged' fires when an editor is selected too, so triggering
  // straight off it would append a revision every time a highlight is clicked.
  it('does not schedule anything when only the selection changed', async () => {
    const { controller, host, target } = autosaveRig();
    await controller.present(loadedDoc('a'));

    host.emitEditingChange();
    await settleDebounce();

    expect(target.written).toHaveLength(0);
    expect(controller.saveStatus.state()).toBe('none');
  });

  it('does not write again when nothing changed since the last autosave', async () => {
    const { controller, host, doc, target } = autosaveRig();
    await controller.present(loadedDoc('a'));

    await editContent(host, doc);
    await settleDebounce();
    expect(target.written).toHaveLength(1);

    // A selection, an undo stack move, anything that leaves the content alone.
    host.emitEditingChange();
    await settleDebounce();
    expect(target.written).toHaveLength(1);
  });
});

describe('autosave silence', () => {
  it('writes nothing and opens no picker when the document has no handle', async () => {
    const { controller, host, doc, target, picker } = autosaveRig({ storeHandle: false });
    await controller.present(loadedDoc('a'));

    await editContent(host, doc);
    await settleDebounce();

    expect(target.written).toHaveLength(0);
    expect(picker).not.toHaveBeenCalled();
    expect(controller.saveStatus.state()).toBe('unsaved');
  });

  it('never asks for permission that is not already granted', async () => {
    const { controller, host, doc, target, picker } = autosaveRig({ permission: 'prompt' });
    await controller.present(loadedDoc('a'));

    await editContent(host, doc);
    await settleDebounce();

    expect(target.written).toHaveLength(0);
    expect(target.requests()).toBe(0);
    expect(picker).not.toHaveBeenCalled();
    expect(controller.saveStatus.state()).toBe('unsaved');
  });

  it('leaves the stored handle in place when permission is only prompt', async () => {
    const { controller, host, doc, store } = autosaveRig({ permission: 'prompt' });
    await controller.present(loadedDoc('a'));

    await editContent(host, doc);
    await settleDebounce();

    // Deleting it would make the next manual save re-open the picker for a
    // file the user already chose.
    expect(store.rows.has('a')).toBe(true);
  });

  it('refuses to autosave a document that may not be saved at all', async () => {
    const store = fakeStore();
    const target = fakeHandle();
    store.rows.set('a', target.handle);
    const doc = fakeDoc(MARKER_A, { encrypted: true });
    const host = fakeHost(sequencedOpen(doc.proxy));
    const controller = createDocumentController(host.host, fakeBridge, store, fakeJournal());

    await controller.present(loadedDoc('a'));
    await editContent(host, doc);
    await settleDebounce();

    expect(target.written).toHaveLength(0);
  });
});

describe('autosave and other writes', () => {
  it('does not double up on a save already in flight', async () => {
    const { controller, host, doc, store, target } = autosaveRig();
    const gate = deferred<void>();
    await controller.present(loadedDoc('a'));
    store.get = async (identity) => {
      await gate.promise;
      return store.rows.get(identity);
    };

    await editContent(host, doc);
    const manual = controller.save();
    await settleDebounce();
    expect(target.written).toHaveLength(0);

    gate.resolve();
    await expect(manual).resolves.toBe('saved');
    expect(target.written).toHaveLength(1);

    // The deferred autosave then gets its turn. It cannot know whether the
    // manual save's bytes included the change that armed it, so it writes
    // rather than risk dropping an edit.
    await settleDebounce();
    expect(target.written).toHaveLength(2);
  });

  // A pending write belongs to the document it was scheduled for. Firing it
  // after a switch would write a document the user has only just opened.
  it('cancels a pending autosave when the document is replaced', async () => {
    const { controller, host, doc, store } = autosaveRig();
    const second = fakeHandle();
    store.rows.set('b', second.handle);
    await controller.present(loadedDoc('a'));

    await editContent(host, doc);
    await controller.present(loadedDoc('b'));
    await settleDebounce();

    expect(second.written).toHaveLength(0);
  });
});
