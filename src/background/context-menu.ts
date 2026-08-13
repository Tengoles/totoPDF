import { viewerUrlFor } from './interception';

const MENU_ID = 'totopdf-open';

function openInViewer(pdfUrl: string, tabId: number | undefined): void {
  const url = viewerUrlFor(pdfUrl, chrome.runtime.getURL('viewer.html'));
  if (tabId === undefined) {
    void chrome.tabs.create({ url });
    return;
  }
  void chrome.tabs.update(tabId, { url });
}

export function installContextMenu(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Open in totoPDF',
      contexts: ['link', 'page'],
      targetUrlPatterns: ['*://*/*.pdf', '*://*/*.PDF'],
      documentUrlPatterns: ['*://*/*'],
    });
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== MENU_ID) {
      return;
    }
    const target = info.linkUrl ?? info.pageUrl;
    if (target) {
      openInViewer(target, tab?.id);
    }
  });

  chrome.action.onClicked.addListener((tab) => {
    if (tab.url) {
      openInViewer(tab.url, tab.id);
    }
  });
}
