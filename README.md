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

## Deploy

Not published. Loaded unpacked from `dist/`.
