# src/viewer

The wiring layer. This is the only place that owns pdf.js, and the only place
where a document, the DOM, storage and the toolbar all meet.

## What this layer is for

`src/core` holds logic that cannot see a browser; `src/ui` holds controls that
cannot see pdf.js. Neither can open a document on its own. This directory
implements the interfaces `src/ui` declares — `ZoomController`,
`PageController`, `SaveStatusSource` — over a real `PDFViewer`, and owns the
lifecycle nobody else can.

`viewer-host.ts` is the pdf.js boundary. Prefer adding to it over importing
pdf.js into a new file.

## pdf.js behaviour that is not obvious and cost real debugging

**A dropped loading task keeps the whole document alive.** Every document gets
its own Web Worker holding the file, and only `loadingTask.destroy()`
terminates it. `viewer-host.ts` parks superseded tasks in a pool rather than
destroying them immediately, because only the caller knows when the
replacement has actually taken — destroying the outgoing document while an
open is still in flight tears down what the user is reading if that open then
fails.

**`getDocument` detaches the array you hand it.** `bytes.buffer` is
transferred to the worker; the caller's `bytes` is unusable afterwards.

**`updateParams` targets the selection, not the defaults, when something is
selected.** The mode switch is async and unselects last, so a colour armed
synchronously inside `setMode` can land while the previous editor is still
selected — observed as a text box coming out in pdf.js's black at size 10
instead of the toolbar's settings. `main.ts` re-applies on
`annotationeditormodechanged`, which fires once the switch has finished.

**pdf.js announces an editor change before the editor exists in storage.**
`editingstateschanged` is dispatched from inside `AnnotationEditorLayer.add()`,
several statements before that same call stack reaches
`addToAnnotationStorage()`. Reading `annotationStorage` synchronously in that
handler therefore sees the document as it was *before* the edit. A text
highlight hides it: it is selected right after it is added, and the selection
fires a second event by which time the storage is written. A drawn highlight is
never auto-selected, so that second event never comes — the rail listed
nothing, the journal recorded nothing, and the document called itself clean, so
neither autosave nor the tab-close warning ran. `onEditorChangeSettled` in
`editor-change-events.ts` is the one subscription point, and it defers to a
microtask. Do not subscribe to the raw event.

**A drawn highlight is not a `/Highlight`.** pdf.js writes the text-selected
kind as `/Highlight` with QuadPoints quoting the words, and the drawn kind as
`/Ink` with `/IT /InkHighlight`. Anything matching highlights by subtype has to
know both, which is why `annotation-index.ts` keys off the intent.

**pdf.js caches the highlight colour list at construction.** The built-in
colour menu it renders keeps offering whatever `PDFViewer` was given when it
was built, so a palette recolour reaches the toolbar's swatches immediately
but that menu only after a reload.

**`pdf_viewer.css` is required, not optional.** It defines
`--total-scale-factor`, which pdf.js sizes every page with. Without it every
page computes to zero width, no canvas is rasterized, and the viewer looks
blank with no error.

## Saving

Saving appends an incremental update. The original bytes are never rewritten
— that is the whole design, and `src/core/save-pipeline.ts` asserts it.

**Autosave never prompts, by construction.** Both the file picker and the
write-permission prompt need transient user activation, which a timer running
two seconds after the last keystroke does not have. So it writes only when a
handle is already stored and its `readwrite` permission already reads
`granted`; otherwise it writes nothing and says so. Do not "fix" this by
prompting — a dialog nobody asked for, fired by a timer, is worse than not
saving.

The three facts that must always agree — the bytes, the file they belong in,
and what may be done to them — live in one immutable `OpenDocument` record so
switching documents is a single reference swap. Holding them separately is
what once let a save build one document's bytes and resolve another
document's handle.

## Startup

`main.ts` sets `document.documentElement.lang` from `t('uiLanguage')`, not
from `chrome.i18n.getUILanguage()`. The catalogue that rendered the page is
the language of the text; the browser's UI language is not. Only `en` and
`es` ship, so a French-locale user reads English and the page must say so.
