import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { AnnotationBridge } from '../core/annotation-bridge';
import {
  type Capabilities,
  ENCRYPTED_REASON,
  assessPdfDocument,
} from '../core/document-capabilities';
import type { DocumentOrigin, LoadedDocument } from '../core/document-source';
import type { HandleStore } from '../core/file-handles';
import { writeBytes } from '../core/file-writer';
import { createDebouncedRecorder, type Journal } from '../core/recovery-journal';
import { buildSavedBytes } from '../core/save-pipeline';
import type { ViewerHost } from './viewer-host';

/** Nothing is known to be restricted until a document has actually been opened and assessed. */
const DEFAULT_CAPABILITIES: Capabilities = { canSave: true, canHighlight: true, reasons: [] };

export interface DocumentController {
  present(loaded: LoadedDocument): Promise<void>;
  save(): Promise<void>;
  currentOrigin(): DocumentOrigin | null;
  currentPdf(): PDFDocumentProxy | null;
  isDirty(): boolean;
  capabilities(): Capabilities;
}

async function resolveHandle(
  handles: HandleStore,
  identity: string,
  suggestedName: string,
): Promise<FileSystemFileHandle> {
  const stored = await handles.get(identity);
  if (stored) {
    return stored;
  }
  const picked = await window.showSaveFilePicker({
    suggestedName,
    types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }],
  });
  await handles.put(identity, picked);
  return picked;
}

/**
 * The toolbar's Save button is disabled for this case, but Ctrl+S is a
 * global shortcut that does not know about disabled state -- this is the
 * real gate. An incremental update over an encrypted document would need
 * to encrypt the appended objects too, which totoPDF does not do, so
 * writing one here could hand the user back a corrupt file.
 */
function assertSaveAllowed(capabilities: Capabilities): void {
  if (!capabilities.canSave) {
    throw new Error(ENCRYPTED_REASON);
  }
}

type AnnotationStorage = PDFDocumentProxy['annotationStorage'];

/**
 * `serializable.map` is a real Map instance. JSON.stringify cannot see
 * inside a Map -- it has no own enumerable properties -- so stringifying it
 * directly would silently produce "{}": the journal would look like it is
 * working while recording nothing. Spread the entries into an array first.
 */
function serializeAnnotationState(storage: AnnotationStorage): string {
  const { map, hash } = storage.serializable;
  return JSON.stringify({ hash, entries: map ? [...map] : [] });
}

interface JournalTracker {
  arm(identity: string): void;
  clear(): Promise<void>;
  isDirty(): boolean;
}

/**
 * Mirrors annotation-editor activity into the crash-recovery journal and
 * tracks whether the open document has unsaved edits. The journal is a crash
 * buffer, not a second source of truth -- it is re-armed with a fresh
 * identity each time a document opens, and a successful save clears it.
 */
function createJournalTracker(
  host: ViewerHost,
  journal: Journal,
  currentPdf: () => PDFDocumentProxy | null,
): JournalTracker {
  let dirty = false;
  let identity: string | null = null;
  let record: ((payload: string, now: number) => void) | null = null;

  // 'editingstateschanged', not 'annotationeditorstateschanged': the latter is
  // dispatched nowhere in pdfjs-dist 6.2.108, so listening for it recorded
  // nothing at all while looking perfectly healthy. This one fires from
  // AnnotationEditorUIManager whenever editor state actually changes -- an
  // editor added, removed, selected, or the undo stack moving.
  host.eventBus.on('editingstateschanged', () => {
    const storage = currentPdf()?.annotationStorage;
    if (!storage || !record) {
      return;
    }
    dirty = true;
    record(serializeAnnotationState(storage), Date.now());
  });

  return {
    arm(nextIdentity) {
      identity = nextIdentity;
      dirty = false;
      record = createDebouncedRecorder(journal, nextIdentity, 1000);
    },
    async clear() {
      if (identity) {
        await journal.clear(identity);
      }
      dirty = false;
    },
    isDirty: () => dirty,
  };
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
  let pdfDocument: PDFDocumentProxy | null = null;
  let current: LoadedDocument | null = null;
  let capabilities: Capabilities = DEFAULT_CAPABILITIES;
  const tracker = createJournalTracker(host, journal, () => pdfDocument);

  async function save(): Promise<void> {
    if (!pdfDocument || !current) {
      return;
    }
    assertSaveAllowed(capabilities);
    const { bytes } = await buildSavedBytes(pdfDocument);
    const handle = await resolveHandle(handles, current.identity, current.fileName);
    const outcome = await writeBytes(handle, bytes);
    if (outcome.kind === 'permission-denied') {
      await handles.remove(current.identity);
      throw new Error('Write permission was denied. Choose the file again to save.');
    }
    await tracker.clear();
  }

  async function present(loaded: LoadedDocument): Promise<void> {
    current = loaded;
    pdfDocument = await host.open(loaded.bytes);
    // PDFViewer's annotationEditorMode setter no-ops with no document loaded,
    // so a tool armed before the document opened must be re-applied now.
    bridge.reapply();
    tracker.arm(loaded.identity);
    capabilities = await assessPdfDocument(pdfDocument);
  }

  return {
    present,
    save,
    currentOrigin: () => current?.origin ?? null,
    currentPdf: () => pdfDocument,
    isDirty: () => tracker.isDirty(),
    capabilities: () => capabilities,
  };
}
