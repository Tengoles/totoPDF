import { t } from '../core/i18n';

/**
 * The toolbar's one-word answer to "is my work in the file?". Declared here
 * rather than in the viewer for the same reason ZoomController is: the control
 * has to be buildable and readable without pulling pdf.js in, and the viewer
 * implements the contract from the other side.
 */

export type SaveStatus =
  /** Nothing worth saying: no document, or an untouched one never saved yet. */
  | 'none'
  /** Edits exist that are not in the file. Autosave may be pending, off, or unavailable. */
  | 'unsaved'
  /** A write is in flight right now, automatic or from Ctrl+S. */
  | 'saving'
  /** Everything in the document is in the file. */
  | 'saved';

export interface SaveStatusSource {
  state(): SaveStatus;
  /**
   * Reports every change until the signal aborts. The toolbar is rebuilt from
   * scratch on each document, so without the signal each rebuild would leave
   * the previous readout still subscribed and still being written to.
   */
  subscribe(listener: (status: SaveStatus) => void, signal: AbortSignal): void;
}

/**
 * Words, not a coloured dot. A colour alone cannot say which of "not written
 * yet" and "being written right now" is true, and those call for different
 * things from the reader: one means wait, the other means press Ctrl+S.
 */
const LABELS: Record<SaveStatus, string> = {
  none: '',
  unsaved: t('saveStatusUnsaved'),
  saving: t('saveStatusSaving'),
  saved: t('saveStatusSaved'),
};

const TITLES: Record<SaveStatus, string> = {
  none: '',
  unsaved: t('saveStatusUnsavedTitle'),
  saving: t('saveStatusSavingTitle'),
  saved: t('saveStatusSavedTitle'),
};

export function createSaveStatusReadout(
  source: SaveStatusSource,
  signal: AbortSignal,
): HTMLSpanElement {
  const element = document.createElement('span');
  element.className = 'save-status';
  // A live region, so a change is announced rather than only being read if the
  // toolbar happens to be traversed at the right moment.
  element.setAttribute('role', 'status');

  function apply(status: SaveStatus): void {
    element.textContent = LABELS[status];
    element.title = TITLES[status];
    element.dataset.status = status;
  }

  apply(source.state());
  source.subscribe(apply, signal);
  return element;
}
