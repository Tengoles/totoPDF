import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PDFDocument, PDFString, StandardFonts, rgb } from 'pdf-lib';
import { PRE_ANNOTATED_MARKER } from './constants';

const FIRST_LINE = 'A fixed point of a function is a value mapped to itself.';
const SECOND_LINE = 'Formally, c is a fixed point of f if f of c equals c.';

/** Same one-page, two-line document both fixtures are built from. */
async function buildBaseDocument(): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  page.drawText(FIRST_LINE, { x: 60, y: 700, size: 14, font, color: rgb(0, 0, 0) });
  page.drawText(SECOND_LINE, { x: 60, y: 670, size: 14, font, color: rgb(0, 0, 0) });
  return doc;
}

async function generateText(): Promise<void> {
  const doc = await buildBaseDocument();
  const bytes = await doc.save();
  await writeFile(resolve(import.meta.dirname, 'text.pdf'), bytes);
}

/**
 * A fixture with an annotation pdf-lib created directly, never touched by
 * totoPDF. This is what assertion 3 needs: proof that saving a highlight
 * does not drop an annotation that was already in the file. Placed near the
 * bottom of the page, away from the first line of text the e2e spec drags
 * over to create its own highlight.
 */
async function generatePreAnnotated(): Promise<void> {
  const doc = await buildBaseDocument();
  const page = doc.getPage(0);
  const annotation = doc.context.obj({
    Type: 'Annot',
    Subtype: 'Text',
    Rect: [500, 40, 520, 60],
    Contents: PDFString.of(PRE_ANNOTATED_MARKER),
    NM: PDFString.of(PRE_ANNOTATED_MARKER),
    C: [1, 1, 0],
    Open: false,
  });
  page.node.addAnnot(doc.context.register(annotation));
  const bytes = await doc.save();
  await writeFile(resolve(import.meta.dirname, 'pre-annotated.pdf'), bytes);
}

async function main(): Promise<void> {
  await generateText();
  await generatePreAnnotated();
}

void main();
