import '../ui/styles.css';
import { createViewerHost } from './viewer-host';

const DEFAULT_HIGHLIGHT_COLORS =
  'yellow=#FFF176,green=#81C784,blue=#64B5F6,pink=#F06292,orange=#FFB74D';

const container = document.querySelector<HTMLDivElement>('#viewer-container');
const viewerDiv = document.querySelector<HTMLDivElement>('#viewer-inner');

if (container && viewerDiv) {
  const host = createViewerHost(container, viewerDiv, DEFAULT_HIGHLIGHT_COLORS);
  // Test hook, never present in normal use. The e2e specs load the viewer with ?e2e=1.
  if (new URLSearchParams(location.search).has('e2e')) {
    Object.assign(window, { __totopdfHost: host });
  }
}
