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

/**
 * The two ways into pdf.js's editor. They are deliberately different: mode is a
 * property setter on PDFViewer, parameters go through the event bus. See
 * src/viewer/editor-host.ts for the production adapter and why.
 */
export interface EditorHost {
  setMode(mode: number): void;
  setParam(type: number, value: string | number): void;
}

export interface AnnotationBridge {
  setMode(mode: ToolMode): void;
  getMode(): ToolMode;
  reapply(): void;
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
  host: EditorHost,
  palette: readonly PaletteEntry[],
  textBox: TextBoxDefaults,
): AnnotationBridge {
  let mode: ToolMode = 'none';
  let colorIndex = 0;
  let textColor = textBox.color;
  let textSize = textBox.size;

  function setHighlightColorIndex(index: number): void {
    const entry = palette[index];
    if (!entry) {
      return;
    }
    colorIndex = index;
    host.setParam(EDITOR_PARAM.HIGHLIGHT_COLOR, entry.hex);
  }

  function setFreeTextColor(hex: string): void {
    textColor = hex;
    host.setParam(EDITOR_PARAM.FREETEXT_COLOR, hex);
  }

  function setFreeTextSize(size: number): void {
    textSize = size;
    host.setParam(EDITOR_PARAM.FREETEXT_SIZE, size);
  }

  function setMode(next: ToolMode): void {
    mode = next;
    host.setMode(MODE_TO_EDITOR[next]);
    // Arming on entry keeps the two tools symmetric: whichever you pick uses
    // your settings rather than pdf.js's built-in defaults.
    if (next === 'highlight') {
      setHighlightColorIndex(colorIndex);
    } else if (next === 'textbox') {
      setFreeTextColor(textColor);
      setFreeTextSize(textSize);
    }
  }

  function handleKey(event: Pick<KeyboardEvent, 'key'>): boolean {
    if (event.key === 'Escape' && mode !== 'none') {
      setMode('none');
      return true;
    }
    if (mode !== 'highlight') {
      return false;
    }
    const index = Number(event.key) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= palette.length) {
      return false;
    }
    setHighlightColorIndex(index);
    return true;
  }

  return {
    getMode: () => mode,
    /**
     * Re-applies the armed tool after a document loads, because PDFViewer's
     * annotationEditorMode setter does nothing while no document is open.
     * Skipped when nothing is armed: pdf.js already starts in NONE, and asking
     * it to switch to NONE before its editor manager exists throws.
     */
    reapply: () => {
      if (mode !== 'none') {
        setMode(mode);
      }
    },
    setMode,
    setHighlightColorIndex,
    setFreeTextColor,
    setFreeTextSize,
    handleKey,
  };
}
