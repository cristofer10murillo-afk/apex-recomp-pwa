import React, { useState } from 'react';
import {
  Zap,
  Calendar,
  Trophy,
  CheckCircle2,
  Flame,
  TrendingUp,
  Target,
  Clock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { FIT_TEST_EXERCISES_META } from '../data/seedData';

export const InsanityModule: React.FC = () => {
  const {
    state,
    toggleInsanityDayCompleted,
    setCurrentInsanityDay,
    updateFitTestResult,
  } = useApp();

  const [subView, setSubView] = useState<'calendar' | 'fittest'>('calendar');
  const [selectedTestTab, setSelectedTestTab] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [phaseFilter, setPhaseFilter] = useState<'all' | 'm1' | 'w5' | 'm2'>('all');

  const completedDaysCount = state.insanityCalendar.filter((d) => d.completed).length;
  const completionPct = Math.round((completedDaysCount / 63) * 100);

  // Group 63 days by Week (1 to 9)
  const weeks = Array.from({ length: 9 }, (_, i) => {
    const weekNum = i + 1;
    return {
      weekNumber: weekNum,
      phase:
        weekNum <= 4
          ? 'Mes 1 (Semanas 1-4: Base HIIT)'
          : weekNum === 5
          ? 'Semana 5 (Recovery Week: Core Cardio & Balance)'
          : 'Mes 2 (Semanas 6-9: Max Interval)',
      days: state.insanityCalendar.filter((d) => d.weekNumber === weekNum),
    };
  }).filter((w) => {
    if (phaseFilter === 'm1') return w.weekNumber <= 4;
    if (phaseFilter === 'w5') return w.weekNumber === 5;
    if (phaseFilter === 'm2') return w.weekNumber >= 6;
    return true;
  });

  // Fit Test comparison data for Recharts
  const test1 = state.fitTests.find((t) => t.testNumber === 1)!;
  const activeTestRecord =
    state.fitTests.find((t) => t.testNumber === selectedTestTab) || test1;

  const chartData = FIT_TEST_EXERCISES_META.map((meta) => {
    const shortName = meta.label.replace(/^\d+\.\s*/, '').split('(')[0].trim();
    const row: Record<string, string | number> = {
      name: shortName,
    };
    state.fitTests.forEach((t) => {
      row[`Test ${t.testNumber}`] = t.results[meta.key];
    });
    return row;
  });

  // Total reps across all 8 exercises for Test 1 vs Active Test
  const totalRepsTest1 = Object.values(test1.results).reduce((a, b) => a + b, 0);
  const totalRepsActive = Object.values(activeTestRecord.results).reduce((a, b) => a + b, 0);
  const overallImprovementPct =
    totalRepsTest1 > 0
      ? Math.round(((totalRepsActive - totalRepsTest1) / totalRepsTest1) * 1000) / 10
      : 0;

  return (
    <div className="space-y-5 pb-8">
      {/* Top Progress Header & Mode Switch */}
      <div className="bg-[#111827] border border-[#F59E0B]/30 rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[#F59E0B]/20 text-[#F59E0B]">
                <Zap className="w-4 h-4" />
              </span>
              <h2 className="text-base font-extrabold text-white">
                INSANITY 63 DÍAS &amp; FIT TEST TRACKER
              </h2>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Progreso global: <strong className="text-[#10B981]">{completedDaysCount}/63 días ({completionPct}%)</strong> • Día Activo en Dashboard: <strong className="text-[#F59E0B]">Día {state.currentInsanityDay}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2 bg-[#090D16] p-1 rounded-xl border border-gray-800 self-start">
            <button
              onClick={() => setSubView('calendar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                subView === 'calendar'
                  ? 'bg-[#F59E0B] text-gray-950'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Matriz 9 Semanas (63D)
            </button>
            <button
              onClick={() => setSubView('fittest')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                subView === 'fittest'
                  ? 'bg-[#F59E0B] text-gray-950'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              Comparador Fit Test (1-5)
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-[#090D16] rounded-full overflow-hidden mt-3 border border-gray-800">
          <div
            className="h-full bg-gradient-to-r from-[#F59E0B] to-[#10B981] transition-all duration-500"
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>

      {subView === 'calendar' ? (
        <div className="space-y-4">
          {/* Phase Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: 'Todas las 9 Semanas (63 Días)' },
              { id: 'm1', label: 'Mes 1 (Semanas 1-4)' },
              { id: 'w5', label: 'Semana 5 (Core Cardio & Balance)' },
              { id: 'm2', label: 'Mes 2 (Semanas 6-9 Max Interval)' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setPhaseFilter(tab.id as 'all' | 'm1' | 'w5' | 'm2')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                  phaseFilter === tab.id
                    ? 'bg-[#F59E0B]/20 border-[#F59E0B] text-[#F59E0B]'
                    : 'bg-[#111827] border-gray-800 text-gray-400 hover:text-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 9 Weeks Interactive Matrix */}
          <div className="space-y-4">
            {weeks.map((week) => (
              <div
                key={week.weekNumber}
                className="bg-[#111827] border border-gray-800 rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between border-b border-gray-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-[#F59E0B]/20 text-[#F59E0B] font-mono text-xs font-extrabold">
                      SEMANA {week.weekNumber}
                    </span>
                    <span className="text-xs font-bold text-gray-300">{week.phase}</span>
                  </div>
                  <span className="text-xs font-mono text-[#10B981]">
                    {week.days.filter((d) => d.completed).length}/7 completados
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
                  {week.days.map((day) => {
                    const isCurrentActive = day.dayNumber === state.currentInsanityDay;
                    return (
                      <div
                        key={day.dayNumber}
                        className={`p-3 rounded-xl border flex flex-col justify-between transition ${
                          day.completed
                            ? 'bg-[#10B981]/10 border-[#10B981]/40'
                            : isCurrentActive
                            ? 'bg-[#F59E0B]/15 border-[#F59E0B]'
                            : day.isRestDay
                            ? 'bg-[#090D16]/60 border-gray-800/70'
                            : 'bg-[#090D16] border-gray-800 hover:border-gray-700'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 text-[11px]">
                            <span className="font-mono font-bold text-gray-400">
                              D{day.dayNumber} • {day.weekdayLabel}
                            </span>
                            {day.isFitTest && (
                              <span className="px-1.5 py-0.5 rounded bg-[#3B82F6]/20 text-[#3B82F6] font-bold text-[10px]">
                                FIT TEST
                              </span>
                            )}
                            {day.isMaxInterval && !day.isFitTest && (
                              <span className="px-1.5 py-0.5 rounded bg-[#F59E0B]/20 text-[#F59E0B] font-bold text-[10px]">
                                MAX
                              </span>
                            )}
                          </div>

                          <p className="text-xs font-bold text-white mt-1.5 leading-snug">
                            {day.workoutTitle}
                          </p>

                          <div className="flex items-center gap-2 mt-1.5 text-[11px] text-gray-400">
                            <span className="flex items-center gap-0.5">
                              <Clock className="w-3 h-3" />
                              {day.durationMin}m
                            </span>
                            {!day.isRestDay && (
                              <span className="flex items-center gap-0.5 text-[#F59E0B]">
                                <Flame className="w-3 h-3" />
                                {Math.round(day.durationMin * 11.5)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 pt-2 border-t border-gray-800/80 flex items-center justify-between gap-1">
                          <button
                            onClick={() => toggleInsanityDayCompleted(day.dayNumber)}
                            className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition ${
                              day.completed
                                ? 'bg-[#10B981] text-gray-950'
                                : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                            }`}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{day.completed ? 'Hecho' : 'Marcar'}</span>
                          </button>

                          <button
                            onClick={() => setCurrentInsanityDay(day.dayNumber)}
                            title="Fijar como sesión de hoy en Dashboard"
                            className={`p-1 rounded-lg text-[10px] font-bold transition ${
                              isCurrentActive
                                ? 'bg-[#F59E0B] text-gray-950'
                                : 'bg-gray-800/70 text-gray-400 hover:text-white'
                            }`}
                          >
                            <Target className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Comparador de Fit Test (Tests 1 al 5) */
        <div className="space-y-5">
          {/* Test 1 to 5 Selector + Overall Improvement KPI */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8 bg-[#111827] border border-gray-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#F59E0B]" />
                  Selecciona Prueba Oficial para Registrar / Comparar
                </h3>
                <span className="text-xs text-gray-400">8 Movimientos Oficiales (1 min c/u)</span>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {state.fitTests.map((t) => {
                  const isSelected = t.testNumber === selectedTestTab;
                  return (
                    <button
                      key={t.testNumber}
                      onClick={() => setSelectedTestTab(t.testNumber)}
                      className={`p-2.5 rounded-xl border text-center transition ${
                        isSelected
                          ? 'bg-[#F59E0B] text-gray-950 border-[#F59E0B] font-extrabold'
                          : t.completed
                          ? 'bg-[#090D16] border-[#10B981]/40 text-white'
                          : 'bg-[#090D16] border-gray-800 text-gray-400'
                      }`}
                    >
                      <span className="text-xs block font-bold">FIT TEST #{t.testNumber}</span>
                      <span className="text-[10px] block opacity-80">Día {t.dayNumber}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-4 bg-[#111827] border border-[#10B981]/30 rounded-2xl p-4 flex flex-col justify-center">
              <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">
                Mejora Acumulada (Test #1 vs Test #{selectedTestTab})
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-extrabold font-mono text-[#10B981]">
                  {overallImprovementPct >= 0 ? `+${overallImprovementPct}%` : `${overallImprovementPct}%`}
                </span>
                <span className="text-xs text-gray-300">
                  ({totalRepsTest1} → {totalRepsActive} reps totales)
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Incremento de capacidad anaeróbica y potencia pliométrica.
              </p>
            </div>
          </div>

          {/* 8 Exercises Input & Improvement Table */}
          <div className="bg-[#111827] border border-gray-800 rounded-2xl p-4">
            <h3 className="text-sm font-bold text-white mb-3">
              Matriz de 8 Ejercicios Oficiales — Editando Fit Test #{selectedTestTab} (Día{' '}
              {activeTestRecord.dayNumber})
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-800 text-[11px] text-gray-400 uppercase">
                    <th className="py-2.5 px-2">Ejercicio Oficial</th>
                    <th className="py-2.5 px-2">Test 1 (Base)</th>
                    <th className="py-2.5 px-2">Test 2</th>
                    <th className="py-2.5 px-2">Test 3</th>
                    <th className="py-2.5 px-2">Test 4</th>
                    <th className="py-2.5 px-2">Test 5</th>
                    <th className="py-2.5 px-2">Editar Test #{selectedTestTab}</th>
                    <th className="py-2.5 px-2 text-right">% Mejora (vs T1)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/70 text-xs">
                  {FIT_TEST_EXERCISES_META.map((ex) => {
                    const baseVal = test1.results[ex.key] || 1;
                    const currentVal = activeTestRecord.results[ex.key] || 0;
                    const diffPct = Math.round(((currentVal - baseVal) / baseVal) * 1000) / 10;

                    return (
                      <tr key={ex.key} className="hover:bg-gray-800/30">
                        <td className="py-2.5 px-2">
                          <span className="font-bold text-white block">{ex.label}</span>
                          <span className="text-[10px] text-gray-400">{ex.muscleFocus}</span>
                        </td>
                        {state.fitTests.map((t) => (
                          <td
                            key={t.testNumber}
                            className={`py-2.5 px-2 font-mono ${
                              t.testNumber === selectedTestTab
                                ? 'text-[#F59E0B] font-extrabold'
                                : 'text-gray-300'
                            }`}
                          >
                            {t.results[ex.key]}
                          </td>
                        ))}
                        <td className="py-2.5 px-2">
                          <input
                            type="number"
                            min={0}
                            max={300}
                            value={activeTestRecord.results[ex.key]}
                            onChange={(e) =>
                              updateFitTestResult(selectedTestTab, ex.key, Number(e.target.value))
                            }
                            className="w-20 bg-[#090D16] border border-[#F59E0B]/60 rounded-lg px-2.5 py-1 font-mono font-bold text-white focus:border-[#F59E0B] focus:outline-none"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-bold">
                          <span
                            className={`px-2 py-0.5 rounded-md ${
                              diffPct > 0
                                ? 'bg-[#10B981]/15 text-[#10B981]'
                                : 'bg-gray-800 text-gray-300'
                            }`}
                          >
                            {diffPct >= 0 ? `+${diffPct}%` : `${diffPct}%`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Comparative Recharts Graph */}
          <div className="bg-[#111827] border border-gray-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#F59E0B]" />
                  Gráfica Comparativa de Fit Tests (Tests 1 al 5)
                </h3>
                <p className="text-xs text-gray-400">
                  Progresión de repeticiones en 1 minuto por cada ejercicio oficial
                </p>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 12, left: -12, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                  <XAxis dataKey="name" stroke="#9CA3AF" fontSize={10} />
                  <YAxis stroke="#9CA3AF" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#090D16',
                      borderColor: '#374151',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="Test 1" fill="#6B7280" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Test 2" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Test 3" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Test 4" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Test 5" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
