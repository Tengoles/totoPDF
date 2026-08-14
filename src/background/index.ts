import { installContextMenu, registerMenuHandlers } from './context-menu';
import { allowNativeViewerOnce, installInterception } from './interception';

// Top level, every startup. See registerMenuHandlers' comment: MV3 discards
// listeners that were not registered during the worker's synchronous startup.
registerMenuHandlers();

chrome.runtime.onInstalled.addListener((details) => {
  void installInterception();
  installContextMenu();
  // Only a first install. 'update' and 'chrome_update' would reopen this on
  // every release, which is the behaviour everyone hates.
  if (details.reason === 'install') {
    void chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  }
});

chrome.runtime.onStartup.addListener(() => {
  void installInterception();
  // Chrome persists context menu items across service worker restarts, so a
  // title built from t() at install time is stuck in whatever language Chrome
  // was in then. Changing Chrome's UI language requires a browser restart,
  // which is exactly when onStartup fires, so rebuilding the menu here is
  // what keeps its title in step with a language switch.
  installContextMenu();
});

chrome.runtime.onMessage.addListener((message: { type?: string; url?: string }, _sender, respond) => {
  if (message.type === 'open-native' && message.url) {
    void allowNativeViewerOnce(message.url).then(() => respond({ ok: true }));
    return true;
  }
  return false;
});
