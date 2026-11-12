import React, { useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Bluetooth,
  Camera,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  ClipboardPaste,
  Cpu,
  Droplets,
  Dumbbell,
  FileText,
  Flame,
  Footprints,
  HeartPulse,
  Layers,
  Moon,
  PenLine,
  RotateCcw,
  Scale,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
  TrendingDown,
  Upload,
  Watch,
  X,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CoachBriefingCard } from '../components/CoachBriefingCard';
import { WeeklyReportModal } from '../components/WeeklyReportModal';
import { useApp } from '../context/AppContext';
import {
  connectGalaxyWatch7BLE,
  parseSamsungHealthFile,
  parseSamsungHealthText,
} from '../services/smartSyncService';
import { ActiveTab } from '../types/fitness';

const WEEKDAYS_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const WEEKDAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

interface DashboardModuleProps {
  onNavigate: (tab: ActiveTab) => void;
  onOpenCoach?: () => void;
}

export const DashboardModule: React.FC<DashboardModuleProps> = ({ onNavigate, onOpenCoach }) => {
  const {
    state,
    setSelectedWeekday,
    setTrainingMode,
    updateWatchMetrics,
    getDynamicCalorieTarget,
    toggleInsanityDayCompleted,
    updateWaterGlasses,
  } = useApp();

  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isBleScanning, setIsBleScanning] = useState(false);
  const [isFileReading, setIsFileReading] = useState(false);
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);
  const [showWatchSyncTools, setShowWatchSyncTools] = useState(
    () => (state.watchMetrics.activeCalories || 0) === 0 && (state.watchMetrics.steps || 0) === 0
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    bmr,
    neatBasal,
    activeCalories,
    deficit,
    rawTarget,
    isFloored,
    targetCalories,
    consumedCalories,
    remainingCalories,
  } = getDynamicCalorieTarget();

  const isInsanityOnly = state.trainingMode === 'insanity_only';
  const weekday = state.selectedWeekdayIndex;
  const realTodayWeekday = new Date().getDay();
  const isRealToday = weekday === realTodayWeekday;
  const todayRoutine = state.routines.find((r) => r.weekdayIndex === weekday);
  const insanityDay =
    state.insanityCalendar.find((d) => d.dayNumber === state.currentInsanityDay) ||
    state.insanityCalendar[0];
  const latestCamry = state.camryHistory[state.camryHistory.length - 1];

  const totalProteinConsumed = state.nutrition.loggedMeals.reduce((acc, m) => acc + m.proteinG, 0);
  const currentWeightKg = latestCamry?.weightKg || 83.3;
  const currentFatPct = latestCamry?.bodyFatPercent || 33.9;
  const currentLeanKg =
    latestCamry?.leanBodyMassKg || Math.round(currentWeightKg * (1 - currentFatPct / 100) * 10) / 10;
  const proteinBaseWeightKg =
    currentFatPct > 25
      ? latestCamry?.standardWeightKg || Math.round(currentLeanKg * 1.18 * 10) / 10
      : currentWeightKg;

  const isHighCarbDay = isInsanityOnly
    ? !insanityDay.isRestDay && weekday !== 0
    : !(weekday === 0 || weekday === 4 || weekday === 3) ||
      [1, 2, 5].includes(weekday) ||
      (insanityDay.isMaxInterval && weekday !== 0 && weekday !== 4);

  const ageFactor = (state.userProfile?.age ?? 38) >= 35 ? 0.1 : 0;
  const targetProteinG = Math.round(
    isHighCarbDay ? proteinBaseWeightKg * (2.25 + ageFactor) : proteinBaseWeightKg * (2.4 + ageFactor)
  );

  const ringRadius = 66;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const progressRatio = Math.min(1.15, Math.max(0, consumedCalories / Math.max(1, targetCalories)));
  const ringStrokeDashoffset = ringCircumference - Math.min(1, progressRatio) * ringCircumference;

  const isDoubleImpactDay =
    !isInsanityOnly && !!todayRoutine && !insanityDay.isRestDay && insanityDay.durationMin >= 38;

  const showToast = (msg: string) => {
    setStatusMsg(msg);
    window.setTimeout(() => setStatusMsg(null), 7000);
  };

  // Modal manual para editar métricas del Galaxy Watch 7
  const [showWatchModal, setShowWatchModal] = useState(false);
  const [watchKcalInput, setWatchKcalInput] = useState(state.watchMetrics.activeCalories || 0);
  const [watchAvgHrInput, setWatchAvgHrInput] = useState(state.watchMetrics.avgHeartRate || 0);
  const [watchMaxHrInput, setWatchMaxHrInput] = useState(state.watchMetrics.maxHeartRate || 0);
  const [watchSleepScoreInput, setWatchSleepScoreInput] = useState(state.watchMetrics.sleepScore || 0);
  const [watchStepsInput, setWatchStepsInput] = useState(state.watchMetrics.steps || 0);

  const openWatchModal = () => {
    setWatchKcalInput(state.watchMetrics.activeCalories || 0);
    setWatchAvgHrInput(state.watchMetrics.avgHeartRate || 0);
    setWatchMaxHrInput(state.watchMetrics.maxHeartRate || 0);
    setWatchSleepScoreInput(state.watchMetrics.sleepScore || 0);
    setWatchStepsInput(state.watchMetrics.steps || 0);
    setShowWatchModal(true);
  };

  const handleSaveWatchModal = (e: React.FormEvent) => {
    e.preventDefault();
    updateWatchMetrics({
      activeCalories: Math.max(0, Number(watchKcalInput) || 0),
      avgHeartRate: Math.max(0, Number(watchAvgHrInput) || 0),
      maxHeartRate: Math.max(0, Number(watchMaxHrInput) || 0),
      sleepScore: Math.min(100, Math.max(0, Number(watchSleepScoreInput) || 0)),
      steps: Math.max(0, Number(watchStepsInput) || 0),
    });
    setShowWatchModal(false);
    showToast('✓ Métricas del Galaxy Watch 7 actualizadas correctamente.');
  };

  const handleBleConnect = async () => {
    setIsBleScanning(true);
    try {
      const bleRes = await connectGalaxyWatch7BLE();
      updateWatchMetrics({
        avgHeartRate: bleRes.avgHeartRate,
        maxHeartRate: Math.max(state.watchMetrics.maxHeartRate || 0, bleRes.avgHeartRate),
      });
      showToast(
        `✓ Sensor en vivo (${bleRes.deviceName}): ${bleRes.avgHeartRate} bpm. (Nota: Para calorías y sueño de Samsung Health, usa "Subir Captura")`
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se detectó el sensor BLE.');
    } finally {
      setIsBleScanning(false);
    }
  };

  const handleWatchFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsFileReading(true);
    try {
      const res = await parseSamsungHealthFile(file, state.watchMetrics, (msg) => setStatusMsg(msg));
      if (res.fieldsDetected.length > 0 || Object.keys(res.metrics).length > 0) {
        updateWatchMetrics(res.metrics);
        showToast(res.summaryMessage || '✓ Métricas de Samsung Health actualizadas.');
      } else {
        showToast('⚠️ No se detectaron números claros en la captura. Ingresa los valores manualmente.');
      }
    } catch {
      showToast('⚠️ Error al leer el archivo de Samsung Health.');
    } finally {
      setIsFileReading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleApplyPasteText = () => {
    if (!pasteText.trim()) return;
    const parsed = parseSamsungHealthText(pasteText, state.watchMetrics);
    updateWatchMetrics(parsed);
    setPasteText('');
    setShowPasteBox(false);
    showToast('✓ Datos extraídos de Samsung Health y sincronizados en Firebase.');
  };

  const currentWeight = latestCamry?.weightKg ?? 83.3;
  const targetWeight = state.userProfile?.targetWeightKg ?? 70;
  const remainingWeightLoss = Math.max(0, Math.round((currentWeight - targetWeight) * 10) / 10);
  const currentFatPctDisplay = latestCamry?.bodyFatPercent ?? 33.9;
  const targetFatPct = state.userProfile?.targetBodyFatPercent ?? 18;
  const visceralLevel = latestCamry?.visceralFatIndex ?? 13;
  const leanMassKg = latestCamry?.leanBodyMassKg ?? 55;
  const waterPct = latestCamry?.waterPercent ?? 48.5;
  const waterGlasses = state.nutrition.waterGlasses250ml;
  const insanityCompletedCount = state.insanityCalendar.filter((d) => d.completed).length;

  const calPct = Math.round((consumedCalories / Math.max(1, targetCalories)) * 100);
  const protPct = Math.round((totalProteinConsumed / Math.max(1, targetProteinG)) * 100);
  const insanityPct = Math.round((insanityCompletedCount / 63) * 100);
  const triOuterCirc = 2 * Math.PI * 46;
  const triMidCirc = 2 * Math.PI * 35;
  const triInnerCirc = 2 * Math.PI * 24;

  return (
    <div className="space-y-4 pb-12 font-sans select-none">
      {/* HERO BIO-ID + TRI-RING HUD */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#060A14] via-[#090F20] to-[#04060C] border border-cyan-500/30 p-4 sm:p-5 shadow-[0_0_30px_rgba(6,182,212,0.12)]">
        <div className="absolute inset-0 bg-[radial-gradient(#06b6d4_1px,transparent_1px)] [background-size:20px_20px] opacity-10 pointer-events-none" />
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="relative shrink-0">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-600 via-[#10B981] to-blue-500 p-0.5 shadow-[0_0_15px_rgba(6,182,212,0.45)]">
                <div className="w-full h-full bg-[#070B14] rounded-2xl flex flex-col items-center justify-center text-cyan-400">
                  <Activity className="w-6 h-6 animate-pulse" />
                  <span className="text-[8px] font-mono font-black text-white/80">APEX-01</span>
                </div>
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-[#070B14]" />
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-mono font-extrabold tracking-widest text-cyan-400 uppercase">
                  PANEL BIOMÉTRICO // SEGUIMIENTO DIARIO
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                    isInsanityOnly
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                  }`}
                >
                  {isInsanityOnly ? '⚡ SOLO INSANITY HIIT' : '🏋️ HÍBRIDO ACTIVO'}
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2 flex-wrap">
                CRISTOPHER
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-gray-800/90 text-gray-300 border border-gray-700">
                  {state.userProfile?.age ?? 38} AÑOS • {state.userProfile?.heightCm ?? 168} CM
                </span>
              </h1>
              <p className="text-xs text-gray-300 font-medium flex items-center gap-1.5 flex-wrap">
                <Target className="w-3.5 h-3.5 text-cyan-400" />
                <span>Meta clínica:</span>
                <strong className="text-white">Reducir Grasa Visceral</strong>
                <span className="text-cyan-400">+</span>
                <strong className="text-white">Proteger Masa Muscular</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start lg:self-center">
            <button
              onClick={() => onNavigate('nutrition')}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border border-emerald-500/50 text-emerald-300 font-bold text-xs flex items-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.2)] transition active:scale-95"
            >
              <Camera className="w-3.5 h-3.5 text-emerald-400" />
              <span>Cámara Nutrición IA</span>
            </button>
            <button
              onClick={() => onNavigate('camry')}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-500/50 text-cyan-300 font-bold text-xs flex items-center gap-1.5 shadow-[0_0_12px_rgba(6,182,212,0.2)] transition active:scale-95"
            >
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>Bio-Sensor Camry 8E</span>
            </button>
            <button
              type="button"
              onClick={() => setShowWeeklyReport(true)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-500/20 to-indigo-500/20 hover:from-purple-500/30 hover:to-indigo-500/30 border border-purple-500/50 text-purple-200 font-bold text-xs flex items-center gap-1.5 shadow-[0_0_12px_rgba(168,85,247,0.2)] transition active:scale-95"
            >
              <FileText className="w-3.5 h-3.5 text-purple-300" />
              <span>Reporte Semanal</span>
            </button>
          </div>
        </div>

        {/* Tri-Ring Daily Progress + 4 Biometric Delta Cards */}
        <div className="relative z-10 mt-4 pt-3.5 border-t border-cyan-500/20 grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
          {/* Triple-Ring HUD */}
          <div className="lg:col-span-5 bg-[#050811]/85 border border-gray-800/90 rounded-2xl p-3 flex items-center gap-3.5">
            <div className="relative w-24 h-24 shrink-0">
              <svg viewBox="0 0 112 112" className="w-full h-full -rotate-90">
                <circle cx="56" cy="56" r="46" stroke="#111827" strokeWidth="7" fill="transparent" />
                <circle
                  cx="56"
                  cy="56"
                  r="46"
                  stroke={calPct > 110 ? '#F59E0B' : '#10B981'}
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={triOuterCirc}
                  strokeDashoffset={triOuterCirc * (1 - Math.min(1, calPct / 100))}
                  fill="transparent"
                  className="transition-all duration-700"
                />
                <circle cx="56" cy="56" r="35" stroke="#111827" strokeWidth="7" fill="transparent" />
                <circle
                  cx="56"
                  cy="56"
                  r="35"
                  stroke="#06B6D4"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={triMidCirc}
                  strokeDashoffset={triMidCirc * (1 - Math.min(1, protPct / 100))}
                  fill="transparent"
                  className="transition-all duration-700"
                />
                <circle cx="56" cy="56" r="24" stroke="#111827" strokeWidth="7" fill="transparent" />
                <circle
                  cx="56"
                  cy="56"
                  r="24"
                  stroke="#F59E0B"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={triInnerCirc}
                  strokeDashoffset={triInnerCirc * (1 - Math.min(1, insanityPct / 100))}
                  fill="transparent"
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-[11px] font-mono font-black text-white">
                  {Math.min(999, Math.round((Math.min(100, calPct) + Math.min(100, protPct)) / 2))}%
                </span>
              </div>
            </div>

            <div className="flex-1 min-w-0 space-y-1.5 text-[11px] font-mono">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-gray-300 truncate">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  Calorías
                </span>
                <span className="font-bold text-emerald-400 shrink-0">
                  {calPct}% ({consumedCalories}/{targetCalories})
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-gray-300 truncate">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                  Proteína
                </span>
                <span className="font-bold text-cyan-300 shrink-0">
                  {protPct}% ({totalProteinConsumed}/{targetProteinG}g)
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-gray-300 truncate">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  Insanity 63D
                </span>
                <span className="font-bold text-amber-300 shrink-0">
                  {insanityCompletedCount}/63 ({insanityPct}%)
                </span>
              </div>
            </div>
          </div>

          {/* 4 Biometric Delta Cards */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="bg-[#050811]/85 border border-gray-800/80 rounded-xl p-2.5 flex flex-col justify-center">
              <span className="text-[9px] font-mono uppercase tracking-wider text-gray-400 block">
                Delta Peso
              </span>
              <span className="text-xs sm:text-sm font-mono font-black text-white mt-0.5">
                {currentWeight}kg{' '}
                <span className="text-cyan-400 font-normal">→ {targetWeight}</span>
              </span>
              <span className="text-[10px] font-mono text-cyan-400 block font-bold">
                -{remainingWeightLoss} kg rest.
              </span>
            </div>
            <div className="bg-[#050811]/85 border border-gray-800/80 rounded-xl p-2.5 flex flex-col justify-center">
              <span className="text-[9px] font-mono uppercase tracking-wider text-gray-400 block">
                Grasa Corporal
              </span>
              <span className="text-xs sm:text-sm font-mono font-black text-[#F59E0B] mt-0.5">
                {currentFatPctDisplay}%{' '}
                <span className="text-white/70 font-normal">→ {targetFatPct}%</span>
              </span>
              <span className="text-[10px] font-mono text-[#F59E0B] block font-bold">
                Meta Fitness
              </span>
            </div>
            <div className="bg-[#050811]/85 border border-gray-800/80 rounded-xl p-2.5 flex flex-col justify-center">
              <span className="text-[9px] font-mono uppercase tracking-wider text-gray-400 block">
                Masa Magra (LBM)
              </span>
              <span className="text-xs sm:text-sm font-mono font-black text-[#10B981] mt-0.5">
                {leanMassKg} kg <span className="text-emerald-400 font-normal">100%</span>
              </span>
              <span className="text-[10px] font-mono text-[#10B981] block font-bold">
                Protegida
              </span>
            </div>
            <div className="bg-[#050811]/85 border border-gray-800/80 rounded-xl p-2.5 flex flex-col justify-center">
              <span className="text-[9px] font-mono uppercase tracking-wider text-gray-400 block">
                Grasa Visceral
              </span>
              <span className="text-xs sm:text-sm font-mono font-black text-rose-400 mt-0.5">
                Nivel {visceralLevel} <span className="text-white/70 font-normal">→ ≤9</span>
              </span>
              <span className="text-[10px] font-mono text-rose-400 block font-bold">
                {visceralLevel > 9 ? 'Alerta Metabólica' : 'Rango Saludable ✓'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SMART PERSONAL TRAINER BRIEFING: READINESS, AYER->HOY Y SEMÁFORO */}
      <CoachBriefingCard
        targetCalories={targetCalories}
        consumedCalories={consumedCalories}
        targetProteinG={targetProteinG}
        consumedProteinG={totalProteinConsumed}
        onNavigate={onNavigate}
        onOpenCoach={onOpenCoach}
      />

      {/* CHRONO-DETECTOR & MODO DE ENTRENAMIENTO */}
      <div className="bg-[#070B14] border border-gray-800 rounded-2xl p-3.5 shadow-xl space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-ping shrink-0" />
            <span className="text-xs font-mono font-black uppercase tracking-wider text-gray-300">
              CHRONO-DETECTOR // DÍA ACTIVO:{' '}
              <span className="text-cyan-400 font-extrabold">{WEEKDAYS_FULL[weekday].toUpperCase()}</span>
            </span>
            {isRealToday ? (
              <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <span>🟢</span> TIEMPO REAL (HOY)
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setSelectedWeekday(realTodayWeekday)}
                className="text-[10px] font-mono font-extrabold px-2.5 py-0.5 rounded-full bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 flex items-center gap-1 transition active:scale-95"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>VOLVER A HOY ({WEEKDAYS_FULL[realTodayWeekday].toUpperCase()})</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            <div className="inline-flex items-center bg-[#050811] border border-gray-800 rounded-xl p-0.5 text-[10px] font-mono">
              <button
                type="button"
                onClick={() => setTrainingMode('insanity_only')}
                className={`px-2 py-1 rounded-lg font-extrabold transition flex items-center gap-1 ${
                  isInsanityOnly
                    ? 'bg-amber-500 text-gray-950 shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
                title="Enfoque 100% Insanity HIIT: Coach y Nutrición se calibran sin asumir doble sesión con pesas"
              >
                <Zap className="w-3 h-3" />
                <span>Solo Insanity</span>
              </button>
              <button
                type="button"
                onClick={() => setTrainingMode('hybrid')}
                className={`px-2 py-1 rounded-lg font-extrabold transition flex items-center gap-1 ${
                  !isInsanityOnly
                    ? 'bg-cyan-500 text-gray-950 shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
                title="Sesión doble: Pesas Torso/Pierna + Insanity HIIT"
              >
                <Dumbbell className="w-3 h-3" />
                <span>Híbrido</span>
              </button>
            </div>

            <span
              className={`text-[10px] font-mono font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                isInsanityOnly
                  ? insanityDay.isRestDay
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40'
                  : isDoubleImpactDay
                  ? 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}
            >
              {isInsanityOnly
                ? insanityDay.isRestDay
                  ? '🧘 RECUPERACIÓN ACTIVA INSANITY'
                  : '🔥 FASE SOLO INSANITY HIIT'
                : isDoubleImpactDay
                ? '⚡ DOBLE IMPACTO: PESAS + INSANITY'
                : '🛡️ DÍA DE CONTROL METABÓLICO'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS_SHORT.map((label, idx) => {
            const isSelected = idx === weekday;
            const isToday = idx === realTodayWeekday;
            const hasStrength = [1, 2, 4, 5].includes(idx);
            return (
              <button
                key={label}
                onClick={() => setSelectedWeekday(idx)}
                className={`py-2 px-1 rounded-xl text-xs font-mono font-black flex flex-col items-center gap-1 transition border relative ${
                  isSelected
                    ? 'bg-gradient-to-b from-cyan-500 to-blue-600 text-white border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                    : 'bg-[#050811] text-gray-400 border-gray-800 hover:border-cyan-500/40 hover:text-white'
                }`}
              >
                {isToday && (
                  <span
                    className={`text-[8px] font-black uppercase px-1 rounded -top-2 absolute shadow-sm ${
                      isSelected
                        ? 'bg-white text-cyan-700'
                        : 'bg-emerald-500 text-gray-950 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                    }`}
                  >
                    HOY
                  </span>
                )}
                <span className="mt-0.5 tracking-tight">{label}</span>
                <div className="flex items-center gap-1">
                  {!isInsanityOnly && hasStrength && (
                    <span
                      title="Bloque de Fuerza"
                      className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-cyan-400'}`}
                    />
                  )}
                  {idx !== 0 && (
                    <span
                      title="Insanity HIIT"
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected ? 'bg-[#F59E0B]' : 'bg-[#F59E0B]/80'
                      }`}
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* MISIÓN FUERZA + INSANITY 63 DÍAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#070B14] to-[#0A1020] border p-4 sm:p-5 flex flex-col justify-between shadow-[0_0_20px_rgba(6,182,212,0.08)] ${
            isInsanityOnly ? 'border-gray-700/80 opacity-95' : 'border-cyan-500/30'
          }`}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-gray-800/80 pb-2.5">
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-mono font-black px-2.5 py-1 rounded-lg border uppercase tracking-wider ${
                  isInsanityOnly
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    : 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                }`}
              >
                <Dumbbell className="w-3.5 h-3.5" />
                MISIÓN FUERZA // {WEEKDAYS_FULL[weekday].toUpperCase()}
              </span>
              <span className="text-[10px] font-mono text-gray-400">
                {isInsanityOnly ? 'En Pausa Temporal' : 'Torso / Pierna A/B'}
              </span>
            </div>

            {isInsanityOnly ? (
              <div className="py-3 space-y-2.5">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-amber-300 uppercase font-mono">
                      ⏸️ Bloque de Pesas Pausado (Modo Solo Insanity)
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    El Coach IA y tus macros están calibrados exclusivamente para{' '}
                    <strong className="text-white">Insanity HIIT</strong> sin asumir sobrecarga de doble
                    sesión con pesas. Protegemos tu recuperación hasta que decidas retomar el esquema híbrido.
                  </p>
                </div>
                {todayRoutine && (
                  <div className="text-[11px] font-mono text-gray-400 px-1">
                    Rutina en espera para {WEEKDAYS_FULL[weekday]}: <span className="text-gray-200">{todayRoutine.title}</span>
                  </div>
                )}
              </div>
            ) : todayRoutine ? (
              <div className="space-y-2.5">
                <div>
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    {todayRoutine.title}
                  </h3>
                  <p className="text-xs text-cyan-300/80 font-medium">{todayRoutine.focus}</p>
                </div>
                <div className="space-y-1.5">
                  {todayRoutine.exercises.slice(0, 3).map((ex, idx) => {
                    const completedCount = ex.sets.filter((s) => s.completed).length;
                    return (
                      <div
                        key={ex.id}
                        className="flex items-center justify-between text-xs bg-[#050811] px-3 py-2 rounded-xl border border-gray-800/80 font-mono"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span className="w-4 h-4 rounded bg-cyan-500/20 text-cyan-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-gray-200 truncate">{ex.name}</span>
                        </div>
                        <span className="text-[11px] text-cyan-400 font-bold shrink-0">
                          {completedCount}/{ex.targetSets}s • {ex.restSeconds}s rec
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-4 space-y-1 text-center">
                <h3 className="text-sm font-bold text-gray-200">Recuperación del Sistema Nervioso</h3>
                <p className="text-xs text-gray-400">
                  Día sin sobrecarga axial. Priorizar movilidad articular, rotadores con mancuernas rojas o
                  cardio HIIT.
                </p>
              </div>
            )}
          </div>

          {isInsanityOnly ? (
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTrainingMode('hybrid')}
                className="flex-1 py-2.5 px-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 font-mono font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 uppercase tracking-wider"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Activar Pesas + HIIT</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('strength')}
                className="py-2.5 px-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 font-mono font-bold text-xs flex items-center gap-1 transition shrink-0"
              >
                <span>Ver Rutinas</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={() => onNavigate('strength')}
                className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-mono font-black text-xs flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.3)] transition active:scale-95 uppercase tracking-wider"
              >
                <span>Lanzar Tracker de Fuerza</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setTrainingMode('insanity_only')}
                title="Pausar pesas temporalmente y usar modo Solo Insanity"
                className="py-2.5 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-mono font-bold text-xs flex items-center gap-1 transition shrink-0"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Pausar Fuerza</span>
              </button>
            </div>
          )}
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#070B14] to-[#120F08] border border-amber-500/30 p-4 sm:p-5 flex flex-col justify-between shadow-[0_0_20px_rgba(245,158,11,0.08)]">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-gray-800/80 pb-2.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-mono font-black px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 uppercase tracking-wider">
                <Zap className="w-3.5 h-3.5" />
                INSANITY DÍA {insanityDay.dayNumber}/63
              </span>
              <span className="text-[10px] font-mono text-gray-400">
                Semana {insanityDay.weekNumber} • Fase {insanityDay.weekNumber <= 4 ? '1 (Base)' : '2 (Max)'}
              </span>
            </div>

            <div className="space-y-2">
              <div>
                <h3 className="text-base font-extrabold text-white">{insanityDay.workoutTitle}</h3>
                <p className="text-xs text-amber-300/80 font-medium">
                  {insanityDay.completed ? 'Duración real: ' : 'Duración oficial: '}
                  <strong className="text-white">{insanityDay.durationMin} min</strong> •{' '}
                  {insanityDay.completed && insanityDay.avgHr
                    ? `FC Prom ${insanityDay.avgHr} bpm`
                    : 'Zona 4 Anaeróbica'}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 font-mono">
                <div className="bg-[#050811] border border-gray-800 rounded-xl p-2 text-center">
                  <span className="text-[9px] uppercase tracking-wider text-gray-400 block">Estado</span>
                  <span
                    className={`text-xs font-bold ${
                      insanityDay.completed ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {insanityDay.completed ? '✓ HECHO' : 'PENDIENTE'}
                  </span>
                </div>
                <div className="bg-[#050811] border border-gray-800 rounded-xl p-2 text-center">
                  <span className="text-[9px] uppercase tracking-wider text-gray-400 block">
                    {insanityDay.completed && insanityDay.caloriesBurned
                      ? 'Gasto Real'
                      : 'Estimado'}
                  </span>
                  <span
                    className={`text-xs font-bold ${
                      insanityDay.completed && insanityDay.caloriesBurned
                        ? 'text-emerald-300'
                        : 'text-white'
                    }`}
                  >
                    {insanityDay.isRestDay
                      ? '0'
                      : insanityDay.completed && insanityDay.caloriesBurned
                      ? insanityDay.caloriesBurned
                      : `~${Math.round(insanityDay.durationMin * 11.5)}`}{' '}
                    kcal
                  </span>
                </div>
                <div className="bg-[#050811] border border-gray-800 rounded-xl p-2 text-center">
                  <span className="text-[9px] uppercase tracking-wider text-gray-400 block">Campaña 63D</span>
                  <span className="text-xs font-bold text-emerald-400">
                    {insanityCompletedCount}/63 ({Math.round((insanityCompletedCount / 63) * 100)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => toggleInsanityDayCompleted(insanityDay.dayNumber)}
              className={`flex-1 py-2.5 px-3 rounded-xl font-mono font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 uppercase tracking-wider ${
                insanityDay.completed
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                  : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-gray-950 font-black shadow-[0_0_15px_rgba(245,158,11,0.3)]'
              }`}
            >
              <CircleCheck className="w-4 h-4" />
              <span>{insanityDay.completed ? 'Completado ✓' : 'Marcar Hecho'}</span>
            </button>
            <button
              onClick={() => onNavigate('insanity')}
              className="py-2.5 px-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 font-mono font-bold text-xs flex items-center gap-1 transition shrink-0"
            >
              <span>Matriz 9S</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 4 TARJETAS BIOMÉTRICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#070B14] border border-rose-500/30 rounded-2xl p-3.5 space-y-2 relative overflow-hidden shadow-[0_0_15px_rgba(244,63,94,0.06)]">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-[10px] text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
              Grasa Visceral
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30">
              ALERTA
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-white">NIVEL {visceralLevel}</span>
            <span className="text-xs font-mono text-cyan-400 font-semibold">Meta: ≤9</span>
          </div>
          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 rounded-full"
              style={{ width: `${Math.min(100, (visceralLevel / 18) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400 leading-tight">
            Prioridad clínica: reducir 4 niveles para proteger hígado y resistencia a la insulina.
          </p>
        </div>

        <div className="bg-[#070B14] border border-cyan-500/30 rounded-2xl p-3.5 space-y-2 relative overflow-hidden shadow-[0_0_15px_rgba(6,182,212,0.06)]">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-[10px] text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              Segmentos Camry
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-400 font-bold border border-cyan-500/30">
              5-ZONAS
            </span>
          </div>
          <div className="space-y-1 font-mono text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Brazos:</span>
              <span className="text-emerald-400 font-bold">104.6% (Estándar ✓)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Tronco:</span>
              <span className="text-emerald-400 font-bold">97.1% (Estándar ✓)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Piernas:</span>
              <span className="text-[#F59E0B] font-bold">88.3% (Bajo &lt;90% ⚠️)</span>
            </div>
          </div>
          <p className="text-[10px] text-cyan-400/90 leading-tight font-medium">
            {isInsanityOnly
              ? 'Solo Insanity: pliometría activa piernas mientras decides cuándo reactivar pesas.'
              : 'Enfoque hoy: Pierna B (Sentadilla Búlgara + RDL) para nivelar piernas a >90%.'}
          </p>
        </div>

        <div className="bg-[#070B14] border border-blue-500/30 rounded-2xl p-3.5 space-y-2 relative overflow-hidden shadow-[0_0_15px_rgba(59,130,246,0.06)]">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-[10px] text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Droplets className="w-3.5 h-3.5 text-blue-400" />
              Agua Celular
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => updateWaterGlasses(-1)}
                className="w-5 h-5 rounded bg-gray-800 text-gray-300 hover:text-white flex items-center justify-center font-mono font-bold"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => updateWaterGlasses(1)}
                className="w-5 h-5 rounded bg-blue-500/30 text-blue-300 hover:text-white flex items-center justify-center font-mono font-bold"
              >
                +
              </button>
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-white">{waterPct}%</span>
            <span className="text-xs font-mono text-blue-400 font-bold">
              {waterGlasses}/14 vasos ({waterGlasses * 250} ml)
            </span>
          </div>
          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full"
              style={{ width: `${Math.min(100, (waterGlasses / 14) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400 leading-tight">
            Meta: 3.5 L diarios para optimizar conductancia eléctrica de electrodos Camry.
          </p>
        </div>

        <div className="bg-[#070B14] border border-emerald-500/30 rounded-2xl p-3.5 space-y-2 relative overflow-hidden shadow-[0_0_15px_rgba(16,185,129,0.06)]">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-[10px] text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-emerald-400" />
              Metabolismo Basal
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
              IMB MOTOR
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-white">{bmr}</span>
            <span className="text-xs font-mono text-emerald-400 font-semibold">kcal/día en reposo</span>
          </div>
          <div className="space-y-1 font-mono text-[11px]">
            <div className="flex items-center justify-between text-gray-400">
              <span>Proteína Objetivo:</span>
              <span className="text-white font-bold">{targetProteinG} g/día (Masa Magra)</span>
            </div>
            <div className="flex items-center justify-between text-gray-400">
              <span>Consumido Hoy:</span>
              <span className="text-emerald-400 font-bold">
                {totalProteinConsumed} g ({Math.round((totalProteinConsumed / targetProteinG) * 100)}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* MATRIZ ENERGÉTICA + GALAXY WATCH 7 TELEMETRÍA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-6 bg-[#070B14] border border-emerald-500/30 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-[0_0_20px_rgba(16,185,129,0.08)]">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-mono font-black text-white flex items-center gap-2 uppercase tracking-wider">
                <Flame className="w-4 h-4 text-emerald-400" />
                Matriz de Balance Energético
              </h3>
              <p className="text-xs text-gray-400">
                Fórmula: IMB ({bmr}) + Base (+{neatBasal}) + Reloj ({activeCalories}) − {deficit} ={' '}
                {rawTarget} kcal
                {isFloored ? ` → Piso seguro: ${targetCalories} kcal` : ''}
              </p>
            </div>
            <button
              onClick={() => onNavigate('nutrition')}
              className="text-xs font-mono font-bold text-emerald-400 hover:underline flex items-center gap-1"
            >
              <span>Detalle</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-5 my-2">
            <div className="relative w-40 h-40 flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 150 150">
                <circle cx="75" cy="75" r={ringRadius} stroke="#111827" strokeWidth="10" fill="transparent" />
                <circle
                  cx="75"
                  cy="75"
                  r={ringRadius}
                  stroke={remainingCalories >= 0 ? '#10B981' : '#F59E0B'}
                  strokeWidth="10"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringStrokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-700 filter drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[9px] uppercase tracking-widest text-gray-400 font-mono font-bold">
                  META HOY
                </span>
                <span className="text-2xl font-black text-white font-mono">{targetCalories}</span>
                <span className="text-[10px] text-emerald-400 font-mono font-bold">KCAL TOTAL</span>
              </div>
            </div>

            <div className="flex-1 w-full space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between p-2 rounded-xl bg-[#050811] border border-gray-800">
                <span className="text-gray-400 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-purple-400" />
                  IMB Basal (Camry)
                </span>
                <span className="font-bold text-white">+{bmr} kcal</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-[#050811] border border-gray-800">
                <span className="text-gray-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  Base Diaria / Digestión (+10%)
                </span>
                <span className="font-bold text-cyan-300">+{neatBasal} kcal</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-[#050811] border border-gray-800">
                <span className="text-gray-400 flex items-center gap-1.5">
                  <Watch className="w-3.5 h-3.5 text-amber-400" />
                  Kcal Activas (Watch 7)
                </span>
                <span className="font-bold text-amber-400">+{activeCalories} kcal</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-[#050811] border border-gray-800">
                <span className="text-gray-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  Déficit Lipolítico
                </span>
                <span className="font-bold text-emerald-400">−{deficit} kcal</span>
              </div>
              {isFloored && (
                <div className="flex items-center justify-between p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px]">
                  <span className="text-amber-200">Protección Metabólica (Piso Clínico)</span>
                  <span className="font-bold text-amber-300">
                    {rawTarget} → {targetCalories} kcal mín.
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <span className="text-gray-200 font-bold">Consumido / Restante</span>
                <span className="font-black text-emerald-400">
                  {consumedCalories} /{' '}
                  {remainingCalories >= 0
                    ? `${remainingCalories} disp.`
                    : `${Math.abs(remainingCalories)} extra`}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 bg-[#070B14] border border-cyan-500/30 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-3 shadow-[0_0_20px_rgba(6,182,212,0.08)]">
          <div className="flex items-center justify-between gap-2 border-b border-gray-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                <Watch className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-mono font-black text-white flex items-center gap-2 uppercase tracking-wider">
                  <span>Galaxy Watch 7 // Telemetría</span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold border border-cyan-500/40">
                    S23 Ultra Link
                  </span>
                </h3>
                <p className="text-[11px] text-gray-400">
                  Sensores biométricos cardíacos y metabólicos
                </p>
              </div>
            </div>
          </div>

          {statusMsg && (
            <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-mono font-bold">
              {statusMsg}
            </div>
          )}

          <div className="bg-[#050811] border border-gray-800 rounded-xl p-2.5 space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.txt,.csv,.json"
              onChange={handleWatchFileChange}
              className="hidden"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-gray-400 font-mono text-[11px] flex items-center gap-1 font-semibold">
                <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                Samsung Health:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isFileReading}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-mono font-extrabold text-[11px] flex items-center gap-1 shadow-sm transition active:scale-95"
                >
                  <Upload className="w-3 h-3" />
                  <span>{isFileReading ? 'Leyendo...' : '📂 Subir Captura S-Health'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowWatchSyncTools((v) => !v)}
                  className="px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 font-mono text-[11px] font-bold flex items-center gap-1 transition border border-gray-700/70"
                >
                  <span>Opciones &amp; Presets</span>
                  {showWatchSyncTools ? (
                    <ChevronUp className="w-3.5 h-3.5 text-cyan-400" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />
                  )}
                </button>
              </div>
            </div>

            {showWatchSyncTools && (
              <div className="pt-2 border-t border-gray-800/80 space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowPasteBox((v) => !v)}
                    className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 font-mono text-[11px] font-bold flex items-center gap-1 transition"
                  >
                    <ClipboardPaste className="w-3 h-3" />
                    <span>Pegar Texto</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleBleConnect}
                    disabled={isBleScanning}
                    className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-mono text-[11px] font-bold border border-cyan-500/40 flex items-center gap-1 transition"
                  >
                    <Bluetooth className="w-3 h-3" />
                    <span>{isBleScanning ? 'Buscando...' : 'BLE Pulso'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
                  <button
                    onClick={() => {
                      updateWatchMetrics({
                        avgHeartRate: 164,
                        maxHeartRate: 189,
                        activeCalories: 920,
                        steps: 12500,
                      });
                      showToast('✓ Perfil "Doble Impacto (+920 kcal)" cargado.');
                    }}
                    className="py-1.5 px-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold transition truncate"
                  >
                    🔥 Doble Impacto
                  </button>
                  <button
                    onClick={() => {
                      updateWatchMetrics({
                        avgHeartRate: 156,
                        maxHeartRate: 182,
                        activeCalories: 690,
                        steps: 10800,
                      });
                      showToast('✓ Perfil "Fuerza / HIIT (+690 kcal)" cargado.');
                    }}
                    className="py-1.5 px-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 font-bold transition truncate"
                  >
                    🏋️ Entreno Normal
                  </button>
                  <button
                    onClick={() => {
                      updateWatchMetrics({
                        avgHeartRate: 128,
                        maxHeartRate: 152,
                        activeCalories: 410,
                        steps: 8500,
                      });
                      showToast('✓ Perfil "Recovery (+410 kcal)" cargado.');
                    }}
                    className="py-1.5 px-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold transition truncate"
                  >
                    🧘 Recovery
                  </button>
                </div>

                {showPasteBox && (
                  <div className="pt-2 border-t border-gray-800 space-y-1.5">
                    <p className="text-[10px] text-gray-300 font-mono">
                      En tu S23 Ultra: toma captura en S-Health, toca el botón &quot;T&quot; de One UI y pégalo aquí:
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={pasteText}
                        onChange={(e) => setPasteText(e.target.value)}
                        placeholder="Ej: 38 min, 483 kcal, 154 bpm"
                        className="flex-1 bg-[#111827] border border-gray-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                      />
                      <button
                        onClick={handleApplyPasteText}
                        className="px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-gray-950 font-mono font-black text-xs shrink-0"
                      >
                        Auto-Fill
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono px-1">
              <span className="flex items-center gap-1.5">
                <Watch className="w-3.5 h-3.5 text-cyan-400" />
                Telemetría S-Health:
              </span>
              <button
                type="button"
                onClick={openWatchModal}
                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-bold transition hover:underline active:scale-95 text-[10px] bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/30"
                title="Toca para ajustar manualmente sueño, calorías, pulso o pasos"
              >
                <PenLine className="w-2.5 h-2.5" />
                <span>Editar Valores</span>
              </button>
            </div>

            <div className="grid grid-cols-4 gap-1.5 font-mono text-center">
              <button
                type="button"
                onClick={openWatchModal}
                className="bg-[#050811] hover:bg-[#0d1527] border border-gray-800 hover:border-gray-700 rounded-xl p-2 transition text-left cursor-pointer active:scale-95"
                title="Toca para editar FC"
              >
                <span className="text-[9px] uppercase tracking-wider text-rose-400 flex items-center justify-center gap-0.5">
                  <HeartPulse className="w-3 h-3" /> FC Media
                </span>
                <span className="text-base font-black text-white block text-center leading-tight mt-0.5">
                  {state.watchMetrics.avgHeartRate}
                </span>
                <span className="text-[8px] text-gray-400 block text-center">
                  bpm (Máx {state.watchMetrics.maxHeartRate})
                </span>
              </button>
              <button
                type="button"
                onClick={openWatchModal}
                className="bg-[#050811] hover:bg-[#0d1527] border border-gray-800 hover:border-gray-700 rounded-xl p-2 transition text-left cursor-pointer active:scale-95"
                title="Toca para editar Kcal"
              >
                <span className="text-[9px] uppercase tracking-wider text-amber-400 flex items-center justify-center gap-0.5">
                  <Flame className="w-3 h-3" /> Kcal Activas
                </span>
                <span className="text-base font-black text-amber-400 block text-center leading-tight mt-0.5">
                  {state.watchMetrics.activeCalories}
                </span>
                <span className="text-[8px] text-gray-400 block text-center">quemadas</span>
              </button>
              <button
                type="button"
                onClick={openWatchModal}
                className="bg-[#050811] hover:bg-[#0d1527] border border-gray-800 hover:border-gray-700 rounded-xl p-2 transition text-left cursor-pointer active:scale-95"
                title="Toca para editar Sueño"
              >
                <span className="text-[9px] uppercase tracking-wider text-purple-400 flex items-center justify-center gap-0.5">
                  <Moon className="w-3 h-3" /> Sueño
                </span>
                <span className="text-base font-black text-white block text-center leading-tight mt-0.5">
                  {state.watchMetrics.sleepScore}
                </span>
                <span className="text-[8px] text-gray-400 block text-center">/100 score</span>
              </button>
              <button
                type="button"
                onClick={openWatchModal}
                className="bg-[#050811] hover:bg-[#0d1527] border border-gray-800 hover:border-gray-700 rounded-xl p-2 transition text-left cursor-pointer active:scale-95"
                title="Toca para editar Pasos"
              >
                <span className="text-[9px] uppercase tracking-wider text-emerald-400 flex items-center justify-center gap-0.5">
                  <Footprints className="w-3 h-3" /> Pasos
                </span>
                <span className="text-base font-black text-white block text-center leading-tight mt-0.5">
                  {state.watchMetrics.steps}
                </span>
                <span className="text-[8px] text-gray-400 block text-center">pasos hoy</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* VECTOR DE RECOMPOSICIÓN / CURVA CAMRY 8E */}
      <div className="bg-[#070B14] border border-gray-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-mono font-black text-white flex items-center gap-2 uppercase tracking-wider">
              <TrendingDown className="w-4 h-4 text-cyan-400" />
              Vector de Recomposición // Curva Real (Camry 8E)
            </h3>
            <p className="text-xs text-gray-400">
              Evolución de Peso corporal ({currentWeight} kg) vs Grasa ({currentFatPctDisplay}%) en
              dirección a 75 kg / 19%
            </p>
          </div>
          <button
            onClick={() => onNavigate('camry')}
            className="text-xs font-mono font-bold text-cyan-400 hover:underline flex items-center gap-1"
          >
            <span>Ver 5 Zonas</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={state.camryHistory} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fatGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" opacity={0.6} />
              <XAxis dataKey="date" stroke="#6B7280" fontSize={11} fontFamily="monospace" />
              <YAxis stroke="#6B7280" fontSize={11} fontFamily="monospace" domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#050811',
                  borderColor: '#06B6D4',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                }}
              />
              <Area
                type="monotone"
                dataKey="weightKg"
                name="Peso (kg)"
                stroke="#06B6D4"
                strokeWidth={2.5}
                fill="url(#weightGrad)"
              />
              <Area
                type="monotone"
                dataKey="bodyFatPercent"
                name="% Grasa Corporal"
                stroke="#10B981"
                strokeWidth={2.5}
                fill="url(#fatGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* MODAL TELEMETRÍA WATCH 7 */}
      {showWatchModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0D1322] border border-gray-700 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <Watch className="w-5 h-5 text-cyan-400" />
                <h3 className="font-mono font-bold text-white text-sm">Galaxy Watch 7 // Telemetría</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowWatchModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveWatchModal} className="space-y-3 font-mono text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-amber-400 block font-bold mb-1">
                    🔥 Kcal Activas
                  </label>
                  <input
                    type="number"
                    value={watchKcalInput}
                    onChange={(e) => setWatchKcalInput(Number(e.target.value))}
                    className="w-full bg-[#111827] border border-gray-700 rounded-lg px-2.5 py-1.5 text-white font-bold text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-purple-400 block font-bold mb-1">
                    🌙 Sueño (Score 0-100)
                  </label>
                  <input
                    type="number"
                    max={100}
                    min={0}
                    value={watchSleepScoreInput}
                    onChange={(e) => setWatchSleepScoreInput(Number(e.target.value))}
                    className="w-full bg-[#111827] border border-gray-700 rounded-lg px-2.5 py-1.5 text-white font-bold text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-rose-400 block font-bold mb-1">
                    💓 FC Promedio (bpm)
                  </label>
                  <input
                    type="number"
                    value={watchAvgHrInput}
                    onChange={(e) => setWatchAvgHrInput(Number(e.target.value))}
                    className="w-full bg-[#111827] border border-gray-700 rounded-lg px-2.5 py-1.5 text-white font-bold text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-rose-500 block font-bold mb-1">
                    📈 FC Máxima (bpm)
                  </label>
                  <input
                    type="number"
                    value={watchMaxHrInput}
                    onChange={(e) => setWatchMaxHrInput(Number(e.target.value))}
                    className="w-full bg-[#111827] border border-gray-700 rounded-lg px-2.5 py-1.5 text-white font-bold text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-emerald-400 block font-bold mb-1">👟 Pasos de Hoy</label>
                <input
                  type="number"
                  value={watchStepsInput}
                  onChange={(e) => setWatchStepsInput(Number(e.target.value))}
                  className="w-full bg-[#111827] border border-gray-700 rounded-lg px-2.5 py-1.5 text-white font-bold text-sm"
                />
              </div>
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowWatchModal(false)}
                  className="flex-1 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-gray-950 font-bold font-mono transition"
                >
                  Guardar Métricas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <WeeklyReportModal
        isOpen={showWeeklyReport}
        onClose={() => setShowWeeklyReport(false)}
      />
    </div>
  );
};
