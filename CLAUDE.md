# totoPDF

@~/.claude/rules/frontend.md

A Chrome MV3 extension that opens PDFs in its own pdf.js-based viewer so they
can be highlighted and annotated with text boxes, and writes those
annotations **into the PDF file** as standard PDF annotation objects.

Read `README.md` for what it does and its current limitations. This file is
about working on it.

## Commands

    npm install
    npm run build          # vite -> dist/, load unpacked from there
    npm run dev            # vite build --watch
    npm test               # vitest, node environment
    npm run typecheck      # tsc --noEmit
    npm run package        # build + write totopdf-<version>.zip for the store

End-to-end tests need a build and generated fixtures first:

    npm run build
    npx vite-node test/fixtures/generate.ts
    npm run test:e2e

## The one design decision everything else follows from

**Saving appends an incremental update; it never rewrites the file.** The
original bytes are preserved verbatim and new objects are added on top.
That is what lets an independent PDF library or another reader open the file
and see real PDF annotations rather than something only totoPDF understands.

`src/core/save-pipeline.ts` asserts the original bytes survived. If a change
makes that assertion fail, the change is wrong. The visible cost is that
every save grows the file, and that is a documented, accepted trade.

## Layering

Four directories, each with its own `CLAUDE.md` carrying the rules and the
hard-won gotchas. Read the one for the directory you are working in.

| Directory | Owns | Must not touch |
|---|---|---|
| `src/core` | Logic: settings, capabilities, save pipeline, storage, i18n | The DOM, pdf.js at runtime |
| `src/ui` | DOM builders for the toolbar and rails | pdf.js, in any form |
| `src/viewer` | Wiring, and the only owner of pdf.js | — |
| `src/background` | The MV3 service worker | — |

`src/ui` declares small interfaces (`ZoomController`, `PageController`,
`SaveStatusSource`) that `src/viewer` implements over pdf.js. That inversion
is why controls can be built without a PDF engine in scope, and why the logic
half of each control is a separate, node-testable file from its DOM half.

`src/core` is testable under vitest's node environment with no jsdom, because
it has no runtime pdf.js dependency and no DOM access. Preserve that — it is
what makes most of this codebase cheap to test.

## Localization

Every user-facing string goes through `t()` in `src/core/i18n.ts`. Adding one
means adding a key to **both** `src/i18n/en.json` and `src/i18n/es.json`.

- `MessageKey` is derived from the English catalogue, so an unknown key is a
  **compile error**, not a blank control at runtime.
- Conformance tests enforce identical key sets, matching placeholder
  name-to-index maps, no empty messages, and that every `$NAME$` is declared.
- Interpolation uses Chrome's `placeholders`, never string concatenation, so
  a translation can reorder its arguments.
- Outside the extension (vitest), `t()` reads the English catalogue directly.
  That is why specs assert real copy with no `chrome` mock. If a spec needs a
  mock, the fallback is broken, not the spec.
- The Spanish catalogue is at `es`, not `es_419`, deliberately: Chrome falls
  back `es_419` -> `es` -> `default_locale`, so a catalogue only at `es_419`
  would serve English to a plain "Español" browser.

A handful of strings stay English on purpose — invariant-violation errors
that signal a bug and should stay greppable in an issue. They are listed in
`src/core/CLAUDE.md`.

## Conventions

- Comments explain **why**, not what. This codebase's comments record the
  reasoning behind non-obvious choices and the bugs that motivated them.
  Match that density and tone; it is the most valuable thing in the repo.
- Files under 300 lines, functions under 50. (`src/ui/styles.css` is a known
  pre-existing exception at 373.)
- No `any`. `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals` are on.
- Before adding a dependency, check whether it fits in under 50 lines. The
  colour picker is a native `input[type=color]`; the zip writer is
  `node:zlib` plus a CRC table. Both were that check coming out "no".
- Tests assert real user-facing copy as string literals. Changing English
  text will fail tests — that is the feature. Update catalogue and specs
  together, deliberately.
- No emoji in the UI or in committed documents.

## Store submission

The repository is submission-ready; `README.md`'s Deploy section is the
procedure. `docs/store/listing.md` holds every dashboard field, `PRIVACY.md`
is the privacy policy, and `docs/store/screenshots/` holds four 1280x800
captures taken from the running extension.

Permissions are exactly `declarativeNetRequest`, `contextMenus`, `storage`
plus the `file:///*` host permission, and tests assert both sets. Do not add
one without a justification written into `docs/store/listing.md`; every
permission has to be defended to review.

**totoPDF opens local files only, and that is what keeps the host permission
narrow.** `parseViewerQuery` rejects anything that is not a `file://` URL, so
the extension makes no network requests at all. A PDF from the web is handled
by the user downloading it and dragging it in, which needs no permission.
Re-adding remote loading means going back to broad host access and
re-justifying it — treat it as a product decision, not a feature gap.

## Verification culture

Claims in this repo are expected to be backed by evidence, and the README
distinguishes what was **observed** in a browser from what was **inferred**.
Keep that distinction when you add to it. The native save-file picker, for
instance, cannot be driven by Playwright, so the save path is exercised
through the code the button calls and the README says exactly that.
