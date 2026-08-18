import type { PDFDocumentProxy } from 'pdfjs-dist';
import { t } from './i18n';

/**
 * How the highlight tool behaves on a given document, which is not the same
 * question as whether it is available -- it always is. 'text' anchors to the
 * words under the pointer; 'free' paints the region the pointer is dragged
 * across, which is the only thing a scanned page can offer.
 */
export type HighlightMode = 'text' | 'free';

export interface Capabilities {
  canSave: boolean;
  highlightMode: HighlightMode;
  reasons: string[];
}

export interface DocumentFacts {
  encryptFilterName: string | null;
  firstPageHasText: boolean;
}

export const ENCRYPTED_REASON = t('capabilityEncrypted');

const NO_TEXT_REASON = t('capabilityNoText');

/**
 * Saving an encrypted document would require encrypting the appended objects
 * too. Rather than risk writing a corrupt file, totoPDF opens it read-only.
 *
 * A missing text layer is not a refusal. pdf.js paints a free-form highlight
 * wherever the pointer is dragged across the (empty) text layer, so a scanned
 * page is highlightable -- by region rather than by word. The reason it pushes
 * is therefore an instruction, not an apology, and it is shown as a notice.
 */
export function assessDocument(facts: DocumentFacts): Capabilities {
  const reasons: string[] = [];

  const canSave = facts.encryptFilterName === null;
  if (!canSave) {
    reasons.push(ENCRYPTED_REASON);
  }

  const highlightMode: HighlightMode = facts.firstPageHasText ? 'text' : 'free';
  if (highlightMode === 'free') {
    reasons.push(NO_TEXT_REASON);
  }

  return { canSave, highlightMode, reasons };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * pdf.js types `getMetadata()`'s `info` as a bare `Object`, but the real
 * shape produced by the worker (verified against pdfjs-dist@6.2.108,
 * src/core/document.js -- `EncryptFilterName: xref.encrypt?.filterName ??
 * null`) always carries this field. Read it defensively with a type guard
 * instead of asserting the type, since nothing here can trust the shape.
 */
function readEncryptFilterName(info: unknown): string | null {
  if (!isRecord(info)) {
    return null;
  }
  const value = info.EncryptFilterName;
  return typeof value === 'string' ? value : null;
}

/**
 * Reads the two facts `assessDocument` needs directly off a document pdf.js
 * has already opened: whether it is encrypted, and whether its first page
 * has any text an editor could anchor a highlight to.
 *
 * Only page 1 is sampled, so a scanned cover on an otherwise text book reports
 * 'free'. That costs a hint that is more cautious than it needs to be; text
 * selection still works on the pages that have text.
 */
export async function assessPdfDocument(pdfDocument: PDFDocumentProxy): Promise<Capabilities> {
  const { info } = await pdfDocument.getMetadata();
  const page = await pdfDocument.getPage(1);
  const textContent = await page.getTextContent();
  return assessDocument({
    encryptFilterName: readEncryptFilterName(info),
    firstPageHasText: textContent.items.length > 0,
  });
}
