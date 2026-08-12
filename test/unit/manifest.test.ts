import { describe, expect, it } from 'vitest';
import manifest from '../../public/manifest.json';

describe('manifest', () => {
  it('is MV3 with a module service worker', () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.background).toEqual({
      service_worker: 'background.js',
      type: 'module',
    });
  });

  it('requests exactly the permissions the design calls for', () => {
    expect(new Set(manifest.permissions)).toEqual(
      new Set(['declarativeNetRequest', 'contextMenus', 'storage', 'tabs', 'webNavigation']),
    );
  });

  it('exposes the viewer and the pdf.js worker as web accessible resources', () => {
    // Indexed access is optional under noUncheckedIndexedAccess.
    const resources = manifest.web_accessible_resources[0]?.resources ?? [];
    expect(resources).toContain('viewer.html');
    expect(resources).toContain('pdf.worker.mjs');
  });
});
