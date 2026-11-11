import React, { useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Flame,
  ShieldAlert,
  Sparkles,
  Utensils,
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { computeCoachIntelligence } from '../services/coachIntelligence';
import { ActiveTab } from '../types/fitness';

interface CoachBriefingCardProps {
  targetCalories: number;
  consumedCalories: number;
  targetProteinG: number;
  consumedProteinG: number;
  onNavigate: (tab: ActiveTab) => void;
  onOpenCoach?: () => void;
}

export const CoachBriefingCard: React.FC<CoachBriefingCardProps> = ({
  targetCalories,
  consumedCalories,
  targetProteinG,
  consumedProteinG,
  onNavigate,
  onOpenCoach,
}) => {
  const { state, setTrainingMode } = useApp();
  const [showDetails, setShowDetails] = useState(false);

  const snapshot = useMemo(
    () =>
      computeCoachIntelligence(
        state,
        targetCalories,
        consumedCalories,
        targetProteinG,
        consumedProteinG
      ),
    [state, targetCalories, consumedCalories, targetProteinG, consumedProteinG]
  );

  const { readiness, greetingTitle, trainingDirective, alternatingAdvice, trafficLight } =
    snapshot;

  const badgeColors =
    readiness.level === 'optimo'
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
      : readiness.level === 'moderado'
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
      : 'bg-rose-500/20 text-rose-300 border-rose-500/40';

  const scoreRingColor =
    readiness.level === 'optimo'
      ? 'text-emerald-400 border-emerald-500/50 bg-emerald-500/10'
      : readiness.level === 'moderado'
      ? 'text-amber-300 border-amber-500/50 bg-amber-500/10'
      : 'text-rose-400 border-rose-500/50 bg-rose-500/10';

  const trafficColors =
    trafficLight.status === 'en_zona'
      ? 'border-emerald-500/35 bg-emerald-500/10'
      : trafficLight.status === 'proteina_baja'
      ? 'border-amber-500/40 bg-amber-500/10'
      : trafficLight.status === 'bajo_calorias'
      ? 'border-cyan-500/40 bg-cyan-500/10'
      : 'border-rose-500/40 bg-rose-500/10';

  const todayDidStrength = Boolean(state.nutrition.completedStrengthRoutineId);
  const todayDidInsanity = Boolean(state.nutrition.completedInsanityDay);

  return (
    <div className="bg-gradient-to-br from-[#070B14] via-[#0B1122] to-[#070B14] border border-emerald-500/30 rounded-2xl p-4 sm:p-5 shadow-[0_0_25px_rgba(16,185,129,0.08)] space-y-3.5">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`w-12 h-12 rounded-2xl border flex flex-col items-center justify-center shrink-0 font-mono ${scoreRingColor}`}
          >
            <span className="text-base font-black leading-none">{readiness.score}</span>
            <span className="text-[8px] uppercase font-bold opacity-80">READY</span>
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-mono font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                {greetingTitle}
              </span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${badgeColors}`}>
                Estado: {readiness.label}
              </span>
            </div>
            <p className="text-xs sm:text-sm font-bold text-white leading-snug">
              {readiness.headline}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-center shrink-0">
          {onOpenCoach && (
            <button
              type="button"
              onClick={onOpenCoach}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#10B981] to-cyan-500 text-gray-950 font-extrabold text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Coach IA</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="px-2.5 py-1.5 rounded-xl bg-[#050811] hover:bg-gray-800 border border-gray-800 text-gray-300 text-xs font-mono font-bold flex items-center gap-1 transition"
          >
            <span>Diagnóstico</span>
            {showDetails ? (
              <ChevronUp className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
            )}
          </button>
        </div>
      </div>

      {/* LBM Drop Safety Alert if Triggered */}
      {readiness.lbmTrend.triggeredLbmDrop && (
        <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold block">{readiness.lbmTrend.message}</span>
            {state.trainingMode === 'insanity_only' && (
              <button
                type="button"
                onClick={() => setTrainingMode('hybrid')}
                className="text-[11px] font-extrabold text-amber-300 underline hover:text-amber-200"
              >
                Considerar reactivar 2 días de Fuerza Torso/Pierna →
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3 Action Cards: Training Directive | Yesterday vs Today | Evening Macro Guard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {/* Training Directive */}
        <div className="bg-[#050811]/90 border border-gray-800 rounded-xl p-3 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider">
            <span className="text-cyan-400 font-bold flex items-center gap-1">
              <Activity className="w-3 h-3" />
              Directiva de Hoy
            </span>
            <div className="flex items-center gap-1">
              {todayDidStrength && (
                <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                  ✓ Pesas
                </span>
              )}
              {todayDidInsanity && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                  ✓ HIIT
                </span>
              )}
            </div>
          </div>
          <p className="text-[11px] text-gray-300 leading-relaxed">{trainingDirective}</p>
        </div>

        {/* Yesterday vs Today Alternation */}
        <div className="bg-[#050811]/90 border border-gray-800 rounded-xl p-3 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider">
            <span className="text-amber-400 font-bold flex items-center gap-1">
              {state.trainingMode === 'insanity_only' ? (
                <Zap className="w-3 h-3" />
              ) : (
                <Dumbbell className="w-3 h-3" />
              )}
              Memoria Ayer → Hoy
            </span>
            {readiness.yesterdayKcalBurned > 0 && (
              <span className="text-amber-300 font-bold font-mono">
                Ayer: {readiness.yesterdayKcalBurned} kcal
              </span>
            )}
          </div>
          <p className="text-[11px] text-white font-semibold">{readiness.yesterdaySessionLabel}</p>
          <p className="text-[11px] text-gray-400 leading-relaxed">{alternatingAdvice}</p>
        </div>

        {/* Evening / Macro Traffic Light */}
        <div className={`border rounded-xl p-3 space-y-1.5 ${trafficColors}`}>
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider">
            <span className="font-black text-white">{trafficLight.badge}</span>
            <button
              type="button"
              onClick={() => onNavigate('nutrition')}
              className="text-emerald-300 hover:underline font-bold flex items-center gap-1"
            >
              <Utensils className="w-3 h-3" />
              <span>Ajustar</span>
            </button>
          </div>
          <p className="text-[11px] font-bold text-white">{trafficLight.title}</p>
          <p className="text-[11px] text-gray-300 leading-relaxed">{trafficLight.advice}</p>
        </div>
      </div>

      {/* Collapsible Telemetry Factors */}
      {showDetails && (
        <div className="bg-[#050811] border border-gray-800 rounded-xl p-3 space-y-1.5 text-xs">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-gray-400 font-bold">
            <Flame className="w-3.5 h-3.5 text-emerald-400" />
            Factores calculados en tiempo real
          </div>
          <ul className="space-y-1 text-[11px] text-gray-300">
            {readiness.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span>{r}</span>
              </li>
            ))}
            <li className="flex items-start gap-2">
              <span className="text-cyan-400 font-bold">•</span>
              <span>{readiness.lbmTrend.message}</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};
