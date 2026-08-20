# Chrome Web Store listing

Every field the developer dashboard asks for, written out so submission is
copy-and-paste rather than composition under pressure. Keep this file in step
with what is actually submitted.

**Spanish is the primary listing language.** `default_locale` in the manifest
is `es`, so the title the store displays comes from the Spanish catalogue, and
any browser in neither Spanish nor English falls back to Spanish.

Two audiences, two languages, deliberately:

- **Store listing tab** is read by users. Spanish primary, English added as a
  second listing language.
- **Privacy tab** — the single-purpose statement and permission
  justifications — is read by Google's review team, not by users. Those stay
  in English, which is the safest language for review.

---

## Store listing tab — Spanish (primary)

**Extension name**

Not editable in the dashboard. It comes from the manifest, which resolves
`__MSG_extensionName__` against `src/i18n/es.json`. To change it, edit that
file and re-package.

```
totoPDF - Todo Obvio, Todo Operativo
```

**Resumen del paquete** (the short summary)

Not a field you fill in. The dashboard shows it read-only, resolved from the
manifest's `description`, which is `extensionDescription` in
`src/i18n/es.json`. To change it, edit that catalogue and re-package. Current
value, 102 characters against the 132 limit:

```
Lee PDFs, resalta texto y agrega cuadros de texto. Las anotaciones se escriben dentro del archivo PDF.
```

**Categoría**

```
Herramientas
```

Set once for all languages, not per listing language. Chrome's current
taxonomy has no "Productividad"; Herramientas is the closest fit for a
document tool.

**Idioma**

```
español – es
```

**Descripción** — the detailed description

The main body, 16,000 character limit. Do NOT paste the summary here; the
dashboard already shows that separately, directly above this field.

```
totoPDF abre los PDF en su propio visor para que puedas resaltar texto y agregar cuadros de texto, y después escribe lo que agregaste dentro del archivo PDF.

Eso último es lo importante. Las anotaciones se guardan como objetos de anotación PDF estándar, agregados al archivo como una actualización incremental en lugar de una reescritura. Los bytes originales quedan intactos y los objetos nuevos se agregan encima. Abre el mismo archivo en Chrome, Edge o cualquier otro lector de PDF y los resaltados y los cuadros de texto están ahí, porque son contenido PDF real y no algo que solo totoPDF entiende.

Cómo abrir un PDF
- Los PDF de tu computadora se abren en totoPDF automáticamente, una vez que actives "Permitir acceso a URL de archivo" en la tarjeta de totoPDF en chrome://extensions. Chrome exige que actives ese permiso a mano; una extensión no puede activarlo por su cuenta.
- Haz clic derecho en un PDF de tu computadora y elige "Abrir en totoPDF", o haz clic en el icono de totoPDF en la barra mientras el PDF está abierto.
- Arrastra un PDF a una pestaña de totoPDF que ya esté abierta. Así es como se anota un PDF de internet: descárgalo y arrástralo.

Anotar
- Resalta texto con una paleta de cinco colores. Con la herramienta de resaltado activa, las teclas 1 a 5 cambian el color. Haz clic derecho en un color para cambiarlo por el que quieras; la paleta se recuerda entre sesiones.
- También puedes resaltar una página escaneada. Donde no hay texto que seleccionar, mantén pulsado y arrastra sobre la línea que quieras cubrir, y totoPDF pinta el trazo.
- Agrega un cuadro de texto en cualquier parte de una página, con su propio color y un tamaño de fuente de 6 a 96.
- Un panel de Notas lista todos los resaltados y cuadros de texto del documento, incluidos los guardados en una sesión anterior. Haz clic en una entrada para ir a su página.
- El panel de Páginas muestra miniaturas, con navegación entre páginas y zoom desde la barra o el teclado.

Guardar
- La primera vez que guardas, totoPDF pregunta dónde escribir el archivo. Después de eso recuerda el archivo y escribe ahí.
- Una vez que un documento se guardó al menos una vez, las anotaciones siguientes se escriben solas dos segundos después de que dejas de editar, y un indicador al lado del botón Guardar dice si tu trabajo está en el archivo.
- totoPDF te avisa antes de cerrar una pestaña con anotaciones sin guardar.

Lo que conviene saber antes de instalarlo
- Los PDF cifrados se abren en modo lectura. Guardar uno exigiría cifrar también las anotaciones agregadas, y en lugar de devolverte un archivo que parece guardado pero está corrupto, totoPDF desactiva el guardado y explica por qué.
- Las páginas escaneadas se resaltan dibujando en lugar de seleccionando, porque no hay texto al que anclarse, y totoPDF no hace OCR. Marcas una región, no palabras: el panel de Notas lista ese resaltado sin fragmento de texto, porque no hay palabras debajo que citar.
- Cada guardado agrega una revisión en lugar de reescribir el archivo, que es justamente lo que lo hace no destructivo, y eso significa que el archivo crece a medida que trabajas. Nada elimina las revisiones viejas.
- Los cuadros de texto usan la única fuente que trae el visor. El color y el tamaño se pueden cambiar; la fuente no.

Privacidad
totoPDF no hace ninguna petición de red: no sube nada, no descarga nada y no tiene servidor. Solo abre archivos que ya están en tu disco, y por eso pide acceso a tus archivos y no a los sitios web. No tiene analíticas ni rastreo de ningún tipo. Tus documentos nunca salen de tu computadora. La configuración, las referencias a archivos y el registro de recuperación se guardan localmente en el navegador y nunca se transmiten.

La interfaz está en español e inglés y sigue el idioma de tu navegador.
```

---

## Store listing tab — English (add as a second language)

Added from the same dashboard, under the listing's language selector. Adding
it does not change the extension or require a new package.

**Extension name** — resolved from `src/i18n/en.json`:

```
totoPDF - Highlight and Annotate PDFs
```

**Resumen del paquete** — read-only, from `extensionDescription` in
`src/i18n/en.json`:

```
Read PDFs, highlight text, and add text boxes. Annotations are written into the PDF file.
```

Category is global and already set to Herramientas; it is not repeated per
language.

**Descripción** — the detailed description

```
totoPDF opens PDFs in its own viewer so you can highlight text and add text boxes, then writes what you added into the PDF file itself.

That last part is the point. Annotations are saved as standard PDF annotation objects, appended to the file as an incremental update rather than a rewrite. The original bytes are left untouched and the new objects are added on top. Open the same file in Chrome, Edge, or any other PDF reader and the highlights and text boxes are there, because they are real PDF content and not something only totoPDF understands.

Opening a PDF
- Local PDFs open in totoPDF automatically, once you turn on "Allow access to file URLs" on totoPDF's chrome://extensions card. Chrome requires that switch to be set by hand; an extension cannot turn it on for itself.
- Right-click a PDF on your computer and choose "Open in totoPDF", or click the totoPDF toolbar icon while the PDF is open.
- Drag a PDF onto an open totoPDF tab. That is how you annotate a PDF from the web: download it, then drop it in.

Annotating
- Highlight text with a five-colour palette. With the highlight tool armed, keys 1 to 5 switch colour. Right-click a swatch to change that colour to anything you like; the palette is remembered between sessions.
- Highlight a scanned page too. Where there is no text to select, hold and drag along the line you want covered and totoPDF paints the stroke instead.
- Add a text box anywhere on a page, with its own colour and a font size from 6 to 96.
- A Notes rail lists every highlight and text box in the document, including ones saved in an earlier session. Click an entry to jump to its page.
- A page thumbnail rail, page navigation, and zoom from the toolbar or the keyboard.

Saving
- The first save asks where to write the file. After that, totoPDF remembers and writes to the same file.
- Once a document has been saved once, further annotations are written automatically two seconds after you stop editing, and a readout next to the Save button says whether your work is in the file.
- totoPDF warns you before closing a tab with unsaved annotations.

Worth knowing before you install
- Encrypted PDFs open read-only. Saving one would require encrypting the appended annotations too, and rather than hand back a file that looks saved but is corrupt, totoPDF disables saving and says why.
- Scanned pages are highlighted by drawing rather than by selecting, because there is no text to anchor to, and totoPDF does not do OCR. You mark a region, not words: the Notes rail lists such a highlight with no text excerpt, because there are none underneath to quote.
- Every save appends a revision rather than rewriting the file, which is what makes it non-destructive, and it means the file grows as you work. Nothing prunes old revisions.
- Text boxes use the one font the viewer provides. Colour and size are adjustable; the font is not.

Privacy
totoPDF makes no network requests at all: it uploads nothing, downloads nothing, and has no server. It only opens files already on your disk, which is why it asks for access to your files rather than to websites. It contains no analytics or tracking of any kind. Your documents never leave your computer. Settings, file handles and the recovery journal are stored locally by the browser and are never transmitted.

The interface is available in English and Spanish and follows your browser's language.
```

---

## Privacy tab

Read by Google's review team rather than by users, so these stay in English.

**Single purpose description**

```
totoPDF is a PDF viewer that lets a person annotate a PDF and save those annotations into the PDF file. Every feature it has serves that one purpose: displaying a PDF, adding highlights and text boxes to it, and writing the result back to the file.
```

**Permission justifications**

`declarativeNetRequest`

```
Redirects a local (file://) PDF URL to totoPDF's own viewer page. This is the mechanism that makes a PDF open in totoPDF rather than in Chrome's built-in viewer, which is the extension's core function. The rule matches file:///*.pdf only. It is also used to let a single navigation through to Chrome's viewer when the user clicks "Open in Chrome".
```

`contextMenus`

```
Adds one item, "Open in totoPDF", to the right-click menu on local (file://) PDF links and PDF pages. It is scoped to file:///* and does not appear on web pages. This is how a user opens a PDF in totoPDF without changing any browser default.
```

`storage`

```
Stores the user's own settings: the five highlight colours, which one is selected, and the colour and font size used for text boxes, so they persist between sessions. No document content and no browsing data is stored here.
```

**Host permission justification** (`file:///*`)

```
totoPDF opens PDFs stored on the user's own computer and writes annotations back into them. It needs file:// access to read those files, and to redirect a local PDF URL to its own viewer page.

It requests no access to websites, and makes no network requests of any kind. A PDF from the web is handled by the user downloading it and dragging it onto a totoPDF tab, which needs no permission at all.
```

**Remote code**

```
No. All code is included in the extension package. The PDF rendering engine (pdf.js) and its worker, font data and WASM are bundled at build time. Nothing is fetched or evaluated at runtime.
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

```
https://github.com/Tengoles/totoPDF/blob/main/PRIVACY.md
```

`PRIVACY.md` is bilingual, Spanish first then English, so one URL serves both
listing languages.

---

## Assets

- Icon: `public/icons/icon128.png` (the store shows the 128).
- Screenshots: `docs/store/screenshots/`, four files, each exactly 1280×800,
  24-bit RGB with no alpha channel — which is what the dashboard requires
  ("PNG de 24 bits (no alfa)"). Verified from the PNG headers: colour type 2,
  bit depth 8. Regenerating them is fine as long as that holds; a Playwright
  screenshot taken with `omitBackground` would produce RGBA and be rejected.
  They show the English interface. The store does not require screenshots per
  listing language, and the interface differs only in its labels.
- Small promo tile (440×280): not produced. It is optional, and is only used
  if the extension is featured.

---

## Before you submit

1. Bump the version in **both** `public/manifest.json` and `package.json` —
   a test enforces that they match, and the store refuses a re-upload whose
   version did not increase.
2. `npm run package`, then upload the resulting zip.
3. Registering as a Chrome Web Store developer costs a one-time $5 fee. The
   extension itself is free to publish and free to install.
4. The host permission is `file:///*` only, and the extension makes no
   network requests. **Confirmed end to end: submitted 2026-08-14, approved
   2026-08-18 — four days, with no questions asked about permissions.**
   `file:///*` does not trigger the "broad host permissions" warning. With `<all_urls>` the
   dashboard warned that the extension might need in-depth review and
   suggested `activeTab` or specific sites; after narrowing to `file:///*`
   that warning was gone entirely. Do not widen it back without expecting
   that warning, and the slower review it implies, to return.
