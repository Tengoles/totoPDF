# totoPDF

A Chrome extension that opens PDFs in its own viewer so you can highlight text
and add text boxes. Annotations are written into the PDF file as standard PDF
annotation objects, so Acrobat, Preview, Firefox and Chrome's own viewer all
render them.

## Setup

    npm install

## Run

    npm run build

Then open `chrome://extensions`, enable Developer mode, choose "Load unpacked",
and select the `dist/` directory.

To open local PDFs automatically, open totoPDF's entry on that page and enable
"Allow access to file URLs".

## Test

    npm test          # unit and integration
    npm run typecheck

End-to-end tests load the real built extension into Chromium and verify a
saved file with pdf-lib, an implementation independent of the pdf.js this
project renders with. They need a build and generated fixtures first:

    npm run build
    npx vite-node test/fixtures/generate.ts
    npm run test:e2e

`test/fixtures/*.pdf` are generated, not committed; regenerate them with the
command above whenever you need them.

## Deploy

Not published. Loaded unpacked from `dist/`.
