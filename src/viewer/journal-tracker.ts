import type { PDFDocumentProxy } from 'pdfjs-dist';
import { createDebouncedRecorder, type Journal } from '../core/recovery-journal';
import { onEditorChangeSettled } from './editor-change-events';
import type { ViewerHost } from './viewer-host';

type AnnotationStorage = PDFDocumentProxy['annotationStorage'];
type Serializable = AnnotationStorage['serializable'];

/**
 * `serializable.map` is a real Map instance. JSON.stringify cannot see
 * inside a Map -- it has no own enumerable properties -- so stringifying it
 * directly would silently produce "{}": the journal would look like it is
 * working while recording nothing. Spread the entries into an array first.
 */
function serializeAnnotationState(serializable: Serializable): string {
  const { map, hash } = serializable;
  return JSON.stringify({ hash, entries: map ? [...map] : [] });
}

/**
 * A digest of everything the user has actually edited. pdf.js serializes an
 * existing annotation the user has not touched to null and leaves it out, so
 * merely opening an already-annotated file does not move this, and neither
 * does selecting, deselecting or scrolling. Only content does.
 */
export function contentHash(pdf: PDFDocumentProxy | null): string {
  return pdf?.annotationStorage.serializable.hash ?? '';
}

export interface JournalTracker {
  arm(identity: string): void;
  /**
   * `savedHash` is the annotation hash the written bytes were built from, not
   * the hash now. A highlight made while a large book was serializing did not
   * reach the file, and reporting it as saved would drop it from the tab-close
   * warning.
   */
  clearSaved(identity: string, savedHash: string): Promise<void>;
  isDirty(): boolean;
}

/**
 * Mirrors annotation-editor activity into the crash-recovery journal and
 * tracks whether the open document has unsaved edits. The journal is a crash
 * buffer, not a second source of truth -- it is re-armed with a fresh
 * identity each time a document opens, and a successful save clears it.
 */
export function createJournalTracker(
  host: ViewerHost,
  journal: Journal,
  currentPdf: () => PDFDocumentProxy | null,
  /** Called only for changes that altered the document, never for selections. */
  onContentChange: () => void,
): JournalTracker {
  let dirty = false;
  /** What the file on disk holds, as a hash. Empty is the document as opened. */
  let savedHash = '';
  let identity: string | null = null;
  let record: ((payload: string, now: number) => void) | null = null;

  // Deferred, not direct: pdf.js dispatches its editor event before the editor
  // reaches annotationStorage, so reading the hash synchronously misses the
  // edit that event was about. See onEditorChangeSettled.
  onEditorChangeSettled(host, () => {
    const pdf = currentPdf();
    if (!pdf || !record) {
      return;
    }
    const serializable = pdf.annotationStorage.serializable;
    // "Selected" is in that list, and selecting a highlight already on the
    // page changes nothing about the document. Comparing the hash against what
    // the file holds is what tells an edit from a click: without it a click
    // raised the tab-close warning over nothing, and would now also spend a
    // write appending a revision byte-identical to the one already saved.
    // Undoing back to the saved state lands here too, and correctly reports
    // the document clean again.
    dirty = serializable.hash !== savedHash;
    if (!dirty) {
      return;
    }
    record(serializeAnnotationState(serializable), Date.now());
    onContentChange();
  });

  return {
    arm(nextIdentity) {
      identity = nextIdentity;
      dirty = false;
      // A document just opened matches the file it came from by definition.
      savedHash = contentHash(currentPdf());
      record = createDebouncedRecorder(journal, nextIdentity, 1000);
    },
    /**
     * Takes the identity that was saved rather than reading the armed one. A
     * save started before a document switch finishes after it, and marking
     * whatever is open now as clean because a different document reached disk
     * is exactly how unsaved work disappears without a prompt.
     */
    async clearSaved(savedIdentity, hash) {
      await journal.clear(savedIdentity);
      if (identity === savedIdentity) {
        savedHash = hash;
        dirty = contentHash(currentPdf()) !== hash;
      }
    },
    isDirty: () => dirty,
  };
}
