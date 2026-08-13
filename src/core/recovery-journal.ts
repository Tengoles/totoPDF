const STORE_NAME = 'journal';

export interface JournalEntry {
  identity: string;
  savedAt: number;
  payload: string;
}

export interface Journal {
  record(identity: string, payload: string, now: number): Promise<void>;
  read(identity: string): Promise<JournalEntry | undefined>;
  clear(identity: string): Promise<void>;
}

function openDatabase(dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'identity' });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      // Release this connection if another tab needs to upgrade, so its open()
      // is never left blocked indefinitely.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error(`Database ${dbName} is blocked by another open connection.`));
  });
}

/**
 * Resolves on transaction COMMIT, not on request success. A request can fire
 * onsuccess and the transaction still abort afterwards (quota exhaustion, for
 * one), which would otherwise report a write as journaled when it never
 * landed -- for a crash-recovery buffer that is the one failure mode that
 * defeats the entire point.
 *
 * Creating the transaction inside the executor also means a synchronous throw
 * (a closed connection, say) surfaces as a rejection rather than escaping
 * synchronously from one method but not the others.
 */
function runTransaction<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const request = run(transaction.objectStore(STORE_NAME));
    let value: T | undefined;

    request.onsuccess = () => {
      value = request.result;
    };
    request.onerror = () => reject(request.error);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    transaction.oncomplete = () => resolve(value);
  });
}

/**
 * The journal is a crash buffer, not a second source of truth: the PDF file
 * on disk is always authoritative. This store holds only serialized
 * annotation state as JSON -- never PDF bytes -- and every entry is cleared
 * the moment its document saves successfully.
 */
export async function openJournal(dbName = 'totopdf-journal'): Promise<Journal> {
  const db = await openDatabase(dbName);

  return {
    async record(identity, payload, now) {
      await runTransaction(db, 'readwrite', (store) =>
        store.put({ identity, payload, savedAt: now }),
      );
    },
    read: (identity) =>
      runTransaction<JournalEntry>(db, 'readonly', (store) => store.get(identity)),
    async clear(identity) {
      await runTransaction(db, 'readwrite', (store) => store.delete(identity));
    },
  };
}

/**
 * Debounces journal writes so every keystroke of annotation editing doesn't
 * hit IndexedDB: only the last payload in a quiet period of `delayMs` is
 * recorded.
 */
export function createDebouncedRecorder(
  journal: Journal,
  identity: string,
  delayMs: number,
): (payload: string, now: number) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: { payload: string; now: number } | null = null;

  return (payload, now) => {
    pending = { payload, now };
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (pending) {
        void journal.record(identity, pending.payload, pending.now);
        pending = null;
      }
    }, delayMs);
  };
}
