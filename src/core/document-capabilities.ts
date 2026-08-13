import type { PDFDocumentProxy } from 'pdfjs-dist';

export interface Capabilities {
  canSave: boolean;
  canHighlight: boolean;
  reasons: string[];
}

export interface DocumentFacts {
  encryptFilterName: string | null;
  firstPageHasText: boolean;
}

export const ENCRYPTED_REASON =
  'This PDF is encrypted. totoPDF can display it but cannot save changes to it.';

const NO_TEXT_REASON =
  'This PDF has no selectable text, so highlighting is unavailable. Text boxes still work.';

/**
 * Saving an encrypted document would require encrypting the appended objects
 * too. Rather than risk writing a corrupt file, totoPDF opens it read-only.
 */
export function assessDocument(facts: DocumentFacts): Capabilities {
  const reasons: string[] = [];

  const canSave = facts.encryptFilterName === null;
  if (!canSave) {
    reasons.push(ENCRYPTED_REASON);
  }

  const canHighlight = facts.firstPageHasText;
  if (!canHighlight) {
    reasons.push(NO_TEXT_REASON);
  }

  return { canSave, canHighlight, reasons };
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
