import { viewerUrlFor } from './interception';

const MENU_ID = 'totopdf-open';

function openInViewer(pdfUrl: string, tabId: number | undefined, inNewTab: boolean): void {
  const url = viewerUrlFor(pdfUrl, chrome.runtime.getURL('viewer.html'));
  if (inNewTab || tabId === undefined) {
    void chrome.tabs.create({ url });
    return;
  }
  void chrome.tabs.update(tabId, { url });
}

/**
 * Creates the menu item. Menu items persist across service worker restarts, so
 * this only needs to run on install. `file:///*` patterns are included because
 * local paths the redirect rule refuses (those containing '&') reach totoPDF
 * only through this route.
 */
export function installContextMenu(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Open in totoPDF',
      contexts: ['link', 'page'],
      targetUrlPatterns: ['*://*/*.pdf', '*://*/*.PDF', 'file:///*.pdf', 'file:///*.PDF'],
      documentUrlPatterns: ['*://*/*', 'file:///*'],
    });
  });
}

/**
 * Registers the click handlers. MUST be called synchronously at the top level of
 * the service worker, on every startup -- NOT from inside onInstalled. MV3 only
 * dispatches events to listeners registered during the worker's startup pass, so
 * a listener added inside onInstalled stops working the first time the worker is
 * evicted for idleness, silently and permanently.
 */
export function registerMenuHandlers(): void {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== MENU_ID) {
      return;
    }
    if (info.linkUrl) {
      // Opening a link should not replace the page the user is reading.
      openInViewer(info.linkUrl, tab?.id, true);
      return;
    }
    if (info.pageUrl) {
      openInViewer(info.pageUrl, tab?.id, false);
    }
  });

  chrome.action.onClicked.addListener((tab) => {
    if (tab.url) {
      openInViewer(tab.url, tab.id, false);
    }
  });
}
