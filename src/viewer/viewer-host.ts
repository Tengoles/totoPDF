import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist';
import { EventBus, PDFLinkService, PDFViewer } from 'pdfjs-dist/web/pdf_viewer.mjs';
// Required, not optional. pdf.js sizes each page with var(--total-scale-factor),
// which this stylesheet defines. Without it every page computes to zero width and
// no canvas is ever rasterized -- the viewer looks blank with no error.
import 'pdfjs-dist/web/pdf_viewer.css';
import { DEFAULT_SCALE_VALUE, type ZoomController, type ZoomState } from '../ui/zoom';
import { MAX_CANVAS_DIM, MAX_CANVAS_PIXELS } from './canvas-budget';

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.mjs');

export interface ViewerHost {
  eventBus: EventBus;
  viewer: PDFViewer;
  linkService: PDFLinkService;
  zoom: ZoomController;
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
    open,
    // Terminates the workers of every document opened before the current one.
    // A no-op when there is nothing to release.
    releasePreviousDocument: () => tasks.releasePrevious(),
  };
}
