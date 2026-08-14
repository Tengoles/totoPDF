import { chromium } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SIZES = [16, 32, 48, 128];

const svg = await readFile(resolve(ROOT, 'public/icons/icon.svg'), 'utf8');
const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage();

await mkdir(resolve(ROOT, 'public/icons'), { recursive: true });
for (const size of SIZES) {
  await page.setViewportSize({ width: size, height: size });
  // margin:0 and a transparent body, so omitBackground leaves the tile's
  // rounded corners actually transparent rather than white.
  await page.setContent(
    `<style>html,body{margin:0;padding:0;background:transparent}
     svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  await page.locator('svg').screenshot({
    path: resolve(ROOT, `public/icons/icon${size}.png`),
    omitBackground: true,
  });
  console.log(`wrote public/icons/icon${size}.png`);
}
await browser.close();
