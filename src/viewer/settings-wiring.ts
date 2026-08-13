import { type PaletteEntry, type Settings, saveSettings, withPaletteColor } from '../core/settings';

/**
 * Native colour inputs report every pointer move inside the picker, so an
 * undebounced handler would write to chrome.storage dozens of times for one
 * colour choice. Only the last value in a quiet period is stored; the in-memory
 * settings and the editor itself update on every event, so nothing waits.
 */
const SAVE_DELAY_MS = 200;

export interface SettingsWiring {
  onPaletteRecolor(index: number, hex: string): void;
  onActiveColorChange(index: number): void;
  onTextColorChange(hex: string): void;
  onTextSizeChange(size: number): void;
}

/**
 * The annotation bridge and the toolbar both captured settings.palette by
 * reference, so a recolour has to land in that same array instance -- assigning
 * a new array to settings.palette would leave both of them arming and painting
 * the colours from before the edit. withPaletteColor stays pure; this is the
 * one place its result is copied into the live array.
 */
function replacePalette(live: PaletteEntry[], next: readonly PaletteEntry[]): void {
  live.splice(0, live.length, ...next);
}

function createPersist(
  settings: Settings,
  area: chrome.storage.StorageArea,
  onError: (error: unknown) => void,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      // settings is the live object, so the deferred write always stores the
      // newest state rather than the value that scheduled it.
      void saveSettings(area, settings).catch(onError);
    }, SAVE_DELAY_MS);
  };
}

/**
 * Turns the toolbar's change callbacks into updates of the live Settings plus a
 * debounced write to extension storage. This is the only production caller of
 * saveSettings: before it existed, activeColorIndex was read at startup and
 * never written by anything.
 */
export function createSettingsWiring(
  settings: Settings,
  area: chrome.storage.StorageArea,
  onError: (error: unknown) => void,
): SettingsWiring {
  const persist = createPersist(settings, area, onError);

  return {
    onPaletteRecolor(index, hex) {
      replacePalette(settings.palette, withPaletteColor(settings.palette, index, hex));
      persist();
    },
    onActiveColorChange(index) {
      settings.activeColorIndex = index;
      persist();
    },
    onTextColorChange(hex) {
      settings.freeTextColor = hex;
      persist();
    },
    onTextSizeChange(size) {
      settings.freeTextSize = size;
      persist();
    },
  };
}
