import '../ui/styles.css';
import type { AnnotationBridge } from '../core/annotation-bridge';
import { createAnnotationBridge } from '../core/annotation-bridge';
import {
  type DocumentOrigin,
  type FetchableOrigin,
  type LoadedDocument,
  loadFromFile,
  loadFromOrigin,
  parseViewerQuery,
} from '../core/document-source';
import { openHandleStore } from '../core/file-handles';
import { openJournal } from '../core/recovery-journal';
import { loadSettings, paletteToHighlightColors, type Settings } from '../core/settings';
import { clearBanners, showBanner, showLoading } from '../ui/errors';
import { renderToolbar } from '../ui/toolbar';
import { createAnnotationRailWiring } from './annotation-rail-wiring';
import { createDocumentController, type DocumentController } from './document-controller';
import { setupE2eHooks } from './e2e-hooks';
import { createEditorHost } from './editor-host';
import { createSettingsWiring, type SettingsWiring } from './settings-wiring';
import { createThumbnailWiring } from './thumbnail-wiring';
import { createViewerHost } from './viewer-host';

const SAVE_CONFIRMATION_MS = 5000;

const UNSAVED_SWITCH_WARNING =
  'This document has unsaved annotations, and opening another document discards them. ' +
  'Cancel, press Ctrl+S to write them into the file, then open the other document.';

const FILE_ACCESS_HINT =
  'Chrome blocks extensions from reading local files until you allow it: open ' +
  'chrome://extensions, find totoPDF, turn on "Allow access to file URLs", then reload this ' +
  'page.';

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * A first-run open of a file:// URL fails for one reason far more often than
 * any other, and the raw fetch error names none of it.
 */
function describeLoadFailure(error: unknown, origin: FetchableOrigin): string {
  return origin.kind === 'local'
    ? `${describeError(error)} ${FILE_ACCESS_HINT}`
    : describeError(error);
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

/**
 * beforeunload never fires for an in-page document switch, so it cannot cover
 * the likelier way to lose a session's work: dropping a second book onto a
 * viewer holding thirty unsaved highlights. Every entry point that replaces
 * the open document asks first.
 */
function confirmDiscardUnsaved(controller: DocumentController): boolean {
  return !controller.isDirty() || window.confirm(UNSAVED_SWITCH_WARNING);
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
  clearBanners(document.body);
  const dismiss = showLoading(document.body, 'Opening document');
  try {
    await controller.present(loaded);
    const capabilities = controller.capabilities();
    for (const reason of capabilities.reasons) {
      showBanner(document.body, reason, capabilities.canSave ? 'notice' : 'error');
    }
    renderChrome();
  } catch (error) {
    showBanner(document.body, describeError(error), 'error');
  } finally {
    dismiss();
  }
}

/**
 * A save on a large book takes long enough to look like nothing happened, and
 * its outcome is only knowable if it is shown. 'already-saving' confirms
 * nothing: no second write took place.
 */
function handleSave(controller: DocumentController): void {
  clearBanners(document.body);
  const dismiss = showLoading(document.body, 'Writing annotations into the PDF file');
  void controller
    .save()
    .then((outcome) => {
      if (outcome === 'saved') {
        const message = 'Annotations written into the PDF file.';
        showBanner(document.body, message, 'success', SAVE_CONFIRMATION_MS);
      }
    })
    .catch((error: unknown) => {
      showBanner(document.body, describeError(error), 'error');
    })
    .finally(dismiss);
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
  wiring: SettingsWiring,
): void {
  const capabilities = controller.capabilities();
  renderToolbar(toolbarRoot, {
    palette: settings.palette,
    activeColorIndex: settings.activeColorIndex,
    freeTextColor: settings.freeTextColor,
    freeTextSize: settings.freeTextSize,
    bridge,
    canHighlight: capabilities.canHighlight,
    canSave: capabilities.canSave,
    onSave: () => handleSave(controller),
    onOpenInChrome: () => openInChrome(controller.currentOrigin()),
    // Every customization the toolbar offers is persisted by these four.
    ...wiring,
  });
}

/**
 * The single way a document replaces the one already open, shared by the drop
 * handler and the e2e hook. Both used to call presentDocument directly, and
 * neither asked about unsaved annotations first; funnelling them through one
 * function is what makes that question unskippable.
 */
function createDocumentOpener(
  controller: DocumentController,
  renderChrome: () => void,
): (file: File) => Promise<void> {
  return async (file) => {
    if (!confirmDiscardUnsaved(controller)) {
      return;
    }
    await presentDocument(controller, renderChrome, await loadFromFile(file));
  };
}

// Drag-and-drop is the third document source.
function setupDragAndDrop(openFile: (file: File) => Promise<void>): void {
  document.addEventListener('dragover', (event) => event.preventDefault());
  document.addEventListener('drop', (event) => {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (!file) {
      return;
    }
    // Reading the dropped file can fail on its own, before presentDocument's
    // own error handling is ever reached.
    void openFile(file).catch((error: unknown) => {
      showBanner(document.body, describeError(error), 'error');
    });
  });
}

/**
 * loadFromOrigin used to be evaluated as an argument to presentDocument, which
 * put it outside that function's try/catch: a rejection there -- the ordinary
 * outcome of opening a file:// URL before the extension is allowed to read
 * local files -- left a blank page and an explanation only in the console.
 */
async function openInitialDocument(
  controller: DocumentController,
  renderChrome: () => void,
): Promise<void> {
  const origin = parseViewerQuery(location.search);
  if (!origin) {
    return;
  }
  let loaded: LoadedDocument;
  try {
    loaded = await loadFromOrigin(origin);
  } catch (error) {
    showBanner(document.body, describeLoadFailure(error, origin), 'error');
    return;
  }
  await presentDocument(controller, renderChrome, loaded);
}

async function start(
  toolbarRoot: HTMLElement,
  container: HTMLDivElement,
  viewerDiv: HTMLDivElement,
): Promise<void> {
  const settings = await loadSettings(chrome.storage.local);
  const host = createViewerHost(container, viewerDiv, paletteToHighlightColors(settings.palette));
  const bridge = createAnnotationBridge(
    createEditorHost(host.viewer, host.eventBus),
    settings.palette,
    { color: settings.freeTextColor, size: settings.freeTextSize },
  );
  // The stored colour index only means something once something applies it;
  // until this call the bridge always started on palette entry 0.
  bridge.setHighlightColorIndex(settings.activeColorIndex);

  // AnnotationEditorUIManager.updateParams sends a parameter to the selected
  // editor when there is one, and to the defaults for new editors only when
  // there is not. Its mode switch is async and unselects last, so the colour
  // and size the bridge arms synchronously inside setMode can arrive while the
  // editor from a moment ago is still selected -- observed as a text box drawn
  // right after a highlight coming out in pdf.js's black at size 10 instead of
  // the toolbar's settings. This event fires once the switch has finished and
  // nothing is selected, which is when arming actually holds.
  host.eventBus.on('annotationeditormodechanged', () => bridge.reapply());
  const wiring = createSettingsWiring(settings, chrome.storage.local, (error) => {
    showBanner(document.body, `Settings could not be saved. ${describeError(error)}`, 'error');
  });
  const handles = await openHandleStore();
  const journal = await openJournal();
  const controller = createDocumentController(host, bridge, handles, journal);
  const presentThumbnails = createThumbnailWiring(host);
  const refreshAnnotationRail = createAnnotationRailWiring(host, controller);

  // Toolbar, thumbnails and annotation rail all answer "what document is open
  // right now", so all three are rebuilt together: at startup with nothing
  // open, and after every open.
  const renderChromeNow = (): void => {
    renderChrome(toolbarRoot, settings, bridge, controller, wiring);
    presentThumbnails(controller.currentPdf());
    refreshAnnotationRail();
  };
  renderChromeNow();

  const openFile = createDocumentOpener(controller, renderChromeNow);
  setupDragAndDrop(openFile);
  setupE2eHooks(host, controller, openFile);
  setupUnloadGuard(controller);

  await openInitialDocument(controller, renderChromeNow);
}

async function main(): Promise<void> {
  const toolbarRoot = document.querySelector<HTMLElement>('#toolbar');
  const container = document.querySelector<HTMLDivElement>('#viewer-container');
  const viewerDiv = document.querySelector<HTMLDivElement>('#viewer-inner');
  if (!toolbarRoot || !container || !viewerDiv) {
    return;
  }
  try {
    await start(toolbarRoot, container, viewerDiv);
  } catch (error) {
    // loadSettings, openHandleStore and openJournal were all unguarded; any of
    // them failing left the page blank with the reason only in the console.
    showBanner(document.body, `totoPDF could not start. ${describeError(error)}`, 'error');
  }
}

void main();
