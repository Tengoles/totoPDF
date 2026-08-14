# Privacy policy for totoPDF

Last updated: 13 August 2026

## The short version

totoPDF does not collect anything, does not send anything anywhere, and has
no server to send it to. Your PDFs and everything you write into them stay on
your computer.

## What totoPDF does with your files

totoPDF opens a PDF, displays it, and lets you add highlights and text boxes.
When you save, it writes those annotations into the PDF file on your disk,
through the browser's File System Access API — the same mechanism that shows
you a save dialog and asks which file to write.

The file never leaves your computer. totoPDF has no network code: it makes no
requests to any server operated by this project or by anyone else, because
there is no such server. It contains no analytics, no telemetry, no crash
reporting, no advertising, and no tracking of any kind.

## What totoPDF stores, and where

Three things, all of them in storage the browser provides to the extension on
your own machine, and none of them transmitted anywhere.

**Your settings**, in `chrome.storage.local`. The five highlight colours, which
one is selected, and the text colour and size for text boxes. Nothing about
which documents you opened.

**File handles**, in IndexedDB. When you save a document for the first time,
the browser gives totoPDF a handle to the file you chose. Storing it is what
lets later saves on the same document write to the same file without asking
you again. A handle is a reference the browser controls, not a copy of the
file.

**A crash-recovery journal**, in IndexedDB. As you annotate, totoPDF records
the annotations you have made but not yet saved, so an unexpected tab close
does not lose them. This is the only stored item that contains content from
your document — specifically, the highlights and text boxes you created,
including any text you typed into a text box. It exists so your work survives
a crash. It is written to the browser's local database on your computer and
is never sent anywhere.

To remove all three, uninstall the extension. Chrome deletes an extension's
`chrome.storage` and IndexedDB data when the extension is removed. You can
also clear the settings alone from the browser's site data controls.

## Why totoPDF asks for access to all sites

Chrome shows this as "Read and change all your data on all websites", which
sounds much larger than what totoPDF does with it, so it is worth stating
plainly.

totoPDF needs it for two things. It redirects PDF URLs to its own viewer, and
Chrome requires permission for the address being redirected. And once the
viewer is open, it has to fetch the PDF you pointed it at, which can be at any
address.

A narrower permission was considered and does not work: PDFs are constantly
served from URLs that do not end in `.pdf`, so a pattern-based permission
would silently fail on many documents.

totoPDF does not read, modify, or collect the content of web pages. The only
thing it fetches is a PDF you have asked it to open.

## Local files

If you turn on "Allow access to file URLs" on totoPDF's `chrome://extensions`
card, totoPDF can open PDFs stored on your computer. That switch is Chrome's,
it is off by default, an extension cannot turn it on for itself, and you can
turn it off at any time. totoPDF uses it only to read a PDF you navigate to or
explicitly open.

## Children

totoPDF is a document tool with no accounts, no social features, and no data
collection. It collects nothing from anyone, including children.

## Changes to this policy

If this policy changes, the new version will be committed to this repository
and the date at the top will be updated. The repository's history is the
complete record of what this document has said.

## Contact

Questions about this policy, or about anything totoPDF does with your data,
can be raised as an issue on the project's repository.
