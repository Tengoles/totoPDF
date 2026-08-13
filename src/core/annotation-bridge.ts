import type { PaletteEntry } from './settings';

/** Verified against pdfjs-dist@6.2.108 AnnotationEditorType. */
export const EDITOR_TYPE = { NONE: 0, FREETEXT: 3, HIGHLIGHT: 9 } as const;

/** Verified against pdfjs-dist@6.2.108 AnnotationEditorParamsType. */
export const EDITOR_PARAM = {
  FREETEXT_SIZE: 11,
  FREETEXT_COLOR: 12,
  HIGHLIGHT_COLOR: 31,
} as const;

export type ToolMode = 'none' | 'highlight' | 'textbox';

export interface DispatchBus {
  dispatch(name: string, payload: Record<string, unknown>): void;
}

export interface AnnotationBridge {
  setMode(mode: ToolMode): void;
  getMode(): ToolMode;
  setHighlightColorIndex(index: number): void;
  setFreeTextColor(hex: string): void;
  setFreeTextSize(size: number): void;
  handleKey(event: Pick<KeyboardEvent, 'key'>): boolean;
}

const MODE_TO_EDITOR: Record<ToolMode, number> = {
  none: EDITOR_TYPE.NONE,
  highlight: EDITOR_TYPE.HIGHLIGHT,
  textbox: EDITOR_TYPE.FREETEXT,
};

/** Initial text-box appearance, so switching to the tool arms the user's settings. */
export interface TextBoxDefaults {
  color: string;
  size: number;
}

export function createAnnotationBridge(
  bus: DispatchBus,
  palette: readonly PaletteEntry[],
  textBox: TextBoxDefaults,
): AnnotationBridge {
  let mode: ToolMode = 'none';
  let colorIndex = 0;
  let textColor = textBox.color;
  let textSize = textBox.size;

  function param(source: AnnotationBridge, type: number, value: string | number): void {
    bus.dispatch('switchannotationeditorparams', { source, type, value });
  }

  function setHighlightColorIndex(this: AnnotationBridge, index: number): void {
    const entry = palette[index];
    if (!entry) {
      return;
    }
    colorIndex = index;
    param(this, EDITOR_PARAM.HIGHLIGHT_COLOR, entry.hex);
  }

  function setFreeTextColor(this: AnnotationBridge, hex: string): void {
    textColor = hex;
    param(this, EDITOR_PARAM.FREETEXT_COLOR, hex);
  }

  function setFreeTextSize(this: AnnotationBridge, size: number): void {
    textSize = size;
    param(this, EDITOR_PARAM.FREETEXT_SIZE, size);
  }

  function setMode(this: AnnotationBridge, next: ToolMode): void {
    mode = next;
    bus.dispatch('switchannotationeditormode', { source: this, mode: MODE_TO_EDITOR[next] });
    // Arming on entry keeps the two tools symmetric: whichever you pick uses
    // your settings rather than pdf.js's built-in defaults.
    if (next === 'highlight') {
      setHighlightColorIndex.call(this, colorIndex);
    } else if (next === 'textbox') {
      setFreeTextColor.call(this, textColor);
      setFreeTextSize.call(this, textSize);
    }
  }

  function handleKey(this: AnnotationBridge, event: Pick<KeyboardEvent, 'key'>): boolean {
    if (event.key === 'Escape' && mode !== 'none') {
      setMode.call(this, 'none');
      return true;
    }
    if (mode !== 'highlight') {
      return false;
    }
    const index = Number(event.key) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= palette.length) {
      return false;
    }
    setHighlightColorIndex.call(this, index);
    return true;
  }

  const bridge: AnnotationBridge = {
    getMode: () => mode,
    setMode,
    setHighlightColorIndex,
    setFreeTextColor,
    setFreeTextSize,
    handleKey,
  };

  return bridge;
}
