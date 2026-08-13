import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PALETTE,
  isValidHex,
  normalizeSettings,
  type PaletteEntry,
  withPaletteColor,
} from '../../src/core/settings';

const PALETTE: readonly PaletteEntry[] = [
  { name: 'yellow', hex: '#FFF176' },
  { name: 'green', hex: '#81C784' },
  { name: 'blue', hex: '#64B5F6' },
];

/** A snapshot taken before the call, compared after it, proves nothing mutated. */
function snapshot(palette: readonly PaletteEntry[]): string {
  return JSON.stringify(palette);
}

describe('isValidHex', () => {
  it.each(['#FFF176', '#fff176', '#AbC123', '#000000', '#ffffff'])('accepts %s', (value) => {
    expect(isValidHex(value)).toBe(true);
  });

  it.each([
    'red',
    '#fff',
    '#GGGGGG',
    '',
    'FFF176',
    '#FFF17',
    '#FFF1766',
    ' #FFF176',
    '#FFF176 ',
    'rgb(255, 241, 118)',
  ])('rejects %o', (value) => {
    expect(isValidHex(value)).toBe(false);
  });
});

describe('withPaletteColor', () => {
  it('recolours exactly one entry and keeps its name', () => {
    const result = withPaletteColor(PALETTE, 1, '#123456');
    expect(result).toEqual([
      { name: 'yellow', hex: '#FFF176' },
      { name: 'green', hex: '#123456' },
      { name: 'blue', hex: '#64B5F6' },
    ]);
  });

  it('returns a new array and never mutates the input', () => {
    const before = snapshot(PALETTE);
    const result = withPaletteColor(PALETTE, 0, '#123456');
    expect(result).not.toBe(PALETTE);
    expect(snapshot(PALETTE)).toBe(before);
  });

  it('leaves the entries it does not touch as the same objects', () => {
    const result = withPaletteColor(PALETTE, 0, '#123456');
    expect(result[1]).toBe(PALETTE[1]);
    expect(result[0]).not.toBe(PALETTE[0]);
  });

  it.each([-1, 3, 99, 1.5, Number.NaN])('returns the palette unchanged for index %o', (index) => {
    const before = snapshot(PALETTE);
    expect(withPaletteColor(PALETTE, index, '#123456')).toEqual(PALETTE);
    expect(snapshot(PALETTE)).toBe(before);
  });

  it.each(['red', '#fff', '#GGGGGG', '', 'FFF176'])(
    'returns the palette unchanged for the invalid colour %o',
    (hex) => {
      const before = snapshot(PALETTE);
      expect(withPaletteColor(PALETTE, 1, hex)).toEqual(PALETTE);
      expect(snapshot(PALETTE)).toBe(before);
    },
  );

  it('accepts the lowercase hex a native colour input produces', () => {
    expect(withPaletteColor(PALETTE, 2, '#0a1b2c')[2]).toEqual({ name: 'blue', hex: '#0a1b2c' });
  });
});

describe('a recoloured palette survives the storage boundary', () => {
  // normalizeSettings silently drops entries whose name fails SAFE_NAME or
  // whose colour fails HEX_COLOR, so anything written by the palette editor
  // has to come back out of storage identical or the recolour is lost on the
  // next page load.
  it('round-trips through normalizeSettings unchanged', () => {
    const recoloured = withPaletteColor(DEFAULT_PALETTE, 1, '#0a1b2c');
    const restored = normalizeSettings({
      palette: recoloured,
      activeColorIndex: 1,
      freeTextSize: 22,
      freeTextColor: '#0a1b2c',
    });
    expect(restored.palette).toEqual(recoloured);
    expect(restored.activeColorIndex).toBe(1);
    expect(restored.freeTextSize).toBe(22);
    expect(restored.freeTextColor).toBe('#0a1b2c');
  });

  it('keeps every default palette name usable after a recolour', () => {
    let palette = [...DEFAULT_PALETTE];
    for (let index = 0; index < palette.length; index += 1) {
      palette = withPaletteColor(palette, index, '#0a1b2c');
    }
    expect(normalizeSettings({ palette }).palette).toEqual(palette);
  });
});
