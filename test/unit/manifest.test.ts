import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import pkg from '../../package.json';
import manifest from '../../public/manifest.json';
import en from '../../src/i18n/en.json';

describe('manifest', () => {
  it('is MV3 with a module service worker', () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.background).toEqual({
      service_worker: 'background.js',
      type: 'module',
    });
  });

  it('requests only the permissions the code exercises', () => {
    // tabs was dropped: chrome.tabs.create/update need no permission, and the
    // one place a tab's URL is read gets it from the <all_urls> host
    // permission. webNavigation went with installNavigationFallback.
    expect(new Set(manifest.permissions)).toEqual(
      new Set(['declarativeNetRequest', 'contextMenus', 'storage']),
    );
  });

  it('keeps the manifest and package versions in step', () => {
    // The store refuses a re-upload whose version did not increase, so a
    // drift between these two is a failed submission.
    expect(manifest.version).toBe(pkg.version);
  });

  it('declares an icon at every size the store and the toolbar need', () => {
    for (const size of ['16', '32', '48', '128'] as const) {
      expect(manifest.icons).toHaveProperty(size);
      expect(manifest.action.default_icon).toHaveProperty(size);
    }
  });

  it('ships every icon file the manifest names, at the size it claims', () => {
    // PNG holds width and height as big-endian uint32 at offsets 16 and 20.
    for (const [size, path] of Object.entries(manifest.icons)) {
      const bytes = readFileSync(`public/${path}`);
      expect(bytes.subarray(0, 8).toString('hex'), path).toBe('89504e470d0a1a0a');
      expect(bytes.readUInt32BE(16), `${path} width`).toBe(Number(size));
      expect(bytes.readUInt32BE(20), `${path} height`).toBe(Number(size));
    }
  });

  it('exposes the viewer and the pdf.js worker as web accessible resources', () => {
    // Indexed access is optional under noUncheckedIndexedAccess.
    const resources = manifest.web_accessible_resources[0]?.resources ?? [];
    expect(resources).toContain('viewer.html');
    expect(resources).toContain('pdf.worker.mjs');
  });

  it('names a default locale and resolves every message reference', () => {
    expect(manifest.default_locale).toBe('en');
    const references = [...JSON.stringify(manifest).matchAll(/__MSG_([A-Za-z0-9_]+)__/g)].map(
      (match) => match[1] ?? '',
    );
    expect(references.length).toBeGreaterThan(0);
    for (const reference of references) {
      expect(en, reference).toHaveProperty(reference);
    }
  });
});
