import type { AnnotationBridge } from '../core/annotation-bridge';
import { t } from '../core/i18n';

/**
 * The text box tool's colour and size fields. Extracted from toolbar.ts when
 * the zoom controls pushed that file past the size limit; nothing about the
 * behaviour changed in the move.
 */

/** pdf.js accepts any positive size; these are the bounds the number input offers. */
const MIN_TEXT_SIZE = 6;
const MAX_TEXT_SIZE = 96;

export interface TextBoxControlOptions {
  bridge: AnnotationBridge;
  freeTextColor: string;
  freeTextSize: number;
  onTextColorChange(hex: string): void;
  onTextSizeChange(size: number): void;
}

/** A visible caption next to the control, so neither input is a bare box. */
function labeled(caption: string, control: HTMLElement): HTMLLabelElement {
  const label = document.createElement('label');
  label.className = 'field';
  const text = document.createElement('span');
  text.textContent = caption;
  label.append(text, control);
  return label;
}

export function createTextBoxControls(options: TextBoxControlOptions): HTMLElement[] {
  const { bridge, onTextColorChange, onTextSizeChange } = options;

  const color = document.createElement('input');
  color.type = 'color';
  color.value = options.freeTextColor;
  color.title = t('textColorTitle');
  color.addEventListener('input', () => {
    bridge.setFreeTextColor(color.value);
    onTextColorChange(color.value);
  });

  const size = document.createElement('input');
  size.type = 'number';
  size.min = String(MIN_TEXT_SIZE);
  size.max = String(MAX_TEXT_SIZE);
  size.step = '1';
  size.value = String(options.freeTextSize);
  size.title = t('textSizeTitle', String(MIN_TEXT_SIZE), String(MAX_TEXT_SIZE));
  size.addEventListener('input', () => {
    const value = Number(size.value);
    // A half-typed or out-of-range entry is ignored rather than clamped:
    // clamping while typing rewrites "1" to "6" before "14" can be finished.
    if (!Number.isInteger(value) || value < MIN_TEXT_SIZE || value > MAX_TEXT_SIZE) {
      return;
    }
    bridge.setFreeTextSize(value);
    onTextSizeChange(value);
  });

  return [labeled(t('textColorLabel'), color), labeled(t('textSizeLabel'), size)];
}
