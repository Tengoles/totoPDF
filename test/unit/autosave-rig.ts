import { vi } from 'vitest';
import { AUTOSAVE_DEBOUNCE_MS } from '../../src/viewer/autosave';
import { createDocumentController } from '../../src/viewer/document-controller';
import {
  type FakeDoc,
  type FakeHandle,
  type FakeHost,
  type FakeStore,
  fakeBridge,
  fakeDoc,
  fakeHandle,
  fakeHost,
  fakeJournal,
  fakeStore,
  sequencedOpen,
} from './document-controller-fakes';

/**
 * The shared harness for the two autosave suites. Autosave has to be SILENT or
 * not happen: showSaveFilePicker and requestPermission both need transient user
 * activation, which a timer two seconds after the last keystroke does not have.
 * So the rig spies on every way to put something in front of the user, and any
 * test that ends in no write can also assert that nothing was asked.
 */

export const MARKER_A = 0x41;
export const MARKER_B = 0x42;

export interface Rig {
  controller: ReturnType<typeof createDocumentController>;
  host: FakeHost;
  store: FakeStore;
  doc: FakeDoc;
  target: FakeHandle;
  /** Call count on the file picker. Autosave must never move it off zero. */
  picker: ReturnType<typeof vi.fn>;
  failures: unknown[];
}

/** One document, one stored handle, and a spy on every way to prompt. */
export function autosaveRig(
  options: { permission?: PermissionState; storeHandle?: boolean } = {},
): Rig {
  const store = fakeStore();
  const target = fakeHandle([], options.permission ?? 'granted');
  if (options.storeHandle !== false) {
    store.rows.set('a', target.handle);
  }
  const doc = fakeDoc(MARKER_A);
  const host = fakeHost(sequencedOpen(doc.proxy, fakeDoc(MARKER_B).proxy));
  const failures: unknown[] = [];
  const picker = vi.fn();
  vi.stubGlobal('window', { showSaveFilePicker: picker });

  return {
    controller: createDocumentController(host.host, fakeBridge, store, fakeJournal(), (error) =>
      failures.push(error),
    ),
    host,
    store,
    doc,
    target,
    picker,
    failures,
  };
}

/** One real content change: the hash moves, then pdf.js announces it. */
export function editContent(host: FakeHost, doc: FakeDoc): void {
  doc.edit();
  host.emitEditingChange();
}

export async function settleDebounce(): Promise<void> {
  await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
}
