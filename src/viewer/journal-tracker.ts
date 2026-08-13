import type { PDFDocumentProxy } from 'pdfjs-dist';
import { createDebouncedRecorder, type Journal } from '../core/recovery-journal';
import type { ViewerHost } from './viewer-host';

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

export interface JournalTracker {
  arm(identity: string): void;
  clearSaved(identity: string): Promise<void>;
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
    /**
     * Takes the identity that was saved rather than reading the armed one. A
     * save started before a document switch finishes after it, and marking
     * whatever is open now as clean because a different document reached disk
     * is exactly how unsaved work disappears without a prompt.
     */
    async clearSaved(savedIdentity) {
      await journal.clear(savedIdentity);
      if (identity === savedIdentity) {
        dirty = false;
      }
    },
    isDirty: () => dirty,
  };
}
