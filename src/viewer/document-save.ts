import type { PDFDocumentProxy } from 'pdfjs-dist';
import { type Capabilities, ENCRYPTED_REASON } from '../core/document-capabilities';
import type { LoadedDocument } from '../core/document-source';
import type { HandleStore } from '../core/file-handles';
import { ensureWritePermission, hasWritePermission, writeGrantedBytes } from '../core/file-writer';
import { buildSavedBytes } from '../core/save-pipeline';
import { contentHash, type JournalTracker } from './journal-tracker';

const OPENING_REASON = 'Wait for the document to finish opening, then save.';

const PERMISSION_DENIED_REASON = 'Write permission was denied. Choose the file again to save.';

/**
 * 'saved' is the only outcome that wrote anything; the caller has to tell them
 * apart to avoid confirming a save that never happened.
 */
export type SaveOutcome = 'saved' | 'no-document' | 'already-saving';

/**
 * What an autosave did instead of writing. Every value other than 'saved' is a
 * reason to leave the file alone and let the user press Ctrl+S, which is why
 * the silent path reports them rather than throwing: none of them is a fault.
 */
export type SilentSaveOutcome =
  | SaveOutcome
  /** Nothing open, still opening, or a document that may not be written at all. */
  | 'not-allowed'
  /** This document has never been saved, so there is no file to write to. */
  | 'no-handle'
  /** A handle exists but readwrite is not already granted, and asking needs a gesture. */
  | 'no-permission';

/**
 * The three facts about the open document that must always agree with one
 * another: its bytes, the file they belong in, and what may be done to them.
 * They live in one immutable record so that switching documents is a single
 * reference swap. Holding them as three separate variables is what allowed a
 * save to build one document's bytes and resolve another document's file
 * handle, overwriting a book the user had merely opened.
 */
export interface OpenDocument {
  loaded: LoadedDocument;
  pdf: PDFDocumentProxy;
  capabilities: Capabilities;
}

export interface ControllerState {
  open: OpenDocument | null;
  opening: boolean;
  saving: boolean;
  /** Whether the open document has reached its file at least once this session. */
  savedOnce: boolean;
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
 * The write itself, shared verbatim by the manual and the automatic path. An
 * autosave is not a fast lane around buildSavedBytes' incremental-update
 * assertion: that assertion is the entire guarantee that the user's original
 * bytes survive, and the path that runs unattended, many times a session, is
 * the last one that should be allowed to skip it.
 */
async function writeThrough(
  state: ControllerState,
  open: OpenDocument,
  tracker: JournalTracker,
  handle: FileSystemFileHandle,
): Promise<'saved'> {
  // Read before the build, not after: serializing a large book takes seconds,
  // and a highlight made during them belongs to the next save, not this one.
  const savedHash = contentHash(open.pdf);
  const { bytes } = await buildSavedBytes(open.pdf);
  await writeGrantedBytes(handle, bytes);
  await tracker.clearSaved(open.loaded.identity, savedHash);
  if (state.open === open) {
    state.savedOnce = true;
  }
  return 'saved';
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
export async function performSave(
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
    return await writeThrough(state, open, tracker, handle);
  } finally {
    state.saving = false;
  }
}

/**
 * The autosave path. It must never call showSaveFilePicker or
 * requestPermission: both need transient user activation, which a timer two
 * seconds after the last keystroke does not have, so the best case is a
 * rejected call and the worst is a dialog appearing out of nowhere that the
 * user cannot connect to anything they did. So this resolves the handle only
 * from the store and only reads the permission, and when either is missing it
 * says which and leaves the file alone. Ctrl+S still works; nothing is lost
 * but the convenience.
 *
 * It reports rather than throws because none of its refusals is an error: a
 * document that has never been saved simply has nowhere to be saved to.
 */
export async function performSilentSave(
  state: ControllerState,
  handles: HandleStore,
  tracker: JournalTracker,
): Promise<SilentSaveOutcome> {
  const open = state.open;
  if (!open) {
    return 'no-document';
  }
  // Shares the manual path's latch, so an autosave firing during a Ctrl+S --
  // or during another autosave -- waits its turn instead of writing the same
  // file twice at once.
  if (state.saving) {
    return 'already-saving';
  }
  if (state.opening || !open.capabilities.canSave) {
    return 'not-allowed';
  }

  state.saving = true;
  try {
    const stored = await handles.get(open.loaded.identity);
    if (!stored || !canWriteThrough(stored)) {
      return 'no-handle';
    }
    // Deliberately does not delete an unusable row the way resolveHandle does:
    // replacing it needs the picker, and the picker needs a gesture this has
    // none of. The next manual save cleans it up.
    if (!(await hasWritePermission(stored))) {
      return 'no-permission';
    }
    return await writeThrough(state, open, tracker, stored);
  } finally {
    state.saving = false;
  }
}
