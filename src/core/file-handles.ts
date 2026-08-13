const STORE_NAME = 'handles';

export interface HandleStore {
  get(identity: string): Promise<FileSystemFileHandle | undefined>;
  put(identity: string, handle: FileSystemFileHandle): Promise<void>;
  remove(identity: string): Promise<void>;
}

function openDatabase(dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
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
 * one), which would otherwise report a write as saved when it never landed —
 * the worst possible failure for a store whose whole job is silent saving.
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

export async function openHandleStore(dbName = 'totopdf'): Promise<HandleStore> {
  const db = await openDatabase(dbName);

  return {
    get: (identity) =>
      runTransaction<FileSystemFileHandle>(db, 'readonly', (store) => store.get(identity)),
    put: async (identity, handle) => {
      await runTransaction(db, 'readwrite', (store) => store.put(handle, identity));
    },
    remove: async (identity) => {
      await runTransaction(db, 'readwrite', (store) => store.delete(identity));
    },
  };
}
