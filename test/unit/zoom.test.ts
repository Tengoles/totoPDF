import { describe, expect, it } from 'vitest';
import {
  applyZoomAction,
  canZoomIn,
  canZoomOut,
  DEFAULT_SCALE_VALUE,
  formatScaleLabel,
  MAX_SCALE,
  MIN_SCALE,
  ZOOM_PRESETS,
  type ZoomController,
  type ZoomKeyEvent,
  zoomKeyAction,
} from '../../src/ui/zoom';

/** A plain object is enough: zoomKeyAction reads four fields and nothing else. */
function key(k: string, modifiers: Partial<ZoomKeyEvent> = {}): ZoomKeyEvent {
  return { key: k, ctrlKey: true, altKey: false, metaKey: false, ...modifiers };
}

describe('formatScaleLabel', () => {
  it.each([
    [1, '100%'],
    [0.5, '50%'],
    [0.75, '75%'],
    [1.25, '125%'],
    [2, '200%'],
    [MIN_SCALE, '10%'],
    [MAX_SCALE, '2500%'],
  ])('renders the numeric scale %o as %s', (scale, expected) => {
    expect(formatScaleLabel(String(scale), scale)).toBe(expected);
  });

  it('rounds a scale that is not a whole percent to the nearest one', () => {
    expect(formatScaleLabel('1.255', 1.255)).toBe('125%');
    expect(formatScaleLabel('1.256', 1.256)).toBe('126%');
  });

  it('never leaves a fraction in the percentage', () => {
    for (const scale of [1.1, 1.21, 0.909, 1.0000001, 3.3333]) {
      expect(formatScaleLabel(String(scale), scale)).toMatch(/^\d+%$/);
    }
  });

  it.each([
    ['page-width', 'Fit width'],
    ['page-fit', 'Fit page'],
    ['page-actual', 'Actual size'],
  ])('names the fit mode %s rather than showing a percentage', (scaleValue, expected) => {
    // The resolved scale is deliberately odd: a fit mode is named whatever it
    // currently works out to, because that number changes on its own.
    expect(formatScaleLabel(scaleValue, 1.1834)).toBe(expected);
  });

  it("falls back to the percentage for pdf.js's other scale values", () => {
    // 'auto' and 'page-height' are values pdf.js can set itself (a document
    // destination asks for them); they have no button, so the readout reports
    // the number rather than an empty label.
    expect(formatScaleLabel('auto', 1.25)).toBe('125%');
    expect(formatScaleLabel('page-height', 0.8)).toBe('80%');
  });
});

describe('ZOOM_PRESETS', () => {
  it('offers the nine documented choices in order', () => {
    expect(ZOOM_PRESETS.map((preset) => preset.label)).toEqual([
      '50%',
      '75%',
      '100%',
      '125%',
      '150%',
      '200%',
      'Fit width',
      'Fit page',
      'Actual size',
    ]);
  });

  it('maps to the exact currentScaleValue strings pdf.js accepts', () => {
    expect(ZOOM_PRESETS.map((preset) => preset.value)).toEqual([
      '0.5',
      '0.75',
      '1',
      '1.25',
      '1.5',
      '2',
      'page-width',
      'page-fit',
      'page-actual',
    ]);
  });

  it('sets every percentage preset to a value pdf.js reads as a number', () => {
    // pdf.js branches on parseFloat(value) > 0; anything that fails that is
    // looked up as a mode name and rejected with a console error.
    const numeric = ZOOM_PRESETS.filter((preset) => preset.label.endsWith('%'));
    expect(numeric).toHaveLength(6);
    for (const preset of numeric) {
      const parsed = Number.parseFloat(preset.value);
      expect(parsed).toBeGreaterThan(0);
      expect(parsed).toBeGreaterThanOrEqual(MIN_SCALE);
      expect(parsed).toBeLessThanOrEqual(MAX_SCALE);
    }
  });

  it('labels each preset the way the readout will label it once applied', () => {
    for (const preset of ZOOM_PRESETS) {
      expect(formatScaleLabel(preset.value, Number.parseFloat(preset.value))).toBe(preset.label);
    }
  });

  it('includes the value a document opens at, so the opening state has a button', () => {
    expect(ZOOM_PRESETS.some((preset) => preset.value === DEFAULT_SCALE_VALUE)).toBe(true);
  });
});

describe('canZoomIn and canZoomOut', () => {
  it('allows both in the middle of the range', () => {
    expect(canZoomIn(1)).toBe(true);
    expect(canZoomOut(1)).toBe(true);
  });

  it('stops at the bounds pdf.js clamps to', () => {
    expect(canZoomIn(MAX_SCALE)).toBe(false);
    expect(canZoomOut(MIN_SCALE)).toBe(false);
    expect(canZoomIn(MIN_SCALE)).toBe(true);
    expect(canZoomOut(MAX_SCALE)).toBe(true);
  });
});

describe('zoomKeyAction', () => {
  it.each([
    ['=', 'in'],
    ['+', 'in'],
    ['-', 'out'],
    ['_', 'out'],
    ['0', 'reset'],
  ])('maps Ctrl+%s to %s', (pressed, action) => {
    expect(zoomKeyAction(key(pressed))).toBe(action);
  });

  it('ignores the same keys without Ctrl, so typing is untouched', () => {
    for (const pressed of ['=', '+', '-', '_', '0']) {
      expect(zoomKeyAction(key(pressed, { ctrlKey: false }))).toBeNull();
    }
  });

  it('leaves Ctrl+Alt and Ctrl+Meta combinations to whatever owns them', () => {
    expect(zoomKeyAction(key('=', { altKey: true }))).toBeNull();
    expect(zoomKeyAction(key('0', { metaKey: true }))).toBeNull();
  });

  it('claims none of the keys the rest of the toolbar already uses', () => {
    // 1-5 arm palette colours and Ctrl+S saves; a zoom claim on any of them
    // would preventDefault and swallow it.
    for (const pressed of ['1', '2', '3', '4', '5', 's', 'S', 'Escape']) {
      expect(zoomKeyAction(key(pressed))).toBeNull();
    }
  });
});

describe('applyZoomAction', () => {
  function recordingZoom(): { zoom: ZoomController; calls: string[] } {
    const calls: string[] = [];
    const zoom: ZoomController = {
      state: () => ({ scaleValue: DEFAULT_SCALE_VALUE, scale: 1 }),
      zoomIn: () => calls.push('in'),
      zoomOut: () => calls.push('out'),
      apply: (value) => calls.push(`apply:${value}`),
      reset: () => calls.push('reset'),
      subscribe: () => undefined,
      bindWheel: () => undefined,
    };
    return { zoom, calls };
  }

  it.each(['in', 'out', 'reset'] as const)('routes %s to the matching call', (action) => {
    const { zoom, calls } = recordingZoom();
    applyZoomAction(zoom, action);
    expect(calls).toEqual([action]);
  });
});
