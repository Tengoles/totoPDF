import { t } from '../core/i18n';
import type { DocumentController } from './document-controller';

const UNSAVED_SWITCH_WARNING = t('unsavedSwitchWarning');

/**
 * A crash or an accidental tab close should not silently lose unsaved
 * annotations. Warn before the tab unloads while the journal is the only
 * copy of them left.
 */
export function setupUnloadGuard(controller: DocumentController): void {
  window.addEventListener('beforeunload', (event) => {
    if (controller.isDirty()) {
      event.preventDefault();
    }
  });
}

/**
 * beforeunload never fires for an in-page document switch, so it cannot cover
 * the likelier way to lose a session's work: dropping a second book onto a
 * viewer holding thirty unsaved highlights. Every entry point that replaces
 * the open document asks first.
 */
export function confirmDiscardUnsaved(controller: DocumentController): boolean {
  return !controller.isDirty() || window.confirm(UNSAVED_SWITCH_WARNING);
}
