import { defineConfig, type Plugin } from 'vite';
import { cp } from 'node:fs/promises';
import { resolve } from 'node:path';

const PDFJS_ROOT = resolve(import.meta.dirname, 'node_modules/pdfjs-dist');
const OUT = resolve(import.meta.dirname, 'dist');

function copyPdfjsAssets(): Plugin {
  return {
    name: 'copy-pdfjs-assets',
    apply: 'build',
    async closeBundle() {
      await cp(resolve(PDFJS_ROOT, 'build/pdf.worker.mjs'), resolve(OUT, 'pdf.worker.mjs'));
      for (const dir of ['cmaps', 'standard_fonts', 'wasm']) {
        await cp(resolve(PDFJS_ROOT, dir), resolve(OUT, dir), { recursive: true });
      }
    },
  };
}

export default defineConfig({
  plugins: [copyPdfjsAssets()],
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
