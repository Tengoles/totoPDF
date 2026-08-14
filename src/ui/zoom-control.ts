import { t } from '../core/i18n';
import { bindPopoverDismiss } from './popover';
import {
  canZoomIn,
  canZoomOut,
  formatScaleLabel,
  ZOOM_PRESETS,
  type ZoomController,
  type ZoomPreset,
  type ZoomState,
} from './zoom';

/**
 * The minus/readout/plus group. Lives outside toolbar.ts to keep both files
 * inside the size limit, and takes its teardown signal from the toolbar so the
 * popover's document-level listeners die with the rest of them.
 */

/**
 * '+' and '−' carry no meaning to a screen reader and no tooltip on their
 * own, so each states what it does and which key does the same thing.
 */
function stepButton(symbol: string, description: string, onClick: () => void): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'zoom-step';
  element.textContent = symbol;
  element.title = description;
  element.setAttribute('aria-label', description);
  element.addEventListener('click', onClick);
  return element;
}

function presetButton(preset: ZoomPreset, onPick: () => void): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'zoom-preset';
  element.textContent = preset.label;
  element.addEventListener('click', onPick);
  return element;
}

interface ZoomMenu {
  element: HTMLElement;
  /** The trigger doubles as the readout, so the label lives on it. */
  readout: HTMLButtonElement;
}

/** The percentage readout and the preset list it opens. */
function createZoomMenu(zoom: ZoomController, signal: AbortSignal): ZoomMenu {
  const wrapper = document.createElement('span');
  wrapper.className = 'zoom-menu';

  const readout = document.createElement('button');
  readout.type = 'button';
  readout.className = 'zoom-readout';
  readout.title = t('zoomReadoutTitle');
  readout.setAttribute('aria-expanded', 'false');

  const popover = document.createElement('div');
  popover.className = 'zoom-popover';
  popover.hidden = true;

  function setOpen(open: boolean): void {
    popover.hidden = !open;
    readout.setAttribute('aria-expanded', String(open));
  }

  // Built once rather than per open: unlike the palette, nothing in this list
  // changes while the toolbar is up.
  popover.append(
    ...ZOOM_PRESETS.map((preset) =>
      presetButton(preset, () => {
        zoom.apply(preset.value);
        setOpen(false);
      }),
    ),
  );

  readout.addEventListener('click', () => setOpen(popover.hidden));
  bindPopoverDismiss({ wrapper, popover, trigger: readout, close: () => setOpen(false), signal });

  wrapper.append(readout, popover);
  return { element: wrapper, readout };
}

export function createZoomControls(zoom: ZoomController, signal: AbortSignal): HTMLElement {
  const out = stepButton('−', t('zoomOutTitle'), () => zoom.zoomOut());
  const into = stepButton('+', t('zoomInTitle'), () => zoom.zoomIn());
  const menu = createZoomMenu(zoom, signal);

  function sync(state: ZoomState): void {
    menu.readout.textContent = formatScaleLabel(state.scaleValue, state.scale);
    // At pdf.js's bounds the step calls do nothing at all; a disabled button
    // says so instead of leaving a click unexplained.
    out.disabled = !canZoomOut(state.scale);
    into.disabled = !canZoomIn(state.scale);
  }

  // The readout follows pdf.js's own scalechanging event, so it is right after
  // a preset, a step, Ctrl+wheel, or a fit mode recomputing on its own.
  zoom.subscribe(sync, signal);
  sync(zoom.state());

  const group = document.createElement('span');
  group.className = 'zoom-controls';
  group.append(out, menu.element, into);
  return group;
}
