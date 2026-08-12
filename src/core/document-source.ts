import { computeIdentity } from './identity';

export type DocumentOrigin =
  | { kind: 'local'; url: string }
  | { kind: 'remote'; url: string }
  | { kind: 'dropped'; fileName: string };

export interface LoadedDocument {
  bytes: Uint8Array<ArrayBuffer>;
  identity: string;
  origin: DocumentOrigin;
  fileName: string;
}

export function parseViewerQuery(search: string): DocumentOrigin | null {
  const raw = new URLSearchParams(search).get('src');
  if (!raw) {
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

function fileNameFromUrl(url: string): string {
  const path = url.split(/[?#]/, 1)[0] ?? url;
  const last = path.slice(path.lastIndexOf('/') + 1);
  return decodeURIComponent(last) || 'document.pdf';
}

export async function loadFromOrigin(
  origin: DocumentOrigin,
  fetchImpl: typeof fetch = fetch,
): Promise<LoadedDocument> {
  if (origin.kind === 'dropped') {
    throw new Error('Dropped files must be loaded with loadFromFile');
  }
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
