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

El archivo nunca sale de tu computadora. totoPDF no hace ninguna petición de
red: no sube nada, no descarga nada y no hay servidor al que pudiera hacerlo.
Solo abre archivos que ya están en tu disco. No tiene analíticas, ni
telemetría, ni reportes de errores, ni publicidad, ni rastreo de ningún tipo.

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

## Qué permisos pide totoPDF, y por qué

totoPDF pide acceso a los archivos de tu computadora (`file:///*`) y nada
más. No pide acceso a sitios web, porque no abre PDF de la web: solo abre
archivos que ya están en tu disco.

Si quieres anotar un PDF de internet, descárgalo y arrástralo a una pestaña
de totoPDF. Un archivo arrastrado no necesita ningún permiso.

Además, para poder leer archivos de tu disco, tienes que activar "Permitir
acceso a URL de archivo" en la tarjeta de totoPDF en `chrome://extensions`.
Ese permiso es de Chrome, viene desactivado, una extensión no puede activarlo
por su cuenta, y puedes desactivarlo cuando quieras. totoPDF lo usa solamente
para leer un PDF que abriste.

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

The file never leaves your computer. totoPDF makes no network requests at
all: it uploads nothing, downloads nothing, and has no server to do either
with. It only opens files already on your disk. It contains no analytics, no
telemetry, no crash reporting, no advertising, and no tracking of any kind.

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

## What permissions totoPDF asks for, and why

totoPDF asks for access to files on your computer (`file:///*`) and nothing
else. It does not ask for access to websites, because it does not open PDFs
from the web: it opens files already on your disk.

To annotate a PDF from the internet, download it and drag it onto a totoPDF
tab. A dragged file needs no permission at all.

Separately, reading files from your disk requires you to turn on "Allow access
to file URLs" on totoPDF's `chrome://extensions` card. That switch is Chrome's,
it is off by default, an extension cannot turn it on for itself, and you can
turn it off at any time. totoPDF uses it only to read a PDF you open.

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
