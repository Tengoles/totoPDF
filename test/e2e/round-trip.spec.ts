import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { type BrowserContext, type Page, expect, test } from '@playwright/test';
import { PDFDict, PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { PRE_ANNOTATED_MARKER } from '../fixtures/constants';
import { launchExtension } from './extension-context';

const TEXT_FIXTURE = resolve('test/fixtures/text.pdf');
const PRE_ANNOTATED_FIXTURE = resolve('test/fixtures/pre-annotated.pdf');

// The File System Access picker cannot be driven by Playwright, so the
// viewer exposes these two hooks when the URL contains e2e=1. A type
// assertion here is the one place BINDING PROJECT CONSTRAINTS allows it:
// window has no static type for test-only hooks.
interface E2eWindow {
  __totopdfOpen(bytes: number[]): Promise<void>;
  __totopdfSaveBytes(): Promise<number[]>;
}

let context: BrowserContext;
let extensionId: string;

test.beforeAll(async () => {
  ({ context, extensionId } = await launchExtension('totopdf-e2e-'));
});

test.afterAll(async () => {
  await context.close();
});

/** Opens a fixture through the same loadFromFile path a dropped file takes. */
async function openFixture(page: Page, fixturePath: string): Promise<void> {
  await page.goto(`chrome-extension://${extensionId}/viewer.html?e2e=1`);
  await page.waitForFunction(() => '__totopdfOpen' in window);
  const bytes = Array.from(await readFile(fixturePath));
  await page.evaluate((b) => (window as unknown as E2eWindow).__totopdfOpen(b), bytes);
  await page.waitForSelector('.textLayer span');
}

/** Arms the highlight tool and drags across the first text-layer span. */
async function addHighlight(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Highlight' }).click();
  const box = await page.locator('.textLayer span').first().boundingBox();
  if (!box) {
    throw new Error('No text layer span to select');
  }
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, { steps: 15 });
  await page.mouse.up();
  // The editor commits asynchronously after pointerup; 1200ms is the
  // known-good margin measured by hand.
  await page.waitForTimeout(1200);
  await expect(page.locator('.highlightEditor')).toHaveCount(1);
}

async function saveBytes(page: Page): Promise<Uint8Array> {
  const saved = await page.evaluate(() => (window as unknown as E2eWindow).__totopdfSaveBytes());
  return Uint8Array.from(saved);
}

/** Assertion 1: the PDF incremental-update invariant. */
function assertIncrementalPrefix(original: Uint8Array, saved: Uint8Array): void {
  expect(saved.length).toBeGreaterThan(original.length);
  expect(Buffer.from(saved.subarray(0, original.length))).toEqual(Buffer.from(original));
}

function pageAnnotations(parsed: PDFDocument, pageIndex: number): PDFDict[] {
  const array = parsed.getPage(pageIndex).node.Annots();
  if (!array) {
    return [];
  }
  return array.asArray().map((entry) => parsed.context.lookup(entry, PDFDict));
}

function subtypeOf(dict: PDFDict): string | undefined {
  return dict.get(PDFName.of('Subtype'))?.toString();
}

/** Assertion 2: pdf-lib -- not pdf.js -- sees a real Highlight with an appearance stream. */
function findHighlight(annotations: PDFDict[]): PDFDict {
  const highlight = annotations.find((dict) => subtypeOf(dict) === '/Highlight');
  if (!highlight) {
    throw new Error('No /Highlight annotation found in saved output');
  }
  expect(highlight.get(PDFName.of('QuadPoints'))).toBeDefined();
  expect(highlight.get(PDFName.of('AP'))).toBeDefined();
  return highlight;
}

function hasMarkedAnnotation(annotations: PDFDict[]): boolean {
  return annotations.some(
    (dict) => dict.lookupMaybe(PDFName.of('NM'), PDFString)?.asString() === PRE_ANNOTATED_MARKER,
  );
}

test('a highlight survives into the file and is readable by pdf-lib', async () => {
  const page = await context.newPage();
  const original = await readFile(TEXT_FIXTURE);

  await openFixture(page, TEXT_FIXTURE);
  await addHighlight(page);
  const saved = await saveBytes(page);

  assertIncrementalPrefix(original, saved);

  const parsed = await PDFDocument.load(saved);
  findHighlight(pageAnnotations(parsed, 0));

  await page.close();
});

test('an annotation already in the fixture survives alongside a new highlight', async () => {
  const page = await context.newPage();
  const original = await readFile(PRE_ANNOTATED_FIXTURE);

  // The fixture must actually carry a pre-existing annotation before totoPDF
  // touches it, or this test would prove nothing about assertion 3.
  const beforeParsed = await PDFDocument.load(original);
  expect(hasMarkedAnnotation(pageAnnotations(beforeParsed, 0))).toBe(true);

  await openFixture(page, PRE_ANNOTATED_FIXTURE);
  await addHighlight(page);
  const saved = await saveBytes(page);

  assertIncrementalPrefix(original, saved);

  const parsed = await PDFDocument.load(saved);
  const annotations = pageAnnotations(parsed, 0);
  findHighlight(annotations);

  // Assertion 3: the annotation already present in the fixture is still there.
  expect(hasMarkedAnnotation(annotations)).toBe(true);

  await page.close();
});
