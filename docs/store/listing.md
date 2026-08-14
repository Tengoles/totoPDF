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

**Short description** (132 character limit — this is 118)

```
Lee PDFs en un visor que resalta texto y agrega cuadros de texto, escritos dentro del archivo como anotaciones reales.
```

**Category**

```
Productividad
```

**Language**

```
Español (Latinoamérica)
```

**Detailed description**

```
totoPDF abre los PDF en su propio visor para que puedas resaltar texto y
agregar cuadros de texto, y después escribe lo que agregaste dentro del
archivo PDF.

Eso último es lo importante. Las anotaciones se guardan como objetos de
anotación PDF estándar, agregados al archivo como una actualización
incremental en lugar de una reescritura. Los bytes originales quedan
intactos y los objetos nuevos se agregan encima. Abre el mismo archivo en
Chrome, Edge o cualquier otro lector de PDF y los resaltados y los cuadros de
texto están ahí, porque son contenido PDF real y no algo que solo totoPDF
entiende.

Cómo abrir un PDF
- Los PDF de tu computadora se abren en totoPDF automáticamente, una vez que
  actives "Permitir acceso a URL de archivo" en la tarjeta de totoPDF en
  chrome://extensions. Chrome exige que actives ese permiso a mano; una
  extensión no puede activarlo por su cuenta.
- Cualquier PDF, local o de la web: haz clic derecho y elige "Abrir en
  totoPDF", o haz clic en el icono de totoPDF en la barra mientras el PDF
  está abierto.
- Arrastra un PDF a una pestaña de totoPDF que ya esté abierta.

Anotar
- Resalta texto con una paleta de cinco colores. Con la herramienta de
  resaltado activa, las teclas 1 a 5 cambian el color. Haz clic derecho en un
  color para cambiarlo por el que quieras; la paleta se recuerda entre
  sesiones.
- Agrega un cuadro de texto en cualquier parte de una página, con su propio
  color y un tamaño de fuente de 6 a 96.
- Un panel de Notas lista todos los resaltados y cuadros de texto del
  documento, incluidos los guardados en una sesión anterior. Haz clic en una
  entrada para ir a su página.
- El panel de Páginas muestra miniaturas, con navegación entre páginas y zoom
  desde la barra o el teclado.

Guardar
- La primera vez que guardas, totoPDF pregunta dónde escribir el archivo.
  Después de eso recuerda el archivo y escribe ahí.
- Una vez que un documento se guardó al menos una vez, las anotaciones
  siguientes se escriben solas dos segundos después de que dejas de editar, y
  un indicador al lado del botón Guardar dice si tu trabajo está en el
  archivo.
- totoPDF te avisa antes de cerrar una pestaña con anotaciones sin guardar.

Lo que conviene saber antes de instalarlo
- Los PDF cifrados se abren en modo lectura. Guardar uno exigiría cifrar
  también las anotaciones agregadas, y en lugar de devolverte un archivo que
  parece guardado pero está corrupto, totoPDF desactiva el guardado y explica
  por qué.
- Las páginas escaneadas sin capa de texto no se pueden resaltar, porque la
  herramienta de resaltado se ancla al texto y ahí no hay. Los cuadros de
  texto sí funcionan en esas páginas. totoPDF no hace OCR.
- Cada guardado agrega una revisión en lugar de reescribir el archivo, que es
  justamente lo que lo hace no destructivo, y eso significa que el archivo
  crece a medida que trabajas. Nada elimina las revisiones viejas.
- Los cuadros de texto usan la única fuente que trae el visor. El color y el
  tamaño se pueden cambiar; la fuente no.

Privacidad
totoPDF no tiene servidor propio y no envía nada a ninguna parte. La única
petición de red que hace es descargar el PDF que abres, desde la dirección
desde la que lo abriste. No tiene analíticas ni rastreo de ningún tipo. Tus
documentos nunca salen de tu computadora. La configuración, las referencias a
archivos y el registro de recuperación se guardan localmente en el navegador y
nunca se transmiten.

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

**Short description** (132 character limit — this is 114)

```
Read PDFs in a viewer that highlights text and adds text boxes, written into the PDF file as real PDF annotations.
```

**Category**

```
Productivity
```

**Detailed description**

```
totoPDF opens PDFs in its own viewer so you can highlight text and add text
boxes, then writes what you added into the PDF file itself.

That last part is the point. Annotations are saved as standard PDF annotation
objects, appended to the file as an incremental update rather than a rewrite.
The original bytes are left untouched and the new objects are added on top.
Open the same file in Chrome, Edge, or any other PDF reader and the
highlights and text boxes are there, because they are real PDF content and not
something only totoPDF understands.

Opening a PDF
- Local PDFs open in totoPDF automatically, once you turn on "Allow access to
  file URLs" on totoPDF's chrome://extensions card. Chrome requires that
  switch to be set by hand; an extension cannot turn it on for itself.
- Any PDF, local or on the web: right-click and choose "Open in totoPDF", or
  click the totoPDF toolbar icon while the PDF is open.
- Drag a PDF onto an open totoPDF tab.

Annotating
- Highlight text with a five-colour palette. With the highlight tool armed,
  keys 1 to 5 switch colour. Right-click a swatch to change that colour to anything you
  like; the palette is remembered between sessions.
- Add a text box anywhere on a page, with its own colour and a font size from
  6 to 96.
- A Notes rail lists every highlight and text box in the document, including
  ones saved in an earlier session. Click an entry to jump to its page.
- A page thumbnail rail, page navigation, and zoom from the toolbar or the
  keyboard.

Saving
- The first save asks where to write the file. After that, totoPDF remembers
  and writes to the same file.
- Once a document has been saved once, further annotations are written
  automatically two seconds after you stop editing, and a readout next to the
  Save button says whether your work is in the file.
- totoPDF warns you before closing a tab with unsaved annotations.

Worth knowing before you install
- Encrypted PDFs open read-only. Saving one would require encrypting the
  appended annotations too, and rather than hand back a file that looks saved
  but is corrupt, totoPDF disables saving and says why.
- Scanned pages with no text layer cannot be highlighted, because the
  highlight tool anchors to text and there is none. Text boxes still work on
  those pages. totoPDF does not do OCR.
- Every save appends a revision rather than rewriting the file, which is what
  makes it non-destructive, and it means the file grows as you work. Nothing
  prunes old revisions.
- Text boxes use the one font the viewer provides. Colour and size are
  adjustable; the font is not.

Privacy
totoPDF has no server of its own and sends nothing anywhere. The only network
request it makes is fetching the PDF you open, from the address you opened it
from. It contains no analytics or tracking of any kind. Your documents never
leave your computer. Settings, file handles and the recovery journal are
stored locally by the browser and are never transmitted.

The interface is available in English and Spanish and follows your browser's
language.
```

---

## Privacy tab

Read by Google's review team rather than by users, so these stay in English.

**Single purpose description**

```
totoPDF is a PDF viewer that lets a person annotate a PDF and save those
annotations into the PDF file. Every feature it has serves that one purpose:
displaying a PDF, adding highlights and text boxes to it, and writing the
result back to the file.
```

**Permission justifications**

`declarativeNetRequest`

```
Redirects a PDF URL to totoPDF's own viewer page. This is the mechanism that
makes a PDF open in totoPDF rather than in Chrome's built-in viewer, which is
the extension's core function. It is also used to let a single navigation
through to Chrome's viewer when the user clicks "Open in Chrome".
```

`contextMenus`

```
Adds one item, "Open in totoPDF", to the right-click menu on PDF links and
PDF pages. This is how a user opens a PDF in totoPDF without changing any
browser default.
```

`storage`

```
Stores the user's own settings: the five highlight colours, which one is
selected, and the colour and font size used for text boxes, so they persist
between sessions. No document content and no browsing data is stored here.
```

**Host permission justification** (`<all_urls>`)

```
Two things need it. First, redirecting a PDF URL to totoPDF's viewer requires
permission for the address being redirected, and a PDF can be at any address.
Second, once the viewer is open it must fetch the PDF it was pointed at, which
again can be any address.

A narrower pattern was considered and does not work: PDFs are frequently
served from URLs that do not end in .pdf, so a pattern-based permission would
silently fail on many documents.

totoPDF does not read, modify or collect the content of web pages. The only
resource it fetches is a PDF the user has explicitly asked it to open.
```

**Remote code**

```
No. All code is included in the extension package. The PDF rendering engine
(pdf.js) and its worker, font data and WASM are bundled at build time. Nothing
is fetched or evaluated at runtime.
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
- Screenshots: `docs/store/screenshots/`, four files, each exactly 1280×800.
  They show the English interface; the store does not require screenshots per
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
4. Expect the `<all_urls>` host permission to draw the closest review
   scrutiny. The justification above is the honest account of why it is
   needed; do not narrow the claim to sound smaller than it is.
