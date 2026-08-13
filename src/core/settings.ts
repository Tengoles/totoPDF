const STORAGE_KEY = 'settings';

export interface PaletteEntry {
  name: string;
  hex: string;
}

export const DEFAULT_PALETTE: PaletteEntry[] = [
  { name: 'yellow', hex: '#FFF176' },
  { name: 'green', hex: '#81C784' },
  { name: 'blue', hex: '#64B5F6' },
  { name: 'pink', hex: '#F06292' },
  { name: 'orange', hex: '#FFB74D' },
];

export interface Settings {
  palette: PaletteEntry[];
  activeColorIndex: number;
  freeTextSize: number;
  freeTextColor: string;
}

export const DEFAULT_SETTINGS: Settings = {
  palette: DEFAULT_PALETTE,
  activeColorIndex: 0,
  freeTextSize: 14,
  freeTextColor: '#D32F2F',
};

/** pdf.js accepts the palette as a comma-separated "name=#RRGGBB" string. */
export function paletteToHighlightColors(palette: PaletteEntry[]): string {
  return palette.map((entry) => `${entry.name}=${entry.hex}`).join(',');
}

export async function loadSettings(area: chrome.storage.StorageArea): Promise<Settings> {
  const stored = await area.get(STORAGE_KEY);
  const value = stored[STORAGE_KEY] as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...value };
}

export async function saveSettings(
  area: chrome.storage.StorageArea,
  settings: Settings,
): Promise<void> {
  await area.set({ [STORAGE_KEY]: settings });
}
