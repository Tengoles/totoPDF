# totoPDF — Chrome Web Store readiness

Status: approved to execute under standing authorization to proceed without
per-decision check-ins. Written 2026-08-13.

## 1. Problem and goals

totoPDF works but cannot be submitted. The manifest has no icons at all,
requests two permissions it never exercises, and carries a version that
disagrees with `package.json`. None of the material a submission requires —
listing copy, permission justifications, a privacy policy, screenshots —
exists.

Goal: bring the repository to the point where submitting is a login and an
upload. Everything that can be produced without the developer's account and
credit card is produced here.

## 2. Non-goals

- Registering the developer account or paying the one-time $5 fee. That needs
  the owner's identity and payment details.
- Uploading or publishing. Outward-facing and account-bound.
- Hosting the privacy policy. It is written here; the dashboard wants a URL,
  and the repository's own GitHub page is the cheapest host.
- Narrowing `<all_urls>`. See §4.
- Anything about Firefox or Edge add-on stores.

## 3. What the store actually requires

Recorded because the gap list is the whole point of this document.

| Requirement | Status before | Action |
|---|---|---|
| 128×128 icon | **Missing entirely** | §5 |
| 16/32/48 icons | Missing | §5 |
| `action.default_icon` | Missing | §5 |
| Single purpose statement | Not written | §7 |
| Per-permission justification | Not written | §7 |
| Privacy policy URL | Does not exist | §6 |
| Data-usage disclosures | Not answered | §6 |
| Short description ≤132 chars | Not written | §7 |
| Detailed description | Not written | §7 |
| 1–5 screenshots, 1280×800 | None | §8 |
| Category | Not chosen | §7 |
| Version that increments per upload | Disagrees with package.json | §4 |
| No unused permissions | Two unused | §4 |

## 4. Manifest changes

**Drop `webNavigation`.** It is exercised only by
`installNavigationFallback`, which `src/background/index.ts` never calls. A
permission the extension never uses is a routine rejection reason, and the
reviewer cannot see why it is there.

The function goes with it. Dead code that would throw without an undeclared
permission is worse than no code, and the repository's own standing rule is
that git holds the history. The README bullet describing the fallback is
rewritten to say it was removed and to name the commit that still has it.

**Drop `tabs`.** Verified against the source rather than assumed:
`chrome.tabs.create` and `chrome.tabs.update` require no permission at all,
and the one place a tab's URL is read — `chrome.action.onClicked` in
`src/background/context-menu.ts` — gets it from the `<all_urls>` host
permission the extension already holds. `tabs` grants nothing this code uses.

This is the change most likely to be wrong, because no existing test covers
the toolbar-icon path. It must be verified in a browser (§9), not by
reasoning.

**Keep `<all_urls>`.** It is load-bearing twice over: the
declarativeNetRequest redirect rule needs host access to what it redirects,
and the viewer fetches the PDF it was pointed at, from any origin. Narrowing
to `*.pdf` patterns would break every PDF served from an extensionless URL,
which is most of them served by applications. The honest move is to keep it
and justify it plainly.

Final permission set: `declarativeNetRequest`, `contextMenus`, `storage`,
plus `<all_urls>` host permission.

**Version 1.0.0** in both `public/manifest.json` and `package.json`. They
currently disagree (0.1.0 against 1.0.0). The store rejects a re-upload whose
version did not increase, so the two must not drift; a note in the README's
deploy section says to bump both.

## 5. Icons

Four PNGs — 16, 32, 48, 128 — generated from one SVG so they cannot drift,
committed under `public/icons/`, and referenced from both `icons` and
`action.default_icon`.

Drawn from the product's own palette so the icon and the app agree: the
toolbar's `#1e2024` as a rounded tile, `#e6e8ea` for the page, and
`#FFF176` — the default highlight yellow — for a stroke across it. A page
with a highlight on it is what the extension does, and it survives being
16px wide, which rules out anything finer.

No gradient, no glass, no purple. Flat shapes only.

Rasterized by screenshotting the SVG in the Chromium that Playwright already
installs, at each exact size. That adds no dependency, and it renders with
the same engine that will display the icon.

## 6. Privacy

`PRIVACY.md` at the repository root, so it has a stable GitHub URL to paste
into the dashboard.

The substance is short and true: totoPDF sends nothing anywhere. It has no
server, no analytics, no telemetry, no remote code. What it stores, it stores
locally through the browser's own APIs, and the document says exactly what
and why — settings in `chrome.storage.local`, file handles in IndexedDB, and
the crash-recovery journal, which is the only one that holds document content
and therefore the one that deserves naming explicitly.

The corresponding dashboard answers: no data collected in any category, and
the three certifications (not sold to third parties, not used for unrelated
purposes, not used for creditworthiness or lending) all affirmed. Recorded in
the listing document so they are answered consistently rather than from
memory at submission time.

## 7. Listing copy

`docs/store/listing.md`, holding every field the dashboard asks for so
submission is copy-and-paste: name, a short description within the 132
character limit, the detailed description, category (Productivity), the
single-purpose statement, and one justification per permission.

Written to the project's existing standard — plain, concrete, no marketing
register. The detailed description states the limitations that will otherwise
arrive as one-star reviews: encrypted PDFs are read-only, scanned pages
without a text layer cannot be highlighted, saving grows the file, and local
files need a permission the user must grant by hand.

## 8. Screenshots

Four 1280×800 PNGs under `docs/store/screenshots/`, captured from the real
built extension driven by Playwright — the same approach the project already
uses for its browser verification, so they cannot show a mock-up of something
that does not work.

Content: the viewer with highlights and a text box; the notes rail listing
them; the thumbnail rail with page navigation; the toolbar's palette and
text-box controls. English UI, since the store listing is English.

## 9. First-run onboarding

**The one place this design adds a feature, and the reasoning for it.**

Chrome will not let an extension read `file://` URLs until a person turns on
"Allow access to file URLs" on its `chrome://extensions` card. An extension
cannot grant itself that, prompt for it, or detect it before failing. So the
default first experience is: install totoPDF, open a local PDF, and watch
nothing happen.

A reviewer will do exactly that. So will every user who installs it to read
PDFs on their own disk, which is the primary use.

The fix is a page shown once, on install: what the extension does, the one
switch that needs flipping, and a button that opens this extension's own
`chrome://extensions` card. A page cannot navigate to `chrome://` through a
link, but `chrome.tabs.create` from the page's own script can, so the button
works.

Scope kept deliberately small: one static page, one `onInstalled` branch, no
options UI, no settings, no state. Its strings go through the existing
catalogue, so it is bilingual for free.

## 10. Packaging

`npm run package` produces `totopdf-<version>.zip` from `dist/`, ready to
upload.

Written in Node against the built-in `zlib`, with no dependency. The
alternative was PowerShell's `Compress-Archive`, which locks the command to
Windows. The script is longer than the project's usual
build-it-rather-than-install-it threshold, which is the tradeoff accepted to
avoid both a dependency and a platform lock.

Verified by round-tripping: expand the produced archive and compare its file
list and content hashes against `dist/`. A zip that Chrome rejects at upload
time would otherwise only be discovered at upload time.

## 11. Testing

- `test/unit/manifest.test.ts` gains assertions for the icon sizes and their
  presence in `action.default_icon`, and its existing permission assertion is
  updated to the reduced set. That existing assertion is what makes the
  permission change deliberate rather than accidental.
- A test that `public/manifest.json` and `package.json` carry the same
  version, so they cannot drift again.
- Every icon file referenced by the manifest must exist on disk and be a
  valid PNG of the size its key claims.
- The packaging round-trip described in §10.
- The `tabs` removal verified in a browser: the toolbar-icon path and the
  right-click menu path both still open a PDF in totoPDF.

## 12. Risks

**Dropping `tabs` breaks a path no test covers.** The toolbar-icon flow reads
`tab.url`. The mitigation is the browser check in §11, not reasoning about
the permission model.

**The store may still ask for more.** Review policy changes, and `<all_urls>`
draws the closest scrutiny. This design cannot guarantee approval; it removes
the defects that are knowable from here.

**The welcome page is a feature added during a readiness pass.** It is
justified in §9, but it is the item to cut first if the scope needs to
shrink.

## 13. Sequencing

1. Manifest: permissions, version, icons wired; tests updated.
2. Icons generated and committed.
3. Welcome page and its `onInstalled` branch.
4. Privacy policy and listing copy.
5. Screenshots.
6. Packaging script and its round-trip test.
7. README deploy section rewritten; browser verification of the permission
   reduction.
