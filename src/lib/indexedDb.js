// Minimal promise-wrapped IndexedDB helpers. IndexedDB's native API
// predates Promises and is entirely event/callback-based - libraries
// like `idb` exist just to wrap that, but the wrapping itself is small
// enough to write directly here rather than adding a dependency for it.

const DB_NAME = 'video-editor-js';
const DB_VERSION = 1;

let dbPromise = null;

// Opens the database once and reuses the same connection for the life
// of the app - reopening per call would work too, but wastes a round
// trip and risks racing with itself on an upgrade.
export function openDatabase() {
  if (dbPromise) return dbPromise;

  if (!window.indexedDB) {
    return Promise.reject(new Error('IndexedDB is not available in this browser.'));
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // Runs once, only when DB_VERSION increases - including the very
    // first time this database is ever created (from version 0).
    // Future schema changes (new stores, new indexes) get added here,
    // gated on `event.oldVersion` so existing data survives an upgrade
    // instead of being wiped.
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (event.oldVersion < 1) {
        db.createObjectStore('project'); // single record, keyed by a fixed string - see projectPersistence.js
        db.createObjectStore('assetBlobs'); // one Blob per asset, keyed by assetId
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      console.warn('IndexedDB open blocked - another tab may have an older version open.');
    };
  });

  return dbPromise;
}

// Runs one request inside its own transaction and resolves once the
// transaction actually COMMITS (tx.oncomplete), not just when the
// individual request succeeds - that's the difference between "the
// browser accepted this write" and "this write is durably saved".
function runTransaction(storeName, mode, work) {
  return openDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        let result;

        const request = work(store); // e.g. store.get(key) or store.put(value, key)
        request.onsuccess = () => {
          result = request.result;
        };
        request.onerror = () => reject(request.error);

        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
      })
  );
}

export function idbGet(storeName, key) {
  return runTransaction(storeName, 'readonly', (store) => store.get(key));
}

export function idbPut(storeName, value, key) {
  return runTransaction(storeName, 'readwrite', (store) => store.put(value, key));
}

export function idbDelete(storeName, key) {
  return runTransaction(storeName, 'readwrite', (store) => store.delete(key));
}

export function idbClear(storeName) {
  return runTransaction(storeName, 'readwrite', (store) => store.clear());
}
