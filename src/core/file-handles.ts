const STORE_NAME = 'handles';

export interface HandleStore {
  get(identity: string): Promise<FileSystemFileHandle | undefined>;
  put(identity: string, handle: FileSystemFileHandle): Promise<void>;
  remove(identity: string): Promise<void>;
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openDatabase(dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function openHandleStore(dbName = 'totopdf'): Promise<HandleStore> {
  const db = await openDatabase(dbName);

  const transact = <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) =>
    promisify(run(db.transaction(STORE_NAME, mode).objectStore(STORE_NAME)));

  return {
    get: (identity) =>
      transact<FileSystemFileHandle | undefined>('readonly', (store) => store.get(identity)),
    put: async (identity, handle) => {
      await transact('readwrite', (store) => store.put(handle, identity));
    },
    remove: async (identity) => {
      await transact('readwrite', (store) => store.delete(identity));
    },
  };
}
