# Chrome Web Store Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the repository to the point where submitting to the Chrome Web Store is a login and an upload.

**Architecture:** Mostly manifest, assets and documentation. One feature is added — a first-run welcome page — because the extension's primary use (local PDFs) silently does nothing until a person flips a switch Chrome will not let the extension prompt for. Icons and screenshots are generated from the real built extension by the Playwright Chromium already installed, so no rasterizer dependency is added and nothing depicts behaviour that does not exist.

**Tech Stack:** TypeScript 5.9, Vite 7, vitest 3, Playwright 1.62, Node `zlib` (packaging), MV3.

**Spec:** `docs/superpowers/specs/2026-08-13-store-readiness-design.md`

## Global Constraints

- **Final permission set is exactly `declarativeNetRequest`, `contextMenus`, `storage`**, plus `<all_urls>` host permission. `tabs` and `webNavigation` are removed.
- **Version is `1.0.0` in BOTH `public/manifest.json` and `package.json`** and must never drift again — a test enforces it.
- Icon palette is the product's own: tile `#1e2024`, page `#e6e8ea`, highlight `#FFF176`, faint text lines `#9aa0a8`. No gradients, no glassmorphism, no purple.
- No emoji anywhere in UI, copy, or committed documents.
- No AI-marketing register in any user-facing copy: no "seamless", "leverage", "powerful", "revolutionary", "take it to the next level". State what it does.
- All new user-facing strings go through `t()` and exist in BOTH `src/i18n/en.json` and `src/i18n/es.json`. The conformance tests enforce key-set and placeholder parity; both catalogues currently hold 61 keys.
- No `any`. `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`. Files under 300 lines, functions under 50 lines.
- No new runtime dependencies. Dev-only tooling must already be installed.
- `npm test` and `npm run typecheck` green at the end of every task.

---

### Task 1: Icons

**Files:**
- Create: `public/icons/icon.svg`, `tools/generate-icons.mjs`
- Create (generated, committed): `public/icons/icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`

**Interfaces:**
- Consumes: nothing.
- Produces: four PNGs at `public/icons/icon<N>.png`. Task 2 references these exact paths from the manifest. Vite's `publicDir` copies `public/` verbatim into `dist/`, so they land at `dist/icons/icon<N>.png` with no build change.

- [ ] **Step 1: Write the SVG source**

Create `public/icons/icon.svg`. One source, four sizes, so they cannot drift.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <rect width="128" height="128" rx="26" fill="#1e2024"/>
  <rect x="36" y="22" width="56" height="84" rx="5" fill="#e6e8ea"/>
  <rect x="46" y="34" width="36" height="6" rx="3" fill="#9aa0a8"/>
  <rect x="46" y="88" width="26" height="6" rx="3" fill="#9aa0a8"/>
  <rect x="26" y="54" width="76" height="22" rx="3" fill="#FFF176"/>
</svg>
```

The yellow stripe deliberately overhangs the page on both sides — that is what makes it read as a highlighter stroke rather than a block of colour. It is 22 units tall so that at 16px it is still about 2.75px and survives.

- [ ] **Step 2: Write the generator**

Create `tools/generate-icons.mjs`. Rasterizes with the Chromium Playwright already installs — the same engine that will render the icon in the browser — so no image dependency is added.

```js
import { chromium } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SIZES = [16, 32, 48, 128];

const svg = await readFile(resolve(ROOT, 'public/icons/icon.svg'), 'utf8');
const browser = await chromium.launch({ channel: 'chromium' });
const page = await browser.newPage();

await mkdir(resolve(ROOT, 'public/icons'), { recursive: true });
for (const size of SIZES) {
  await page.setViewportSize({ width: size, height: size });
  // margin:0 and a transparent body, so omitBackground leaves the tile's
  // rounded corners actually transparent rather than white.
  await page.setContent(
    `<style>html,body{margin:0;padding:0;background:transparent}
     svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  await page.locator('svg').screenshot({
    path: resolve(ROOT, `public/icons/icon${size}.png`),
    omitBackground: true,
  });
  console.log(`wrote public/icons/icon${size}.png`);
}
await browser.close();
```

- [ ] **Step 3: Generate the icons**

Run: `node tools/generate-icons.mjs`
Expected: four lines of output, four PNGs on disk.

- [ ] **Step 4: Verify each PNG is the size it claims**

PNG stores width and height as big-endian 32-bit integers at byte offsets 16 and 20. Read them directly rather than trusting the filename.

```bash
node -e "
const fs=require('fs');
for (const n of [16,32,48,128]) {
  const b=fs.readFileSync('public/icons/icon'+n+'.png');
  const sig=b.subarray(0,8).toString('hex');
  console.log(n, 'sig ok:', sig==='89504e470d0a1a0a', 'w:', b.readUInt32BE(16), 'h:', b.readUInt32BE(20));
}
"
```

Expected: every line reports `sig ok: true` and width and height both equal to the size. If any differ, the generator is wrong — fix it, do not hand-edit a PNG.

- [ ] **Step 5: Look at the 128 and confirm it reads**

Open `public/icons/icon128.png` and confirm it is a dark rounded tile with a light page and a yellow stripe across it, not a blank or clipped image. Then open `icon16.png` and confirm the yellow stripe is still visible at that size. If the stripe has vanished at 16px, thicken it in the SVG and regenerate — legibility at 16px is the constraint that matters most, since that is the toolbar size.

- [ ] **Step 6: Commit**

```bash
git add public/icons tools/generate-icons.mjs
git commit -m "feat: add extension icons generated from one SVG source"
```

---

### Task 2: Manifest — permissions, version, icons

The riskiest task in this plan. Dropping `tabs` touches a code path no automated test covers, so it ends with a browser check, not with reasoning.

**Files:**
- Modify: `public/manifest.json`, `package.json`, `src/background/interception.ts`, `test/unit/manifest.test.ts`, `test/unit/interception.test.ts`, `README.md`

**Interfaces:**
- Consumes: `public/icons/icon<N>.png` from Task 1.
- Produces: a manifest with the final permission set. Task 6 packages what this produces.

- [ ] **Step 1: Write the failing tests**

Add to `test/unit/manifest.test.ts`, with `import { readFileSync } from 'node:fs';` and `import pkg from '../../package.json';` at the top.

```ts
  it('requests only the permissions the code exercises', () => {
    // tabs was dropped: chrome.tabs.create/update need no permission, and the
    // one place a tab's URL is read gets it from the <all_urls> host
    // permission. webNavigation went with installNavigationFallback.
    expect(new Set(manifest.permissions)).toEqual(
      new Set(['declarativeNetRequest', 'contextMenus', 'storage']),
    );
  });

  it('keeps the manifest and package versions in step', () => {
    // The store refuses a re-upload whose version did not increase, so a
    // drift between these two is a failed submission.
    expect(manifest.version).toBe(pkg.version);
  });

  it('declares an icon at every size the store and the toolbar need', () => {
    for (const size of ['16', '32', '48', '128'] as const) {
      expect(manifest.icons).toHaveProperty(size);
      expect(manifest.action.default_icon).toHaveProperty(size);
    }
  });

  it('ships every icon file the manifest names, at the size it claims', () => {
    // PNG holds width and height as big-endian uint32 at offsets 16 and 20.
    for (const [size, path] of Object.entries(manifest.icons)) {
      const bytes = readFileSync(`public/${path}`);
      expect(bytes.subarray(0, 8).toString('hex'), path).toBe('89504e470d0a1a0a');
      expect(bytes.readUInt32BE(16), `${path} width`).toBe(Number(size));
      expect(bytes.readUInt32BE(20), `${path} height`).toBe(Number(size));
    }
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -- manifest`
Expected: FAIL — permissions still contain `tabs`/`webNavigation`, no `icons` key, versions differ.

- [ ] **Step 3: Update the manifest**

`public/manifest.json`, replacing the permission list and adding the two icon blocks. Everything else is unchanged.

```json
  "version": "1.0.0",
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "action": {
    "default_title": "__MSG_actionTitle__",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "permissions": ["declarativeNetRequest", "contextMenus", "storage"],
```

- [ ] **Step 4: Delete the dead fallback**

Remove `installNavigationFallback` entirely from `src/background/interception.ts` — the export, its body, and its doc comment. It is the only `chrome.webNavigation` user, and keeping code that needs a permission the manifest no longer requests is worse than not keeping it.

Then remove whatever in `test/unit/interception.test.ts` covers it. Read that file first; if it has no such test, change nothing there.

- [ ] **Step 5: Align package.json**

`package.json` already reads `1.0.0`. Confirm it, and change it only if it does not.

- [ ] **Step 6: Run the tests**

Run: `npm test && npm run typecheck`
Expected: all PASS.

- [ ] **Step 7: Rewrite the README bullet about the fallback**

The Limitations section has a bullet stating that `src/background/interception.ts` "also exports `installNavigationFallback`, an alternative `webNavigation` implementation kept unused". That is no longer true. Rewrite it to say the fallback was removed when the unused `webNavigation` permission was dropped for store submission, and that it remains in git history if the redirect rule ever stops applying to `file://`. Keep the surrounding voice.

- [ ] **Step 8: Verify the permission reduction in a browser**

This is the step that matters. Build, then drive the real extension with Playwright and confirm both entry points that depend on tab URLs still work without the `tabs` permission.

```bash
npm run build
npx vite-node test/fixtures/generate.ts
```

Write a throwaway script in the scratchpad (NOT the repo) that launches the built extension the way `test/e2e/extension-context.ts` does, then:
1. Opens a tab on a PDF URL served over `file://` or `http://`.
2. From the service worker, evaluates `chrome.tabs.query({active:true,currentWindow:true})` and confirms the returned tab's `url` is populated and not `undefined`. This is the exact property `chrome.action.onClicked` depends on, and it is what the `tabs` permission would have granted.
3. Confirms `chrome.runtime.getManifest().permissions` does not contain `tabs` or `webNavigation`, so the check is running against the reduced set.

Report the actual values. If `url` comes back `undefined`, the `tabs` removal is wrong — restore the permission, say so, and stop.

- [ ] **Step 9: Run the e2e suite**

Run: `npm run test:e2e`
Expected: 5/5 PASS. The extension still loads and the viewer still works under the reduced permission set.

- [ ] **Step 10: Commit**

```bash
git add public/manifest.json package.json src/background/interception.ts test/unit README.md
git commit -m "feat: drop unused permissions, add icons, align the version"
```

---

### Task 3: First-run welcome page

**Files:**
- Create: `welcome.html`, `src/welcome/main.ts`
- Modify: `vite.config.ts` (rollup input), `src/background/index.ts`, `src/i18n/en.json`, `src/i18n/es.json`

**Interfaces:**
- Consumes: `t` and `MessageKey` from `src/core/i18n.ts`.
- Produces: `dist/welcome.html`, opened once on install.

- [ ] **Step 1: Add the catalogue keys**

Seven keys, appended in the SAME relative position in both files (the conformance test requires identical key sets; key order is not enforced but keeping them aligned makes review easier).

`src/i18n/en.json`:
```json
  "welcomeTitle": { "message": "totoPDF is installed" },
  "welcomeIntro": { "message": "totoPDF opens PDFs in its own viewer so you can highlight text and add text boxes. What you add is written into the PDF file itself, as standard PDF annotations, so other readers see it too." },
  "welcomeLocalHeading": { "message": "One step is needed for PDFs on your own computer" },
  "welcomeLocalBody": { "message": "Chrome does not let any extension read files from your disk until you allow it, and an extension cannot turn that on for itself. Open totoPDF's extensions page, then turn on \"Allow access to file URLs\"." },
  "welcomeOpenExtensionsPage": { "message": "Open totoPDF's extensions page" },
  "welcomeUsageHeading": { "message": "Opening a PDF" },
  "welcomeUsageBody": { "message": "Once file access is on, local PDFs open in totoPDF automatically. For any other PDF, right-click it and choose \"Open in totoPDF\", or click the totoPDF icon in the toolbar while the PDF is open." }
```

`src/i18n/es.json` — Latin American tuteo, matching the register already established:
```json
  "welcomeTitle": { "message": "totoPDF está instalado" },
  "welcomeIntro": { "message": "totoPDF abre los PDF en su propio visor para que puedas resaltar texto y agregar cuadros de texto. Lo que agregas se escribe dentro del archivo PDF, como anotaciones PDF estándar, así que otros lectores también las ven." },
  "welcomeLocalHeading": { "message": "Falta un paso para los PDF de tu computadora" },
  "welcomeLocalBody": { "message": "Chrome no deja que ninguna extensión lea archivos de tu disco hasta que lo permitas, y una extensión no puede activarlo por su cuenta. Abre la página de extensiones de totoPDF y activa \"Permitir acceso a URL de archivo\"." },
  "welcomeOpenExtensionsPage": { "message": "Abrir la página de extensiones de totoPDF" },
  "welcomeUsageHeading": { "message": "Cómo abrir un PDF" },
  "welcomeUsageBody": { "message": "Con el acceso a archivos activado, los PDF locales se abren en totoPDF automáticamente. Para cualquier otro PDF, haz clic derecho y elige \"Abrir en totoPDF\", o haz clic en el icono de totoPDF en la barra mientras el PDF está abierto." }
```

Note both catalogues go from 61 to 68 keys.

- [ ] **Step 2: Write the page**

Create `welcome.html` at the repository root, beside `viewer.html`. No text content — every string is filled in by the script, so nothing is hardcoded in one language.

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>totoPDF</title>
  </head>
  <body class="welcome">
    <main>
      <h1 id="title"></h1>
      <p id="intro"></p>
      <h2 id="local-heading"></h2>
      <p id="local-body"></p>
      <button type="button" id="open-extensions"></button>
      <h2 id="usage-heading"></h2>
      <p id="usage-body"></p>
    </main>
    <script type="module" src="/src/welcome/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 3: Write the script**

Create `src/welcome/main.ts`.

```ts
import '../ui/styles.css';
import { type MessageKey, t } from '../core/i18n';

/**
 * Every string is filled in here rather than written into welcome.html, so
 * the page has no language of its own and follows the catalogue like the
 * rest of the UI.
 */
const TEXT: ReadonlyArray<readonly [string, MessageKey]> = [
  ['title', 'welcomeTitle'],
  ['intro', 'welcomeIntro'],
  ['local-heading', 'welcomeLocalHeading'],
  ['local-body', 'welcomeLocalBody'],
  ['open-extensions', 'welcomeOpenExtensionsPage'],
  ['usage-heading', 'welcomeUsageHeading'],
  ['usage-body', 'welcomeUsageBody'],
];

function fill(): void {
  document.documentElement.lang = t('uiLanguage');
  document.title = t('welcomeTitle');
  for (const [id, key] of TEXT) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = t(key);
    }
  }
}

/**
 * A page cannot reach a chrome:// URL through a link -- Chrome blocks the
 * navigation -- but chrome.tabs.create from the page's own script may, and
 * needs no permission to do it. Targeting this extension's own card by id
 * puts the switch on screen rather than leaving the reader to find it.
 */
function bindExtensionsButton(): void {
  const button = document.getElementById('open-extensions');
  button?.addEventListener('click', () => {
    void chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
  });
}

fill();
bindExtensionsButton();
```

- [ ] **Step 4: Add the styles**

Append to `src/ui/styles.css` a `.welcome` block reusing the existing custom properties (`--bg`, `--bg-raised`, `--text`, `--text-dim`, `--border`, `--accent`) already defined at the top of that file. Requirements: a readable measure (`max-width` around 40rem), centred with generous padding, spacing drawn from the project's 4/8/12/16/24/32/48px scale, and the button styled like the toolbar's buttons. Do not introduce new colour literals — use the properties.

- [ ] **Step 5: Build the page**

In `vite.config.ts`, add `welcome` to `rollupOptions.input` beside the existing `viewer` and `background` entries:

```ts
        welcome: resolve(import.meta.dirname, 'welcome.html'),
```

- [ ] **Step 6: Open it on install**

In `src/background/index.ts`, extend the existing `chrome.runtime.onInstalled` listener. Only on a genuine install — not on an update or a Chrome upgrade, which would reopen the page at every release.

```ts
chrome.runtime.onInstalled.addListener((details) => {
  void installInterception();
  installContextMenu();
  // Only a first install. 'update' and 'chrome_update' would reopen this on
  // every release, which is the behaviour everyone hates.
  if (details.reason === 'install') {
    void chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  }
});
```

- [ ] **Step 7: Verify**

```bash
npm test && npm run typecheck && npm run build
```
Expected: green, and `dist/welcome.html` exists.

Then drive it: a throwaway scratchpad script that launches the built extension, opens `chrome-extension://<id>/welcome.html`, and confirms the headings are populated (not empty), the button carries a label, and no console errors were logged. Screenshot it to `docs/store/welcome-check.png` for the controller to inspect, then delete that file — it is a check, not a deliverable.

- [ ] **Step 8: Commit**

```bash
git add welcome.html src/welcome src/ui/styles.css src/i18n vite.config.ts src/background/index.ts
git commit -m "feat: show a first-run page explaining the local-file permission"
```

---

### Task 4: Store screenshots

**Files:**
- Create: `docs/store/screenshots/01-viewer.png`, `02-notes-rail.png`, `03-thumbnails.png`, `04-toolbar.png`
- Create: `tools/generate-screenshots.mjs`

**Interfaces:**
- Consumes: the built extension in `dist/`, and `test/fixtures/text.pdf`.
- Produces: four 1280×800 PNGs for the listing.

- [ ] **Step 1: Write the generator**

Create `tools/generate-screenshots.mjs`. Model the launch on `test/e2e/extension-context.ts` — persistent context, `channel: 'chromium'`, `--lang=en-US`, `--disable-extensions-except`, `--load-extension`, resolve the id from the service worker URL. Set the viewport to exactly 1280×800; the store rejects other sizes.

Each shot must show real state, produced by driving the UI, not by mocking:
1. `01-viewer.png` — a PDF open with two or three highlights in different palette colours and one text box with text in it.
2. `02-notes-rail.png` — the same document with the Notes rail open, listing those annotations.
3. `03-thumbnails.png` — the Pages rail open, showing page thumbnails, with the page box visible.
4. `04-toolbar.png` — the document with the toolbar prominent: swatches, text colour and size, zoom controls.

Reuse whatever the existing e2e specs do to make highlights and text boxes — read `test/e2e/round-trip.spec.ts` and `test/e2e/palette.spec.ts` first and follow their approach rather than inventing one. If a shot cannot be produced with real annotations, say so rather than shipping an empty viewer.

- [ ] **Step 2: Generate them**

```bash
npm run build
npx vite-node test/fixtures/generate.ts
node tools/generate-screenshots.mjs
```

- [ ] **Step 3: Verify dimensions**

```bash
node -e "
const fs=require('fs');
for (const f of fs.readdirSync('docs/store/screenshots')) {
  const b=fs.readFileSync('docs/store/screenshots/'+f);
  console.log(f, b.readUInt32BE(16)+'x'+b.readUInt32BE(20));
}
"
```
Expected: every file reports exactly `1280x800`. Anything else is rejected at upload.

- [ ] **Step 4: Look at each one**

Open all four. Each must show the thing it claims, with real content — annotations actually visible, rails actually populated, no error banner, no empty viewer, no placeholder text. A screenshot that shows a blank page is worse than no screenshot. Regenerate any that fail.

- [ ] **Step 5: Commit**

```bash
git add docs/store/screenshots tools/generate-screenshots.mjs
git commit -m "docs: add store listing screenshots generated from the real extension"
```

---

### Task 5: Packaging

**Files:**
- Create: `tools/package.mjs`
- Modify: `package.json` (scripts), `.gitignore`, `README.md`

**Interfaces:**
- Consumes: `dist/`, and the version from `package.json`.
- Produces: `totopdf-<version>.zip` at the repository root, gitignored.

- [ ] **Step 1: Write the packager**

Create `tools/package.mjs`. Node's `zlib` only — no dependency, and no PowerShell, which would lock the command to Windows.

Requirements, because a malformed zip is only discovered at upload:
- Walk `dist/` recursively; store paths relative to `dist/` with forward slashes, since a zip entry name with backslashes will not unpack correctly on the store's side.
- Deflate each file with `zlib.deflateRawSync`; store the CRC-32, the uncompressed size and the compressed size in both the local header and the central directory.
- Write local file headers, then the central directory, then the end-of-central-directory record.
- Set the version-needed field to 20 and use no data descriptors — sizes are known before writing since the whole file is in memory.
- No directory entries; file entries with relative paths are sufficient and are what Chrome expects.
- Fail loudly if `dist/` does not exist, naming `npm run build` as the fix.

Print the output path and the total entry count.

- [ ] **Step 2: Add the script and ignore the output**

In `package.json`:
```json
    "package": "npm run build && node tools/package.mjs",
```
In `.gitignore`, add `totopdf-*.zip`.

- [ ] **Step 3: Verify by round-trip**

A zip that Chrome rejects at upload is the failure mode this guards against, so verify by actually expanding it and comparing against the source.

```bash
npm run package
```

Then expand the archive to a temporary directory and compare the file list and per-file SHA-256 against `dist/`. PowerShell's `Expand-Archive` is available and is a genuinely independent implementation, which is the point — a zip that only this script can read proves nothing:

```bash
powershell -NoProfile -Command "Expand-Archive -Path totopdf-1.0.0.zip -DestinationPath \$env:TEMP/totopdf-zipcheck -Force"
```

Then compare both directory trees: same set of relative paths, and identical SHA-256 for every file. Report the file count and confirm zero differences. Any mismatch means the zip is wrong.

- [ ] **Step 4: Rewrite the README's Deploy section**

It currently reads "Not published. Loaded unpacked from `dist/`." Replace it with what someone actually has to do: bump the version in both `public/manifest.json` and `package.json` (naming the test that enforces they match), run `npm run package`, and upload the resulting zip to the Chrome Web Store developer dashboard. Mention the one-time $5 developer registration fee, since it is a real precondition and a surprise otherwise. Point at `docs/store/listing.md` for the listing fields and `PRIVACY.md` for the privacy policy URL. Keep the section short and in the project's voice.

- [ ] **Step 5: Verify and commit**

```bash
npm test && npm run typecheck
```

```bash
git add tools/package.mjs package.json .gitignore README.md
git commit -m "feat: add a dependency-free store packaging script"
```

---

## Out of scope, deliberately

- Registering the developer account or paying the $5 fee — needs the owner's identity and payment details.
- Uploading or publishing.
- Hosting the privacy policy. `PRIVACY.md` is written; the dashboard wants a URL, and the repository's GitHub page is the cheapest host.
- Narrowing `<all_urls>`. It is needed by both the redirect rule and the viewer's fetch of arbitrary PDF URLs; narrowing to `*.pdf` patterns would break PDFs served from extensionless URLs.
- `PRIVACY.md` and `docs/store/listing.md` are written by the controller directly, not by a task in this plan — they are public-facing prose representing the project and its data handling.
