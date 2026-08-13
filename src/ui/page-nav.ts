/**
 * The page-navigation logic that does not need a browser: what a typed page
 * entry means, and the contract the control reads the position back through.
 * No DOM and no pdf.js import, so all of it is unit-testable under vitest's
 * node environment. The control itself is in page-nav-control.ts, the same
 * split zoom.ts and zoom-control.ts already use.
 */

export interface PageState {
  /** pdf.js's currentPageNumber: 1-based, and 1 before any document is open. */
  pageNumber: number;
  /** pdf.js's pagesCount: 0 until a document's page views exist. */
  pageCount: number;
}

/**
 * Where the document is and how to move it, as much of it as the toolbar and
 * the thumbnail rail need. Implemented over pdf.js in viewer-host.ts; declared
 * here so both controls can be built without pulling PDFViewer in.
 */
export interface PageController {
  state(): PageState;
  /** Sets pdf.js's currentPageNumber, which scrolls that page into view. */
  goTo(pageNumber: number): void;
  /**
   * Reports every page change until the signal aborts. The state is read back
   * off the viewer each time rather than taken from the event, so a listener
   * cannot drift from what the viewer actually shows.
   */
  subscribe(listener: (state: PageState) => void, signal: AbortSignal): void;
}

/**
 * A page number the viewer will accept, or null for "reject and revert".
 *
 * Null rather than a clamp: clamping 999 to 20 would scroll the reader to a
 * page they never asked for, and clamping while a second digit is still coming
 * would rewrite the entry mid-type. Null rather than a throw: a typo in a text
 * box is ordinary, not an error condition.
 *
 * The regexp does the whole job of rejecting decimals, signs, exponents,
 * hex and stray text, which matters because pdf.js throws "Invalid page
 * number." on a non-integer currentPageNumber. \d is ASCII-only in JavaScript,
 * so digits from other scripts are rejected too -- Number() would have
 * accepted some of them and produced a page the user did not type.
 */
export function parsePageInput(raw: string, pageCount: number): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const pageNumber = Number(trimmed);
  if (pageNumber < 1 || pageNumber > pageCount) {
    return null;
  }
  return pageNumber;
}

/** The count beside the box. Says what the number is, not just a bare total. */
export function formatPageTotal(pageCount: number): string {
  return `of ${pageCount}`;
}
