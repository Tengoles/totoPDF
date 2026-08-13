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
  tool is armed.
- Text box tool with configurable colour and size.
- Saves back through the File System Access API. The first save on a
  document prompts for a file location; the chosen handle is remembered in
  IndexedDB so later saves on the same document do not prompt again.
- A debounced crash-recovery journal records annotation edits to IndexedDB
  as you make them, so an unexpected tab close does not lose unsaved work.
  It is a crash buffer only -- nothing in the current build reads it back
  into a document; recovering from it today means finding it in IndexedDB
  by hand.
- A collapsible page-thumbnail rail that renders a page's canvas only once
  it nears the visible rail and releases it once it scrolls back out, so
  opening a very large document does not allocate a full-size bitmap per
  page up front.
- A collapsible "Notes" rail listing the highlights and text boxes on the
  current document; clicking one jumps to its page.
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

- **Whether `file://` interception actually works has not been verified in
  a real browser.** The redirect rule (`declarativeNetRequest`) meant to
  catch a local PDF navigation and hand it to totoPDF automatically has
  never been exercised against a real local PDF in an actual browser
  session -- only unit-tested against the rule-building function in
  isolation. It is possible Chrome does not apply `declarativeNetRequest`
  redirect rules to `file://` navigations at all, in which case automatic
  interception silently does nothing and every local PDF needs the manual
  "Open in totoPDF" action every time. `src/background/interception.ts`
  exports `installNavigationFallback`, a `webNavigation`-based fallback for
  exactly this case, but it is deliberately not wired into
  `src/background/index.ts` -- turning it on without knowing whether it is
  actually needed risks a double redirect. If local PDFs are not opening in
  totoPDF automatically after the file-URL permission is on, this is the
  first thing to check.

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

- **Text boxes use pdf.js's one built-in font.** Colour and size are
  configurable from the toolbar; the font itself is not -- pdf.js's
  FreeText editor does not expose a font-family option.

- **The cross-reader check has not been done.** See the table below. It
  needs a person with Acrobat, Preview, and Firefox installed to actually
  open a saved file in each and look.

- **What has, and has not, actually been checked in a browser.**
  Highlighting, saving, the annotation rail, the thumbnail rail, and canvas
  memory usage on a 1000-page document were all driven and observed in a
  real Chromium session during development, via Playwright. The native OS
  save-file picker, drag-and-drop from a real desktop file manager,
  `file://` interception, and every PDF reader other than the Chromium
  instance the tests run in have not been -- see the two `file://` items
  above and the table below.

## Cross-reader checklist

Not yet done. Needs a person: open a PDF in totoPDF, add one highlight and
one text box, save, then open that same file in each reader below and
record what actually happened.

| Reader | Highlight renders | Text box renders |
|---|---|---|
| Chrome native viewer | | |
| Firefox | | |
| Acrobat or Preview | | |
