import type { AnnotationBridge, ToolMode } from '../core/annotation-bridge';
import type { PaletteEntry } from '../core/settings';
import { createPaletteMenu } from './palette';
import { createSaveStatusReadout, type SaveStatusSource } from './save-status';
import { createTextBoxControls, type TextBoxControlOptions } from './textbox-controls';
import { applyZoomAction, type ZoomController, zoomKeyAction } from './zoom';
import { createZoomControls } from './zoom-control';

/** bridge, freeTextColor, freeTextSize and the two text callbacks come from the base. */
export interface ToolbarOptions extends TextBoxControlOptions {
  /**
   * The live palette array -- the same instance the bridge holds. A recolour
   * reaches it through onPaletteRecolor and lands in place, so the swatches and
   * the popover can both read the current colour straight back out of it.
   */
  palette: PaletteEntry[];
  activeColorIndex: number;
  /** The viewer's scale. Owned by the viewer host, not by the toolbar. */
  zoom: ZoomController;
  canHighlight: boolean;
  canSave: boolean;
  /** Drives the readout next to Save. Survives this toolbar being rebuilt. */
  saveStatus: SaveStatusSource;
  onSave(): void;
  onOpenInChrome(): void;
  onPaletteRecolor(index: number, hex: string): void;
  onActiveColorChange(index: number): void;
}

function button(label: string, title: string): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.title = title;
  return element;
}

/** Pushes everything after it to the right-hand end of the toolbar. */
function spacer(): HTMLSpanElement {
  const element = document.createElement('span');
  element.style.flex = '1';
  return element;
}

function createSwatches(
  palette: readonly PaletteEntry[],
  canHighlight: boolean,
  onPick: (index: number) => void,
): HTMLButtonElement[] {
  return palette.map((entry, index) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'swatch';
    swatch.style.background = entry.hex;
    // A swatch's accessible name comes from its title -- it has no text. Keep
    // the word "highlight" out of it: the e2e specs locate the Highlight button
    // by accessible name, and Playwright matches names by substring.
    swatch.title = `${entry.name} (key ${index + 1}). Marks selected text in this colour.`;
    swatch.disabled = !canHighlight;
    swatch.addEventListener('click', () => onPick(index));
    return swatch;
  });
}

interface HighlightControls {
  elements: HTMLElement[];
  /** Re-reads the armed colour from the bridge, which keys 1-5 change directly. */
  syncArmed(): void;
}

function createHighlightControls(
  options: ToolbarOptions,
  syncPressedState: () => void,
): HighlightControls {
  const { palette, bridge, canHighlight, onActiveColorChange, onPaletteRecolor } = options;
  let activeIndex = options.activeColorIndex;

  const swatches = createSwatches(palette, canHighlight, (index) => {
    bridge.setHighlightColorIndex(index);
    bridge.setMode('highlight');
    setActive(index);
    syncPressedState();
  });

  function setActive(index: number): void {
    const changed = index !== activeIndex;
    activeIndex = index;
    swatches.forEach((swatch, at) => swatch.setAttribute('aria-current', String(at === index)));
    if (changed) {
      onActiveColorChange(index);
    }
  }

  const menu = createPaletteMenu({
    palette,
    getActiveIndex: () => activeIndex,
    onRecolor: (index, hex) => {
      onPaletteRecolor(index, hex);
      // Read the colour back out of the live palette rather than trusting the
      // input: onPaletteRecolor rejects anything that is not #RRGGBB, and the
      // swatch must show what was actually stored.
      const stored = palette[index];
      const swatch = swatches[index];
      if (stored && swatch) {
        swatch.style.background = stored.hex;
      }
      if (index === activeIndex) {
        // Re-arm so the next highlight uses the new colour without a second click.
        bridge.setHighlightColorIndex(index);
      }
    },
  });

  setActive(activeIndex);
  return { elements: [...swatches, menu], syncArmed: () => setActive(bridge.getColorIndex()) };
}

function createRailToggles(): { pages: HTMLButtonElement; notes: HTMLButtonElement } {
  const pages = button('Pages', 'Show or hide the page thumbnail rail.');
  const notes = button('Notes', 'Show or hide the annotation rail.');
  pages.addEventListener('click', () => document.body.classList.toggle('thumbs-collapsed'));
  notes.addEventListener('click', () => document.body.classList.toggle('notes-collapsed'));
  return { pages, notes };
}

// renderToolbar runs once per document (a fresh capabilities assessment
// re-renders the whole toolbar), and each run used to add its own
// 'keydown' listener to window with no way to remove it -- window outlives
// root.replaceChildren(), so every open stacked another listener forever.
// One module-level controller, aborted and replaced each run, keeps exactly
// one live listener no matter how many times renderToolbar is called. Every
// listener that outlives the toolbar's own elements -- the keyboard, the
// popovers' dismiss handlers, the scale subscription, Ctrl+wheel on the
// scroll container -- takes this signal for the same reason.
let toolbarAbort: AbortController | null = null;

function resetToolbarListeners(): AbortSignal {
  toolbarAbort?.abort();
  toolbarAbort = new AbortController();
  return toolbarAbort.signal;
}

interface KeyboardDeps {
  bridge: AnnotationBridge;
  zoom: ZoomController;
  onSave(): void;
  onHandled(): void;
}

/** Ctrl+S saves globally; otherwise unarmed keys fall through to the bridge (Escape, 1-5). */
function bindKeyboard(signal: AbortSignal, deps: KeyboardDeps): void {
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.ctrlKey && event.key.toLowerCase() === 's') {
        // preventDefault unconditionally, or a held key still hands Chrome's
        // own Save dialog the repeats. The repeats themselves are dropped:
        // autorepeat fires every ~30ms, and each one used to start another
        // save and another file picker on top of the one already running.
        event.preventDefault();
        if (!event.repeat) {
          deps.onSave();
        }
        return;
      }
      // Typing in the toolbar's own text-size box must not double as the 1-5
      // colour shortcut, and Ctrl+- inside a text box being typed into is the
      // editor's business, not the viewer's.
      if (event.target instanceof HTMLElement && isTextEntry(event.target)) {
        return;
      }
      const zoomAction = zoomKeyAction(event);
      if (zoomAction) {
        // Without this Chrome zooms the whole page instead of the document.
        event.preventDefault();
        applyZoomAction(deps.zoom, zoomAction);
        return;
      }
      if (deps.bridge.handleKey(event)) {
        event.preventDefault();
        deps.onHandled();
      }
    },
    { signal },
  );
}

function isTextEntry(element: HTMLElement): boolean {
  return (
    element.isContentEditable ||
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  );
}

interface ToolButtons {
  highlight: HTMLButtonElement;
  textbox: HTMLButtonElement;
  save: HTMLButtonElement;
  openInChrome: HTMLButtonElement;
}

function createToolButtons(canHighlight: boolean, canSave: boolean): ToolButtons {
  const highlight = button('Highlight', 'Highlight selected text. Keys 1-5 change colour.');
  const textbox = button('Text box', 'Drag a box on the page and type inside it.');
  const save = button('Save', 'Write annotations into the PDF file (Ctrl+S).');
  const openInChrome = button('Open in Chrome', "Open this file in Chrome's built-in PDF viewer.");
  highlight.disabled = !canHighlight;
  save.disabled = !canSave;
  return { highlight, textbox, save, openInChrome };
}

export function renderToolbar(root: HTMLElement, options: ToolbarOptions): void {
  const { bridge, zoom, onSave, onOpenInChrome } = options;
  root.replaceChildren();
  const signal = resetToolbarListeners();

  const { highlight, textbox, save, openInChrome } = createToolButtons(
    options.canHighlight,
    options.canSave,
  );
  const rails = createRailToggles();

  function syncPressedState(): void {
    const mode: ToolMode = bridge.getMode();
    highlight.setAttribute('aria-pressed', String(mode === 'highlight'));
    textbox.setAttribute('aria-pressed', String(mode === 'textbox'));
  }

  // Swatches only arm the highlight tool, so they follow its availability. The
  // palette editor and the text-box controls are settings, not document
  // actions, and stay usable on a document that cannot be highlighted.
  const highlightControls = createHighlightControls(options, syncPressedState);

  function toggle(mode: ToolMode): void {
    bridge.setMode(bridge.getMode() === mode ? 'none' : mode);
    syncPressedState();
  }

  highlight.addEventListener('click', () => toggle('highlight'));
  textbox.addEventListener('click', () => toggle('textbox'));
  save.addEventListener('click', onSave);
  openInChrome.addEventListener('click', onOpenInChrome);

  // The wheel listener sits on the scroll container rather than on anything
  // the toolbar owns, but it is the same control and dies with the same signal.
  zoom.bindWheel(signal);

  root.append(
    rails.pages,
    highlight,
    ...highlightControls.elements,
    textbox,
    ...createTextBoxControls(options),
    spacer(),
    createZoomControls(zoom, signal),
    rails.notes,
    openInChrome,
    // Next to the button it is about, and on the same abort signal as every
    // other listener that outlives this toolbar's elements.
    createSaveStatusReadout(options.saveStatus, signal),
    save,
  );
  syncPressedState();

  bindKeyboard(signal, {
    bridge,
    zoom,
    onSave,
    onHandled: () => {
      syncPressedState();
      highlightControls.syncArmed();
    },
  });
}
