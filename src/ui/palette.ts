import type { AnnotationBridge } from '../core/annotation-bridge';
import type { PaletteEntry } from '../core/settings';

/**
 * The five highlight swatches. A left click arms a colour; a right click edits
 * it. There used to be a separate "Colours" button next to the strip that
 * opened a palette editor, which read as a second way to do what clicking a
 * swatch already does. The editing capability moved onto the swatches
 * themselves instead: the thing being recoloured is the thing you click.
 */

export interface SwatchStripOptions {
  /**
   * The live palette array -- the same instance the bridge holds. A recolour
   * lands in place, so the strip reads the stored colour straight back out of
   * it rather than trusting the value the picker reported.
   */
  palette: readonly PaletteEntry[];
  canHighlight: boolean;
  /** Left click, or the number key: arm this colour. */
  onPick(index: number): void;
  /** Right click, once the picker reports a colour. Runs before the repaint. */
  onRecolor(index: number, hex: string): void;
  /** The toolbar's teardown signal; every listener below takes it. */
  signal: AbortSignal;
}

export interface SwatchStrip {
  /** One flex item per palette entry, in palette order. */
  elements: HTMLElement[];
  /** Marks exactly one swatch as the colour the next highlight will use. */
  setArmed(index: number): void;
}

/**
 * `input type="color"` is a complete picker with an eyedropper on Chrome and
 * costs nothing to ship, which is why there is no colour-picker dependency in
 * this project. It sits behind its swatch rather than in the toolbar row: it
 * is invisible and untabbable, so the only way to it is the right click, but
 * it is laid out (not `display: none`) because Chrome refuses to open a
 * chooser for an element with no layout box, and it anchors the picker to the
 * swatch it edits.
 */
function hiddenColorInput(entry: PaletteEntry, index: number): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'color';
  input.className = 'swatch-color';
  input.value = entry.hex;
  input.tabIndex = -1;
  input.setAttribute('aria-label', `New colour for the ${entry.name} swatch (key ${index + 1}).`);
  return input;
}

function swatchButton(entry: PaletteEntry, index: number, canHighlight: boolean): HTMLButtonElement {
  const swatch = document.createElement('button');
  swatch.type = 'button';
  swatch.className = 'swatch';
  swatch.style.background = entry.hex;
  // A swatch's accessible name comes from its title -- it has no text. It has
  // to name both actions, because a right click with no stated hint is a
  // hidden feature. Keep the word "highlight" out of it: the e2e specs locate
  // the Highlight button by accessible name, and Playwright matches by
  // substring.
  swatch.title = `${entry.name} (key ${index + 1}). Click to use it, right-click to change this colour.`;
  swatch.disabled = !canHighlight;
  return swatch;
}

/**
 * One swatch and the picker behind it, wrapped in the element the toolbar
 * places. The wrapper is the picker's positioning context and carries the
 * contextmenu listener: a disabled swatch swallows its own pointer events (a
 * document with no text layer cannot be highlighted), and recolouring is a
 * setting rather than a document action, so it stays reachable there.
 */
function createSwatchSlot(
  entry: PaletteEntry,
  index: number,
  options: SwatchStripOptions,
): { slot: HTMLElement; swatch: HTMLButtonElement } {
  const { palette, signal } = options;
  const slot = document.createElement('span');
  slot.className = 'swatch-slot';

  const swatch = swatchButton(entry, index, options.canHighlight);
  const input = hiddenColorInput(entry, index);

  swatch.addEventListener('click', () => options.onPick(index), { signal });

  slot.addEventListener(
    'contextmenu',
    (event) => {
      // Without this Chrome's own menu opens on top of the picker. It also
      // covers the keyboard: the ContextMenu key and Shift+F10 raise this same
      // event, so the swatch does not need a shortcut of its own.
      event.preventDefault();
      input.focus();
      input.click();
    },
    { signal },
  );

  // 'input' rather than 'change': Chrome reports every move inside the picker,
  // so the swatch and the armed colour follow the pointer. The storage write
  // behind onRecolor is debounced for exactly that reason.
  input.addEventListener(
    'input',
    () => {
      options.onRecolor(index, input.value);
      // Read the colour back out of the live palette rather than trusting the
      // input: onRecolor rejects anything that is not #RRGGBB, and the swatch
      // must show what was actually stored.
      const stored = palette[index];
      if (stored) {
        swatch.style.background = stored.hex;
      }
    },
    { signal },
  );

  slot.append(swatch, input);
  return { slot, swatch };
}

function createSwatchStrip(options: SwatchStripOptions): SwatchStrip {
  const slots = options.palette.map((entry, index) => createSwatchSlot(entry, index, options));

  return {
    elements: slots.map(({ slot }) => slot),
    setArmed(index) {
      slots.forEach(({ swatch }, at) => swatch.setAttribute('aria-current', String(at === index)));
    },
  };
}

/** The part of ToolbarOptions the strip and the armed index need. */
export interface HighlightControlOptions {
  /**
   * The live palette array -- the same instance the bridge holds. A recolour
   * reaches it through onPaletteRecolor and lands in place, so a swatch can
   * read the colour that was actually stored straight back out of it.
   */
  palette: PaletteEntry[];
  activeColorIndex: number;
  canHighlight: boolean;
  bridge: AnnotationBridge;
  onPaletteRecolor(index: number, hex: string): void;
  onActiveColorChange(index: number): void;
}

export interface HighlightControls {
  elements: HTMLElement[];
  /** Re-reads the armed colour from the bridge, which keys 1-5 change directly. */
  syncArmed(): void;
}

/**
 * The strip plus the armed index it paints. `onToolArmed` fires when a swatch
 * arms the highlight tool, which is a mode change the toolbar's own pressed
 * states have to follow.
 */
export function createHighlightControls(
  options: HighlightControlOptions,
  signal: AbortSignal,
  onToolArmed: () => void,
): HighlightControls {
  const { palette, bridge, canHighlight, onActiveColorChange, onPaletteRecolor } = options;
  let activeIndex = options.activeColorIndex;

  const strip = createSwatchStrip({
    palette,
    canHighlight,
    signal,
    onPick: (index) => {
      bridge.setHighlightColorIndex(index);
      bridge.setMode('highlight');
      setActive(index);
      onToolArmed();
    },
    onRecolor: (index, hex) => {
      onPaletteRecolor(index, hex);
      if (index === activeIndex) {
        // Re-arm so the next highlight uses the new colour without a second click.
        bridge.setHighlightColorIndex(index);
      }
    },
  });

  function setActive(index: number): void {
    const changed = index !== activeIndex;
    activeIndex = index;
    strip.setArmed(index);
    if (changed) {
      onActiveColorChange(index);
    }
  }

  setActive(activeIndex);
  return { elements: strip.elements, syncArmed: () => setActive(bridge.getColorIndex()) };
}
