# src/ui

DOM builders for the viewer's chrome — toolbar, rails, controls. Presentation
only: nothing here opens a document, saves one, or knows what pdf.js is.

## The rule that defines this directory

**No pdf.js import, anywhere in here.** Not even a type-only one. Controls
talk to the viewer through small interfaces declared on this side —
`ZoomController`, `PageController`, `SaveStatusSource`, `AnnotationBridge` —
which `src/viewer` implements over pdf.js. That inversion is what lets a
control be built and read without pulling a PDF engine into scope, and it is
why `zoom.ts` and `page-nav.ts` (the logic) are separate files from
`zoom-control.ts` and `page-nav-control.ts` (the DOM): the logic halves are
unit-testable under node.

If a control needs something pdf.js knows, add a method to the interface and
implement it in `src/viewer`. Do not import pdf.js here.

## Teardown: every listener takes an AbortSignal

`renderToolbar` runs again on every document open. `window`, `document` and
the scroll container all outlive the elements it replaces, so a listener
attached to any of them without a signal leaks — and stacks another copy on
the next open.

One module-level `AbortController` in `toolbar.ts` is aborted and replaced on
each render, and its signal is threaded into everything: the keyboard
handler, the zoom popover's dismiss handlers, the scale and page
subscriptions, `zoom.bindWheel`, and the swatch strip's listeners. Element-
owned listeners take it too, because it costs nothing and removes the
judgment call.

**When you add a control, take the signal and pass it to every
`addEventListener`.** If you are unsure whether a listener needs it, it does.

## Styles

`tokens.css` holds the `:root` custom properties and is imported **directly
by every entry point** — `src/viewer/main.ts` and `src/welcome/main.ts` —
rather than being `@import`ed from another stylesheet. That symmetry is what
makes Rollup dedupe it into one output file. Reaching it one way from one
entry and another way from another duplicates the block and collapses the
viewer's asset splitting. There is a comment in `tokens.css` saying so; leave
it there.

Use the existing custom properties. Do not add colour literals. Spacing comes
from the `--space-*` scale (4/8/12/16/24px).

`styles.css` is over the project's 300-line limit (373). That is pre-existing
and known. If you are adding a substantial block, split it into its own file
rather than growing this one further.

## Copy

Every user-facing string comes from `t()` in `src/core/i18n.ts`. Adding one
means adding a key to **both** `src/i18n/en.json` and `src/i18n/es.json` —
the conformance tests enforce identical key sets, matching placeholders, and
no empty messages. An unknown key is a compile error, not a blank button.

No emoji. No marketing register. Tooltips explain what a control does and
which key does the same thing.

**The word "Highlight" must not appear in a swatch's `title`** (nor
"Resaltar" in Spanish). The e2e specs locate the Highlight button by
accessible name and Playwright matches by substring, so a swatch tooltip
containing it makes the locator ambiguous. A test asserts this.
