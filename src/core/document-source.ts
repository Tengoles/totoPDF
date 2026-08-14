import { t } from './i18n';
import { computeIdentity } from './identity';

/** An origin whose bytes can be fetched by URL. Always local: see parseViewerQuery. */
export type FetchableOrigin = { kind: 'local'; url: string };

export type DocumentOrigin = FetchableOrigin | { kind: 'dropped'; fileName: string };

export interface LoadedDocument {
  bytes: Uint8Array<ArrayBuffer>;
  identity: string;
  origin: DocumentOrigin;
  fileName: string;
}

/**
 * Reads the `src` parameter by hand. URLSearchParams is unusable here because
 * it applies form-urlencoded rules and turns a literal '+' in a file path into
 * a space. Splitting only on '&' and matching the key exactly also avoids
 * picking up a '?src=' sequence nested inside another parameter's value.
 */
function readSrcParam(search: string): string | null {
  const query = search.startsWith('?') ? search.slice(1) : search;
  for (const pair of query.split('&')) {
    const separator = pair.indexOf('=');
    if (separator === -1 || pair.slice(0, separator) !== 'src') {
      continue;
    }
    try {
      return decodeURIComponent(pair.slice(separator + 1));
    } catch {
      return null;
    }
  }
  return null;
}

export function parseViewerQuery(search: string): FetchableOrigin | null {
  const raw = readSrcParam(search);
  if (!raw) {
    return null;
  }
  if (raw.startsWith('file://')) {
    return { kind: 'local', url: raw };
  }
  // Remote URLs are rejected on purpose, not unhandled: the product writes
  // annotations back into the file it opened, which a remote fetch could
  // never do more than once removed. host_permissions no longer grants
  // fetch() anywhere but file://, so an http(s) URL here would fail anyway --
  // this makes that a clean "no source" instead of a network error.
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
    throw new Error(t('loadFailed', origin.url));
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
