import {
  CamryBiometricRecord,
  MovingLifeImportResult,
  SamsungHealthImportResult,
  WatchDailyMetrics,
} from '../types/fitness';
import { callGeminiVisionJSON, getEffectiveGeminiKey } from './aiService';
import { getLocalISODate } from './storageService';

declare global {
  interface Window {
    Tesseract?: {
      recognize: (
        image: File | Blob | string,
        langs: string,
        opts?: { logger?: (m: { status: string; progress: number }) => void }
      ) => Promise<{ data: { text: string } }>;
    };
  }
}

export function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = String(ev.target?.result || '');
      const base64 = result.split(',')[1] || '';
      resolve({ base64, mimeType: file.type || 'image/jpeg' });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function connectGalaxyWatch7BLE(): Promise<{
  avgHeartRate: number;
  maxHeartRate: number;
  deviceName: string;
}> {
  const nav = navigator as Navigator & {
    bluetooth?: {
      requestDevice: (opts: unknown) => Promise<{
        name?: string;
        gatt?: {
          connect: () => Promise<{
            getPrimaryService: (svc: string | number) => Promise<{
              getCharacteristic: (char: string) => Promise<{
                startNotifications: () => Promise<EventTarget>;
              }>;
            }>;
          }>;
        };
      }>;
    };
  };

  if (!nav.bluetooth) {
    throw new Error(
      'Tu navegador actual no tiene Web Bluetooth activo. Ábrelo en Google Chrome en tu Samsung S23 Ultra.'
    );
  }

  const device = await nav.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: ['heart_rate', 6157, 'battery_service', 6159, 'generic_access', 6144],
  });
  const deviceName = device.name || 'Galaxy Watch 7';

  if (!device.gatt) {
    throw new Error(
      `Se detectó "${deviceName}", pero Wear OS cifra los datos hacia Samsung Health. Usa el botón "📂 Subir Captura S-Health" o abre la app gratuita "Heart for Bluetooth" en el reloj.`
    );
  }

  let char: { startNotifications: () => Promise<EventTarget> };
  try {
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService('heart_rate');
    char = await service.getCharacteristic('heart_rate_measurement');
  } catch {
    throw new Error(
      `Conectado a "${deviceName}", pero Samsung Wear OS bloquea la lectura directa sin transmisor BLE. Para sincronizar Calorías, Pasos, Sueño y FC sin instalar nada en el reloj, usa el botón "📂 Subir Captura S-Health".`
    );
  }

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(
        new Error(
          'Tiempo de lectura agotado. Asegúrate de tener el sensor activo en la muñeca.'
        )
      );
    }, 10000);

    char
      .startNotifications()
      .then((notifier) => {
        notifier.addEventListener('characteristicvaluechanged', (ev: Event) => {
          window.clearTimeout(timeout);
          const dataView = (ev.target as unknown as { value: DataView }).value;
          const flags = dataView.getUint8(0);
          const rawHr = flags & 1 ? dataView.getUint16(1, true) : dataView.getUint8(1);
          const clamped = Math.max(55, Math.min(205, rawHr));
          resolve({ avgHeartRate: clamped, maxHeartRate: clamped, deviceName });
        });
      })
      .catch(reject);
  });
}

export async function connectCamryScale(
  baseRecord: CamryBiometricRecord
): Promise<CamryBiometricRecord> {
  const nav = navigator as Navigator & {
    bluetooth?: {
      requestDevice: (opts: unknown) => Promise<{
        gatt?: {
          connect: () => Promise<{
            getPrimaryService: (svc: number) => Promise<{
              getCharacteristic: (char: number) => Promise<{
                startNotifications: () => Promise<EventTarget>;
              }>;
            }>;
          }>;
        };
      }>;
    };
  };

  if (!nav.bluetooth) {
    throw new Error('Web Bluetooth requiere Google Chrome en tu Samsung S23 Ultra.');
  }

  const device = await nav.bluetooth.requestDevice({
    filters: [
      { services: [6173] },
      { services: [6171] },
      { namePrefix: 'Camry' },
      { namePrefix: 'MovingLife' },
      { namePrefix: 'QN-Scale' },
    ],
    optionalServices: [6173, 6171, 65520],
  });

  if (!device.gatt) {
    throw new Error('No se pudo conectar al módulo Bluetooth de la báscula Camry.');
  }

  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(6173);
  const char = await service.getCharacteristic(10909);

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(
        new Error('Sube a la báscula Camry descalzo sujetando los electrodos para transmitir el peso.')
      );
    }, 15000);

    char
      .startNotifications()
      .then((notifier) => {
        notifier.addEventListener('characteristicvaluechanged', (ev: Event) => {
          window.clearTimeout(timeout);
          const dv = (ev.target as unknown as { value: DataView }).value;
          const isLbs = Boolean(dv.getUint8(0) & 1);
          const rawWeight = dv.getUint16(1, true);
          const kg = isLbs
            ? Math.round(rawWeight * 0.01 * 0.45359237 * 10) / 10
            : Math.round(rawWeight * 0.005 * 10) / 10;
          const validKg = kg > 30 && kg < 200 ? kg : baseRecord.weightKg;
          resolve(calculateEstimatedCamryRecord(validKg, baseRecord.bodyFatPercent, baseRecord));
        });
      })
      .catch(reject);
  });
}

export function calculateEstimatedCamryRecord(
  weightInput: number,
  bodyFatInput: number,
  prev: CamryBiometricRecord
): CamryBiometricRecord {
  const weightKg = Math.round(Math.max(40, Math.min(180, weightInput)) * 10) / 10;
  const bodyFatPercent = Math.round(Math.max(5, Math.min(55, bodyFatInput)) * 10) / 10;
  const heightCm = prev.heightCm || 168;
  const heightM = heightCm / 100;

  const bodyFatMassKg = Math.round(weightKg * (bodyFatPercent / 100) * 10) / 10;
  const leanBodyMassKg = Math.round((weightKg - bodyFatMassKg) * 10) / 10;
  const bmrKcal = Math.round(370 + 21.6 * leanBodyMassKg);
  const bmi = Math.round((weightKg / (heightM * heightM)) * 10) / 10;
  const waterPercent = Math.round((100 - bodyFatPercent) * 0.7337 * 10) / 10;
  const inorganicSaltPercent =
    Math.round(Math.max(3.5, Math.min(5.5, (100 - bodyFatPercent) * 0.068)) * 10) / 10;
  const boneMassKg = Math.round(((weightKg * inorganicSaltPercent) / 100) * 10) / 10;
  const musclePercent = Math.round((100 - bodyFatPercent - inorganicSaltPercent) * 10) / 10;
  const proteinPercent = Math.round(Math.max(10, musclePercent - waterPercent + 0.1) * 10) / 10;
  const skeletalMusclePercent = Math.round(musclePercent * 0.605 * 10) / 10;
  const visceralFatIndex = Math.max(1, Math.min(25, Math.round(bodyFatPercent * 0.383)));
  const subcutaneousFatKg = Math.round(bodyFatMassKg * 0.88 * 10) / 10;
  const standardWeightKg = Math.round(22.96 * heightM * heightM * 10) / 10;
  const weightControlKg = Math.round((standardWeightKg - weightKg) * 10) / 10;
  const fatControlKg = Math.round(Math.min(0, standardWeightKg - weightKg) * 10) / 10;

  const prevLbm = prev.leanBodyMassKg || prev.weightKg * (1 - prev.bodyFatPercent / 100);
  const lbmRatio = prevLbm > 0 ? leanBodyMassKg / prevLbm : 1;
  const prevFat = prev.bodyFatMassKg || prev.weightKg * (prev.bodyFatPercent / 100);
  const fatRatio = prevFat > 0 ? bodyFatMassKg / prevFat : 1;
  const fatDiff = bodyFatPercent - prev.bodyFatPercent;

  const leftArmMuscle = Math.round(prev.segments.leftArm.muscleKg * lbmRatio * 100) / 100;
  const rightArmMuscle = Math.round(prev.segments.rightArm.muscleKg * lbmRatio * 100) / 100;
  const trunkMuscle = Math.round(prev.segments.trunk.muscleKg * lbmRatio * 100) / 100;
  const leftLegMuscle = Math.round(prev.segments.leftLeg.muscleKg * lbmRatio * 100) / 100;
  const rightLegMuscle = Math.round(prev.segments.rightLeg.muscleKg * lbmRatio * 100) / 100;

  const leftArmFat = Math.round((prev.segments.leftArm.fatKg || 1.8) * fatRatio * 10) / 10;
  const rightArmFat = Math.round((prev.segments.rightArm.fatKg || 1.8) * fatRatio * 10) / 10;
  const trunkFat = Math.round((prev.segments.trunk.fatKg || 15.2) * fatRatio * 10) / 10;
  const leftLegFat = Math.round((prev.segments.leftLeg.fatKg || 3.5) * fatRatio * 10) / 10;
  const rightLegFat = Math.round((prev.segments.rightLeg.fatKg || 3.7) * fatRatio * 10) / 10;

  const smi =
    Math.round(((leftArmMuscle + rightArmMuscle + leftLegMuscle + rightLegMuscle) / (heightM * heightM)) * 10) / 10;
  const healthScore = Math.max(45, Math.min(98, Math.round(95 - Math.max(0, bodyFatPercent - 15) * 1.7)));

  return {
    id: `camry-${Date.now()}`,
    date: getLocalISODate(),
    timestampLabel: new Date().toLocaleString('es-MX', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    userName: prev.userName || 'cristopher',
    heightCm,
    gender: prev.gender || 'Hombre',
    weightKg,
    bodyFatPercent,
    waterPercent,
    visceralFatIndex,
    boneMassKg,
    bmrKcal,
    bmi,
    bodyFatMassKg,
    skeletalMusclePercent,
    musclePercent,
    proteinPercent,
    inorganicSaltPercent,
    subcutaneousFatKg,
    leanBodyMassKg,
    smi,
    healthScore,
    standardWeightKg,
    weightControlKg,
    fatControlKg,
    muscleControlKg: 0,
    bodyType: bodyFatPercent > 28 ? 'Rellenito' : bodyFatPercent > 20 ? 'Fuerte' : 'Estándar',
    segments: {
      leftArm: {
        muscleKg: leftArmMuscle,
        fatPercent: Math.round(Math.max(4, prev.segments.leftArm.fatPercent + fatDiff * 0.85) * 10) / 10,
        fatKg: leftArmFat,
        muscleRatioPct: Math.round((prev.segments.leftArm.muscleRatioPct || 105.7) * lbmRatio * 10) / 10,
        fatRatioPct: Math.round((prev.segments.leftArm.fatRatioPct || 259.1) * fatRatio * 10) / 10,
        muscleStatus: 'Estándar',
        fatStatus: bodyFatPercent > 22 ? 'Alto' : 'Estándar',
      },
      rightArm: {
        muscleKg: rightArmMuscle,
        fatPercent: Math.round(Math.max(4, prev.segments.rightArm.fatPercent + fatDiff * 0.85) * 10) / 10,
        fatKg: rightArmFat,
        muscleRatioPct: Math.round((prev.segments.rightArm.muscleRatioPct || 103.5) * lbmRatio * 10) / 10,
        fatRatioPct: Math.round((prev.segments.rightArm.fatRatioPct || 259.6) * fatRatio * 10) / 10,
        muscleStatus: 'Estándar',
        fatStatus: bodyFatPercent > 22 ? 'Alto' : 'Estándar',
      },
      trunk: {
        muscleKg: trunkMuscle,
        fatPercent: Math.round(Math.max(5, prev.segments.trunk.fatPercent + fatDiff * 1.05) * 10) / 10,
        fatKg: trunkFat,
        muscleRatioPct: Math.round((prev.segments.trunk.muscleRatioPct || 97.1) * lbmRatio * 10) / 10,
        fatRatioPct: Math.round((prev.segments.trunk.fatRatioPct || 252.6) * fatRatio * 10) / 10,
        muscleStatus: 'Estándar',
        fatStatus: bodyFatPercent > 22 ? 'Alto' : 'Estándar',
      },
      leftLeg: {
        muscleKg: leftLegMuscle,
        fatPercent: Math.round(Math.max(5, prev.segments.leftLeg.fatPercent + fatDiff * 0.9) * 10) / 10,
        fatKg: leftLegFat,
        muscleRatioPct: Math.round((prev.segments.leftLeg.muscleRatioPct || 87.7) * lbmRatio * 10) / 10,
        fatRatioPct: Math.round((prev.segments.leftLeg.fatRatioPct || 191.3) * fatRatio * 10) / 10,
        muscleStatus: leftLegMuscle < 8.3 ? 'Bajo' : 'Estándar',
        fatStatus: bodyFatPercent > 22 ? 'Alto' : 'Estándar',
      },
      rightLeg: {
        muscleKg: rightLegMuscle,
        fatPercent: Math.round(Math.max(5, prev.segments.rightLeg.fatPercent + fatDiff * 0.9) * 10) / 10,
        fatKg: rightLegFat,
        muscleRatioPct: Math.round((prev.segments.rightLeg.muscleRatioPct || 88.9) * lbmRatio * 10) / 10,
        fatRatioPct: Math.round((prev.segments.rightLeg.fatRatioPct || 198.2) * fatRatio * 10) / 10,
        muscleStatus: rightLegMuscle < 8.3 ? 'Bajo' : 'Estándar',
        fatStatus: bodyFatPercent > 22 ? 'Alto' : 'Estándar',
      },
    },
  };
}

export function parseSamsungHealthText(
  rawText: string,
  prevWatch: WatchDailyMetrics
): Partial<WatchDailyMetrics> {
  return parseSamsungHealthDetailed(rawText, prevWatch).metrics;
}

export function parseSamsungHealthDetailed(
  rawText: string,
  prevWatch: WatchDailyMetrics
): Omit<SamsungHealthImportResult, 'extractedText' | 'success' | 'summaryMessage'> {
  const normalized = rawText.replace(/(\d{1,2})[.,](\d{3})/g, '$1$2').replace(/,/g, '.');
  const metrics: Partial<WatchDailyMetrics> = {};
  const fieldsDetected: string[] = [];

  let durationMin: number | undefined;
  let activeCalories: number | undefined;
  let avgHeartRate: number | undefined;
  let maxHeartRate: number | undefined;

  const hmsMatch = normalized.match(
    /(?:tiempo|duraci[oó]n|transcurrido|workout)?[\s\S]{0,25}?\b(\d{1,2}):(\d{2}):(\d{2})\b/i
  );
  if (hmsMatch) {
    const mins = Number(hmsMatch[1]) * 60 + Number(hmsMatch[2]) + (Number(hmsMatch[3]) >= 30 ? 1 : 0);
    if (mins >= 2 && mins <= 300) {
      durationMin = mins;
      fieldsDetected.push(`${durationMin} min`);
    }
  }
  if (!durationMin) {
    const mmssMatch = normalized.match(
      /(?:tiempo|duraci[oó]n|transcurrido|workout|ejercicio)[\s\S]{0,30}?\b(\d{1,3}):(\d{2})\b/i
    );
    if (mmssMatch) {
      const mins = Number(mmssMatch[1]) + (Number(mmssMatch[2]) >= 30 ? 1 : 0);
      if (mins >= 2 && mins <= 300) {
        durationMin = mins;
        fieldsDetected.push(`${durationMin} min`);
      }
    }
  }
  if (!durationMin) {
    const looseClock = normalized.match(/\b([1-9]\d?):([0-5]\d)\b/);
    if (looseClock) {
      const mins = Number(looseClock[1]) + (Number(looseClock[2]) >= 30 ? 1 : 0);
      if (mins >= 5 && mins <= 180) {
        durationMin = mins;
        fieldsDetected.push(`${durationMin} min`);
      }
    }
  }
  if (!durationMin) {
    const minsWord = normalized.match(/(\d{1,3})\s*(?:minutos|min\b|m\b)/i);
    if (minsWord) {
      const mins = Number(minsWord[1]);
      if (mins >= 3 && mins <= 240) {
        durationMin = mins;
        fieldsDetected.push(`${durationMin} min`);
      }
    }
  }

  const activeCalMatch = normalized.match(
    /(?:calor[ií]as\s*de\s*la\s*actividad|calor[ií]as\s*activas|calor[ií]as\s*entrenamiento|calor[ií]as\s*de\s*entrenamiento)[\s\S]{0,35}?(\d{2,4})/i
  );
  if (activeCalMatch) {
    const val = Number(activeCalMatch[1]);
    if (val >= 30 && val <= 3500) activeCalories = val;
  }
  if (!activeCalories) {
    const genCalMatch = normalized.match(
      /(?:calor[ií]as|calorias|kcal|quemadas|activas|calories|burned)[\s\S]{0,40}?(\d{2,4})/i
    );
    if (genCalMatch) {
      const val = Number(genCalMatch[1]);
      if (val >= 60 && val <= 3500) activeCalories = val;
    }
  }
  if (!activeCalories) {
    const suffixCalMatch = normalized.match(/(\d{2,4})[\s\S]{0,15}?(?:kcal|calor[ií]as|calorias|cal\b)/i);
    if (suffixCalMatch) {
      const val = Number(suffixCalMatch[1]);
      if (val >= 60 && val <= 3500) activeCalories = val;
    }
  }
  if (activeCalories) {
    metrics.activeCalories = activeCalories;
    fieldsDetected.push(`${activeCalories} kcal`);
  }

  const avgHrMatch = normalized.match(
    /(?:fc\s*media|fc\s*promedio|frecuencia\s*card[ií]aca\s*media|frecuencia\s*cardiaca\s*media|frecuencia\s*card[ií]aca|promedio|media|avg\s*hr|media\s*fc)[\s\S]{0,35}?(\d{2,3})/i
  );
  if (avgHrMatch) {
    const hr = Number(avgHrMatch[1]);
    if (hr >= 50 && hr <= 215) avgHeartRate = hr;
  }

  const maxHrMatch = normalized.match(
    /(?:fc\s*m[aá]x|m[aá]xima|max\s*hr|pico|m[aá]x)[\s\S]{0,35}?(\d{2,3})/i
  );
  if (maxHrMatch) {
    const hr = Number(maxHrMatch[1]);
    if (hr >= 60 && hr <= 225) maxHeartRate = hr;
  }

  const bpmMatches = [...normalized.matchAll(/(\d{2,3})\s*(?:bpm|lpm|ppm)/gi)]
    .map((m) => Number(m[1]))
    .filter((v) => v >= 50 && v <= 215);
  if (!avgHeartRate && bpmMatches.length > 0) avgHeartRate = bpmMatches[0];
  if (!maxHeartRate && bpmMatches.length >= 2) {
    const sorted = [...bpmMatches].sort((a, b) => a - b);
    avgHeartRate = sorted[0];
    maxHeartRate = sorted[sorted.length - 1];
  }

  if (avgHeartRate) {
    metrics.avgHeartRate = avgHeartRate;
    metrics.maxHeartRate = maxHeartRate ?? Math.max(prevWatch.maxHeartRate, Math.round(avgHeartRate * 1.15));
    fieldsDetected.push(`${avgHeartRate} bpm`);
  } else if (maxHeartRate) {
    metrics.maxHeartRate = maxHeartRate;
  }

  const stepsMatch =
    normalized.match(/(\d{3,5})\s*(?:pasos|steps)/i) ||
    normalized.match(/(?:pasos|steps)[^\d]{0,20}(\d{3,5})/i);
  if (stepsMatch) {
    const steps = Number(stepsMatch[1]);
    metrics.steps = steps;
    fieldsDetected.push(`${steps} pasos`);
  }

  const sleepScoreMatch = normalized.match(/(?:puntuaci[oó]n|score|sue[ñn]o)[^\d]{0,20}(\d{2,3})/i);
  if (sleepScoreMatch) {
    const score = Number(sleepScoreMatch[1]);
    if (score >= 20 && score <= 100) {
      metrics.sleepScore = score;
      fieldsDetected.push(`Sueño ${score}/100`);
    }
  }

  const sleepTimeMatch = normalized.match(/(\d)\s*h\s*(\d{1,2})\s*m/i);
  if (sleepTimeMatch) {
    const hrs = Math.round((Number(sleepTimeMatch[1]) + Number(sleepTimeMatch[2]) / 60) * 10) / 10;
    metrics.sleepHours = hrs;
    fieldsDetected.push(`${hrs}h sueño`);
  }

  return {
    metrics,
    durationMin,
    activeCalories,
    avgHeartRate,
    maxHeartRate,
    steps: metrics.steps,
    sleepScore: metrics.sleepScore,
    sleepHours: metrics.sleepHours,
    fieldsDetected,
  };
}

async function preprocessSamsungCaptureForOcr(file: File): Promise<string | File> {
  try {
    const bitmap = await createImageBitmap(file);
    const maxDim = 1280;
    let width = bitmap.width;
    let height = bitmap.height;
    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, width, height);
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    let lumSum = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 32) {
      lumSum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      count++;
    }
    if (lumSum / Math.max(1, count) < 125) {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255 - data[i];
        data[i + 1] = 255 - data[i + 1];
        data[i + 2] = 255 - data[i + 2];
      }
      ctx.putImageData(imgData, 0, 0);
    }
    return canvas.toDataURL('image/png');
  } catch {
    return file;
  }
}

export async function parseSamsungHealthFile(
  file: File,
  prevWatch: WatchDailyMetrics,
  onProgress?: (msg: string) => void
): Promise<SamsungHealthImportResult> {
  if (
    file.type.startsWith('text/') ||
    file.name.endsWith('.txt') ||
    file.name.endsWith('.csv') ||
    file.name.endsWith('.json')
  ) {
    onProgress?.('Leyendo archivo de Samsung Health...');
    const text = await file.text();
    const detail = parseSamsungHealthDetailed(text, prevWatch);
    const success = detail.fieldsDetected.length > 0;
    return {
      metrics: detail.metrics,
      durationMin: detail.durationMin,
      activeCalories: detail.activeCalories,
      avgHeartRate: detail.avgHeartRate,
      maxHeartRate: detail.maxHeartRate,
      extractedText: text,
      success,
      fieldsDetected: detail.fieldsDetected,
      summaryMessage: success
        ? `✓ Detectado de tu archivo: ${detail.fieldsDetected.join(' · ')}`
        : '⚠️ No se reconocieron campos de entrenamiento en el archivo.',
    };
  }

  const apiKey = getEffectiveGeminiKey();
  if (typeof navigator === 'undefined' || navigator.onLine !== false) {
    onProgress?.('Analizando captura con Google Gemini Vision IA...');
    try {
      const { base64, mimeType } = await fileToBase64(file);
      const rawJson = await callGeminiVisionJSON(
        apiKey,
        `Analiza esta captura de pantalla de Samsung Health / Galaxy Watch de Cristopher.
Puede ser una captura de:
A) "Detalles de entrenamiento" (ejemplo: Insanity, cardio, circuito, pesas).
B) "Actividad diaria / Resumen del día" (pasos totales, calorías activas del día, tiempo activo).
C) "Sueño" (puntuación de sueño, horas dormidas).

Lee con extrema atención los números y etiquetas (incluso con fuentes cursivas, manuscritas o estilizadas de Samsung):
1. "Duración total" o tiempo de ejercicio: extrae los minutos enteros de entrenamiento (ejemplo: si dice "38:42", extrae 38; si dice "45:10", extrae 45; si dice "59 min", extrae 59; si no hay sesión pon 0).
2. "Calorías activas", "Calorías de la actividad" o "Calorías entrenamiento": extrae ÚNICAMENTE las calorías activas en kcal (ejemplo: si dice "Calorías de la actividad 306 kcal", extrae 306. ¡NUNCA extraigas el "Total de calorías quemadas" como 1,398 kcal porque incluye el metabolismo basal en reposo!). Si es pantalla de entrenamiento, extrae las calorías de la sesión (ejemplo: 405 kcal).
3. "Prom. rit. card." o "Frecuencia cardíaca promedio": extrae las pulsaciones en ppm / bpm (ejemplo: si dice "141 ppm", extrae 141).
4. "Rit. card. máx." o "Frecuencia cardíaca máxima": extrae el pulso máximo en ppm / bpm (ejemplo: si dice "177 ppm", extrae 177).
5. "Pasos" o "Conteo de pasos": extrae los pasos enteros del día si aparecen (ejemplo: si dice "8,450 pasos" o "10.815 pasos", extrae 8450 o 10815).
6. "Puntuación de sueño" o "Score": número entero del 0 al 100 si aparece (ejemplo: si dice "82", extrae 82).
7. "Tiempo de sueño": horas de sueño en decimal (ejemplo: si dice "7 h 25 min", extrae 7.4).

REGLA ANTI-SOBREESCRITURA: Si alguno de estos datos NO aparece visible en la captura (por ejemplo, si es el anillo diario y no muestra FC o Sueño), devuelve null o 0 para ese campo; NUNCA inventes datos.

Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura (sin formato markdown ni texto adicional):
{
  "durationMinutes": 38,
  "activeCalories": 405,
  "avgHeartRate": 141,
  "maxHeartRate": 177,
  "steps": 8450,
  "sleepScore": 82,
  "sleepHours": 7.4,
  "summary": "Sesión: 38 min, 405 kcal quemadas, FC Prom: 141 ppm, FC Máx: 177 ppm"
}`,
        base64,
        mimeType
      );

      if (rawJson) {
        let cleaned = rawJson.replace(/```json|```/g, '').trim();
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) cleaned = match[0];
        const parsed = JSON.parse(cleaned) as {
          durationMinutes?: number;
          activeCalories?: number;
          avgHeartRate?: number;
          maxHeartRate?: number;
          steps?: number;
          sleepScore?: number;
          sleepHours?: number;
          summary?: string;
        };
        const durationMin =
          typeof parsed.durationMinutes === 'number' && parsed.durationMinutes > 0
            ? Math.round(parsed.durationMinutes)
            : undefined;
        const activeCalories =
          typeof parsed.activeCalories === 'number' && parsed.activeCalories > 0
            ? Math.round(parsed.activeCalories)
            : undefined;
        const avgHeartRate =
          typeof parsed.avgHeartRate === 'number' && parsed.avgHeartRate > 0
            ? Math.round(parsed.avgHeartRate)
            : undefined;
        const maxHeartRate =
          typeof parsed.maxHeartRate === 'number' && parsed.maxHeartRate > 0
            ? Math.round(parsed.maxHeartRate)
            : undefined;
        const steps =
          typeof parsed.steps === 'number' && parsed.steps > 0
            ? Math.round(parsed.steps)
            : undefined;
        const sleepScore =
          typeof parsed.sleepScore === 'number' && parsed.sleepScore > 0
            ? Math.min(100, Math.round(parsed.sleepScore))
            : undefined;
        const sleepHours =
          typeof parsed.sleepHours === 'number' && parsed.sleepHours > 0
            ? Math.round(parsed.sleepHours * 10) / 10
            : undefined;

        const fieldsDetected: string[] = [];
        if (durationMin !== undefined && durationMin > 0) fieldsDetected.push(`${durationMin} min`);
        if (activeCalories !== undefined && activeCalories > 0)
          fieldsDetected.push(`${activeCalories} kcal`);
        if (avgHeartRate !== undefined && avgHeartRate > 0)
          fieldsDetected.push(`FC Prom: ${avgHeartRate} bpm`);
        if (maxHeartRate !== undefined && maxHeartRate > 0)
          fieldsDetected.push(`FC Máx: ${maxHeartRate} bpm`);
        if (steps !== undefined && steps > 0) fieldsDetected.push(`${steps.toLocaleString()} pasos`);
        if (sleepScore !== undefined && sleepScore > 0)
          fieldsDetected.push(`Sueño: ${sleepScore}/100`);

        if (fieldsDetected.length > 0) {
          return {
            metrics: {
              activeCalories: activeCalories ?? prevWatch.activeCalories,
              avgHeartRate: avgHeartRate ?? prevWatch.avgHeartRate,
              maxHeartRate: maxHeartRate ?? prevWatch.maxHeartRate,
              steps: steps ?? prevWatch.steps,
              sleepScore: sleepScore ?? prevWatch.sleepScore,
              sleepHours: sleepHours ?? prevWatch.sleepHours,
            },
            durationMin,
            activeCalories,
            avgHeartRate,
            maxHeartRate,
            extractedText: parsed.summary || rawJson,
            success: true,
            fieldsDetected,
            summaryMessage: `✓ Detectado con Google Gemini Vision: ${fieldsDetected.join(' · ')}`,
          };
        }
      }
    } catch {
      // fallback below
    }
  }

  onProgress?.('Preparando captura para OCR local...');
  try {
    if (!window.Tesseract) {
      onProgress?.('Cargando motor OCR neural...');
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('No se pudo cargar el motor OCR'));
        document.head.appendChild(script);
      });
    }
    if (window.Tesseract) {
      onProgress?.('Optimizando contraste de la captura Samsung Health...');
      const processedImg = await preprocessSamsungCaptureForOcr(file);
      onProgress?.('Escaneando números de Samsung Health...');
      const ocrRes = await window.Tesseract.recognize(processedImg, 'spa+eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            onProgress?.(`Leyendo captura Samsung Health: ${Math.round(m.progress * 100)}%...`);
          }
        },
      });
      const text = ocrRes.data.text || '';
      const detail = parseSamsungHealthDetailed(text, prevWatch);
      const success = detail.fieldsDetected.length > 0;
      return {
        metrics: detail.metrics,
        durationMin: detail.durationMin,
        activeCalories: detail.activeCalories,
        avgHeartRate: detail.avgHeartRate,
        maxHeartRate: detail.maxHeartRate,
        extractedText: text,
        success,
        fieldsDetected: detail.fieldsDetected,
        summaryMessage: success
          ? `✓ Detectado de tu captura: ${detail.fieldsDetected.join(' · ')}`
          : '⚠️ No se detectaron números claros en la captura. Ingresa los valores manualmente o usa una captura más nítida.',
      };
    }
  } catch {
    // ignore
  }

  return {
    metrics: {},
    extractedText: '',
    success: false,
    fieldsDetected: [],
    summaryMessage:
      '⚠️ No se pudo procesar la imagen con OCR. Ingresa los datos manualmente.',
  };
}

export function parseMovingLifeText(
  rawText: string,
  prevRecord: CamryBiometricRecord
): CamryBiometricRecord {
  const normalized = rawText.replace(/,/g, '.');
  const extractNum = (regex: RegExp, min: number, max: number): number | null => {
    const m = normalized.match(regex);
    if (!m || !m[1]) return null;
    const val = Number(m[1]);
    return Number.isNaN(val) || val < min || val > max ? null : val;
  };

  const weightKg =
    extractNum(/Peso\s*\(\s*kg\s*\)[^\d]{0,20}(\d{2,3}(?:\.\d+)?)/i, 35, 190) ??
    extractNum(/(\d{2,3}\.\d)\s*kg/i, 35, 190) ??
    prevRecord.weightKg;
  const bodyFatPercent =
    extractNum(/Grasa\s*corporal\s*\(\s*%\s*\)[^\d]{0,20}(\d{1,2}(?:\.\d+)?)/i, 4, 60) ??
    extractNum(/(?:grasa|fat)[^\d]{0,15}(\d{1,2}\.\d)\s*%/i, 4, 60) ??
    prevRecord.bodyFatPercent;
  const inorganicSaltPercent = extractNum(/Sal\s*inorg[aá]nica\s*\(\s*%\s*\)[^\d]{0,20}(\d(?:\.\d+)?)/i, 2, 10);
  const proteinPercent = extractNum(/Prote[ií]nas\s*\(\s*%\s*\)[^\d]{0,20}(\d{1,2}(?:\.\d+)?)/i, 5, 30);
  const waterPercent =
    extractNum(/Agua\s*\(\s*%\s*\)[^\d]{0,20}(\d{2}(?:\.\d+)?)/i, 30, 80) ??
    extractNum(/(?:agua|water)[^\d]{0,15}(\d{2}\.\d)\s*%/i, 30, 80);
  const musclePercent = extractNum(/Muscular\s*\(\s*%\s*\)[^\d]{0,20}(\d{2}(?:\.\d+)?)/i, 30, 90);
  const skeletalMusclePercent = extractNum(
    /M[uú]sculo\s*esquel[eé]tico\s*\(\s*%\s*\)[^\d]{0,20}(\d{2}(?:\.\d+)?)/i,
    20,
    70
  );
  const bodyFatMassKg = extractNum(/Masa\s*de\s*grasa\s*corporal\s*\(\s*kg\s*\)[^\d]{0,25}(\d{1,2}(?:\.\d+)?)/i, 2, 95);
  const bmi = extractNum(/IMC[^\d]{0,25}(\d{2}(?:\.\d+)?)/i, 12, 55);
  const visceralFatIndex = extractNum(/visceral[^\d]{0,25}(\d{1,2})/i, 1, 30);
  const subcutaneousFatKg = extractNum(/Grasa\s*subcut[aá]nea\s*\(\s*kg\s*\)[^\d]{0,25}(\d{1,2}(?:\.\d+)?)/i, 2, 80);
  const bmrKcal =
    extractNum(/IMB\s*\(\s*kcal\s*\)[^\d]{0,25}(\d{4})/i, 900, 3500) ??
    extractNum(/(\d{4})\s*kcal/i, 900, 3500);
  const leanBodyMassKg = extractNum(/Masa\s*magra\s*\(\s*kg\s*\)[^\d]{0,25}(\d{2}(?:\.\d+)?)/i, 25, 120);
  const smi = extractNum(/SMI[^\d]{0,45}(\d{1,2}\.\d)/i, 4, 16);
  const healthScore = extractNum(/puntuaci[oó]n\s*de\s*salud[^\d]{0,25}(\d{2,3})/i, 20, 100);
  const standardWeightKg = extractNum(/Peso\s*est[aá]ndar[^\d]{0,20}(\d{2}(?:\.\d+)?)/i, 40, 110);

  const rec = calculateEstimatedCamryRecord(weightKg, bodyFatPercent, prevRecord);
  if (inorganicSaltPercent !== null) {
    rec.inorganicSaltPercent = inorganicSaltPercent;
    rec.boneMassKg = Math.round(((weightKg * inorganicSaltPercent) / 100) * 10) / 10;
  }
  if (proteinPercent !== null) rec.proteinPercent = proteinPercent;
  if (waterPercent !== null) rec.waterPercent = waterPercent;
  if (musclePercent !== null) rec.musclePercent = musclePercent;
  if (skeletalMusclePercent !== null) rec.skeletalMusclePercent = skeletalMusclePercent;
  if (bodyFatMassKg !== null) rec.bodyFatMassKg = bodyFatMassKg;
  if (bmi !== null) rec.bmi = bmi;
  if (visceralFatIndex !== null) rec.visceralFatIndex = visceralFatIndex;
  if (subcutaneousFatKg !== null) rec.subcutaneousFatKg = subcutaneousFatKg;
  if (bmrKcal !== null) rec.bmrKcal = bmrKcal;
  if (leanBodyMassKg !== null) rec.leanBodyMassKg = leanBodyMassKg;
  if (smi !== null) rec.smi = smi;
  if (healthScore !== null) rec.healthScore = healthScore;
  if (standardWeightKg !== null) {
    rec.standardWeightKg = standardWeightKg;
    rec.weightControlKg = Math.round((standardWeightKg - weightKg) * 10) / 10;
    rec.fatControlKg = Math.round(Math.min(0, standardWeightKg - weightKg) * 10) / 10;
  }

  const segVals = [...normalized.matchAll(/(\d{1,2}\.\d{2})\s*kg/gi)].map((m) => Number(m[1]));
  if (segVals.length >= 5) {
    const arms = segVals.filter((v) => v >= 1.5 && v <= 6.5);
    const trunk = segVals.filter((v) => v >= 15 && v <= 40);
    const legs = segVals.filter((v) => v >= 6 && v <= 14.5);
    if (arms.length >= 2) {
      rec.segments.leftArm.muscleKg = arms[0];
      rec.segments.rightArm.muscleKg = arms[1];
    }
    if (trunk.length >= 1) {
      rec.segments.trunk.muscleKg = trunk[0];
    }
    if (legs.length >= 2) {
      rec.segments.leftLeg.muscleKg = legs[0];
      rec.segments.rightLeg.muscleKg = legs[1];
    }
  }

  return rec;
}

export async function parseMovingLifeFile(
  file: File,
  prevRecord: CamryBiometricRecord,
  onProgress?: (msg: string) => void
): Promise<MovingLifeImportResult> {
  if (
    file.type.startsWith('text/') ||
    file.name.endsWith('.txt') ||
    file.name.endsWith('.csv') ||
    file.name.endsWith('.json')
  ) {
    onProgress?.('Leyendo archivo de datos MovingLife...');
    const text = await file.text();
    return { record: parseMovingLifeText(text, prevRecord), extractedText: text };
  }

  const previewUrl = URL.createObjectURL(file);
  const apiKey = getEffectiveGeminiKey();

  if (typeof navigator === 'undefined' || navigator.onLine !== false) {
    onProgress?.('Analizando Informe MovingLife con Google Gemini Vision IA...');
    try {
      const { base64, mimeType } = await fileToBase64(file);
      const rawJson = await callGeminiVisionJSON(
        apiKey,
        `Analiza esta fotografía o captura del "Informe de análisis de composición corporal" de báscula de 8 electrodos (MovingLife / Camry) de Cristopher.
Extrae con rigor clínico los siguientes valores numéricos:
- weightKg: Peso en kg (ej: 83.3)
- bodyFatPercent: Porcentaje de grasa corporal % (ej: 33.9)
- bodyFatMassKg: Masa grasa en kg
- leanBodyMassKg: Masa muscular / magra en kg (ej: 55.0)
- bmrKcal: Tasa metabólica basal IMB en kcal (ej: 1558)
- visceralFatIndex: Grasa visceral (ej: 13)
- waterPercent: Agua corporal % (ej: 48.5)
- boneMassKg: Masa ósea en kg
- proteinKg: Proteína en kg
- muscleLeftArm: Músculo brazo izquierdo en kg
- muscleRightArm: Músculo brazo derecho en kg
- muscleTrunk: Músculo tronco en kg
- muscleLeftLeg: Músculo pierna izquierda en kg
- muscleRightLeg: Músculo pierna derecha en kg

Devuelve ÚNICAMENTE un objeto JSON válido con esos campos numéricos (sin markdown).`,
        base64,
        mimeType
      );

      if (rawJson) {
        let cleaned = rawJson.replace(/```json|```/g, '').trim();
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) cleaned = match[0];
        const parsed = JSON.parse(cleaned) as {
          weightKg?: number;
          bodyFatPercent?: number;
          bodyFatMassKg?: number;
          leanBodyMassKg?: number;
          bmrKcal?: number;
          visceralFatIndex?: number;
          waterPercent?: number;
          boneMassKg?: number;
          proteinKg?: number;
          muscleLeftArm?: number;
          muscleRightArm?: number;
          muscleTrunk?: number;
          muscleLeftLeg?: number;
          muscleRightLeg?: number;
        };

        if (typeof parsed.weightKg === 'number' && typeof parsed.bodyFatPercent === 'number') {
          const base = calculateEstimatedCamryRecord(
            parsed.weightKg,
            parsed.bodyFatPercent,
            prevRecord
          );
          const weight = Math.round(parsed.weightKg * 10) / 10;
          const fatPct = Math.round(parsed.bodyFatPercent * 10) / 10;
          const record: CamryBiometricRecord = {
            ...base,
            id: `camry-${Date.now()}`,
            date: getLocalISODate(),
            timestampLabel: new Date().toLocaleString('es-MX', {
              month: 'short',
              day: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
            userName: 'cristopher',
            weightKg: weight,
            bodyFatPercent: fatPct,
            bodyFatMassKg:
              Math.round((parsed.bodyFatMassKg ?? weight * (fatPct / 100)) * 10) / 10,
            leanBodyMassKg:
              Math.round((parsed.leanBodyMassKg ?? weight * (1 - fatPct / 100)) * 10) / 10,
            bmrKcal: Math.round(parsed.bmrKcal || base.bmrKcal),
            visceralFatIndex: Math.round(parsed.visceralFatIndex || base.visceralFatIndex),
            waterPercent: Math.round((parsed.waterPercent || base.waterPercent) * 10) / 10,
            boneMassKg: Math.round((parsed.boneMassKg || base.boneMassKg) * 10) / 10,
            proteinPercent:
              Math.round(
                (parsed.proteinKg
                  ? (parsed.proteinKg / weight) * 100
                  : base.proteinPercent ?? 16.5) * 10
              ) / 10,
            bodyType: 'Recomposición Necesaria (Grasa Alta, Piernas Bajas)',
            segments: {
              leftArm: {
                ...base.segments.leftArm,
                muscleKg:
                  Math.round((parsed.muscleLeftArm || base.segments.leftArm.muscleKg) * 100) / 100,
                muscleStatus: 'Estándar',
              },
              rightArm: {
                ...base.segments.rightArm,
                muscleKg:
                  Math.round((parsed.muscleRightArm || base.segments.rightArm.muscleKg) * 100) /
                  100,
                muscleStatus: 'Estándar',
              },
              trunk: {
                ...base.segments.trunk,
                muscleKg:
                  Math.round((parsed.muscleTrunk || base.segments.trunk.muscleKg) * 100) / 100,
                muscleStatus: 'Estándar',
              },
              leftLeg: {
                ...base.segments.leftLeg,
                muscleKg:
                  Math.round((parsed.muscleLeftLeg || base.segments.leftLeg.muscleKg) * 100) / 100,
                muscleStatus: 'Bajo',
              },
              rightLeg: {
                ...base.segments.rightLeg,
                muscleKg:
                  Math.round((parsed.muscleRightLeg || base.segments.rightLeg.muscleKg) * 100) /
                  100,
                muscleStatus: 'Bajo',
              },
            },
          };

          return {
            record,
            previewUrl,
            extractedText: `Detectado con Google Gemini Vision: ${record.weightKg} kg · ${record.bodyFatPercent}% grasa · ${record.leanBodyMassKg} kg masa magra · IMB ${record.bmrKcal} kcal`,
          };
        }
      }
    } catch {
      // fallback below
    }
  }

  onProgress?.('Analizando imagen del Informe MovingLife con OCR local...');
  try {
    if (!window.Tesseract) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('No se pudo cargar el motor OCR'));
        document.head.appendChild(script);
      });
    }
    if (window.Tesseract) {
      const ocrRes = await window.Tesseract.recognize(file, 'spa+eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            onProgress?.(`Escaneando Informe MovingLife: ${Math.round(m.progress * 100)}%...`);
          }
        },
      });
      const text = ocrRes.data.text || '';
      return {
        record: parseMovingLifeText(text, prevRecord),
        previewUrl,
        extractedText: text,
      };
    }
  } catch {
    // ignore
  }

  return {
    record: calculateEstimatedCamryRecord(prevRecord.weightKg, prevRecord.bodyFatPercent, prevRecord),
    previewUrl,
    extractedText: 'Imagen cargada en modo local.',
  };
}
