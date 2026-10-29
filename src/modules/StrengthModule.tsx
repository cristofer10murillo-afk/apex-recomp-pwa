import React, { useState } from 'react';
import {
  Dumbbell,
  Timer,
  Check,
  TrendingUp,
  Award,
  Layers,
  Save,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { RoutineDayKey } from '../types/fitness';

export const StrengthModule: React.FC = () => {
  const {
    state,
    toggleExerciseSet,
    updateExerciseSetValues,
    startRestTimer,
    evaluateDoubleProgression,
    saveWorkoutSessionVolume,
  } = useApp();

  // Default to the routine matching selectedWeekdayIndex, or Lunes Torso A
  const initialRoutine =
    state.routines.find((r) => r.weekdayIndex === state.selectedWeekdayIndex)?.id ||
    'lunes_torso_a';

  const [activeRoutineId, setActiveRoutineId] = useState<RoutineDayKey>(initialRoutine);
  const [savedBanner, setSavedBanner] = useState(false);

  const currentRoutine =
    state.routines.find((r) => r.id === activeRoutineId) || state.routines[0];

  // Calculate live session metrics
  let sessionVolumeKg = 0;
  let completedSetsCount = 0;
  let totalSetsCount = 0;

  currentRoutine.exercises.forEach((ex) => {
    ex.sets.forEach((s) => {
      totalSetsCount += 1;
      if (s.completed) {
        completedSetsCount += 1;
        sessionVolumeKg += s.weightKg * s.reps;
      }
    });
  });

  const handleSaveSession = () => {
    saveWorkoutSessionVolume(activeRoutineId);
    setSavedBanner(true);
    window.setTimeout(() => setSavedBanner(false), 3000);
  };

  return (
    <div className="space-y-5 pb-8">
      {/* Routine Day Selector (4 Days A/B) */}
      <div className="bg-[#111827] border border-gray-800 rounded-2xl p-3.5">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-[#3B82F6]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-300">
              Esquema Torso / Pierna 4 Días (A/B)
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => startRestTimer(120, 'Compuesto Pesado Manual', 'Compuesto Pesado (120s)')}
              className="px-2 py-1 rounded-lg bg-[#3B82F6]/15 hover:bg-[#3B82F6]/25 text-[#3B82F6] text-[11px] font-bold flex items-center gap-1 transition"
            >
              <Timer className="w-3 h-3" />
              120s
            </button>
            <button
              onClick={() => startRestTimer(90, 'Multiarticular Manual', 'Multiarticular Intermedio (90s)')}
              className="px-2 py-1 rounded-lg bg-[#3B82F6]/15 hover:bg-[#3B82F6]/25 text-[#3B82F6] text-[11px] font-bold flex items-center gap-1 transition"
            >
              <Timer className="w-3 h-3" />
              90s
            </button>
            <button
              onClick={() => startRestTimer(60, 'Aislamiento Manual', 'Aislamiento / Metabólico (60s)')}
              className="px-2 py-1 rounded-lg bg-[#3B82F6]/15 hover:bg-[#3B82F6]/25 text-[#3B82F6] text-[11px] font-bold flex items-center gap-1 transition"
            >
              <Timer className="w-3 h-3" />
              60s
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {state.routines.map((routine) => {
            const isSelected = routine.id === activeRoutineId;
            return (
              <button
                key={routine.id}
                onClick={() => setActiveRoutineId(routine.id)}
                className={`p-3 rounded-xl text-left transition border ${
                  isSelected
                    ? 'bg-[#3B82F6] text-white border-[#3B82F6] shadow-lg shadow-[#3B82F6]/25'
                    : 'bg-[#090D16] text-gray-300 border-gray-800 hover:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider opacity-90">
                    {routine.dayName}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-gray-800 text-gray-400'
                    }`}
                  >
                    {routine.exercises.length} ejerc.
                  </span>
                </div>
                <p className="text-xs font-bold mt-1 truncate">{routine.title.split('(')[0]}</p>
                <p
                  className={`text-[10px] truncate ${
                    isSelected ? 'text-blue-100' : 'text-gray-400'
                  }`}
                >
                  {routine.title.includes('(') ? `(${routine.title.split('(')[1]}` : routine.focus}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Routine Summary Header */}
      <div className="bg-[#111827] border border-[#3B82F6]/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-[#3B82F6]/20 text-[#3B82F6]">
              {currentRoutine.dayName}
            </span>
            <h3 className="text-base font-extrabold text-white">{currentRoutine.title}</h3>
          </div>
          <p className="text-xs text-gray-400 mt-1">{currentRoutine.focus}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-[#090D16] border border-gray-800 px-3 py-2 rounded-xl text-right">
            <span className="text-[10px] text-gray-400 block">Series / Volumen Activo</span>
            <span className="text-xs font-mono font-bold text-[#10B981]">
              {completedSetsCount}/{totalSetsCount} series • {Math.round(sessionVolumeKg)} kg
            </span>
          </div>

          <button
            onClick={handleSaveSession}
            className="px-3.5 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-gray-950 font-bold text-xs flex items-center gap-1.5 transition shrink-0"
          >
            <Save className="w-4 h-4" />
            <span>Registrar Sesión</span>
          </button>
        </div>
      </div>

      {savedBanner && (
        <div className="p-3 rounded-xl bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] text-xs font-bold flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <span>¡Volumen de sesión guardado en la curva histórica de Fuerza!</span>
        </div>
      )}

      {/* Exercises List with Automatic Timer & Double Progression */}
      <div className="space-y-4">
        {currentRoutine.exercises.map((exercise, exIndex) => {
          const prog = evaluateDoubleProgression(exercise);

          return (
            <div
              key={exercise.id}
              className="bg-[#111827] border border-gray-800 rounded-2xl p-4 space-y-3.5 transition hover:border-gray-700"
            >
              {/* Exercise Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-6 h-6 rounded-lg bg-[#3B82F6]/20 text-[#3B82F6] font-mono text-xs font-bold flex items-center justify-center">
                      {exIndex + 1}
                    </span>
                    <h4 className="text-sm sm:text-base font-bold text-white">{exercise.name}</h4>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#3B82F6]" />
                    <span>{exercise.equipmentName}</span>
                    <span className="text-gray-600">•</span>
                    <span className="text-gray-300 font-semibold">
                      Meta: {exercise.targetSets} × {exercise.minReps}-{exercise.maxReps} reps
                    </span>
                  </p>
                </div>

                {/* Rest Timer Trigger Badge */}
                <button
                  onClick={() =>
                    startRestTimer(exercise.restSeconds, exercise.name, exercise.restCategoryLabel)
                  }
                  className="self-start inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#090D16] border border-[#3B82F6]/40 text-[#3B82F6] hover:bg-[#3B82F6]/15 text-xs font-bold transition shrink-0"
                >
                  <Timer className="w-3.5 h-3.5" />
                  <span>{exercise.restCategoryLabel}</span>
                </button>
              </div>

              {/* Double Progression Algorithm Banner */}
              <div
                className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                  prog.achieved
                    ? 'bg-[#10B981]/10 border-[#10B981]/40 text-[#10B981]'
                    : 'bg-[#090D16] border-gray-800/90 text-gray-300'
                }`}
              >
                <Award
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    prog.achieved ? 'text-[#10B981]' : 'text-[#3B82F6]'
                  }`}
                />
                <div className="text-xs">
                  <div className="font-bold">{prog.badgeText}</div>
                  <p className="text-[11px] text-gray-400 mt-0.5">{prog.subText}</p>
                </div>
              </div>

              {/* Sets Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-800 text-[11px] text-gray-400 uppercase">
                      <th className="py-2 px-2">Serie</th>
                      {exercise.loadType === 'forza_plates' && (
                        <th className="py-2 px-2">Placas Forza</th>
                      )}
                      <th className="py-2 px-2">
                        {exercise.loadType === 'fixed_25kg'
                          ? 'Carga Hex Fija (kg)'
                          : exercise.loadType === 'forza_plates'
                          ? 'Peso Equiv. (kg)'
                          : 'Peso Mancuerna (kg)'}
                      </th>
                      <th className="py-2 px-2">
                        Reps ({exercise.minReps}-{exercise.maxReps})
                      </th>
                      <th className="py-2 px-2 text-right">Completar (+Timer {exercise.restSeconds}s)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60 text-xs">
                    {exercise.sets.map((setItem) => {
                      const hitTopRange = setItem.reps >= exercise.maxReps;
                      return (
                        <tr
                          key={setItem.setNumber}
                          className={`transition ${
                            setItem.completed ? 'bg-[#10B981]/5' : 'hover:bg-gray-800/30'
                          }`}
                        >
                          <td className="py-2.5 px-2 font-mono font-bold text-gray-300">
                            #{setItem.setNumber}
                          </td>

                          {exercise.loadType === 'forza_plates' && (
                            <td className="py-2.5 px-2">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={1}
                                  max={25}
                                  value={setItem.platesCount ?? Math.round(setItem.weightKg / 4.5)}
                                  onChange={(e) =>
                                    updateExerciseSetValues(
                                      currentRoutine.id,
                                      exercise.id,
                                      setItem.setNumber,
                                      'platesCount',
                                      Number(e.target.value)
                                    )
                                  }
                                  className="w-16 bg-[#090D16] border border-gray-700 rounded-lg px-2 py-1 font-mono font-bold text-[#3B82F6] focus:border-[#3B82F6] focus:outline-none"
                                />
                                <span className="text-[11px] text-gray-400">placas</span>
                              </div>
                            </td>
                          )}

                          <td className="py-2.5 px-2">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="0.5"
                                value={setItem.weightKg}
                                onChange={(e) =>
                                  updateExerciseSetValues(
                                    currentRoutine.id,
                                    exercise.id,
                                    setItem.setNumber,
                                    'weightKg',
                                    Number(e.target.value)
                                  )
                                }
                                className="w-20 bg-[#090D16] border border-gray-700 rounded-lg px-2 py-1 font-mono font-bold text-white focus:border-[#3B82F6] focus:outline-none"
                              />
                              <span className="text-[11px] text-gray-400">kg</span>
                            </div>
                          </td>

                          <td className="py-2.5 px-2">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={1}
                                max={50}
                                value={setItem.reps}
                                onChange={(e) =>
                                  updateExerciseSetValues(
                                    currentRoutine.id,
                                    exercise.id,
                                    setItem.setNumber,
                                    'reps',
                                    Number(e.target.value)
                                  )
                                }
                                className={`w-16 bg-[#090D16] border rounded-lg px-2 py-1 font-mono font-bold focus:outline-none ${
                                  hitTopRange
                                    ? 'border-[#10B981]/60 text-[#10B981]'
                                    : 'border-gray-700 text-white'
                                }`}
                              />
                              {hitTopRange && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#10B981]/15 text-[#10B981]">
                                  Tope
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-2.5 px-2 text-right">
                            <button
                              onClick={() =>
                                toggleExerciseSet(currentRoutine.id, exercise.id, setItem.setNumber)
                              }
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition ${
                                setItem.completed
                                  ? 'bg-[#10B981] text-gray-950 shadow-md shadow-[#10B981]/20'
                                  : 'bg-[#090D16] border border-gray-700 text-gray-300 hover:border-[#3B82F6]'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{setItem.completed ? 'Completada' : 'Marcar Serie'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Technical note */}
              <div className="flex items-center gap-1.5 text-[11px] text-gray-400 pt-1">
                <Info className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                <span>{exercise.notes}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Volume Progression Chart (Recharts) */}
      <div className="bg-[#111827] border border-gray-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#3B82F6]" />
              Evolución de Volumen de Carga Total (kg levantados por sesión)
            </h3>
            <p className="text-xs text-gray-400">
              Sobrecarga progresiva acumulada en Torso A/B y Pierna A/B
            </p>
          </div>
        </div>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={state.strengthVolumeHistory}
              margin={{ top: 10, right: 12, left: -10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
              <XAxis dataKey="date" stroke="#9CA3AF" fontSize={11} />
              <YAxis stroke="#9CA3AF" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#090D16',
                  borderColor: '#374151',
                  borderRadius: '12px',
                  fontSize: '12px',
                }}
              />
              <Bar
                dataKey="totalVolumeKg"
                name="Volumen Total (kg)"
                fill="#3B82F6"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
