# src/background

The MV3 service worker. Small, and every file in it is shaped by one fact:
this worker is evicted when idle and restarted on demand.

## The rule that will silently break things

**Register every `chrome.*` event listener synchronously, at the top level of
the worker's startup pass.** MV3 only dispatches events to listeners
registered during that pass. A listener added later — inside `onInstalled`,
inside a promise, inside a callback — works right up until the worker is
evicted for idleness, and then stops forever, silently, with no error.

`registerMenuHandlers()` is called at module top level for exactly this
reason. `installContextMenu()` is different: it *creates* the menu item, and
menu items persist across restarts, so it runs from `onInstalled` and
`onStartup` rather than every wake.

## Why `installContextMenu` runs on startup too

The menu title comes from `t('contextMenuOpen')`, so it is resolved when the
item is created and Chrome stores that literal. Creating it only on install
would leave a user who later switches Chrome to Spanish with a fully Spanish
UI and one permanently English right-click entry. `onStartup` fires on
browser restart, which is exactly when a UI-language change takes effect.
`removeAll()` then `create()` is idempotent — `create` runs inside the
`removeAll` callback, so the wipe completes first and no duplicate appears.

## Permissions

The manifest requests exactly `declarativeNetRequest`, `contextMenus`,
`storage`, plus the `file:///*` host permission. Nothing else. Both sets are
asserted by tests, and both were narrowed deliberately for store submission.

`file:///*` rather than `<all_urls>` because totoPDF opens local files only —
`parseViewerQuery` rejects any URL that is not `file://`, so there is nothing
for web access to do. The context menu's patterns are scoped to `file:///*`
for the same reason: it could not open a web PDF even if it appeared there.

Things that do **not** need a permission and must not cause one to be added:

- `chrome.tabs.create` and `chrome.tabs.update` — neither requires `tabs`.
- Reading `tab.url` in `chrome.action.onClicked` — supplied by the host
  permission, which is separate from the `tabs` permission. Verified in a
  real browser, not assumed.

`webNavigation` was removed along with `installNavigationFallback`. If the
declarativeNetRequest redirect ever stops applying to `file://`, that
function is in git history at commit `3899523` — restoring it means restoring
the permission too, and re-justifying it to store review.

## Interception

`declarativeNetRequest` cannot percent-encode a captured group, so the
redirect rule substitutes the raw file URL and its condition therefore
**refuses** to match any path containing `&` or `#`. Those fall through to
Chrome's own viewer deliberately — mangling the path would be worse. The
context menu and the toolbar action both build the URL with
`encodeURIComponent`, so they handle those paths intact. This is a design
decision, not a gap to close.

`allowNativeViewerOnce` opens a 10-second session rule so a single navigation
reaches Chrome's built-in viewer, then re-arms.
