import { defineConfig, type Plugin } from 'vite';
import { cp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const PDFJS_ROOT = resolve(import.meta.dirname, 'node_modules/pdfjs-dist');
const OUT = resolve(import.meta.dirname, 'dist');

/** Extend when a catalogue is added under src/i18n. */
const LOCALES = ['en', 'es'];

function copyStaticAssets(): Plugin {
  return {
    name: 'copy-static-assets',
    apply: 'build',
    async closeBundle() {
      await cp(resolve(PDFJS_ROOT, 'build/pdf.worker.mjs'), resolve(OUT, 'pdf.worker.mjs'));
      for (const dir of ['cmaps', 'standard_fonts', 'wasm']) {
        await cp(resolve(PDFJS_ROOT, dir), resolve(OUT, dir), { recursive: true });
      }
      // Chrome refuses to load an extension whose manifest names a
      // default_locale with no _locales directory beside it, so this is not
      // optional once the manifest change above has landed.
      for (const locale of LOCALES) {
        const target = resolve(OUT, `_locales/${locale}`);
        await mkdir(target, { recursive: true });
        await cp(
          resolve(import.meta.dirname, `src/i18n/${locale}.json`),
          resolve(target, 'messages.json'),
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [copyStaticAssets()],
  build: {
    target: 'chrome120',
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        viewer: resolve(import.meta.dirname, 'viewer.html'),
        background: resolve(import.meta.dirname, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
