import '../ui/styles.css';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { createAnnotationBridge, type AnnotationBridge } from '../core/annotation-bridge';
import { buildRailItems } from '../core/annotation-index';
import { createEditorHost } from './editor-host';
import {
  type DocumentOrigin,
  type LoadedDocument,
  loadFromFile,
  loadFromOrigin,
  parseViewerQuery,
} from '../core/document-source';
import { type HandleStore, openHandleStore } from '../core/file-handles';
import { writeBytes } from '../core/file-writer';
import { createDebouncedRecorder, type Journal, openJournal } from '../core/recovery-journal';
import { buildSavedBytes } from '../core/save-pipeline';
import { loadSettings, paletteToHighlightColors } from '../core/settings';
import { renderAnnotationRail } from '../ui/annotation-rail';
import { renderToolbar } from '../ui/toolbar';
import { createViewerHost, type ViewerHost } from './viewer-host';

interface DocumentController {
  present(loaded: LoadedDocument): Promise<void>;
  save(): Promise<void>;
  currentOrigin(): DocumentOrigin | null;
  currentPdf(): PDFDocumentProxy | null;
  isDirty(): boolean;
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
function createDocumentController(
  host: ViewerHost,
  bridge: AnnotationBridge,
  handles: HandleStore,
  journal: Journal,
): DocumentController {
  let pdfDocument: PDFDocumentProxy | null = null;
  let current: LoadedDocument | null = null;
  const tracker = createJournalTracker(host, journal, () => pdfDocument);

  async function save(): Promise<void> {
    if (!pdfDocument || !current) {
      return;
    }
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
  }

  return {
    present,
    save,
    currentOrigin: () => current?.origin ?? null,
    currentPdf: () => pdfDocument,
    isDirty: () => tracker.isDirty(),
  };
}

/**
 * A crash or an accidental tab close should not silently lose unsaved
 * annotations. Warn before the tab unloads while the journal is the only
 * copy of them left.
 */
function setupUnloadGuard(controller: DocumentController): void {
  window.addEventListener('beforeunload', (event) => {
    if (controller.isDirty()) {
      event.preventDefault();
    }
  });
}

/** A dropped file has no navigable URL, so there is nothing for Chrome to open. */
function openInChrome(origin: DocumentOrigin | null): void {
  if (!origin || origin.kind === 'dropped') {
    return;
  }
  void chrome.runtime.sendMessage({ type: 'open-native', url: origin.url }).then(() => {
    location.href = origin.url;
  });
}

/**
 * Refreshes the right-hand annotation rail whenever an editor's state
 * changes, so a highlight or text box appears in the list as soon as it is
 * created without waiting for a save. The brief and the journal tracker both
 * reference an "annotationeditorstateschanged" event, but that name is
 * dispatched nowhere in pdfjs-dist@6.2.108 (confirmed empirically -- see
 * task-15-report.md); the real event carrying this signal is
 * "editingstateschanged". This is its own subscription, independent of the
 * journal tracker's (deliberately left untouched, event-name mismatch and
 * all -- fixing it is outside this task).
 */
function setupAnnotationRail(host: ViewerHost, controller: DocumentController): void {
  const root = document.querySelector<HTMLElement>('#annotation-rail');
  if (!root) {
    return;
  }

  const refresh = (): void => {
    const storage = controller.currentPdf()?.annotationStorage.serializable ?? null;
    renderAnnotationRail(root, buildRailItems(storage), (item) => {
      host.viewer.currentPageNumber = item.pageNumber;
    });
  };

  host.eventBus.on('editingstateschanged', refresh);
  refresh();
}

// Drag-and-drop is the third document source.
function setupDragAndDrop(controller: DocumentController): void {
  document.addEventListener('dragover', (event) => event.preventDefault());
  document.addEventListener('drop', (event) => {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file) {
      void loadFromFile(file).then((loaded) => controller.present(loaded));
    }
  });
}

// Test hooks, never present in normal use. Both e2e specs load with ?e2e=1.
function setupE2eHooks(host: ViewerHost, controller: DocumentController): void {
  if (!new URLSearchParams(location.search).has('e2e')) {
    return;
  }
  Object.assign(window, {
    __totopdfHost: host,
    // Routes through the same path a dropped file takes, rather than calling
    // host.open directly: that is what assigns the document, computes its
    // identity and re-applies the armed tool. A hook that bypassed it would
    // exercise a path no user ever takes.
    __totopdfOpen: async (bytes: number[]): Promise<void> => {
      const file = new File([new Uint8Array(bytes)], 'e2e.pdf', { type: 'application/pdf' });
      await controller.present(await loadFromFile(file));
    },
    __totopdfSaveBytes: async (): Promise<number[]> => {
      const pdfDocument = controller.currentPdf();
      if (!pdfDocument) {
        throw new Error('No document open');
      }
      const { bytes } = await buildSavedBytes(pdfDocument);
      return Array.from(bytes);
    },
  });
}

async function main(): Promise<void> {
  const toolbarRoot = document.querySelector<HTMLElement>('#toolbar');
  const container = document.querySelector<HTMLDivElement>('#viewer-container');
  const viewerDiv = document.querySelector<HTMLDivElement>('#viewer-inner');
  if (!toolbarRoot || !container || !viewerDiv) {
    return;
  }

  const settings = await loadSettings(chrome.storage.local);
  const host = createViewerHost(container, viewerDiv, paletteToHighlightColors(settings.palette));
  const bridge = createAnnotationBridge(
    createEditorHost(host.viewer, host.eventBus),
    settings.palette,
    { color: settings.freeTextColor, size: settings.freeTextSize },
  );
  const handles = await openHandleStore();
  const journal = await openJournal();
  const controller = createDocumentController(host, bridge, handles, journal);

  renderToolbar(toolbarRoot, {
    palette: settings.palette,
    bridge,
    canHighlight: true,
    canSave: true,
    onSave: () => void controller.save(),
    onOpenInChrome: () => openInChrome(controller.currentOrigin()),
  });

  setupDragAndDrop(controller);
  setupE2eHooks(host, controller);
  setupUnloadGuard(controller);
  setupAnnotationRail(host, controller);

  const origin = parseViewerQuery(location.search);
  if (origin) {
    await controller.present(await loadFromOrigin(origin));
  }
}

void main();
