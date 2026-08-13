export interface SaveSource {
  saveDocument(): Promise<Uint8Array<ArrayBuffer>>;
  getData(): Promise<Uint8Array>;
}

export interface SaveResult {
  bytes: Uint8Array<ArrayBuffer>;
  originalLength: number;
}

/**
 * A PDF incremental update appends new objects and a new cross-reference
 * table; it never rewrites what came before. If this invariant fails, the
 * document was rewritten wholesale and content we do not model may have been
 * dropped, so refuse to write the file.
 */
export function assertIncrementalPrefix(original: Uint8Array, saved: Uint8Array): void {
  if (saved.length < original.length) {
    throw new Error(
      `Save produced ${saved.length} bytes, shorter than the original ${original.length}.`,
    );
  }
  for (let index = 0; index < original.length; index += 1) {
    if (saved[index] !== original[index]) {
      throw new Error(`Save rewrote byte ${index}; the original bytes must be preserved.`);
    }
  }
}

export async function buildSavedBytes(source: SaveSource): Promise<SaveResult> {
  const original = await source.getData();
  const bytes = await source.saveDocument();
  assertIncrementalPrefix(original, bytes);
  return { bytes, originalLength: original.length };
}
