import { CamryBiometricRecord } from '../types/fitness';
import { compressImageFileToBase64 } from './aiService';
import { getLocalISODate } from './storageService';

const SHARE_DB_NAME = 'ApexSharedInbox';
const SHARE_STORE_NAME = 'pending';

const PHOTO_DB_NAME = 'ApexProgressPhotosVault';
const PHOTO_STORE_NAME = 'photos';

export interface PendingSharedPayload {
  file?: File;
  title: string;
  text: string;
  url: string;
  receivedAt: number;
}

interface RawShareRecord {
  file?: {
    buffer: ArrayBuffer;
    name: string;
    type: string;
  } | null;
  title?: string;
  text?: string;
  url?: string;
  receivedAt?: number;
}

function openShareDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(SHARE_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(SHARE_STORE_NAME)) {
          db.createObjectStore(SHARE_STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function consumePendingShare(): Promise<PendingSharedPayload | null> {
  const db = await openShareDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(SHARE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(SHARE_STORE_NAME);
      const getReq = store.get('latest');

      getReq.onsuccess = () => {
        const raw = getReq.result as RawShareRecord | undefined;
        if (!raw) {
          resolve(null);
          return;
        }
        store.delete('latest');

        // Discard orphaned share payloads older than 2 hours
        if (raw.receivedAt && Date.now() - raw.receivedAt > 2 * 60 * 60 * 1000) {
          resolve(null);
          return;
        }

        let reconstructedFile: File | undefined;
        if (raw.file?.buffer) {
          reconstructedFile = new File(
            [raw.file.buffer],
            raw.file.name || 'shared-capture.png',
            { type: raw.file.type || 'image/png' }
          );
        }

        const title = String(raw.title || '').trim();
        const text = String(raw.text || '').trim();
        const url = String(raw.url || '').trim();

        if (!reconstructedFile && !title && !text && !url) {
          resolve(null);
          return;
        }

        resolve({
          file: reconstructedFile,
          title,
          text,
          url,
          receivedAt: raw.receivedAt || Date.now(),
        });
      };
      getReq.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function openVaultDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(PHOTO_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(PHOTO_STORE_NAME)) {
          db.createObjectStore(PHOTO_STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveSharedFileToPhotoVault(
  file: File,
  latestCamry?: CamryBiometricRecord,
  pose: 'Frente' | 'Perfil' | 'Espalda' = 'Frente'
): Promise<boolean> {
  const db = await openVaultDB();
  if (!db) return false;

  const { previewUrl } = await compressImageFileToBase64(file);
  const item = {
    id: `photo-${Date.now()}`,
    date: getLocalISODate(),
    createdAtMs: Date.now(),
    note: `${pose} • Compartido rápido`,
    pose,
    weightKg: latestCamry?.weightKg ?? 83.3,
    bodyFatPercent: latestCamry?.bodyFatPercent ?? 33.9,
    visceralFatIndex: latestCamry?.visceralFatIndex ?? 13,
    dataUrl: previewUrl,
  };

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(PHOTO_STORE_NAME, 'readwrite');
      tx.objectStore(PHOTO_STORE_NAME).put(item);
      tx.oncomplete = () => {
        window.dispatchEvent(new Event('apex-photo-vault-updated'));
        resolve(true);
      };
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}
