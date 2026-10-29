import { AppState } from '../types/fitness';
import { INITIAL_APP_STATE } from '../data/seedData';

const STORAGE_KEY = 'apex_recomp_pwa_state_v1';
const IDB_NAME = 'ApexRecompIndexedDB';
const IDB_STORE = 'app_state_store';

function openIndexedDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(IDB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveToIndexedDB(state: AppState): Promise<void> {
  const db = await openIndexedDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(state, STORAGE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function loadFromIndexedDB(): Promise<AppState | null> {
  const db = await openIndexedDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(STORAGE_KEY);
      req.onsuccess = () => resolve((req.result as AppState) || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

let firestoreDebounceTimer: number | null = null;

export async function syncToFirestoreCloud(state: AppState): Promise<boolean> {
  const cfg = state.firebaseConfig || INITIAL_APP_STATE.firebaseConfig;
  if (!cfg.enabled || !cfg.projectId || !cfg.apiKey) return false;

  try {
    const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      cfg.projectId
    )}/databases/(default)/documents/apex_recomp_state/primary_profile?key=${encodeURIComponent(
      cfg.apiKey
    )}`;

    const body = {
      fields: {
        updatedAt: { stringValue: new Date().toISOString() },
        appVersion: { stringValue: '1.0.0' },
        payloadJson: { stringValue: JSON.stringify(state) },
      },
    };

    const res = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return res.ok;
  } catch {
    return false;
  }
}

export async function loadFromFirestoreCloud(): Promise<AppState | null> {
  const cfg = INITIAL_APP_STATE.firebaseConfig;
  if (!cfg.enabled || !cfg.projectId || !cfg.apiKey) return null;

  try {
    const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      cfg.projectId
    )}/databases/(default)/documents/apex_recomp_state/primary_profile?key=${encodeURIComponent(
      cfg.apiKey
    )}`;
    const res = await fetch(endpoint, { method: 'GET' });
    if (!res.ok) return null;
    const doc = await res.json();
    const rawJson = doc?.fields?.payloadJson?.stringValue;
    if (!rawJson) return null;
    const parsed = JSON.parse(rawJson) as Partial<AppState>;
    return {
      ...INITIAL_APP_STATE,
      ...parsed,
      firebaseConfig: {
        ...INITIAL_APP_STATE.firebaseConfig,
        ...(parsed.firebaseConfig || {}),
        enabled: true,
      },
    };
  } catch {
    return null;
  }
}

export function loadAppStateSync(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_APP_STATE;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      ...INITIAL_APP_STATE,
      ...parsed,
      firebaseConfig: {
        ...INITIAL_APP_STATE.firebaseConfig,
        ...(parsed.firebaseConfig?.projectId ? parsed.firebaseConfig : INITIAL_APP_STATE.firebaseConfig),
      },
      hardwareInventory: parsed.hardwareInventory?.length
        ? parsed.hardwareInventory
        : INITIAL_APP_STATE.hardwareInventory,
      routines: parsed.routines?.length ? parsed.routines : INITIAL_APP_STATE.routines,
      insanityCalendar: parsed.insanityCalendar?.length
        ? parsed.insanityCalendar
        : INITIAL_APP_STATE.insanityCalendar,
      fitTests: parsed.fitTests?.length ? parsed.fitTests : INITIAL_APP_STATE.fitTests,
      camryHistory: parsed.camryHistory?.length
        ? parsed.camryHistory
        : INITIAL_APP_STATE.camryHistory,
    };
  } catch {
    return INITIAL_APP_STATE;
  }
}

export function saveAppState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Error saving to localStorage:', err);
  }
  void saveToIndexedDB(state);

  if (typeof window !== 'undefined') {
    if (firestoreDebounceTimer) {
      window.clearTimeout(firestoreDebounceTimer);
    }
    firestoreDebounceTimer = window.setTimeout(() => {
      void syncToFirestoreCloud(state);
    }, 1200);
  }
}

export function exportStateAsJson(state: AppState): void {
  const payload = {
    schemaVersion: '1.0.0',
    exportedAt: new Date().toISOString(),
    app: 'APEX RECOMP PWA',
    data: state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const datePart = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `apex-recomp-backup-${datePart}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseImportedJson(jsonString: string): AppState {
  const parsed = JSON.parse(jsonString);
  const candidate: Partial<AppState> = parsed.data ? parsed.data : parsed;
  if (!candidate.routines || !candidate.insanityCalendar || !candidate.camryHistory) {
    throw new Error('El archivo JSON no contiene una estructura válida de APEX RECOMP.');
  }
  return {
    ...INITIAL_APP_STATE,
    ...candidate,
  };
}
