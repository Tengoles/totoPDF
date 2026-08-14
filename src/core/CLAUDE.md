# src/core

Logic with no browser and no PDF renderer behind it. This is the layer that
can be reasoned about and tested on its own.

## The rule that defines this directory

**No runtime dependency on pdf.js and no DOM access.** There is exactly one
pdf.js reference in here — `import type { PDFDocumentProxy }` in
`document-capabilities.ts` — and it is type-only, so it is erased at build
and pulls nothing in. Nothing here touches `document` or `window`.

That is what lets every file in this directory be tested under vitest's node
environment with no jsdom and no browser. If you find yourself needing the
DOM, the code belongs in `src/ui`; if you need pdf.js, it belongs in
`src/viewer`.

## What lives here

| File | Responsibility |
|---|---|
| `i18n.ts` | `t()` and the `MessageKey` union. Every user-facing string goes through it. |
| `settings.ts` | The palette, text-box defaults, and their storage. Also `paletteDisplayName`. |
| `annotation-bridge.ts` | The tool-mode contract the toolbar drives and the viewer implements. |
| `annotation-index.ts` | Reads annotations out of a document into rail items. |
| `document-capabilities.ts` | What a given PDF allows: encrypted means no save, no text layer means no highlight. |
| `document-source.ts` | Loading a document from a URL or a File, and its identity. |
| `identity.ts` | The content hash a document is keyed by. |
| `file-handles.ts` | The IndexedDB store of File System Access handles. |
| `file-writer.ts` | Writing bytes through a handle, and the permission check around it. |
| `save-pipeline.ts` | Builds the saved bytes and asserts the original ones survived. |
| `recovery-journal.ts` | The debounced crash buffer of unsaved annotations. |

## Things that will bite you

**`PaletteEntry.name` is an identity, not a label.** It is the stable
lowercase ASCII id (`'yellow'`), it is what gets persisted, and it must never
be localized. `paletteDisplayName(name)` resolves it for display. Localizing
the stored value would leave a Spanish name in an English UI after a locale
change and would need a migration nobody wrote.

**`paletteToHighlightColors()` output is parsed by pdf.js**, which splits it
on `,` then `=`. A display name containing either character breaks its
parser, which is why `SAFE_NAME` exists and why the catalogue tests assert
the colour names match `^[A-Za-z0-9 _-]+$`.

**Stored settings are untrusted input.** They may come from an older version,
a hand edit, or corruption. `normalizeSettings` falls back field by field and
that is deliberate — do not replace it with a schema that throws.

**Six error messages here stay in English on purpose** — the two in
`file-handles.ts`, the two in `recovery-journal.ts`, and the two in
`save-pipeline.ts`. They signal a bug rather than a user mistake, and an
English string stays greppable in an issue. Everything a user can actually
cause is localized.

**`save-pipeline.ts` asserts the original bytes are unchanged.** Saving
appends an incremental update; it never rewrites. If a change here makes that
assertion fail, the change is wrong, not the assertion — it is the only thing
standing between a bug and a corrupted document.
