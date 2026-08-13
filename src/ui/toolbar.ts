import type { AnnotationBridge, ToolMode } from '../core/annotation-bridge';
import type { PaletteEntry } from '../core/settings';

export interface ToolbarOptions {
  palette: PaletteEntry[];
  bridge: AnnotationBridge;
  canHighlight: boolean;
  canSave: boolean;
  onSave(): void;
  onOpenInChrome(): void;
}

function button(label: string, title: string): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.title = title;
  return element;
}

function createSwatches(
  palette: readonly PaletteEntry[],
  bridge: AnnotationBridge,
  canHighlight: boolean,
  syncPressedState: () => void,
): HTMLButtonElement[] {
  return palette.map((entry, index) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'swatch';
    swatch.style.background = entry.hex;
    swatch.title = `${entry.name} (${index + 1})`;
    swatch.disabled = !canHighlight;
    swatch.addEventListener('click', () => {
      bridge.setHighlightColorIndex(index);
      bridge.setMode('highlight');
      syncPressedState();
    });
    return swatch;
  });
}

// renderToolbar runs once per document (a fresh capabilities assessment
// re-renders the whole toolbar), and each run used to add its own
// 'keydown' listener to window with no way to remove it -- window outlives
// root.replaceChildren(), so every open stacked another listener forever.
// One module-level controller, aborted and replaced each run, keeps exactly
// one live listener no matter how many times renderToolbar is called.
let keyboardAbort: AbortController | null = null;

/** Ctrl+S saves globally; otherwise unarmed keys fall through to the bridge (Escape, 1-5). */
function bindKeyboard(bridge: AnnotationBridge, onSave: () => void, syncPressedState: () => void): void {
  keyboardAbort?.abort();
  keyboardAbort = new AbortController();
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.ctrlKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        onSave();
        return;
      }
      if (event.target instanceof HTMLElement && event.target.isContentEditable) {
        return;
      }
      if (bridge.handleKey(event)) {
        event.preventDefault();
        syncPressedState();
      }
    },
    { signal: keyboardAbort.signal },
  );
}

export function renderToolbar(root: HTMLElement, options: ToolbarOptions): void {
  const { palette, bridge, canHighlight, canSave, onSave, onOpenInChrome } = options;
  root.replaceChildren();

  const highlight = button('Highlight', 'Highlight selected text. Keys 1-5 change color.');
  const textbox = button('Text box', 'Drag a box on the page and type inside it.');
  const save = button('Save', 'Write annotations into the PDF file (Ctrl+S).');
  const openInChrome = button('Open in Chrome', "Open this file in Chrome's built-in PDF viewer.");

  highlight.disabled = !canHighlight;
  save.disabled = !canSave;

  function syncPressedState(): void {
    const mode: ToolMode = bridge.getMode();
    highlight.setAttribute('aria-pressed', String(mode === 'highlight'));
    textbox.setAttribute('aria-pressed', String(mode === 'textbox'));
  }

  // Swatches only arm the highlight tool, so they follow its availability.
  const swatches = createSwatches(palette, bridge, canHighlight, syncPressedState);

  function toggle(mode: ToolMode): void {
    bridge.setMode(bridge.getMode() === mode ? 'none' : mode);
    syncPressedState();
  }

  highlight.addEventListener('click', () => toggle('highlight'));
  textbox.addEventListener('click', () => toggle('textbox'));
  save.addEventListener('click', onSave);
  openInChrome.addEventListener('click', onOpenInChrome);

  const spacer = document.createElement('span');
  spacer.style.flex = '1';

  root.append(highlight, ...swatches, textbox, spacer, openInChrome, save);
  syncPressedState();

  bindKeyboard(bridge, onSave, syncPressedState);
}
