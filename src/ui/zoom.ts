/**
 * The zoom logic that does not need a browser: the preset list, the readout
 * label, the bounds and the keyboard mapping. No DOM and no pdf.js import, so
 * all of it is unit-testable under vitest's node environment.
 *
 * Every `value` below is a string PDFViewer's `currentScaleValue` setter
 * accepts. Anything else makes pdf.js log "unknown zoom value" and leave the
 * scale where it was, so these are not free-form names.
 */

/** pdf.js clamps every scale it computes to these (ui_utils MIN_SCALE/MAX_SCALE). */
export const MIN_SCALE = 0.1;
export const MAX_SCALE = 25;

/** What a document opens at, and what Ctrl+0 goes back to. */
export const DEFAULT_SCALE_VALUE = 'page-width';

export interface ZoomState {
  /** `currentScaleValue`: a fit-mode name, or a numeric string like '1.25'. */
  scaleValue: string;
  /** `currentScale`: the number a fit mode actually resolved to. */
  scale: number;
}

/**
 * The viewer's scale, as much of it as the toolbar needs. Implemented over
 * pdf.js in viewer-host.ts; declared here so the controls can be built and
 * reasoned about without pulling PDFViewer in.
 */
export interface ZoomController {
  state(): ZoomState;
  /** Both step pdf.js's own ladder rather than multiplying a scale by hand. */
  zoomIn(): void;
  zoomOut(): void;
  /** Applies one of ZOOM_PRESETS' values. */
  apply(scaleValue: string): void;
  reset(): void;
  /**
   * Reports every scale change until the signal aborts. The state is read back
   * off the viewer each time: a fit mode resolves to a number only pdf.js
   * knows, and it recomputes that number without being asked.
   */
  subscribe(listener: (state: ZoomState) => void, signal: AbortSignal): void;
  /** Ctrl+wheel over the pages, until the signal aborts. */
  bindWheel(signal: AbortSignal): void;
}

export interface ZoomPreset {
  /** Passed to ZoomController.apply verbatim. */
  value: string;
  label: string;
}

/** The values that name a mode instead of a number, and what to call them. */
const FIT_LABELS = new Map<string, string>([
  ['page-width', 'Fit width'],
  ['page-fit', 'Fit page'],
  ['page-actual', 'Actual size'],
]);

const PERCENT_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/**
 * A fit mode is shown by name because its percentage is a consequence, not the
 * setting -- "Fit width" stays true after a resize, "118%" would not.
 */
export function formatScaleLabel(scaleValue: string, scale: number): string {
  return FIT_LABELS.get(scaleValue) ?? `${Math.round(scale * 100)}%`;
}

export const ZOOM_PRESETS: readonly ZoomPreset[] = [
  ...PERCENT_PRESETS.map((scale) => ({
    value: String(scale),
    // Labelled through the same function that drives the readout, so picking
    // "125%" cannot show anything other than "125%" afterwards.
    label: formatScaleLabel(String(scale), scale),
  })),
  ...[...FIT_LABELS].map(([value, label]) => ({ value, label })),
];

/** At the bounds pdf.js silently does nothing, so the buttons say so instead. */
export function canZoomIn(scale: number): boolean {
  return scale < MAX_SCALE;
}

export function canZoomOut(scale: number): boolean {
  return scale > MIN_SCALE;
}

export type ZoomKeyAction = 'in' | 'out' | 'reset';

/** The parts of a KeyboardEvent the shortcuts read; a real one satisfies it. */
export interface ZoomKeyEvent {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

/**
 * Ctrl+= and Ctrl++ in, Ctrl+- out, Ctrl+0 back to the opening fit. '+' and
 * '_' are what the same two physical keys report while Shift is held, and both
 * are accepted because Chrome's own zoom accepts both. Alt or Meta held means
 * some other shortcut is being pressed, so nothing is claimed.
 */
export function zoomKeyAction(event: ZoomKeyEvent): ZoomKeyAction | null {
  if (!event.ctrlKey || event.altKey || event.metaKey) {
    return null;
  }
  switch (event.key) {
    case '+':
    case '=':
      return 'in';
    case '-':
    case '_':
      return 'out';
    case '0':
      return 'reset';
    default:
      return null;
  }
}

export function applyZoomAction(zoom: ZoomController, action: ZoomKeyAction): void {
  if (action === 'in') {
    zoom.zoomIn();
    return;
  }
  if (action === 'out') {
    zoom.zoomOut();
    return;
  }
  zoom.reset();
}
