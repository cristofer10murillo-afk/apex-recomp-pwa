import React, { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  Camera,
  Check,
  Droplets,
  Flame,
  GlassWater,
  HeartPulse,
  Info,
  Key,
  LoaderCircle,
  Moon,
  Plus,
  RefreshCw,
  RotateCcw,
  Scale,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Sunrise,
  Target,
  Trash2,
  UserCheck,
  Utensils,
  X,
  Zap,
} from 'lucide-react';
import { SmartMealAIModal } from '../components/SmartMealAIModal';
import { useApp } from '../context/AppContext';
import {
  analyzeNaturalLanguageMeal,
  CUPS_TO_GRAMS_GUIDE,
  fallbackLocalClinicalMeal,
  getEffectiveGeminiKey,
  saveCustomGeminiKey,
  testGeminiApiKey,
} from '../services/aiService';
import { getLocalISODate } from '../services/storageService';
import {
  MealAIResult,
  NutritionLogItem,
  NutritionMealTag,
  QuickMealPreset,
} from '../types/fitness';

const WEEKDAYS_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const WEEKDAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function getWeekDaysStrip(todayIso: string) {
  const base = new Date(`${todayIso}T12:00:00`);
  const day = base.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(base);
  monday.setDate(base.getDate() + diffToMon);
  const items: Array<{
    idx: number;
    shortLabel: string;
    isoDate: string;
    dayNum: string;
    isToday: boolean;
    isFuture: boolean;
  }> = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = getLocalISODate(d);
    const idx = d.getDay();
    items.push({
      idx,
      shortLabel: WEEKDAYS_SHORT[idx],
      isoDate: iso,
      dayNum: String(d.getDate()).padStart(2, '0'),
      isToday: iso === todayIso,
      isFuture: iso > todayIso,
    });
  }
  return items;
}

export const NutritionModule: React.FC = () => {
  const {
    state,
    updateUserProfile,
    getDynamicCalorieTarget,
    QuickAddMeal,
    addCustomMeal,
    removeLoggedMeal,
    clearAllLoggedMeals,
    resetTodayWatchActiveCalories,
    updateWaterGlasses,
    updateHistoryWatchCalories,
  } = useApp();

  const todayIso = getLocalISODate();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayIso = getLocalISODate(yesterdayDate);

  const [selectedIso, setSelectedIso] = useState<string>(() => getLocalISODate());
  const [previewWeekday, setPreviewWeekday] = useState<number | null>(null);
  const lastTodayRef = useRef(todayIso);

  useEffect(() => {
    if (lastTodayRef.current !== todayIso) {
      if (selectedIso === lastTodayRef.current) {
        setSelectedIso(todayIso);
      }
      lastTodayRef.current = todayIso;
    }
  }, [todayIso, selectedIso]);

  const effectiveIso = selectedIso > todayIso ? todayIso : selectedIso;
  const weekStrip = getWeekDaysStrip(todayIso);
  const isPreviewMode = previewWeekday !== null;
  const previewStripItem = isPreviewMode
    ? weekStrip.find((w) => w.idx === previewWeekday) || null
    : null;
  const isViewingToday = !isPreviewMode && effectiveIso === todayIso;
  const targetDateParam = isViewingToday ? undefined : effectiveIso;

  const formatShortDate = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });

  const dateLabel = isViewingToday
    ? 'Hoy'
    : effectiveIso === yesterdayIso
    ? `Ayer (${formatShortDate(effectiveIso)})`
    : formatShortDate(effectiveIso);

  const dayRecordFromStore =
    effectiveIso === todayIso
      ? {
          ...state.nutrition,
          watchActiveCalories: state.watchMetrics.activeCalories,
        }
      : state.nutritionHistory?.[effectiveIso] || {
          waterGlasses250ml: 0,
          targetWaterGlasses: state.nutrition.targetWaterGlasses || 14,
          loggedMeals: [],
          watchActiveCalories: 0,
        };

  const activeDayData = isPreviewMode
    ? {
        date: previewStripItem?.isoDate || todayIso,
        waterGlasses250ml: 0,
        targetWaterGlasses: state.nutrition.targetWaterGlasses || 14,
        loggedMeals: [] as NutritionLogItem[],
        watchActiveCalories: 0,
      }
    : dayRecordFromStore;

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showPhotoAIModal, setShowPhotoAIModal] = useState(false);
  const [photoAITag, setPhotoAITag] = useState<NutritionMealTag>('Almuerzo');
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customTag, setCustomTag] = useState<NutritionMealTag>('Desayuno');
  const [customName, setCustomName] = useState('');
  const [customKcal, setCustomKcal] = useState(450);
  const [customProt, setCustomProt] = useState(35);
  const [customCarbs, setCustomCarbs] = useState(40);
  const [customFat, setCustomFat] = useState(12);
  const [nlpQuery, setNlpQuery] = useState('');
  const [correctionInput, setCorrectionInput] = useState('');
  const [showCupsInModal, setShowCupsInModal] = useState(false);
  const [showCupsGuide, setShowCupsGuide] = useState(false);
  const [isAiCalculating, setIsAiCalculating] = useState(false);
  const [aiResult, setAiResult] = useState<MealAIResult | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState(() => getEffectiveGeminiKey(state));
  const [showApiKeyPanel, setShowApiKeyPanel] = useState(false);
  const [isTestingApiKey, setIsTestingApiKey] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [showGoalEditor, setShowGoalEditor] = useState(false);

  const userAge = state.userProfile?.age ?? 38;
  const userHeight = state.userProfile?.heightCm ?? 168;
  const targetWeight = state.userProfile?.targetWeightKg ?? 70;
  const targetFatPct = state.userProfile?.targetBodyFatPercent ?? 18;
  const dailyDeficit = state.userProfile?.dailyDeficitKcal ?? 300;
  const primaryGoalTitle =
    state.userProfile?.primaryGoalTitle ??
    'Recomposición Corporal: Oxidar Grasa Visceral y Subir Masa en Piernas';

  const todayTargetObj = getDynamicCalorieTarget();
  const latestCamry = state.camryHistory[state.camryHistory.length - 1];
  const currentWeightKg = latestCamry?.weightKg || 83.3;
  const currentFatPct = latestCamry?.bodyFatPercent || 33.9;
  const leanMassKg =
    latestCamry?.leanBodyMassKg || Math.round(currentWeightKg * (1 - currentFatPct / 100) * 10) / 10;
  const visceralLevel = latestCamry?.visceralFatIndex || 13;
  const waterPct = latestCamry?.waterPercent || 48.5;

  const watchKcalDay = isPreviewMode
    ? 0
    : isViewingToday
    ? state.watchMetrics.activeCalories || 0
    : activeDayData.watchActiveCalories ?? 0;

  const bmrDay = latestCamry?.bmrKcal || 1558;
  const neatDay = Math.round(bmrDay * 0.1);
  const rawDayTarget = bmrDay + neatDay + watchKcalDay - dailyDeficit;
  const isDayFloored = rawDayTarget < 1500;
  const flooredDayTarget = Math.max(1500, rawDayTarget);

  const displayBmr = isViewingToday ? todayTargetObj.bmr : bmrDay;
  const displayNeat = isViewingToday ? todayTargetObj.neatBasal : neatDay;
  const displayDeficit = isViewingToday ? todayTargetObj.deficit : dailyDeficit;
  const displayRawTarget = isViewingToday ? todayTargetObj.rawTarget : rawDayTarget;
  const displayIsFloored = isViewingToday ? todayTargetObj.isFloored : isDayFloored;

  const consumedHistKcal = activeDayData.loggedMeals.reduce((acc, m) => acc + m.calories, 0);
  const targetCalories = isViewingToday ? todayTargetObj.targetCalories : flooredDayTarget;
  const consumedCalories = isViewingToday ? todayTargetObj.consumedCalories : consumedHistKcal;
  const remainingCalories = targetCalories - consumedCalories;

  const activeWeekdayIdx =
    previewWeekday !== null
      ? previewWeekday
      : isViewingToday
      ? state.selectedWeekdayIndex
      : new Date(`${effectiveIso}T12:00:00`).getDay();

  const proteinBaseWeight =
    currentFatPct > 25
      ? latestCamry?.standardWeightKg || Math.round(leanMassKg * 1.18 * 10) / 10
      : currentWeightKg;
  const idealWeightAtTargetFat = Math.round((leanMassKg / (1 - targetFatPct / 100)) * 10) / 10;
  const remainingLossKg = Math.max(0, Math.round((currentWeightKg - targetWeight) * 10) / 10);

  const insanityDay =
    state.insanityCalendar.find((d) => d.dayNumber === state.currentInsanityDay) ||
    state.insanityCalendar[0];
  const isInsanityOnly = state.trainingMode === 'insanity_only';
  const isHighCarbDay = isInsanityOnly
    ? !insanityDay.isRestDay && activeWeekdayIdx !== 0
    : !(activeWeekdayIdx === 0 || activeWeekdayIdx === 4 || activeWeekdayIdx === 3) ||
      [1, 2, 5].includes(activeWeekdayIdx) ||
      (insanityDay.isMaxInterval && activeWeekdayIdx !== 0 && activeWeekdayIdx !== 4);

  const ageFactor = userAge >= 35 ? 0.1 : 0;
  const targetProteinG = Math.round(
    isHighCarbDay ? proteinBaseWeight * (2.25 + ageFactor) : proteinBaseWeight * (2.4 + ageFactor)
  );
  const targetFatG = Math.round(
    isHighCarbDay ? proteinBaseWeight * 0.8 : proteinBaseWeight * 1.1
  );
  const carbsKcal = Math.max(220, targetCalories - targetProteinG * 4 - targetFatG * 9);
  const targetCarbsG = Math.round(carbsKcal / 4);

  const totalProt = activeDayData.loggedMeals.reduce((acc, m) => acc + m.proteinG, 0);
  const totalCarbs = activeDayData.loggedMeals.reduce((acc, m) => acc + m.carbsG, 0);
  const totalFat = activeDayData.loggedMeals.reduce((acc, m) => acc + m.fatG, 0);

  const remainingProtG = Math.max(0, targetProteinG - totalProt);
  const remainingCarbsG = Math.max(0, targetCarbsG - totalCarbs);
  const remainingFatG = Math.max(0, targetFatG - totalFat);

  const waterLiters = ((activeDayData.waterGlasses250ml * 250) / 1000).toFixed(2);
  const targetWaterLiters = ((activeDayData.targetWaterGlasses * 250) / 1000).toFixed(2);
  const waterPctProgress = Math.min(
    100,
    Math.round((activeDayData.waterGlasses250ml / activeDayData.targetWaterGlasses) * 100)
  );

  const getMealSlot = (meal: NutritionLogItem): 'desayuno' | 'almuerzo' | 'merienda' | 'cena' => {
    if (meal.tag === 'Desayuno') return 'desayuno';
    if (meal.tag === 'Almuerzo') return 'almuerzo';
    if (meal.tag === 'Cena') return 'cena';
    if (
      meal.tag === 'Merienda' ||
      meal.tag === 'Post-Entreno' ||
      meal.tag === 'Pre-HIIT' ||
      meal.tag === 'Snack Proteico'
    ) {
      return 'merienda';
    }
    const hr = parseInt((meal.time || '12:00').split(':')[0], 10);
    return hr < 11 ? 'desayuno' : hr >= 18 ? 'cena' : 'almuerzo';
  };

  const breakfastMeals = activeDayData.loggedMeals.filter((m) => getMealSlot(m) === 'desayuno');
  const lunchMeals = activeDayData.loggedMeals.filter((m) => getMealSlot(m) === 'almuerzo');
  const snackMeals = activeDayData.loggedMeals.filter((m) => getMealSlot(m) === 'merienda');
  const dinnerMeals = activeDayData.loggedMeals.filter((m) => getMealSlot(m) === 'cena');

  const sumSlot = (items: NutritionLogItem[]) =>
    items.reduce(
      (acc, m) => ({
        calories: acc.calories + m.calories,
        protein: acc.protein + m.proteinG,
        carbs: acc.carbs + m.carbsG,
        fat: acc.fat + m.fatG,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

  const breakfastSum = sumSlot(breakfastMeals);
  const lunchSum = sumSlot(lunchMeals);
  const snackSum = sumSlot(snackMeals);
  const dinnerSum = sumSlot(dinnerMeals);

  const openPhotoModal = (tag: NutritionMealTag) => {
    setPhotoAITag(tag);
    setShowPhotoAIModal(true);
  };

  const openCustomMealModal = (tag: NutritionMealTag) => {
    setCustomTag(tag);
    setNlpQuery('');
    setAiResult(null);
    if (tag === 'Desayuno') {
      setCustomName('Huevos revueltos con tortillas');
      setCustomKcal(465);
      setCustomProt(36);
      setCustomCarbs(38);
      setCustomFat(18);
    } else if (tag === 'Almuerzo') {
      setCustomName('Arroz con frijoles y pechuga de pollo');
      setCustomKcal(560);
      setCustomProt(54);
      setCustomCarbs(55);
      setCustomFat(14);
    } else if (tag === 'Merienda' || tag === 'Post-Entreno' || tag === 'Pre-HIIT') {
      setCustomName('Shake Whey Isolate + Plátano');
      setCustomKcal(320);
      setCustomProt(35);
      setCustomCarbs(38);
      setCustomFat(4);
    } else {
      setCustomName('Filete de pescado con ensalada verde');
      setCustomKcal(430);
      setCustomProt(46);
      setCustomCarbs(9);
      setCustomFat(23);
    }
    setShowCustomModal(true);
  };

  const handleCalculateMealAI = async (presetQuery?: string) => {
    const query = (presetQuery !== undefined ? presetQuery : nlpQuery).trim();
    if (!query) return;
    if (presetQuery) setNlpQuery(presetQuery);
    setIsAiCalculating(true);
    try {
      const res = await analyzeNaturalLanguageMeal(query, customTag, state);
      setAiResult(res);
      setCustomName(res.dishName);
      setCustomKcal(res.calories);
      setCustomProt(res.proteinG);
      setCustomCarbs(res.carbsG);
      setCustomFat(res.fatG);
    } catch (err) {
      console.warn('AI search error, using clinical fallback:', err);
      const fb = fallbackLocalClinicalMeal(query, customTag);
      setAiResult(fb);
      setCustomName(fb.dishName);
      setCustomKcal(fb.calories);
      setCustomProt(fb.proteinG);
      setCustomCarbs(fb.carbsG);
      setCustomFat(fb.fatG);
    } finally {
      setIsAiCalculating(false);
    }
  };

  const handleRecalculateMealAI = async (overrideCorrection?: string) => {
    const corr = (overrideCorrection ?? correctionInput).trim();
    if (!corr) return;
    setIsAiCalculating(true);
    try {
      const baseText = nlpQuery.trim() || customName.trim();
      const res = await analyzeNaturalLanguageMeal(
        baseText,
        customTag,
        state,
        aiResult || undefined,
        corr
      );
      setAiResult(res);
      setCustomName(res.dishName);
      setCustomKcal(res.calories);
      setCustomProt(res.proteinG);
      setCustomCarbs(res.carbsG);
      setCustomFat(res.fatG);
      setCorrectionInput('');
    } catch (err) {
      console.warn('Correction error, using fallback:', err);
      const fb = fallbackLocalClinicalMeal(
        nlpQuery || customName,
        customTag,
        aiResult || undefined,
        corr
      );
      setAiResult(fb);
      setCustomName(fb.dishName);
      setCustomKcal(fb.calories);
      setCustomProt(fb.proteinG);
      setCustomCarbs(fb.carbsG);
      setCustomFat(fb.fatG);
    } finally {
      setIsAiCalculating(false);
    }
  };

  const handleSaveApiKey = async () => {
    const key = apiKeyInput.trim();
    if (!key) {
      saveCustomGeminiKey('');
      updateUserProfile({ geminiApiKey: '' });
      setApiKeyStatus({
        ok: false,
        message: 'Clave eliminada. Operando con la Base Clínica USDA local.',
      });
      return;
    }
    setIsTestingApiKey(true);
    setApiKeyStatus({
      ok: true,
      message: 'Consultando servidores de Google Cloud (Generative Language API)...',
    });
    try {
      const check = await testGeminiApiKey(key);
      if (check.ok) {
        saveCustomGeminiKey(key);
        updateUserProfile({ geminiApiKey: key });
        setApiKeyStatus({
          ok: true,
          message: `✅ ¡Conexión exitosa a Google Cloud! Modelo activo: ${
            check.model || 'gemini-1.5-flash'
          }. Consultas en vivo habilitadas.`,
        });
        window.setTimeout(() => setShowApiKeyPanel(false), 2500);
      } else {
        setApiKeyStatus({
          ok: false,
          message: `❌ Error al conectar (${check.status}): ${check.message}`,
        });
      }
    } catch (err) {
      setApiKeyStatus({
        ok: false,
        message: `❌ Fallo de conexión: ${err instanceof Error ? err.message : 'Error desconocido de red'}`,
      });
    } finally {
      setIsTestingApiKey(false);
    }
  };

  const handleQuickAddPreset = (preset: QuickMealPreset) => {
    QuickAddMeal(preset, targetDateParam);
    setToastMsg(`✓ "${preset.name}" guardado en ${dateLabel} (+${preset.calories} kcal)`);
    window.setTimeout(() => setToastMsg(null), 3500);
  };

  const handleSaveCustomMeal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    addCustomMeal(
      {
        name: customName.trim(),
        calories: customKcal,
        proteinG: customProt,
        carbsG: customCarbs,
        fatG: customFat,
        tag: customTag,
      },
      targetDateParam
    );
    setToastMsg(`✓ "${customName.trim()}" guardado en ${dateLabel} (+${customKcal} kcal)`);
    window.setTimeout(() => setToastMsg(null), 3500);
    setShowCustomModal(false);
  };

  const examplePresets =
    customTag === 'Desayuno'
      ? [
          '3 huevos con 2 tortillas',
          '1 taza avena con leche y plátano',
          'Omelette 3 claras y queso fresco',
        ]
      : customTag === 'Almuerzo'
      ? [
          '1 taza arroz con frijoles y pechuga',
          '200g carne de res con papa y ensalada',
          'Filete de pescado con 1 taza de arroz',
        ]
      : customTag === 'Cena'
      ? [
          '1 lata de atún con ensalada y aguacate',
          '200g pechuga con brócoli y oliva',
          '3 claras revueltas con tomate y aguacate',
        ]
      : [
          '1 scoop proteína con 1 plátano',
          '1 taza yogurt griego con avena',
          '3 tortitas de arroz con miel',
        ];

  return (
    <div className="space-y-6 pb-12">
      <SmartMealAIModal
        isOpen={showPhotoAIModal}
        onClose={() => setShowPhotoAIModal(false)}
        defaultTag={photoAITag}
        targetDate={targetDateParam}
        targetDateLabel={dateLabel}
      />

      {/* MODAL REGISTRAR COMIDA POR TEXTO / NLP IA */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-[#111827] border border-[#10B981]/50 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-gradient-to-br from-[#10B981]/25 to-[#3B82F6]/25 border border-[#10B981]/40 text-[#10B981]">
                  <Utensils className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    Registrar {customTag} {isViewingToday ? 'con IA' : `• ${dateLabel}`}
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    Escribe lo que comiste y la cantidad para calcular macros en internet
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#090D16] border border-gray-800 rounded-xl p-2.5 space-y-2">
              <div className="flex items-center justify-between text-xs gap-2">
                <div className="flex items-center gap-1.5">
                  {getEffectiveGeminiKey(state) ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Google Gemini Cloud: Servidores en la Nube Activos
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                      <Zap className="w-3 h-3 text-cyan-400" />
                      Base Clínica USDA Activa (Sin clave Gemini)
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowApiKeyPanel((v) => !v)}
                  className="text-[11px] text-gray-300 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 transition font-medium shrink-0"
                >
                  <Key className="w-3 h-3 text-[#10B981]" />
                  {showApiKeyPanel
                    ? 'Cerrar'
                    : getEffectiveGeminiKey(state)
                    ? 'Cambiar Clave'
                    : 'Conectar Clave Gemini'}
                </button>
              </div>

              {showApiKeyPanel && (
                <div className="pt-2 border-t border-gray-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-[#10B981]" />
                      Clave API de Google AI Studio (100% Gratuita)
                    </span>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#3B82F6] hover:underline text-[10px] font-bold"
                    >
                      Obtener Clave Gratis ↗
                    </a>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-snug">
                    Al ingresar tu clave de <strong>Google AI Studio</strong>, tus consultas viajan
                    directo a los servidores de Gemini en la nube (Google Cloud) para calcular macros
                    exactos de cualquier plato o cantidad.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="AIzaSy... (Pega tu clave aquí)"
                      className="flex-1 bg-[#111827] border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:border-[#10B981] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSaveApiKey()}
                      disabled={isTestingApiKey}
                      className="px-3 py-1.5 rounded-lg bg-[#10B981] hover:bg-emerald-400 text-gray-950 font-bold text-xs disabled:opacity-50 shrink-0 transition"
                    >
                      {isTestingApiKey ? 'Verificando...' : 'Comprobar y Guardar'}
                    </button>
                  </div>
                  {apiKeyStatus && (
                    <p
                      className={`text-[11px] p-2 rounded-lg font-medium ${
                        apiKeyStatus.ok
                          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                          : 'bg-red-500/10 text-red-300 border border-red-500/30'
                      }`}
                    >
                      {apiKeyStatus.message}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="bg-[#090D16] border border-[#10B981]/40 rounded-2xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#10B981]" />
                  ¿Qué comiste y qué cantidad? (Escribe como hablas):
                </label>
                <span className="text-[10px] text-emerald-400 font-mono font-bold">
                  IA &amp; USDA Online
                </span>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={nlpQuery}
                  onChange={(e) => setNlpQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleCalculateMealAI();
                    }
                  }}
                  placeholder={
                    customTag === 'Desayuno'
                      ? 'Ej: 3 huevos con 2 tortillas de maíz'
                      : customTag === 'Almuerzo'
                      ? 'Ej: 1 taza de arroz con frijoles y 1 filete de pechuga'
                      : customTag === 'Cena'
                      ? 'Ej: 1 lata de atún con ensalada verde y 1/2 aguacate'
                      : 'Ej: 1 scoop de proteína con 1 plátano y leche'
                  }
                  className="flex-1 bg-[#111827] border border-gray-700 rounded-xl px-3 py-2.5 text-xs text-white placeholder-gray-500 focus:border-[#10B981] focus:outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => void handleCalculateMealAI()}
                  disabled={isAiCalculating || !nlpQuery.trim()}
                  className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-[#10B981] to-emerald-500 hover:opacity-90 disabled:opacity-50 text-gray-950 font-extrabold text-xs flex items-center gap-1.5 shrink-0 transition shadow-md shadow-[#10B981]/20"
                >
                  {isAiCalculating ? (
                    <>
                      <LoaderCircle className="w-4 h-4 animate-spin" />
                      <span>Calculando...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Calcular con IA</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px]">
                <span className="text-[10px] text-gray-400">Ejemplos con 1 toque:</span>
                {examplePresets.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => void handleCalculateMealAI(ex)}
                    className="px-2 py-0.5 rounded-lg bg-[#111827] hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-gray-300 text-[10px] transition"
                  >
                    {ex}
                  </button>
                ))}
              </div>

              {aiResult && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-b from-[#111827] to-[#090D16] border-2 border-[#10B981]/50 space-y-3 mt-3 shadow-xl">
                  <div className="flex items-center justify-between gap-2 border-b border-gray-800 pb-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="p-1 rounded-full bg-[#10B981]/20 text-[#10B981]">
                        <Check className="w-4 h-4" />
                      </div>
                      <span className="font-extrabold text-white text-xs truncate">
                        Detectado por{' '}
                        {aiResult.source === 'gemini-cloud' ? 'Google Gemini IA' : 'Base USDA Clínica'}
                      </span>
                    </div>
                    <span className="font-mono text-sm px-2.5 py-0.5 rounded-full bg-[#10B981]/20 border border-[#10B981]/40 text-[#10B981] font-black shrink-0">
                      {aiResult.calories} kcal
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 font-mono text-center">
                    <div className="bg-[#090D16] border border-[#3B82F6]/40 rounded-xl p-2">
                      <span className="text-[9px] uppercase tracking-wider text-[#3B82F6] block font-bold">
                        Proteína
                      </span>
                      <span className="text-base font-black text-white block leading-tight mt-0.5">
                        {aiResult.proteinG} <span className="text-[10px] text-gray-400">g</span>
                      </span>
                    </div>
                    <div className="bg-[#090D16] border border-[#F59E0B]/40 rounded-xl p-2">
                      <span className="text-[9px] uppercase tracking-wider text-[#F59E0B] block font-bold">
                        Carbos
                      </span>
                      <span className="text-base font-black text-white block leading-tight mt-0.5">
                        {aiResult.carbsG} <span className="text-[10px] text-gray-400">g</span>
                      </span>
                    </div>
                    <div className="bg-[#090D16] border border-purple-500/40 rounded-xl p-2">
                      <span className="text-[9px] uppercase tracking-wider text-purple-400 block font-bold">
                        Grasas
                      </span>
                      <span className="text-base font-black text-white block leading-tight mt-0.5">
                        {aiResult.fatG} <span className="text-[10px] text-gray-400">g</span>
                      </span>
                    </div>
                  </div>

                  {aiResult.ingredients.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] uppercase tracking-wider text-gray-400 font-mono block">
                        Ingredientes y Porciones Exactas:
                      </span>
                      {aiResult.ingredients.map((ing, i) => (
                        <div
                          key={i}
                          className="bg-[#050811] border border-gray-800 rounded-xl p-2.5 flex flex-col gap-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-white break-words">{ing.name}</span>
                            <span className="text-xs font-mono font-extrabold text-[#10B981] shrink-0">
                              {ing.calories} kcal
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-mono">
                            <span className="text-cyan-300 font-bold bg-cyan-950/60 px-2 py-0.5 rounded-md border border-cyan-500/30">
                              📏 {ing.portion}
                            </span>
                            <span className="text-gray-300 text-[10px]">
                              <strong className="text-[#3B82F6]">{ing.proteinG}g</strong> P •{' '}
                              <strong className="text-[#F59E0B]">{ing.carbsG}g</strong> C •{' '}
                              <strong className="text-purple-400">{ing.fatG}g</strong> G
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-[11px] text-emerald-300 leading-relaxed bg-[#10B981]/10 p-2.5 rounded-xl border border-[#10B981]/25">
                    💡 {aiResult.explanation}
                  </p>

                  <div className="bg-[#050811] border border-[#3B82F6]/50 rounded-xl p-3 space-y-2.5 mt-2">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <span className="text-xs font-extrabold text-[#3B82F6] flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        ¿Deseas corregir porciones o ingredientes? Escribe tu corrección:
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowCupsInModal(!showCupsInModal)}
                        className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1 font-mono"
                      >
                        📏 {showCupsInModal ? 'Ocultar Guía' : 'Ver Guía Tazas a Gramos'}
                      </button>
                    </div>

                    {showCupsInModal && (
                      <div className="p-2.5 rounded-xl bg-[#090D16] border border-cyan-500/30 text-[10px] text-gray-300 space-y-1 font-mono">
                        <span className="text-cyan-300 font-bold block">
                          📏 Equivalencias Clave (Tazas ⇄ Gramos):
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[10px]">
                          {CUPS_TO_GRAMS_GUIDE.map((item) => (
                            <div key={item.foodKey} className="text-gray-300">
                              • <strong className="text-white">{item.name}:</strong> {item.notes}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={correctionInput}
                        onChange={(e) => setCorrectionInput(e.target.value)}
                        placeholder="Ej: 'No fue 1 taza de arroz, fue 1/2 taza solamente' o '100g de carne'..."
                        className="flex-1 bg-[#090D16] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:border-[#3B82F6] focus:outline-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void handleRecalculateMealAI();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => void handleRecalculateMealAI()}
                        disabled={isAiCalculating || !correctionInput.trim()}
                        className="px-3.5 py-2 rounded-xl bg-[#3B82F6] hover:bg-[#3B82F6]/90 disabled:opacity-50 text-white font-extrabold text-xs flex items-center gap-1.5 shrink-0 transition"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isAiCalculating ? 'animate-spin' : ''}`} />
                        <span>Re-calcular</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] text-gray-400 font-mono">Ajustes rápidos:</span>
                      {[
                        'No fue 1 taza de arroz, fue 1/2 taza solamente (~80g)',
                        'Fue 1/4 taza de arroz (~40g)',
                        'Fue 1 taza de arroz (~160g)',
                        'Fue 1/2 taza de frijoles (~85g)',
                        'Fueron 100g de carne (~1/2 taza)',
                        'Fueron 150g de pechuga de pollo',
                        'Sin aceite añadido',
                      ].map((q) => (
                        <button
                          key={q}
                          type="button"
                          disabled={isAiCalculating}
                          onClick={() => {
                            setCorrectionInput(q);
                            void handleRecalculateMealAI(q);
                          }}
                          className="px-2 py-0.5 rounded-lg bg-[#090D16] hover:bg-gray-800 border border-gray-700 hover:border-[#3B82F6] text-gray-300 text-[10px] transition"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSaveCustomMeal} className="space-y-3 pt-1">
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">
                  Nombre Descriptivo del Plato
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Ej. Huevos con tortillas o Arroz con frijoles y pollo"
                  className="w-full bg-[#090D16] border border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-[#10B981] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">Momento / Comida</label>
                  <select
                    value={customTag}
                    onChange={(e) => setCustomTag(e.target.value as NutritionMealTag)}
                    className="w-full bg-[#090D16] border border-gray-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="Desayuno">🌅 Desayuno</option>
                    <option value="Almuerzo">☀️ Almuerzo</option>
                    <option value="Merienda">🍎 Merienda / Snack</option>
                    <option value="Cena">🌙 Cena</option>
                    <option value="Post-Entreno">⚡ Post-Entreno</option>
                    <option value="Pre-HIIT">🔥 Pre-HIIT</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">
                    Calorías Totales (kcal)
                  </label>
                  <input
                    type="number"
                    value={customKcal}
                    onChange={(e) => setCustomKcal(Number(e.target.value))}
                    className="w-full bg-[#090D16] border border-gray-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-[#10B981]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">Proteína (g)</label>
                  <input
                    type="number"
                    value={customProt}
                    onChange={(e) => setCustomProt(Number(e.target.value))}
                    className="w-full bg-[#090D16] border border-gray-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-[#3B82F6]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">Carbohidratos (g)</label>
                  <input
                    type="number"
                    value={customCarbs}
                    onChange={(e) => setCustomCarbs(Number(e.target.value))}
                    className="w-full bg-[#090D16] border border-gray-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-[#F59E0B]"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] text-gray-400 block mb-1">Grasas (g)</label>
                  <input
                    type="number"
                    value={customFat}
                    onChange={(e) => setCustomFat(Number(e.target.value))}
                    className="w-full bg-[#090D16] border border-gray-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-purple-400"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="w-1/3 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-gray-950 font-extrabold text-xs flex items-center justify-center gap-1.5 transition shadow-lg shadow-[#10B981]/25"
                >
                  <Check className="w-4 h-4" />
                  Guardar en {customTag} ({dateLabel}) • +{customKcal} kcal • {customProt}g P
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PERFIL Y EDITOR DE EDAD Y OBJETIVO */}
      <div className="bg-gradient-to-br from-[#111827] via-[#111827] to-[#090D16] border border-[#10B981]/40 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl shadow-black/40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#3B82F6]/20 text-[#3B82F6] flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5" />
                Cristopher • {userAge} Años • {userHeight} cm
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#10B981]/20 text-[#10B981] flex items-center gap-1">
                <Target className="w-3.5 h-3.5" />
                Meta: {currentWeightKg} kg → {targetWeight} kg ({currentFatPct}% → {targetFatPct}% Grasa)
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 flex items-center gap-1">
                <Scale className="w-3.5 h-3.5" />
                Masa Magra Protegida: {leanMassKg} kg
              </span>
            </div>
            <h2 className="text-base sm:text-xl font-extrabold text-white">{primaryGoalTitle}</h2>
            <p className="text-xs text-gray-300 leading-relaxed">
              Plan calibrado para tus <strong className="text-white">{userAge} años</strong> y tus{' '}
              <strong className="text-white">{leanMassKg} kg de masa muscular</strong>. Tu peso ideal al{' '}
              {targetFatPct}% de grasa es{' '}
              <strong className="text-[#10B981]">~{idealWeightAtTargetFat} kg</strong> (oxidar{' '}
              <strong className="text-[#F59E0B]">
                {remainingLossKg} kg de grasa visceral y subcutánea
              </strong>{' '}
              reteniendo el 100% de tu masa magra).
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <button
              type="button"
              onClick={() => setShowGoalEditor(!showGoalEditor)}
              className="px-3.5 py-2.5 rounded-xl bg-[#090D16] hover:bg-gray-800 border border-gray-700 text-gray-200 font-bold text-xs flex items-center gap-1.5 transition"
            >
              <SlidersHorizontal className="w-4 h-4 text-[#3B82F6]" />
              <span>{showGoalEditor ? 'Cerrar Ajuste' : 'Editar Edad y Objetivo'}</span>
            </button>
            <button
              type="button"
              onClick={() => openPhotoModal('Almuerzo')}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#10B981] to-emerald-500 hover:opacity-95 text-gray-950 font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-[#10B981]/25 transition"
            >
              <Camera className="w-4 h-4" />
              <span>📸 Escanear Plato con Cámara IA</span>
            </button>
          </div>
        </div>

        {showGoalEditor && (
          <div className="bg-[#090D16] border border-[#3B82F6]/40 rounded-2xl p-4 space-y-3">
            <div className="text-xs font-extrabold text-[#3B82F6] uppercase tracking-wider">
              Configurar Tu Edad y Meta de Recomposición Corporal
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Tu Edad (años)</label>
                <input
                  type="number"
                  min={16}
                  max={85}
                  value={userAge}
                  onChange={(e) => updateUserProfile({ age: Number(e.target.value) })}
                  className="w-full bg-[#111827] border border-gray-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Estatura (cm)</label>
                <input
                  type="number"
                  min={140}
                  max={220}
                  value={userHeight}
                  onChange={(e) => updateUserProfile({ heightCm: Number(e.target.value) })}
                  className="w-full bg-[#111827] border border-gray-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Peso Meta (kg)</label>
                <input
                  type="number"
                  step="0.5"
                  min={50}
                  max={120}
                  value={targetWeight}
                  onChange={(e) => updateUserProfile({ targetWeightKg: Number(e.target.value) })}
                  className="w-full bg-[#111827] border border-gray-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#10B981]"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-400 block mb-1">% Grasa Meta</label>
                <input
                  type="number"
                  step="0.5"
                  min={8}
                  max={30}
                  value={targetFatPct}
                  onChange={(e) =>
                    updateUserProfile({ targetBodyFatPercent: Number(e.target.value) })
                  }
                  className="w-full bg-[#111827] border border-gray-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#F59E0B]"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="text-[11px] text-gray-400 block mb-1">Déficit Diario (kcal)</label>
                <select
                  value={dailyDeficit}
                  onChange={(e) => updateUserProfile({ dailyDeficitKcal: Number(e.target.value) })}
                  className="w-full bg-[#111827] border border-gray-700 rounded-xl px-2.5 py-2 text-xs font-bold text-white"
                >
                  <option value={200}>−200 kcal (Suave)</option>
                  <option value={250}>−250 kcal (Recomposición)</option>
                  <option value={300}>−300 kcal (Óptimo)</option>
                  <option value={400}>−400 kcal (Acelerado)</option>
                  <option value={500}>−500 kcal (Definición)</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SELECTOR DE FECHA / HISTORIAL (HOY / AYER / CALENDARIO) */}
      <div className="bg-[#111827] border border-cyan-500/40 rounded-2xl p-3.5 sm:p-4 space-y-3 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-extrabold text-white">
                Fecha de Registro Nutricional &amp; Historial
              </h3>
              <p className="text-[11px] text-gray-400">
                Cambia a <strong>Ayer</strong> u otra fecha para ver o registrar comidas de ese día sin
                alterar Hoy.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setPreviewWeekday(null);
                setSelectedIso(todayIso);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition ${
                isViewingToday
                  ? 'bg-[#10B981] border-[#10B981] text-gray-950 shadow-md shadow-[#10B981]/20'
                  : 'bg-[#090D16] border-gray-700 text-gray-300 hover:border-gray-500'
              }`}
            >
              📍 Hoy ({formatShortDate(todayIso)})
            </button>
            <button
              type="button"
              onClick={() => {
                setPreviewWeekday(null);
                setSelectedIso(yesterdayIso);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition ${
                !isPreviewMode && effectiveIso === yesterdayIso
                  ? 'bg-amber-500 border-amber-400 text-gray-950 shadow-md shadow-amber-500/20'
                  : 'bg-[#090D16] border-amber-500/40 text-amber-300 hover:bg-amber-500/10'
              }`}
            >
              ⏮️ Ayer ({formatShortDate(yesterdayIso)})
            </button>
            <input
              type="date"
              value={effectiveIso}
              max={todayIso}
              onChange={(e) => {
                if (e.target.value) {
                  setPreviewWeekday(null);
                  setSelectedIso(e.target.value);
                }
              }}
              aria-label="Seleccionar fecha del historial nutricional"
              className="px-2.5 py-1.5 rounded-xl bg-[#090D16] border border-gray-700 text-xs font-mono text-cyan-300 focus:border-cyan-400 focus:outline-none"
            />
          </div>
        </div>

        {!isViewingToday && !isPreviewMode && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="text-amber-200 leading-snug">
              <strong>📅 Modo Historial ({dateLabel}):</strong> Estás viendo y editando el registro
              del <strong>{effectiveIso}</strong>. Todo lo que agregues aquí se guarda en ese día sin
              sumarse al día de Hoy.
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <label className="text-[11px] font-mono text-amber-300 flex items-center gap-1.5 bg-[#090D16] px-2.5 py-1 rounded-lg border border-amber-500/30">
                <span>⌚ Watch ese día (kcal):</span>
                <input
                  type="number"
                  min={0}
                  max={5000}
                  value={watchKcalDay}
                  onChange={(e) => updateHistoryWatchCalories(effectiveIso, Number(e.target.value))}
                  className="w-16 bg-transparent font-bold text-white text-right focus:outline-none"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  setPreviewWeekday(null);
                  setSelectedIso(todayIso);
                }}
                className="px-2.5 py-1 rounded-lg bg-[#10B981] text-gray-950 font-extrabold text-[11px] hover:opacity-90 transition"
              >
                Volver a Hoy
              </button>
            </div>
          </div>
        )}
      </div>

      {/* METAS NUTRICIONALES DE HOY / HISTORIAL / VISTA PREVIA */}
      <div className="bg-[#111827] border border-[#10B981]/50 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-1.5 rounded-lg bg-[#10B981]/20 text-[#10B981]">
                <Target className="w-5 h-5" />
              </span>
              <h2 className="text-base sm:text-lg font-extrabold text-white">
                {isPreviewMode
                  ? `METAS NUTRICIONALES — VISTA PREVIA (${WEEKDAYS_FULL[activeWeekdayIdx].toUpperCase()} ${
                      previewStripItem ? previewStripItem.dayNum : ''
                    })`
                  : isViewingToday
                  ? `METAS NUTRICIONALES DE HOY (${WEEKDAYS_FULL[activeWeekdayIdx].toUpperCase()})`
                  : `METAS NUTRICIONALES DEL ${dateLabel.toUpperCase()} (${WEEKDAYS_FULL[
                      activeWeekdayIdx
                    ].toUpperCase()})`}
              </h2>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  isInsanityOnly
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                    : 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                }`}
              >
                {isInsanityOnly ? '🔥 Solo Insanity' : '🏋️ Modo Híbrido'}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Para bajar de {currentWeightKg} kg ({currentFatPct}% grasa) a {targetWeight} kg y
              mantener {leanMassKg} kg de masa magra a tus {userAge} años:
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start">
            <button
              type="button"
              onClick={() => setShowCupsGuide(!showCupsGuide)}
              className="px-2.5 py-1 rounded-xl bg-[#090D16] hover:bg-gray-800 border border-cyan-500/40 text-cyan-300 font-mono text-[11px] font-bold flex items-center gap-1 transition"
            >
              📏 {showCupsGuide ? 'Ocultar Guía' : 'Tazas ⇄ Gramos'}
            </button>

            <div className="flex items-center gap-1 bg-[#090D16] p-1 rounded-xl border border-gray-800 flex-wrap">
              {weekStrip.map((item) => {
                const isActive = isPreviewMode
                  ? item.idx === previewWeekday
                  : weekStrip.some((w) => w.isoDate === effectiveIso)
                  ? item.isoDate === effectiveIso
                  : item.idx === activeWeekdayIdx;
                return (
                  <button
                    key={item.isoDate}
                    type="button"
                    onClick={() => {
                      if (item.isFuture) {
                        setPreviewWeekday(item.idx);
                      } else {
                        setPreviewWeekday(null);
                        setSelectedIso(item.isoDate);
                      }
                    }}
                    title={
                      item.isToday
                        ? `Hoy (${item.isoDate})`
                        : item.isFuture
                        ? `Vista previa plan ${WEEKDAYS_FULL[item.idx]} (${item.isoDate})`
                        : `Ver registro del ${WEEKDAYS_FULL[item.idx]} (${item.isoDate})`
                    }
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                      isActive
                        ? 'bg-[#3B82F6] text-white shadow'
                        : item.isFuture
                        ? 'text-gray-500 hover:text-gray-200'
                        : 'text-gray-300 hover:text-white'
                    }`}
                  >
                    <span>
                      {item.shortLabel} {item.dayNum}
                    </span>
                    {item.isToday && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isActive ? 'bg-emerald-300' : 'bg-[#10B981]'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {isPreviewMode && previewStripItem && (
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="text-blue-200 leading-snug">
              <strong>🔮 Vista previa de día futuro ({formatShortDate(previewStripItem.isoDate)}):</strong>{' '}
              Muestra tus metas proyectadas en reposo (Watch = 0 kcal, Consumido = 0). Tus comidas y
              datos reales de <strong>Hoy ({formatShortDate(todayIso)})</strong> siguen guardados aparte
              sin modificarse.
            </div>
            <button
              type="button"
              onClick={() => {
                setPreviewWeekday(null);
                setSelectedIso(todayIso);
              }}
              className="px-2.5 py-1 rounded-lg bg-[#10B981] text-gray-950 font-extrabold text-[11px] hover:opacity-90 transition shrink-0 self-start sm:self-center"
            >
              Volver a Hoy
            </button>
          </div>
        )}

        {showCupsGuide && (
          <div className="p-3 rounded-2xl bg-[#090D16] border border-cyan-500/40 space-y-2 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5 font-mono">
                📏 Tabla Oficial de Medidas Caseras: Tazas a Gramos
              </span>
              <button
                type="button"
                onClick={() => setShowCupsGuide(false)}
                className="text-[10px] text-gray-400 hover:text-white"
              >
                Cerrar ✕
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px]">
              {CUPS_TO_GRAMS_GUIDE.map((item) => (
                <div
                  key={item.foodKey}
                  className="p-2.5 rounded-xl bg-[#111827] border border-gray-800 space-y-1"
                >
                  <span className="font-extrabold text-white block">{item.name}</span>
                  <div className="text-[10px] font-mono text-cyan-300 space-y-0.5">
                    <div>• 1 taza: ~{item.oneCupGrams}g</div>
                    <div>• 1/2 taza: ~{item.halfCupGrams}g</div>
                    <div>• 1/4 taza: ~{item.quarterCupGrams}g</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4 TARJETAS DE METAS (CALORÍAS, PROTEÍNA, CARBOS, GRASAS) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-[#090D16] border border-gray-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-[#10B981]" />
                Meta de Calorías{' '}
                {isPreviewMode ? `(${WEEKDAYS_FULL[activeWeekdayIdx]})` : isViewingToday ? 'Hoy' : `(${dateLabel})`}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  remainingCalories > 0
                    ? 'bg-[#10B981]/20 text-[#10B981]'
                    : 'bg-blue-500/20 text-blue-300'
                }`}
              >
                {remainingCalories > 0 ? `Te faltan ${remainingCalories} kcal` : 'Meta cubierta'}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-mono font-extrabold text-white">
                {targetCalories} <span className="text-xs font-sans text-gray-400">kcal</span>
              </div>
              <div className="text-xs font-mono text-gray-400">
                Consumido: <strong className="text-white">{consumedCalories}</strong>
              </div>
            </div>
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-[#10B981]"
                style={{ width: `${Math.min(100, (consumedCalories / targetCalories) * 100)}%` }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px] text-gray-400 leading-tight pt-1">
              <span className="font-mono leading-relaxed">
                Fórmula: TMB ({displayBmr}) + Base/Digestión (+{displayNeat}) + Watch ({watchKcalDay}) −{' '}
                {displayDeficit} ={' '}
                {displayIsFloored ? (
                  <>
                    <span className="text-gray-300">{displayRawTarget}</span>{' '}
                    <span className="text-amber-300">→ Mín. seguro:</span>{' '}
                    <strong className="text-emerald-400">{targetCalories} kcal</strong>
                  </>
                ) : (
                  <strong className="text-emerald-400">{targetCalories} kcal</strong>
                )}
              </span>

              {isViewingToday && state.watchMetrics.activeCalories > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    resetTodayWatchActiveCalories();
                    setToastMsg('✓ Kcal del reloj reseteadas a 0 kcal para empezar un nuevo día.');
                    window.setTimeout(() => setToastMsg(null), 3500);
                  }}
                  className="px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-mono text-[10px] font-bold transition flex items-center gap-1 active:scale-95"
                  title="Presiona al despertar o iniciar un nuevo día si aún no has entrenado, para que tu meta no incluya calorías de ayer."
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>Resetear Watch (0 kcal)</span>
                </button>
              )}
            </div>

            {watchKcalDay === 0 ? (
              <p className="text-[9px] text-gray-500 leading-snug">
                ℹ️ Base mínima en reposo (Watch = 0). Al ingresar tus{' '}
                <strong>Calorías Activas de Samsung Health</strong> en Inicio, la meta sube 1 a 1
                (ej. +306 pasos = 1712 kcal; +772 entreno = 2178 kcal).
              </p>
            ) : (
              isViewingToday && (
                <p className="text-[9px] text-gray-500 italic">
                  ℹ️ ¿Para qué sirve? Si hoy es un nuevo día y aún no has entrenado, pulsa &quot;Resetear
                  Watch&quot; para volver a tu meta de reposo sin calorías de ayer.
                </p>
              )
            )}
          </div>

          <div className="bg-[#090D16] border border-gray-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#3B82F6]" />
                Meta de Proteína (Masa Magra)
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  remainingProtG > 0
                    ? 'bg-[#3B82F6]/20 text-[#3B82F6]'
                    : 'bg-emerald-500/20 text-[#10B981]'
                }`}
              >
                {remainingProtG > 0 ? `Te faltan ${remainingProtG}g` : '¡Protegido!'}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-mono font-extrabold text-[#3B82F6]">
                {targetProteinG} <span className="text-xs font-sans text-gray-400">g</span>
              </div>
              <div className="text-xs font-mono text-gray-400">
                Consumido: <strong className="text-[#3B82F6]">{totalProt}g</strong>
              </div>
            </div>
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#3B82F6]"
                style={{ width: `${Math.min(100, (totalProt / targetProteinG) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-400 leading-tight">
              Calibrada sobre {proteinBaseWeight} kg peso estándar ({leanMassKg} kg masa magra a los{' '}
              {userAge} años) para blindar músculo en Insanity.
            </p>
          </div>

          <div className="bg-[#090D16] border border-gray-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-[#F59E0B]" />
                Meta Carbohidratos ({isHighCarbDay ? 'Carga' : 'Control'})
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  remainingCarbsG > 0
                    ? 'bg-[#F59E0B]/20 text-[#F59E0B]'
                    : 'bg-gray-800 text-gray-300'
                }`}
              >
                {remainingCarbsG > 0 ? `Faltan ${remainingCarbsG}g` : 'Completo'}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-mono font-extrabold text-[#F59E0B]">
                {targetCarbsG} <span className="text-xs font-sans text-gray-400">g</span>
              </div>
              <div className="text-xs font-mono text-gray-400">
                Consumido: <strong className="text-[#F59E0B]">{totalCarbs}g</strong>
              </div>
            </div>
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#F59E0B]"
                style={{ width: `${Math.min(100, (totalCarbs / targetCarbsG) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-400 leading-tight">
              {isHighCarbDay
                ? isInsanityOnly
                  ? 'Combustible glucogénico para los saltos y sprints de Insanity HIIT.'
                  : 'Combustible glucogénico para los saltos de Insanity y fuerza pesada.'
                : 'Moderados para forzar la oxidación de grasa visceral en reposo.'}
            </p>
          </div>

          <div className="bg-[#090D16] border border-gray-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                <HeartPulse className="w-4 h-4 text-purple-400" />
                Meta Grasas Saludables
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  remainingFatG > 0
                    ? 'bg-purple-500/20 text-purple-300'
                    : 'bg-gray-800 text-gray-300'
                }`}
              >
                {remainingFatG > 0 ? `Faltan ${remainingFatG}g` : 'Completo'}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-mono font-extrabold text-purple-400">
                {targetFatG} <span className="text-xs font-sans text-gray-400">g</span>
              </div>
              <div className="text-xs font-mono text-gray-400">
                Consumido: <strong className="text-purple-400">{totalFat}g</strong>
              </div>
            </div>
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500"
                style={{ width: `${Math.min(100, (totalFat / targetFatG) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-400 leading-tight">
              Producción de testosterona a los {userAge} años, articulaciones y absorción vitamínica.
            </p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[#090D16] border border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="text-gray-300 flex items-center gap-2 flex-wrap">
            <span className="font-bold text-white">
              {isPreviewMode
                ? `🎯 Proyección del ${WEEKDAYS_FULL[activeWeekdayIdx]}:`
                : isViewingToday
                ? '🎯 Te falta por consumir hoy para llegar a tu meta:'
                : `🎯 Pendiente del ${dateLabel} respecto a tu meta:`}
            </span>
            <span className="font-mono text-[#10B981] font-extrabold">{remainingCalories} kcal</span>
            <span className="text-gray-500">•</span>
            <span className="font-mono text-[#3B82F6] font-bold">{remainingProtG}g Proteína</span>
            <span className="text-gray-500">•</span>
            <span className="font-mono text-[#F59E0B] font-bold">{remainingCarbsG}g Carbos</span>
            <span className="text-gray-500">•</span>
            <span className="font-mono text-purple-400 font-bold">{remainingFatG}g Grasas</span>
          </div>
          <span className="text-[11px] font-mono text-gray-400">
            Día {state.currentInsanityDay}/63 • {insanityDay.workoutTitle}
          </span>
        </div>
      </div>

      {/* REGISTRO DE COMIDAS POR MOMENTO DEL DÍA */}
      {isPreviewMode && previewStripItem ? (
        <div className="bg-[#111827] border border-blue-500/40 rounded-2xl p-5 text-center space-y-3 shadow-lg">
          <div className="flex items-center justify-center gap-2 text-blue-300 font-extrabold text-sm sm:text-base">
            <Utensils className="w-5 h-5" />
            <span>
              REGISTRO DE COMIDAS — {WEEKDAYS_FULL[activeWeekdayIdx].toUpperCase()} (
              {formatShortDate(previewStripItem.isoDate)})
            </span>
          </div>
          <p className="text-xs text-gray-300 max-w-xl mx-auto leading-relaxed">
            Este día aún no ha iniciado (es un día futuro), por eso aparece en{' '}
            <strong className="text-white">0 kcal consumidas</strong> y sin comidas registradas. Las
            comidas que ya registraste hoy ({formatShortDate(todayIso)}) siguen intactas en su fecha
            real.
          </p>
          <button
            type="button"
            onClick={() => {
              setPreviewWeekday(null);
              setSelectedIso(todayIso);
            }}
            className="px-4 py-2 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-gray-950 font-extrabold text-xs inline-flex items-center gap-1.5 shadow-lg shadow-[#10B981]/20 transition"
          >
            📍 Volver a Hoy ({formatShortDate(todayIso)}) para Ver o Registrar Comidas
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
                <Utensils className="w-5 h-5 text-[#10B981]" />
                REGISTRO DE COMIDAS ({dateLabel.toUpperCase()})
              </h2>
              <p className="text-xs text-gray-400">
                Registra cada comida de <strong>{dateLabel}</strong> tocando{' '}
                <strong>+ Registrar</strong> o tomando una <strong>📸 Foto IA</strong>:
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {activeDayData.loggedMeals.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        `¿Deseas vaciar todas las comidas registradas de ${dateLabel} y reiniciar a 0 kcal?`
                      )
                    ) {
                      clearAllLoggedMeals(targetDateParam);
                      setToastMsg(`✓ Comidas de ${dateLabel} reiniciadas a 0 kcal`);
                      window.setTimeout(() => setToastMsg(null), 3000);
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-300 font-bold text-xs flex items-center gap-1.5 transition"
                  title="Eliminar todas las comidas de este día para empezar desde 0 kcal"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Vaciar Comidas de {isViewingToday ? 'Hoy' : dateLabel}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => openCustomMealModal('Almuerzo')}
                className="px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-bold text-xs flex items-center gap-1.5 self-start"
              >
                <Plus className="w-4 h-4 text-[#10B981]" />
                <span>Añadir Otro Alimento</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* DESAYUNO */}
            <div className="bg-[#111827] border border-amber-500/40 rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-lg">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                      <Sunrise className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-white">🌅 Desayuno</h3>
                      <p className="text-[11px] text-gray-400">
                        Activación Metabólica y Síntesis Proteica
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-amber-400 block">
                      {breakfastSum.calories} / ~{Math.round(targetCalories * 0.25)} kcal
                    </span>
                    <span className="text-[10px] font-mono text-gray-400">
                      {breakfastSum.protein}g / ~{Math.round(targetProteinG * 0.25)}g Prot
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-800/80">
                  <button
                    type="button"
                    onClick={() => openCustomMealModal('Desayuno')}
                    className="flex-1 py-1.5 px-2.5 rounded-xl bg-[#090D16] hover:bg-gray-800 border border-gray-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400" />
                    <span>+ Registrar Desayuno</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openPhotoModal('Desayuno')}
                    className="py-1.5 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition"
                    title="Fotografiar desayuno con IA"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>📸 Foto IA</span>
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  {breakfastMeals.length === 0 ? (
                    <div className="p-3 rounded-xl bg-[#090D16] border border-dashed border-gray-800 text-center space-y-1.5">
                      <p className="text-[11px] text-gray-400">No has registrado desayuno aún.</p>
                      <p className="text-[10px] text-amber-300/80">
                        💡 Sugerido: 3 huevos + 150ml claras + 2 tortillas o 1/2 taza avena (~40g seca)
                        (465 kcal • 36g P)
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          handleQuickAddPreset({
                            id: `des-${Date.now()}`,
                            name: '3 Huevos + 150ml Claras + 2 Tortillas',
                            portionLabel: 'Desayuno Proteico Completo',
                            calories: 465,
                            proteinG: 36,
                            carbsG: 38,
                            fatG: 18,
                            tag: 'Desayuno',
                          })
                        }
                        className="text-[10px] font-bold text-amber-400 hover:underline inline-block mt-1"
                      >
                        + Añadir Desayuno Sugerido con 1 Toque
                      </button>
                    </div>
                  ) : (
                    breakfastMeals.map((m) => (
                      <div
                        key={m.id}
                        className="p-2.5 rounded-xl bg-[#090D16] border border-gray-800 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-mono px-1 rounded bg-gray-800 text-gray-300">
                              {m.time}
                            </span>
                            <span className="text-xs font-bold text-white break-words">{m.name}</span>
                          </div>
                          <div className="flex items-center gap-2.5 mt-1 text-[10px] font-mono text-gray-400">
                            <span className="text-amber-400 font-bold">{m.calories} kcal</span>
                            <span className="text-[#3B82F6]">P: {m.proteinG}g</span>
                            <span className="text-[#F59E0B]">C: {m.carbsG}g</span>
                            <span className="text-purple-400">G: {m.fatG}g</span>
                          </div>
                        </div>
                        <button
                          onClick={() => removeLoggedMeal(m.id, targetDateParam)}
                          className="p-1 text-gray-500 hover:text-red-400 transition"
                          title="Eliminar alimento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* ALMUERZO */}
            <div className="bg-[#111827] border border-[#10B981]/50 rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-lg">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-[#10B981]/20 text-[#10B981]">
                      <Sun className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-white">☀️ Almuerzo</h3>
                      <p className="text-[11px] text-gray-400">Carga Energética Principal del Día</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-[#10B981] block">
                      {lunchSum.calories} / ~{Math.round(targetCalories * 0.35)} kcal
                    </span>
                    <span className="text-[10px] font-mono text-gray-400">
                      {lunchSum.protein}g / ~{Math.round(targetProteinG * 0.35)}g Prot
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-800/80">
                  <button
                    type="button"
                    onClick={() => openCustomMealModal('Almuerzo')}
                    className="flex-1 py-1.5 px-2.5 rounded-xl bg-[#090D16] hover:bg-gray-800 border border-gray-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#10B981]" />
                    <span>+ Registrar Almuerzo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openPhotoModal('Almuerzo')}
                    className="py-1.5 px-3 rounded-xl bg-[#10B981]/15 hover:bg-[#10B981]/25 border border-[#10B981]/40 text-[#10B981] font-bold text-xs flex items-center gap-1.5 transition"
                    title="Fotografiar almuerzo con IA"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>📸 Foto IA</span>
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  {lunchMeals.length === 0 ? (
                    <div className="p-3 rounded-xl bg-[#090D16] border border-dashed border-gray-800 text-center space-y-1.5">
                      <p className="text-[11px] text-gray-400">No has registrado almuerzo aún.</p>
                      <p className="text-[10px] text-emerald-300/80">
                        💡 Sugerido: 220g pechuga pollo/res + 1 taza arroz (~160g) o papa + aguacate
                        (640 kcal • 54g P)
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          handleQuickAddPreset({
                            id: `alm-${Date.now()}`,
                            name: 'Pechuga de Pollo 220g + Arroz 180g + Aguacate',
                            portionLabel: 'Almuerzo Clave de Recomposición',
                            calories: 640,
                            proteinG: 54,
                            carbsG: 62,
                            fatG: 16,
                            tag: 'Almuerzo',
                          })
                        }
                        className="text-[10px] font-bold text-[#10B981] hover:underline inline-block mt-1"
                      >
                        + Añadir Almuerzo Sugerido con 1 Toque
                      </button>
                    </div>
                  ) : (
                    lunchMeals.map((m) => (
                      <div
                        key={m.id}
                        className="p-2.5 rounded-xl bg-[#090D16] border border-gray-800 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-mono px-1 rounded bg-gray-800 text-gray-300">
                              {m.time}
                            </span>
                            <span className="text-xs font-bold text-white break-words">{m.name}</span>
                          </div>
                          <div className="flex items-center gap-2.5 mt-1 text-[10px] font-mono text-gray-400">
                            <span className="text-[#10B981] font-bold">{m.calories} kcal</span>
                            <span className="text-[#3B82F6]">P: {m.proteinG}g</span>
                            <span className="text-[#F59E0B]">C: {m.carbsG}g</span>
                            <span className="text-purple-400">G: {m.fatG}g</span>
                          </div>
                        </div>
                        <button
                          onClick={() => removeLoggedMeal(m.id, targetDateParam)}
                          className="p-1 text-gray-500 hover:text-red-400 transition"
                          title="Eliminar alimento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* MERIENDAS & PRE/POST ENTRENO */}
            <div className="bg-[#111827] border border-[#3B82F6]/40 rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-lg">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-[#3B82F6]/20 text-[#3B82F6]">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-white">
                        🍎 Meriendas &amp; Pre/Post Entreno
                      </h3>
                      <p className="text-[11px] text-gray-400">Batidos, Fruta, Creatina y Colaciones</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-[#3B82F6] block">
                      {snackSum.calories} / ~{Math.round(targetCalories * 0.2)} kcal
                    </span>
                    <span className="text-[10px] font-mono text-gray-400">
                      {snackSum.protein}g / ~{Math.round(targetProteinG * 0.2)}g Prot
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-800/80">
                  <button
                    type="button"
                    onClick={() => openCustomMealModal('Merienda')}
                    className="flex-1 py-1.5 px-2.5 rounded-xl bg-[#090D16] hover:bg-gray-800 border border-gray-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#3B82F6]" />
                    <span>+ Registrar Merienda</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openPhotoModal('Merienda')}
                    className="py-1.5 px-3 rounded-xl bg-[#3B82F6]/15 hover:bg-[#3B82F6]/25 border border-[#3B82F6]/40 text-[#3B82F6] font-bold text-xs flex items-center gap-1.5 transition"
                    title="Fotografiar merienda con IA"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>📸 Foto IA</span>
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  {snackMeals.length === 0 ? (
                    <div className="p-3 rounded-xl bg-[#090D16] border border-dashed border-gray-800 text-center space-y-1.5">
                      <p className="text-[11px] text-gray-400">
                        No has registrado meriendas o pre/post entreno hoy.
                      </p>
                      <p className="text-[10px] text-blue-300/80">
                        💡 Sugerido: Shake Whey Isolate 1.5 scoops + Plátano + 5g Creatina (320 kcal • 35g P)
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          handleQuickAddPreset({
                            id: `mer-${Date.now()}`,
                            name: 'Shake Whey Isolate + Plátano + Creatina',
                            portionLabel: isInsanityOnly
                              ? 'Post-Entreno Insanity HIIT'
                              : 'Post-Entreno de Fuerza & Insanity',
                            calories: 320,
                            proteinG: 35,
                            carbsG: 38,
                            fatG: 4,
                            tag: 'Post-Entreno',
                          })
                        }
                        className="text-[10px] font-bold text-[#3B82F6] hover:underline inline-block mt-1"
                      >
                        + Añadir Shake Post-Entreno con 1 Toque
                      </button>
                    </div>
                  ) : (
                    snackMeals.map((m) => (
                      <div
                        key={m.id}
                        className="p-2.5 rounded-xl bg-[#090D16] border border-gray-800 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-mono px-1 rounded bg-gray-800 text-gray-300">
                              {m.time}
                            </span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#3B82F6]/20 text-[#3B82F6]">
                              {m.tag}
                            </span>
                            <span className="text-xs font-bold text-white break-words">{m.name}</span>
                          </div>
                          <div className="flex items-center gap-2.5 mt-1 text-[10px] font-mono text-gray-400">
                            <span className="text-[#3B82F6] font-bold">{m.calories} kcal</span>
                            <span className="text-[#3B82F6]">P: {m.proteinG}g</span>
                            <span className="text-[#F59E0B]">C: {m.carbsG}g</span>
                            <span className="text-purple-400">G: {m.fatG}g</span>
                          </div>
                        </div>
                        <button
                          onClick={() => removeLoggedMeal(m.id, targetDateParam)}
                          className="p-1 text-gray-500 hover:text-red-400 transition"
                          title="Eliminar alimento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* CENA */}
            <div className="bg-[#111827] border border-purple-500/40 rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-lg">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
                      <Moon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-white">🌙 Cena</h3>
                      <p className="text-[11px] text-gray-400">
                        Síntesis Nocturna y Oxidación de Grasa Visceral
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-purple-400 block">
                      {dinnerSum.calories} / ~{Math.round(targetCalories * 0.2)} kcal
                    </span>
                    <span className="text-[10px] font-mono text-gray-400">
                      {dinnerSum.protein}g / ~{Math.round(targetProteinG * 0.2)}g Prot
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-800/80">
                  <button
                    type="button"
                    onClick={() => openCustomMealModal('Cena')}
                    className="flex-1 py-1.5 px-2.5 rounded-xl bg-[#090D16] hover:bg-gray-800 border border-gray-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <Plus className="w-3.5 h-3.5 text-purple-400" />
                    <span>+ Registrar Cena</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openPhotoModal('Cena')}
                    className="py-1.5 px-3 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/40 text-purple-300 font-bold text-xs flex items-center gap-1.5 transition"
                    title="Fotografiar cena con IA"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>📸 Foto IA</span>
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  {dinnerMeals.length === 0 ? (
                    <div className="p-3 rounded-xl bg-[#090D16] border border-dashed border-gray-800 text-center space-y-1.5">
                      <p className="text-[11px] text-gray-400">No has registrado cena aún.</p>
                      <p className="text-[10px] text-purple-300/80">
                        💡 Sugerido: 200g atún/salmón o pechuga + 1 taza ensalada verde (~60g) y aceite de
                        oliva (430 kcal • 46g P)
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          handleQuickAddPreset({
                            id: `cen-${Date.now()}`,
                            name: 'Salmón Sellado 200g + Ensalada Verde + AOVE',
                            portionLabel: 'Cena Low-Carb Oxidadora',
                            calories: 430,
                            proteinG: 46,
                            carbsG: 9,
                            fatG: 23,
                            tag: 'Cena',
                          })
                        }
                        className="text-[10px] font-bold text-purple-400 hover:underline inline-block mt-1"
                      >
                        + Añadir Cena Sugerida con 1 Toque
                      </button>
                    </div>
                  ) : (
                    dinnerMeals.map((m) => (
                      <div
                        key={m.id}
                        className="p-2.5 rounded-xl bg-[#090D16] border border-gray-800 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-mono px-1 rounded bg-gray-800 text-gray-300">
                              {m.time}
                            </span>
                            <span className="text-xs font-bold text-white break-words">{m.name}</span>
                          </div>
                          <div className="flex items-center gap-2.5 mt-1 text-[10px] font-mono text-gray-400">
                            <span className="text-purple-400 font-bold">{m.calories} kcal</span>
                            <span className="text-[#3B82F6]">P: {m.proteinG}g</span>
                            <span className="text-[#F59E0B]">C: {m.carbsG}g</span>
                            <span className="text-purple-400">G: {m.fatG}g</span>
                          </div>
                        </div>
                        <button
                          onClick={() => removeLoggedMeal(m.id, targetDateParam)}
                          className="p-1 text-gray-500 hover:text-red-400 transition"
                          title="Eliminar alimento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HIDRATACIÓN CELULAR */}
      <div className="bg-[#111827] border border-sky-500/40 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400">
              <Droplets className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-white">
                HIDRATACIÓN CELULAR &amp; ELECTROLÍTICA (3.5 LITROS / DÍA)
              </h2>
              <p className="text-xs text-sky-300">
                Meta de{' '}
                {isPreviewMode ? WEEKDAYS_FULL[activeWeekdayIdx] : isViewingToday ? 'hoy' : dateLabel}: 14
                vasos de 250 ml (3,500 ml) • Consumido: {waterLiters} L ({waterPctProgress}%)
              </p>
            </div>
          </div>

          <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-[#090D16] border border-sky-500/30 text-sky-300 self-start">
            {activeDayData.waterGlasses250ml} de {activeDayData.targetWaterGlasses} vasos bebidos
          </span>
        </div>

        <div className="bg-[#090D16] border border-gray-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-300 font-bold">
              {isPreviewMode
                ? 'Registro de Vasos de Agua (Vista previa en 0 — vuelve a Hoy para marcar):'
                : 'Registro de Vasos de Agua (Toca para marcar o desmarcar):'}
            </span>
            <span className="text-sky-400 font-mono font-bold">
              {waterLiters}L / {targetWaterLiters}L
            </span>
          </div>

          <div className="grid grid-cols-7 sm:grid-cols-14 gap-2">
            {Array.from({ length: activeDayData.targetWaterGlasses }, (_, idx) => {
              const filled = idx < activeDayData.waterGlasses250ml;
              return (
                <button
                  key={idx}
                  disabled={isPreviewMode}
                  onClick={() => updateWaterGlasses(idx + 1 - activeDayData.waterGlasses250ml, targetDateParam)}
                  className={`h-12 rounded-xl border flex flex-col items-center justify-center transition ${
                    isPreviewMode
                      ? 'bg-[#111827] border-gray-800 text-gray-700 cursor-not-allowed opacity-60'
                      : filled
                      ? 'bg-sky-500/25 border-sky-400 text-sky-300 shadow-md shadow-sky-500/20 font-bold'
                      : 'bg-[#111827] border-gray-800 text-gray-600 hover:border-gray-700'
                  }`}
                  title={`Vaso #${idx + 1} (250 ml)`}
                >
                  <GlassWater className="w-4 h-4" />
                  <span className="text-[9px] font-mono mt-0.5">#{idx + 1}</span>
                </button>
              );
            })}
          </div>

          {isPreviewMode ? (
            <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between gap-2 text-xs text-blue-200">
              <span>Modo vista previa de día futuro activo.</span>
              <button
                type="button"
                onClick={() => {
                  setPreviewWeekday(null);
                  setSelectedIso(todayIso);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#10B981] text-gray-950 font-extrabold text-xs"
              >
                Volver a Hoy para registrar agua
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-800/80">
              <button
                onClick={() => updateWaterGlasses(1, targetDateParam)}
                className="py-2 px-3 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 font-bold text-xs transition"
              >
                +1 Vaso (250 ml)
              </button>
              <button
                onClick={() => updateWaterGlasses(2, targetDateParam)}
                className="py-2 px-3 rounded-xl bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-white font-bold text-xs transition shadow-md shadow-[#3B82F6]/20"
              >
                +1 Botella (500 ml)
              </button>
              <button
                onClick={() => updateWaterGlasses(-1, targetDateParam)}
                className="py-2 px-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold text-xs transition"
              >
                −1 Vaso
              </button>
            </div>
          )}
        </div>

        <div className="bg-[#090D16] border border-sky-500/30 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-sky-400 shrink-0" />
            <h3 className="text-xs sm:text-sm font-extrabold text-white">
              ¿De dónde toma la app la información del agua y cómo beneficia directamente a tu cuerpo?
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-[#111827] border border-gray-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-sky-400 tracking-wider">
                1. Línea Base Médica: Báscula Camry 8 Electrodos (Reporte MovingLife)
              </span>
              <p className="text-gray-300 leading-relaxed">
                Tu pesaje clínico registró un{' '}
                <strong className="text-white">{waterPct}% de Agua Corporal Total</strong>. En un hombre
                de {userAge} años activo, el rango saludable óptimo es de{' '}
                <strong className="text-[#10B981]">55% a 65%</strong>. Tu nivel de {waterPct}% indica un
                estado de <strong>deshidratación celular</strong> que frena la pérdida de grasa y reduce
                tu fuerza muscular.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-[#111827] border border-gray-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-[#10B981] tracking-wider">
                2. Meta de Consumo Calculada: 14 Vasos (3.5 Litros / Día)
              </span>
              <p className="text-gray-300 leading-relaxed">
                Calculada por la fórmula deportiva para tus{' '}
                <strong className="text-white">{currentWeightKg} kg</strong> (35 ml/kg × {currentWeightKg}{' '}
                kg = ~2.9 L) más{' '}
                <strong className="text-[#F59E0B]">
                  600 ml de reposición por el sudor profuso de Insanity
                </strong>
                . Los 14 vasos en la app te permiten monitorear vaso a vaso en tiempo real.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-800/80 space-y-2.5">
            <div className="text-[11px] font-extrabold text-gray-300 uppercase tracking-wider">
              3 Beneficios Fisiológicos Exactos para tu Recomposición Corporal:
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#111827] border border-[#F59E0B]/30 space-y-1">
                <div className="font-extrabold text-[#F59E0B] flex items-center gap-1.5">
                  <Flame className="w-4 h-4" />
                  1. Hidrólisis de Grasa Visceral
                </div>
                <p className="text-gray-400 leading-relaxed text-[11px]">
                  La quema de grasa visceral (tu{' '}
                  <strong className="text-white">Nivel {visceralLevel} actual</strong>) es una reacción
                  bioquímica llamada <em>lipólisis por hidrólisis</em>: se necesitan{' '}
                  <strong className="text-[#F59E0B]">3 moléculas de H2O por cada triglicérido</strong>{' '}
                  para romper la grasa. Si estás deshidratado, la lipólisis se ralentiza hasta un 30%.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#111827] border border-[#3B82F6]/30 space-y-1">
                <div className="font-extrabold text-[#3B82F6] flex items-center gap-1.5">
                  <Scale className="w-4 h-4" />
                  2. Precisión de Electrodos Camry
                </div>
                <p className="text-gray-400 leading-relaxed text-[11px]">
                  Tu báscula conduce microcorrientes eléctricas a través del agua intracelular. Si estás
                  deshidratado ({waterPct}%), la corriente encuentra resistencia y la báscula{' '}
                  <strong>
                    sobreestima falsamente tu porcentaje de grasa y subestima la masa muscular de tus
                    piernas
                  </strong>
                  . Beber tus 3.5 L corrige tu medición real.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#111827] border border-emerald-500/30 space-y-1">
                <div className="font-extrabold text-[#10B981] flex items-center gap-1.5">
                  <HeartPulse className="w-4 h-4" />
                  3. Protección Cardíaca en Insanity
                </div>
                <p className="text-gray-400 leading-relaxed text-[11px]">
                  En sesiones de Insanity como <em>Pure Cardio</em> alcanzas picos de 158-175 bpm. El
                  agua mantiene el volumen plasmático de la sangre para que tu corazón bombee con menor
                  esfuerzo, previene calambres en gemelos y cuádriceps y disipa el calor corporal.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* COMIDAS FRECUENTES / PRESETS */}
      <div className="bg-[#111827] border border-gray-800 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#10B981]" />
              Comidas Frecuentes y Presets Rápidos (Añadir en 1 Toque)
            </h3>
            <p className="text-xs text-gray-400">
              {isPreviewMode
                ? 'Vuelve a Hoy para añadir alguno de estos platos frecuentes a tu día:'
                : `Toca cualquier plato frecuente para sumarlo automáticamente a ${dateLabel}:`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {state.quickMealPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                if (isPreviewMode) {
                  setPreviewWeekday(null);
                  setSelectedIso(todayIso);
                  setToastMsg('📍 Volviste a Hoy. Toca el plato de nuevo si deseas agregarlo.');
                  window.setTimeout(() => setToastMsg(null), 3500);
                  return;
                }
                handleQuickAddPreset(preset);
              }}
              className="p-3 rounded-xl bg-[#090D16] hover:bg-gray-800/80 border border-gray-800 hover:border-[#10B981]/50 text-left transition flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white group-hover:text-[#10B981] transition">
                    {preset.name}
                  </span>
                  <span className="p-1 rounded-lg bg-[#10B981]/15 text-[#10B981] shrink-0">
                    <Plus className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">
                    {preset.tag}
                  </span>
                  <span className="text-[11px] text-gray-400 truncate">{preset.portionLabel}</span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gray-800/80 text-[11px] font-mono">
                <span className="font-extrabold text-white">{preset.calories} kcal</span>
                <div className="flex items-center gap-2">
                  <span className="text-[#3B82F6]">P: {preset.proteinG}g</span>
                  <span className="text-[#F59E0B]">C: {preset.carbsG}g</span>
                  <span className="text-purple-400">G: {preset.fatG}g</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {toastMsg && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[#10B981] text-gray-950 px-4 py-2.5 rounded-2xl font-extrabold text-xs shadow-2xl flex items-center gap-2 border border-white/20">
          <Check className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
};
