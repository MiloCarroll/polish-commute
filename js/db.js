// Minimal promise wrapper around IndexedDB.
// Stores:
//   cards    keyPath "id"     — FSRS state per studied card (see scheduler.js)
//   reviews  autoIncrement    — full review log, never pruned; index "cardId", "review"
//   settings keyPath "key"    — { key, value }
//   flags    keyPath "cardId" — { cardId, note, created }      (used from stage 5)
//   own      keyPath "id"     — user-made "My phrases" items  (used from stage 5)

const DB_NAME = 'polski';
const DB_VERSION = 1;

let dbPromise = null;

function req(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('cards')) {
        const s = db.createObjectStore('cards', { keyPath: 'id' });
        s.createIndex('module', 'module');
      }
      if (!db.objectStoreNames.contains('reviews')) {
        const s = db.createObjectStore('reviews', { autoIncrement: true });
        s.createIndex('cardId', 'cardId');
        s.createIndex('review', 'review');
      }
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('flags')) db.createObjectStore('flags', { keyPath: 'cardId' });
      if (!db.objectStoreNames.contains('own')) db.createObjectStore('own', { keyPath: 'id' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('Database upgrade blocked: close other Polski tabs.'));
  });
  return dbPromise;
}

async function store(name, mode = 'readonly') {
  const db = await openDB();
  return db.transaction(name, mode).objectStore(name);
}

export async function getAll(name) {
  return req((await store(name)).getAll());
}

export async function get(name, key) {
  return req((await store(name)).get(key));
}

export async function put(name, value) {
  return req((await store(name, 'readwrite')).put(value));
}

export async function del(name, key) {
  return req((await store(name, 'readwrite')).delete(key));
}

/** Reviews since a timestamp (ms), using the "review" index. */
export async function reviewsSince(ms) {
  const s = await store('reviews');
  return req(s.index('review').getAll(IDBKeyRange.lowerBound(ms)));
}

/** Save a card record and its review-log entry atomically. */
export async function saveReview(record, logEntry) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['cards', 'reviews'], 'readwrite');
    tx.objectStore('cards').put(record);
    tx.objectStore('reviews').add(logEntry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Ask the browser not to evict our data (best effort; Safari may ignore it). */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch { /* not supported */ }
}

// ---- Backup, restore and reset ------------------------------------------------

const ALL = ['cards', 'reviews', 'settings', 'flags', 'own'];

/** Every store's contents. The review log keeps its keys so a restore is exact. */
export async function dumpAll() {
  const db = await openDB();
  const tx = db.transaction(ALL, 'readonly');
  const out = {};
  const jobs = ALL.filter((s) => s !== 'reviews').map(async (s) => { out[s] = await req(tx.objectStore(s).getAll()); });
  jobs.push(new Promise((resolve, reject) => {
    const rows = [];
    const c = tx.objectStore('reviews').openCursor();
    c.onsuccess = () => {
      const cur = c.result;
      if (!cur) { out.reviews = rows; resolve(); return; }
      rows.push({ key: cur.key, value: cur.value });
      cur.continue();
    };
    c.onerror = () => reject(c.error);
  }));
  await Promise.all(jobs);
  return out;
}

/** Replace everything with the given stores, in one transaction (all or nothing). */
export async function restoreAll(stores) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ALL, 'readwrite');
    for (const s of ALL) tx.objectStore(s).clear();
    for (const c of stores.cards ?? []) tx.objectStore('cards').put(c);
    for (const r of stores.reviews ?? []) tx.objectStore('reviews').put(r.value, r.key);
    for (const x of stores.settings ?? []) tx.objectStore('settings').put(x);
    for (const f of stores.flags ?? []) tx.objectStore('flags').put(f);
    for (const o of stores.own ?? []) tx.objectStore('own').put(o);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Import was cancelled.'));
  });
}

/** Forget all study progress (card states, review log, lessons seen). Settings, own phrases and flags stay. */
export async function resetProgress() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['cards', 'reviews', 'settings'], 'readwrite');
    tx.objectStore('cards').clear();
    tx.objectStore('reviews').clear();
    tx.objectStore('settings').delete('lessonsSeen');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Delete one card's FSRS state (used when an own phrase is deleted). The review log is kept. */
export async function deleteCards(ids) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cards', 'readwrite');
    for (const id of ids) tx.objectStore('cards').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
