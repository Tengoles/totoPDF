import { installContextMenu } from './context-menu';
import { installInterception } from './interception';

chrome.runtime.onInstalled.addListener(() => {
  void installInterception();
  installContextMenu();
});

chrome.runtime.onStartup.addListener(() => {
  void installInterception();
});
