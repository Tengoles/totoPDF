import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { type BrowserContext, expect, test } from '@playwright/test';
import { launchExtension } from './extension-context';

const LARGE_FIXTURE = resolve('test/fixtures/large.pdf');
const BUDGET_BYTES = 400 * 1024 * 1024;
const SCROLL_STEPS = 12;
const SCROLL_DISTANCE_PX = 4000;

// Canvas backing store lives outside the JS heap, so performance.memory would
// not measure it. This sums width * height * 4 (RGBA) across every live
// canvas -- the actual allocation the §5 budget bounds.
interface E2eWindow {
  __totopdfOpen(bytes: number[]): Promise<void>;
}

let context: BrowserContext;
let extensionId: string;

test.beforeAll(async () => {
  ({ context, extensionId } = await launchExtension('totopdf-mem-'));
});

test.afterAll(async () => {
  await context.close();
});

test('canvas memory stays within budget while scrolling a 1000-page book', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/viewer.html?e2e=1`);
  await page.waitForFunction(() => '__totopdfOpen' in window);

  const bytes = Array.from(await readFile(LARGE_FIXTURE));
  await page.evaluate(
    (data) => (window as unknown as E2eWindow).__totopdfOpen(data),
    bytes,
  );

  await page.waitForSelector('.pdfViewer canvas');

  const measure = (): Promise<number> =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll('canvas')).reduce(
        (total, canvas) => total + canvas.width * canvas.height * 4,
        0,
      ),
    );

  let peak = await measure();
  for (let step = 0; step < SCROLL_STEPS; step += 1) {
    await page.evaluate((distance) => {
      document.querySelector('#viewer-container')?.scrollBy(0, distance);
    }, SCROLL_DISTANCE_PX);
    await page.waitForTimeout(400);
    peak = Math.max(peak, await measure());
  }

  console.log(`peak canvas bytes: ${peak} (${(peak / (1024 * 1024)).toFixed(1)} MB)`);
  expect(peak).toBeLessThan(BUDGET_BYTES);

  await page.close();
});
