// The storage backend for this browser: IndexedDB when it opens, memory otherwise (private modes,
// blocked storage). Either way nothing leaves the device.
import { memoryBackend } from "../logic/scout-store.ts";
import type { StorageBackend } from "../logic/scout-store.ts";

const DB_NAME = "psp-fifa10-scout";
const STORE = "kv";

const settle = async <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.addEventListener("success", () => {
      resolve(request.result);
    });
    request.addEventListener("error", () => {
      reject(request.error ?? new Error("IndexedDB request failed"));
    });
  });

const openDatabase = async (): Promise<IDBDatabase> => {
  const request = indexedDB.open(DB_NAME, 1);
  request.addEventListener("upgradeneeded", () => {
    request.result.createObjectStore(STORE);
  });
  return settle(request);
};

const indexedDbBackend = (db: IDBDatabase): StorageBackend => ({
  get: async (key) => {
    const value: unknown = await settle(db.transaction(STORE).objectStore(STORE).get(key));
    return value;
  },
  set: async (key, value) => {
    await settle(db.transaction(STORE, "readwrite").objectStore(STORE).put(value, key));
  },
});

export const detectBackend = async (): Promise<StorageBackend> => {
  try {
    return indexedDbBackend(await openDatabase());
  } catch {
    return memoryBackend();
  }
};
