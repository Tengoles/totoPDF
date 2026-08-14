import { chromium } from '@playwright/test';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXTENSION_PATH = resolve(ROOT, 'dist');
const OUT_DIR = resolve(ROOT, 'docs/store/screenshots');
const TEXT_FIXTURE = resolve(ROOT, 'test/fixtures/text.pdf');
const LARGE_FIXTURE = resolve(ROOT, 'test/fixtures/large.pdf');
// The store rejects anything but exactly this size.
const VIEWPORT = { width: 1280, height: 800 };

/**
 * Same launch recipe as test/e2e/extension-context.ts, duplicated rather than
 * imported: that file is TypeScript, and this script runs under plain node
 * (see tools/generate-icons.mjs for the same pattern), with no loader to
 * compile a .ts import.
 */
async function launchExtension(prefix) {
  const userDataDir = await mkdtemp(join(tmpdir(), prefix));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    args: [
      '--lang=en-US',
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
  });
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const extensionId = new URL(worker.url()).host;
  return { context, extensionId };
}

/** A fresh profile auto-opens welcome.html on install; it must not end up in a shot. */
async function closeWelcomeTabs(context) {
  for (const page of context.pages()) {
    if (page.url().includes('welcome.html')) {
      await page.close();
    }
  }
}

/** Opens a fixture through the same loadFromFile path a dropped file takes (test/e2e/round-trip.spec.ts). */
async function openFixture(page, extensionId, fixturePath) {
  await page.goto(`chrome-extension://${extensionId}/viewer.html?e2e=1`);
  await page.waitForFunction(() => '__totopdfOpen' in window);
  const bytes = Array.from(await readFile(fixturePath));
  await page.evaluate((b) => window.__totopdfOpen(b), bytes);
  await page.waitForSelector('.textLayer span');
}

/**
 * Arms the given palette swatch (which also arms the highlight tool, see
 * src/ui/palette.ts createHighlightControls#onPick) and drags across the
 * given text-layer span, the same technique as
 * test/e2e/round-trip.spec.ts#addHighlight.
 */
async function addHighlight(page, swatchIndex, spanIndex, expectedCount) {
  await page.locator('.swatch').nth(swatchIndex).click();
  const box = await page.locator('.textLayer span').nth(spanIndex).boundingBox();
  if (!box) {
    throw new Error(`No text layer span at index ${spanIndex} to select`);
  }
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, { steps: 15 });
  await page.mouse.up();
  // The editor commits asynchronously after pointerup; 1200ms is the
  // known-good margin measured by hand (test/e2e/round-trip.spec.ts).
  await page.waitForTimeout(1200);
  const count = await page.locator('.highlightEditor').count();
  if (count !== expectedCount) {
    throw new Error(`Expected ${expectedCount} highlight(s) after drag, found ${count}`);
  }
}

/**
 * Arms the text box tool, clicks the given viewport point to create a
 * pdf.js FreeTextEditor (AnnotationEditorLayer#pointerup, verified against
 * pdfjs-dist@6.2.108), types into it, then presses Escape twice: the first
 * Escape is caught by the editor's own keyboard manager and commits the
 * text (FreeTextEditor._keyboardManager, stopEvent()s so it never reaches
 * the toolbar); the second Escape, now that focus has moved off the
 * contentEditable div, reaches the toolbar's window-level handler and
 * disarms the tool (src/ui/toolbar.ts bindKeyboard).
 *
 * x/y are viewport coordinates, not a fraction of the page: fit-width's
 * bottom fold generally sits partway down a text.pdf-sized page, so
 * choosing a point off a fraction of the *whole* page (as an earlier
 * version of this script did) could land well below what is actually on
 * screen. Once created, the box is a real page-space annotation like the
 * highlights, so it reflows correctly when a later rail toggle rescales
 * the page -- it only has to be visible at the moment of creation.
 */
async function addTextBox(page, x, y, text) {
  await page.getByRole('button', { name: 'Text box' }).click();
  await page.mouse.click(x, y);
  await page.waitForTimeout(300);
  await page.keyboard.type(text);
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  const count = await page.locator('.freeTextEditor').count();
  if (count !== 1) {
    throw new Error(`Expected 1 text box after commit, found ${count}`);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

// Collapsing or reopening a rail changes #viewer-container's box, which
// re-fits the page width through a ResizeObserver + requestAnimationFrame
// (src/viewer/viewer-host.ts bindFitModeToContainerSize). Measured by hand
// (see the diagnostic trace in the Task 4 report): the fit-width scale
// applies within a frame, but the PDFPageView properties that the *next*
// resize's math depends on (currentPage.width/currentPage.scale) do not
// settle to match until roughly 2 seconds later. Toggling a second rail
// before that settles reads stale numbers and locks in the wrong scale for
// several seconds, which is exactly what produced a too-narrow page in an
// early run of this script. 2.5s clears that window with margin.
async function togglePagesRail(page) {
  await page.getByRole('button', { name: 'Pages' }).click();
  await page.waitForTimeout(2500);
}

async function toggleNotesRail(page) {
  await page.getByRole('button', { name: 'Notes' }).click();
  await page.waitForTimeout(2500);
}

/**
 * Opens the zoom preset popover (src/ui/zoom-control.ts createZoomMenu):
 * clicking the percentage/"Fit width" readout reveals a list of 50%-200%
 * presets plus Fit width, Fit page and Actual size. It is a plain
 * `hidden` attribute toggle with no CSS transition, so it is on screen the
 * instant the click handler runs; the wait below is only to let Playwright
 * finish the click and a frame render before the capture.
 */
async function openZoomMenu(page) {
  await page.locator('.zoom-readout').click();
  await page.waitForTimeout(300);
  const open = await page.locator('.zoom-popover').isVisible();
  if (!open) {
    throw new Error('Zoom popover did not open');
  }
}

async function shoot(page, filename) {
  await page.screenshot({ path: resolve(OUT_DIR, filename) });
  console.log(`wrote docs/store/screenshots/${filename}`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const { context, extensionId } = await launchExtension('totopdf-screenshots-');
  await closeWelcomeTabs(context);

  // Shots 1, 2 and 4 share one document and one page: text.pdf, with two
  // highlights in different palette colours and one text box.
  const docPage = await context.newPage();
  await docPage.setViewportSize(VIEWPORT);
  await openFixture(docPage, extensionId, TEXT_FIXTURE);
  await addHighlight(docPage, 0, 0, 1); // swatch 0 (yellow) over the first line
  await addHighlight(docPage, 1, 1, 2); // swatch 1 (green) over the second line

  // Anchored just under the second highlight's own on-screen position
  // (rather than a fraction of the whole page), so it lands in the visible,
  // still-mostly-empty part of the page instead of below the fold.
  const secondLine = await docPage.locator('.textLayer span').nth(1).boundingBox();
  if (!secondLine) {
    throw new Error('No second text layer span to anchor the text box under');
  }
  await addTextBox(
    docPage,
    secondLine.x,
    secondLine.y + secondLine.height + 30,
    'Reviewed, looks correct.',
  );

  // Both rails are open by default (no *-collapsed class on body at start).
  // Close both for a clean shot of the document itself.
  await togglePagesRail(docPage);
  await toggleNotesRail(docPage);
  await shoot(docPage, '01-viewer.png');

  // Reopen the notes rail (thumbnails stay closed) so it lists the
  // highlights and text box just created.
  await toggleNotesRail(docPage);
  await shoot(docPage, '02-notes-rail.png');

  // Back to both rails closed, matching shot 1, then open the zoom preset
  // popover so shot 4 demonstrates a real control interaction instead of
  // repeating shot 1's toolbar verbatim.
  await toggleNotesRail(docPage);
  await openZoomMenu(docPage);
  await shoot(docPage, '04-toolbar.png');

  await docPage.close();

  // Shot 3 needs more than one page to make a thumbnail rail worth showing;
  // text.pdf is single-page, so large.pdf (1000 pages, generated text) is
  // used here instead.
  const thumbsPage = await context.newPage();
  await thumbsPage.setViewportSize(VIEWPORT);
  await openFixture(thumbsPage, extensionId, LARGE_FIXTURE);
  // Thumbnails are open by default; close the notes rail so the thumbnail
  // rail and the page-number box in the toolbar are what stand out.
  await toggleNotesRail(thumbsPage);
  // Thumbnails render lazily as they scroll into view; give the first
  // batch time to paint before capturing.
  await thumbsPage.waitForTimeout(500);
  await shoot(thumbsPage, '03-thumbnails.png');
  await thumbsPage.close();

  await context.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
