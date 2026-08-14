# Local-only: drop remote PDF loading

**Goal:** totoPDF opens PDFs from the local disk only. `<all_urls>` becomes
`file:///*`, and the extension makes no network requests at all.

**Why:** the product's value is annotating a PDF and writing the annotations
back into that file. That needs a local file. A remote PDF could only ever be
saved as a local copy, which downloading and dragging in already does — so
remote URL support is a shortcut, not a capability, and it is the sole reason
the extension asks for access to every site.

**Spec:** this document. The change is small enough that a separate design
doc would only restate it.

## Decisions

**Drag-and-drop stays, and it is what makes this safe.** A dropped file is a
`File` object and needs no host permission. "Download the PDF, drag it in"
covers every case remote loading covered, with one extra step that anyone
keeping their annotations was taking anyway.

**`host_permissions` becomes `["file:///*"]`.** Whether Chrome still
classifies that as a broad host permission is unknown and will be discovered
at submission. It is unambiguously narrower and reads far better to a
reviewer; that is the whole benefit being claimed here, and no more.

**This does not change the onboarding cliff.** `file://` access still needs
the user to turn on "Allow access to file URLs" by hand. The welcome page
stays exactly as it is.

**The `loadFailedHttp` key is renamed.** With no HTTP left, a key and message
naming HTTP would mislead the next reader. It becomes `loadFailed`, with the
URL as its only placeholder.

**`FetchableOrigin` stops being a union** but keeps its name — it is still a
meaningful distinction from `dropped`, which carries a file name rather than
a URL.

## Not in scope

- The DNR redirect rule. It already matches `file:///*.pdf` only.
- The welcome page, the save pipeline, the annotation model, i18n machinery.
- `allowNativeViewerOnce` and the "Open in Chrome" button — still meaningful
  for a local file.

---

### Task 1: Code, manifest and tests

**Files:**
- Modify: `src/core/document-source.ts`, `src/background/context-menu.ts`, `src/viewer/main.ts`, `public/manifest.json`, `src/i18n/en.json`, `src/i18n/es.json`
- Modify: `test/unit/document-source.test.ts`, `test/unit/manifest.test.ts`

- [ ] **Step 1: Write the failing manifest test**

Add to `test/unit/manifest.test.ts`. There is currently no assertion on
`host_permissions` at all, which is what let this go unexamined.

```ts
  it('asks for local file access only', () => {
    // The extension reads PDFs from disk and makes no network requests, so
    // there is nothing for a broader host permission to do. Widening this
    // means re-justifying it to store review.
    expect(manifest.host_permissions).toEqual(['file:///*']);
  });
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `npm test -- manifest`
Expected: FAIL — `host_permissions` is `["<all_urls>"]`.

- [ ] **Step 3: Narrow the manifest**

In `public/manifest.json`, `"host_permissions": ["file:///*"]`. Change
nothing else.

- [ ] **Step 4: Make the origin type local-only**

In `src/core/document-source.ts`:

```ts
export type FetchableOrigin = { kind: 'local'; url: string };
```

`DocumentOrigin` keeps its shape (`FetchableOrigin | { kind: 'dropped'; fileName: string }`).

In `parseViewerQuery`, delete the `https://` / `http://` branch entirely, so
anything that is not a `file://` URL returns `null` — the same as an
unparseable one. Add a brief comment saying remote URLs are rejected on
purpose and why.

- [ ] **Step 5: Rename the load-failure message**

In both `src/i18n/en.json` and `src/i18n/es.json`, replace the
`loadFailedHttp` entry with `loadFailed`, keeping it in the same position:

en:
```json
  "loadFailed": {
    "message": "Could not load $URL$",
    "placeholders": { "url": { "content": "$1" } }
  },
```

es:
```json
  "loadFailed": {
    "message": "No se pudo cargar $URL$",
    "placeholders": { "url": { "content": "$1" } }
  },
```

Then in `document-source.ts` change the throw to
`throw new Error(t('loadFailed', origin.url));` and drop the now-unused
`response.status` argument.

Both catalogues stay at 68 keys. The conformance tests enforce parity.

- [ ] **Step 6: Simplify the failure hint**

`src/viewer/main.ts` has `describeLoadFailure`, which appends the
file-access hint only when `origin.kind === 'local'`. Every origin reaching it
is now local, so the branch is dead: inline it so the hint is always appended,
and delete the now-pointless parameter if it becomes unused. Keep the comment
explaining why the hint exists — it is still the most common first-run
failure.

- [ ] **Step 7: Narrow the context menu**

In `src/background/context-menu.ts`:

```ts
      targetUrlPatterns: ['file:///*.pdf', 'file:///*.PDF'],
      documentUrlPatterns: ['file:///*'],
```

The menu no longer appears on web pages or web PDF links, which is correct —
it could not open them any more.

- [ ] **Step 8: Update the origin tests**

In `test/unit/document-source.test.ts`, remove the tests asserting that
`http://` and `https://` URLs parse as remote origins, and add one asserting
they now return `null`, with a comment saying that is deliberate rather than a
gap. Leave every `file://` and every `fileNameFromUrl` test untouched.

- [ ] **Step 9: Verify**

```bash
npm test && npm run typecheck && npm run build
```
All green. Then confirm no reference to remote loading survives in code:

```bash
grep -rn "'remote'\|kind: 'remote'\|loadFailedHttp" src/ test/
```
Expected: no output.

- [ ] **Step 10: Verify in a real browser — this is the step that matters**

Narrowing `host_permissions` can break local loading, and no unit test can
tell you. Build, generate fixtures, then drive the built extension with
Playwright the way `test/e2e/extension-context.ts` does, with a scratchpad
script (NOT in the repo):

1. Launch with the extension loaded.
2. Open `chrome-extension://<id>/viewer.html?src=<encodeURIComponent of a file:// URL to test/fixtures/text.pdf>`.
3. Confirm the document actually renders — check that the page count reads 1
   and a text layer exists, not merely that the page did not error.
4. From the service worker, print `chrome.runtime.getManifest().host_permissions`
   to prove the check ran against the narrowed build.

Report the real values. If the document does not render, `file:///*` is not
sufficient on its own — say so plainly and stop rather than committing.

Note: Playwright's persistent context loads unpacked extensions with file
access already enabled, so this tests the permission, not the user toggle.

- [ ] **Step 11: Run the e2e suite**

`npm run test:e2e` — expect 5/5. The specs inject bytes through
`__totopdfOpen` and never load a URL, so they should be unaffected; confirm
that rather than assume it.

- [ ] **Step 12: Commit**

```bash
git add src public test
git commit -m "feat: open local PDFs only, and narrow host access to file://"
```

---

### Task 2: Documentation (controller-written)

`README.md`, `PRIVACY.md` and `docs/store/listing.md`. Written by the
controller, then reviewed — the store-facing prose is the part that has
already produced two false claims in this project, both in documents that
skipped review.

Substance:

- **README** — the "three places" bullet loses its remote entry; the
  Limitations section gains the reasoning for local-only.
- **PRIVACY.md** — the network paragraph becomes what it originally claimed
  and had to be corrected to: totoPDF makes no network requests at all. The
  "access to all sites" section becomes a much shorter "local files" one.
  Both language halves must change identically.
- **listing.md** — both detailed descriptions drop the "Cualquier PDF, local
  o de la web" bullet; the host-permission justification is rewritten for
  `file:///*`.
