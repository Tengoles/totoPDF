import { installContextMenu, registerMenuHandlers } from './context-menu';
import { installInterception } from './interception';

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
