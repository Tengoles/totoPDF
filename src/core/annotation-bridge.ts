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

export function createAnnotationBridge(
  bus: DispatchBus,
  palette: readonly PaletteEntry[],
): AnnotationBridge {
  let mode: ToolMode = 'none';
  let colorIndex = 0;

  const bridge: AnnotationBridge = {
    getMode: () => mode,

    setMode(next) {
      mode = next;
      bus.dispatch('switchannotationeditormode', { source: bridge, mode: MODE_TO_EDITOR[next] });
      if (next === 'highlight') {
        bridge.setHighlightColorIndex(colorIndex);
      }
    },

    setHighlightColorIndex(index) {
      const entry = palette[index];
      if (!entry) {
        return;
      }
      colorIndex = index;
      bus.dispatch('switchannotationeditorparams', {
        source: bridge,
        type: EDITOR_PARAM.HIGHLIGHT_COLOR,
        value: entry.hex,
      });
    },

    setFreeTextColor(hex) {
      bus.dispatch('switchannotationeditorparams', {
        source: bridge,
        type: EDITOR_PARAM.FREETEXT_COLOR,
        value: hex,
      });
    },

    setFreeTextSize(size) {
      bus.dispatch('switchannotationeditorparams', {
        source: bridge,
        type: EDITOR_PARAM.FREETEXT_SIZE,
        value: size,
      });
    },

    handleKey(event) {
      if (event.key === 'Escape' && mode !== 'none') {
        bridge.setMode('none');
        return true;
      }
      if (mode !== 'highlight') {
        return false;
      }
      const index = Number(event.key) - 1;
      if (!Number.isInteger(index) || index < 0 || index >= palette.length) {
        return false;
      }
      bridge.setHighlightColorIndex(index);
      return true;
    },
  };

  return bridge;
}
