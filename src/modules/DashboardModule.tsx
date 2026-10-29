import React, { useState } from 'react';
import {
  Flame,
  HeartPulse,
  Moon,
  Dumbbell,
  Zap,
  Watch,
  Scale,
  CheckCircle2,
  ArrowRight,
  Footprints,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  Bluetooth,
  ClipboardPaste,
  Smartphone,
  Plus,
  Minus,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { NavigationTab } from '../types/fitness';
import {
  connectWatchBluetoothBLE,
  parseSamsungHealthText,
} from '../services/smartSyncService';

interface DashboardModuleProps {
  onNavigate: (tab: NavigationTab) => void;
}

const WEEKDAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export const DashboardModule: React.FC<DashboardModuleProps> = ({ onNavigate }) => {
  const {
    state,
    setSelectedWeekday,
    updateWatchMetrics,
    getDynamicCalorieTarget,
    getAsymmetryAnalysis,
    toggleInsanityDayCompleted,
  } = useApp();

  const [showHealthPaste, setShowHealthPaste] = useState(false);
  const [healthRawText, setHealthRawText] = useState('');
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [bleLoading, setBleLoading] = useState(false);

  const {
    bmr,
    activeCalories,
    deficit,
    targetCalories,
    consumedCalories,
    remainingCalories,
  } = getDynamicCalorieTarget();

  const activeWeekday = state.selectedWeekdayIndex;

  // Match strength routine for selected weekday (1=Lun, 2=Mar, 4=Jue, 5=Vie)
  const todayStrengthRoutine = state.routines.find((r) => r.weekdayIndex === activeWeekday);

  // Get active Insanity day from calendar
  const currentInsanity =
    state.insanityCalendar.find((d) => d.dayNumber === state.currentInsanityDay) ||
    state.insanityCalendar[0];

  const latestCamry = state.camryHistory[state.camryHistory.length - 1];
  const asymmetries = getAsymmetryAnalysis().filter((a) => a.hasAlert);

  // SVG Ring calculation
  const ringRadius = 64;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const progressRatio = Math.min(1.15, Math.max(0, consumedCalories / Math.max(1, targetCalories)));
  const strokeDashoffset = ringCircumference - Math.min(1, progressRatio) * ringCircumference;

  const isDoubleImpactDay =
    Boolean(todayStrengthRoutine) && !currentInsanity.isRestDay && currentInsanity.durationMin >= 38;

  const notifySync = (msg: string) => {
    setSyncFeedback(msg);
    window.setTimeout(() => setSyncFeedback(null), 4000);
  };

  const handleWatchBluetooth = async () => {
    setBleLoading(true);
    try {
      const res = await connectWatchBluetoothBLE();
      updateWatchMetrics({
        avgHeartRate: res.avgHeartRate,
        maxHeartRate: res.maxHeartRate,
      });
      notifySync(`✓ Conectado a ${res.deviceName}: ${res.avgHeartRate} bpm en vivo.`);
    } catch (err) {
      notifySync(err instanceof Error ? err.message : 'No se detectó el sensor BLE.');
    } finally {
      setBleLoading(false);
    }
  };

  const handleParseHealthText = () => {
    if (!healthRawText.trim()) return;
    const parsed = parseSamsungHealthText(healthRawText, state.watchMetrics);
    updateWatchMetrics(parsed);
    setHealthRawText('');
    setShowHealthPaste(false);
    notifySync('✓ Datos extraídos de Samsung Health y sincronizados en Firebase.');
  };

  return (
    <div className="space-y-5 pb-8">
      {/* Weekday Detector & Simulator Bar */}
      <div className="bg-[#111827] border border-gray-800/90 rounded-2xl p-3.5 shadow-lg">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
              Detector de Día: <span className="text-white">{WEEKDAY_NAMES[activeWeekday]}</span>
            </span>
          </div>
          <span
            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
              isDoubleImpactDay
                ? 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30'
                : 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30'
            }`}
          >
            {isDoubleImpactDay ? '⚡ Día de Doble Impacto (High-Carb)' : '🛡️ Día de Recuperación / Control'}
          </span>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAY_SHORT.map((label, idx) => {
            const isSelected = idx === activeWeekday;
            const hasStrength = [1, 2, 4, 5].includes(idx);
            return (
              <button
                key={label}
                onClick={() => setSelectedWeekday(idx)}
                className={`py-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 transition border ${
                  isSelected
                    ? 'bg-[#3B82F6] text-white border-[#3B82F6] shadow-md shadow-[#3B82F6]/25'
                    : 'bg-[#090D16] text-gray-400 border-gray-800 hover:border-gray-700'
                }`}
              >
                <span>{label}</span>
                <div className="flex items-center gap-1">
                  {hasStrength && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected ? 'bg-white' : 'bg-[#3B82F6]'
                      }`}
                    />
                  )}
                  {idx !== 0 && (
                    <span
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

      {/* Dual Daily Assignment: Strength Block + Insanity HIIT Session */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Strength Card */}
        <div className="bg-[#111827] border border-[#3B82F6]/30 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-[#3B82F6]/10 blur-xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg bg-[#3B82F6]/15 text-[#3B82F6]">
                <Dumbbell className="w-3.5 h-3.5" />
                BLOQUE DE FUERZA ({WEEKDAY_NAMES[activeWeekday].toUpperCase()})
              </span>
              <span className="text-[11px] text-gray-400 font-medium">Esquema Torso/Pierna A/B</span>
            </div>

            {todayStrengthRoutine ? (
              <>
                <h3 className="text-base font-extrabold text-white mt-1">{todayStrengthRoutine.title}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{todayStrengthRoutine.focus}</p>
                <div className="mt-3 space-y-1.5">
                  {todayStrengthRoutine.exercises.slice(0, 3).map((ex) => {
                    const doneSets = ex.sets.filter((s) => s.completed).length;
                    return (
                      <div
                        key={ex.id}
                        className="flex items-center justify-between text-xs bg-[#090D16]/90 px-2.5 py-1.5 rounded-lg border border-gray-800/80"
                      >
                        <span className="text-gray-200 truncate pr-2">{ex.name}</span>
                        <span className="text-[11px] font-mono text-[#3B82F6] shrink-0">
                          {doneSets}/{ex.targetSets} series ({ex.restSeconds}s)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="py-4">
                <h3 className="text-base font-bold text-gray-200">Descanso de Pesas / Recuperación Muscular</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Hoy no hay sesión de hipertrofia con mancuernas ni Forza Gym. Enfoque en movilidad articular,
                  manguito rotador con mancuernas rojas ligeras o cardio Insanity.
                </p>
              </div>
            )}
          </div>

          <button
            onClick={() => onNavigate('strength')}
            className="mt-4 w-full py-2.5 px-3 rounded-xl bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-white font-bold text-xs flex items-center justify-center gap-2 transition"
          >
            <span>Abrir Tracker de Fuerza y Temporizador</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Insanity HIIT Card */}
        <div className="bg-[#111827] border border-[#F59E0B]/30 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-[#F59E0B]/10 blur-xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg bg-[#F59E0B]/15 text-[#F59E0B]">
                <Zap className="w-3.5 h-3.5" />
                INSANITY DÍA {currentInsanity.dayNumber} DE 63
              </span>
              <span className="text-[11px] text-gray-400 font-medium">
                Semana {currentInsanity.weekNumber} • {currentInsanity.monthPhase.split(' ')[0]}{' '}
                {currentInsanity.monthPhase.split(' ')[1]}
              </span>
            </div>

            <h3 className="text-base font-extrabold text-white mt-1">{currentInsanity.workoutTitle}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Duración oficial: <strong className="text-gray-200">{currentInsanity.durationMin} min</strong> •{' '}
              {currentInsanity.isMaxInterval
                ? 'Intervalos Máximos Anaeróbicos (Mes 2)'
                : currentInsanity.isRestDay
                ? 'Recuperación del Sistema Nervioso Central'
                : 'HIIT Pliométrico y Resistencia Cardiorrespiratoria'}
            </p>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="bg-[#090D16] border border-gray-800 rounded-xl p-2 text-center">
                <span className="text-[10px] text-gray-400 block">Estado</span>
                <span
                  className={`text-xs font-bold ${
                    currentInsanity.completed ? 'text-[#10B981]' : 'text-[#F59E0B]'
                  }`}
                >
                  {currentInsanity.completed ? 'Completado' : 'Pendiente'}
                </span>
              </div>
              <div className="bg-[#090D16] border border-gray-800 rounded-xl p-2 text-center">
                <span className="text-[10px] text-gray-400 block">Gasto Est.</span>
                <span className="text-xs font-bold text-white">
                  {currentInsanity.isRestDay ? '0' : Math.round(currentInsanity.durationMin * 11.5)} kcal
                </span>
              </div>
              <div className="bg-[#090D16] border border-gray-800 rounded-xl p-2 text-center">
                <span className="text-[10px] text-gray-400 block">Progreso 63D</span>
                <span className="text-xs font-bold text-[#10B981]">
                  {state.insanityCalendar.filter((d) => d.completed).length}/63 días
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => toggleInsanityDayCompleted(currentInsanity.dayNumber)}
              className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                currentInsanity.completed
                  ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40'
                  : 'bg-[#F59E0B] text-gray-950 hover:bg-[#F59E0B]/90'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{currentInsanity.completed ? 'Sesión Completada' : 'Marcar Insanity Hecho'}</span>
            </button>
            <button
              onClick={() => onNavigate('insanity')}
              className="py-2.5 px-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold text-xs flex items-center gap-1 transition"
            >
              <span>Matriz 9 Sem</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Recomposition Ring + Galaxy Watch 7 Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Anillo de Recomposición Dinámica */}
        <div className="lg:col-span-6 bg-[#111827] border border-gray-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-[#10B981]" />
                Anillo de Recomposición Dinámica
              </h3>
              <p className="text-xs text-gray-400">
                Fórmula en vivo: BMR (Camry 8E) + Kcal Activas (Watch 7) − 250 kcal
              </p>
            </div>
            <button
              onClick={() => onNavigate('nutrition')}
              className="text-xs font-bold text-[#10B981] hover:underline flex items-center gap-1"
            >
              <span>Nutrición</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-5 my-2">
            {/* Circular SVG Ring */}
            <div className="relative w-40 h-40 flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 150 150">
                <circle
                  cx="75"
                  cy="75"
                  r={ringRadius}
                  stroke="#1F2937"
                  strokeWidth="12"
                  fill="transparent"
                />
                <circle
                  cx="75"
                  cy="75"
                  r={ringRadius}
                  stroke={remainingCalories >= 0 ? '#10B981' : '#F59E0B'}
                  strokeWidth="12"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                  Meta Hoy
                </span>
                <span className="text-2xl font-extrabold text-white font-mono">{targetCalories}</span>
                <span className="text-[11px] text-[#10B981] font-semibold">kcal objetivo</span>
              </div>
            </div>

            {/* Formula Breakdown */}
            <div className="flex-1 w-full space-y-2">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#090D16] border border-gray-800/80 text-xs">
                <span className="text-gray-400 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-purple-400" />
                  Tasa Metabólica Basal (Camry)
                </span>
                <span className="font-mono font-bold text-white">{bmr} kcal</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#090D16] border border-gray-800/80 text-xs">
                <span className="text-gray-400 flex items-center gap-1.5">
                  <Watch className="w-3.5 h-3.5 text-[#F59E0B]" />+ Calorías Activas (Watch 7)
                </span>
                <span className="font-mono font-bold text-[#F59E0B]">+{activeCalories} kcal</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#090D16] border border-gray-800/80 text-xs">
                <span className="text-gray-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#10B981]" />− Déficit Recomposición
                </span>
                <span className="font-mono font-bold text-[#10B981]">−{deficit} kcal</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#10B981]/10 border border-[#10B981]/30 text-xs">
                <span className="text-gray-200 font-semibold">Consumido / Restante Hoy</span>
                <span className="font-mono font-extrabold text-[#10B981]">
                  {consumedCalories} / {remainingCalories >= 0 ? `${remainingCalories} disp.` : `${Math.abs(remainingCalories)} extra`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Widget Samsung Galaxy Watch 7 + S23 Ultra Smart Sync */}
        <div className="lg:col-span-6 bg-[#111827] border border-gray-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#10B981]/15 text-[#10B981]">
                <Watch className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>Samsung Galaxy Watch 7</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#3B82F6]/20 text-[#3B82F6] font-bold">
                    S23 Ultra Sync
                  </span>
                </h3>
                <p className="text-xs text-gray-400">
                  Presets de 1 toque, BLE directo o pegado inteligente de Samsung Health
                </p>
              </div>
            </div>
          </div>

          {syncFeedback && (
            <div className="p-2.5 rounded-xl bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] text-xs font-bold">
              {syncFeedback}
            </div>
          )}

          {/* 1-Tap S23 Ultra Quick-Sync Bar (Zero-typing presets + BLE + Samsung Health Paste) */}
          <div className="bg-[#090D16] border border-gray-800 rounded-xl p-2.5 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-gray-400 font-semibold">
              <span className="flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5 text-[#10B981]" />
                Atajos Rápidos S23 Ultra (1 Toque sin escribir):
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleWatchBluetooth}
                  disabled={bleLoading}
                  className="px-2 py-1 rounded-lg bg-[#3B82F6]/20 hover:bg-[#3B82F6]/30 text-[#3B82F6] font-bold flex items-center gap-1 transition"
                  title="Conectar Galaxy Watch 7 vía Web Bluetooth BLE en Chrome Android"
                >
                  <Bluetooth className="w-3 h-3" />
                  <span>{bleLoading ? 'Buscando...' : 'BLE Directo'}</span>
                </button>
                <button
                  onClick={() => setShowHealthPaste(!showHealthPaste)}
                  className="px-2 py-1 rounded-lg bg-[#10B981]/20 hover:bg-[#10B981]/30 text-[#10B981] font-bold flex items-center gap-1 transition"
                  title="Pegar texto extraído de captura de Samsung Health en tu S23 Ultra"
                >
                  <ClipboardPaste className="w-3 h-3" />
                  <span>Pegar S-Health</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => {
                  updateWatchMetrics({
                    avgHeartRate: 164,
                    maxHeartRate: 189,
                    activeCalories: 920,
                    steps: 12500,
                  });
                  notifySync('✓ Perfil "Doble Impacto (Pesas + Insanity)" aplicado (+920 kcal).');
                }}
                className="py-1.5 px-2 rounded-lg bg-[#F59E0B]/15 hover:bg-[#F59E0B]/25 border border-[#F59E0B]/30 text-[#F59E0B] text-[11px] font-bold transition truncate"
              >
                🔥 Pesas + Insanity
              </button>
              <button
                onClick={() => {
                  updateWatchMetrics({
                    avgHeartRate: 156,
                    maxHeartRate: 182,
                    activeCalories: 690,
                    steps: 10800,
                  });
                  notifySync('✓ Perfil "Sesión HIIT / Fuerza" aplicado (+690 kcal).');
                }}
                className="py-1.5 px-2 rounded-lg bg-[#3B82F6]/15 hover:bg-[#3B82F6]/25 border border-[#3B82F6]/30 text-[#3B82F6] text-[11px] font-bold transition truncate"
              >
                🏋️ Entreno Estándar
              </button>
              <button
                onClick={() => {
                  updateWatchMetrics({
                    avgHeartRate: 128,
                    maxHeartRate: 152,
                    activeCalories: 410,
                    steps: 8500,
                  });
                  notifySync('✓ Perfil "Cardio Recovery / Descanso" aplicado (+410 kcal).');
                }}
                className="py-1.5 px-2 rounded-lg bg-[#10B981]/15 hover:bg-[#10B981]/25 border border-[#10B981]/30 text-[#10B981] text-[11px] font-bold transition truncate"
              >
                🧘 Día Recovery
              </button>
            </div>

            {showHealthPaste && (
              <div className="pt-2 border-t border-gray-800 space-y-2">
                <p className="text-[11px] text-gray-300">
                  En tu <strong>S23 Ultra</strong>: toma captura a <em>Samsung Health</em>, toca el botón{' '}
                  <strong className="text-[#10B981]">&quot;T&quot; (Extraer texto)</strong> de One UI, cópialo y pégalo aquí:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={healthRawText}
                    onChange={(e) => setHealthRawText(e.target.value)}
                    placeholder="Ej: 161 bpm, 188 bpm máx, 845 kcal, 11800 pasos, sueño 87"
                    className="flex-1 bg-[#111827] border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                  <button
                    onClick={handleParseHealthText}
                    className="px-3 py-1.5 rounded-lg bg-[#10B981] text-gray-950 font-bold text-xs shrink-0"
                  >
                    Auto-Rellenar
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {/* FC Promedio */}
            <div className="bg-[#090D16] border border-gray-800 rounded-xl p-2.5">
              <label className="text-[11px] text-gray-400 flex items-center gap-1 mb-1">
                <HeartPulse className="w-3.5 h-3.5 text-rose-400" />
                FC Promedio (bpm)
              </label>
              <input
                type="number"
                value={state.watchMetrics.avgHeartRate}
                onChange={(e) => updateWatchMetrics({ avgHeartRate: Number(e.target.value) })}
                className="w-full bg-[#111827] border border-gray-800 rounded-lg px-2.5 py-1.5 text-sm font-mono font-bold text-white focus:border-[#3B82F6] focus:outline-none"
              />
            </div>

            {/* FC Máxima */}
            <div className="bg-[#090D16] border border-gray-800 rounded-xl p-2.5">
              <label className="text-[11px] text-gray-400 flex items-center gap-1 mb-1">
                <HeartPulse className="w-3.5 h-3.5 text-[#F59E0B]" />
                FC Máxima (bpm)
              </label>
              <input
                type="number"
                value={state.watchMetrics.maxHeartRate}
                onChange={(e) => updateWatchMetrics({ maxHeartRate: Number(e.target.value) })}
                className="w-full bg-[#111827] border border-gray-800 rounded-lg px-2.5 py-1.5 text-sm font-mono font-bold text-[#F59E0B] focus:border-[#F59E0B] focus:outline-none"
              />
            </div>

            {/* Calorías Activas with Thumb Steppers */}
            <div className="bg-[#090D16] border border-[#10B981]/40 rounded-xl p-2.5">
              <label className="text-[11px] text-[#10B981] font-semibold flex items-center justify-between mb-1">
                <span className="flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5" />
                  Kcal Activas
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      updateWatchMetrics({
                        activeCalories: Math.max(0, state.watchMetrics.activeCalories - 50),
                      })
                    }
                    className="p-0.5 rounded bg-gray-800 text-gray-300 hover:text-white"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateWatchMetrics({
                        activeCalories: state.watchMetrics.activeCalories + 50,
                      })
                    }
                    className="p-0.5 rounded bg-gray-800 text-gray-300 hover:text-white"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </label>
              <input
                type="number"
                value={state.watchMetrics.activeCalories}
                onChange={(e) => updateWatchMetrics({ activeCalories: Number(e.target.value) })}
                className="w-full bg-[#111827] border border-gray-800 rounded-lg px-2.5 py-1.5 text-sm font-mono font-bold text-[#10B981] focus:border-[#10B981] focus:outline-none"
              />
            </div>

            {/* Score de Sueño (0-100) */}
            <div className="bg-[#090D16] border border-gray-800 rounded-xl p-2.5">
              <label className="text-[11px] text-gray-400 flex items-center gap-1 mb-1">
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                Score Sueño (0-100)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={state.watchMetrics.sleepScore}
                onChange={(e) =>
                  updateWatchMetrics({
                    sleepScore: Math.min(100, Math.max(0, Number(e.target.value))),
                  })
                }
                className="w-full bg-[#111827] border border-gray-800 rounded-lg px-2.5 py-1.5 text-sm font-mono font-bold text-indigo-400 focus:border-indigo-400 focus:outline-none"
              />
            </div>

            {/* Horas de Sueño */}
            <div className="bg-[#090D16] border border-gray-800 rounded-xl p-2.5">
              <label className="text-[11px] text-gray-400 flex items-center gap-1 mb-1">
                <Moon className="w-3.5 h-3.5 text-sky-400" />
                Horas de Sueño
              </label>
              <input
                type="number"
                step="0.1"
                value={state.watchMetrics.sleepHours}
                onChange={(e) => updateWatchMetrics({ sleepHours: Number(e.target.value) })}
                className="w-full bg-[#111827] border border-gray-800 rounded-lg px-2.5 py-1.5 text-sm font-mono font-bold text-white focus:border-[#3B82F6] focus:outline-none"
              />
            </div>

            {/* Pasos Diarios */}
            <div className="bg-[#090D16] border border-gray-800 rounded-xl p-2.5">
              <label className="text-[11px] text-gray-400 flex items-center gap-1 mb-1">
                <Footprints className="w-3.5 h-3.5 text-emerald-400" />
                Pasos Hoy
              </label>
              <input
                type="number"
                step="100"
                value={state.watchMetrics.steps}
                onChange={(e) => updateWatchMetrics({ steps: Number(e.target.value) })}
                className="w-full bg-[#111827] border border-gray-800 rounded-lg px-2.5 py-1.5 text-sm font-mono font-bold text-white focus:border-[#3B82F6] focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between text-xs text-gray-400">
            <span>
              Estado SNC:{' '}
              <strong
                className={
                  state.watchMetrics.sleepScore >= 80
                    ? 'text-[#10B981]'
                    : state.watchMetrics.sleepScore >= 65
                    ? 'text-[#F59E0B]'
                    : 'text-red-400'
                }
              >
                {state.watchMetrics.sleepScore >= 80
                  ? 'Recuperación Óptima para Pesas + HIIT'
                  : state.watchMetrics.sleepScore >= 65
                  ? 'Recuperación Moderada'
                  : 'Fatiga Alta - Priorizar Descanso'}
              </strong>
            </span>
            <span className="font-mono text-[11px] text-gray-300">
              Zona HIIT: {Math.round((state.watchMetrics.avgHeartRate / 190) * 100)}% FCmáx
            </span>
          </div>
        </div>
      </div>

      {/* Asymmetry Banner & Quick Biometric Curve */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Curva de Recomposición Corporal */}
        <div className="lg:col-span-7 bg-[#111827] border border-gray-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-white">Curva de Recomposición Corporal (Camry 8E)</h3>
              <p className="text-xs text-gray-400">
                Evolución simultánea de Peso ({latestCamry.weightKg} kg) y % Grasa ({latestCamry.bodyFatPercent}%)
              </p>
            </div>
            <button
              onClick={() => onNavigate('camry')}
              className="text-xs font-bold text-[#3B82F6] hover:underline flex items-center gap-1"
            >
              <span>Ver 5 Zonas</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={state.camryHistory} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fatGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                <XAxis dataKey="date" stroke="#9CA3AF" fontSize={11} />
                <YAxis stroke="#9CA3AF" fontSize={11} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#090D16',
                    borderColor: '#374151',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="weightKg"
                  name="Peso (kg)"
                  stroke="#3B82F6"
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

        {/* Detector de Asimetrías & Arsenal Activo */}
        <div className="lg:col-span-5 bg-[#111827] border border-gray-800 rounded-2xl p-4 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#F59E0B]" />
                Diagnóstico Segmentario & Arsenal
              </h3>
              <span className="text-[11px] text-gray-400">MovingLife 8E</span>
            </div>

            {asymmetries.length > 0 ? (
              <div className="space-y-2">
                {asymmetries.map((alert) => (
                  <div
                    key={alert.limb}
                    className="p-3 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/40 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-bold text-[#F59E0B]">
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Asimetría Detectada en {alert.limb} ({alert.diffPercent}%)
                      </span>
                      <span>
                        {alert.leftKg}kg vs {alert.rightKg}kg
                      </span>
                    </div>
                    <p className="text-gray-300 text-[11px] leading-relaxed">{alert.prescription}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-[#10B981]/10 border border-[#10B981]/30 text-xs text-[#10B981]">
                Simetría muscular izquierda/derecha óptima (&lt;5% diferencia en extremidades).
              </div>
            )}
          </div>

          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">
              Hardware Preconfigurado Activo
            </span>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[11px] px-2.5 py-1 rounded-lg bg-[#090D16] border border-gray-800 text-gray-300">
                🏋️ Forza Gym (Placas)
              </span>
              <span className="text-[11px] px-2.5 py-1 rounded-lg bg-[#090D16] border border-gray-800 text-gray-300">
                🛋️ Gold&apos;s Gym XR 6.1
              </span>
              <span className="text-[11px] px-2.5 py-1 rounded-lg bg-[#090D16] border border-gray-800 text-gray-300">
                🔩 Hex 25kg + Ajustables + Rojas
              </span>
              <span className="text-[11px] px-2.5 py-1 rounded-lg bg-[#090D16] border border-gray-800 text-gray-300">
                ⚖️ Camry 8 Electrodos
              </span>
              <span className="text-[11px] px-2.5 py-1 rounded-lg bg-[#090D16] border border-gray-800 text-gray-300">
                ⌚ Galaxy Watch 7
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
