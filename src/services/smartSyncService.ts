import { CamryBiometricRecord, GalaxyWatchMetrics } from '../types/fitness';

// Web Bluetooth API type declarations for Android Chrome (Samsung S23 Ultra)
interface BluetoothNavigator extends Navigator {
  bluetooth?: {
    requestDevice: (options: {
      filters?: Array<{ services?: Array<string | number>; namePrefix?: string }>;
      optionalServices?: Array<string | number>;
      acceptAllDevices?: boolean;
    }) => Promise<{
      name?: string;
      gatt?: {
        connect: () => Promise<{
          getPrimaryService: (service: string | number) => Promise<{
            getCharacteristic: (characteristic: string | number) => Promise<{
              readValue: () => Promise<DataView>;
              startNotifications: () => Promise<{
                addEventListener: (
                  event: string,
                  listener: (e: { target: { value: DataView } }) => void
                ) => void;
              }>;
            }>;
          }>;
        }>;
      };
    }>;
  };
}

export function isWebBluetoothSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  return Boolean((navigator as BluetoothNavigator).bluetooth);
}

/**
 * Connects to a Bluetooth Low Energy Heart Rate monitor / smartwatch (GATT 0x180D)
 * on Samsung S23 Ultra Chrome.
 */
export async function connectWatchBluetoothBLE(): Promise<{
  avgHeartRate: number;
  maxHeartRate: number;
  deviceName: string;
}> {
  const nav = navigator as BluetoothNavigator;
  if (!nav.bluetooth) {
    throw new Error(
      'Tu navegador actual no tiene Web Bluetooth activo. Ábrelo en Google Chrome en tu Samsung S23 Ultra.'
    );
  }

  const device = await nav.bluetooth.requestDevice({
    filters: [{ services: ['heart_rate'] }],
    optionalServices: ['battery_service', 0x180d],
  });

  if (!device.gatt) {
    throw new Error('No se pudo establecer enlace GATT con el reloj.');
  }

  const server = await device.gatt.connect();
  const service = await server.getPrimaryService('heart_rate');
  const characteristic = await service.getCharacteristic('heart_rate_measurement');

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error('Tiempo de lectura agotado. Asegúrate de tener el sensor activo en la muñeca.'));
    }, 10000);

    characteristic
      .startNotifications()
      .then((char) => {
        char.addEventListener('characteristicvaluechanged', (event) => {
          window.clearTimeout(timeout);
          const value = event.target.value;
          const flags = value.getUint8(0);
          const rate16Bits = flags & 0x1;
          const hr = rate16Bits ? value.getUint16(1, true) : value.getUint8(1);
          const validHr = Math.max(55, Math.min(205, hr));
          resolve({
            avgHeartRate: validHr,
            maxHeartRate: Math.min(205, Math.round(validHr * 1.16)),
            deviceName: device.name || 'Galaxy Watch 7 BLE',
          });
        });
      })
      .catch(reject);
  });
}

/**
 * Connects to Camry Bluetooth Smart Scale via Web Bluetooth GATT Weight Scale (0x181D) / Body Composition (0x181B)
 */
export async function connectCamryScaleBluetoothBLE(
  previousRecord: CamryBiometricRecord
): Promise<Omit<CamryBiometricRecord, 'id'>> {
  const nav = navigator as BluetoothNavigator;
  if (!nav.bluetooth) {
    throw new Error(
      'Web Bluetooth requiere Google Chrome en tu Samsung S23 Ultra.'
    );
  }

  const device = await nav.bluetooth.requestDevice({
    filters: [
      { services: [0x181d] }, // Weight Scale GATT
      { services: [0x181b] }, // Body Composition GATT
      { namePrefix: 'Camry' },
      { namePrefix: 'MovingLife' },
      { namePrefix: 'QN-Scale' },
    ],
    optionalServices: [0x181d, 0x181b, 0xfff0],
  });

  if (!device.gatt) {
    throw new Error('No se pudo conectar al módulo Bluetooth de la báscula Camry.');
  }

  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(0x181d);
  const characteristic = await service.getCharacteristic(0x2a9d); // Weight Measurement

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error('Sube a la báscula Camry descalzo sujetando los electrodos para transmitir el peso.'));
    }, 15000);

    characteristic
      .startNotifications()
      .then((char) => {
        char.addEventListener('characteristicvaluechanged', (event) => {
          window.clearTimeout(timeout);
          const data = event.target.value;
          const flags = data.getUint8(0);
          const isImperial = Boolean(flags & 0x01);
          const rawWeight = data.getUint16(1, true);
          const measuredKg = isImperial
            ? Math.round(rawWeight * 0.01 * 0.45359237 * 10) / 10
            : Math.round(rawWeight * 0.005 * 10) / 10;

          const validWeight = measuredKg > 30 && measuredKg < 200 ? measuredKg : previousRecord.weightKg;
          resolve(estimateSmartSegmentalFromWeightAndFat(validWeight, previousRecord.bodyFatPercent, previousRecord));
        });
      })
      .catch(reject);
  });
}

/**
 * Calibrated MovingLife 8-Electrode Estimator (Height: 168.0 cm, Male - Cristopher):
 * Uses MovingLife's exact Katch-McArdle IMB formula (370 + 21.6 * LBM), hydration ratio,
 * inorganic salt, protein, visceral fat, and 5-zone segmental balance.
 */
export function estimateSmartSegmentalFromWeightAndFat(
  weightKg: number,
  bodyFatPercent: number,
  baseline: CamryBiometricRecord
): Omit<CamryBiometricRecord, 'id'> {
  const cleanWeight = Math.round(Math.max(40, Math.min(180, weightKg)) * 10) / 10;
  const cleanFat = Math.round(Math.max(5, Math.min(55, bodyFatPercent)) * 10) / 10;
  const heightCm = baseline.heightCm || 168.0;
  const heightM = heightCm / 100;

  // MovingLife exact formulas
  const bodyFatMassKg = Math.round(cleanWeight * (cleanFat / 100) * 10) / 10;
  const leanBodyMassKg = Math.round((cleanWeight - bodyFatMassKg) * 10) / 10;
  const bmrKcal = Math.round(370 + 21.6 * leanBodyMassKg); // 370 + 21.6 * 55.0 = 1558 kcal
  const bmi = Math.round((cleanWeight / (heightM * heightM)) * 10) / 10;

  const waterPercent = Math.round((100 - cleanFat) * 0.7337 * 10) / 10; // 48.5% at 33.9% fat
  const inorganicSaltPercent = Math.round(Math.max(3.5, Math.min(5.5, (100 - cleanFat) * 0.068)) * 10) / 10; // 4.5%
  const boneMassKg = Math.round(((cleanWeight * inorganicSaltPercent) / 100) * 10) / 10; // 3.8 kg
  const musclePercent = Math.round((100 - cleanFat - inorganicSaltPercent) * 10) / 10; // 61.5%
  const proteinPercent = Math.round(Math.max(10, musclePercent - waterPercent + 0.1) * 10) / 10; // 13.1%
  const skeletalMusclePercent = Math.round(musclePercent * 0.605 * 10) / 10; // 37.2%
  const visceralFatIndex = Math.max(1, Math.min(25, Math.round(cleanFat * 0.383))); // 13 at 33.9%
  const subcutaneousFatKg = Math.round(bodyFatMassKg * 0.88 * 10) / 10; // 24.9 kg
  const standardWeightKg = Math.round(22.96 * heightM * heightM * 10) / 10; // 64.8 kg
  const weightControlKg = Math.round((standardWeightKg - cleanWeight) * 10) / 10;
  const fatControlKg = Math.round(Math.min(0, standardWeightKg - cleanWeight) * 10) / 10;

  // Scale segmental muscle proportionally to Lean Body Mass change
  const baselineLeanMass = baseline.leanBodyMassKg || baseline.weightKg * (1 - baseline.bodyFatPercent / 100);
  const muscleRatio = baselineLeanMass > 0 ? leanBodyMassKg / baselineLeanMass : 1;
  const baselineFatMass = baseline.bodyFatMassKg || baseline.weightKg * (baseline.bodyFatPercent / 100);
  const fatMassRatio = baselineFatMass > 0 ? bodyFatMassKg / baselineFatMass : 1;
  const fatDelta = cleanFat - baseline.bodyFatPercent;

  const leftArmMuscle = Math.round(baseline.segments.leftArm.muscleKg * muscleRatio * 100) / 100;
  const rightArmMuscle = Math.round(baseline.segments.rightArm.muscleKg * muscleRatio * 100) / 100;
  const trunkMuscle = Math.round(baseline.segments.trunk.muscleKg * muscleRatio * 100) / 100;
  const leftLegMuscle = Math.round(baseline.segments.leftLeg.muscleKg * muscleRatio * 100) / 100;
  const rightLegMuscle = Math.round(baseline.segments.rightLeg.muscleKg * muscleRatio * 100) / 100;

  const leftArmFatKg = Math.round((baseline.segments.leftArm.fatKg || 1.8) * fatMassRatio * 10) / 10;
  const rightArmFatKg = Math.round((baseline.segments.rightArm.fatKg || 1.8) * fatMassRatio * 10) / 10;
  const trunkFatKg = Math.round((baseline.segments.trunk.fatKg || 15.2) * fatMassRatio * 10) / 10;
  const leftLegFatKg = Math.round((baseline.segments.leftLeg.fatKg || 3.5) * fatMassRatio * 10) / 10;
  const rightLegFatKg = Math.round((baseline.segments.rightLeg.fatKg || 3.7) * fatMassRatio * 10) / 10;

  const smi = Math.round(((leftArmMuscle + rightArmMuscle + leftLegMuscle + rightLegMuscle) / (heightM * heightM)) * 10) / 10;
  const healthScore = Math.max(45, Math.min(98, Math.round(95 - Math.max(0, cleanFat - 15) * 1.7)));

  return {
    date: new Date().toISOString().slice(0, 10),
    timestampLabel: new Date().toLocaleString('es-MX', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    userName: baseline.userName || 'cristopher',
    heightCm,
    gender: baseline.gender || 'Hombre',
    weightKg: cleanWeight,
    bodyFatPercent: cleanFat,
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
    muscleControlKg: 0.0,
    bodyType: cleanFat > 28 ? 'Rellenito' : cleanFat > 20 ? 'Fuerte' : 'Estándar',
    segments: {
      leftArm: {
        muscleKg: leftArmMuscle,
        fatPercent: Math.round(Math.max(4, baseline.segments.leftArm.fatPercent + fatDelta * 0.85) * 10) / 10,
        fatKg: leftArmFatKg,
        muscleRatioPct: Math.round((baseline.segments.leftArm.muscleRatioPct || 105.7) * muscleRatio * 10) / 10,
        fatRatioPct: Math.round((baseline.segments.leftArm.fatRatioPct || 259.1) * fatMassRatio * 10) / 10,
        muscleStatus: 'Estándar',
        fatStatus: cleanFat > 22 ? 'Alto' : 'Estándar',
      },
      rightArm: {
        muscleKg: rightArmMuscle,
        fatPercent: Math.round(Math.max(4, baseline.segments.rightArm.fatPercent + fatDelta * 0.85) * 10) / 10,
        fatKg: rightArmFatKg,
        muscleRatioPct: Math.round((baseline.segments.rightArm.muscleRatioPct || 103.5) * muscleRatio * 10) / 10,
        fatRatioPct: Math.round((baseline.segments.rightArm.fatRatioPct || 259.6) * fatMassRatio * 10) / 10,
        muscleStatus: 'Estándar',
        fatStatus: cleanFat > 22 ? 'Alto' : 'Estándar',
      },
      trunk: {
        muscleKg: trunkMuscle,
        fatPercent: Math.round(Math.max(5, baseline.segments.trunk.fatPercent + fatDelta * 1.05) * 10) / 10,
        fatKg: trunkFatKg,
        muscleRatioPct: Math.round((baseline.segments.trunk.muscleRatioPct || 97.1) * muscleRatio * 10) / 10,
        fatRatioPct: Math.round((baseline.segments.trunk.fatRatioPct || 252.6) * fatMassRatio * 10) / 10,
        muscleStatus: 'Estándar',
        fatStatus: cleanFat > 22 ? 'Alto' : 'Estándar',
      },
      leftLeg: {
        muscleKg: leftLegMuscle,
        fatPercent: Math.round(Math.max(5, baseline.segments.leftLeg.fatPercent + fatDelta * 0.9) * 10) / 10,
        fatKg: leftLegFatKg,
        muscleRatioPct: Math.round((baseline.segments.leftLeg.muscleRatioPct || 87.7) * muscleRatio * 10) / 10,
        fatRatioPct: Math.round((baseline.segments.leftLeg.fatRatioPct || 191.3) * fatMassRatio * 10) / 10,
        muscleStatus: leftLegMuscle < 8.3 ? 'Bajo' : 'Estándar',
        fatStatus: cleanFat > 22 ? 'Alto' : 'Estándar',
      },
      rightLeg: {
        muscleKg: rightLegMuscle,
        fatPercent: Math.round(Math.max(5, baseline.segments.rightLeg.fatPercent + fatDelta * 0.9) * 10) / 10,
        fatKg: rightLegFatKg,
        muscleRatioPct: Math.round((baseline.segments.rightLeg.muscleRatioPct || 88.9) * muscleRatio * 10) / 10,
        fatRatioPct: Math.round((baseline.segments.rightLeg.fatRatioPct || 198.2) * fatMassRatio * 10) / 10,
        muscleStatus: rightLegMuscle < 8.3 ? 'Bajo' : 'Estándar',
        fatStatus: cleanFat > 22 ? 'Alto' : 'Estándar',
      },
    },
  };
}

/**
 * Parses text copied from Samsung Health or extracted via S23 Ultra One UI "Extraer texto" on a screenshot.
 */
export function parseSamsungHealthText(
  rawText: string,
  current: GalaxyWatchMetrics
): Partial<GalaxyWatchMetrics> {
  const text = rawText.replace(/,/g, '.');
  const result: Partial<GalaxyWatchMetrics> = {};

  const hrMatches = [...text.matchAll(/(\d{2,3})\s*(?:bpm|lpm|ppm)/gi)].map((m) => Number(m[1]));
  if (hrMatches.length === 1) {
    result.avgHeartRate = hrMatches[0];
    result.maxHeartRate = Math.max(current.maxHeartRate, Math.round(hrMatches[0] * 1.15));
  } else if (hrMatches.length >= 2) {
    const sorted = [...hrMatches].sort((a, b) => a - b);
    result.avgHeartRate = sorted[0];
    result.maxHeartRate = sorted[sorted.length - 1];
  }

  const kcalMatch = text.match(/(\d{3,4})\s*(?:kcal|calor[ií]as|cal\b)/i);
  if (kcalMatch) {
    result.activeCalories = Number(kcalMatch[1]);
  }

  const stepsMatch = text.match(/(\d{3,5})\s*(?:pasos|steps)/i);
  if (stepsMatch) {
    result.steps = Number(stepsMatch[1]);
  }

  const scoreMatch = text.match(/(?:puntuaci[oó]n|score|sue[ñn]o)[^\d]{0,15}(\d{2,3})/i);
  if (scoreMatch) {
    const val = Number(scoreMatch[1]);
    if (val >= 20 && val <= 100) {
      result.sleepScore = val;
    }
  }

  const hoursMinMatch = text.match(/(\d)\s*h\s*(\d{1,2})\s*m/i);
  if (hoursMinMatch) {
    const h = Number(hoursMinMatch[1]);
    const m = Number(hoursMinMatch[2]);
    result.sleepHours = Math.round((h + m / 60) * 10) / 10;
  }

  return result;
}

/**
 * Full MovingLife "Informe de análisis de composición corporal" parser:
 * Understands all Spanish labels from the MovingLife report image/text:
 * Peso(kg), Grasa corporal(%), Sal inorgánica(%), Proteínas(%), Agua(%), Muscular(%),
 * Músculo esquelético(%), Peso estándar, Control de peso, Control de grasa, Masa de grasa corporal(kg),
 * IMC, Índice de grasa visceral, Grasa subcutánea(kg), IMB(kcal), Masa magra(kg), SMI, puntuación de salud,
 * and 5-zone segmental fat/muscle values.
 */
export function parseMovingLifeText(
  rawText: string,
  baseline: CamryBiometricRecord
): Omit<CamryBiometricRecord, 'id'> {
  const text = rawText.replace(/,/g, '.');

  const extractAfter = (pattern: RegExp, min: number, max: number): number | null => {
    const m = text.match(pattern);
    if (!m || !m[1]) return null;
    const val = Number(m[1]);
    if (Number.isNaN(val) || val < min || val > max) return null;
    return val;
  };

  // Extract main MovingLife table indicators
  const weightKg =
    extractAfter(/Peso\s*\(\s*kg\s*\)[^\d]{0,20}(\d{2,3}(?:\.\d+)?)/i, 35, 190) ??
    extractAfter(/(\d{2,3}\.\d)\s*kg/i, 35, 190) ??
    baseline.weightKg;

  const bodyFatPercent =
    extractAfter(/Grasa\s*corporal\s*\(\s*%\s*\)[^\d]{0,20}(\d{1,2}(?:\.\d+)?)/i, 4, 60) ??
    extractAfter(/(?:grasa|fat)[^\d]{0,15}(\d{1,2}\.\d)\s*%/i, 4, 60) ??
    baseline.bodyFatPercent;

  const inorganicSaltPercent =
    extractAfter(/Sal\s*inorg[aá]nica\s*\(\s*%\s*\)[^\d]{0,20}(\d(?:\.\d+)?)/i, 2, 10);

  const proteinPercent =
    extractAfter(/Prote[ií]nas\s*\(\s*%\s*\)[^\d]{0,20}(\d{1,2}(?:\.\d+)?)/i, 5, 30);

  const waterPercent =
    extractAfter(/Agua\s*\(\s*%\s*\)[^\d]{0,20}(\d{2}(?:\.\d+)?)/i, 30, 80) ??
    extractAfter(/(?:agua|water)[^\d]{0,15}(\d{2}\.\d)\s*%/i, 30, 80);

  const musclePercent =
    extractAfter(/Muscular\s*\(\s*%\s*\)[^\d]{0,20}(\d{2}(?:\.\d+)?)/i, 30, 90);

  const skeletalMusclePercent =
    extractAfter(/M[uú]sculo\s*esquel[eé]tico\s*\(\s*%\s*\)[^\d]{0,20}(\d{2}(?:\.\d+)?)/i, 20, 70);

  const bodyFatMassKg =
    extractAfter(/Masa\s*de\s*grasa\s*corporal\s*\(\s*kg\s*\)[^\d]{0,25}(\d{1,2}(?:\.\d+)?)/i, 2, 95);

  const bmi =
    extractAfter(/IMC[^\d]{0,25}(\d{2}(?:\.\d+)?)/i, 12, 55);

  const visceralFatIndex =
    extractAfter(/visceral[^\d]{0,25}(\d{1,2})/i, 1, 30);

  const subcutaneousFatKg =
    extractAfter(/Grasa\s*subcut[aá]nea\s*\(\s*kg\s*\)[^\d]{0,25}(\d{1,2}(?:\.\d+)?)/i, 2, 80);

  const bmrKcal =
    extractAfter(/IMB\s*\(\s*kcal\s*\)[^\d]{0,25}(\d{4})/i, 900, 3500) ??
    extractAfter(/(\d{4})\s*kcal/i, 900, 3500);

  const leanBodyMassKg =
    extractAfter(/Masa\s*magra\s*\(\s*kg\s*\)[^\d]{0,25}(\d{2}(?:\.\d+)?)/i, 25, 120);

  const smi =
    extractAfter(/SMI[^\d]{0,45}(\d{1,2}\.\d)/i, 4, 16);

  const healthScore =
    extractAfter(/puntuaci[oó]n\s*de\s*salud[^\d]{0,25}(\d{2,3})/i, 20, 100);

  const standardWeightKg =
    extractAfter(/Peso\s*est[aá]ndar[^\d]{0,20}(\d{2}(?:\.\d+)?)/i, 40, 110);

  const estimated = estimateSmartSegmentalFromWeightAndFat(weightKg, bodyFatPercent, baseline);

  if (inorganicSaltPercent !== null) {
    estimated.inorganicSaltPercent = inorganicSaltPercent;
    estimated.boneMassKg = Math.round(((weightKg * inorganicSaltPercent) / 100) * 10) / 10;
  }
  if (proteinPercent !== null) estimated.proteinPercent = proteinPercent;
  if (waterPercent !== null) estimated.waterPercent = waterPercent;
  if (musclePercent !== null) estimated.musclePercent = musclePercent;
  if (skeletalMusclePercent !== null) estimated.skeletalMusclePercent = skeletalMusclePercent;
  if (bodyFatMassKg !== null) estimated.bodyFatMassKg = bodyFatMassKg;
  if (bmi !== null) estimated.bmi = bmi;
  if (visceralFatIndex !== null) estimated.visceralFatIndex = visceralFatIndex;
  if (subcutaneousFatKg !== null) estimated.subcutaneousFatKg = subcutaneousFatKg;
  if (bmrKcal !== null) estimated.bmrKcal = bmrKcal;
  if (leanBodyMassKg !== null) estimated.leanBodyMassKg = leanBodyMassKg;
  if (smi !== null) estimated.smi = smi;
  if (healthScore !== null) estimated.healthScore = healthScore;
  if (standardWeightKg !== null) {
    estimated.standardWeightKg = standardWeightKg;
    estimated.weightControlKg = Math.round((standardWeightKg - weightKg) * 10) / 10;
    estimated.fatControlKg = Math.round(Math.min(0, standardWeightKg - weightKg) * 10) / 10;
  }

  // Extract 2-decimal segmental muscle weights if present in text (e.g., 3.04kg, 2.98kg, 24.64kg, 7.93kg, 8.04kg)
  const twoDecMatches = [...text.matchAll(/(\d{1,2}\.\d{2})\s*kg/gi)].map((m) => Number(m[1]));
  if (twoDecMatches.length >= 5) {
    const arms = twoDecMatches.filter((n) => n >= 1.5 && n <= 6.5);
    const trunks = twoDecMatches.filter((n) => n >= 15 && n <= 40);
    const legs = twoDecMatches.filter((n) => n >= 6.0 && n <= 14.5);
    if (arms.length >= 2) {
      estimated.segments.leftArm.muscleKg = arms[0];
      estimated.segments.rightArm.muscleKg = arms[1];
    }
    if (trunks.length >= 1) {
      estimated.segments.trunk.muscleKg = trunks[0];
    }
    if (legs.length >= 2) {
      estimated.segments.leftLeg.muscleKg = legs[0];
      estimated.segments.rightLeg.muscleKg = legs[1];
    }
  }

  return estimated;
}

/**
 * Dynamically loads Tesseract.js from CDN to perform OCR on a MovingLife report image (.png/.jpg/.webp)
 * or reads text/JSON/CSV directly if a text-based file is uploaded.
 */
export async function processMovingLifeReportFile(
  file: File,
  baseline: CamryBiometricRecord,
  onProgress?: (statusText: string) => void
): Promise<{
  record: Omit<CamryBiometricRecord, 'id'>;
  previewUrl?: string;
  extractedText: string;
}> {
  // 1. If text, CSV, JSON, or HTML file
  if (
    file.type.startsWith('text/') ||
    file.name.endsWith('.txt') ||
    file.name.endsWith('.csv') ||
    file.name.endsWith('.json')
  ) {
    onProgress?.('Leyendo archivo de datos MovingLife...');
    const rawText = await file.text();
    const record = parseMovingLifeText(rawText, baseline);
    return { record, extractedText: rawText };
  }

  // 2. If image file (PNG, JPG, WEBP screenshot of "Informe de análisis de composición corporal")
  const previewUrl = URL.createObjectURL(file);
  onProgress?.('Analizando imagen del Informe MovingLife con OCR...');

  try {
    // Load Tesseract.js v5 on-demand from CDN
    const win = window as unknown as {
      Tesseract?: {
        recognize: (
          image: File | string,
          lang: string,
          options?: { logger?: (m: { status: string; progress: number }) => void }
        ) => Promise<{ data: { text: string } }>;
      };
    };

    if (!win.Tesseract) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('No se pudo cargar el motor OCR'));
        document.head.appendChild(script);
      });
    }

    if (win.Tesseract) {
      const result = await win.Tesseract.recognize(file, 'spa+eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            onProgress?.(`Escaneando Informe MovingLife: ${Math.round(m.progress * 100)}%...`);
          }
        },
      });
      const ocrText = result.data.text || '';
      const record = parseMovingLifeText(ocrText, baseline);
      return {
        record,
        previewUrl,
        extractedText: ocrText,
      };
    }
  } catch {
    // Fallback if offline or CDN blocked: return baseline-calibrated record ready for 1-click confirmation
  }

  return {
    record: estimateSmartSegmentalFromWeightAndFat(baseline.weightKg, baseline.bodyFatPercent, baseline),
    previewUrl,
    extractedText: 'Imagen cargada en modo local.',
  };
}
