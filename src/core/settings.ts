const STORAGE_KEY = 'settings';

export interface PaletteEntry {
  name: string;
  hex: string;
}

/** Frozen: loadSettings hands out copies, so a caller editing a colour cannot corrupt the defaults. */
export const DEFAULT_PALETTE: readonly PaletteEntry[] = Object.freeze([
  { name: 'yellow', hex: '#FFF176' },
  { name: 'green', hex: '#81C784' },
  { name: 'blue', hex: '#64B5F6' },
  { name: 'pink', hex: '#F06292' },
  { name: 'orange', hex: '#FFB74D' },
]);

export interface Settings {
  palette: PaletteEntry[];
  activeColorIndex: number;
  freeTextSize: number;
  freeTextColor: string;
}

export const DEFAULT_SETTINGS: Settings = {
  palette: [...DEFAULT_PALETTE],
  activeColorIndex: 0,
  freeTextSize: 14,
  freeTextColor: '#D32F2F',
};

/** pdf.js accepts the palette as a comma-separated "name=#RRGGBB" string. */
export function paletteToHighlightColors(palette: readonly PaletteEntry[]): string {
  return palette.map((entry) => `${entry.name}=${entry.hex}`).join(',');
}

/**
 * Palette names are serialized into pdf.js's `name=#RRGGBB,...` string, which it
 * parses by splitting on ',' then '='. A name containing either character makes
 * pdf.js's own parser throw or silently mis-read the colour, so names are
 * restricted here, at the boundary where untrusted stored data enters.
 */
const SAFE_NAME = /^[A-Za-z0-9 _-]+$/;
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

/** The same check normalizeSettings applies to stored colours, exposed for the UI. */
export function isValidHex(value: string): boolean {
  return HEX_COLOR.test(value);
}

/**
 * Returns a new palette with one entry recoloured. An out-of-range index or a
 * colour that is not #RRGGBB returns an unchanged copy: the palette editor's
 * inputs are the only caller, and a palette that fails HEX_COLOR would be
 * dropped entry by entry the next time normalizeSettings read it back.
 */
export function withPaletteColor(
  palette: readonly PaletteEntry[],
  index: number,
  hex: string,
): PaletteEntry[] {
  if (!Number.isInteger(index) || index < 0 || index >= palette.length || !isValidHex(hex)) {
    return [...palette];
  }
  return palette.map((entry, at) => (at === index ? { ...entry, hex } : entry));
}

function isPaletteEntry(value: unknown): value is PaletteEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'hex' in value &&
    typeof value.name === 'string' &&
    typeof value.hex === 'string' &&
    SAFE_NAME.test(value.name) &&
    HEX_COLOR.test(value.hex)
  );
}

function readNumber(source: object, key: string, fallback: number): number {
  if (!(key in source)) {
    return fallback;
  }
  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Stored settings are untrusted input: they may have been written by an older
 * version, hand-edited, or corrupted. Every field falls back independently.
 * An empty palette is rejected outright -- pdf.js treats an empty colour string
 * as null and then hides the highlight colour picker entirely.
 */
export function normalizeSettings(value: unknown): Settings {
  if (typeof value !== 'object' || value === null) {
    return { ...DEFAULT_SETTINGS, palette: [...DEFAULT_PALETTE] };
  }

  const candidates =
    'palette' in value && Array.isArray(value.palette) ? value.palette.filter(isPaletteEntry) : [];
  const palette = candidates.length > 0 ? candidates : [...DEFAULT_PALETTE];

  const activeColorIndex = readNumber(value, 'activeColorIndex', DEFAULT_SETTINGS.activeColorIndex);
  const freeTextColor =
    'freeTextColor' in value &&
    typeof value.freeTextColor === 'string' &&
    HEX_COLOR.test(value.freeTextColor)
      ? value.freeTextColor
      : DEFAULT_SETTINGS.freeTextColor;

  return {
    palette,
    activeColorIndex: activeColorIndex >= 0 && activeColorIndex < palette.length ? activeColorIndex : 0,
    freeTextSize: readNumber(value, 'freeTextSize', DEFAULT_SETTINGS.freeTextSize),
    freeTextColor,
  };
}

export async function loadSettings(area: chrome.storage.StorageArea): Promise<Settings> {
  const stored = await area.get(STORAGE_KEY);
  return normalizeSettings(stored[STORAGE_KEY]);
}

export async function saveSettings(
  area: chrome.storage.StorageArea,
  settings: Settings,
): Promise<void> {
  await area.set({ [STORAGE_KEY]: settings });
}
