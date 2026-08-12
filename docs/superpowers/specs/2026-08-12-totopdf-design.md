# totoPDF — Chrome extension for reading and annotating PDFs

**Date:** 2026-08-12
**Status:** Approved design, ready for implementation planning

## 1. Problem and goals

Chrome's built-in PDF viewer cannot be extended. It is a closed native plugin (PDFium); extensions cannot inject into it, reach its text layer, or add annotations. Any PDF annotation extension must therefore ship its own viewer and register itself as a handler for PDF URLs.

totoPDF is that viewer, built as a personal tool with two annotation capabilities:

- **Text highlighting** with a customizable color palette
- **Text boxes** placed anywhere on a page, with color and size control

The defining requirement: **annotations are written into the PDF file itself as standard PDF annotation objects**, so Acrobat, Preview, Firefox and Chrome's own viewer all render them correctly. This is not an overlay tool with a sidecar database. The PDF file is the artifact.

Success criteria:

1. A highlight made in totoPDF opens correctly in Acrobat, Preview, Firefox, and Chrome's native viewer.
2. A 1000-page scanned book scrolls smoothly and holds steady-state memory under ~400 MB.
3. Saving never corrupts a file, and never silently discards content the tool did not create.
4. Ctrl+S on a local file writes back to that file, not to a copy in Downloads.

## 2. Non-goals for v1

Explicitly out of scope, listed so the boundary is unambiguous:

- Freehand ink or pen drawing
- Sticky notes and point-anchored annotations
- Shapes, stamps, images
- Notes or comments attached to highlights
- Underline, strikethrough and squiggly variants
- Named highlight presets and keyboard-bound semantic categories
- OCR for scanned documents
- Font family selection in text boxes (see §3, decision 8)
- Sync, accounts, backend, multi-device
- PDFs behind authentication (Gmail attachments, Drive previews, portal viewers)
- Chrome Web Store publishing — the extension is loaded unpacked

## 3. Key decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Personal tool, fully client-side. No backend, no accounts. | "Scalable" here means clean module boundaries and bounded memory, not multi-tenancy. |
| 2 | Sources: local files, public web PDFs, drag-and-drop. Auth-walled PDFs excluded. | Covers the real use cases; auth-walled PDFs cost disproportionate complexity for blob URLs and in-page viewers. |
| 3 | Two tools only: text highlight and text box. | Both are text-layer/coordinate operations against the same annotation model. Narrow scope, done correctly. |
| 4 | Annotations written into the PDF as `/Highlight` and `/FreeText` objects with appearance streams. | Hard requirement: other readers must render them. Appearance streams are what make rendering consistent across readers rather than reader-dependent synthesis. |
| 5 | Save via **incremental update** — append new objects plus a new xref, original bytes untouched. | Preserves existing annotations, signatures and structures the tool does not model. Save cost is proportional to edits, not file size. Critical for 200 MB books. |
| 6 | Edit in place via the File System Access API. | Ctrl+S overwrites the original file like a desktop editor, rather than accumulating copies in Downloads. |
| 7 | Build on pdf.js's own `AnnotationEditorLayer` (`HIGHLIGHT`, `FREETEXT`) and `saveDocument()`. | pdf.js already implements the finicky correctness surface — QuadPoints, appearance streams, coordinate transforms, incremental xref writing — and it is Firefox-tested. Roughly a 3x reduction in v1 effort versus a hand-built annotation writer. |
| 8 | Text boxes ship with pdf.js's single default font in v1. | pdf.js exposes color and size but one font family. Adding family selection means patching `/DA` strings and appearance streams — deferred until real use proves it is needed. |
| 9 | Interception: automatic for `file://`, opt-in for web PDFs. | Local files are the ones actually annotated and saved. Web PDFs keep Chrome's fast native viewer until annotation is requested. |
| 10 | Highlight interaction: armed color, instant apply. | One action per highlight, number keys 1-5 swap color. Matches how pdf.js's highlight editor already behaves. Clicking an existing highlight opens a small palette to recolor or delete. |
| 11 | Layout: split rails — thumbnails left, annotation list right, both collapsible. | The annotation rail is how a highlight is ever found again in a 1000-page book. |
| 12 | TypeScript + Vite, no UI framework. | The chrome is a toolbar and two rails; pdf.js is imperative DOM. A framework would be an adapter layer plus bundle weight. A small reactive store suffices. |

## 4. Architecture

### 4.1 Components

```
background/   service worker: interception rules, context menu, tab redirect
viewer/       the extension page that hosts the entire application
core/         document sourcing, annotation index, save pipeline, recovery journal
ui/           toolbar, palette, thumbnail rail, annotation rail, error states
```

Everything except interception runs in the viewer page. The service worker stays thin and stateless — it decides which navigations to redirect and nothing else.

### 4.2 Document sourcing and identity

A single `DocumentSource` module resolves every entry point into one shape:

```ts
{ bytes: ArrayBuffer, identity: string, fileHandle?: FileSystemFileHandle }
```

Three entry points feed it:

1. **Local file** — the service worker observes navigation to a `file://*.pdf` URL and redirects the tab to `viewer.html?src=…`.
2. **Web PDF** — no interception. A toolbar action and a context-menu item ("Annotate in totoPDF") open the current PDF in the viewer.
3. **Drag-and-drop** — a file dropped onto the viewer, or the viewer opened empty.

**Identity is the SHA-256 of the file bytes, not the path.** Moving or renaming a file preserves its stored handle and preferences.

**Write access.** Auto-redirect grants read access only; the File System Access API issues writable handles exclusively through a user-initiated dialog. Therefore the first Ctrl+S on a document opens a native file picker once. The resulting handle is stored in IndexedDB keyed by identity, and every subsequent save — including in future sessions, subject to a permission re-prompt — is silent. Web PDFs and dropped files always Save As.

### 4.3 Interception

Primary mechanism: `declarativeNetRequest` redirect rules for `file://*.pdf`. Requires the user to enable "Allow access to file URLs" once in `chrome://extensions`.

**Fallback if DNR does not reliably match `file://` URLs:** `webNavigation.onBeforeNavigate` plus `tabs.update`. This works but redirects a beat later, producing a brief flash of Chrome's viewer. Which mechanism applies must be determined empirically in the first implementation stage (see §9).

The toolbar always exposes an "Open in Chrome's viewer" escape hatch.

### 4.4 Annotation layer and tools

pdf.js's `PDFViewer` is configured with `annotationEditorMode`. Our toolbar drives it through the event bus:

- `switchannotationeditormode` — `HIGHLIGHT` (9), `FREETEXT` (3), `NONE` (0)
- `switchannotationeditorparams` — `HIGHLIGHT_COLOR`, `FREETEXT_COLOR`, `FREETEXT_SIZE`

**Highlight tool.** Activating it arms the currently selected palette color. Any text selection is highlighted on mouse release. Keys 1-5 swap color without leaving the page; Esc disarms and restores normal text selection. Clicking a highlight **created in totoPDF** opens a small floating palette offering recolor and delete. (Highlights that were already in the file when it was opened are a separate case — see §9.)

**Palette.** Five quick-pick swatches plus a full color picker, with opacity. The palette is user-editable and persisted in `chrome.storage.local`.

**Text box tool.** Click-drag defines a box, type inside it, with color and size controls. Single font family in v1.

**Annotation index.** A `core/annotation-index` module derives the right-hand rail's contents by enumerating pdf.js's `AnnotationStorage`, producing a page-ordered list with a text excerpt for each entry and click-to-jump navigation. pdf.js does not expose per-annotation events, so the index subscribes to storage changes and recomputes rather than listening for granular events.

### 4.5 Save pipeline

1. `pdfDocument.saveDocument()` returns `original bytes + appended objects + new xref` as a `Uint8Array`.
2. Write through the stored handle with `createWritable()`, which stages to a temporary file and swaps on close. A crash mid-save cannot truncate the original.
3. Clear the recovery journal only after the write resolves.

**The incremental-update invariant**, asserted in tests: where N is the original file's length in bytes, `saved.slice(0, N)` is byte-identical to the original file.

pdf.js keeps the document bytes in its worker and returns them at save time, so the main thread never holds a second copy. The source `ArrayBuffer` is **transferred** to the worker rather than copied.

### 4.6 Recovery journal

Not a second source of truth — a crash buffer. Every annotation change debounces 1 s and writes serialized annotation state (small JSON, never PDF bytes) to IndexedDB keyed by document identity. On open, a journal newer than the file's `lastModified` offers a restore. A `beforeunload` guard warns on unsaved changes. Save failure leaves the journal intact.

## 5. Memory and performance budget

Memory is dominated by page canvases, not by the PDF. A canvas costs `width × height × 4` bytes, multiplied by device pixel ratio. A scanned A4 page at 2× zoom on a HiDPI display is roughly 130 MB by itself, and pdf.js's viewer retains a buffer of ten rendered pages by default.

Controls:

| Control | Setting | Effect |
|---|---|---|
| `maxCanvasPixels` | 2^23 (~8.4M px) instead of the 2^25 default | ~16× cut in worst-case canvas memory; CSS upscales, imperceptible on scanned pages |
| Page buffer | 3–5 rendered pages instead of 10 | Re-rendering a scrolled-back page costs ~50 ms; retaining it costs tens of MB |
| DPR clamp | Max 2; 1 for pages above a size threshold | Prevents 4× multiplication on HiDPI displays |
| Canvas eviction | Set `canvas.width = 0` and `canvas.height = 0` explicitly | Chrome does not promptly reclaim canvas backing store on GC alone |
| Thumbnails | ~150 px wide, lazy, LRU-evicted, destroyed when the rail collapses | Keeps the left rail from becoming a second full renderer |
| Document bytes | Transferred to the worker, not copied | Saves the full file size on large books |

**Budget: steady state under ~400 MB on a 1000-page scanned book.** This is asserted by an automated test (§7), not assumed.

## 6. Error states and edge cases

Every one of these needs defined, user-visible behavior. Silent failure is not acceptable, and neither is a corrupt file.

| Case | Behavior |
|---|---|
| Encrypted PDF | Detect on open, render read-only, disable saving with a clear explanation. Incremental update would need to encrypt new objects; producing a corrupt file is the one unacceptable outcome. |
| No text layer (scanned) | Highlight tool disables itself and shows why. Text boxes remain available. No OCR. |
| Rotated pages (`/Rotate`) | Annotation coordinates must respect page rotation. Committed fixture. |
| Non-zero `/CropBox` origin | Annotation coordinates must respect the origin offset. Committed fixture. |
| Pre-existing annotations | Guaranteed preserved and rendered. Editing them is best-effort pending empirical verification (§9). |
| Corrupt or unparseable PDF | Error state in the viewer with the parser's reason. |
| File-URL permission not granted | Actionable guidance pointing at the `chrome://extensions` toggle. |
| Stored handle permission revoked | Re-prompt for permission on save. |
| Save failure | Surface the error, retain the recovery journal, keep the document marked dirty. |

Loading states are required for document open, page render, and save.

## 7. Testing strategy

**Save round-trip (the critical test, runs in Node, no browser).** Load a fixture, add a highlight and a text box, `saveDocument()`, then assert:

1. The saved bytes begin with the original bytes verbatim — the incremental-update invariant.
2. A **second, independent parser** (`pdf-lib`, so pdf.js is not grading its own work) finds a `/Highlight` with the expected QuadPoints, color, and an `/AP` appearance stream.
3. Annotations already present in the fixture are still present afterward.

That triple is the operational definition of "other readers render it correctly."

**Unit tests:** identity hashing, palette store, annotation index derivation, recovery journal logic, coordinate helpers.

**End-to-end (Playwright, real unpacked extension in a persistent context):** interception → open → highlight → save.

**Memory test:** scripted scroll through a generated 1000-page fixture, counting live canvases and sampling heap, asserting the §5 budget holds.

**Fixtures:** small committed files for the text, pre-annotated, rotated-page, offset-CropBox and encrypted cases. Large fixtures are generated at test time rather than committed.

**Manual cross-reader checklist** before the first release: open a saved file in Acrobat, Preview, Firefox and Chrome's native viewer.

## 8. Repository layout

```
totoPDF/
  manifest.json
  vite.config.ts
  src/
    background/
      index.ts              service worker entry
      interception.ts       DNR rules, webNavigation fallback
      context-menu.ts
    viewer/
      viewer.html
      main.ts               application bootstrap
    core/
      document-source.ts    file:// | https | drop  ->  { bytes, identity, handle? }
      identity.ts           SHA-256 document hashing
      file-handles.ts       IndexedDB store of FileSystemFileHandle
      annotation-bridge.ts  toolbar  <->  pdf.js event bus
      annotation-index.ts   AnnotationStorage  ->  rail model
      save-pipeline.ts      saveDocument, write, verify
      recovery-journal.ts   debounced IndexedDB journal
      settings.ts           palette and preferences
    ui/
      toolbar.ts
      palette.ts
      thumbnail-rail.ts
      annotation-rail.ts
      store.ts              small reactive store
      errors.ts             error and loading states
  test/
    fixtures/
    unit/
    integration/
    e2e/
  docs/
```

Constraints from the project conventions: files under 300 lines, functions under 50 lines, no `any`. The decomposition above is chosen to make those achievable without contortion.

`.gitignore` must include `node_modules/`, `dist/`, and `.superpowers/`.

A `README.md` covering what the project does, setup, and how to run it is produced in implementation stage 1, once there is something to run.

## 9. Risks and questions to resolve empirically

These are answered by experiment in the first stages, not by assumption. Each has a defined fallback.

| Risk | Resolution | Fallback |
|---|---|---|
| `declarativeNetRequest` may not reliably intercept `file://` URLs | Verify in stage 2, first hour | `webNavigation.onBeforeNavigate` + `tabs.update` |
| Scope of pdf.js support for editing **pre-existing** annotations is unclear (upstream issue closed via PRs #16535 / #16523, but no public injection API) | Verify in stage 3 against the pre-annotated fixture | v1 guarantees preservation and rendering only; editing existing annotations moves to v1.1 |
| The annotation rail depends on pdf.js internals that are not stable public API | Isolate all internal access inside `annotation-index.ts` and `annotation-bridge.ts` | Version-pin `pdfjs-dist`; upgrades become a deliberate, tested change |
| `saveDocument()` behavior on encrypted documents | Verify in stage 4 | Detect encryption on open and refuse to save (already the v1 design) |
| Canvas memory on scanned pages may exceed budget even with caps | Memory test in stage 5 | Tile large pages, or lower `maxCanvasPixels` further |

## 10. Implementation sequencing

Five stages, each independently verifiable. Stage 4 carries the project's real risk and is reachable after three stages.

1. **Skeleton** — MV3 manifest, Vite build, viewer page that opens a PDF and renders it. README.
2. **Sourcing and interception** — the three document entry points, `file://` redirect, identity hashing, handle storage.
3. **Annotation tools** — highlight with armed-color palette, text box, click-to-edit, keyboard shortcuts.
4. **Save pipeline** — `saveDocument()`, File System Access write-back, recovery journal, and the round-trip test suite.
5. **Rails and memory** — thumbnail rail, annotation rail, memory tuning, memory test.
