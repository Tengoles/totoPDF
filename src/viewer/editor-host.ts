import type { EventBus, PDFViewer } from 'pdfjs-dist/web/pdf_viewer.mjs';
import type { EditorHost } from '../core/annotation-bridge';

/**
 * Binds the annotation bridge to a real pdf.js viewer.
 *
 * Mode and parameters take different routes, and this is not a style choice:
 * nothing in web/pdf_viewer.mjs listens for 'switchannotationeditormode'.
 * pdf.js EMITS that event outbound to notify a host application; the inbound
 * handler lives in web/app.js, the full viewer app this project does not ship.
 * Dispatching it silently does nothing. The property setter is the only way in.
 *
 * AnnotationEditorUIManager does subscribe to 'switchannotationeditorparams',
 * so parameters genuinely go over the bus.
 */
export function createEditorHost(viewer: PDFViewer, eventBus: EventBus): EditorHost {
  return {
    setMode(mode) {
      // No-ops until a document is loaded, hence AnnotationBridge.reapply().
      viewer.annotationEditorMode = { mode };
    },
    setParam(type, value) {
      eventBus.dispatch('switchannotationeditorparams', { source: viewer, type, value });
    },
  };
}
