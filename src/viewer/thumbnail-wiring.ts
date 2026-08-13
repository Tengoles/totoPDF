import type { PDFDocumentProxy } from 'pdfjs-dist';
import { createThumbnailRail, THUMBNAIL_WIDTH, type ThumbnailRail } from '../ui/thumbnail-rail';
import type { ViewerHost } from './viewer-host';

/**
 * Draws one page into one thumbnail canvas at the rail's width.
 *
 * `canvas` alone is enough: pdf.js derives its own 2D context from it
 * internally and ignores a separately supplied canvasContext whenever canvas
 * is non-null (verified against pdfjs-dist 6.2.108's RenderParameters type and
 * InternalRenderTask implementation).
 */
async function renderThumbnail(
  pdfDocument: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
): Promise<void> {
  try {
    const page = await pdfDocument.getPage(pageNumber);
    const unscaled = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: THUMBNAIL_WIDTH / unscaled.width });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvas, viewport }).promise;
  } catch {
    // Opening another document terminates this one's worker, which rejects any
    // thumbnail still rendering. The rail is about to be destroyed anyway, and
    // the call site cannot await this, so an unhandled rejection is the only
    // thing left to prevent. A genuine per-page render failure costs one blank
    // thumbnail.
  }
}

/**
 * The thumbnail rail owns an IntersectionObserver and a set of canvases tied
 * to one specific PDFDocumentProxy. Opening a second document without
 * tearing the old rail down first would leave that observer running forever
 * and leak every canvas it still held, so each call here destroys whatever
 * rail exists -- including when no document is open yet, so a load failure
 * cannot leave a stale rail pointing at a document that is no longer current.
 *
 * The subscription that keeps the rail on the current page is torn down the
 * same way and at the same moment, for the same reason: a leaked one would go
 * on calling setCurrentPage on a rail whose elements are no longer in the page.
 *
 * Returns a function meant to run alongside every chrome re-render: once at
 * startup with no document, and again after every successful open.
 */
export function createThumbnailWiring(
  host: ViewerHost,
): (pdfDocument: PDFDocumentProxy | null) => void {
  const root = document.querySelector<HTMLElement>('#thumbnail-rail');
  let rail: ThumbnailRail | null = null;
  let following: AbortController | null = null;

  return function present(pdfDocument) {
    following?.abort();
    following = null;
    rail?.destroy();
    rail = null;
    if (!root || !pdfDocument) {
      return;
    }
    // Captured by value rather than read back off `rail`, so that even if the
    // abort above were ever missed, the listener could only reach the rail it
    // was created for.
    const created = createThumbnailRail(root, {
      pageCount: pdfDocument.numPages,
      onSelect: (pageNumber) => host.pages.goTo(pageNumber),
      renderPage: (pageNumber, canvas) => renderThumbnail(pdfDocument, pageNumber, canvas),
    });
    rail = created;
    following = new AbortController();
    host.pages.subscribe((state) => created.setCurrentPage(state.pageNumber), following.signal);
    // pagechanging only fires on a change, so page 1 of a freshly opened
    // document would otherwise never be marked.
    created.setCurrentPage(host.pages.state().pageNumber);
  };
}
