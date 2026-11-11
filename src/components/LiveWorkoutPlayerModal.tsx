import React, { useEffect, useState } from 'react';
import {
  Award,
  BellRing,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  Dumbbell,
  Layers,
  Minus,
  Play,
  Plus,
  Save,
  Sparkles,
  Timer,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ExerciseMuscleDiagram } from './ExerciseMuscleDiagram';

interface LiveWorkoutPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  routineId: string;
}

export const LiveWorkoutPlayerModal: React.FC<LiveWorkoutPlayerModalProps> = ({
  isOpen,
  onClose,
  routineId,
}) => {
  const {
    state,
    restTimer,
    toggleExerciseSet,
    updateExerciseSetValues,
    startRestTimer,
    adjustRestTimer,
    stopRestTimer,
    evaluateDoubleProgression,
    saveWorkoutSessionVolume,
  } = useApp();

  const routine = state.routines.find((r) => r.id === routineId) || state.routines[0];
  const [exerciseIdx, setExerciseIdx] = useState(0);
  const [show3D, setShow3D] = useState(true);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (isOpen && routine) {
      const firstIncompleteIdx = routine.exercises.findIndex((ex) =>
        ex.sets.some((s) => !s.completed)
      );
      setExerciseIdx(firstIncompleteIdx >= 0 ? firstIncompleteIdx : 0);
    }
  }, [isOpen, routineId]);

  if (!isOpen || !routine) return null;

  const safeIdx = Math.min(Math.max(0, exerciseIdx), routine.exercises.length - 1);
  const exercise = routine.exercises[safeIdx];
  const prog = evaluateDoubleProgression(exercise);

  let totalSets = 0;
  let completedSets = 0;
  let sessionVolumeKg = 0;
  routine.exercises.forEach((ex) => {
    ex.sets.forEach((s) => {
      totalSets += 1;
      if (s.completed) {
        completedSets += 1;
        sessionVolumeKg += s.weightKg * s.reps;
      }
    });
  });

  const progressPct = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleFinishSession = () => {
    saveWorkoutSessionVolume(routine.id);
    setSavedNotice(true);
    window.setTimeout(() => {
      setSavedNotice(false);
    }, 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#050811] text-gray-100 flex flex-col overflow-hidden">
      {/* Top Workout Bar */}
      <header className="bg-[#090D16] border-b border-gray-800 px-3 sm:px-5 py-3 shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-cyan-500/20">
              <Dumbbell className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  MODO EN VIVO
                </span>
                <span className="text-xs font-mono text-[#10B981] font-bold">
                  {completedSets}/{totalSets} series • {Math.round(sessionVolumeKg)} kg
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-extrabold text-white truncate">
                {routine.dayName} — {routine.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFinishSession}
              className="px-3 py-2 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-gray-950 font-extrabold text-xs flex items-center gap-1.5 transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Guardar Sesión</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold text-xs flex items-center gap-1 transition"
            >
              <X className="w-4 h-4" />
              <span>Salir</span>
            </button>
          </div>
        </div>

        {/* Session Progress Bar */}
        <div className="max-w-4xl mx-auto mt-2.5">
          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-[#3B82F6] to-[#10B981] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </header>

      {/* Scrollable Gym Stage */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4">
        <div className="max-w-4xl mx-auto space-y-4 pb-10">
          {savedNotice && (
            <div className="p-3 rounded-xl bg-[#10B981]/20 border border-[#10B981]/40 text-[#10B981] text-xs font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span>¡Volumen de sesión registrado en tu curva histórica de Fuerza!</span>
            </div>
          )}

          {/* Embedded Giant Rest Timer Widget */}
          {(restTimer.isActive || restTimer.isFinishedAlert) && (
            <div
              className={`rounded-2xl p-4 border flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl ${
                restTimer.isFinishedAlert
                  ? 'bg-[#10B981]/15 border-[#10B981] timer-alert-glow'
                  : 'bg-[#090D16] border-cyan-500/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    restTimer.isFinishedAlert
                      ? 'bg-[#10B981] text-gray-950 animate-bounce'
                      : 'bg-cyan-500/20 text-cyan-400'
                  }`}
                >
                  {restTimer.isFinishedAlert ? (
                    <BellRing className="w-6 h-6" />
                  ) : (
                    <Timer className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase font-black tracking-wider text-cyan-300 block">
                    {restTimer.isFinishedAlert
                      ? '¡DESCANSO TERMINADO! ATACA LA SIGUIENTE SERIE'
                      : restTimer.categoryLabel}
                  </span>
                  <span className="text-3xl font-black font-mono text-white">
                    {formatTimer(restTimer.remainingSeconds)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {restTimer.isFinishedAlert ? (
                  <button
                    type="button"
                    onClick={() =>
                      startRestTimer(
                        restTimer.totalSeconds,
                        restTimer.exerciseName,
                        restTimer.categoryLabel
                      )
                    }
                    className="px-3.5 py-2 rounded-xl bg-[#10B981] text-gray-950 font-extrabold text-xs flex items-center gap-1.5"
                  >
                    <Play className="w-4 h-4" />
                    <span>Repetir</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => adjustRestTimer(-15)}
                      className="px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-mono font-bold text-xs"
                    >
                      -15s
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustRestTimer(15)}
                      className="px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-mono font-bold text-xs"
                    >
                      +15s
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={stopRestTimer}
                  className="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}

          {/* Exercise Switcher Strip */}
          <div className="flex items-center justify-between gap-2 bg-[#090D16] border border-gray-800 rounded-2xl p-2">
            <button
              type="button"
              disabled={safeIdx === 0}
              onClick={() => setExerciseIdx((i) => Math.max(0, i - 1))}
              className="px-3 py-2 rounded-xl bg-[#111827] hover:bg-gray-800 disabled:opacity-35 text-xs font-bold flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Anterior</span>
            </button>

            <div className="flex items-center gap-1.5 overflow-x-auto px-1">
              {routine.exercises.map((ex, idx) => {
                const allDone = ex.sets.every((s) => s.completed);
                const active = idx === safeIdx;
                return (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => setExerciseIdx(idx)}
                    className={`w-8 h-8 rounded-xl font-mono text-xs font-black flex items-center justify-center border transition shrink-0 ${
                      active
                        ? 'bg-cyan-500 text-gray-950 border-cyan-300 shadow-lg shadow-cyan-500/30'
                        : allDone
                        ? 'bg-[#10B981]/20 text-[#10B981] border-[#10B981]/40'
                        : 'bg-[#111827] text-gray-400 border-gray-800 hover:text-white'
                    }`}
                    title={ex.name}
                  >
                    {allDone && !active ? <CircleCheck className="w-4 h-4" /> : idx + 1}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={safeIdx === routine.exercises.length - 1}
              onClick={() =>
                setExerciseIdx((i) => Math.min(routine.exercises.length - 1, i + 1))
              }
              className="px-3 py-2 rounded-xl bg-[#111827] hover:bg-gray-800 disabled:opacity-35 text-xs font-bold flex items-center gap-1"
            >
              <span className="hidden sm:inline">Siguiente</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Current Exercise Focus Card */}
          <div className="bg-[#0B1120] border border-cyan-500/30 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
              <div>
                <span className="text-[11px] font-mono text-cyan-400 font-bold uppercase tracking-wider">
                  Ejercicio {safeIdx + 1} de {routine.exercises.length}
                </span>
                <h3 className="text-lg sm:text-xl font-black text-white mt-0.5">
                  {exercise.name}
                </h3>
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5 flex-wrap">
                  <Layers className="w-3.5 h-3.5 text-[#3B82F6]" />
                  <span>{exercise.equipmentName}</span>
                  <span>•</span>
                  <strong className="text-white">
                    Meta: {exercise.targetSets} × {exercise.minReps}-{exercise.maxReps} reps
                  </strong>
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShow3D((v) => !v)}
                  className="px-3 py-2 rounded-xl bg-purple-500/15 border border-purple-500/40 text-purple-300 text-xs font-bold flex items-center gap-1.5"
                >
                  <span>Mapa 3D</span>
                  {show3D ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    startRestTimer(exercise.restSeconds, exercise.name, exercise.restCategoryLabel)
                  }
                  className="px-3 py-2 rounded-xl bg-[#3B82F6]/20 border border-[#3B82F6]/40 text-[#3B82F6] text-xs font-bold flex items-center gap-1"
                >
                  <Timer className="w-3.5 h-3.5" />
                  <span>{exercise.restSeconds}s</span>
                </button>
              </div>
            </div>

            {show3D && (
              <ExerciseMuscleDiagram exerciseId={exercise.id} exerciseName={exercise.name} />
            )}

            <div
              className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                prog.achieved
                  ? 'bg-[#10B981]/10 border-[#10B981]/40 text-[#10B981]'
                  : 'bg-[#070B14] border-gray-800 text-gray-300'
              }`}
            >
              <Award className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <div className="font-bold">{prog.badgeText}</div>
                <p className="text-[11px] text-gray-400 mt-0.5">{prog.subText}</p>
              </div>
            </div>

            {/* Large Tactile Set Cards */}
            <div className="space-y-3">
              {exercise.sets.map((s) => {
                const hitMax = s.reps >= exercise.maxReps;
                return (
                  <div
                    key={s.setNumber}
                    className={`rounded-2xl p-3.5 border transition ${
                      s.completed
                        ? 'bg-[#10B981]/10 border-[#10B981]/50'
                        : 'bg-[#070B14] border-gray-800'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="w-9 h-9 rounded-xl bg-gray-800 text-white font-mono font-black text-sm flex items-center justify-center">
                          S{s.setNumber}
                        </span>

                        {exercise.loadType === 'forza_plates' && (
                          <div className="flex items-center gap-1.5 bg-[#0B1120] border border-gray-800 rounded-xl px-2 py-1">
                            <span className="text-[10px] text-gray-400 font-bold uppercase mr-1">
                              Placas
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateExerciseSetValues(
                                  routine.id,
                                  exercise.id,
                                  s.setNumber,
                                  'platesCount',
                                  Math.max(1, (s.platesCount ?? Math.round(s.weightKg / 4.5)) - 1)
                                )
                              }
                              className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-white flex items-center justify-center"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-8 text-center font-mono font-black text-sm text-[#3B82F6]">
                              {s.platesCount ?? Math.round(s.weightKg / 4.5)}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateExerciseSetValues(
                                  routine.id,
                                  exercise.id,
                                  s.setNumber,
                                  'platesCount',
                                  Math.min(25, (s.platesCount ?? Math.round(s.weightKg / 4.5)) + 1)
                                )
                              }
                              className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-white flex items-center justify-center"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 bg-[#0B1120] border border-gray-800 rounded-xl px-2 py-1">
                          <span className="text-[10px] text-gray-400 font-bold uppercase mr-1">
                            kg
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateExerciseSetValues(
                                routine.id,
                                exercise.id,
                                s.setNumber,
                                'weightKg',
                                Math.max(0, s.weightKg - 1)
                              )
                            }
                            className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-white flex items-center justify-center"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-12 text-center font-mono font-black text-sm text-white">
                            {s.weightKg}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateExerciseSetValues(
                                routine.id,
                                exercise.id,
                                s.setNumber,
                                'weightKg',
                                s.weightKg + 1
                              )
                            }
                            className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-white flex items-center justify-center"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5 bg-[#0B1120] border border-gray-800 rounded-xl px-2 py-1">
                          <span className="text-[10px] text-gray-400 font-bold uppercase mr-1">
                            Reps
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateExerciseSetValues(
                                routine.id,
                                exercise.id,
                                s.setNumber,
                                'reps',
                                Math.max(1, s.reps - 1)
                              )
                            }
                            className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-white flex items-center justify-center"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span
                            className={`w-9 text-center font-mono font-black text-sm ${
                              hitMax ? 'text-[#10B981]' : 'text-white'
                            }`}
                          >
                            {s.reps}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateExerciseSetValues(
                                routine.id,
                                exercise.id,
                                s.setNumber,
                                'reps',
                                Math.min(50, s.reps + 1)
                              )
                            }
                            className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-white flex items-center justify-center"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleExerciseSet(routine.id, exercise.id, s.setNumber)}
                        className={`py-3 px-4 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition active:scale-95 ${
                          s.completed
                            ? 'bg-[#10B981] text-gray-950 shadow-lg shadow-[#10B981]/25'
                            : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                        }`}
                      >
                        <Check className="w-4 h-4" />
                        <span>
                          {s.completed
                            ? 'Serie Completada ✓'
                            : `Completar & Descanso (${exercise.restSeconds}s)`}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
