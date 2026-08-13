import { buildSavedBytes } from '../core/save-pipeline';
import type { DocumentController } from './document-controller';
import type { ViewerHost } from './viewer-host';

/**
 * Test hooks, never installed in normal use -- both e2e specs load the viewer
 * with ?e2e=1.
 *
 * __totopdfOpen goes through the same guarded opener a dropped file takes
 * rather than calling host.open directly: that opener is what assigns the
 * document, computes its identity, assesses capabilities, re-applies the armed
 * tool, and asks before discarding unsaved annotations. A hook that bypassed
 * it would exercise a path no user ever takes, and would leave the one
 * document-switch guard that matters untested.
 */
export function setupE2eHooks(
  host: ViewerHost,
  controller: DocumentController,
  openFile: (file: File) => Promise<void>,
): void {
  if (!new URLSearchParams(location.search).has('e2e')) {
    return;
  }
  Object.assign(window, {
    __totopdfHost: host,
    __totopdfOpen: (bytes: number[]): Promise<void> =>
      openFile(new File([new Uint8Array(bytes)], 'e2e.pdf', { type: 'application/pdf' })),
    __totopdfSaveBytes: async (): Promise<number[]> => {
      const pdfDocument = controller.currentPdf();
      if (!pdfDocument) {
        throw new Error('No document open');
      }
      const { bytes } = await buildSavedBytes(pdfDocument);
      return Array.from(bytes);
    },
  });
}
