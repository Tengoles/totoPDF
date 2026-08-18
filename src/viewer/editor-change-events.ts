import type { ViewerHost } from './viewer-host';

/**
 * Subscribes to annotation-editor changes and calls back once the change has
 * actually settled.
 *
 * The deferral is the entire point. pdf.js dispatches 'editingstateschanged'
 * from inside AnnotationEditorLayer.add(), several statements before the same
 * call stack reaches addToAnnotationStorage() -- so a listener that reads
 * annotationStorage synchronously sees the document as it was *before* the
 * edit. A text highlight hides the bug: it gets selected right after it is
 * added, and that selection dispatches a second event, by which time the
 * storage has been written. A drawn highlight -- the only kind a page with no
 * text layer can take -- is never auto-selected, so that second event never
 * comes and every consumer misses the edit outright: the rail listed nothing,
 * the crash journal recorded nothing, and the document called itself clean, so
 * neither autosave nor the tab-close warning ran.
 *
 * Measured in a real Chromium session: drawing a highlight fired three events,
 * every one of them reporting an empty storage, while a microtask queued from
 * that same handler saw the editor in place.
 */
export function onEditorChangeSettled(host: ViewerHost, listener: () => void): void {
  host.eventBus.on('editingstateschanged', () => {
    queueMicrotask(listener);
  });
}
