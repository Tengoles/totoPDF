/**
 * Documents are keyed by content hash, not path, so moving or renaming a file
 * keeps its stored write handle and preferences.
 * The <ArrayBuffer> type parameter is required: a bare Uint8Array is not assignable to BufferSource under TypeScript 5.9.
 */
export async function computeIdentity(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
