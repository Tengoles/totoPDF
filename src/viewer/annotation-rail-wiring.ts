import { mergeRailItems, type RailItem } from '../core/annotation-index';
import { renderAnnotationRail } from '../ui/annotation-rail';
import { scanPersistedAnnotations, type PersistedScan } from './annotation-scan';
import { onEditorChangeSettled } from './editor-change-events';
import type { DocumentController } from './document-controller';
import type { ViewerHost } from './viewer-host';

/**
 * Wires the right-hand annotation rail to the document that is open now.
 *
 * The rail has two sources and needs both. `annotationStorage` holds only what
 * this session created or modified, so on its own it reported "Annotations (0)"
 * for a book annotated yesterday -- the rail's entire reason for existing (§11)
 * is finding a highlight again in a 1000-page document, which it cannot do if
 * reopening the file empties it. The document's own annotations come from a
 * per-page getAnnotations() scan instead, merged with the storage entries and
 * de-duplicated by annotation id.
 *
 * The scan runs once per document, not once per refresh: getAnnotations()
 * caches nothing, so re-scanning on every editor change would be a thousand
 * worker round-trips per keystroke. Its results accumulate here and are merged
 * fresh on each render, so an edit to a saved annotation shows immediately
 * without any re-reading of the file.
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
  let scan: PersistedScan | null = null;
  let scanned: ReturnType<DocumentController['currentPdf']> = null;
  let persisted: RailItem[] = [];

  const render = (): void => {
    if (!root) {
      return;
    }
    const storage = controller.currentPdf()?.annotationStorage.serializable ?? null;
    renderAnnotationRail(root, mergeRailItems(persisted, storage), (item) => {
      host.viewer.currentPageNumber = item.pageNumber;
    });
  };

  const rescanIfDocumentChanged = (): void => {
    const pdfDocument = controller.currentPdf();
    if (pdfDocument === scanned) {
      return;
    }
    // cancel() before the reset, so no batch from the outgoing document's scan
    // can land in the incoming document's list.
    scan?.cancel();
    scanned = pdfDocument;
    persisted = [];
    scan = pdfDocument
      ? scanPersistedAnnotations(pdfDocument, (items) => {
          persisted = [...persisted, ...items];
          render();
        })
      : null;
  };

  const refresh = (): void => {
    rescanIfDocumentChanged();
    render();
  };

  onEditorChangeSettled(host, refresh);
  return refresh;
}
