import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { AnnotationBridge } from '../core/annotation-bridge';
import { type Capabilities, assessPdfDocument } from '../core/document-capabilities';
import type { DocumentOrigin, LoadedDocument } from '../core/document-source';
import type { HandleStore } from '../core/file-handles';
import type { Journal } from '../core/recovery-journal';
import type { SaveStatus, SaveStatusSource } from '../ui/save-status';
import { type Autosave, createAutosave } from './autosave';
import {
  type ControllerState,
  performSave,
  performSilentSave,
  type SaveOutcome,
} from './document-save';
import { createJournalTracker, type JournalTracker } from './journal-tracker';
import type { ViewerHost } from './viewer-host';

export type { SaveOutcome } from './document-save';

/** Nothing is known to be restricted until a document has actually been opened and assessed. */
const DEFAULT_CAPABILITIES: Capabilities = { canSave: true, highlightMode: 'text', reasons: [] };

/**
 * What capabilities() reports for as long as an open is in flight. The
 * outgoing document's assessment does not describe the incoming one, so
 * reporting it would let, say, an encrypted book inherit a plain book's
 * permission to be written. Only saving is withheld: highlighting is never
 * withdrawn from a document, and there is no document here to withdraw it
 * from -- pdf.js's editor-mode setter is a no-op until one is loaded.
 */
const OPENING_CAPABILITIES: Capabilities = { canSave: false, highlightMode: 'text', reasons: [] };

export interface DocumentController {
  present(loaded: LoadedDocument): Promise<void>;
  save(): Promise<SaveOutcome>;
  currentOrigin(): DocumentOrigin | null;
  /** The open document's file name, for the tab title. Null when none is open. */
  currentFileName(): string | null;
  currentPdf(): PDFDocumentProxy | null;
  isDirty(): boolean;
  capabilities(): Capabilities;
  /** What the toolbar's readout shows, and how it hears about changes. */
  saveStatus: SaveStatusSource;
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
  // The incoming document has its own file and its own save history; the
  // outgoing one's says nothing about it.
  state.savedOnce = false;
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
 * Derived on every read so no stale word can survive on screen. During the
 * debounce window it reads 'unsaved', which is simply true: the highlight is
 * not in the file yet, and saying otherwise for two seconds would be the one
 * lie a save indicator must never tell.
 */
function currentStatus(state: ControllerState, tracker: JournalTracker): SaveStatus {
  if (!state.open) {
    return 'none';
  }
  if (state.saving) {
    return 'saving';
  }
  if (tracker.isDirty()) {
    return 'unsaved';
  }
  return state.savedOnce ? 'saved' : 'none';
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
  /** Autosave gave up on this document. Surface it; Ctrl+S still works. */
  onAutosaveFailure: (error: unknown) => void = () => undefined,
): DocumentController {
  const state: ControllerState = { open: null, opening: false, saving: false, savedOnce: false };

  // The tracker and the autosave are mutually dependent by design -- a content
  // change schedules a write, and a write settles what counts as changed -- so
  // one of the two references has to be late. Only the closures below read it,
  // and they cannot run before the assignment two statements down.
  let autosave: Autosave;

  const tracker = createJournalTracker(
    host,
    journal,
    () => state.open?.pdf ?? null,
    () => autosave.onContentChange(),
  );

  autosave = createAutosave({
    write: () => performSilentSave(state, handles, tracker),
    status: () => currentStatus(state, tracker),
    reportFailure: onAutosaveFailure,
  });

  return {
    async present(loaded) {
      // A pending write was built for the document being replaced. Letting it
      // fire after the swap would write a document the user has only just
      // opened and never edited -- the same class of bug as saving one book's
      // bytes into another book's file.
      autosave.cancel();
      try {
        await performPresent(state, { host, bridge, tracker }, loaded);
        // A fresh document gets autosave back even if the previous one turned
        // it off after a failed write.
        autosave.rearm();
      } finally {
        autosave.publish();
      }
    },
    async save() {
      // performSave takes the in-flight latch before its first await, so the
      // readout can say Saving without waiting for the write to get going.
      const running = performSave(state, handles, tracker);
      autosave.publish();
      try {
        return await running;
      } finally {
        autosave.publish();
      }
    },
    currentOrigin: () => state.open?.loaded.origin ?? null,
    currentFileName: () => state.open?.loaded.fileName ?? null,
    currentPdf: () => state.open?.pdf ?? null,
    isDirty: () => tracker.isDirty(),
    // Derived rather than stored, so an open in flight cannot leave a stale
    // assessment visible and a failed one has nothing to roll back.
    capabilities: () =>
      state.opening ? OPENING_CAPABILITIES : (state.open?.capabilities ?? DEFAULT_CAPABILITIES),
    saveStatus: autosave,
  };
}
