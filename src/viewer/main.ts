import '../ui/styles.css';
import type { AnnotationBridge } from '../core/annotation-bridge';
import { createAnnotationBridge } from '../core/annotation-bridge';
import { buildRailItems } from '../core/annotation-index';
import {
  type DocumentOrigin,
  type LoadedDocument,
  loadFromFile,
  loadFromOrigin,
  parseViewerQuery,
} from '../core/document-source';
import { openHandleStore } from '../core/file-handles';
import { openJournal } from '../core/recovery-journal';
import { buildSavedBytes } from '../core/save-pipeline';
import { loadSettings, paletteToHighlightColors, type Settings } from '../core/settings';
import { renderAnnotationRail } from '../ui/annotation-rail';
import { showBanner, showLoading } from '../ui/errors';
import { renderToolbar } from '../ui/toolbar';
import { createDocumentController, type DocumentController } from './document-controller';
import { createEditorHost } from './editor-host';
import { createThumbnailWiring } from './thumbnail-wiring';
import { createViewerHost, type ViewerHost } from './viewer-host';

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
 * created without waiting for a save.
 *
 * The event is "editingstateschanged". An earlier revision used
 * "annotationeditorstateschanged", which is dispatched nowhere in
 * pdfjs-dist@6.2.108 -- it recorded nothing while appearing to work. The
 * journal tracker in document-controller.ts subscribes to the same real event
 * separately.
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

/**
 * Wraps every document open: a loading banner while pdf.js parses the file,
 * a visible banner for anything the assessed capabilities rule out, and a
 * toolbar re-render so Highlight/Save reflect what was just learned. Errors
 * from the open itself (a corrupt file, a fetch failure) surface the same
 * way instead of failing silently.
 */
async function presentDocument(
  controller: DocumentController,
  renderChrome: () => void,
  loaded: LoadedDocument,
): Promise<void> {
  const dismiss = showLoading(document.body, 'Opening document');
  try {
    await controller.present(loaded);
    const capabilities = controller.capabilities();
    for (const reason of capabilities.reasons) {
      showBanner(document.body, reason, capabilities.canSave ? 'notice' : 'error');
    }
    renderChrome();
  } catch (error) {
    showBanner(document.body, error instanceof Error ? error.message : String(error), 'error');
  } finally {
    dismiss();
  }
}

/** A save failure (permission denied, encrypted document) must reach the user, not the console. */
function handleSave(controller: DocumentController): void {
  void controller.save().catch((error: unknown) => {
    showBanner(document.body, error instanceof Error ? error.message : String(error), 'error');
  });
}

/**
 * Capabilities are only known once a document has loaded, so this is called
 * again every time they change (see presentDocument), not just once at
 * startup; the first call renders the toolbar with the permissive default
 * while nothing is open yet.
 */
function renderChrome(
  toolbarRoot: HTMLElement,
  settings: Settings,
  bridge: AnnotationBridge,
  controller: DocumentController,
): void {
  const capabilities = controller.capabilities();
  renderToolbar(toolbarRoot, {
    palette: settings.palette,
    bridge,
    canHighlight: capabilities.canHighlight,
    canSave: capabilities.canSave,
    onSave: () => handleSave(controller),
    onOpenInChrome: () => openInChrome(controller.currentOrigin()),
  });
}

// Drag-and-drop is the third document source.
function setupDragAndDrop(controller: DocumentController, renderChrome: () => void): void {
  document.addEventListener('dragover', (event) => event.preventDefault());
  document.addEventListener('drop', (event) => {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file) {
      void loadFromFile(file).then((loaded) => presentDocument(controller, renderChrome, loaded));
    }
  });
}

// Test hooks, never present in normal use. Both e2e specs load with ?e2e=1.
function setupE2eHooks(
  host: ViewerHost,
  controller: DocumentController,
  renderChrome: () => void,
): void {
  if (!new URLSearchParams(location.search).has('e2e')) {
    return;
  }
  Object.assign(window, {
    __totopdfHost: host,
    // Routes through the same path a dropped file takes, rather than calling
    // host.open directly: that is what assigns the document, computes its
    // identity, assesses capabilities and re-applies the armed tool. A hook
    // that bypassed it would exercise a path no user ever takes.
    __totopdfOpen: async (bytes: number[]): Promise<void> => {
      const file = new File([new Uint8Array(bytes)], 'e2e.pdf', { type: 'application/pdf' });
      await presentDocument(controller, renderChrome, await loadFromFile(file));
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
  const presentThumbnails = createThumbnailWiring(host);

  // Thumbnails are rebuilt in lockstep with the toolbar: both reflect
  // "what document is open right now", and both must be re-run every time
  // that changes -- at startup with nothing open, and after every open.
  const renderChromeNow = (): void => {
    renderChrome(toolbarRoot, settings, bridge, controller);
    presentThumbnails(controller.currentPdf());
  };
  renderChromeNow();

  setupDragAndDrop(controller, renderChromeNow);
  setupE2eHooks(host, controller, renderChromeNow);
  setupUnloadGuard(controller);
  setupAnnotationRail(host, controller);

  const origin = parseViewerQuery(location.search);
  if (origin) {
    await presentDocument(controller, renderChromeNow, await loadFromOrigin(origin));
  }
}

void main();
