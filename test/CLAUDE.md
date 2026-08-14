# test

Two suites with different jobs. Know which one you are writing before you
start.

## Unit and integration — `test/unit/`, vitest, node environment

    npm test

No jsdom, no browser. This works because `src/core` has no runtime pdf.js
dependency and no DOM access, which is the layering rule that makes most of
this codebase testable at all.

`t()` falls back to reading `src/i18n/en.json` directly when there is no
`chrome` global, so specs assert real English copy with **no mock**. If a spec
needs a `chrome.i18n` mock to pass, something is wrong with the fallback, not
with the spec.

## End-to-end — `test/e2e/`, Playwright, real Chromium

    npm run build
    npx vite-node test/fixtures/generate.ts
    npm run test:e2e

Loads the actual built extension into a real browser via
`chromium.launchPersistentContext` — the only way Playwright can load an MV3
extension. `test/e2e/extension-context.ts` centralises the launch and resolves
the extension id from the service worker URL; use it rather than launching
your own.

**Saved files are verified with pdf-lib, not pdf.js.** That is deliberate:
pdf.js is what the app renders with, so verifying its own output with it
could let a bug in one mask a bug in the other. Keep the verifier
independent.

**`--lang=en-US` is pinned in the launch args and is load-bearing.**
`palette.spec.ts` and `round-trip.spec.ts` locate the Highlight button by
accessible name, and the extension is bilingual — without the pin, these fail
on a machine whose Chrome runs in Spanish, for a reason that looks nothing
like the actual cause.

## Fixtures are generated, not committed

`test/fixtures/*.pdf` are produced by `test/fixtures/generate.ts` and are
gitignored. Regenerate them whenever you need them. `text.pdf` has a real
text layer (highlighting needs one); `large.pdf` is 1000 pages, for the
canvas-memory budget test and for anything needing a populated thumbnail
rail; there are also `no-text.pdf`, `rotated.pdf` and `pre-annotated.pdf`.

## What cannot be tested here, and why

The native save-file picker. `showSaveFilePicker()` opens an OS dialog
Playwright cannot complete, so an unattended run gets an auto-abort. The save
path is exercised through the same code the button calls
(`buildSavedBytes`) instead. When you report on saving, say which of the two
you actually did — the README's verification section distinguishes observed
from inferred and that distinction is worth keeping.

## Conventions

Tests assert real copy as string literals. That is what makes the English
catalogue's byte-for-byte fidelity checkable, and it is why a change to
user-facing English text will fail tests — that is the feature, not a
nuisance. Update the catalogue and the specs together, deliberately.
