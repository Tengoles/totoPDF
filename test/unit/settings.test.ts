import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PALETTE,
  DEFAULT_SETTINGS,
  loadSettings,
  paletteToHighlightColors,
  saveSettings,
} from '../../src/core/settings';

function memoryArea(): chrome.storage.StorageArea {
  let data: Record<string, unknown> = {};
  return {
    async get(keys: string | string[] | null) {
      const key = typeof keys === 'string' ? keys : null;
      return key ? { [key]: data[key] } : { ...data };
    },
    async set(items: Record<string, unknown>) {
      data = { ...data, ...items };
    },
  } as unknown as chrome.storage.StorageArea;
}

describe('paletteToHighlightColors', () => {
  it('serializes to the name=#RRGGBB form pdf.js expects', () => {
    expect(
      paletteToHighlightColors([
        { name: 'yellow', hex: '#FFF176' },
        { name: 'green', hex: '#81C784' },
      ]),
    ).toBe('yellow=#FFF176,green=#81C784');
  });

  it('serializes the default palette without spaces', () => {
    expect(paletteToHighlightColors(DEFAULT_PALETTE)).not.toContain(' ');
  });
});

describe('settings persistence', () => {
  it('returns defaults when nothing is stored', async () => {
    await expect(loadSettings(memoryArea())).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips saved settings', async () => {
    const area = memoryArea();
    await saveSettings(area, { ...DEFAULT_SETTINGS, activeColorIndex: 3, freeTextSize: 18 });
    const loaded = await loadSettings(area);
    expect(loaded.activeColorIndex).toBe(3);
    expect(loaded.freeTextSize).toBe(18);
  });

  it('backfills missing fields from defaults', async () => {
    const area = memoryArea();
    await area.set({ settings: { activeColorIndex: 2 } });
    const loaded = await loadSettings(area);
    expect(loaded.activeColorIndex).toBe(2);
    expect(loaded.palette).toEqual(DEFAULT_PALETTE);
  });
});
