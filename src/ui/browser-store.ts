// The storage backend for this browser: IndexedDB when it opens, memory otherwise. Either way nothing
// leaves the device. A browser without IndexedDB uses memory silently; one whose IndexedDB fails to open
// (a damaged profile, blocked storage) says so, since nothing will be remembered.
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
  // Saved once the transaction commits: a request can succeed and the transaction still abort.
  set: async (key, value) =>
    new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      const fail = () => {
        reject(transaction.error ?? new DOMException("The save was aborted", "AbortError"));
      };
      transaction.addEventListener("complete", () => {
        resolve();
      });
      transaction.addEventListener("abort", fail);
      transaction.addEventListener("error", fail);
      transaction.objectStore(STORE).put(value, key);
    }),
});

export const detectBackend = async (onOpenFailed: () => void): Promise<StorageBackend> => {
  if (typeof indexedDB === "undefined") return memoryBackend();
  try {
    return indexedDbBackend(await openDatabase());
  } catch {
    onOpenFailed();
    return memoryBackend();
  }
};
