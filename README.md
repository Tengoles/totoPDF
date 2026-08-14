# totoPDF

totoPDF is a Chrome MV3 extension that opens PDF files in its own viewer,
built on pdf.js, so you can highlight text and add text boxes. Annotations
are written into the PDF as standard PDF annotation objects, appended to the
file as an incremental update rather than a rewrite -- the original bytes
are preserved verbatim and new objects are added on top. That is what lets
an independent PDF library (this project's tests use pdf-lib, not pdf.js) or
another reader open the same file and see the annotations as real PDF
content rather than something only totoPDF understands.

## What it does

- Opens a PDF from any of three places:
  - a local (`file://`) PDF, automatically, once "Allow access to file
    URLs" is turned on for the extension (see Setup and Limitations below);
  - any PDF URL, local or remote, via the right-click "Open in totoPDF"
    context menu item or by clicking the extension's toolbar icon while
    that tab is open;
  - a file dragged onto an already-open totoPDF tab.
- Highlight tool with a 5-colour palette; keys 1-5 switch colour while the
  tool is armed. Clicking a swatch uses that colour; right-clicking one opens
  the browser's own colour picker for it, so any of the five can be set to
  any colour. The palette, and which swatch is armed, are remembered across
  sessions; recolouring the armed swatch applies to the next highlight with
  no extra click.
- Text box tool with a text colour and a font size (6 to 96) set from the
  toolbar, also remembered across sessions.
- Zoom, from the toolbar or the keyboard. A document opens fitted to the
  window width. The minus and plus buttons step pdf.js's own zoom ladder and
  grey out at its 10% and 2500% limits; the percentage between them opens a
  list of 50 to 200 percent plus Fit width, Fit page and Actual size.
  Ctrl and plus or minus do the same thing, Ctrl+0 goes back to fitting the
  width, and Ctrl held while scrolling over the page zooms the document
  rather than the browser window.
- The tab title is the open file's name, so several PDFs open at once can be
  told apart from the tab strip.
- Saves back through the File System Access API. The first save on a
  document prompts for a file location; the chosen handle is remembered in
  IndexedDB so later saves on the same document do not prompt again.
- Once a document has been saved once, further annotations are written to the
  same file automatically, two seconds after you stop editing. A readout next
  to the Save button says which of "Unsaved changes", "Saving" and "Saved" is
  true. Autosave is silent by construction: if there is no stored handle, or
  its write permission is not already granted, it writes nothing and says so
  rather than opening a dialog nobody asked for (see Limitations).
- A debounced crash-recovery journal records annotation edits to IndexedDB
  as you make them, so an unexpected tab close does not lose unsaved work.
  It is a crash buffer only -- nothing in the current build reads it back
  into a document; recovering from it today means finding it in IndexedDB
  by hand.
- A collapsible page-thumbnail rail that renders a page's canvas only once
  it nears the visible rail and releases it once it scrolls back out, so
  opening a very large document does not allocate a full-size bitmap per
  page up front.
- A collapsible "Notes" rail listing the highlights and text boxes in the
  current document, including ones saved in an earlier session, not just
  ones made since it was opened; clicking an entry jumps to its page.
- Encrypted PDFs and PDFs with no extractable text layer are detected on
  open, and the toolbar and a banner reflect what is and is not available
  (see Limitations).

## Setup

    npm install

## Run

    npm run build

Then open `chrome://extensions`, enable Developer mode, choose "Load
unpacked", and select the `dist/` directory.

To open local PDFs automatically, find totoPDF's card on that same page and
turn on "Allow access to file URLs". This is a per-extension, per-profile
switch Chrome requires a person to flip by hand -- an extension cannot grant
itself file access, so there is no way to do this from inside totoPDF.

## Test

    npm test                              # unit and integration tests (vitest)
    npm run typecheck                     # tsc --noEmit

End-to-end tests load the actual built extension into a real Chromium
instance via Playwright and verify a saved file with pdf-lib -- a PDF parser
independent of the pdf.js this project renders with, so a bug in one cannot
mask a bug in the other. They need a build and generated fixtures first:

    npm run build
    npx vite-node test/fixtures/generate.ts
    npm run test:e2e

`test/fixtures/*.pdf` are generated, not committed; regenerate them with the
command above whenever you need them.

## Deploy

Not published. Loaded unpacked from `dist/`.

## Limitations

These are real, current gaps, not a disclaimer template. Read them before
filing a bug that turns out to be one of these.

- **Local PDFs need a manual permission.** Chrome will not let an extension
  see `file://` URLs unless "Allow access to file URLs" is turned on for it
  by hand on its `chrome://extensions` card, and nothing about that switch
  can be automated or prompted for from inside the extension. Until it is
  on, a local PDF just opens in Chrome's own viewer; use the right-click
  "Open in totoPDF" menu item, or click the extension's toolbar icon, to
  open it in totoPDF instead.

- **`file://` interception is verified working.** Navigating to a local PDF
  redirects into totoPDF automatically, confirmed by hand in a real Chrome
  session on 2026-08-13. `src/background/interception.ts` used to also
  export `installNavigationFallback`, an alternative `webNavigation`
  implementation kept unused in case the redirect rule stopped applying to
  `file://` on a future Chrome release. It was removed when the unused
  `webNavigation` permission was dropped for store submission; it remains in
  git history (commit `3899523`) if the redirect rule ever stops working.

- **A local path containing `&` or `#` is never auto-intercepted, and this
  is deliberate.** The redirect rule builds the destination URL with a
  regex substitution, and a regex substitution cannot percent-encode the
  text it captures -- a literal `&` or `#` in the path would either get
  read as a query separator or truncate the substitution outright. Rather
  than intercept and mangle the path, the rule's condition excludes any
  path containing either character, so those files always fall through to
  Chrome's normal viewer. Use the "Open in totoPDF" toolbar action or the
  right-click context menu for these -- both build the destination URL with
  `encodeURIComponent`, so the full path survives intact.

- **Encrypted PDFs open read-only.** totoPDF saves by appending new objects
  to the existing file rather than rewriting it. If the source file is
  encrypted, the appended objects would need to be encrypted too for the
  result to still be a valid encrypted PDF, and totoPDF does not do that.
  Rather than silently hand back a file that looks saved but is corrupt,
  the Save button and Ctrl+S are both disabled for encrypted documents, and
  a banner states why.

- **Scanned pages with no text layer cannot be highlighted.** The highlight
  tool anchors to text; a scanned page with no OCR text layer underneath
  the image has none to anchor to. totoPDF detects this and disables the
  highlight tool with a banner explaining it. Text boxes still work on
  every page regardless, since they do not need underlying text. totoPDF
  does not do OCR.

- **Every save makes the file bigger, and autosave saves often.** A save
  appends a new revision to the PDF rather than rewriting it, which is
  precisely what makes it non-destructive: the original bytes are never
  touched. The cost is that each save leaves the previous revision in the
  file. A long annotating session with autosave on therefore grows the file
  steadily, and the growth is roughly one appended revision per pause in
  editing, not one per session. Nothing prunes old revisions. If the size
  matters, open the file in a tool that rewrites PDFs to flatten it.

- **Autosave never prompts, so sometimes it does not save.** Both the file
  picker and the write-permission prompt require transient user activation,
  which a timer running two seconds after the last keystroke does not have.
  So autosave writes only when a handle is already stored for the document
  and its readwrite permission already reads `granted`; otherwise it writes
  nothing and the readout stays on "Unsaved changes". A document that has
  never been saved is never autosaved, and Chrome dropping a grant between
  sessions means the first save after a restart is a manual Ctrl+S. If a
  write fails, autosave stops for that document, says so in a banner once,
  and does not retry.

- **Text boxes use pdf.js's one built-in font.** Colour and size are
  configurable from the toolbar; the font itself is not -- pdf.js's
  FreeText editor does not expose a font-family option.

- **pdf.js's own highlight colour menu lags a palette edit by one page
  load.** Selecting a highlight already on the page opens a small colour
  menu that pdf.js builds itself, from a list handed to PDFViewer once when
  it is constructed and cached from then on. totoPDF's toolbar swatches
  drive the editor's colour parameter directly, so a recoloured swatch
  applies to the very next highlight; that built-in menu goes on offering
  the previous five colours until the viewer tab is reloaded. Reload the tab
  to bring the two in line.

- **Highlight opacity is not adjustable.** pdf.js accepts colour and
  thickness for highlights through the editor-parameter channel totoPDF
  drives, but no opacity, so there is nothing for a control to change.
  Highlights use pdf.js's own fixed opacity.

- **The cross-reader check is partly done.** A saved file opens correctly in
  Microsoft Edge, confirmed by hand. Edge renders PDFs with PDFium, the same
  engine Chrome uses, so it is not fully independent evidence -- Firefox
  (pdf.js) and Acrobat (its own implementation) are still unchecked. The
  annotations do carry `/AP` appearance streams, verified against the saved
  bytes by pdf-lib, which is the technical precondition for any reader to
  render them without synthesising its own appearance.

- **What has, and has not, actually been checked in a browser.**
  Highlighting, saving, the annotation rail, the thumbnail rail, canvas
  memory usage on a 1000-page document, palette recolouring through a
  swatch's right-click picker (including that it survives a reload and
  colours the next highlight), the three-group toolbar layout measured at
  1280px and 2000px, the text
  box colour and size controls, and the zoom controls -- buttons, preset
  menu, Ctrl+wheel, the keyboard shortcuts, the limits greying the step
  buttons out, and the tab title following the open file -- were all driven
  and observed in a real Chromium session during development, via Playwright. The native OS
  save-file picker, drag-and-drop from a real desktop file manager, and
  `file://` interception have since been exercised by hand in Chrome and all
  work. Firefox and Acrobat remain unchecked -- see the table below.

- **The Spanish UI has been driven in a real Chromium session too, via
  Playwright, using `--lang=es` on a fresh profile.** That is the real
  locale-selection mechanism, not a catalogue swap: `chrome.i18n.getUILanguage()`
  reported `es-ES` and the Save button read `Guardar` before anything else was
  checked. The toolbar was measured at 1280px and 2000px with the Spanish
  strings loaded -- `scrollWidth` matched `clientWidth` at both, every toolbar
  child shared the same `top`, and no button label wrapped -- so despite
  Spanish running 15-25% longer than English, neither `es.json` nor
  `styles.css` needed a change for layout. pdf.js's own highlight-colour
  dropdown, opened by selecting a highlight and clicking its colour swatch
  (not just read from source), showed Amarillo, Verde, Azul, Rosa, Naranja, confirming
  `paletteToHighlightColors` reaches it. One thing was not observed directly:
  a completed save through the real Save button and its native OS file
  picker, since `showSaveFilePicker()` has no one to click through it in an
  unattended session and was rejected automatically. In its place, the save
  pipeline was exercised through the same code the button calls
  (`buildSavedBytes`), which wrote a `/Highlight` and a `/FreeText`
  annotation into the file with the incremental-update prefix intact, and the
  banner text was confirmed by reading `chrome.i18n.getMessage('saveConfirmed')`
  from the loaded catalogue -- `Anotaciones escritas en el archivo PDF.` --
  rather than by watching it appear on screen. Chrome's own UI rendered in
  Spanish under `--lang=es` as well; on `chrome://extensions`, the
  file-access toggle read `Permitir acceso a URL de archivo` (singular
  `URL`), which was checked against the `fileAccessHint` string's quote of
  it and corrected to match -- it previously read the plural `URLs de
  archivo`.

## Cross-reader checklist

Partly done. To finish it: open a PDF in totoPDF, add one highlight and one
text box, save, then open that same file in each reader below.

| Reader | Highlight renders | Text box renders |
|---|---|---|
| Chrome native viewer | yes | yes |
| Microsoft Edge | yes | yes |
| Firefox | not checked | not checked |
| Acrobat or Preview | not checked | not checked |

Chrome and Edge both render with PDFium, so they are one data point rather
than two. Firefox uses pdf.js and Acrobat its own implementation; those are
the checks that would prove portability.
