/**
 * Local-only IndexedDB persistence for user-uploaded avatar assets (.vrm models
 * and PNGTuber sprites) so public users don't lose their avatar on every reload.
 *
 * Gracefully degrades to a no-op if IndexedDB is blocked (private windows or
 * sandboxed iframes). Nothing ever leaves the user's browser.
 */

const DB_NAME = 'easyvtuber_assets_v1';
const STORE_NAME = 'avatars';
const VRM_KEY = 'active_vrm';
const PNG_KEY = 'active_png';

export const MAX_VRM_BYTES = 150 * 1024 * 1024;
export const MAX_PNG_BYTES = 15 * 1024 * 1024;

export interface StoredVrmAsset {
  name: string;
  blob: Blob;
  updatedAt: number;
}

export interface StoredPngAsset {
  name: string;
  idle: Blob;
  talking: Blob | null;
  blinking: Blob | null;
  updatedAt: number;
}

function openAssetsDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openAssetsDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
      req.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
      tx.onerror = () => db.close();
    } catch {
      db.close();
      resolve(null);
    }
  });
}

async function idbPut(key: string, value: unknown): Promise<boolean> {
  const db = await openAssetsDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    } catch {
      db.close();
      resolve(false);
    }
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openAssetsDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export async function saveVrmAsset(name: string, blob: Blob): Promise<boolean> {
  if (blob.size <= 0 || blob.size > MAX_VRM_BYTES) return false;
  return idbPut(VRM_KEY, { name, blob, updatedAt: Date.now() } satisfies StoredVrmAsset);
}

export async function loadVrmAsset(): Promise<StoredVrmAsset | null> {
  const item = await idbGet<StoredVrmAsset>(VRM_KEY);
  if (!item || !(item.blob instanceof Blob) || typeof item.name !== 'string') return null;
  return item;
}

export async function clearVrmAsset(): Promise<void> {
  await idbDelete(VRM_KEY);
}

export async function savePngAsset(asset: {
  name: string;
  idle: Blob;
  talking: Blob | null;
  blinking: Blob | null;
}): Promise<boolean> {
  if (asset.idle.size <= 0 || asset.idle.size > MAX_PNG_BYTES) return false;
  return idbPut(PNG_KEY, { ...asset, updatedAt: Date.now() } satisfies StoredPngAsset);
}

export async function loadPngAsset(): Promise<StoredPngAsset | null> {
  const item = await idbGet<StoredPngAsset>(PNG_KEY);
  if (!item || !(item.idle instanceof Blob) || typeof item.name !== 'string') return null;
  return item;
}

export async function clearPngAsset(): Promise<void> {
  await idbDelete(PNG_KEY);
}
