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
 * Smart Proportional Segmental Estimator:
 * Given just Weight (kg) and Body Fat (%), automatically computes BMR (Mifflin-St Jeor / Katch-McArdle),
 * % Water, Visceral Fat, Bone Mass, and scales the 5 segmental zones proportionally so the user only needs
 * 1-2 numbers (or a quick paste) to update the entire 8-electrode profile accurately!
 */
export function estimateSmartSegmentalFromWeightAndFat(
  weightKg: number,
  bodyFatPercent: number,
  baseline: CamryBiometricRecord
): Omit<CamryBiometricRecord, 'id'> {
  const cleanWeight = Math.round(Math.max(40, Math.min(180, weightKg)) * 10) / 10;
  const cleanFat = Math.round(Math.max(5, Math.min(45, bodyFatPercent)) * 10) / 10;

  // Katch-McArdle BMR based on Lean Body Mass (LBM)
  const leanMassKg = cleanWeight * (1 - cleanFat / 100);
  const bmrKcal = Math.round(370 + 21.6 * leanMassKg);

  // Total body water is inversely proportional to body fat (~73% of FFM)
  const waterPercent = Math.round((100 - cleanFat) * 0.715 * 10) / 10;
  const boneMassKg = Math.round((leanMassKg * 0.05) * 10) / 10;
  const visceralFatIndex = Math.max(1, Math.min(20, Math.round(cleanFat * 0.42)));

  // Scale segmental muscle proportionally to Lean Mass change
  const baselineLeanMass = baseline.weightKg * (1 - baseline.bodyFatPercent / 100);
  const muscleRatio = baselineLeanMass > 0 ? leanMassKg / baselineLeanMass : 1;
  const fatDelta = cleanFat - baseline.bodyFatPercent;

  return {
    date: new Date().toISOString().slice(0, 10),
    weightKg: cleanWeight,
    bodyFatPercent: cleanFat,
    waterPercent,
    visceralFatIndex,
    boneMassKg,
    bmrKcal,
    segments: {
      leftArm: {
        muscleKg: Math.round(baseline.segments.leftArm.muscleKg * muscleRatio * 100) / 100,
        fatPercent: Math.round(Math.max(4, baseline.segments.leftArm.fatPercent + fatDelta * 0.85) * 10) / 10,
      },
      rightArm: {
        muscleKg: Math.round(baseline.segments.rightArm.muscleKg * muscleRatio * 100) / 100,
        fatPercent: Math.round(Math.max(4, baseline.segments.rightArm.fatPercent + fatDelta * 0.85) * 10) / 10,
      },
      trunk: {
        muscleKg: Math.round(baseline.segments.trunk.muscleKg * muscleRatio * 10) / 10,
        fatPercent: Math.round(Math.max(5, baseline.segments.trunk.fatPercent + fatDelta * 1.05) * 10) / 10,
      },
      leftLeg: {
        muscleKg: Math.round(baseline.segments.leftLeg.muscleKg * muscleRatio * 100) / 100,
        fatPercent: Math.round(Math.max(5, baseline.segments.leftLeg.fatPercent + fatDelta * 0.9) * 10) / 10,
      },
      rightLeg: {
        muscleKg: Math.round(baseline.segments.rightLeg.muscleKg * muscleRatio * 100) / 100,
        fatPercent: Math.round(Math.max(5, baseline.segments.rightLeg.fatPercent + fatDelta * 0.9) * 10) / 10,
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

  // Match heart rate (bpm / lpm)
  const hrMatches = [...text.matchAll(/(\d{2,3})\s*(?:bpm|lpm|ppm)/gi)].map((m) => Number(m[1]));
  if (hrMatches.length === 1) {
    result.avgHeartRate = hrMatches[0];
    result.maxHeartRate = Math.max(current.maxHeartRate, Math.round(hrMatches[0] * 1.15));
  } else if (hrMatches.length >= 2) {
    const sorted = [...hrMatches].sort((a, b) => a - b);
    result.avgHeartRate = sorted[0];
    result.maxHeartRate = sorted[sorted.length - 1];
  }

  // Match active calories (kcal / Cal)
  const kcalMatch = text.match(/(\d{3,4})\s*(?:kcal|calor[ií]as|cal\b)/i);
  if (kcalMatch) {
    result.activeCalories = Number(kcalMatch[1]);
  }

  // Match steps (pasos / steps)
  const stepsMatch = text.match(/(\d{3,5})\s*(?:pasos|steps)/i);
  if (stepsMatch) {
    result.steps = Number(stepsMatch[1]);
  }

  // Match sleep score (puntuación / score 0-100)
  const scoreMatch = text.match(/(?:puntuaci[oó]n|score|sue[ñn]o)[^\d]{0,15}(\d{2,3})/i);
  if (scoreMatch) {
    const val = Number(scoreMatch[1]);
    if (val >= 20 && val <= 100) {
      result.sleepScore = val;
    }
  }

  // Match sleep hours (e.g., 7h 30m or 7.5 h)
  const hoursMinMatch = text.match(/(\d)\s*h\s*(\d{1,2})\s*m/i);
  if (hoursMinMatch) {
    const h = Number(hoursMinMatch[1]);
    const m = Number(hoursMinMatch[2]);
    result.sleepHours = Math.round((h + m / 60) * 10) / 10;
  }

  return result;
}

/**
 * Parses text copied from MovingLife (Camry 8-electrode app) or extracted via S23 Ultra One UI "Extraer texto".
 */
export function parseMovingLifeText(
  rawText: string,
  baseline: CamryBiometricRecord
): Omit<CamryBiometricRecord, 'id'> {
  const text = rawText.replace(/,/g, '.');

  const weightMatch = text.match(/(\d{2,3}\.\d)\s*kg/i);
  const fatMatch = text.match(/(?:grasa|fat)[^\d]{0,15}(\d{1,2}\.\d)\s*%/i) || text.match(/(\d{1,2}\.\d)\s*%/);
  const waterMatch = text.match(/(?:agua|water)[^\d]{0,15}(\d{2}\.\d)\s*%/i);
  const bmrMatch = text.match(/(\d{4})\s*kcal/i);
  const visceralMatch = text.match(/(?:visceral)[^\d]{0,15}(\d{1,2})/i);

  const detectedWeight = weightMatch ? Number(weightMatch[1]) : baseline.weightKg;
  const detectedFat = fatMatch ? Number(fatMatch[1]) : baseline.bodyFatPercent;

  const estimated = estimateSmartSegmentalFromWeightAndFat(detectedWeight, detectedFat, baseline);

  if (waterMatch) estimated.waterPercent = Number(waterMatch[1]);
  if (bmrMatch) estimated.bmrKcal = Number(bmrMatch[1]);
  if (visceralMatch) estimated.visceralFatIndex = Number(visceralMatch[1]);

  return estimated;
}
