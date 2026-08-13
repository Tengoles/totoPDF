import '../ui/styles.css';
import { createAnnotationBridge } from '../core/annotation-bridge';
import { loadFromOrigin, parseViewerQuery } from '../core/document-source';
import { loadSettings, paletteToHighlightColors } from '../core/settings';
import { renderToolbar } from '../ui/toolbar';
import { createViewerHost } from './viewer-host';

async function main(): Promise<void> {
  const toolbarRoot = document.querySelector<HTMLElement>('#toolbar');
  const container = document.querySelector<HTMLDivElement>('#viewer-container');
  const viewerDiv = document.querySelector<HTMLDivElement>('#viewer-inner');
  if (!toolbarRoot || !container || !viewerDiv) {
    return;
  }

  const settings = await loadSettings(chrome.storage.local);
  const host = createViewerHost(container, viewerDiv, paletteToHighlightColors(settings.palette));
  const bridge = createAnnotationBridge(host.eventBus, settings.palette, {
    color: settings.freeTextColor,
    size: settings.freeTextSize,
  });

  const origin = parseViewerQuery(location.search);

  renderToolbar(toolbarRoot, {
    palette: settings.palette,
    bridge,
    canHighlight: true,
    canSave: true,
    onSave: () => console.info('save is wired in Task 12'),
    onOpenInChrome: () => {
      // parseViewerQuery only ever returns a fetchable origin ('local' | 'remote') or
      // null; a dropped file never reaches this page as a query-string origin.
      if (origin) {
        location.href = origin.url;
      }
    },
  });

  // Test hook, never present in normal use. The e2e specs load the viewer with ?e2e=1.
  if (new URLSearchParams(location.search).has('e2e')) {
    Object.assign(window, { __totopdfHost: host });
  }

  if (origin) {
    const loaded = await loadFromOrigin(origin);
    await host.open(loaded.bytes);
  }
}

void main();
