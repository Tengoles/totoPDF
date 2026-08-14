import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { type BrowserContext, chromium } from '@playwright/test';

const EXTENSION_PATH = resolve('dist');

export interface LaunchedExtension {
  context: BrowserContext;
  extensionId: string;
}

/**
 * Launches the built extension in a persistent Chromium context -- the only
 * way Playwright can load an MV3 extension -- and resolves the extension id
 * from its service worker URL. Shared by every e2e spec so the launch args
 * and id-resolution logic live in one place.
 *
 * --lang is pinned because palette.spec.ts and round-trip.spec.ts locate the
 * Highlight button by its accessible name; a machine whose Chrome runs in
 * Spanish would otherwise fail them for the wrong reason.
 */
export async function launchExtension(userDataDirPrefix: string): Promise<LaunchedExtension> {
  const userDataDir = await mkdtemp(join(tmpdir(), userDataDirPrefix));
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
