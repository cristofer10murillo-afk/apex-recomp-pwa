import React from 'react';
import { Timer, Plus, Minus, X, BellRing, Play } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const RestTimerBanner: React.FC = () => {
  const { restTimer, adjustRestTimer, stopRestTimer, startRestTimer } = useApp();

  if (!restTimer.isActive && !restTimer.isFinishedAlert) {
    return null;
  }

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPct =
    restTimer.totalSeconds > 0
      ? Math.max(0, Math.min(100, ((restTimer.totalSeconds - restTimer.remainingSeconds) / restTimer.totalSeconds) * 100))
      : 100;

  return (
    <div className="fixed top-14 left-0 right-0 z-40 px-3 sm:px-6 pointer-events-none">
      <div
        className={`max-w-xl mx-auto pointer-events-auto rounded-2xl border backdrop-blur-xl transition-all duration-300 overflow-hidden shadow-2xl ${
          restTimer.isFinishedAlert
            ? 'bg-[#111827]/95 border-[#10B981] timer-alert-glow'
            : 'bg-[#111827]/95 border-[#3B82F6]/60'
        }`}
      >
        {/* Progress bar */}
        <div className="w-full h-1.5 bg-gray-800">
          <div
            className={`h-full transition-all duration-500 ${
              restTimer.isFinishedAlert ? 'bg-[#10B981]' : 'bg-gradient-to-r from-[#3B82F6] to-[#10B981]'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="p-3 sm:p-3.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                restTimer.isFinishedAlert
                  ? 'bg-[#10B981]/20 text-[#10B981] animate-bounce'
                  : 'bg-[#3B82F6]/20 text-[#3B82F6]'
              }`}
            >
              {restTimer.isFinishedAlert ? <BellRing className="w-5 h-5" /> : <Timer className="w-5 h-5" />}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    restTimer.isFinishedAlert
                      ? 'bg-[#10B981]/20 text-[#10B981]'
                      : 'bg-[#3B82F6]/20 text-[#3B82F6]'
                  }`}
                >
                  {restTimer.isFinishedAlert ? '¡Descanso Completado! Ataca la Serie' : restTimer.categoryLabel}
                </span>
              </div>
              <p className="text-xs text-gray-300 truncate mt-0.5 font-medium">
                {restTimer.exerciseName || 'Temporizador de Descanso'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`font-mono text-xl sm:text-2xl font-extrabold px-2 ${
                restTimer.isFinishedAlert ? 'text-[#10B981]' : 'text-white'
              }`}
            >
              {formatTime(restTimer.remainingSeconds)}
            </span>

            {!restTimer.isFinishedAlert ? (
              <>
                <button
                  onClick={() => adjustRestTimer(-15)}
                  className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold flex items-center"
                  title="Restar 15s"
                >
                  <Minus className="w-3.5 h-3.5" />
                  <span>15s</span>
                </button>
                <button
                  onClick={() => adjustRestTimer(15)}
                  className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold flex items-center"
                  title="Sumar 15s"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>15s</span>
                </button>
              </>
            ) : (
              <button
                onClick={() =>
                  startRestTimer(restTimer.totalSeconds, restTimer.exerciseName, restTimer.categoryLabel)
                }
                className="px-2.5 py-1.5 rounded-lg bg-[#10B981] text-gray-950 font-bold text-xs flex items-center gap-1"
              >
                <Play className="w-3.5 h-3.5" />
                Repetir
              </button>
            )}

            <button
              onClick={stopRestTimer}
              className="p-1.5 rounded-lg bg-gray-800/90 hover:bg-red-500/20 hover:text-red-400 text-gray-400 transition"
              title="Cerrar temporizador"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
