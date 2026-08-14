# Chrome Web Store listing

Every field the developer dashboard asks for, written out so submission is
copy-and-paste rather than composition under pressure. Keep this file in step
with what is actually submitted.

---

## Store listing tab

**Extension name**

```
totoPDF
```

**Short description** (132 character limit — this is 114)

```
Read PDFs in a viewer that highlights text and adds text boxes, written into the PDF file as real PDF annotations.
```

**Category**

```
Productivity
```

**Language**

```
English
```

The extension's interface ships in English and Spanish and follows the
browser's language. The listing itself is English; a Spanish listing can be
added later from the same dashboard without changing the extension.

**Detailed description**

```
totoPDF opens PDFs in its own viewer so you can highlight text and add text
boxes, then writes what you added into the PDF file itself.

That last part is the point. Annotations are saved as standard PDF annotation
objects, appended to the file as an incremental update rather than a rewrite.
The original bytes are left untouched and the new objects are added on top.
Open the same file in Chrome, Edge, or any other PDF reader and the
highlights and text boxes are there, because they are real PDF content and not
something only totoPDF understands.

Opening a PDF
- Local PDFs open in totoPDF automatically, once you turn on "Allow access to
  file URLs" on totoPDF's chrome://extensions card. Chrome requires that
  switch to be set by hand; an extension cannot turn it on for itself.
- Any PDF, local or on the web: right-click and choose "Open in totoPDF", or
  click the totoPDF toolbar icon while the PDF is open.
- Drag a PDF onto an open totoPDF tab.

Annotating
- Highlight text with a five-colour palette. Keys 1 to 5 switch colour. Right-
  click a swatch to change that colour to anything you like; the palette is
  remembered between sessions.
- Add a text box anywhere on a page, with its own colour and a font size from
  6 to 96.
- A Notes rail lists every highlight and text box in the document, including
  ones saved in an earlier session. Click an entry to jump to its page.
- A page thumbnail rail, page navigation, and zoom from the toolbar or the
  keyboard.

Saving
- The first save asks where to write the file. After that, totoPDF remembers
  and writes to the same file.
- Once a document has been saved once, further annotations are written
  automatically two seconds after you stop editing, and a readout next to the
  Save button says whether your work is in the file.
- A crash-recovery journal records unsaved annotations as you make them, so an
  unexpected tab close does not lose them.

Worth knowing before you install
- Encrypted PDFs open read-only. Saving one would require encrypting the
  appended annotations too, and rather than hand back a file that looks saved
  but is corrupt, totoPDF disables saving and says why.
- Scanned pages with no text layer cannot be highlighted, because the
  highlight tool anchors to text and there is none. Text boxes still work on
  those pages. totoPDF does not do OCR.
- Every save appends a revision rather than rewriting the file, which is what
  makes it non-destructive, and it means the file grows as you work. Nothing
  prunes old revisions.
- Text boxes use the one font the viewer provides. Colour and size are
  adjustable; the font is not.

Privacy
totoPDF has no server, makes no network requests, and contains no analytics or
tracking of any kind. Your documents never leave your computer. Settings, file
handles and the recovery journal are stored locally by the browser and are
never transmitted.

The interface is available in English and Spanish and follows your browser's
language.
```

---

## Privacy tab

**Single purpose description**

```
totoPDF is a PDF viewer that lets a person annotate a PDF and save those
annotations into the PDF file. Every feature it has serves that one purpose:
displaying a PDF, adding highlights and text boxes to it, and writing the
result back to the file.
```

**Permission justifications**

`declarativeNetRequest`

```
Redirects a PDF URL to totoPDF's own viewer page. This is the mechanism that
makes a PDF open in totoPDF rather than in Chrome's built-in viewer, which is
the extension's core function. It is also used to let a single navigation
through to Chrome's viewer when the user clicks "Open in Chrome".
```

`contextMenus`

```
Adds one item, "Open in totoPDF", to the right-click menu on PDF links and
PDF pages. This is how a user opens a PDF in totoPDF without changing any
browser default.
```

`storage`

```
Stores the user's own settings: the five highlight colours, which one is
selected, and the colour and font size used for text boxes, so they persist
between sessions. No document content and no browsing data is stored here.
```

**Host permission justification** (`<all_urls>`)

```
Two things need it. First, redirecting a PDF URL to totoPDF's viewer requires
permission for the address being redirected, and a PDF can be at any address.
Second, once the viewer is open it must fetch the PDF it was pointed at, which
again can be any address.

A narrower pattern was considered and does not work: PDFs are frequently
served from URLs that do not end in .pdf, so a pattern-based permission would
silently fail on many documents.

totoPDF does not read, modify or collect the content of web pages. The only
resource it fetches is a PDF the user has explicitly asked it to open.
```

**Remote code**

```
No. All code is included in the extension package. The PDF rendering engine
(pdf.js) and its worker, font data and WASM are bundled at build time. Nothing
is fetched or evaluated at runtime.
```

**Data usage disclosures** — every category is "not collected":

| Category | Answer |
|---|---|
| Personally identifiable information | Not collected |
| Health information | Not collected |
| Financial and payment information | Not collected |
| Authentication information | Not collected |
| Personal communications | Not collected |
| Location | Not collected |
| Web history | Not collected |
| User activity | Not collected |
| Website content | Not collected |

totoPDF reads the PDF a user opens in order to display and annotate it, and
writes annotations back to that file on the user's own disk. None of it is
transmitted, so none of it is "collected" in the sense the disclosure asks
about. There is no server to collect it to.

**Certifications** — all three affirmed:

- I do not sell or transfer user data to third parties, apart from the
  approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my
  item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for
  lending purposes.

**Privacy policy URL**

`PRIVACY.md` in the repository root. Paste its public URL, which will look
like:

```
https://github.com/<owner>/<repo>/blob/main/PRIVACY.md
```

The dashboard requires a reachable URL, so the repository must be public
before submitting, or the policy must be hosted somewhere else that is.

---

## Assets

- Icon: `public/icons/icon128.png` (the store shows the 128).
- Screenshots: `docs/store/screenshots/`, four files, each exactly 1280×800.
- Small promo tile (440×280): not produced. It is optional, and is only used
  if the extension is featured.

---

## Before you submit

1. The repository must be public if the privacy policy URL points at it.
2. Bump the version in **both** `public/manifest.json` and `package.json` —
   a test enforces that they match, and the store refuses a re-upload whose
   version did not increase.
3. `npm run package`, then upload the resulting zip.
4. Registering as a Chrome Web Store developer costs a one-time $5 fee. The
   extension itself is free to publish and free to install.
5. Expect the `<all_urls>` host permission to draw the closest review
   scrutiny. The justification above is the honest account of why it is
   needed; do not narrow the claim to sound smaller than it is.
