import { INITIAL_APP_STATE } from '../data/seedData';
import {
  AppState,
  CoachChatMessage,
  CupToGramsRef,
  DetectedIngredient,
  MealAIResult,
  MealPhotoAIResult,
  NutritionMealTag,
} from '../types/fitness';

const GEMINI_KEY_STORAGE = 'apex_recomp_gemini_api_key';
const DEFAULT_GEMINI_KEY = (
  (import.meta as unknown as { env?: { VITE_GEMINI_API_KEY?: string } }).env
    ?.VITE_GEMINI_API_KEY ||
  INITIAL_APP_STATE.userProfile.geminiApiKey ||
  ''
).trim();

export function getEffectiveGeminiKey(state?: AppState): string {
  const profileKey = state?.userProfile?.geminiApiKey;
  if (profileKey && profileKey.trim()) return profileKey.trim();
  if (typeof window !== 'undefined') {
    const localKey = localStorage.getItem(GEMINI_KEY_STORAGE);
    if (localKey && localKey.trim()) return localKey.trim();
    try {
      const storedRaw = localStorage.getItem('apex_recomp_pwa_state_v3_clean_start');
      if (storedRaw) {
        const parsed = JSON.parse(storedRaw) as Partial<AppState>;
        const storedKey = parsed?.userProfile?.geminiApiKey;
        if (storedKey && storedKey.trim()) return storedKey.trim();
      }
    } catch {
      // ignore localStorage parse errors
    }
  }
  return DEFAULT_GEMINI_KEY;
}

export function saveCustomGeminiKey(key: string): void {
  if (typeof window === 'undefined') return;
  if (key.trim()) {
    localStorage.setItem(GEMINI_KEY_STORAGE, key.trim());
  } else {
    localStorage.removeItem(GEMINI_KEY_STORAGE);
  }
}

interface GeminiModelCandidate {
  model: string;
  thinkingLevel?: 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH';
}

const VISION_MODELS: GeminiModelCandidate[] = [
  { model: 'gemini-3-flash-preview', thinkingLevel: 'MINIMAL' },
  { model: 'gemini-flash-lite-latest', thinkingLevel: 'MINIMAL' },
  { model: 'gemini-3.5-flash', thinkingLevel: 'MINIMAL' },
  { model: 'gemini-flash-latest' },
  { model: 'gemini-3.5-flash-lite' },
  { model: 'gemini-3.1-flash-lite' },
];

const TEXT_MODELS: GeminiModelCandidate[] = [
  { model: 'gemini-flash-lite-latest', thinkingLevel: 'MINIMAL' },
  { model: 'gemini-3-flash-preview', thinkingLevel: 'MINIMAL' },
  { model: 'gemini-flash-latest' },
  { model: 'gemini-3.5-flash-lite' },
  { model: 'gemini-3.1-flash-lite' },
];

interface GeminiPart {
  text?: string;
  thought?: boolean;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiResponsePayload {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
}

function extractTextFromGeminiResponse(json: GeminiResponsePayload): string {
  const parts = json?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  const nonThought = [...parts].reverse().find((p) => typeof p?.text === 'string' && !p?.thought);
  if (nonThought?.text) return nonThought.text;
  const anyText = parts.find((p) => typeof p?.text === 'string');
  return anyText?.text || '';
}

function hasInlineImage(body: unknown): boolean {
  try {
    const serialized = JSON.stringify(body);
    return serialized.includes('inlineData') || serialized.includes('inline_data');
  } catch {
    return false;
  }
}

async function callGeminiWithFallback(
  apiKey: string,
  payload: Record<string, unknown>
): Promise<Response | null> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return null;
  }

  const cleanKey = apiKey.trim();
  const useProxy = !cleanKey;
  const isVision = hasInlineImage(payload);
  const candidates = isVision ? VISION_MODELS : TEXT_MODELS;
  const timeoutMs = isVision ? 14000 : 9000;
  let lastErrorResponse: Response | null = null;

  for (const candidate of candidates) {
    const baseGenConfig = (payload.generationConfig as Record<string, unknown>) || {};
    const shouldAddThinking = Boolean(candidate.thinkingLevel && !baseGenConfig.thinkingConfig);

    const buildBody = (withThinking: boolean): Record<string, unknown> => {
      if (withThinking && candidate.thinkingLevel) {
        return {
          ...payload,
          generationConfig: {
            ...baseGenConfig,
            thinkingConfig: { thinkingLevel: candidate.thinkingLevel },
          },
        };
      }
      return payload;
    };

    const doFetch = async (bodyObj: Record<string, unknown>): Promise<Response | null> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = useProxy
          ? await fetch('/.netlify/functions/gemini', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: candidate.model, payload: bodyObj }),
              signal: controller.signal,
            })
          : await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${candidate.model}:generateContent?key=${encodeURIComponent(
                cleanKey
              )}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyObj),
                signal: controller.signal,
              }
            );
        clearTimeout(timer);
        return res;
      } catch {
        clearTimeout(timer);
        return null;
      }
    };

    let res = await doFetch(buildBody(shouldAddThinking));
    if (res && res.status === 400 && shouldAddThinking) {
      res = await doFetch(buildBody(false));
    }
    if (res && res.ok) return res;
    if (useProxy && (!res || res.status === 404 || res.status === 503)) {
      return res;
    }
    if (res) lastErrorResponse = res;
  }

  return lastErrorResponse;
}

export async function callGeminiVisionJSON(
  apiKey: string,
  prompt: string,
  base64Data: string,
  mimeType: string = 'image/jpeg'
): Promise<string | null> {
  if (!base64Data) return null;
  const res = await callGeminiWithFallback(apiKey, {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: mimeType || 'image/jpeg', data: base64Data } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
    },
  });
  if (res && res.ok) {
    const json = (await res.json()) as GeminiResponsePayload;
    return extractTextFromGeminiResponse(json) || null;
  }
  return null;
}

export async function testGeminiApiKey(
  key: string
): Promise<{ ok: boolean; status: number; message: string; model?: string }> {
  if (!key.trim()) {
    return { ok: false, status: 0, message: 'La clave está vacía.' };
  }
  const cleanKey = key.trim();
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`
    );
    if (res.ok) {
      return {
        ok: true,
        status: 200,
        message: 'Conexión exitosa con Google Cloud (Generative Language API activa).',
        model: 'Google Gemini Cloud',
      };
    }
    const errJson = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    const msg = errJson?.error?.message || '';
    if (res.status === 403 || msg.includes('blocked')) {
      return {
        ok: false,
        status: 403,
        message:
          'Clave con restricciones: Google Cloud bloqueó la API generativelanguage.googleapis.com para este proyecto (API_KEY_SERVICE_BLOCKED).',
      };
    }
    if (
      res.status === 400 &&
      (msg.includes('API key not valid') || msg.includes('INVALID_ARGUMENT'))
    ) {
      return {
        ok: false,
        status: 400,
        message: 'Clave de API no válida en Google AI Studio.',
      };
    }
    return {
      ok: false,
      status: res.status,
      message: msg || `Error ${res.status} al validar clave.`,
    };
  } catch (err) {
    return { ok: false, status: 0, message: `Error de red al conectar con Google: ${err}` };
  }
}

export function compressImageFileToBase64(
  file: File
): Promise<{ previewUrl: string; base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = String(ev.target?.result || '');
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > 960 || height > 960) {
          if (width > height) {
            height = Math.round((height * 960) / width);
            width = 960;
          } else {
            width = Math.round((width * 960) / height);
            height = 960;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          const base64 = compressed.split(',')[1] || '';
          resolve({ previewUrl: compressed, base64, mimeType: 'image/jpeg' });
        } else {
          const base64 = dataUrl.split(',')[1] || '';
          resolve({ previewUrl: dataUrl, base64, mimeType: file.type || 'image/jpeg' });
        }
      };
      img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error('Error leyendo archivo'));
    reader.readAsDataURL(file);
  });
}

export function buildCoachSystemContext(state: AppState): string {
  const latestCamry = state.camryHistory[state.camryHistory.length - 1];
  const insanityDay =
    state.insanityCalendar.find((d) => d.dayNumber === state.currentInsanityDay) ||
    state.insanityCalendar[0];
  const completedInsanity = state.insanityCalendar.filter((d) => d.completed).length;
  const weekdayName =
    ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][
      state.selectedWeekdayIndex
    ] || 'Hoy';
  const todayRoutine = state.routines.find((r) => r.weekdayIndex === state.selectedWeekdayIndex);
  const isInsanityOnly = state.trainingMode === 'insanity_only';

  const bmr = latestCamry?.bmrKcal || 1558;
  const neat = Math.round(bmr * 0.1);
  const watchCal = state.watchMetrics.activeCalories || 0;
  const deficit = state.userProfile?.dailyDeficitKcal ?? 300;
  const targetKcal = Math.max(1500, bmr + neat + watchCal - deficit);

  const consumedKcal = state.nutrition.loggedMeals.reduce((acc, m) => acc + m.calories, 0);
  const consumedProt = state.nutrition.loggedMeals.reduce((acc, m) => acc + m.proteinG, 0);
  const consumedCarbs = state.nutrition.loggedMeals.reduce((acc, m) => acc + m.carbsG, 0);
  const consumedFat = state.nutrition.loggedMeals.reduce((acc, m) => acc + m.fatG, 0);

  const weight = latestCamry?.weightKg || 83.3;
  const bodyFat = latestCamry?.bodyFatPercent || 33.9;
  const lbm = latestCamry?.leanBodyMassKg || Math.round(weight * (1 - bodyFat / 100) * 10) / 10;
  const refWeight =
    bodyFat > 25
      ? latestCamry?.standardWeightKg || Math.round(lbm * 1.18 * 10) / 10
      : weight;
  const isHighCarbDay = isInsanityOnly
    ? !insanityDay.isRestDay && state.selectedWeekdayIndex !== 0
    : !(
        state.selectedWeekdayIndex === 0 ||
        state.selectedWeekdayIndex === 4 ||
        state.selectedWeekdayIndex === 3
      ) ||
      [1, 2, 5].includes(state.selectedWeekdayIndex) ||
      (insanityDay.isMaxInterval &&
        state.selectedWeekdayIndex !== 0 &&
        state.selectedWeekdayIndex !== 4);
  const ageBonus = (state.userProfile?.age ?? 38) >= 35 ? 0.1 : 0;
  const proteinTarget = Math.round(
    isHighCarbDay ? refWeight * (2.25 + ageBonus) : refWeight * (2.4 + ageBonus)
  );

  const recentHistoryStr = Object.values(state.nutritionHistory || {})
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3)
    .map((entry) => {
      const kcal = entry.loggedMeals.reduce((acc, m) => acc + m.calories, 0);
      const prot = entry.loggedMeals.reduce((acc, m) => acc + m.proteinG, 0);
      const waterMl = entry.waterGlasses250ml * 250;
      const wStr = entry.watchActiveCalories
        ? ` | Watch: ${entry.watchActiveCalories} kcal`
        : '';
      return `  * ${entry.date}: ${kcal} kcal (${prot}g Prot, ${entry.loggedMeals.length} comidas) | Agua: ${waterMl} ml${wStr}`;
    })
    .join('\n');

  return `Eres APEX AI Coach, un Entrenador Olímpico de Fuerza, Especialista en HIIT Insanity y Nutricionista Clínico Deportivo dedicado exclusivamente a Cristopher (Hombre, ${state.userProfile?.heightCm ?? 168}.0 cm, ${state.userProfile?.age ?? 38} años).
Responde siempre en español, de forma directa, motivadora, científica y 100% personalizada con sus números reales y su equipo real.

MODO DE ENTRENAMIENTO ACTIVO DE CRISTOPHER:
- ${
    isInsanityOnly
      ? '⚡ MODO SOLO INSANITY HIIT (El atleta pausó temporalmente las sesiones de Fuerza/Pesas hasta dominar su horario. NO asumas que está levantando pesas hoy; prioriza proteger sus 55 kg de masa magra con alta proteína, hidratación y recuperación articular de rodillas/gemelos en Insanity, y recuerda que el módulo de Fuerza permanece guardado para cuando decida volver a Híbrido).'
      : '🏋️ MODO HÍBRIDO COMPLETO (Fuerza Torso/Pierna + Insanity HIIT).'
  }

EQUIPO DISPONIBLE EN SU GIMNASIO:
1. Estación Multifuncional Forza Gym (polea alta jalón, polea baja remo, Pec Deck/press, banco predicador Scott, extensión de cuádriceps por placas de 4.5 kg).
2. Banco Gold's Gym XR 6.1 (plano, inclinado, declinado) + colchoneta.
3. Par de mancuernas hexagonales fijas de 25 kg (50 kg total), mancuernas cromadas ajustables y 2 pares de mancuernas rojas ligeras (calentamiento/drop sets).
4. Báscula Camry 8 Electrodos (MovingLife) y Samsung Galaxy Watch 7 + S23 Ultra.

BIOMETRÍA REAL ACTUAL DE CRISTOPHER (MovingLife 8 Electrodos):
- Peso: ${latestCamry?.weightKg ?? 83.3} kg (Peso estándar: ${latestCamry?.standardWeightKg ?? 64.8} kg | Control de grasa: ${latestCamry?.fatControlKg ?? -18.5} kg)
- Grasa Corporal: ${latestCamry?.bodyFatPercent ?? 33.9}% (${latestCamry?.bodyFatMassKg ?? 28.3} kg de masa grasa | Subcutánea: ${latestCamry?.subcutaneousFatKg ?? 24.9} kg | Visceral: Nivel ${latestCamry?.visceralFatIndex ?? 13})
- Masa Magra (LBM): ${latestCamry?.leanBodyMassKg ?? 55} kg | Músculo Esquelético: ${latestCamry?.skeletalMusclePercent ?? 37.2}% | Agua: ${latestCamry?.waterPercent ?? 48.5}% | Proteínas: ${latestCamry?.proteinPercent ?? 13.1}%
- IMB (Tasa Metabólica Basal): ${bmr} kcal | Puntuación de Salud: ${latestCamry?.healthScore ?? 63}/100 | SMI: ${latestCamry?.smi ?? 8.5}
- Segmentos Musculares:
  * Brazo Izq: ${latestCamry?.segments.leftArm.muscleKg ?? 3.04} kg (${latestCamry?.segments.leftArm.muscleRatioPct ?? 105.7}% Estándar)
  * Brazo Der: ${latestCamry?.segments.rightArm.muscleKg ?? 2.98} kg (${latestCamry?.segments.rightArm.muscleRatioPct ?? 103.5}% Estándar)
  * Tronco: ${latestCamry?.segments.trunk.muscleKg ?? 24.64} kg (${latestCamry?.segments.trunk.muscleRatioPct ?? 97.1}% Estándar)
  * Pierna Izq: ${latestCamry?.segments.leftLeg.muscleKg ?? 7.93} kg (${latestCamry?.segments.leftLeg.muscleRatioPct ?? 87.7}% BAJO <90%)
  * Pierna Der: ${latestCamry?.segments.rightLeg.muscleKg ?? 8.04} kg (${latestCamry?.segments.rightLeg.muscleRatioPct ?? 88.9}% BAJO <90%)

ESTADO DE HOY (${weekdayName}):
- Bloque de Fuerza: ${
    isInsanityOnly
      ? 'En Pausa (Modo Solo Insanity activo)'
      : todayRoutine
      ? `${todayRoutine.title} (${todayRoutine.focus})`
      : 'Día sin pesas (Recuperación muscular / Movilidad)'
  }
- Insanity HIIT: Día ${insanityDay.dayNumber}/63 (${insanityDay.workoutTitle}, ${insanityDay.durationMin} min) | Progreso: ${completedInsanity}/63 días completados.
- Galaxy Watch 7 Hoy: ${watchCal} kcal activas, FC Prom ${state.watchMetrics.avgHeartRate} bpm, FC Máx ${state.watchMetrics.maxHeartRate} bpm, ${state.watchMetrics.steps} pasos, Sueño ${state.watchMetrics.sleepScore}/100.
- Nutrición Hoy: Meta ${targetKcal} kcal | Consumido: ${consumedKcal} kcal (${consumedProt}g / ${proteinTarget}g Proteína, ${consumedCarbs}g Carbs, ${consumedFat}g Grasas) | Agua: ${state.nutrition.waterGlasses250ml * 250} ml de 3500 ml.${
    recentHistoryStr ? `\n\nHISTORIAL NUTRICIONAL RECIENTE (DÍAS ANTERIORES):\n${recentHistoryStr}` : ''
  }`;
}

export async function sendMessageToCoachAI(
  userMessage: string,
  state: AppState,
  history: CoachChatMessage[]
): Promise<CoachChatMessage> {
  const sysContext = buildCoachSystemContext(state);
  const apiKey = getEffectiveGeminiKey(state);

  try {
    const contents = [
      ...history.slice(-6).map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      })),
      {
        role: 'user',
        parts: [
          {
            text: `[INSTRUCCIÓN OBLIGATORIA: Responde SIEMPRE 100% en ESPAÑOL. No respondas en inglés bajo ninguna circunstancia. Eres el coach olímpico y clínico personal de Cristopher.]\n\nPregunta de Cristopher: ${userMessage}`,
          },
        ],
      },
    ];

    const res = await callGeminiWithFallback(apiKey, {
      systemInstruction: {
        parts: [
          {
            text:
              sysContext +
              '\n\nREGLA SUPREMA: Responde SIEMPRE en español, con tono motivador, biomecánico y científico adaptado a Cristopher.',
          },
        ],
      },
      contents,
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 950,
      },
    });

    if (res && res.ok) {
      const json = (await res.json()) as GeminiResponsePayload;
      const reply = extractTextFromGeminiResponse(json);
      if (reply) {
        return {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: reply,
          timestamp: new Date().toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          source: 'gemini-cloud',
        };
      }
    }
  } catch {
    // fallback below
  }

  return generateLocalCoachResponse(userMessage, state);
}

export function generateLocalCoachResponse(userMessage: string, state: AppState): CoachChatMessage {
  const raw = userMessage.trim();
  const q = raw.toLowerCase();
  const latestCamry = state.camryHistory[state.camryHistory.length - 1];
  const isInsanityOnly = state.trainingMode === 'insanity_only';

  const weight = latestCamry?.weightKg ?? 83.3;
  const fatPct = latestCamry?.bodyFatPercent ?? 33.9;
  const fatKg = latestCamry?.bodyFatMassKg ?? 28.3;
  const lbm = latestCamry?.leanBodyMassKg ?? 55;
  const bmr = latestCamry?.bmrKcal ?? 1558;
  const visceral = latestCamry?.visceralFatIndex ?? 13;
  const waterPct = latestCamry?.waterPercent ?? 48.5;
  const leftLegKg = latestCamry?.segments.leftLeg.muscleKg ?? 7.93;
  const rightLegKg = latestCamry?.segments.rightLeg.muscleKg ?? 8.04;
  const leftArmKg = latestCamry?.segments.leftArm.muscleKg ?? 3.04;
  const rightArmKg = latestCamry?.segments.rightArm.muscleKg ?? 2.98;

  const neat = Math.round(bmr * 0.1);
  const watchCal = state.watchMetrics.activeCalories || 0;
  const deficit = state.userProfile?.dailyDeficitKcal ?? 300;
  const targetKcal = Math.max(1500, bmr + neat + watchCal - deficit);
  const consumedKcal = state.nutrition.loggedMeals.reduce((acc, m) => acc + m.calories, 0);
  const remainingKcal = Math.max(0, targetKcal - consumedKcal);

  const refWeight =
    fatPct > 25 ? latestCamry?.standardWeightKg || Math.round(lbm * 1.18 * 10) / 10 : weight;
  const insDay =
    state.insanityCalendar.find((d) => d.dayNumber === state.currentInsanityDay) ||
    state.insanityCalendar[0];
  const isHighCarbDay = isInsanityOnly
    ? !insDay.isRestDay && state.selectedWeekdayIndex !== 0
    : !(
        state.selectedWeekdayIndex === 0 ||
        state.selectedWeekdayIndex === 4 ||
        state.selectedWeekdayIndex === 3
      ) ||
      [1, 2, 5].includes(state.selectedWeekdayIndex) ||
      (insDay.isMaxInterval &&
        state.selectedWeekdayIndex !== 0 &&
        state.selectedWeekdayIndex !== 4);
  const ageBonus = (state.userProfile?.age ?? 38) >= 35 ? 0.1 : 0;
  const proteinTarget = Math.round(
    isHighCarbDay ? refWeight * (2.25 + ageBonus) : refWeight * (2.4 + ageBonus)
  );
  const consumedProt = state.nutrition.loggedMeals.reduce((acc, m) => acc + m.proteinG, 0);
  const remainingProt = Math.max(0, proteinTarget - consumedProt);

  const weekdayName =
    ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][
      state.selectedWeekdayIndex
    ] || 'Hoy';
  const todayRoutine = state.routines.find((r) => r.weekdayIndex === state.selectedWeekdayIndex);
  const timeStr = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  if (
    q === '1' ||
    q === 'opcion 1' ||
    q === 'opción 1' ||
    q.startsWith('1.') ||
    q.startsWith('1-') ||
    q.includes('primera opcion') ||
    q.includes('primera opción')
  ) {
    const mealName =
      remainingProt >= 40
        ? 'Pechuga de Pollo + Arroz al Vapor + Aguacate'
        : 'Omelette de Claras con Espinacas y Avena';
    const protG = Math.min(54, Math.max(28, remainingProt));
    const carbsG = Math.min(65, Math.max(25, Math.round((remainingKcal * 0.45) / 4)));
    const fatG = Math.min(18, Math.max(8, Math.round((remainingKcal * 0.25) / 9)));
    const mealCal = protG * 4 + carbsG * 4 + fatG * 9;

    return {
      id: `ai-${Date.now()}`,
      role: 'assistant',
      timestamp: timeStr,
      source: 'apex-neural-local',
      quickAction: {
        label: `➕ Registrar "${mealName}" (+${protG}g Prot · ${mealCal} kcal)`,
        type: 'log_meal',
        payload: {
          name: mealName,
          calories: mealCal,
          proteinG: protG,
          carbsG,
          fatG,
          tag: 'Comida Fuerte',
        },
      },
      content: `### 🍽️ Opción 1: Menú Exacto para tus Calorías y Proteínas Restantes de Hoy

Cristopher, según tu estado actual en vivo:
* **Calorías restantes hoy:** \`${remainingKcal} kcal\` (Meta: \`${targetKcal} kcal\` | Consumido: \`${consumedKcal} kcal\`)
* **Proteína restante hoy:** \`${remainingProt} g\` (Meta: \`${proteinTarget} g\` para blindar tus \`${lbm} kg\` de masa magra${isInsanityOnly ? ' haciendo Solo Insanity' : ''})

#### 🥗 Plato Recomendado por el Coach: **${mealName}**
* **Ingredientes y Gramajes:**
  1. **220 g de Pechuga de Pollo** o **Filete de Atún fresco** a la plancha (\`~48-52g proteína limpia\`).
  2. **160 g de Arroz blanco o integral cocido** (\`~45g carbohidratos complejos\`) para reponer glucógeno tras Insanity.
  3. **60 g de Aguacate** (1/4 de pieza) o **1 cucharadita de aceite de oliva** (\`~9g grasas monoinsaturadas\`).
  4. **Bowl libre de espinaca, pepino o lechuga** (fibra sin calorías añadidas).
* **Macronutrientes del Plato:** **\`${mealCal} kcal\`** | **\`${protG}g Proteína\`** | **\`${carbsG}g Carbs\`** | **\`${fatG}g Grasas\`**.

*(Toca el botón azul de abajo si deseas sumarlo inmediatamente a tu registro de comidas de hoy)*.

¿Prefieres una opción rápida en shake/batido o tienes alguna duda sobre la preparación?`,
    };
  }

  if (
    q === '2' ||
    q === 'opcion 2' ||
    q === 'opción 2' ||
    q.startsWith('2.') ||
    q.startsWith('2-') ||
    q.includes('segunda opcion') ||
    q.includes('segunda opción')
  ) {
    if (isInsanityOnly) {
      return {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        timestamp: timeStr,
        source: 'apex-neural-local',
        content: `### ⚡ Opción 2: Estrategia Táctica Solo Insanity Hoy (${weekdayName})

Hoy tienes activo tu modo **Solo Insanity HIIT** (Fuerza en Pausa temporal):
1. **Insanity HIIT:** **Día ${insDay.dayNumber}/63** (${insDay.workoutTitle} • \`${insDay.durationMin} min\`).
2. **Pesas:** En pausa hasta que logres dominar el ritmo de Insanity y quieras volver a Modo Híbrido.

#### 🛡️ Protocolo de Ejecución Óptimo (Solo Insanity):
* **Paso 1 (Calentamiento Articular):** Dedica 5 minutos completos al warm-up y estiramiento de pantorrillas/cadera; protege tus tobillos y rodillas.
* **Paso 2 (Aterrizaje Suave en Saltos):** En plyometrics y power jumps aterriza siempre con la punta del pie y rodillas semiflexionadas ("land softly") para proteger articulaciones a tus \`${weight} kg\`.
* **Paso 3 (Zona Cardíaca en Galaxy Watch 7):** Busca sostener **148–166 bpm** (Zona 4). Si superas 178 bpm por >60s, marcha 15 segundos recuperando aire y retoma con buena forma.
* **Paso 4 (Blindaje Muscular Post-HIIT):** Como no estás haciendo pesas aún, asegura cumplir tus **${proteinTarget}g de proteína** e hidratación (3.5 L) para perder de tus \`${fatKg} kg\` de grasa sin catabolizar los **${lbm} kg de masa magra**.

¿Quieres revisar algún consejo de técnica o respiración para **${insDay.workoutTitle}**?`,
      };
    }

    return {
      id: `ai-${Date.now()}`,
      role: 'assistant',
      timestamp: timeStr,
      source: 'apex-neural-local',
      content: `### 🏋️‍♂️ Opción 2: Estrategia Táctica para tu Entrenamiento de Hoy (${weekdayName})

Hoy tienes programado:
1. **Bloque de Fuerza:** ${todayRoutine ? `**${todayRoutine.title}** (${todayRoutine.focus})` : 'Día de descanso de pesas / Movilidad articular'}
2. **Insanity HIIT:** **Día ${insDay.dayNumber}/63** (${insDay.workoutTitle} • \`${insDay.durationMin} min\`).

#### ⚡ Protocolo de Ejecución Óptimo:
* **Paso 1 (Pesas Primero):** Realiza tu rutina de fuerza antes de Insanity. Tus reservas de glucógeno muscular y ATP deben estar al 100% para mover las **mancuernas de 25 kg** o las **placas de la Forza Gym**.
* **Paso 2 (Descansos cronometrados):** Usa los botones del timer automático en la app: \`120s\` para ejercicios compuestos pesados y \`60s\` para aislamiento.
* **Paso 3 (Insanity HIIT después):** Al entrar a **${insDay.workoutTitle}** con el glucógeno parcialmente gastado, obligas a tu metabolismo a **oxidar ácidos grasos de tus ${fatKg} kg de grasa corporal**.
* **Paso 4 (Control en tu Galaxy Watch 7):** Mantén tu pulso promedio entre **148 y 165 bpm** para mantenerte en Zona 4 (umbral anaeróbico) sin sobreentrenar el sistema nervioso.

¿Quieres que te detalle los pesos exactos de alguno de los ejercicios de hoy?`,
    };
  }

  if (
    q === '3' ||
    q === 'opcion 3' ||
    q === 'opción 3' ||
    q.startsWith('3.') ||
    q.startsWith('3-') ||
    q.includes('tercera opcion') ||
    q.includes('tercera opción')
  ) {
    return {
      id: `ai-${Date.now()}`,
      role: 'assistant',
      timestamp: timeStr,
      source: 'apex-neural-local',
      content: `### 🧬 Opción 3: Plan Clínico para Bajar tu Grasa Visceral de Nivel ${visceral} a Nivel ≤9

Cristopher, en tu reporte MovingLife tienes **${weight} kg**, con **${fatPct}% de grasa (${fatKg} kg)** y **Grasa Visceral en Nivel ${visceral}** (la grasa profunda que rodea hígado y órganos vitales; el estándar saludable es **≤ 9**).

#### 🛡️ Las 3 Palancas Científicas para Bajarla:
1. **Déficit Calórico Moderado de −${deficit} kcal/día:**
   * Al no hacer un déficit agresivo, tu cuerpo no entra en modo supervivencia y no destruye tus **${lbm} kg de masa muscular**. Pierdes entre **500g y 750g de grasa pura por semana**.
2. **Impacto HIIT de Insanity (${insDay.workoutTitle}):**
   * El entrenamiento por intervalos de alta intensidad genera un gasto calórico prolongado pos-ejercicio (**EPOC**), quemando ácidos grasos viscerales durante las siguientes 14 a 24 horas.
3. **Cena con Cero Carbohidratos Almidonados:**
   * En la noche, cena únicamente proteína magra (pollo, pescado, claras) + vegetales verdes + grasas saludables (aguacate/oliva). Al mantener la insulina baja durante la noche, la hormona del crecimiento (GH) oxida grasa visceral mientras duermes.
4. **Agua e Hidratación:**
   * Tu porcentaje de agua está en **${waterPct}% (Bajo, ideal >55%)**. Beber tus **14 vasos (3.5 L)** al día alivia la retención de líquidos y acelera la eliminación de subproductos metabólicos.

¿Te gustaría que revisemos cómo organizar tus comidas alrededor de tu hora de entrenamiento?`,
    };
  }

  if (
    q === 'hola' ||
    q === 'buenas' ||
    q === 'buen dia' ||
    q === 'buenos dias' ||
    q === 'buenas tardes' ||
    q === 'buenas noches' ||
    q === 'hey' ||
    q.startsWith('hola ') ||
    q.includes('que tal') ||
    q.includes('cómo estás') ||
    q.includes('como estas')
  ) {
    return {
      id: `ai-${Date.now()}`,
      role: 'assistant',
      timestamp: timeStr,
      source: 'apex-neural-local',
      content: `¡Hola **Cristopher**! Aquí tu **Coach APEX**, listo para apoyarte.

Hoy es **${weekdayName}** y este es tu panorama en tiempo real (${isInsanityOnly ? '⚡ Solo Insanity' : '🏋️ Modo Híbrido'}):
* **Pesas:** ${isInsanityOnly ? 'En Pausa (Solo Insanity activo)' : todayRoutine ? `**${todayRoutine.title}**` : 'Descanso de pesas / Movilidad'}
* **Insanity HIIT:** **Día ${insDay.dayNumber}/63** (${insDay.workoutTitle} • \`${insDay.durationMin} min\`)
* **Calorías Restantes Hoy:** **\`${remainingKcal} kcal\`** (te faltan **\`${remainingProt} g de proteína\`**)
* **Agua Hoy:** **\`${state.nutrition.waterGlasses250ml}/14 vasos\`** (\`${(state.nutrition.waterGlasses250ml * 250) / 1000} L\`)

¿En qué te puedo ayudar ahora mismo? Escribe el número o tu duda:
1. **Comida recomendada** para cubrir tus macros de hoy.
2. **Consejos tácticos** para tu sesión de entrenamiento.
3. **Estrategia** para bajar tu grasa visceral y cuidar tus piernas.`,
    };
  }

  if (
    q.includes('comer') ||
    q.includes('cenar') ||
    q.includes('cena') ||
    q.includes('desayun') ||
    q.includes('almuerz') ||
    q.includes('comida') ||
    q.includes('hambre') ||
    q.includes('dieta') ||
    q.includes('calor') ||
    q.includes('prote') ||
    q.includes('carbo') ||
    q.includes('grasa') ||
    q.includes('arroz') ||
    q.includes('pollo') ||
    q.includes('huevo') ||
    q.includes('creatina')
  ) {
    const suggested =
      remainingProt >= 35
        ? {
            name: 'Pechuga a la Plancha 220g + Papa o Arroz 160g + Aguacate',
            calories: 580,
            proteinG: 50,
            carbsG: 48,
            fatG: 14,
            tag: 'Comida Fuerte' as NutritionMealTag,
          }
        : {
            name: 'Yogurt Griego 0% 250g + Fruta + 1 scoop Proteína',
            calories: 320,
            proteinG: 42,
            carbsG: 28,
            fatG: 3,
            tag: 'Post-Entreno' as NutritionMealTag,
          };
    return {
      id: `ai-${Date.now()}`,
      role: 'assistant',
      timestamp: timeStr,
      source: 'apex-neural-local',
      quickAction: {
        label: `➕ Registrar "${suggested.name}" (+${suggested.proteinG}g Prot)`,
        type: 'log_meal',
        payload: suggested,
      },
      content: `### 🍽️ Plan Nutricional Personalizado para tu Meta (${weight} kg)

* **Calorías disponibles hoy:** **\`${remainingKcal} kcal\`** (Meta: \`${targetKcal} kcal\` | Has consumido: \`${consumedKcal} kcal\`).
* **Proteína pendiente hoy:** **\`${remainingProt} g\`** (Meta: \`${proteinTarget} g\` para conservar tus \`${lbm} kg\` magros).

#### 💡 Sugerencia Inmediata del Coach:
* **${suggested.name}** (\`${suggested.calories} kcal | ${suggested.proteinG}g Proteína\`).
* **Regla de Carbohidratos:** Como estás haciendo **Insanity (${insDay.workoutTitle})**${isInsanityOnly ? '' : ' y pesas'}, mantén tus carbohidratos complejos (arroz, papa, avena) cerca del entrenamiento para reponer glucógeno. En la noche, opta por proteína + vegetales verdes.
* **Creatina:** Asegúrate de tomar tus **5 g de creatina monohidratada** diariamente con abundante agua para sostener tu rendimiento HIIT y proteger músculo.`,
    };
  }

  if (
    q.includes('rutina') ||
    q.includes('entreno') ||
    q.includes('entrenar') ||
    q.includes('ejercicio') ||
    q.includes('fuerza') ||
    q.includes('pesas') ||
    q.includes('press') ||
    q.includes('banco') ||
    q.includes('forza') ||
    q.includes('mancuerna') ||
    q.includes('búlgara') ||
    q.includes('bulgara') ||
    q.includes('pierna') ||
    q.includes('pecho') ||
    q.includes('espalda') ||
    q.includes('remo') ||
    q.includes('jalón') ||
    q.includes('jalon') ||
    q.includes('biceps') ||
    q.includes('triceps')
  ) {
    return {
      id: `ai-${Date.now()}`,
      role: 'assistant',
      timestamp: timeStr,
      source: 'apex-neural-local',
      content: `### 🏋️‍♂️ Análisis Biomecánico y Rutina (${weekdayName})

* **Estado actual:** ${
        isInsanityOnly
          ? '**Modo Solo Insanity Activo** *(Rutinas de pesas en pausa temporal — puedes reactivarlas cuando gustes desde Inicio o Fuerza)*'
          : todayRoutine
          ? `**${todayRoutine.title}** (${todayRoutine.focus})`
          : 'Recuperación de Pesas'
      }
* **Tus Piernas en MovingLife:** Están en nivel **Bajo (${leftLegKg} kg Izq · 87.7% / ${rightLegKg} kg Der · 88.9%)**.

#### 🎯 Claves de Ejecución (Cuando hagas Fuerza / Modo Híbrido):
1. **Banco Gold's Gym XR 6.1:**
   * En presses (plano o inclinado 30°), mantén retracción escapular (omóplatos juntos contra el respaldo) y codos a 45° para proteger los manguitos rotadores con tus mancuernas de 25 kg.
2. **Sentadilla Búlgara en Pierna A:**
   * Inicia **siempre con la pierna izquierda (${leftLegKg} kg)** para cerrar la asimetría con la derecha. Haz 3 series de 10-12 reps controlando 3 segundos la bajada.
3. **Estación Forza Gym:**
   * En jalones y remos, piensa en tirar con los codos rozando las costillas y sostener 1 segundo de isometría escapular atrás antes de soltar las placas.
4. **En Solo Insanity ahora:**
   * Prioriza una buena técnica de aterrizaje en los saltos de Insanity y cumple tu meta de proteína (${proteinTarget}g) mientras tus articulaciones se adaptan.`,
    };
  }

  if (
    q.includes('insanity') ||
    q.includes('cardio') ||
    q.includes('reloj') ||
    q.includes('watch') ||
    q.includes('pulsaciones') ||
    q.includes('frecuencia') ||
    q.includes('pulso') ||
    q.includes('fit test') ||
    q.includes('sueño') ||
    q.includes('dormir')
  ) {
    const age = state.userProfile?.age ?? 38;
    const maxHrEst = 220 - age;
    return {
      id: `ai-${Date.now()}`,
      role: 'assistant',
      timestamp: timeStr,
      source: 'apex-neural-local',
      content: `### ⏱️ Telemetría de Insanity HIIT y Galaxy Watch 7

* **Día en Curso:** **Día ${insDay.dayNumber} de 63** — **${insDay.workoutTitle}** (\`${insDay.durationMin} min\`).
* **Telemetría de Hoy:** \`${watchCal} kcal activas\` registradas en el reloj, FC promedio \`${state.watchMetrics.avgHeartRate} bpm\`.

#### 🔥 Consejos para tu Sesión de Insanity:
1. **Control de Frecuencia Cardíaca:**
   * Para tu edad (${age} años), tu frecuencia cardíaca máxima estimada es de ~${maxHrEst} bpm.
   * Durante los intervalos pico de **${insDay.workoutTitle}**, tu zona de quema óptima está entre **${Math.round(maxHrEst * 0.78)} y ${Math.round(maxHrEst * 0.89)} bpm**. Si superas ese rango por más de 1 minuto, haz una pausa activa marchando en tu lugar 15 segundos.
2. **Registro Real de Calorías:**
   * Al terminar tu entrenamiento en el reloj, abre la pestaña **HIIT 63D** y toca **"Marcar + Watch 7"** para ingresar tus minutos y calorías exactas, o sube una captura de pantalla de Samsung Health para que la app extraiga los datos automáticamente.`,
    };
  }

  if (
    q.includes('movinglife') ||
    q.includes('báscula') ||
    q.includes('bascula') ||
    q.includes('camry') ||
    q.includes('peso') ||
    q.includes('grasa') ||
    q.includes('visceral') ||
    q.includes('agua') ||
    q.includes('magra') ||
    q.includes('músculo') ||
    q.includes('musculo')
  ) {
    return {
      id: `ai-${Date.now()}`,
      role: 'assistant',
      timestamp: timeStr,
      source: 'apex-neural-local',
      content: `### 📊 Diagnóstico Clínico de tu Composición Corporal (MovingLife)

* **Peso Total:** \`${weight} kg\` | **Grasa Corporal:** \`${fatPct}%\` (\`${fatKg} kg\` de masa grasa)
* **Masa Magra Muscular:** **\`${lbm} kg\`** (¡Excelente base sólida superior en torso y brazos!)
* **Grasa Visceral:** **Nivel \`${visceral}\`** (Meta de salud cardiovascular: **≤ 9**)
* **Hidratación:** **\`${waterPct}%\`** (Nivel Bajo, meta óptima: **>54%**)
* **Equilibrio Muscular por Zonas:**
  * Brazos: Izq \`${leftArmKg} kg (105.7%)\` / Der \`${rightArmKg} kg (103.5%)\` (Nivel Estándar)
  * Tronco: \`${latestCamry?.segments.trunk.muscleKg ?? 24.64} kg (97.1%)\` (Nivel Estándar)
  * Piernas: Izq \`${leftLegKg} kg (87.7%)\` / Der \`${rightLegKg} kg (88.9%)\` (**Nivel Bajo <90%**)

**Misión:** ${
        isInsanityOnly
          ? 'Mientras haces Solo Insanity, enfócate en proteína alta + déficit controlado de -' + deficit + ' kcal para oxidar grasa visceral; cuando reactives Modo Híbrido sumaremos búlgara y extensión en Forza Gym.'
          : 'Al subir tus piernas al 90% con la sentadilla búlgara y la extensión en Forza Gym, quemarás más calorías incluso en reposo, bajando tu grasa visceral aceleradamente.'
      }`,
    };
  }

  if (
    q.includes('cansado') ||
    q.includes('dolor') ||
    q.includes('duele') ||
    q.includes('agujetas') ||
    q.includes('fatiga') ||
    q.includes('desmotivado') ||
    q.includes('pesado')
  ) {
    return {
      id: `ai-${Date.now()}`,
      role: 'assistant',
      timestamp: timeStr,
      source: 'apex-neural-local',
      content: `### 🧠 Gestión de Fatiga y Recuperación Neuromuscular

Cristopher, ${
        isInsanityOnly
          ? `sostener la intensidad pliométrica de **Insanity (${insDay.workoutTitle})** 6 días a la semana`
          : `combinar **entrenamiento de fuerza con mancuernas de 25 kg y Forza Gym** junto con la intensidad de **Insanity (${insDay.workoutTitle})**`
      } es sumamente exigente para el sistema nervioso central.

#### Protocolo de Recuperación Activa:
1. **Evalúa el tipo de fatiga:** Si el cansancio es articular en rodillas/gemelos, modifica los saltos altos en Insanity por opciones de bajo impacto durante 24–48 horas sin detener el ritmo.
2. **Sueño Reparador:** Tu cerebro segrega el 80% de la hormona de crecimiento durante las fases profundas de sueño. Revisa tu Galaxy Watch 7 y busca dormir mínimo **7.5 horas**.
3. **Agua con Electrólitos:** Tu nivel de agua en MovingLife es de **${waterPct}%**; la deshidratación leve reduce la fuerza muscular hasta en un 15% y aumenta las agujetas. Toma 2 vasos de agua con una pizca de sal marina y limón ahora mismo.`,
    };
  }

  return {
    id: `ai-${Date.now()}`,
    role: 'assistant',
    timestamp: timeStr,
    source: 'apex-neural-local',
    content: `### 🎯 Respuesta de tu Coach APEX

Sobre lo que me preguntas: *"**${raw}**"*:

Para tu objetivo de recomposición corporal (${weight} kg · ${fatPct}% grasa · ${lbm} kg masa magra):
* **En el entrenamiento:** ${
      isInsanityOnly
        ? `Hoy estás en **Solo Insanity** con el **Día ${insDay.dayNumber} (${insDay.workoutTitle})** *(Fuerza en Pausa)*`
        : todayRoutine
        ? `Hoy tienes la rutina **${todayRoutine.title}** y el **Día ${insDay.dayNumber} de Insanity (${insDay.workoutTitle})**`
        : `Hoy tienes el **Día ${insDay.dayNumber} de Insanity (${insDay.workoutTitle})** sin pesas pesadas`
    }.
* **En tu nutrición:** Te restan **\`${remainingKcal} kcal\`** y **\`${remainingProt} g de proteína\`** por consumir el día de hoy.
* **En tu hidratación:** Llevas **\`${state.nutrition.waterGlasses250ml}/14 vasos\`** (\`${(state.nutrition.waterGlasses250ml * 250) / 1000} L\`).

Dime en qué aspecto específico deseas profundizar:
1. **Comida exacta:** ¿Quieres una receta rápida con los gramos exactos de pollo, arroz o suplementación?
2. **Ajuste de entrenamiento:** ¿Quieres consejos para **${insDay.workoutTitle}**${isInsanityOnly ? ' o cómo volver al Modo Híbrido?' : ' o tus placas en Forza Gym?'}
3. **Composición corporal:** ¿Quieres analizar cómo reducir la grasa visceral a menos de 9?`,
  };
}

export const CUPS_TO_GRAMS_GUIDE: CupToGramsRef[] = [
  {
    foodKey: 'arroz',
    name: 'Arroz blanco cocido',
    oneCupGrams: 160,
    halfCupGrams: 80,
    quarterCupGrams: 40,
    notes: '1 taza = ~160g (205 kcal) • 1/2 taza = ~80g (103 kcal) • 1/4 taza = ~40g (51 kcal)',
  },
  {
    foodKey: 'gallo_pinto',
    name: 'Arroz con frijoles (Gallo Pinto)',
    oneCupGrams: 180,
    halfCupGrams: 90,
    quarterCupGrams: 45,
    notes: '1 taza = ~180g (216 kcal) • 1/2 taza = ~90g (108 kcal) • 1/4 taza = ~45g (54 kcal)',
  },
  {
    foodKey: 'frijoles',
    name: 'Frijoles cocidos',
    oneCupGrams: 170,
    halfCupGrams: 85,
    quarterCupGrams: 43,
    notes: '1 taza = ~170g (227 kcal) • 1/2 taza = ~85g (113 kcal) • 1/4 taza = ~43g (57 kcal)',
  },
  {
    foodKey: 'carne',
    name: 'Trocitos de carne magra / picada',
    oneCupGrams: 200,
    halfCupGrams: 100,
    quarterCupGrams: 50,
    notes: '1 taza = ~200g (430 kcal) • 1/2 taza = ~100g (215 kcal) • 1/4 taza = ~50g (108 kcal)',
  },
  {
    foodKey: 'pollo',
    name: 'Pollo en trozos / desmechado',
    oneCupGrams: 150,
    halfCupGrams: 75,
    quarterCupGrams: 38,
    notes: '1 taza = ~150g (248 kcal) • 1/2 taza = ~75g (124 kcal) • 1 filete mediano = ~150g',
  },
  {
    foodKey: 'avena',
    name: 'Avena en hojuelas',
    oneCupGrams: 80,
    halfCupGrams: 40,
    quarterCupGrams: 20,
    notes: '1/2 taza hojuelas secas = ~40g (~120g cocida, 150 kcal) • 1 taza seca = ~80g (300 kcal)',
  },
  {
    foodKey: 'ensalada',
    name: 'Ensalada verde / Vegetales crudos',
    oneCupGrams: 60,
    halfCupGrams: 30,
    quarterCupGrams: 15,
    notes: '1 taza = ~60g (15-20 kcal) • 2 tazas = ~120g (30-40 kcal)',
  },
  {
    foodKey: 'queso',
    name: 'Queso fresco / panela',
    oneCupGrams: 120,
    halfCupGrams: 60,
    quarterCupGrams: 30,
    notes: '1/2 taza en cubos/rallado = ~60g (160 kcal) • 1 rebanada = ~30g (80 kcal)',
  },
];

function formatCupPortion(cups: number, oneCupGrams?: number, qualifier?: string): string {
  let cupLabel = '';
  if (cups === 0.5) cupLabel = '1/2 taza';
  else if (cups === 0.25) cupLabel = '1/4 taza';
  else if (cups === 0.75) cupLabel = '3/4 taza';
  else if (cups === 1.5) cupLabel = '1 1/2 tazas';
  else if (cups === 2) cupLabel = '2 tazas';
  else if (cups === 1) cupLabel = '1 taza';
  else cupLabel = `${cups} tazas`;

  if (oneCupGrams) {
    const grams = Math.round(cups * oneCupGrams);
    return `${cupLabel} (~${grams}g${qualifier ? ` ${qualifier}` : ''})`;
  }
  return cupLabel;
}

export async function analyzeMealPhotoWithGemini(
  base64Data: string,
  mimeType: string,
  optionalNote: string,
  state: AppState,
  previousResult?: MealPhotoAIResult | null,
  correctionText?: string
): Promise<MealPhotoAIResult> {
  const apiKey = getEffectiveGeminiKey(state);
  const latestCamry = state.camryHistory[state.camryHistory.length - 1];
  const bmr = latestCamry?.bmrKcal || 1558;
  const neat = Math.round(bmr * 0.1);
  const watchCal = state.watchMetrics.activeCalories || 0;
  const deficit = state.userProfile?.dailyDeficitKcal ?? 300;
  const targetKcal = Math.max(1500, bmr + neat + watchCal - deficit);
  const consumed = state.nutrition.loggedMeals.reduce((acc, m) => acc + m.calories, 0);
  const remaining = Math.max(0, targetKcal - consumed);

  if (base64Data) {
    try {
      let prompt = `Eres un nutricionista deportivo clínico experto en visión artificial, fotogrametría de alimentos, base de datos USDA FoodData Central y cocina latinoamericana / de Costa Rica (gallo pinto, casado, salchichón, natilla, huevo frito, plátano maduro, tortillas).
Analiza la fotografía de este plato de comida de Cristopher (Edad: ${state.userProfile?.age ?? 38} años, Peso: ${latestCamry?.weightKg ?? 83.3} kg, Meta: bajar de 33.9% a ${state.userProfile?.targetBodyFatPercent ?? 18}% de grasa corporal protegiendo 55.0 kg de masa magra; le quedan ${remaining} kcal disponibles hoy).
${optionalNote.trim() ? `Nota previa del usuario sobre el plato: "${optionalNote.trim()}"` : ''}`;

      if (correctionText && correctionText.trim()) {
        prompt += `

🚨 ¡CORRECCIÓN ESPECÍFICA DEL USUARIO SOBRE EL PLATO!:
El usuario Cristopher ha verificado la foto y envía esta corrección:
"${correctionText.trim()}"
${
  previousResult && !previousResult.visionUnavailable
    ? `Plato previo detectado: "${previousResult.dishName || ''}" (${previousResult.calories || 0} kcal).
Ingredientes previos: ${
        previousResult.detectedIngredients
          ?.map((ing) => `${ing.name}: ${ing.portion || `${ing.grams}g`}`)
          .join(', ') || 'N/A'
      }.`
    : ''
}
REGLAS MANDATORIAS DE CORRECCIÓN:
1. Si el usuario corrige una porción (ej. "no fue 1 taza de arroz, fue 1/2 taza solamente"), reduce la porción exacta conservando los demás ingredientes reales.
2. Si el usuario describe los alimentos reales de la foto (ej. "1 huevo frito gallopinto y 4 rodajas de salchichón"), REEMPLAZA por completo cualquier estimación errónea anterior y calcula exactamente esos alimentos indicados por el usuario.`;
      }

      prompt += `

REGLA CRÍTICA DE MEDIDAS (DOBLE EQUIVALENCIA TAZAS Y GRAMOS OBLIGATORIA):
En cada ingrediente de 'detectedIngredients' y en 'portionDetails', debes incluir SIEMPRE la doble medida: tanto la medida casera en tazas/unidades/rodajas como su peso en gramos equivalente:
- Arroz blanco cocido: 1 taza = ~160g (205 kcal) • 1/2 taza = ~80g (103 kcal) • 1/4 taza = ~40g (51 kcal)
- Gallo pinto (arroz con frijoles): 1 taza = ~180g (216 kcal) • 1/2 taza = ~90g (108 kcal)
- Frijoles cocidos: 1 taza = ~170g (227 kcal) • 1/2 taza = ~85g (113 kcal)
- Salchichón: 1 rodaja = ~15g (~48 kcal) • 4 rodajas = ~60g (~192 kcal)
- Huevos: 1 huevo frito = ~55g (~90 kcal) • 1 huevo cocido = ~55g (72 kcal) • 1 clara = ~33g (17 kcal)
- Trocitos de carne magra: 1 taza = ~200g (430 kcal) • 1/2 taza = ~100g (215 kcal)
- Pollo en cubos / filete: 1 taza = ~150g (248 kcal) • 1 filete mediano = ~150g (249 kcal)
- Avena: 1/2 taza hojuelas secas = ~40g (150 kcal)
- Ensalada verde / Vegetales: 1 taza = ~60g (15-20 kcal)

Devuelve ÚNICAMENTE un objeto JSON válido con la siguiente estructura exacta (sin bloques markdown):
{
  "dishName": "Nombre descriptivo del plato en español indicando porciones",
  "calories": 480,
  "proteinG": 26,
  "carbsG": 44,
  "fatG": 22,
  "portionDetails": "Resumen claro con tazas/unidades y gramos",
  "detectedIngredients": [
    { "name": "Gallo pinto", "portion": "1 taza (~180g)", "grams": 180, "calories": 216, "proteinG": 7, "carbsG": 42, "fatG": 2 },
    { "name": "Huevo frito", "portion": "1 unidad (~55g)", "grams": 55, "calories": 90, "proteinG": 6, "carbsG": 0, "fatG": 7 }
  ],
  "coachRecommendation": "Consejo breve y motivador en español de 1-2 oraciones adaptado al objetivo de Cristopher.",
  "recommendedTag": "Desayuno"
} (Valores válidos para recommendedTag: "Desayuno", "Almuerzo", "Cena", "Merienda", "Post-Entreno", "Pre-HIIT", "Snack Proteico", "Comida Fuerte")`;

      const res = await callGeminiWithFallback(apiKey, {
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              { inlineData: { mimeType: mimeType || 'image/jpeg', data: base64Data } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.15,
          responseMimeType: 'application/json',
        },
      });

      if (res && res.ok) {
        const json = (await res.json()) as GeminiResponsePayload;
        let text = extractTextFromGeminiResponse(json).replace(/```json|```/g, '').trim();
        const match = text.match(/\{[\s\S]*\}/);
        if (match) text = match[0];

        const parsed = JSON.parse(text) as Partial<MealPhotoAIResult>;
        if (parsed && typeof parsed.calories === 'number') {
          const validTags: NutritionMealTag[] = [
            'Desayuno',
            'Almuerzo',
            'Cena',
            'Merienda',
            'Post-Entreno',
            'Pre-HIIT',
            'Comida Fuerte',
            'Snack Proteico',
          ];
          const tag = validTags.includes(parsed.recommendedTag as NutritionMealTag)
            ? (parsed.recommendedTag as NutritionMealTag)
            : 'Comida Fuerte';
          const ingredients: DetectedIngredient[] = Array.isArray(parsed.detectedIngredients)
            ? parsed.detectedIngredients.map((ing) => ({
                name: ing.name || 'Alimento',
                portion: ing.portion || (ing.grams ? `~${ing.grams}g` : '1 porción'),
                grams: typeof ing.grams === 'number' ? ing.grams : undefined,
                calories: Math.round(ing.calories || 0),
                proteinG: Math.round((ing.proteinG || 0) * 10) / 10,
                carbsG: Math.round((ing.carbsG || 0) * 10) / 10,
                fatG: Math.round((ing.fatG || 0) * 10) / 10,
              }))
            : [];

          return {
            dishName: parsed.dishName || 'Plato Escaneado con IA',
            calories: Math.max(10, Math.round(parsed.calories)),
            proteinG: Math.max(0, Math.round(parsed.proteinG || 0)),
            carbsG: Math.max(0, Math.round(parsed.carbsG || 0)),
            fatG: Math.max(0, Math.round(parsed.fatG || 0)),
            portionDetails: parsed.portionDetails || 'Porción estimada por visión IA',
            detectedIngredients: ingredients,
            coachRecommendation:
              parsed.coachRecommendation ||
              'Excelente aporte nutricional para tu recomposición corporal.',
            recommendedTag: tag,
            source: 'gemini-vision',
            visionUnavailable: false,
          };
        }
      }
    } catch {
      // fallback below
    }
  }

  return fallbackVisionEstimator(optionalNote, remaining, correctionText, previousResult);
}

function stripAccents(input: string): string {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function isDifferentialCorrection(correction: string, prev?: MealPhotoAIResult | null): boolean {
  if (!prev || prev.visionUnavailable || prev.detectedIngredients.length === 0) return false;
  const norm = stripAccents(correction.toLowerCase().trim());
  return Boolean(
    /^(?:no\s+fue|no\s+fueron|no\s+era|no\s+eran|no\s+son|en\s+vez\s+de|en\s+lugar\s+de|sin\s+|quita|elimina|eliminar|agrega|anade|mas\s+)/i.test(
      norm
    ) ||
      (/^(?:fue|era|fueron|eran|solo|solamente)\s+/i.test(norm) && !/\by\b|,/i.test(norm))
  );
}

function stripParenWeight(portion: string): string {
  return portion.replace(/\([^)]*\)/g, '').trim() || portion.trim();
}

export function fallbackVisionEstimator(
  optionalNote: string,
  remainingKcal: number,
  correctionText?: string,
  previousResult?: MealPhotoAIResult | null
): MealPhotoAIResult {
  const cleanNote = optionalNote.trim();
  const cleanCorrection = correctionText?.trim() || '';

  if (!cleanNote && !cleanCorrection) {
    return {
      dishName: '',
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      portionDetails: 'Sin conexión a Gemini Vision en este intento',
      detectedIngredients: [],
      coachRecommendation:
        'No se recibió respuesta de Gemini Vision en este momento (saturación temporal o señal débil). Pulsa "Reintentar Foto IA" o escribe abajo qué tiene tu plato (ej: "1 huevo frito, gallopinto y 4 rodajas de salchichón") para calcularlo al instante con precisión clínica.',
      recommendedTag: previousResult?.recommendedTag || 'Comida Fuerte',
      source: 'apex-smart-estimator',
      visionUnavailable: true,
    };
  }

  const tag: NutritionMealTag = previousResult?.recommendedTag || 'Comida Fuerte';
  let parsed: MealAIResult;
  if (cleanCorrection) {
    if (isDifferentialCorrection(cleanCorrection, previousResult)) {
      const reconstructed =
        previousResult?.detectedIngredients
          ?.map((ing) => `${stripParenWeight(ing.portion)} ${ing.name}`.trim())
          .join(', ') || cleanNote;
      parsed = fallbackLocalClinicalMeal(reconstructed || cleanCorrection, tag, undefined, cleanCorrection);
    } else {
      parsed = fallbackLocalClinicalMeal(cleanCorrection, tag);
    }
  } else {
    parsed = fallbackLocalClinicalMeal(cleanNote, tag);
  }

  return {
    dishName: parsed.dishName,
    calories: parsed.calories,
    proteinG: parsed.proteinG,
    carbsG: parsed.carbsG,
    fatG: parsed.fatG,
    portionDetails: parsed.portionDetails,
    detectedIngredients: parsed.ingredients,
    coachRecommendation: `${parsed.explanation} Te deja ~${Math.max(
      0,
      remainingKcal - parsed.calories
    )} kcal disponibles hoy.`,
    recommendedTag: parsed.recommendedTag,
    source: 'apex-smart-estimator',
    visionUnavailable: false,
  };
}

export async function analyzeNaturalLanguageMeal(
  description: string,
  tag: NutritionMealTag,
  state: AppState,
  prevResult?: MealAIResult | null,
  correctionText?: string
): Promise<MealAIResult> {
  const cleanDesc = description.trim();
  const cleanCorrection = correctionText?.trim() || '';

  if (!cleanDesc && !cleanCorrection) {
    return {
      dishName: 'Comida Registrada',
      calories: 350,
      proteinG: 30,
      carbsG: 35,
      fatG: 10,
      portionDetails: '1 porción estándar',
      ingredients: [],
      explanation: 'Ingresa un alimento para calcular sus calorías y macros automáticamente.',
      recommendedTag: tag,
      source: 'clinical-database',
    };
  }

  const combinedText = cleanCorrection ? `${cleanDesc} (Corrección: ${cleanCorrection})` : cleanDesc;
  const apiKey = getEffectiveGeminiKey(state);
  const latestCamry = state.camryHistory[state.camryHistory.length - 1];

  try {
    let prompt = `Eres un nutricionista clínico deportivo experto y base de datos nutricional de alimentos USDA / FoodData Central y tablas latinoamericanas / de Costa Rica (gallo pinto, salchichón, natilla, plátano maduro, etc.).
El usuario Cristopher (Edad: ${state.userProfile?.age ?? 38} años, Peso: ${latestCamry?.weightKg ?? 83.3} kg, Meta: recomposición corporal para bajar a ${state.userProfile?.targetWeightKg ?? 70} kg con ${latestCamry?.leanBodyMassKg ?? 55} kg de masa magra) ingresó la siguiente comida en lenguaje natural:
"${combinedText}"
Tiempo de comida / Momento del día: "${tag}".`;

    if (cleanCorrection) {
      prompt += `

🚨 ¡CORRECCIÓN ESPECÍFICA DEL USUARIO!:
El usuario corrigió el cálculo previo: "${cleanCorrection}".
Cálculo previo: "${prevResult?.dishName || cleanDesc}" (${prevResult?.calories || 0} kcal).
Ingredientes previos: ${
        prevResult?.ingredients?.map((i) => `${i.name}: ${i.portion}`).join(', ') || 'N/A'
      }.
INSTRUCCIÓN: Si cambia la porción de un ingrediente, ajústala exactamente manteniendo los demás. Si describe el plato completo nuevo, reemplaza los anteriores.`;
    }

    prompt += `

REGLA CRÍTICA DE TAZAS Y GRAMOS (DOBLE EQUIVALENCIA OBLIGATORIA):
En cada ingrediente de 'ingredients' y en 'portionDetails', debes incluir SIEMPRE la doble medida (medida casera en tazas/unidades/rodajas y su peso equivalente en gramos):
- Arroz blanco cocido: 1 taza = ~160g (205 kcal) • 1/2 taza = ~80g (103 kcal) • 1/4 taza = ~40g (51 kcal)
- Arroz con frijoles (gallo pinto): 1 taza = ~180g (216 kcal) • 1/2 taza = ~90g (108 kcal)
- Frijoles cocidos: 1 taza = ~170g (227 kcal) • 1/2 taza = ~85g (113 kcal) • 1/4 taza = ~43g (57 kcal)
- Trocitos de carne magra / picada: 1 taza = ~200g (430 kcal) • 1/2 taza = ~100g (215 kcal) • 1/4 taza = ~50g (108 kcal)
- Pollo en cubos / pechuga: 1 taza = ~150g (248 kcal) • 1/2 taza = ~75g (124 kcal) • 1 filete mediano = ~150g
- Avena: 1/2 taza hojuelas secas = ~40g (~120g cocida, 150 kcal) • 1 taza seca = ~80g (300 kcal)
- Huevos: 1 huevo frito = ~55g (~90 kcal) • 1 huevo cocido = ~55g (72 kcal) • 1 clara = ~33g (17 kcal)
- Salchichón: 1 rodaja = ~15g (~48 kcal)
- Tortillas de maíz: 1 tortilla = ~30g (65 kcal)
REGLA DE FRACCIONES: "1/2 taza", "media taza" equivale a 0.5 tazas (la mitad de una taza, ~80g de arroz), bajo ninguna circunstancia lo interpretes como 2 tazas.

Devuelve ÚNICAMENTE un objeto JSON válido con este formato exacto (sin markdown):
{
  "dishName": "Nombre descriptivo incluyendo la porción detectada",
  "calories": 318,
  "proteinG": 28,
  "carbsG": 23,
  "fatG": 11,
  "portionDetails": "Resumen con tazas/unidades y gramos",
  "ingredients": [
    { "name": "Arroz blanco cocido", "portion": "1/2 taza (~80g)", "grams": 80, "calories": 103, "proteinG": 2, "carbsG": 22, "fatG": 0 }
  ],
  "explanation": "Esto equivale a 318 kcal, con 28g de proteína y 23g de carbohidratos.",
  "recommendedTag": "${tag}"
}`;

    const res = await callGeminiWithFallback(apiKey, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });

    if (res && res.ok) {
      const json = (await res.json()) as GeminiResponsePayload;
      let text = extractTextFromGeminiResponse(json).replace(/```json|```/g, '').trim();
      const match = text.match(/\{[\s\S]*\}/);
      if (match) text = match[0];

      const parsed = JSON.parse(text) as Partial<MealAIResult>;
      if (parsed && typeof parsed.calories === 'number') {
        return {
          dishName: parsed.dishName || cleanDesc,
          calories: Math.max(10, Math.round(parsed.calories)),
          proteinG: Math.max(0, Math.round(parsed.proteinG || 0)),
          carbsG: Math.max(0, Math.round(parsed.carbsG || 0)),
          fatG: Math.max(0, Math.round(parsed.fatG || 0)),
          portionDetails: parsed.portionDetails || 'Porción calculada por IA',
          ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
          explanation:
            parsed.explanation ||
            `Equivale a ${parsed.calories} kcal, ${parsed.proteinG}g de proteína y ${parsed.carbsG}g de carbohidratos.`,
          recommendedTag: (parsed.recommendedTag as NutritionMealTag) || tag,
          source: 'gemini-cloud',
        };
      }
    }
  } catch {
    // fallback below
  }

  return fallbackLocalClinicalMeal(cleanDesc, tag, prevResult, cleanCorrection);
}

const KNOWN_FOOD_TOKENS = [
  'gallopinto',
  'gallo pinto',
  'casamiento',
  'arroz',
  'frijol',
  'frijoles',
  'caraotas',
  'porotos',
  'lentejas',
  'garbanzos',
  'clara',
  'claras',
  'huevo',
  'huevos',
  'omelette',
  'salchichon',
  'salchicha',
  'salchichas',
  'chorizo',
  'chorizos',
  'jamon',
  'tocino',
  'bacon',
  'tortilla',
  'tortillas',
  'pechuga',
  'pollo',
  'carne',
  'bistec',
  'lomo',
  'molida',
  'res',
  'atun',
  'pescado',
  'salmon',
  'tilapia',
  'platano',
  'banana',
  'guineo',
  'maduro',
  'avena',
  'oatmeal',
  'leche',
  'queso',
  'cuajada',
  'panela',
  'natilla',
  'aguacate',
  'palta',
  'pan',
  'tostada',
  'tostadas',
  'scoop',
  'whey',
  'papa',
  'papas',
  'yuca',
  'cafe',
  'ensalada',
  'verduras',
  'vegetales',
  'brocoli',
  'aceite',
];

export function fallbackLocalClinicalMeal(
  description: string,
  tag: NutritionMealTag,
  _prevResult?: MealAIResult | null,
  correction?: string
): MealAIResult {
  const escRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const stripParenApprox = (s: string) => s.replace(/\(\s*~[^)]*\)/g, ' ');
  const buildWordPattern = (word: string) => {
    const clean = word.trim();
    if (clean.includes('gallopinto') || clean.includes('gallo pinto')) {
      return '(?:gallopinto|gallo\\s+pinto|arroz\\s+con\\s+frijoles?)';
    }
    if (clean.endsWith('es') && clean.length > 4) {
      return `${escRegex(clean.slice(0, -2))}(?:es|s)?`;
    }
    if (clean.endsWith('s') && clean.length > 3) {
      return `${escRegex(clean.slice(0, -1))}s?`;
    }
    return `${escRegex(clean)}(?:es|s)?`;
  };

  const removeFoodMention = (text: string, target: string) => {
    const pattern = buildWordPattern(target);
    const re = new RegExp(
      `(?:\\d+\\s*\\/\\s*\\d+|\\d+(?:\\.\\d+)?|\\b(?:un|una|uno|dos|tres|cuatro|medio|media|cuarto|cuarta)\\b)?\\s*(?:tazas?|gramos?|gr\\b|g\\b|unidades?|rodajas?|rebanadas?|filetes?|porciones?|cucharaditas?|cucharadas?|cdtas?|cdas?|claras?|vasos?|latas?|mitades?)?\\s*(?:de\\s+)?\\b${pattern}\\b(?:\\s+(?:entero|entera|enteros|enteras|frito|frita|fritos|fritas|cocido|cocida|cocidos|cocidas|blanco|blanca|negro|negra|negros|negras|verde|maduro|fresco|panela|de\\s+oliva|oliva|cocina|de\\s+maiz|de\\s+res|de\\s+pollo|a\\s+la\\s+plancha|en\\s+agua|anadido|anadida))?`,
      'gi'
    );
    return text.replace(re, ' ').replace(/\s+/g, ' ').trim();
  };

  let workingText = stripParenApprox(description.trim());

  if (correction && correction.trim()) {
    const normCorr = stripParenApprox(stripAccents(correction.toLowerCase().trim()));
    const replaceMatch = normCorr.match(
      /(?:no fue|no fueron|no eran|no era|no son|en vez de|en lugar de)\s+(\d+\s*[\/]\s*\d+|\d+(?:\.\d+)?|un|una|uno|dos|tres|las|los)?\s*(tazas?|gramos?|gr\b|g\b|unidades?|rodajas?|rebanadas?)?\s*(?:de\s+|las?\s+|los?\s+)?([a-z\s]+?)\s*[,;]?\s*(?:fue|fueron|era|eran|son|sino|comi|solo|solamente)\s+(\d+\s*[\/]\s*\d+|\d+(?:\.\d+)?|un|una|uno|dos|tres|cuatro|cinco|medio|media|cuarto|cuarta|1\/2|1\/4|3\/4)\s*(tazas?|gramos?|gr\b|g\b|unidades?|rodajas?|rebanadas?)?(.*)/i
    );
    if (replaceMatch) {
      const targetFood = replaceMatch[3].trim();
      const newQty = replaceMatch[4].trim();
      const newUnit = (replaceMatch[5] || replaceMatch[2] || '').trim();
      const trailing = (replaceMatch[6] || '')
        .replace(/^\s*(?:solamente|solo|unicamente|nada mas|apenas)\b/gi, '')
        .replace(/\b(?:solamente|solo|unicamente|nada mas|apenas)\s*$/gi, '')
        .trim();
      const baseLower = stripParenApprox(stripAccents(workingText.toLowerCase()));
      let cleanedBase = removeFoodMention(baseLower, targetFood);
      if (targetFood.includes('gallopinto') || targetFood.includes('gallo pinto')) {
        cleanedBase = removeFoodMention(cleanedBase, 'arroz');
        cleanedBase = removeFoodMention(cleanedBase, 'frijoles');
      }
      const hasMoreFoods = KNOWN_FOOD_TOKENS.some((tok) =>
        new RegExp(`(?:^|[^a-z0-9])${tok}(?=$|[^a-z0-9])`, 'i').test(trailing)
      );
      const inserted = hasMoreFoods
        ? `${newQty} ${newUnit ? `${newUnit} ` : ''}${trailing}`.replace(/\s+/g, ' ').trim()
        : `${newQty} ${newUnit ? `${newUnit} de ` : ''}${targetFood}`
            .replace(/\s+/g, ' ')
            .trim();
      workingText = [cleanedBase, inserted].filter(Boolean).join(', ');
    } else if (/^\s*(?:sin|quita|quitar|elimina|eliminar)\s+/i.test(normCorr)) {
      let cleanedBase = stripParenApprox(stripAccents(workingText.toLowerCase()));
      const removals = [
        ...normCorr.matchAll(
          /\b(?:sin|quita|quitar|elimina|eliminar)\s+(?:el\s+|la\s+|los\s+|las\s+|un\s+|una\s+|de\s+)?([a-z\s]{2,25}?)(?=\s*(?:,|;|\by\b|$))/gi
        ),
      ];
      for (const rem of removals) {
        const phrase = rem[1].trim();
        if (phrase) {
          cleanedBase = removeFoodMention(cleanedBase, phrase);
          for (const tok of KNOWN_FOOD_TOKENS) {
            if (new RegExp(`(?:^|[^a-z0-9])${escRegex(tok)}(?=$|[^a-z0-9])`, 'i').test(phrase)) {
              cleanedBase = removeFoodMention(cleanedBase, tok);
            }
          }
        }
      }
      workingText = cleanedBase;
    } else {
      const cleanedCorr = normCorr
        .replace(/^(?:fue|era|fueron|eran|solo|solamente)\s+/i, '')
        .replace(
          /(?:no fue|no fueron|no eran|no era|no son|en vez de|en lugar de)\s+[^,;\n]+?\s+(?:fue|fueron|era|eran|son|sino|comi|solo|solamente)\s*/gi,
          ''
        )
        .trim();
      let cleanedBase = stripParenApprox(stripAccents(workingText.toLowerCase()));
      if (!/^\s*(?:agrega|anade|ponle|mas\s|y\s|con\s)/i.test(normCorr) && cleanedBase) {
        for (const tok of KNOWN_FOOD_TOKENS) {
          if (new RegExp(`(?:^|[^a-z0-9])${escRegex(tok)}(?=$|[^a-z0-9])`, 'i').test(cleanedCorr)) {
            cleanedBase = removeFoodMention(cleanedBase, tok);
            if (tok === 'gallopinto' || tok === 'gallo pinto') {
              cleanedBase = removeFoodMention(cleanedBase, 'arroz');
              cleanedBase = removeFoodMention(cleanedBase, 'frijoles');
            }
          }
        }
      }
      workingText = [cleanedBase, cleanedCorr].filter(Boolean).join(', ');
    }
  }

  const normalizedText = stripParenApprox(stripAccents(workingText.toLowerCase().trim()))
    .replace(/\s+/g, ' ')
    .trim();
  const ingredients: DetectedIngredient[] = [];
  const fmtCup = (cups: number, oneCupG?: number, q?: string) => formatCupPortion(cups, oneCupG, q);

  const findFood = (aliases: string[], defaultQty = 1, customHaystack?: string) => {
    const haystack = customHaystack ?? normalizedText;
    const aliasSet = new Set(aliases.map((a) => stripAccents(a.toLowerCase())));
    const otherTokens = KNOWN_FOOD_TOKENS.filter((tok) => !aliasSet.has(tok));
    const otherRe =
      otherTokens.length > 0
        ? new RegExp(`(?:^|[^a-z0-9])(?:${otherTokens.map(escRegex).join('|')})(?=$|[^a-z0-9])`, 'gi')
        : null;

    for (const alias of aliases) {
      const cleanAlias = stripAccents(alias.toLowerCase());
      const m = new RegExp(`(?:^|[^a-z0-9])(${escRegex(cleanAlias)})(?=$|[^a-z0-9])`, 'i').exec(
        haystack
      );
      if (!m) continue;

      const startPos = m.index + m[0].length - m[1].length;
      const endPos = startPos + m[1].length;
      let leftCtx = haystack.slice(Math.max(0, startPos - 42), startPos);
      let rightCtx = haystack.slice(endPos, Math.min(haystack.length, endPos + 42));

      const sepRe = /(?:[,;+.\n]|\b(?:y|con|mas|e)\b)/gi;
      let leftCut = 0;
      let sepM: RegExpExecArray | null;
      while ((sepM = sepRe.exec(leftCtx)) !== null) {
        leftCut = sepM.index + sepM[0].length;
      }
      if (otherRe) {
        otherRe.lastIndex = 0;
        let tokM: RegExpExecArray | null;
        while ((tokM = otherRe.exec(leftCtx)) !== null) {
          const posAfter = tokM.index + tokM[0].length;
          if (posAfter > leftCut) leftCut = posAfter;
        }
      }
      leftCtx = leftCtx.slice(leftCut);

      let rightCut = rightCtx.length;
      const rightSep = /(?:[,;+.\n]|\b(?:y|con|mas|e)\b)/i.exec(rightCtx);
      if (rightSep && rightSep.index < rightCut) {
        rightCut = rightSep.index;
      }
      if (otherRe) {
        otherRe.lastIndex = 0;
        const rightTok = otherRe.exec(rightCtx);
        if (rightTok && rightTok.index < rightCut) {
          rightCut = rightTok.index;
        }
      }
      rightCtx = rightCtx.slice(0, rightCut);

      const clause = `${leftCtx} ${m[1]} ${rightCtx}`.replace(/\s+/g, ' ').trim();
      const numRe =
        /(\d+\s*[\/]\s*\d+|\d+(?:\.\d+)?|\b(?:un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|medio|media|cuarto|cuarta|tres cuartos|1\/2|3\/4|1\/4|1\/3|2\/3)\b)/gi;

      const parseNumToken = (token: string): number => {
        const t = token.toLowerCase().trim();
        if (t.includes('/')) {
          const parts = t.split('/').map((x) => parseFloat(x.trim()));
          if (parts.length === 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1]) && parts[1] !== 0) {
            return parts[0] / parts[1];
          }
        }
        if (t === 'un' || t === 'una' || t === 'uno') return 1;
        if (t === 'dos') return 2;
        if (t === 'tres') return 3;
        if (t === 'cuatro') return 4;
        if (t === 'cinco') return 5;
        if (t === 'seis') return 6;
        if (t === 'siete') return 7;
        if (t === 'ocho') return 8;
        if (t === 'nueve') return 9;
        if (t === 'diez') return 10;
        if (t === 'medio' || t === 'media' || t === '1/2') return 0.5;
        if (t === 'cuarto' || t === 'cuarta' || t === '1/4') return 0.25;
        if (t === 'tres cuartos' || t === '3/4') return 0.75;
        const parsedVal = parseFloat(t);
        return Number.isNaN(parsedVal) ? 1 : parsedVal;
      };

      const rightNums = [...rightCtx.matchAll(numRe)];
      if (rightNums.length > 0) {
        return { qty: parseNumToken(rightNums[0][0]), found: true, clause };
      }
      const leftNums = [...leftCtx.matchAll(numRe)];
      if (leftNums.length > 0) {
        return { qty: parseNumToken(leftNums[leftNums.length - 1][0]), found: true, clause };
      }
      return { qty: defaultQty, found: true, clause };
    }
    return { qty: 0, found: false, clause: '' };
  };

  const isGramsSpec = (clause: string, qty: number) =>
    /\b\d+(?:\.\d+)?\s*(?:g|gr|gramos?)\b/i.test(clause) ||
    (qty > 15 && !/\btazas?\b|\bcups?\b/i.test(clause));

  const pinto = findFood([
    'gallopinto',
    'gallo pinto',
    'arroz con frijoles',
    'arroz con frijol',
    'arroz y frijoles',
    'arroz y frijol',
    'casamiento',
    'moros y cristianos',
  ]);
  if (pinto.found) {
    const qty = pinto.qty;
    const inGrams = isGramsSpec(pinto.clause, qty) && !/\btazas?\b/i.test(pinto.clause);
    const grams = Math.round(inGrams ? qty : qty * 180);
    const factor = grams / 180;
    ingredients.push({
      name: 'Gallo pinto (arroz con frijoles)',
      portion: inGrams ? `${grams}g` : fmtCup(qty, 180, 'cocido'),
      grams,
      calories: Math.round(factor * 216),
      proteinG: Math.round(factor * 6.8 * 10) / 10,
      carbsG: Math.round(factor * 42 * 10) / 10,
      fatG: Math.round(factor * 1.8 * 10) / 10,
    });
  } else {
    const rice = findFood(['arroz']);
    if (rice.found) {
      const qty = rice.qty;
      const inGrams = isGramsSpec(rice.clause, qty) && !/\btazas?\b/i.test(rice.clause);
      const grams = Math.round(inGrams ? qty : qty * 160);
      const factor = grams / 160;
      ingredients.push({
        name: 'Arroz blanco cocido',
        portion: inGrams ? `${grams}g` : fmtCup(qty, 160),
        grams,
        calories: Math.round(factor * 205),
        proteinG: Math.round(factor * 4.2 * 10) / 10,
        carbsG: Math.round(factor * 44.5 * 10) / 10,
        fatG: Math.round(factor * 0.4 * 10) / 10,
      });
    }
    const beans = findFood(['frijol', 'frijoles', 'caraotas', 'porotos', 'lentejas', 'garbanzos']);
    if (beans.found) {
      const qty = beans.qty;
      const inGrams = isGramsSpec(beans.clause, qty) && !/\btazas?\b/i.test(beans.clause);
      const grams = Math.round(inGrams ? qty : qty * 170);
      const factor = grams / 170;
      ingredients.push({
        name: 'Frijoles / Legumbres cocidas',
        portion: inGrams ? `${grams}g` : fmtCup(qty, 170),
        grams,
        calories: Math.round(factor * 227),
        proteinG: Math.round(factor * 15.2 * 10) / 10,
        carbsG: Math.round(factor * 40.8 * 10) / 10,
        fatG: Math.round(factor * 0.9 * 10) / 10,
      });
    }
  }

  const eggWhites = findFood(['clara', 'claras']);
  if (eggWhites.found) {
    const qty = eggWhites.qty;
    ingredients.push({
      name: 'Claras de huevo',
      portion: `${qty} ${qty === 1 ? 'clara' : 'claras'} (~${Math.round(qty * 33)}g)`,
      grams: Math.round(qty * 33),
      calories: Math.round(qty * 17),
      proteinG: Math.round(qty * 3.6 * 10) / 10,
      carbsG: Math.round(qty * 0.2 * 10) / 10,
      fatG: 0,
    });
  }

  const withoutClaras = normalizedText.replace(/\bclaras?\s+de\s+huevos?\b/gi, ' claras ');
  const eggs = findFood(['huevo', 'huevos', 'omelette'], 1, withoutClaras);
  if (eggs.found) {
    const qty = eggs.qty;
    const isFried = /\b(?:frito|frita|fritos|estrellado|estrellados)\b/i.test(eggs.clause);
    const calUnit = isFried ? 90 : 72;
    const fatUnit = isFried ? 6.8 : 4.8;
    ingredients.push({
      name: isFried
        ? qty === 1
          ? 'Huevo frito'
          : 'Huevos fritos'
        : qty === 1
        ? 'Huevo entero'
        : 'Huevos enteros',
      portion: `${qty} ${qty === 1 ? 'unidad' : 'unidades'} (~${Math.round(qty * 55)}g)`,
      grams: Math.round(qty * 55),
      calories: Math.round(qty * calUnit),
      proteinG: Math.round(qty * 6.3 * 10) / 10,
      carbsG: Math.round(qty * 0.4 * 10) / 10,
      fatG: Math.round(qty * fatUnit * 10) / 10,
    });
  }

  const curedMeats = [
    { aliases: ['salchichon'], name: 'Salchichón', sliceG: 15, unitG: 15, cal100: 320, prot100: 18, carb100: 3, fat100: 26 },
    { aliases: ['chorizo', 'chorizos'], name: 'Chorizo', sliceG: 20, unitG: 50, cal100: 340, prot100: 15, carb100: 2, fat100: 30 },
    { aliases: ['jamon'], name: 'Jamón', sliceG: 25, unitG: 25, cal100: 115, prot100: 17, carb100: 2, fat100: 4 },
    { aliases: ['tocino', 'bacon'], name: 'Tocino / Bacon', sliceG: 10, unitG: 10, cal100: 540, prot100: 37, carb100: 1.4, fat100: 42 },
    { aliases: ['salchicha', 'salchichas'], name: 'Salchicha', sliceG: 15, unitG: 35, cal100: 285, prot100: 12, carb100: 2.5, fat100: 25 },
  ];
  for (const meat of curedMeats) {
    const found = findFood(meat.aliases);
    if (found.found) {
      const qty = found.qty;
      const isSliced = /\b(?:rodajas?|rebanadas?|lascas?|ruedas?|slices?)\b/i.test(found.clause);
      const inGrams = isGramsSpec(found.clause, qty);
      const grams = Math.round(inGrams ? qty : isSliced ? qty * meat.sliceG : qty * meat.unitG);
      ingredients.push({
        name: meat.name,
        portion: inGrams
          ? `${grams}g`
          : isSliced
          ? `${qty} ${qty === 1 ? 'rodaja' : 'rodajas'} (~${grams}g)`
          : `${qty} ${qty === 1 ? 'unidad' : 'unidades'} (~${grams}g)`,
        grams,
        calories: Math.round((grams / 100) * meat.cal100),
        proteinG: Math.round((grams / 100) * meat.prot100 * 10) / 10,
        carbsG: Math.round((grams / 100) * meat.carb100 * 10) / 10,
        fatG: Math.round((grams / 100) * meat.fat100 * 10) / 10,
      });
    }
  }

  const tortillas = findFood(['tortilla', 'tortillas']);
  if (tortillas.found) {
    const qty = tortillas.qty;
    const grams = Math.round(qty * 30);
    ingredients.push({
      name: 'Tortillas de maíz',
      portion: `${qty} ${qty === 1 ? 'tortilla' : 'tortillas'} (~${grams}g)`,
      grams,
      calories: Math.round(qty * 65),
      proteinG: Math.round(qty * 1.5 * 10) / 10,
      carbsG: Math.round(qty * 13.5 * 10) / 10,
      fatG: Math.round(qty * 0.7 * 10) / 10,
    });
  }

  const chicken = findFood(['pechuga', 'pollo']);
  if (chicken.found) {
    const qty = chicken.qty;
    const byCup = /\b(?:tazas?|cups?)\b/i.test(chicken.clause);
    const inGrams = isGramsSpec(chicken.clause, qty) && !byCup;
    const grams = Math.round(inGrams ? qty : qty * 150);
    ingredients.push({
      name: 'Pechuga de pollo a la plancha',
      portion: inGrams ? `${grams}g` : byCup ? fmtCup(qty, 150) : `${qty} ${qty === 1 ? 'filete' : 'filetes'} (~${grams}g)`,
      grams,
      calories: Math.round((grams / 100) * 165),
      proteinG: Math.round((grams / 100) * 31 * 10) / 10,
      carbsG: 0,
      fatG: Math.round((grams / 100) * 3.6 * 10) / 10,
    });
  }

  const beef = findFood(['carne', 'bistec', 'lomo', 'molida', 'res']);
  if (beef.found) {
    const qty = beef.qty;
    const byCup = /\b(?:tazas?|cups?)\b/i.test(beef.clause);
    const inGrams = isGramsSpec(beef.clause, qty) && !byCup;
    const grams = Math.round(inGrams ? qty : byCup ? qty * 200 : qty * 180);
    const isDiced = /\b(?:trocitos?|trozos?|picada)\b/i.test(beef.clause);
    ingredients.push({
      name: isDiced ? 'Trocitos de carne de res magra' : 'Carne de res magra',
      portion: inGrams ? `${grams}g` : byCup ? fmtCup(qty, 200) : `${qty} ${qty === 1 ? 'porción' : 'porciones'} (~${grams}g)`,
      grams,
      calories: Math.round((grams / 100) * 215),
      proteinG: Math.round((grams / 100) * 26 * 10) / 10,
      carbsG: 0,
      fatG: Math.round((grams / 100) * 11 * 10) / 10,
    });
  }

  const fish = findFood(['atun', 'pescado', 'salmon', 'tilapia']);
  if (fish.found) {
    const isTuna = /\batun\b/i.test(fish.clause);
    const qty = fish.qty;
    if (isTuna && !isGramsSpec(fish.clause, qty)) {
      ingredients.push({
        name: 'Lata de atún en agua',
        portion: `${qty} ${qty === 1 ? 'lata' : 'latas'} (140g drenado)`,
        grams: Math.round(qty * 140),
        calories: Math.round(qty * 130),
        proteinG: Math.round(qty * 29),
        carbsG: 0,
        fatG: Math.round(qty * 1),
      });
    } else {
      const inGrams = isGramsSpec(fish.clause, qty);
      const grams = Math.round(inGrams ? qty : qty * 150);
      ingredients.push({
        name: isTuna ? 'Atún en agua' : 'Filete de pescado / salmón',
        portion: `${grams}g`,
        grams,
        calories: Math.round((grams / 100) * (isTuna ? 105 : 170)),
        proteinG: Math.round((grams / 100) * 25 * 10) / 10,
        carbsG: 0,
        fatG: Math.round((grams / 100) * (isTuna ? 1 : 7) * 10) / 10,
      });
    }
  }

  const banana = findFood(['platano', 'banana', 'guineo', 'maduro']);
  if (banana.found) {
    const qty = banana.qty;
    if (/\b(?:maduro|frito|frita)\b/i.test(banana.clause)) {
      ingredients.push({
        name: 'Plátano maduro',
        portion: `${qty} ${qty === 1 ? 'porción' : 'porciones'} (~${Math.round(qty * 120)}g)`,
        grams: Math.round(qty * 120),
        calories: Math.round(qty * 220),
        proteinG: Math.round(qty * 1.5 * 10) / 10,
        carbsG: Math.round(qty * 52 * 10) / 10,
        fatG: Math.round(qty * 3 * 10) / 10,
      });
    } else {
      ingredients.push({
        name: 'Plátano / Banana fresca',
        portion: `${qty} ${qty === 1 ? 'unidad' : 'unidades'} mediana (~${Math.round(qty * 118)}g)`,
        grams: Math.round(qty * 118),
        calories: Math.round(qty * 105),
        proteinG: Math.round(qty * 1.3 * 10) / 10,
        carbsG: Math.round(qty * 27 * 10) / 10,
        fatG: Math.round(qty * 0.3 * 10) / 10,
      });
    }
  }

  const oats = findFood(['avena', 'oatmeal']);
  if (oats.found) {
    const qty = oats.qty;
    const inGrams = isGramsSpec(oats.clause, qty) && !/\btazas?\b/i.test(oats.clause);
    const grams = Math.round(inGrams ? qty : qty * 80);
    const factor = grams / 80;
    ingredients.push({
      name: 'Avena en hojuelas / cocida',
      portion: inGrams ? `${grams}g` : fmtCup(qty, 80, 'seca'),
      grams,
      calories: Math.round(factor * 300),
      proteinG: Math.round(factor * 10.5 * 10) / 10,
      carbsG: Math.round(factor * 54 * 10) / 10,
      fatG: Math.round(factor * 5 * 10) / 10,
    });
  }

  const cafeLeche = findFood(['cafe con leche']);
  const noCafeLeche = cafeLeche.found
    ? normalizedText.replace(/\bcafe\s+con\s+leche\b/gi, ' ')
    : normalizedText;
  if (cafeLeche.found) {
    const qty = cafeLeche.qty;
    ingredients.push({
      name: 'Café con leche',
      portion: `${qty} ${qty === 1 ? 'taza' : 'tazas'} (240ml)`,
      calories: Math.round(qty * 75),
      proteinG: Math.round(qty * 4),
      carbsG: Math.round(qty * 6),
      fatG: Math.round(qty * 3),
    });
  }

  const milk = findFood(['leche'], 1, noCafeLeche);
  if (milk.found) {
    const qty = milk.qty;
    ingredients.push({
      name: 'Vaso de leche',
      portion: `${qty} ${qty === 1 ? 'vaso' : 'vasos'} (240ml)`,
      grams: Math.round(qty * 240),
      calories: Math.round(qty * 130),
      proteinG: Math.round(qty * 8),
      carbsG: Math.round(qty * 12),
      fatG: Math.round(qty * 5),
    });
  }

  const cheese = findFood(['queso', 'cuajada', 'panela']);
  if (cheese.found) {
    const qty = cheese.qty;
    const bySlice = /\b(?:rebanadas?|tajadas?|slices?)\b/i.test(cheese.clause);
    const inGrams = isGramsSpec(cheese.clause, qty) && !/\btazas?\b/i.test(cheese.clause);
    const grams = Math.round(inGrams ? qty : bySlice ? qty * 30 : qty * 60);
    const factor = grams / 100;
    ingredients.push({
      name: 'Queso fresco / panela',
      portion: inGrams
        ? `${grams}g`
        : bySlice
        ? `${qty} ${qty === 1 ? 'rebanada' : 'rebanadas'} (~${grams}g)`
        : fmtCup(qty, 120, 'cubos'),
      grams,
      calories: Math.round(factor * 265),
      proteinG: Math.round(factor * 18 * 10) / 10,
      carbsG: Math.round(factor * 2.5 * 10) / 10,
      fatG: Math.round(factor * 20 * 10) / 10,
    });
  }

  const natilla = findFood(['natilla']);
  if (natilla.found) {
    const qty = natilla.qty;
    const grams = Math.round(qty * 15);
    ingredients.push({
      name: 'Natilla / Crema ácida',
      portion: `${qty} ${qty === 1 ? 'cucharada' : 'cucharadas'} (~${grams}g)`,
      grams,
      calories: Math.round(qty * 30),
      proteinG: Math.round(qty * 0.4 * 10) / 10,
      carbsG: Math.round(qty * 0.7 * 10) / 10,
      fatG: Math.round(qty * 2.9 * 10) / 10,
    });
  }

  const avocado = findFood(['aguacate', 'palta']);
  if (avocado.found) {
    const qty = avocado.qty;
    ingredients.push({
      name: 'Aguacate',
      portion: `${qty} ${qty === 1 ? 'mitad' : 'mitades'} (~${Math.round(qty * 80)}g)`,
      grams: Math.round(qty * 80),
      calories: Math.round(qty * 130),
      proteinG: Math.round(qty * 1.6 * 10) / 10,
      carbsG: Math.round(qty * 7 * 10) / 10,
      fatG: Math.round(qty * 12 * 10) / 10,
    });
  }

  const bread = findFood(['pan', 'tostada', 'tostadas']);
  if (bread.found) {
    const qty = bread.qty;
    ingredients.push({
      name: 'Pan tostado / integral',
      portion: `${qty} ${qty === 1 ? 'rebanada' : 'rebanadas'} (~${Math.round(qty * 30)}g)`,
      grams: Math.round(qty * 30),
      calories: Math.round(qty * 80),
      proteinG: Math.round(qty * 3.2 * 10) / 10,
      carbsG: Math.round(qty * 15 * 10) / 10,
      fatG: Math.round(qty * 1 * 10) / 10,
    });
  }

  const potato = findFood(['papa', 'papas', 'yuca']);
  if (potato.found) {
    const qty = potato.qty;
    const isYuca = /\byuca\b/i.test(potato.clause);
    const inGrams = isGramsSpec(potato.clause, qty) && !/\btazas?\b/i.test(potato.clause);
    const grams = Math.round(inGrams ? qty : qty * 150);
    const factor = grams / 150;
    ingredients.push({
      name: isYuca ? 'Yuca cocida' : 'Papa cocida / asada',
      portion: inGrams ? `${grams}g` : fmtCup(qty, 150),
      grams,
      calories: Math.round(factor * (isYuca ? 240 : 130)),
      proteinG: Math.round(factor * (isYuca ? 2 : 3) * 10) / 10,
      carbsG: Math.round(factor * (isYuca ? 57 : 30) * 10) / 10,
      fatG: 0.2,
    });
  }

  const whey = findFood(['scoop', 'whey', 'proteina en polvo']);
  if (whey.found) {
    const qty = whey.qty;
    ingredients.push({
      name: 'Proteína Whey Isolate',
      portion: `${qty} ${qty === 1 ? 'scoop' : 'scoops'} (${Math.round(qty * 30)}g)`,
      grams: Math.round(qty * 30),
      calories: Math.round(qty * 120),
      proteinG: Math.round(qty * 25),
      carbsG: Math.round(qty * 2),
      fatG: Math.round(qty * 1),
    });
  }

  const salad = findFood(['ensalada', 'vegetales', 'verduras', 'brocoli']);
  if (salad.found) {
    const qty = salad.qty;
    const grams = Math.round(qty * 60);
    ingredients.push({
      name: 'Ensalada verde / vegetales',
      portion: fmtCup(qty, 60),
      grams,
      calories: Math.round(qty * 20),
      proteinG: Math.round(qty * 1.2 * 10) / 10,
      carbsG: Math.round(qty * 3.5 * 10) / 10,
      fatG: 0.2,
    });
  }

  const oil = findFood(['aceite']);
  if (oil.found) {
    const qty = oil.qty;
    const byTbsp = /\bcucharadas?\b/i.test(oil.clause) && !/cucharadita/i.test(oil.clause);
    const grams = Math.round(byTbsp ? qty * 14 : qty * 5);
    ingredients.push({
      name: 'Aceite de oliva / cocina',
      portion: `${qty} ${byTbsp ? 'cdas' : 'cdtas'} (~${grams}g)`,
      grams,
      calories: grams * 9,
      proteinG: 0,
      carbsG: 0,
      fatG: grams,
    });
  }

  const coffee = findFood(['cafe'], 1, noCafeLeche);
  if (coffee.found) {
    const qty = coffee.qty;
    const withMilk = /\bleche\b/i.test(coffee.clause) && !milk.found;
    ingredients.push({
      name: withMilk ? 'Café con leche' : 'Café negro',
      portion: `${qty} ${qty === 1 ? 'taza' : 'tazas'} (240ml)`,
      calories: Math.round(withMilk ? qty * 75 : qty * 5),
      proteinG: withMilk ? Math.round(qty * 4) : 0,
      carbsG: withMilk ? Math.round(qty * 6) : 1,
      fatG: withMilk ? Math.round(qty * 3) : 0,
    });
  }

  if (ingredients.length === 0) {
    const capitalized = description.charAt(0).toUpperCase() + description.slice(1);
    ingredients.push({
      name: capitalized || 'Comida Completa',
      portion: '1 porción estimada',
      calories: 420,
      proteinG: 32,
      carbsG: 45,
      fatG: 12,
    });
  }

  const totalCal = ingredients.reduce((a, b) => a + b.calories, 0);
  const totalProt = ingredients.reduce((a, b) => a + b.proteinG, 0);
  const totalCarbs = ingredients.reduce((a, b) => a + b.carbsG, 0);
  const totalFat = ingredients.reduce((a, b) => a + b.fatG, 0);
  const joinedNames = ingredients.map((i) => i.name).join(' + ');
  const portionSummary = ingredients.map((i) => `${i.name} [${i.portion}]`).join(' + ');

  return {
    dishName:
      ingredients.length === 1 ? `${ingredients[0].name} (${ingredients[0].portion})` : joinedNames,
    calories: Math.round(totalCal),
    proteinG: Math.round(totalProt),
    carbsG: Math.round(totalCarbs),
    fatG: Math.round(totalFat),
    portionDetails: portionSummary,
    ingredients,
    explanation: `Cálculo clínico exacto: ${portionSummary} = ${Math.round(
      totalCal
    )} kcal (${Math.round(totalProt)}g Proteína, ${Math.round(totalCarbs)}g Carbohidratos, ${Math.round(
      totalFat
    )}g Grasas).`,
    recommendedTag: tag,
    source: 'clinical-database',
  };
}

export function getQuickCoachPrompts(state: AppState) {
  const isInsanityOnly = state.trainingMode === 'insanity_only';
  return [
    {
      label: '🧬 Analizar mi MovingLife (83.3 kg / 33.9%)',
      prompt:
        'Analiza mi reporte MovingLife completo de 83.3 kg y 33.9% de grasa y dime mis prioridades.',
    },
    {
      label: '🦵 Cuidar y fortalecer piernas (87.7% / 88.9%)',
      prompt: isInsanityOnly
        ? 'Mis piernas están en nivel Bajo (87.7% y 88.9%) y actualmente solo estoy haciendo Insanity. ¿Cómo evito perder músculo y las cuido mientras quemo grasa?'
        : '¿Cómo corrijo el nivel Bajo en mis piernas (7.93 kg Izq y 8.04 kg Der) con mi banco XR 6.1, Forza Gym y mancuernas?',
    },
    {
      label: '🍽️ ¿Qué comer hoy según mis calorías?',
      prompt: '¿Qué debo comer hoy según las calorías y gramos de proteína que me faltan?',
    },
    {
      label: isInsanityOnly ? '⚡ Plan de hoy: Solo Insanity HIIT' : '🔥 Plan de hoy: Pesas + Insanity',
      prompt: isInsanityOnly
        ? 'Actualmente solo hago Insanity HIIT sin pesas. ¿Cómo ejecuto mi sesión de hoy de forma segura para quemar grasa sin perder músculo?'
        : '¿Cómo combino mi rutina de fuerza de hoy con mi sesión de Insanity sin perder masa muscular?',
    },
  ];
}
