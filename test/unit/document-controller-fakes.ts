import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { AnnotationBridge } from '../../src/core/annotation-bridge';
import type { LoadedDocument } from '../../src/core/document-source';
import type { HandleStore } from '../../src/core/file-handles';
import type { Journal } from '../../src/core/recovery-journal';
import type { ViewerHost } from '../../src/viewer/viewer-host';

/**
 * Test doubles for document-controller.test.ts. The `as unknown as` casts are
 * the same idiom file-writer.test.ts and file-handles.test.ts already use:
 * PDFDocumentProxy, FileSystemFileHandle and ViewerHost are browser/pdf.js
 * types with dozens of members the controller never touches, and there is no
 * way to construct a real one under vitest's node environment.
 */

export interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

export function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export interface FakeDoc {
  proxy: PDFDocumentProxy;
  /**
   * Moves the annotation-storage hash the way a real edit does. Selection
   * changes deliberately do not call this: pdf.js fires the same
   * 'editingstateschanged' event for both, and the hash is the only thing
   * that tells them apart.
   */
  edit(): void;
}

let hashCounter = 0;

/**
 * `marker` is written into both the original and the saved bytes, so a test
 * can tell which document's content reached a file. buildSavedBytes enforces
 * the incremental-update prefix, so saved must extend original.
 */
export function fakeDoc(marker: number, options: { encrypted?: boolean } = {}): FakeDoc {
  // pdf.js reports '' for an untouched document and a digest once anything
  // the user made is in the storage.
  let hash = '';
  const proxy = {
    getData: () => Promise.resolve(new Uint8Array([marker, marker])),
    saveDocument: () => Promise.resolve(new Uint8Array([marker, marker, 0xff])),
    getMetadata: () =>
      Promise.resolve({
        info: { EncryptFilterName: options.encrypted === true ? 'Standard' : null },
      }),
    getPage: () =>
      Promise.resolve({ getTextContent: () => Promise.resolve({ items: [{ str: 'a' }] }) }),
    annotationStorage: {
      get serializable() {
        return { map: null, hash };
      },
    },
  } as unknown as PDFDocumentProxy;

  return {
    proxy,
    edit: () => {
      hashCounter += 1;
      hash = `h${hashCounter}`;
    },
  };
}

export function fakePdf(marker: number, options: { encrypted?: boolean } = {}): PDFDocumentProxy {
  return fakeDoc(marker, options).proxy;
}

export function savedBytesFor(marker: number): Uint8Array {
  return new Uint8Array([marker, marker, 0xff]);
}

export interface FakeHandle {
  handle: FileSystemFileHandle;
  written: Uint8Array[];
  /**
   * How many times readwrite was actually asked for. An autosave has no user
   * activation, so this must stay at zero on every automatic path.
   */
  requests(): number;
}

export function fakeHandle(log: string[] = [], permission: PermissionState = 'granted'): FakeHandle {
  const written: Uint8Array[] = [];
  let requested = 0;
  const handle = {
    queryPermission: () => {
      log.push('permission');
      return Promise.resolve(permission);
    },
    requestPermission: () => {
      requested += 1;
      log.push('request');
      return Promise.resolve(permission);
    },
    createWritable: () => {
      log.push('write');
      return Promise.resolve({
        write: (data: Uint8Array) => {
          written.push(data);
          return Promise.resolve();
        },
        close: () => Promise.resolve(),
      });
    },
  } as unknown as FileSystemFileHandle;
  return { handle, written, requests: () => requested };
}

export interface FakeStore extends HandleStore {
  rows: Map<string, FileSystemFileHandle>;
}

export function fakeStore(log: string[] = []): FakeStore {
  const rows = new Map<string, FileSystemFileHandle>();
  return {
    rows,
    get: (identity) => {
      log.push('handle');
      return Promise.resolve(rows.get(identity));
    },
    put: (identity, handle) => {
      rows.set(identity, handle);
      return Promise.resolve();
    },
    remove: (identity) => {
      rows.delete(identity);
      return Promise.resolve();
    },
  };
}

export interface FakeJournal extends Journal {
  cleared: string[];
}

export function fakeJournal(): FakeJournal {
  const cleared: string[] = [];
  return {
    cleared,
    record: () => Promise.resolve(),
    read: () => Promise.resolve(undefined),
    clear: (identity) => {
      cleared.push(identity);
      return Promise.resolve();
    },
  };
}

export const fakeBridge: AnnotationBridge = {
  setMode: () => undefined,
  getMode: () => 'none',
  reapply: () => undefined,
  setHighlightColorIndex: () => undefined,
  getColorIndex: () => 0,
  setFreeTextColor: () => undefined,
  setFreeTextSize: () => undefined,
  handleKey: () => false,
};

export interface FakeHost {
  host: ViewerHost;
  emitEditingChange(): void;
  releaseCount(): number;
}

export function fakeHost(open: (bytes: Uint8Array) => Promise<PDFDocumentProxy>): FakeHost {
  const listeners: (() => void)[] = [];
  let releases = 0;
  const host = {
    eventBus: {
      on: (_name: string, listener: () => void) => {
        listeners.push(listener);
      },
    },
    open,
    releasePreviousDocument: () => {
      releases += 1;
      return Promise.resolve();
    },
  } as unknown as ViewerHost;

  return {
    host,
    emitEditingChange: () => {
      for (const listener of listeners) {
        listener();
      }
    },
    releaseCount: () => releases,
  };
}

/** Hands out queued results in order, so an open can be made to fail on cue. */
export function sequencedOpen(
  ...results: (PDFDocumentProxy | Error)[]
): (bytes: Uint8Array) => Promise<PDFDocumentProxy> {
  let index = 0;
  return () => {
    const result = results[index];
    index += 1;
    if (result === undefined) {
      return Promise.reject(new Error(`No open result queued for call ${index}`));
    }
    return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
  };
}

export function loadedDoc(identity: string): LoadedDocument {
  return {
    bytes: new Uint8Array([0]),
    identity,
    origin: { kind: 'dropped', fileName: `${identity}.pdf` },
    fileName: `${identity}.pdf`,
  };
}
