/**
 * Acquiring readwrite permission is deliberately a separate call from writing.
 * requestPermission() -- like showSaveFilePicker() -- only works while the
 * browser still considers a user gesture "transient", which Chrome ends about
 * five seconds after the keypress. Building the saved bytes of a large book
 * takes longer than that, so permission has to be settled before the build
 * starts, not after it. See save() in src/viewer/document-controller.ts.
 */
export async function ensureWritePermission(handle: FileSystemFileHandle): Promise<boolean> {
  if (await hasWritePermission(handle)) {
    return true;
  }
  return (await handle.requestPermission(WRITE_OPTIONS)) === 'granted';
}

const WRITE_OPTIONS = { mode: 'readwrite' } as const;

/**
 * Reports whether readwrite is ALREADY granted, and never asks for it.
 * queryPermission is a plain read of existing state; requestPermission is the
 * one that opens a prompt, and it needs transient user activation to work at
 * all. An autosave running two seconds after the last keystroke has none, so
 * it uses this and declines when the answer is no. See createAutosave in
 * src/viewer/autosave.ts.
 */
export async function hasWritePermission(handle: FileSystemFileHandle): Promise<boolean> {
  return (await handle.queryPermission(WRITE_OPTIONS)) === 'granted';
}

/**
 * Writes bytes through a handle whose readwrite permission the caller has
 * already obtained with ensureWritePermission. This function never prompts,
 * because by the time it runs the user gesture that could have carried a
 * prompt is long gone.
 *
 * createWritable stages to a temporary file and swaps it in on close, so a
 * crash mid-write cannot truncate the user's document.
 */
export async function writeGrantedBytes(
  handle: FileSystemFileHandle,
  bytes: Uint8Array<ArrayBuffer>,
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(bytes);
  await writable.close();
}
