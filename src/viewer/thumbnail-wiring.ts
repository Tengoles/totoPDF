import type { PDFDocumentProxy } from 'pdfjs-dist';
import { createThumbnailRail, THUMBNAIL_WIDTH } from '../ui/thumbnail-rail';
import type { ViewerHost } from './viewer-host';

/**
 * The thumbnail rail owns an IntersectionObserver and a set of canvases tied
 * to one specific PDFDocumentProxy. Opening a second document without
 * tearing the old rail down first would leave that observer running forever
 * and leak every canvas it still held, so each call here destroys whatever
 * rail exists -- including when no document is open yet, so a load failure
 * cannot leave a stale rail pointing at a document that is no longer current.
 *
 * Returns a function meant to run alongside every chrome re-render: once at
 * startup with no document, and again after every successful open.
 */
export function createThumbnailWiring(
  host: ViewerHost,
): (pdfDocument: PDFDocumentProxy | null) => void {
  const root = document.querySelector<HTMLElement>('#thumbnail-rail');
  let rail: { destroy(): void } | null = null;

  return function present(pdfDocument) {
    rail?.destroy();
    rail = null;
    if (!root || !pdfDocument) {
      return;
    }
    rail = createThumbnailRail(root, {
      pageCount: pdfDocument.numPages,
      onSelect: (pageNumber) => {
        host.viewer.currentPageNumber = pageNumber;
      },
      async renderPage(pageNumber, canvas) {
        const page = await pdfDocument.getPage(pageNumber);
        const unscaled = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: THUMBNAIL_WIDTH / unscaled.width });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        // `canvas` alone is enough: pdf.js derives its own 2D context from
        // it internally and ignores a separately supplied canvasContext
        // whenever canvas is non-null (verified against pdfjs-dist 6.2.108's
        // RenderParameters type and InternalRenderTask implementation).
        await page.render({ canvas, viewport }).promise;
      },
    });
  };
}
