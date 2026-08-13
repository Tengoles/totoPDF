import { computeIdentity } from './identity';

/** An origin whose bytes can be fetched by URL. */
export type FetchableOrigin = { kind: 'local'; url: string } | { kind: 'remote'; url: string };

export type DocumentOrigin = FetchableOrigin | { kind: 'dropped'; fileName: string };

export interface LoadedDocument {
  bytes: Uint8Array<ArrayBuffer>;
  identity: string;
  origin: DocumentOrigin;
  fileName: string;
}

export function parseViewerQuery(search: string): FetchableOrigin | null {
  // Deliberately not URLSearchParams: it applies form-urlencoded rules and
  // would turn a literal '+' in a file path into a space.
  const match = /[?&]src=([^&]*)/.exec(search);
  if (!match?.[1]) {
    return null;
  }
  let raw: string;
  try {
    raw = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  if (raw.startsWith('file://')) {
    return { kind: 'local', url: raw };
  }
  if (raw.startsWith('https://') || raw.startsWith('http://')) {
    return { kind: 'remote', url: raw };
  }
  return null;
}

const FALLBACK_FILE_NAME = 'document.pdf';

function fileNameFromUrl(url: string): string {
  let pathname: string;
  try {
    // Parsing as a URL strips query and fragment, and prevents the scheme's
    // '//' from being mistaken for a path separator on a bare origin.
    pathname = new URL(url).pathname;
  } catch {
    return FALLBACK_FILE_NAME;
  }
  const last = pathname.slice(pathname.lastIndexOf('/') + 1);
  if (!last) {
    return FALLBACK_FILE_NAME;
  }
  try {
    return decodeURIComponent(last);
  } catch {
    // A bare '%' is legal in a file name but not valid percent-encoding.
    return last;
  }
}

export async function loadFromOrigin(
  origin: FetchableOrigin,
  fetchImpl: typeof fetch = fetch,
): Promise<LoadedDocument> {
  const response = await fetchImpl(origin.url);
  if (!response.ok) {
    throw new Error(`Could not load ${origin.url} (HTTP ${response.status})`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  return {
    bytes,
    identity: await computeIdentity(bytes),
    origin,
    fileName: fileNameFromUrl(origin.url),
  };
}

export async function loadFromFile(file: File): Promise<LoadedDocument> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return {
    bytes,
    identity: await computeIdentity(bytes),
    origin: { kind: 'dropped', fileName: file.name },
    fileName: file.name,
  };
}
