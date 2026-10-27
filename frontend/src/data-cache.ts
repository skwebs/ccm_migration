export type BootstrapSnapshot = {
  version: 1;
  savedAt: number;
  data: {
    cards: unknown[];
    transactions: unknown[];
    apps: unknown[];
    dashboard: unknown;
    payments: unknown[];
    statements: unknown[];
    settings: { monthly_budget_minor: number | string; categories?: string[] };
  };
};

const DB_NAME = 'card-ledger-private-cache';
const STORE_NAME = 'snapshots';
const CACHE_KEY = 'authenticated-bootstrap-v1';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable in this browser.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open local cache.'));
    request.onblocked = () => reject(new Error('Local cache upgrade is blocked by another tab.'));
  });
}

export async function readBootstrapCache(): Promise<BootstrapSnapshot | null> {
  const db = await openDatabase();
  try {
    const value = await new Promise<BootstrapSnapshot | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(CACHE_KEY);
      request.onsuccess = () => resolve(request.result as BootstrapSnapshot | undefined);
      request.onerror = () => reject(request.error || new Error('Could not read local cache.'));
    });
    if (!value || value.version !== 1 || !value.data || !Array.isArray(value.data.transactions)) return null;
    if (!Number.isFinite(value.savedAt) || Date.now() - value.savedAt > MAX_AGE_MS) {
      await clearBootstrapCache();
      return null;
    }
    return value;
  } finally {
    db.close();
  }
}

export async function writeBootstrapCache(snapshot: BootstrapSnapshot): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(snapshot, CACHE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Could not write local cache.'));
      tx.onabort = () => reject(tx.error || new Error('Local cache write was aborted.'));
    });
  } finally {
    db.close();
  }
}

export async function clearBootstrapCache(): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(CACHE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Could not clear local cache.'));
      tx.onabort = () => reject(tx.error || new Error('Local cache clear was aborted.'));
    });
  } finally {
    db.close();
  }
}
