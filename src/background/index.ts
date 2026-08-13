import { installContextMenu, registerMenuHandlers } from './context-menu';
import { allowNativeViewerOnce, installInterception } from './interception';

// Top level, every startup. See registerMenuHandlers' comment: MV3 discards
// listeners that were not registered during the worker's synchronous startup.
registerMenuHandlers();

chrome.runtime.onInstalled.addListener(() => {
  void installInterception();
  installContextMenu();
});

chrome.runtime.onStartup.addListener(() => {
  void installInterception();
});

chrome.runtime.onMessage.addListener((message: { type?: string; url?: string }, _sender, respond) => {
  if (message.type === 'open-native' && message.url) {
    void allowNativeViewerOnce(message.url).then(() => respond({ ok: true }));
    return true;
  }
  return false;
});
