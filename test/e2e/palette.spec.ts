import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { type BrowserContext, type Page, expect, test } from '@playwright/test';
import { launchExtension } from './extension-context';

const TEXT_FIXTURE = resolve('test/fixtures/text.pdf');
/** Distinct from every default palette colour, so nothing here can pass by luck. */
const NEW_HEX = '#123456';
const NEW_RGB = [18, 52, 86];

// The same test-only hooks round-trip.spec.ts uses, plus the viewer host the
// serialized annotation state is read from. A type assertion here is the one
// place BINDING PROJECT CONSTRAINTS allows it: window has no static type for
// test-only hooks.
interface E2eWindow {
  __totopdfOpen(bytes: number[]): Promise<void>;
  __totopdfHost: {
    viewer: { pdfDocument: { annotationStorage: { serializable: { map: Map<string, unknown> } } } };
  };
}

let context: BrowserContext;
let extensionId: string;

test.beforeAll(async () => {
  ({ context, extensionId } = await launchExtension('totopdf-palette-'));
});

test.afterAll(async () => {
  await context.close();
});

async function openFixture(page: Page): Promise<void> {
  await page.goto(`chrome-extension://${extensionId}/viewer.html?e2e=1`);
  await page.waitForFunction(() => '__totopdfOpen' in window);
  const bytes = Array.from(await readFile(TEXT_FIXTURE));
  await page.evaluate((b) => (window as unknown as E2eWindow).__totopdfOpen(b), bytes);
  await page.waitForSelector('.textLayer span');
}

/**
 * The native colour chooser is an OS window Playwright cannot drive, so the
 * event it would fire is dispatched on the input the right click focuses --
 * the same element, the same listener, the same path into storage.
 */
async function recolorFocusedSwatch(page: Page, hex: string): Promise<void> {
  await page.evaluate((value) => {
    const input = document.activeElement;
    if (!(input instanceof HTMLInputElement) || input.type !== 'color') {
      throw new Error('The right click did not leave a colour input focused');
    }
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, hex);
  // createSettingsWiring debounces the storage write by 200ms.
  await page.waitForTimeout(600);
}

test("right-clicking a swatch opens its colour picker instead of Chrome's menu", async () => {
  const page = await context.newPage();
  await openFixture(page);

  await page.evaluate(() => {
    // Registered on document, so it runs after the swatch's own handler and
    // sees whether that handler called preventDefault.
    document.addEventListener('contextmenu', (event) => {
      document.body.dataset.contextmenuPrevented = String(event.defaultPrevented);
    });
  });

  await page.locator('.swatch-slot').first().click({ button: 'right' });

  expect(await page.evaluate(() => document.body.dataset.contextmenuPrevented)).toBe('true');
  expect(
    await page.evaluate(() => {
      const active = document.activeElement;
      const slot = document.querySelector('.swatch-slot');
      return active instanceof HTMLInputElement && active === slot?.querySelector('input');
    }),
  ).toBe(true);

  // Both actions have to be stated, or the right click is a hidden feature.
  const title = await page.locator('.swatch').first().getAttribute('title');
  expect(title).toContain('Click to use it');
  expect(title).toContain('right-click to change this colour');

  await page.close();
});

test('a recoloured swatch survives a reload and colours the next highlight', async () => {
  const page = await context.newPage();
  await openFixture(page);

  // Swatch 1 is the armed one, so this also covers the re-arm: the next
  // highlight has to come out in the new colour with no second click.
  await page.locator('.swatch-slot').first().click({ button: 'right' });
  await recolorFocusedSwatch(page, NEW_HEX);

  await page.reload();
  await page.waitForFunction(() => '__totopdfOpen' in window);
  const bytes = Array.from(await readFile(TEXT_FIXTURE));
  await page.evaluate((b) => (window as unknown as E2eWindow).__totopdfOpen(b), bytes);
  await page.waitForSelector('.textLayer span');

  const swatch = page.locator('.swatch').first();
  await expect(swatch).toHaveCSS('background-color', `rgb(${NEW_RGB.join(', ')})`);
  await expect(swatch).toHaveAttribute('aria-current', 'true');

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
  // known-good margin measured by hand in round-trip.spec.ts.
  await page.waitForTimeout(1200);

  const colors = await page.evaluate(() => {
    const storage = (window as unknown as E2eWindow).__totopdfHost.viewer.pdfDocument
      .annotationStorage.serializable;
    return [...(storage.map ?? [])].map(([, value]) =>
      value && typeof value === 'object' && 'color' in value ? value.color : null,
    );
  });
  expect(colors).toEqual([NEW_RGB]);

  await page.close();
});
