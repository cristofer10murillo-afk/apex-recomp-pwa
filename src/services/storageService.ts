import { INITIAL_APP_STATE } from '../data/seedData';
import { AppState, DailyNutritionHistoryEntry } from '../types/fitness';

export const STORAGE_KEY = 'apex_recomp_pwa_state_v3_clean_start';
export const LAST_UPDATED_KEY = 'apex_recomp_last_updated_ms_v3';
export const LEGACY_KEYS = ['apex_recomp_pwa_state_v1', 'apex_recomp_pwa_state_v2_movinglife'];
export const FIRESTORE_DOC_ID = 'cristopher_clean_v3';

const IDB_NAME = 'ApexRecompIndexedDB';
const IDB_STORE = 'app_state_store';

export function getLocalISODate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLastLocalEditMs(): number {
  try {
    const val = localStorage.getItem(LAST_UPDATED_KEY);
    const num = val ? Number(val) : 0;
    return Number.isFinite(num) ? num : 0;
  } catch {
    return 0;
  }
}

export function setLastLocalEditMs(ms: number = Date.now()): void {
  try {
    localStorage.setItem(LAST_UPDATED_KEY, String(ms));
  } catch {
    // ignore storage errors
  }
}

const DEFAULT_PROFILE_FALLBACK = INITIAL_APP_STATE.userProfile || {
  age: 38,
  heightCm: 168,
  targetWeightKg: 70,
  targetBodyFatPercent: 18,
  dailyDeficitKcal: 300,
  primaryGoalTitle: 'Recomposición Corporal: Oxidar Grasa Visceral y Subir Masa en Piernas',
  targetWeeks: 12,
};

export function sanitizeAppState(raw: unknown): AppState {
  const todayStr = getLocalISODate();

  if (!raw || typeof raw !== 'object') {
    return {
      ...INITIAL_APP_STATE,
      selectedWeekdayIndex: new Date().getDay(),
      trainingMode: 'insanity_only',
      userProfile: { ...DEFAULT_PROFILE_FALLBACK },
      watchMetrics: {
        ...INITIAL_APP_STATE.watchMetrics,
        date: todayStr,
      },
      nutrition: {
        ...INITIAL_APP_STATE.nutrition,
        date: todayStr,
      },
      nutritionHistory: {},
    };
  }

  const parsed = raw as Partial<AppState>;
  const hasRealUserCamry =
    Array.isArray(parsed.camryHistory) &&
    parsed.camryHistory.length > 0 &&
    parsed.camryHistory[parsed.camryHistory.length - 1]?.userName === 'cristopher';

  const isNutritionNewDay = Boolean(parsed.nutrition?.date && parsed.nutrition.date !== todayStr);
  const isWatchNewDay = Boolean(parsed.watchMetrics?.date && parsed.watchMetrics.date !== todayStr);

  const historyMap: Record<string, DailyNutritionHistoryEntry> = {};

  if (parsed.nutritionHistory && typeof parsed.nutritionHistory === 'object') {
    for (const [dateKey, entry] of Object.entries(parsed.nutritionHistory)) {
      if (entry && typeof entry === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(dateKey) && dateKey <= todayStr) {
        historyMap[dateKey] = {
          date: dateKey,
          waterGlasses250ml: Number(entry.waterGlasses250ml) || 0,
          targetWaterGlasses: Number(entry.targetWaterGlasses) || 14,
          loggedMeals: Array.isArray(entry.loggedMeals) ? entry.loggedMeals : [],
          watchActiveCalories:
            typeof entry.watchActiveCalories === 'number' ? entry.watchActiveCalories : undefined,
          trainingMode:
            entry.trainingMode === 'hybrid' || entry.trainingMode === 'insanity_only'
              ? entry.trainingMode
              : undefined,
          completedStrengthRoutineId: entry.completedStrengthRoutineId || undefined,
          completedInsanityDay:
            typeof entry.completedInsanityDay === 'number' ? entry.completedInsanityDay : undefined,
          avgHeartRate: typeof entry.avgHeartRate === 'number' ? entry.avgHeartRate : undefined,
          sleepScore: typeof entry.sleepScore === 'number' ? entry.sleepScore : undefined,
        };
      }
    }
  }

  if (
    isNutritionNewDay &&
    parsed.nutrition?.date &&
    parsed.nutrition.date !== '2026-10-29' &&
    ((parsed.nutrition.loggedMeals?.length ?? 0) > 0 ||
      (parsed.nutrition.waterGlasses250ml ?? 0) > 0 ||
      Boolean(parsed.nutrition.completedStrengthRoutineId) ||
      Boolean(parsed.nutrition.completedInsanityDay))
  ) {
    const oldDate = parsed.nutrition.date;
    historyMap[oldDate] = {
      date: oldDate,
      waterGlasses250ml: parsed.nutrition.waterGlasses250ml ?? 0,
      targetWaterGlasses: parsed.nutrition.targetWaterGlasses ?? 14,
      loggedMeals: Array.isArray(parsed.nutrition.loggedMeals) ? parsed.nutrition.loggedMeals : [],
      watchActiveCalories:
        parsed.watchMetrics?.date === oldDate && (parsed.watchMetrics.activeCalories ?? 0) > 0
          ? parsed.watchMetrics.activeCalories
          : historyMap[oldDate]?.watchActiveCalories,
      trainingMode:
        parsed.nutrition.trainingMode ||
        (parsed.trainingMode === 'hybrid' ? 'hybrid' : 'insanity_only'),
      completedStrengthRoutineId: parsed.nutrition.completedStrengthRoutineId,
      completedInsanityDay: parsed.nutrition.completedInsanityDay,
      avgHeartRate:
        parsed.watchMetrics?.date === oldDate ? parsed.watchMetrics.avgHeartRate : undefined,
      sleepScore:
        parsed.watchMetrics?.date === oldDate ? parsed.watchMetrics.sleepScore : undefined,
    };
  }

  if (
    isWatchNewDay &&
    parsed.watchMetrics?.date &&
    parsed.watchMetrics.date !== '2026-10-29' &&
    (parsed.watchMetrics.activeCalories ?? 0) > 0
  ) {
    const oldWatchDate = parsed.watchMetrics.date;
    const existing = historyMap[oldWatchDate];
    historyMap[oldWatchDate] = existing
      ? { ...existing, watchActiveCalories: parsed.watchMetrics.activeCalories }
      : {
          date: oldWatchDate,
          waterGlasses250ml: 0,
          targetWaterGlasses: parsed.nutrition?.targetWaterGlasses ?? 14,
          loggedMeals: [],
          watchActiveCalories: parsed.watchMetrics.activeCalories,
        };
  }

  const recentKeys = Object.keys(historyMap)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 60);
  const trimmedHistory: Record<string, DailyNutritionHistoryEntry> = {};
  for (const key of recentKeys) {
    trimmedHistory[key] = historyMap[key];
  }

  const mergedProfile = {
    ...DEFAULT_PROFILE_FALLBACK,
    ...(parsed.userProfile || {}),
    geminiApiKey:
      parsed.userProfile?.geminiApiKey && parsed.userProfile.geminiApiKey.trim()
        ? parsed.userProfile.geminiApiKey.trim()
        : DEFAULT_PROFILE_FALLBACK.geminiApiKey,
  };

  return {
    ...INITIAL_APP_STATE,
    ...parsed,
    selectedWeekdayIndex: new Date().getDay(),
    trainingMode: parsed.trainingMode === 'hybrid' ? 'hybrid' : 'insanity_only',
    userProfile: mergedProfile,
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
        ? parsed.routines.map((rt) => {
            const seedRt = INITIAL_APP_STATE.routines.find((s) => s.id === rt.id);
            return {
              ...rt,
              title: rt.title?.includes('\ufffd') && seedRt ? seedRt.title : rt.title,
              focus: rt.focus?.includes('\ufffd') && seedRt ? seedRt.focus : rt.focus,
              exercises: Array.isArray(rt.exercises)
                ? rt.exercises.map((ex) => {
                    const seedEx = seedRt?.exercises.find((se) => se.id === ex.id);
                    return {
                      ...ex,
                      name: ex.name?.includes('\ufffd') && seedEx ? seedEx.name : ex.name,
                      equipmentName:
                        ex.equipmentName?.includes('\ufffd') && seedEx
                          ? seedEx.equipmentName
                          : ex.equipmentName,
                      notes: ex.notes?.includes('\ufffd') && seedEx ? seedEx.notes : ex.notes,
                    };
                  })
                : rt.exercises,
            };
          })
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
    camryHistory: hasRealUserCamry ? parsed.camryHistory! : INITIAL_APP_STATE.camryHistory,
    watchMetrics: {
      ...INITIAL_APP_STATE.watchMetrics,
      ...(parsed.watchMetrics || {}),
      date: todayStr,
      activeCalories: isWatchNewDay ? 0 : parsed.watchMetrics?.activeCalories ?? 0,
    },
    nutrition: {
      ...INITIAL_APP_STATE.nutrition,
      ...(parsed.nutrition || {}),
      date: todayStr,
      waterGlasses250ml: isNutritionNewDay ? 0 : parsed.nutrition?.waterGlasses250ml ?? 0,
      loggedMeals: isNutritionNewDay
        ? []
        : Array.isArray(parsed.nutrition?.loggedMeals)
        ? parsed.nutrition!.loggedMeals
        : INITIAL_APP_STATE.nutrition.loggedMeals,
      trainingMode: isNutritionNewDay
        ? parsed.trainingMode === 'hybrid'
          ? 'hybrid'
          : 'insanity_only'
        : parsed.nutrition?.trainingMode,
      completedStrengthRoutineId: isNutritionNewDay
        ? undefined
        : parsed.nutrition?.completedStrengthRoutineId,
      completedInsanityDay: isNutritionNewDay
        ? undefined
        : parsed.nutrition?.completedInsanityDay,
    },
    nutritionHistory: trimmedHistory,
    coachChatHistory: Array.isArray(parsed.coachChatHistory)
      ? parsed.coachChatHistory.slice(-24)
      : [],
    firebaseConfig: {
      ...INITIAL_APP_STATE.firebaseConfig,
      ...(parsed.firebaseConfig?.projectId ? parsed.firebaseConfig : INITIAL_APP_STATE.firebaseConfig),
      enabled: true,
    },
  };
}

function openDatabase(): Promise<IDBDatabase | null> {
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
  const db = await openDatabase();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(state, STORAGE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function loadFromIndexedDB(): Promise<AppState | null> {
  const db = await openDatabase();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(STORAGE_KEY);
      req.onsuccess = () => resolve(req.result ? sanitizeAppState(req.result) : null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

let cloudSyncTimer: number | null = null;
let pendingCloudState: AppState | null = null;

export async function saveStateToFirebaseCloud(
  state: AppState,
  options?: { keepalive?: boolean }
): Promise<boolean> {
  const cfg = state.firebaseConfig || INITIAL_APP_STATE.firebaseConfig;
  if (!cfg.enabled || !cfg.projectId || !cfg.apiKey) return false;

  try {
    const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      cfg.projectId
    )}/databases/(default)/documents/apex_recomp_state/${FIRESTORE_DOC_ID}?key=${encodeURIComponent(
      cfg.apiKey
    )}`;
    const body = {
      fields: {
        updatedAt: { stringValue: new Date().toISOString() },
        appVersion: { stringValue: '2.0.0-clean-start' },
        payloadJson: { stringValue: JSON.stringify(state) },
      },
    };
    const res = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: Boolean(options?.keepalive),
    });
    if (res.ok) {
      pendingCloudState = null;
    }
    return res.ok;
  } catch {
    return false;
  }
}

export function flushPendingCloudSync(): void {
  if (!pendingCloudState) return;
  if (cloudSyncTimer) {
    window.clearTimeout(cloudSyncTimer);
    cloudSyncTimer = null;
  }
  const latest = pendingCloudState;
  pendingCloudState = null;
  void saveStateToFirebaseCloud(latest, { keepalive: true });
}

export async function loadStateFromFirebaseCloud(): Promise<{
  state: AppState | null;
  updatedAtMs: number;
  notFound?: boolean;
} | null> {
  const cfg = INITIAL_APP_STATE.firebaseConfig;
  if (!cfg.enabled || !cfg.projectId || !cfg.apiKey) return null;

  try {
    const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      cfg.projectId
    )}/databases/(default)/documents/apex_recomp_state/${FIRESTORE_DOC_ID}?key=${encodeURIComponent(
      cfg.apiKey
    )}`;
    const res = await fetch(endpoint, {
      method: 'GET',
      cache: 'no-store',
    });
    if (res.status === 404) {
      return { state: null, updatedAtMs: 0, notFound: true };
    }
    if (!res.ok) return null;

    const json = await res.json();
    const rawPayload = json?.fields?.payloadJson?.stringValue;
    if (!rawPayload) return null;

    const parsed = JSON.parse(rawPayload);
    const updatedStr = json?.fields?.updatedAt?.stringValue;
    const updatedMs = updatedStr ? Date.parse(updatedStr) : 0;
    return {
      state: sanitizeAppState(parsed),
      updatedAtMs: Number.isFinite(updatedMs) ? updatedMs : 0,
    };
  } catch {
    return null;
  }
}

export function loadInitialState(): AppState {
  try {
    for (const legacy of LEGACY_KEYS) {
      localStorage.removeItem(legacy);
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return sanitizeAppState(null);
    const parsed = JSON.parse(raw);
    return sanitizeAppState(parsed);
  } catch {
    return sanitizeAppState(null);
  }
}

export function saveAppState(
  state: AppState,
  options?: { syncCloud?: boolean; markEdited?: boolean }
): void {
  const markEdited = options?.markEdited ?? false;
  const syncCloud = options?.syncCloud ?? false;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (markEdited) {
      setLastLocalEditMs(Date.now());
    }
  } catch (err) {
    console.warn('Error saving to localStorage:', err);
  }

  void saveToIndexedDB(state);

  if (syncCloud && typeof window !== 'undefined') {
    pendingCloudState = state;
    if (cloudSyncTimer) {
      window.clearTimeout(cloudSyncTimer);
    }
    cloudSyncTimer = window.setTimeout(() => {
      void saveStateToFirebaseCloud(pendingCloudState || state);
    }, 600);
  }
}

export function exportBackupJson(state: AppState): void {
  const payload = {
    schemaVersion: '1.2.0',
    exportedAt: new Date().toISOString(),
    app: 'APEX RECOMP PWA',
    data: state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const todayStr = getLocalISODate();
  a.href = url;
  a.download = `apex-recomp-backup-${todayStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importBackupJson(jsonText: string): AppState {
  const parsed = JSON.parse(jsonText);
  const candidate = parsed.data ? parsed.data : parsed;
  if (!candidate.routines || !candidate.insanityCalendar || !candidate.camryHistory) {
    throw new Error('El archivo JSON no contiene una estructura válida de APEX RECOMP.');
  }
  return sanitizeAppState(candidate);
}
