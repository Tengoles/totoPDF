import { defineConfig } from '@playwright/test';

// The extension context is launched by hand in test/e2e/round-trip.spec.ts
// (chromium.launchPersistentContext with --load-extension), so the `use`
// block's browser/context options do not apply here -- only testDir and
// timeout do.
export default defineConfig({
  testDir: 'test/e2e',
  timeout: 60_000,
});
