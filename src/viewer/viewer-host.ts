import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist';
import { EventBus, PDFLinkService, PDFViewer } from 'pdfjs-dist/web/pdf_viewer.mjs';
// Required, not optional. pdf.js sizes each page with var(--total-scale-factor),
// which this stylesheet defines. Without it every page computes to zero width and
// no canvas is ever rasterized -- the viewer looks blank with no error.
import 'pdfjs-dist/web/pdf_viewer.css';
import type { PageController, PageState } from '../ui/page-nav';
import { DEFAULT_SCALE_VALUE, type ZoomController, type ZoomState } from '../ui/zoom';
import { MAX_CANVAS_DIM, MAX_CANVAS_PIXELS } from './canvas-budget';

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.mjs');

export interface ViewerHost {
  eventBus: EventBus;
  viewer: PDFViewer;
  linkService: PDFLinkService;
  zoom: ZoomController;
  pages: PageController;
  open(bytes: Uint8Array): Promise<PDFDocumentProxy>;
  releasePreviousDocument(): Promise<void>;
}

interface TaskPool {
  adopt(task: PDFDocumentLoadingTask): void;
  releasePrevious(): Promise<void>;
}

/**
 * pdf.js gives every document its own Web Worker holding the whole file, and
 * only loadingTask.destroy() terminates it -- a task that is merely dropped
 * keeps its copy of the book alive for the rest of the session. Superseded
 * tasks are parked here rather than destroyed on the spot, because only the
 * caller knows when the replacement document has actually taken: destroying
 * the outgoing one while an open is still in flight would tear down what the
 * user is reading if that open then failed.
 */
function createTaskPool(): TaskPool {
  let currentTask: PDFDocumentLoadingTask | null = null;
  const superseded: PDFDocumentLoadingTask[] = [];

  return {
    adopt(task) {
      if (currentTask) {
        superseded.push(currentTask);
      }
      currentTask = task;
    },
    async releasePrevious() {
      const tasks = superseded.splice(0);
      await Promise.all(tasks.map((task) => task.destroy()));
    },
  };
}

async function loadDocument(
  bytes: Uint8Array,
): Promise<{ doc: PDFDocumentProxy; task: PDFDocumentLoadingTask }> {
  // getDocument transfers bytes.buffer to the worker; bytes is detached after this.
  const task = pdfjsLib.getDocument({
    data: bytes,
    cMapUrl: chrome.runtime.getURL('cmaps/'),
    cMapPacked: true,
    standardFontDataUrl: chrome.runtime.getURL('standard_fonts/'),
    wasmUrl: chrome.runtime.getURL('wasm/'),
  });
  try {
    return { doc: await task.promise, task };
  } catch (error) {
    // A rejected load has still spawned its worker and handed it the bytes.
    await task.destroy().catch(() => undefined);
    throw error;
  }
}

/**
 * Zoom is pdf.js's throughout: increaseScale/decreaseScale walk its own ladder
 * and currentScaleValue takes its own fit-mode names, so nothing here computes
 * a scale or remembers one. Every entry point is a no-op until a document is
 * loaded, which is what makes the controls safe to render before one is.
 */
function createZoom(
  viewer: PDFViewer,
  container: HTMLDivElement,
  eventBus: EventBus,
): ZoomController {
  // currentScaleValue is empty until the first document, and the opening fit is
  // what will then apply, so that is what the readout should say meanwhile.
  const state = (): ZoomState => ({
    scaleValue: viewer.currentScaleValue || DEFAULT_SCALE_VALUE,
    scale: viewer.currentScale,
  });

  return {
    state,
    zoomIn: () => viewer.increaseScale(),
    zoomOut: () => viewer.decreaseScale(),
    apply: (scaleValue) => {
      viewer.currentScaleValue = scaleValue;
    },
    reset: () => {
      viewer.currentScaleValue = DEFAULT_SCALE_VALUE;
    },
    subscribe(listener, signal) {
      if (signal.aborted) {
        return;
      }
      // EventBus has no signal support of its own, so the abort is what calls
      // off(). Without it the previous toolbar's readout would keep updating.
      const forward = (): void => listener(state());
      eventBus.on('scalechanging', forward);
      signal.addEventListener('abort', () => eventBus.off('scalechanging', forward));
    },
    bindWheel(signal) {
      container.addEventListener(
        'wheel',
        (event) => {
          if (!event.ctrlKey) {
            return;
          }
          // Chrome's default for Ctrl+wheel is to zoom the whole page --
          // toolbar, rails and all -- while the document's own scale stays put.
          // preventDefault is what stops that, and it only works because the
          // listener below is registered with passive: false.
          event.preventDefault();
          if (event.deltaY < 0) {
            viewer.increaseScale();
          } else if (event.deltaY > 0) {
            viewer.decreaseScale();
          }
        },
        { passive: false, signal },
      );
    },
  };
}

/**
 * pagechanging carries the position and fires on every scroll across a page
 * boundary. The other two carry the count: pagesCount is 0 until pdf.js has
 * built the page views, and pagesinit is dispatched the moment it has (see
 * PDFViewer.setDocument), whereas pagesloaded waits for every page in the file
 * to be fetched -- a long wait in a 1000-page book, and far too late for the
 * toolbar to be able to say "of 1000". Both are listened to: pagesinit is what
 * makes the total appear promptly, pagesloaded is the documented "pages are
 * ready" event and costs one redundant read.
 */
const PAGE_EVENTS = ['pagechanging', 'pagesinit', 'pagesloaded'] as const;

/**
 * The page position is pdf.js's throughout, exactly as the scale is: nothing
 * here counts pages or remembers which one is current. Every entry point is a
 * no-op until a document is loaded (currentPageNumber's setter returns early
 * with no pdfDocument), which is what makes the controls safe to render before
 * one is.
 */
function createPages(viewer: PDFViewer, eventBus: EventBus): PageController {
  const state = (): PageState => ({
    pageNumber: viewer.currentPageNumber,
    pageCount: viewer.pagesCount,
  });

  return {
    state,
    goTo(pageNumber) {
      // Throws on a non-integer, which is why parsePageInput rejects decimals
      // rather than rounding them.
      viewer.currentPageNumber = pageNumber;
    },
    subscribe(listener, signal) {
      if (signal.aborted) {
        return;
      }
      // EventBus has no signal support of its own, so the abort is what calls
      // off(). Without it a rebuilt toolbar's box and a destroyed thumbnail
      // rail would both keep being driven by the previous document's events.
      const forward = (): void => listener(state());
      for (const name of PAGE_EVENTS) {
        eventBus.on(name, forward);
      }
      signal.addEventListener('abort', () => {
        for (const name of PAGE_EVENTS) {
          eventBus.off(name, forward);
        }
      });
    },
  };
}

/** Scales whose resolved value depends on the container's size, so they have to be recomputed when it changes. */
const CONTAINER_RELATIVE_SCALES = new Set(['auto', 'page-width', 'page-fit']);

/**
 * A fit mode is resolved to a number once and then stays put, so "Fit width"
 * silently stops fitting the moment the window is resized or a rail is
 * collapsed. Re-assigning the same scale value is what makes pdf.js resolve it
 * again. Stock pdf.js does this in web/app.js, which this project does not
 * ship, so it is ours to do.
 *
 * 'page-actual' is deliberately absent: it means 100 percent regardless of the
 * container, so recomputing it would be pointless work.
 */
function bindFitModeToContainerSize(viewer: PDFViewer, container: HTMLDivElement): void {
  let pending = false;

  const observer = new ResizeObserver(() => {
    // ResizeObserver fires per frame while a window drag is in progress;
    // coalescing keeps one re-layout per frame instead of one per callback.
    if (pending) {
      return;
    }
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      const { currentScaleValue } = viewer;
      if (!currentScaleValue) {
        return;
      }
      if (CONTAINER_RELATIVE_SCALES.has(currentScaleValue)) {
        viewer.currentScaleValue = currentScaleValue;
      }
      viewer.update();
    });
  });

  observer.observe(container);
}

export function createViewerHost(
  container: HTMLDivElement,
  viewerDiv: HTMLDivElement,
  highlightColors: string,
): ViewerHost {
  const eventBus = new EventBus();
  const linkService = new PDFLinkService({ eventBus });

  const viewer = new PDFViewer({
    container,
    viewer: viewerDiv,
    eventBus,
    linkService,
    annotationEditorMode: 0,
    annotationEditorHighlightColors: highlightColors,
    maxCanvasPixels: MAX_CANVAS_PIXELS,
    maxCanvasDim: MAX_CANVAS_DIM,
  });
  linkService.setViewer(viewer);

  // The opening fit. Also what Ctrl+0 and the "Fit width" preset go back to.
  eventBus.on('pagesinit', () => {
    viewer.currentScaleValue = DEFAULT_SCALE_VALUE;
  });

  bindFitModeToContainerSize(viewer, container);

  const tasks = createTaskPool();

  async function open(bytes: Uint8Array): Promise<PDFDocumentProxy> {
    const { doc, task } = await loadDocument(bytes);
    tasks.adopt(task);
    viewer.setDocument(doc);
    linkService.setDocument(doc, null);
    return doc;
  }

  return {
    eventBus,
    viewer,
    linkService,
    zoom: createZoom(viewer, container, eventBus),
    pages: createPages(viewer, eventBus),
    open,
    // Terminates the workers of every document opened before the current one.
    // A no-op when there is nothing to release.
    releasePreviousDocument: () => tasks.releasePrevious(),
  };
}
