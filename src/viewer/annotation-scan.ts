import type { PDFDocumentProxy } from 'pdfjs-dist';
import { buildPersistedRailItems, type RailItem } from '../core/annotation-index';

/**
 * How many pages are asked for their annotations before the scan yields.
 *
 * The pages themselves are not the expensive part: PDFViewer.setDocument
 * already calls getPage() for every page of any document under
 * PagesCountLimit.FORCE_LAZY_PAGE_INIT (5000 in pdfjs-dist@6.2.108), so on the
 * 1000-page fixture this scan loads nothing the viewer has not already loaded,
 * and allocates no canvas at all. What is bounded here is the burst of worker
 * round-trips and the main-thread work of mapping their results, so that a
 * long book fills the rail progressively instead of stalling the frame that
 * opened it.
 */
const PAGES_PER_BATCH = 32;

export interface PersistedScan {
  /**
   * Stops the scan at the next batch boundary and guarantees no further
   * onBatch call. Required on every document switch: the outgoing document's
   * page numbers mean nothing in the incoming one.
   */
  cancel(): void;
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function readPage(pdfDocument: PDFDocumentProxy, pageNumber: number): Promise<RailItem[]> {
  try {
    const page = await pdfDocument.getPage(pageNumber);
    // Held as unknown deliberately: pdf.js types getAnnotations() loosely, and
    // buildPersistedRailItems checks every field it reads at runtime.
    const annotations: unknown = await page.getAnnotations();
    return buildPersistedRailItems(pageNumber, annotations);
  } catch {
    // Opening another document terminates this one's worker, which rejects
    // every page request still in flight. The scan is about to be cancelled
    // anyway, and nothing awaits it, so an unhandled rejection is the only
    // thing left to prevent. A genuine per-page failure costs that page's
    // annotations, not the whole rail.
    return [];
  }
}

async function scanBatches(
  pdfDocument: PDFDocumentProxy,
  onBatch: (items: RailItem[]) => void,
  isCancelled: () => boolean,
): Promise<void> {
  for (let first = 1; first <= pdfDocument.numPages; first += PAGES_PER_BATCH) {
    if (isCancelled()) {
      return;
    }
    const last = Math.min(first + PAGES_PER_BATCH - 1, pdfDocument.numPages);
    const numbers: number[] = [];
    for (let page = first; page <= last; page += 1) {
      numbers.push(page);
    }
    const found = (await Promise.all(numbers.map((page) => readPage(pdfDocument, page)))).flat();
    if (isCancelled()) {
      return;
    }
    if (found.length > 0) {
      onBatch(found);
    }
    await yieldToEventLoop();
  }
}

/**
 * Reads the annotations already saved in the document, page by page, and
 * reports each batch as it arrives. This is the half of the rail that
 * annotationStorage cannot supply: an annotation made in an earlier session
 * only enters storage once an editor mode is armed on its page, and even then
 * serializes to null until it is modified, so a book annotated yesterday
 * reports nothing at all through that route.
 *
 * Runs detached rather than awaited, so opening a document is never delayed by
 * it; batches land in page order.
 */
export function scanPersistedAnnotations(
  pdfDocument: PDFDocumentProxy,
  onBatch: (items: RailItem[]) => void,
): PersistedScan {
  let cancelled = false;
  void scanBatches(pdfDocument, onBatch, () => cancelled);
  return {
    cancel: () => {
      cancelled = true;
    },
  };
}
