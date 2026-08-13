import '../ui/styles.css';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { createAnnotationBridge, type AnnotationBridge } from '../core/annotation-bridge';
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
import { buildSavedBytes } from '../core/save-pipeline';
import { loadSettings, paletteToHighlightColors } from '../core/settings';
import { renderToolbar } from '../ui/toolbar';
import { createViewerHost, type ViewerHost } from './viewer-host';

interface DocumentController {
  present(loaded: LoadedDocument): Promise<void>;
  save(): Promise<void>;
  currentOrigin(): DocumentOrigin | null;
  currentPdf(): PDFDocumentProxy | null;
}

/**
 * Owns the mutable "what's open right now" state so main() stays a plain
 * sequence of setup calls instead of a closure holding pdfDocument/current.
 */
function createDocumentController(
  host: ViewerHost,
  bridge: AnnotationBridge,
  handles: HandleStore,
): DocumentController {
  let pdfDocument: PDFDocumentProxy | null = null;
  let current: LoadedDocument | null = null;

  async function resolveHandle(identity: string, suggestedName: string) {
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

  async function save(): Promise<void> {
    if (!pdfDocument || !current) {
      return;
    }
    const { bytes } = await buildSavedBytes(pdfDocument);
    const handle = await resolveHandle(current.identity, current.fileName);
    const outcome = await writeBytes(handle, bytes);
    if (outcome.kind === 'permission-denied') {
      await handles.remove(current.identity);
      throw new Error('Write permission was denied. Choose the file again to save.');
    }
  }

  async function present(loaded: LoadedDocument): Promise<void> {
    current = loaded;
    pdfDocument = await host.open(loaded.bytes);
    // PDFViewer's annotationEditorMode setter no-ops with no document loaded,
    // so a tool armed before the document opened must be re-applied now.
    bridge.reapply();
  }

  return {
    present,
    save,
    currentOrigin: () => current?.origin ?? null,
    currentPdf: () => pdfDocument,
  };
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
  const controller = createDocumentController(host, bridge, handles);

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

  const origin = parseViewerQuery(location.search);
  if (origin) {
    await controller.present(await loadFromOrigin(origin));
  }
}

void main();
