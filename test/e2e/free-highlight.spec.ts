import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { type BrowserContext, type Page, expect, test } from '@playwright/test';
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import { launchExtension } from './extension-context';

const NO_TEXT_FIXTURE = resolve('test/fixtures/no-text.pdf');

interface E2eWindow {
  __totopdfOpen(bytes: number[]): Promise<void>;
  __totopdfSaveBytes(): Promise<number[]>;
}

let context: BrowserContext;
let extensionId: string;

test.beforeAll(async () => {
  ({ context, extensionId } = await launchExtension('totopdf-free-e2e-'));
});

test.afterAll(async () => {
  await context.close();
});

/**
 * Deliberately not round-trip.spec.ts's openFixture, which waits for
 * '.textLayer span'. A page with no text has no spans and never would --
 * waiting for one is what this whole spec is about not needing. The text
 * layer div itself is still built for every page, and it is the element
 * pdf.js starts a free highlight from.
 */
async function openNoTextFixture(page: Page): Promise<void> {
  await page.goto(`chrome-extension://${extensionId}/viewer.html?e2e=1`);
  await page.waitForFunction(() => '__totopdfOpen' in window);
  const bytes = Array.from(await readFile(NO_TEXT_FIXTURE));
  await page.evaluate((b) => (window as unknown as E2eWindow).__totopdfOpen(b), bytes);
  await page.waitForSelector('.textLayer');
}

/** Drags a stroke across the middle of the page, the way a user marks a scan. */
async function drawHighlight(page: Page): Promise<void> {
  const box = await page.locator('.textLayer').first().boundingBox();
  if (!box) {
    throw new Error('No text layer to draw on');
  }
  const y = box.y + box.height / 3;
  await page.mouse.move(box.x + box.width * 0.2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, y, { steps: 20 });
  await page.mouse.up();
  // Same asynchronous commit as a text highlight; see round-trip.spec.ts.
  await page.waitForTimeout(1200);
}

/** Reopens bytes totoPDF just produced, as a person reopening the saved file would. */
async function reopen(page: Page, bytes: Uint8Array): Promise<void> {
  await page.evaluate(
    (b) => (window as unknown as E2eWindow).__totopdfOpen(b),
    Array.from(bytes) as number[],
  );
  await page.waitForSelector('.textLayer');
}

async function saveBytes(page: Page): Promise<Uint8Array> {
  const saved = await page.evaluate(() => (window as unknown as E2eWindow).__totopdfSaveBytes());
  return Uint8Array.from(saved);
}

function pageAnnotations(parsed: PDFDocument, pageIndex: number): PDFDict[] {
  const array = parsed.getPage(pageIndex).node.Annots();
  if (!array) {
    return [];
  }
  return array.asArray().map((entry) => parsed.context.lookup(entry, PDFDict));
}

test('the highlight tool is offered on a document with no text layer', async () => {
  const page = await context.newPage();
  await openNoTextFixture(page);

  const highlight = page.getByRole('button', { name: 'Highlight' });
  await expect(highlight).toBeEnabled();
  // "Highlight selected text" would be a lie on a page that has none.
  await expect(highlight).toHaveAttribute(
    'title',
    'Drag across the page to draw a highlight. Keys 1-5 change colour.',
  );
  await expect(page.locator('.banner')).toHaveText(
    'This PDF has no selectable text. Hold and drag across the page to draw a highlight.',
  );

  await page.close();
});

test('a drawn highlight on a text-less page is written into the file', async () => {
  const page = await context.newPage();
  const original = await readFile(NO_TEXT_FIXTURE);

  await openNoTextFixture(page);
  await page.getByRole('button', { name: 'Highlight' }).click();
  await drawHighlight(page);

  await expect(page.locator('.highlightEditor')).toHaveCount(1);

  const saved = await saveBytes(page);

  // The invariant the whole project rests on: the original bytes survive.
  expect(saved.length).toBeGreaterThan(original.length);
  expect(Buffer.from(saved.subarray(0, original.length))).toEqual(Buffer.from(original));

  // Read back by pdf-lib, not pdf.js, so a bug in the renderer cannot mask a
  // bug in what was written.
  //
  // Not a /Highlight, and that is correct rather than a compromise: a
  // /Highlight carries QuadPoints, which are the corners of the *words* it
  // covers, and a scanned page has no words to quote. pdf.js writes the
  // drag-to-draw kind the way the spec provides for -- an /Ink annotation
  // whose intent says it is a highlighter stroke -- and gives it an /AP
  // appearance stream, which is what any other reader needs to render it.
  const parsed = await PDFDocument.load(saved);
  const ink = pageAnnotations(parsed, 0).find(
    (dict) => dict.get(PDFName.of('Subtype'))?.toString() === '/Ink',
  );
  expect(ink, 'no /Ink annotation in the saved output').toBeDefined();
  expect(ink?.get(PDFName.of('IT'))?.toString()).toBe('/InkHighlight');
  expect(ink?.get(PDFName.of('InkList'))).toBeDefined();
  expect(ink?.get(PDFName.of('AP'))).toBeDefined();

  await page.close();
});

/**
 * The rail reads saved annotations back through a different path from the one
 * that lists this session's edits, and that path keys off the annotation
 * subtype. A free highlight arrives there as /Ink rather than /Highlight, so
 * without the intent check in persistedKind a reopened scan looks like it lost
 * every highlight in it. Reopening the saved bytes is the only way to see it.
 */
test('a drawn highlight is still listed after the saved file is reopened', async () => {
  const page = await context.newPage();

  await openNoTextFixture(page);
  await page.getByRole('button', { name: 'Highlight' }).click();
  await drawHighlight(page);
  await expect(page.locator('#annotation-rail li')).toHaveCount(1);

  const saved = await saveBytes(page);
  await reopen(page, saved);

  await expect(page.locator('#annotation-rail li')).toHaveCount(1);
  await expect(page.locator('#annotation-rail li')).toContainText('p.1');

  await page.close();
});
