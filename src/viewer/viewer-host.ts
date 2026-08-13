import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { EventBus, PDFLinkService, PDFViewer } from 'pdfjs-dist/web/pdf_viewer.mjs';
// Required, not optional. pdf.js sizes each page with var(--total-scale-factor),
// which this stylesheet defines. Without it every page computes to zero width and
// no canvas is ever rasterized -- the viewer looks blank with no error.
import 'pdfjs-dist/web/pdf_viewer.css';
import { MAX_CANVAS_DIM, MAX_CANVAS_PIXELS } from './canvas-budget';

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.mjs');

export interface ViewerHost {
  eventBus: EventBus;
  viewer: PDFViewer;
  linkService: PDFLinkService;
  open(bytes: Uint8Array): Promise<PDFDocumentProxy>;
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

  eventBus.on('pagesinit', () => {
    viewer.currentScaleValue = 'page-width';
  });

  async function open(bytes: Uint8Array): Promise<PDFDocumentProxy> {
    // getDocument transfers bytes.buffer to the worker; bytes is detached after this.
    const doc = await pdfjsLib.getDocument({
      data: bytes,
      cMapUrl: chrome.runtime.getURL('cmaps/'),
      cMapPacked: true,
      standardFontDataUrl: chrome.runtime.getURL('standard_fonts/'),
      wasmUrl: chrome.runtime.getURL('wasm/'),
    }).promise;

    viewer.setDocument(doc);
    linkService.setDocument(doc, null);
    return doc;
  }

  return { eventBus, viewer, linkService, open };
}
