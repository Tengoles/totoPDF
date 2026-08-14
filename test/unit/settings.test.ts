import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PALETTE,
  DEFAULT_SETTINGS,
  loadSettings,
  normalizeSettings,
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
    // The display name, not the stored id: pdf.js labels its built-in
    // highlight colour menu from this string.
    expect(
      paletteToHighlightColors([
        { name: 'yellow', hex: '#FFF176' },
        { name: 'green', hex: '#81C784' },
      ]),
    ).toBe('Yellow=#FFF176,Green=#81C784');
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

describe('normalizeSettings', () => {
  it('falls back entirely when the stored value is not an object', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings('nonsense')).toEqual(DEFAULT_SETTINGS);
  });

  it('restores the default palette when the stored one is empty', () => {
    // pdf.js treats an empty colour string as null and then hides the colour
    // picker completely, so an empty palette must never reach it.
    expect(normalizeSettings({ palette: [] }).palette).toEqual(DEFAULT_PALETTE);
  });

  it('drops palette entries with an unusable colour', () => {
    const result = normalizeSettings({
      palette: [{ name: 'good', hex: '#112233' }, { name: 'bad', hex: 'red' }],
    });
    expect(result.palette).toEqual([{ name: 'good', hex: '#112233' }]);
  });

  it('drops palette names that would break pdf.js parsing', () => {
    // A ',' truncates the pair and makes pdf.js throw; an '=' corrupts the colour.
    const result = normalizeSettings({
      palette: [{ name: 'red,dark', hex: '#FF0000' }, { name: 'my=color', hex: '#00FF00' }],
    });
    expect(result.palette).toEqual(DEFAULT_PALETTE);
  });

  it('clamps an out-of-range active colour index', () => {
    expect(normalizeSettings({ activeColorIndex: 99 }).activeColorIndex).toBe(0);
    expect(normalizeSettings({ activeColorIndex: -1 }).activeColorIndex).toBe(0);
  });

  it('rejects a non-numeric text size', () => {
    expect(normalizeSettings({ freeTextSize: 'big' }).freeTextSize).toBe(
      DEFAULT_SETTINGS.freeTextSize,
    );
  });

  it('never hands out the shared default palette array', () => {
    const first = normalizeSettings(null);
    expect(first.palette).not.toBe(DEFAULT_PALETTE);
  });
});

describe('paletteToHighlightColors output is parseable by pdf.js', () => {
  it('produces one name=#RRGGBB pair per entry, comma separated', () => {
    const serialized = paletteToHighlightColors(DEFAULT_PALETTE);
    const pairs = serialized.split(',');
    expect(pairs).toHaveLength(DEFAULT_PALETTE.length);
    for (const pair of pairs) {
      expect(pair.split('=')).toHaveLength(2);
    }
  });
});
