export type WriteOutcome = { kind: 'written' } | { kind: 'permission-denied' };

export async function ensureWritePermission(handle: FileSystemFileHandle): Promise<boolean> {
  const options = { mode: 'readwrite' } as const;
  if ((await handle.queryPermission(options)) === 'granted') {
    return true;
  }
  return (await handle.requestPermission(options)) === 'granted';
}

/**
 * createWritable stages to a temporary file and swaps it in on close, so a
 * crash mid-write cannot truncate the user's document.
 */
export async function writeBytes(
  handle: FileSystemFileHandle,
  bytes: Uint8Array<ArrayBuffer>,
): Promise<WriteOutcome> {
  if (!(await ensureWritePermission(handle))) {
    return { kind: 'permission-denied' };
  }
  const writable = await handle.createWritable();
  await writable.write(bytes);
  await writable.close();
  return { kind: 'written' };
}
