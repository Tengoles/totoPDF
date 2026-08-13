import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { AnnotationBridge } from '../core/annotation-bridge';
import {
  type Capabilities,
  ENCRYPTED_REASON,
  assessPdfDocument,
} from '../core/document-capabilities';
import type { DocumentOrigin, LoadedDocument } from '../core/document-source';
import type { HandleStore } from '../core/file-handles';
import { ensureWritePermission, writeGrantedBytes } from '../core/file-writer';
import type { Journal } from '../core/recovery-journal';
import { buildSavedBytes } from '../core/save-pipeline';
import { createJournalTracker, type JournalTracker } from './journal-tracker';
import type { ViewerHost } from './viewer-host';

/** Nothing is known to be restricted until a document has actually been opened and assessed. */
const DEFAULT_CAPABILITIES: Capabilities = { canSave: true, canHighlight: true, reasons: [] };

/**
 * What capabilities() reports for as long as an open is in flight. The
 * outgoing document's assessment does not describe the incoming one, so
 * reporting it would let, say, an encrypted book inherit a plain book's
 * permission to be written.
 */
const OPENING_CAPABILITIES: Capabilities = { canSave: false, canHighlight: false, reasons: [] };

const OPENING_REASON = 'Wait for the document to finish opening, then save.';

const PERMISSION_DENIED_REASON = 'Write permission was denied. Choose the file again to save.';

/**
 * 'saved' is the only outcome that wrote anything; the caller has to tell them
 * apart to avoid confirming a save that never happened.
 */
export type SaveOutcome = 'saved' | 'no-document' | 'already-saving';

export interface DocumentController {
  present(loaded: LoadedDocument): Promise<void>;
  save(): Promise<SaveOutcome>;
  currentOrigin(): DocumentOrigin | null;
  currentPdf(): PDFDocumentProxy | null;
  isDirty(): boolean;
  capabilities(): Capabilities;
}

/**
 * The three facts about the open document that must always agree with one
 * another: its bytes, the file they belong in, and what may be done to them.
 * They live in one immutable record so that switching documents is a single
 * reference swap. Holding them as three separate variables is what allowed a
 * save to build one document's bytes and resolve another document's file
 * handle, overwriting a book the user had merely opened.
 */
interface OpenDocument {
  loaded: LoadedDocument;
  pdf: PDFDocumentProxy;
  capabilities: Capabilities;
}

interface ControllerState {
  open: OpenDocument | null;
  opening: boolean;
  saving: boolean;
}

/**
 * A row can outlive its usefulness in IndexedDB -- written by an older
 * revision, or restored into a profile where the grant no longer resolves --
 * and handing whatever comes back to queryPermission throws a TypeError on
 * every save from then on, with nothing the user can do about it. Anything
 * that cannot actually be written through counts as a miss, so the next save
 * shows the picker again and replaces the row.
 */
function canWriteThrough(stored: FileSystemFileHandle): boolean {
  return (
    typeof stored.createWritable === 'function' && typeof stored.queryPermission === 'function'
  );
}

async function resolveHandle(
  handles: HandleStore,
  identity: string,
  suggestedName: string,
): Promise<FileSystemFileHandle> {
  const stored = await handles.get(identity);
  if (stored && canWriteThrough(stored)) {
    return stored;
  }
  if (stored) {
    await handles.remove(identity);
  }
  const picked = await window.showSaveFilePicker({
    suggestedName,
    types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }],
  });
  await handles.put(identity, picked);
  return picked;
}

/**
 * The toolbar's Save button is disabled for these cases, but Ctrl+S is a
 * global shortcut that does not know about disabled state -- this is the real
 * gate. An incremental update over an encrypted document would need to encrypt
 * the appended objects too, which totoPDF does not do, so writing one here
 * could hand the user back a corrupt file.
 */
function assertSaveAllowed(capabilities: Capabilities, opening: boolean): void {
  if (opening) {
    throw new Error(OPENING_REASON);
  }
  if (!capabilities.canSave) {
    throw new Error(ENCRYPTED_REASON);
  }
}

/**
 * Captures the open document once, synchronously, and uses only that snapshot
 * afterwards. Every await below can be outlasted by a document switch, and
 * re-reading the live state after one is what paired one document's bytes with
 * another document's file.
 *
 * The handle and its write permission are settled before the bytes are built,
 * not after: showSaveFilePicker() and requestPermission() both require
 * transient user activation, which Chrome withdraws about five seconds after
 * the keypress -- long before a large book finishes serializing.
 */
async function performSave(
  state: ControllerState,
  handles: HandleStore,
  tracker: JournalTracker,
): Promise<SaveOutcome> {
  const open = state.open;
  const opening = state.opening;
  if (!open) {
    return 'no-document';
  }
  if (state.saving) {
    return 'already-saving';
  }
  assertSaveAllowed(open.capabilities, opening);

  const { identity, fileName } = open.loaded;
  state.saving = true;
  try {
    const handle = await resolveHandle(handles, identity, fileName);
    if (!(await ensureWritePermission(handle))) {
      await handles.remove(identity);
      throw new Error(PERMISSION_DENIED_REASON);
    }
    const { bytes } = await buildSavedBytes(open.pdf);
    await writeGrantedBytes(handle, bytes);
    await tracker.clearSaved(identity);
    return 'saved';
  } finally {
    state.saving = false;
  }
}

interface PresentDeps {
  host: ViewerHost;
  bridge: AnnotationBridge;
  tracker: JournalTracker;
}

/**
 * Opens and assesses the document in full before anything is committed, then
 * swaps it in as one reference. A failure anywhere above the swap leaves the
 * previously open document untouched and still current, because nothing was
 * written to state at all -- a half-applied switch was what let a save address
 * the wrong file.
 */
async function performPresent(
  state: ControllerState,
  deps: PresentDeps,
  loaded: LoadedDocument,
): Promise<void> {
  state.opening = true;
  let pdf: PDFDocumentProxy;
  let capabilities: Capabilities;
  try {
    pdf = await deps.host.open(loaded.bytes);
    capabilities = await assessPdfDocument(pdf);
  } catch (error) {
    state.opening = false;
    throw error;
  }

  state.open = { loaded, pdf, capabilities };
  state.opening = false;
  // PDFViewer's annotationEditorMode setter no-ops with no document loaded,
  // so a tool armed before the document opened must be re-applied now.
  deps.bridge.reapply();
  deps.tracker.arm(loaded.identity);

  // Only once the replacement is committed: pdf.js gives each document its own
  // worker holding the whole file, and a failed open above must leave the
  // previous one running, because it is still the document on screen.
  await deps.host.releasePreviousDocument();
}

/**
 * Owns the mutable "what's open right now" state so main() stays a plain
 * sequence of setup calls instead of a closure holding pdfDocument/current.
 */
export function createDocumentController(
  host: ViewerHost,
  bridge: AnnotationBridge,
  handles: HandleStore,
  journal: Journal,
): DocumentController {
  const state: ControllerState = { open: null, opening: false, saving: false };
  const tracker = createJournalTracker(host, journal, () => state.open?.pdf ?? null);

  return {
    present: (loaded) => performPresent(state, { host, bridge, tracker }, loaded),
    save: () => performSave(state, handles, tracker),
    currentOrigin: () => state.open?.loaded.origin ?? null,
    currentPdf: () => state.open?.pdf ?? null,
    isDirty: () => tracker.isDirty(),
    // Derived rather than stored, so an open in flight cannot leave a stale
    // assessment visible and a failed one has nothing to roll back.
    capabilities: () =>
      state.opening ? OPENING_CAPABILITIES : (state.open?.capabilities ?? DEFAULT_CAPABILITIES),
  };
}
