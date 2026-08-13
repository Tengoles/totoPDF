import type { AnnotationBridge, ToolMode } from '../core/annotation-bridge';
import type { PageController } from './page-nav';
import { createPageNavControls } from './page-nav-control';
import { createHighlightControls, type HighlightControlOptions } from './palette';
import { createSaveStatusReadout, type SaveStatusSource } from './save-status';
import { createTextBoxControls, type TextBoxControlOptions } from './textbox-controls';
import { applyZoomAction, type ZoomController, zoomKeyAction } from './zoom';
import { createZoomControls } from './zoom-control';

/**
 * bridge, freeTextColor, freeTextSize and the two text callbacks come from
 * TextBoxControlOptions; the palette, the armed index, canHighlight and their
 * two callbacks come from HighlightControlOptions.
 */
export interface ToolbarOptions extends TextBoxControlOptions, HighlightControlOptions {
  /** The viewer's scale. Owned by the viewer host, not by the toolbar. */
  zoom: ZoomController;
  /** Which page is shown, and how many there are. Also owned by the host. */
  pages: PageController;
  canSave: boolean;
  /** Drives the readout next to Save. Survives this toolbar being rebuilt. */
  saveStatus: SaveStatusSource;
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

/**
 * Empty, and the only thing in the row that grows. Two of them split the bar
 * into three groups and hold the middle one centred in whatever space the
 * outer two leave; the group boundaries are where these sit.
 */
function spacer(): HTMLSpanElement {
  const element = document.createElement('span');
  element.style.flex = '1';
  return element;
}

interface RailToggles {
  pages: HTMLButtonElement;
  notes: HTMLButtonElement;
}

function createRailToggles(): RailToggles {
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
// listener that outlives the toolbar's own elements -- the keyboard, the zoom
// popover's dismiss handlers, the scale subscription, Ctrl+wheel on the
// scroll container -- takes this signal for the same reason, and so do the
// swatch strip's, which are element-owned but cost nothing to tie to it.
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

function bindToolButtons(
  tools: ToolButtons,
  options: ToolbarOptions,
  syncPressedState: () => void,
): void {
  const { bridge } = options;

  function toggle(mode: ToolMode): void {
    bridge.setMode(bridge.getMode() === mode ? 'none' : mode);
    syncPressedState();
  }

  tools.highlight.addEventListener('click', () => toggle('highlight'));
  tools.textbox.addEventListener('click', () => toggle('textbox'));
  tools.save.addEventListener('click', options.onSave);
  tools.openInChrome.addEventListener('click', options.onOpenInChrome);
}

interface ToolbarParts {
  tools: ToolButtons;
  rails: RailToggles;
  /** The swatch strip, already built and wired. */
  swatches: HTMLElement[];
  signal: AbortSignal;
}

/**
 * Three groups, separated by the two growing spacers: where you are in the
 * document on the left, what you are marking it up with in the middle, how you
 * are viewing and keeping it on the right. There used to be one spacer, which
 * put every group but the last hard against the left edge and left the whole
 * surplus in a single gap before the zoom controls.
 */
function layoutToolbar(root: HTMLElement, options: ToolbarOptions, parts: ToolbarParts): void {
  const { tools, rails, swatches, signal } = parts;
  root.append(
    rails.pages,
    // Next to the button that shows the thumbnails, which is where every other
    // PDF viewer puts the page box.
    createPageNavControls(options.pages, signal),
    spacer(),
    tools.highlight,
    ...swatches,
    tools.textbox,
    ...createTextBoxControls(options),
    spacer(),
    createZoomControls(options.zoom, signal),
    rails.notes,
    tools.openInChrome,
    // Next to the button it is about, and on the same abort signal as every
    // other listener that outlives this toolbar's elements.
    createSaveStatusReadout(options.saveStatus, signal),
    tools.save,
  );
}

export function renderToolbar(root: HTMLElement, options: ToolbarOptions): void {
  const { bridge, zoom, onSave } = options;
  root.replaceChildren();
  const signal = resetToolbarListeners();

  const tools = createToolButtons(options.canHighlight, options.canSave);
  const rails = createRailToggles();

  function syncPressedState(): void {
    const mode: ToolMode = bridge.getMode();
    tools.highlight.setAttribute('aria-pressed', String(mode === 'highlight'));
    tools.textbox.setAttribute('aria-pressed', String(mode === 'textbox'));
  }

  // Swatches only arm the highlight tool, so they follow its availability.
  // Recolouring one and the text-box controls are settings, not document
  // actions, and stay usable on a document that cannot be highlighted.
  const highlightControls = createHighlightControls(options, signal, syncPressedState);
  bindToolButtons(tools, options, syncPressedState);

  // The wheel listener sits on the scroll container rather than on anything
  // the toolbar owns, but it is the same control and dies with the same signal.
  zoom.bindWheel(signal);

  layoutToolbar(root, options, { tools, rails, swatches: highlightControls.elements, signal });
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
