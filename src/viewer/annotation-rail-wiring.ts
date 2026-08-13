import { buildRailItems } from '../core/annotation-index';
import { renderAnnotationRail } from '../ui/annotation-rail';
import type { DocumentController } from './document-controller';
import type { ViewerHost } from './viewer-host';

/**
 * Wires the right-hand annotation rail to the document that is open now.
 *
 * The returned refresh is deliberately handed back rather than kept private:
 * the rail is a view of one specific document, so it has to be rebuilt on
 * every document open as well as on every editor change. Left to editor
 * events alone it kept listing the previous book's highlights after a switch,
 * and clicking one set viewer.currentPageNumber to a page number that meant
 * nothing in the new document. This mirrors what createThumbnailWiring
 * already does.
 *
 * The event is "editingstateschanged". An earlier revision used
 * "annotationeditorstateschanged", which is dispatched nowhere in
 * pdfjs-dist@6.2.108 -- it recorded nothing while appearing to work. The
 * journal tracker in document-controller.ts subscribes to the same real event
 * separately.
 */
export function createAnnotationRailWiring(
  host: ViewerHost,
  controller: DocumentController,
): () => void {
  const root = document.querySelector<HTMLElement>('#annotation-rail');

  const refresh = (): void => {
    if (!root) {
      return;
    }
    const storage = controller.currentPdf()?.annotationStorage.serializable ?? null;
    renderAnnotationRail(root, buildRailItems(storage), (item) => {
      host.viewer.currentPageNumber = item.pageNumber;
    });
  };

  host.eventBus.on('editingstateschanged', refresh);
  return refresh;
}
