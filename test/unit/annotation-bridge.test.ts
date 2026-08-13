import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PALETTE } from '../../src/core/settings';
import { EDITOR_PARAM, EDITOR_TYPE, createAnnotationBridge } from '../../src/core/annotation-bridge';

const TEXT_BOX = { color: '#D32F2F', size: 14 };

function setup() {
  const setMode = vi.fn();
  const setParam = vi.fn();
  const bridge = createAnnotationBridge({ setMode, setParam }, DEFAULT_PALETTE, TEXT_BOX);
  return { setMode, setParam, bridge };
}

describe('annotation bridge', () => {
  it('arms the highlight editor with the active color', () => {
    const { setMode, setParam, bridge } = setup();
    bridge.setMode('highlight');

    expect(setMode).toHaveBeenCalledWith(EDITOR_TYPE.HIGHLIGHT);
    expect(setParam).toHaveBeenCalledWith(EDITOR_PARAM.HIGHLIGHT_COLOR, DEFAULT_PALETTE[0]?.hex);
  });

  it('switches to the free text editor and arms the configured colour and size', () => {
    const { setMode, setParam, bridge } = setup();
    bridge.setMode('textbox');
    expect(setMode).toHaveBeenCalledWith(EDITOR_TYPE.FREETEXT);
    expect(setParam).toHaveBeenCalledWith(EDITOR_PARAM.FREETEXT_COLOR, TEXT_BOX.color);
    expect(setParam).toHaveBeenCalledWith(EDITOR_PARAM.FREETEXT_SIZE, TEXT_BOX.size);
  });

  it('keeps the chosen highlight colour across a trip through the text box tool', () => {
    const { setParam, bridge } = setup();
    bridge.setMode('highlight');
    bridge.handleKey({ key: '3' });
    bridge.setMode('textbox');
    setParam.mockClear();

    bridge.setMode('highlight');
    expect(setParam).toHaveBeenCalledWith(EDITOR_PARAM.HIGHLIGHT_COLOR, DEFAULT_PALETTE[2]?.hex);
  });

  it('reports Escape as unhandled when no tool is armed', () => {
    const { bridge } = setup();
    expect(bridge.handleKey({ key: 'Escape' })).toBe(false);
  });

  it.each(['0', '', ' ', 'e', 'Infinity', '1.5', '10'])(
    'ignores the non-palette key %o while highlighting',
    (key) => {
      const { bridge } = setup();
      bridge.setMode('highlight');
      expect(bridge.handleKey({ key })).toBe(false);
    },
  );

  it('disarms back to none', () => {
    const { setMode, bridge } = setup();
    bridge.setMode('highlight');
    bridge.setMode('none');
    expect(setMode).toHaveBeenLastCalledWith(EDITOR_TYPE.NONE);
    expect(bridge.getMode()).toBe('none');
  });

  it('maps number keys 1-5 to palette entries while highlighting', () => {
    const { setParam, bridge } = setup();
    bridge.setMode('highlight');
    setParam.mockClear();

    expect(bridge.handleKey({ key: '3' })).toBe(true);
    expect(setParam).toHaveBeenCalledWith(EDITOR_PARAM.HIGHLIGHT_COLOR, DEFAULT_PALETTE[2]?.hex);
  });

  it('ignores number keys outside the palette range', () => {
    const { bridge } = setup();
    bridge.setMode('highlight');
    expect(bridge.handleKey({ key: '9' })).toBe(false);
  });

  it('ignores number keys when no tool is armed', () => {
    const { bridge } = setup();
    expect(bridge.handleKey({ key: '1' })).toBe(false);
  });

  it('disarms on Escape', () => {
    const { bridge } = setup();
    bridge.setMode('highlight');
    expect(bridge.handleKey({ key: 'Escape' })).toBe(true);
    expect(bridge.getMode()).toBe('none');
  });

  it('reports the armed colour index, including one chosen by a number key', () => {
    // The toolbar reads this back to mark the armed swatch and to persist the
    // choice: keys 1-5 change the colour without going through the toolbar.
    const { bridge } = setup();
    expect(bridge.getColorIndex()).toBe(0);
    bridge.setMode('highlight');
    bridge.handleKey({ key: '4' });
    expect(bridge.getColorIndex()).toBe(3);
  });

  it('leaves the armed colour index alone when the index is out of range', () => {
    const { bridge } = setup();
    bridge.setHighlightColorIndex(2);
    bridge.setHighlightColorIndex(99);
    expect(bridge.getColorIndex()).toBe(2);
  });

  it('sets free text size and color', () => {
    const { setParam, bridge } = setup();
    bridge.setFreeTextSize(20);
    bridge.setFreeTextColor('#112233');
    expect(setParam).toHaveBeenCalledWith(EDITOR_PARAM.FREETEXT_SIZE, 20);
    expect(setParam).toHaveBeenCalledWith(EDITOR_PARAM.FREETEXT_COLOR, '#112233');
  });
});
