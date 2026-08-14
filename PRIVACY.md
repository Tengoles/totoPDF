# Política de privacidad de totoPDF

Última actualización: 14 de agosto de 2026

*English version below / Versión en inglés más abajo.*

## En resumen

totoPDF no recopila nada, no envía nada a ninguna parte y no tiene servidor
al que enviarlo. Tus PDF y todo lo que escribas en ellos se quedan en tu
computadora.

## Qué hace totoPDF con tus archivos

totoPDF abre un PDF, lo muestra y te deja agregar resaltados y cuadros de
texto. Cuando guardas, escribe esas anotaciones dentro del archivo PDF en tu
disco, a través de la File System Access API del navegador, el mismo
mecanismo que te muestra un diálogo de guardado y te pregunta en qué archivo
escribir.

El archivo nunca sale de tu computadora: totoPDF no sube nada, y no hay
servidor al que pudiera subirlo. La única petición de red que hace es
descargar el PDF que le pediste abrir, desde la dirección desde la que lo
abriste. Es la misma petición que haría Chrome para mostrar ese PDF. totoPDF
no tiene analíticas, ni telemetría, ni reportes de errores, ni publicidad, ni
rastreo de ningún tipo.

## Qué guarda totoPDF, y dónde

Tres cosas, todas en el almacenamiento que el navegador le da a la extensión
en tu propia máquina, y ninguna de ellas se transmite a ninguna parte.

**Tu configuración**, en `chrome.storage.local`. Los cinco colores de
resaltado, cuál está seleccionado, y el color y el tamaño del texto para los
cuadros de texto. Nada sobre qué documentos abriste.

**Referencias a archivos**, en IndexedDB. Cuando guardas un documento por
primera vez, el navegador le da a totoPDF un identificador del archivo que
elegiste. Guardarlo es lo que permite que los guardados posteriores del mismo
documento escriban en el mismo archivo sin volver a preguntarte. Es una
referencia que controla el navegador, no una copia del archivo.

**Un registro de recuperación**, en IndexedDB. Mientras anotas, totoPDF
registra las anotaciones que hiciste pero todavía no guardaste. Es el único
dato almacenado que contiene contenido de tu documento: concretamente, los
resaltados y los cuadros de texto que creaste, incluido cualquier texto que
hayas escrito en un cuadro de texto. Es una copia de respaldo local de los
cambios sin guardar. Se escribe en la base de datos local del navegador en tu
computadora y nunca se envía a ninguna parte.

Para eliminar las tres, desinstala la extensión. Chrome borra los datos de
`chrome.storage` e IndexedDB de una extensión cuando se la elimina.

## Por qué totoPDF pide acceso a todos los sitios

Chrome lo muestra como "Leer y modificar todos tus datos en todos los sitios
web", que suena mucho más grande que lo que totoPDF hace con ese permiso, así
que conviene decirlo con claridad.

totoPDF lo necesita para dos cosas. Redirige las direcciones de PDF a su
propio visor, y Chrome exige permiso para la dirección que se está
redirigiendo. Y una vez que el visor está abierto, tiene que descargar el PDF
que le indicaste, que puede estar en cualquier dirección.

Se consideró un permiso más restringido y no funciona: los PDF se sirven
constantemente desde direcciones que no terminan en `.pdf`, así que un
permiso basado en patrones fallaría en silencio con muchos documentos.

totoPDF no lee, no modifica ni recopila el contenido de las páginas web. Lo
único que descarga es un PDF que le pediste abrir.

## Archivos locales

Si activas "Permitir acceso a URL de archivo" en la tarjeta de totoPDF en
`chrome://extensions`, totoPDF puede abrir los PDF guardados en tu
computadora. Ese permiso es de Chrome, viene desactivado, una extensión no
puede activarlo por su cuenta, y puedes desactivarlo cuando quieras. totoPDF
lo usa solamente para leer un PDF que abriste o al que navegaste.

## Niños

totoPDF es una herramienta para documentos, sin cuentas, sin funciones
sociales y sin recopilación de datos. No recopila nada de nadie, incluidos
los niños.

## Cambios en esta política

Si esta política cambia, la nueva versión se sube a este repositorio y se
actualiza la fecha de arriba. El historial del repositorio es el registro
completo de lo que este documento dijo.

## Contacto

Las preguntas sobre esta política, o sobre cualquier cosa que totoPDF haga
con tus datos, se pueden plantear como un issue en el repositorio del
proyecto.

---
---

# Privacy policy for totoPDF

Last updated: 14 August 2026

## The short version

totoPDF does not collect anything, does not send anything anywhere, and has
no server to send it to. Your PDFs and everything you write into them stay on
your computer.

## What totoPDF does with your files

totoPDF opens a PDF, displays it, and lets you add highlights and text boxes.
When you save, it writes those annotations into the PDF file on your disk,
through the browser's File System Access API, the same mechanism that shows
you a save dialog and asks which file to write.

The file never leaves your computer: totoPDF uploads nothing, and there is no
server for it to upload to. The only network request it makes is fetching the
PDF you asked it to open, from the address you opened it from. That is the
same request Chrome would make to display that PDF itself. totoPDF contains no
analytics, no telemetry, no crash reporting, no advertising, and no tracking
of any kind.

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
the annotations you have made but not yet saved. This is the only stored item
that contains content from your document: specifically, the highlights and
text boxes you created, including any text you typed into a text box. It is a
local backup of unsaved changes. It is written to the browser's local database
on your computer and is never sent anywhere.

To remove all three, uninstall the extension. Chrome deletes an extension's
`chrome.storage` and IndexedDB data when the extension is removed.

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
