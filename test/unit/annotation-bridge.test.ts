import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PALETTE } from '../../src/core/settings';
import { EDITOR_PARAM, EDITOR_TYPE, createAnnotationBridge } from '../../src/core/annotation-bridge';

function setup() {
  const dispatch = vi.fn();
  const bridge = createAnnotationBridge({ dispatch }, DEFAULT_PALETTE);
  return { dispatch, bridge };
}

describe('annotation bridge', () => {
  it('arms the highlight editor with the active color', () => {
    const { dispatch, bridge } = setup();
    bridge.setMode('highlight');

    expect(dispatch).toHaveBeenCalledWith('switchannotationeditormode', {
      source: bridge,
      mode: EDITOR_TYPE.HIGHLIGHT,
    });
    expect(dispatch).toHaveBeenCalledWith('switchannotationeditorparams', {
      source: bridge,
      type: EDITOR_PARAM.HIGHLIGHT_COLOR,
      value: DEFAULT_PALETTE[0]?.hex,
    });
  });

  it('switches to the free text editor', () => {
    const { dispatch, bridge } = setup();
    bridge.setMode('textbox');
    expect(dispatch).toHaveBeenCalledWith('switchannotationeditormode', {
      source: bridge,
      mode: EDITOR_TYPE.FREETEXT,
    });
  });

  it('disarms back to none', () => {
    const { dispatch, bridge } = setup();
    bridge.setMode('highlight');
    bridge.setMode('none');
    expect(dispatch).toHaveBeenLastCalledWith('switchannotationeditormode', {
      source: bridge,
      mode: EDITOR_TYPE.NONE,
    });
    expect(bridge.getMode()).toBe('none');
  });

  it('maps number keys 1-5 to palette entries while highlighting', () => {
    const { dispatch, bridge } = setup();
    bridge.setMode('highlight');
    dispatch.mockClear();

    expect(bridge.handleKey({ key: '3' })).toBe(true);
    expect(dispatch).toHaveBeenCalledWith('switchannotationeditorparams', {
      source: bridge,
      type: EDITOR_PARAM.HIGHLIGHT_COLOR,
      value: DEFAULT_PALETTE[2]?.hex,
    });
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

  it('sets free text size and color', () => {
    const { dispatch, bridge } = setup();
    bridge.setFreeTextSize(20);
    bridge.setFreeTextColor('#112233');
    expect(dispatch).toHaveBeenCalledWith('switchannotationeditorparams', {
      source: bridge,
      type: EDITOR_PARAM.FREETEXT_SIZE,
      value: 20,
    });
    expect(dispatch).toHaveBeenCalledWith('switchannotationeditorparams', {
      source: bridge,
      type: EDITOR_PARAM.FREETEXT_COLOR,
      value: '#112233',
    });
  });
});
