import { AppState } from '../types/fitness';
import { INITIAL_APP_STATE } from '../data/seedData';

const STORAGE_KEY = 'apex_recomp_pwa_state_v2_movinglife';
const IDB_NAME = 'ApexRecompIndexedDB';
const IDB_STORE = 'app_state_store';

export function sanitizeAppState(parsed?: Partial<AppState> | null): AppState {
  if (!parsed || typeof parsed !== 'object') {
    return INITIAL_APP_STATE;
  }

  // Upgrade legacy mock Camry records to Cristopher's real MovingLife report if not yet upgraded
  const hasRealMovingLifeProfile =
    Array.isArray(parsed.camryHistory) &&
    parsed.camryHistory.length > 0 &&
    parsed.camryHistory[parsed.camryHistory.length - 1]?.userName === 'cristopher';

  return {
    ...INITIAL_APP_STATE,
    ...parsed,
    selectedWeekdayIndex:
      typeof parsed.selectedWeekdayIndex === 'number' &&
      parsed.selectedWeekdayIndex >= 0 &&
      parsed.selectedWeekdayIndex <= 6
        ? parsed.selectedWeekdayIndex
        : INITIAL_APP_STATE.selectedWeekdayIndex,
    currentInsanityDay:
      typeof parsed.currentInsanityDay === 'number' &&
      parsed.currentInsanityDay >= 1 &&
      parsed.currentInsanityDay <= 63
        ? parsed.currentInsanityDay
        : INITIAL_APP_STATE.currentInsanityDay,
    hardwareInventory:
      Array.isArray(parsed.hardwareInventory) && parsed.hardwareInventory.length > 0
        ? parsed.hardwareInventory
        : INITIAL_APP_STATE.hardwareInventory,
    routines:
      Array.isArray(parsed.routines) && parsed.routines.length > 0
        ? parsed.routines
        : INITIAL_APP_STATE.routines,
    strengthVolumeHistory:
      Array.isArray(parsed.strengthVolumeHistory) && parsed.strengthVolumeHistory.length > 0
        ? parsed.strengthVolumeHistory
        : INITIAL_APP_STATE.strengthVolumeHistory,
    insanityCalendar:
      Array.isArray(parsed.insanityCalendar) && parsed.insanityCalendar.length > 0
        ? parsed.insanityCalendar
        : INITIAL_APP_STATE.insanityCalendar,
    fitTests:
      Array.isArray(parsed.fitTests) && parsed.fitTests.length > 0
        ? parsed.fitTests
        : INITIAL_APP_STATE.fitTests,
    camryHistory: hasRealMovingLifeProfile
      ? parsed.camryHistory!
      : INITIAL_APP_STATE.camryHistory,
    watchMetrics: {
      ...INITIAL_APP_STATE.watchMetrics,
      ...(parsed.watchMetrics || {}),
    },
    nutrition: {
      ...INITIAL_APP_STATE.nutrition,
      ...(parsed.nutrition || {}),
      loggedMeals: Array.isArray(parsed.nutrition?.loggedMeals)
        ? parsed.nutrition.loggedMeals
        : INITIAL_APP_STATE.nutrition.loggedMeals,
    },
    firebaseConfig: {
      ...INITIAL_APP_STATE.firebaseConfig,
      ...(parsed.firebaseConfig?.projectId
        ? parsed.firebaseConfig
        : INITIAL_APP_STATE.firebaseConfig),
      enabled: true,
    },
  };
}

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
      req.onsuccess = () =>
        resolve(req.result ? sanitizeAppState(req.result as Partial<AppState>) : null);
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
        appVersion: { stringValue: '1.2.0-movinglife' },
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
    const sanitized = sanitizeAppState(parsed);
    // If cloud had legacy mock data, push the upgraded MovingLife profile back to Firestore
    if (
      !Array.isArray(parsed.camryHistory) ||
      parsed.camryHistory[parsed.camryHistory.length - 1]?.userName !== 'cristopher'
    ) {
      void syncToFirestoreCloud(sanitized);
    }
    return sanitized;
  } catch {
    return null;
  }
}

export function loadAppStateSync(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_APP_STATE;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return sanitizeAppState(parsed);
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
    schemaVersion: '1.2.0',
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
  return sanitizeAppState(candidate);
}
