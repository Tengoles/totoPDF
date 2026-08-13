import type { PaletteEntry } from '../core/settings';

export interface PaletteEditorOptions {
  palette: readonly PaletteEntry[];
  activeIndex: number;
  onRecolor(index: number, hex: string): void;
}

/**
 * One row: a native colour input bound to the entry's current colour, plus the
 * name and the number key that arms it. `input type="color"` is a complete
 * picker with an eyedropper on Chrome and costs nothing to ship, which is why
 * there is no colour-picker dependency in this project.
 */
function paletteRow(
  entry: PaletteEntry,
  index: number,
  isActive: boolean,
  onRecolor: (index: number, hex: string) => void,
): HTMLLabelElement {
  const row = document.createElement('label');
  row.className = 'palette-row';

  const input = document.createElement('input');
  input.type = 'color';
  input.value = entry.hex;
  input.title = `Pick a new colour for the ${entry.name} swatch.`;
  // 'input' rather than 'change': Chrome reports every move inside the picker,
  // so the swatch and the armed colour follow the pointer. The storage write
  // behind onRecolor is debounced for exactly that reason.
  input.addEventListener('input', () => onRecolor(index, input.value));

  const name = document.createElement('span');
  name.className = 'palette-name';
  name.textContent = `${entry.name} (key ${index + 1})`;

  row.append(input, name);
  if (isActive) {
    const armed = document.createElement('span');
    armed.className = 'palette-armed';
    armed.textContent = 'in use';
    row.append(armed);
  }
  return row;
}

export function renderPaletteEditor(root: HTMLElement, options: PaletteEditorOptions): void {
  const { palette, activeIndex, onRecolor } = options;

  const heading = document.createElement('h2');
  heading.textContent = 'Highlight colours';

  const note = document.createElement('p');
  note.className = 'palette-note';
  note.textContent =
    'A new colour applies to the next highlight you make. Highlights already on the page keep the colour they were made with.';

  root.replaceChildren(
    heading,
    ...palette.map((entry, index) => paletteRow(entry, index, index === activeIndex, onRecolor)),
    note,
  );
}

export interface PaletteMenuOptions {
  /** The live palette array, read again each time the popover opens. */
  palette: readonly PaletteEntry[];
  getActiveIndex(): number;
  onRecolor(index: number, hex: string): void;
}

// Same hazard as toolbar.ts's keyboard controller, and the same fix: the
// dismiss listeners live on `document`, which outlives the toolbar's elements,
// so a second renderToolbar (every document open triggers one) would leave the
// previous menu's listeners running forever. One module-level controller,
// aborted and replaced per mount, keeps exactly one live pair.
let menuAbort: AbortController | null = null;

/**
 * The "Colours" button and the popover it toggles. Returns a single wrapper so
 * the toolbar can place it like any other control; the wrapper is the
 * positioning context for the popover and the boundary for outside clicks.
 */
export function createPaletteMenu(options: PaletteMenuOptions): HTMLElement {
  menuAbort?.abort();
  menuAbort = new AbortController();
  const { signal } = menuAbort;

  const wrapper = document.createElement('span');
  wrapper.className = 'palette-menu';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.textContent = 'Colours';
  trigger.title = 'Edit the highlight palette colours.';
  trigger.setAttribute('aria-expanded', 'false');

  const popover = document.createElement('div');
  popover.className = 'palette-popover';
  popover.hidden = true;

  function setOpen(open: boolean): void {
    popover.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    if (open) {
      // Rendered on open, not once at mount: the palette and the armed index
      // both change while the toolbar stays up.
      renderPaletteEditor(popover, {
        palette: options.palette,
        activeIndex: options.getActiveIndex(),
        onRecolor: options.onRecolor,
      });
    }
  }

  trigger.addEventListener('click', () => setOpen(popover.hidden));
  bindDismiss({ wrapper, popover, trigger, close: () => setOpen(false), signal });

  wrapper.append(trigger, popover);
  return wrapper;
}

interface DismissTargets {
  wrapper: HTMLElement;
  popover: HTMLElement;
  trigger: HTMLElement;
  close(): void;
  signal: AbortSignal;
}

/** Escape and a click anywhere outside the menu both shut it. */
function bindDismiss({ wrapper, popover, trigger, close, signal }: DismissTargets): void {
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape' || popover.hidden) {
        return;
      }
      // document precedes window in the bubble path, so stopping here is what
      // keeps this Escape from also disarming the highlight tool. Escape with
      // the popover shut still reaches the bridge untouched.
      event.stopPropagation();
      close();
      trigger.focus();
    },
    { signal },
  );

  document.addEventListener(
    'pointerdown',
    (event) => {
      if (!popover.hidden && event.target instanceof Node && !wrapper.contains(event.target)) {
        close();
      }
    },
    { signal },
  );
}
