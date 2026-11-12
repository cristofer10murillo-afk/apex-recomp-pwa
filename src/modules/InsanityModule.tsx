import React, { useRef, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  Clock,
  FileText,
  Flame,
  HeartPulse,
  RotateCcw,
  Target,
  TrendingUp,
  Trophy,
  Upload,
  Watch,
  X,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { FIT_TEST_EXERCISES } from '../data/seedData';
import { parseSamsungHealthFile } from '../services/smartSyncService';
import { InsanityDay } from '../types/fitness';

export const InsanityModule: React.FC = () => {
  const {
    state,
    toggleInsanityDayCompleted,
    completeInsanityDayWithMetrics,
    setCurrentInsanityDay,
    updateFitTestResult,
  } = useApp();

  const [subTab, setSubTab] = useState<'calendar' | 'fittest'>('calendar');
  const [selectedTestNum, setSelectedTestNum] = useState(1);
  const [phaseFilter, setPhaseFilter] = useState<'all' | 'm1' | 'w5' | 'm2'>('all');

  const [modalDay, setModalDay] = useState<InsanityDay | null>(null);
  const [durationInput, setDurationInput] = useState(0);
  const [kcalInput, setKcalInput] = useState(0);
  const [avgHrInput, setAvgHrInput] = useState(0);
  const [watchSyncMode, setWatchSyncMode] = useState<'none' | 'replace' | 'add'>('add');
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  const [extractedOcrText, setExtractedOcrText] = useState<string | null>(null);
  const [showOcrText, setShowOcrText] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleOpenDayModal = (day: InsanityDay) => {
    if (day.isRestDay) {
      toggleInsanityDayCompleted(day.dayNumber);
      return;
    }
    setModalDay(day);
    setDurationInput(day.durationMin);
    setKcalInput(day.caloriesBurned ?? Math.round(day.durationMin * 11.5));
    setAvgHrInput(
      day.avgHr ?? (state.watchMetrics.avgHeartRate > 0 ? state.watchMetrics.avgHeartRate : 158)
    );
    if (day.completed) {
      setWatchSyncMode('none');
    } else if (state.watchMetrics.activeCalories > 0) {
      setWatchSyncMode('add');
    } else {
      setWatchSyncMode('replace');
    }
    setOcrStatus(null);
    setExtractedOcrText(null);
    setShowOcrText(false);
  };

  const handleSubmitDayMetrics = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalDay) return;
    completeInsanityDayWithMetrics(modalDay.dayNumber, {
      durationMin: durationInput,
      caloriesBurned: kcalInput,
      avgHr: avgHrInput,
      syncToWatchToday: watchSyncMode !== 'none',
      watchSyncMode,
    });
    setModalDay(null);
  };

  const handleResetModalFields = () => {
    setDurationInput(0);
    setKcalInput(0);
    setAvgHrInput(0);
    setOcrStatus('Campos restablecidos a 0. Sube tu captura o escribe los valores.');
  };

  const handleOcrFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrStatus('Leyendo captura de Samsung Health con OCR...');
    setExtractedOcrText(null);
    setShowOcrText(false);
    try {
      const res = await parseSamsungHealthFile(file, state.watchMetrics, (msg) => setOcrStatus(msg));
      if (res.durationMin !== undefined) setDurationInput(res.durationMin);
      if (res.activeCalories !== undefined) setKcalInput(res.activeCalories);
      if (res.avgHeartRate !== undefined) setAvgHrInput(res.avgHeartRate);
      if (res.extractedText) setExtractedOcrText(res.extractedText);
      setOcrStatus(res.summaryMessage || '✓ Métricas de Samsung Health detectadas.');
    } catch {
      setOcrStatus('⚠️ No se pudo leer la imagen, ingresa el valor manualmente.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const completedDaysCount = state.insanityCalendar.filter((d) => d.completed).length;
  const completedPercent = Math.round((completedDaysCount / 63) * 100);

  const weeksData = Array.from({ length: 9 }, (_, i) => {
    const weekNumber = i + 1;
    return {
      weekNumber,
      phase:
        weekNumber <= 4
          ? 'Mes 1 (Semanas 1-4: Base HIIT)'
          : weekNumber === 5
          ? 'Semana 5 (Recovery Week: Core Cardio & Balance)'
          : 'Mes 2 (Semanas 6-9: Max Interval)',
      days: state.insanityCalendar.filter((d) => d.weekNumber === weekNumber),
    };
  }).filter((w) =>
    phaseFilter === 'm1'
      ? w.weekNumber <= 4
      : phaseFilter === 'w5'
      ? w.weekNumber === 5
      : phaseFilter === 'm2'
      ? w.weekNumber >= 6
      : true
  );

  const test1 = state.fitTests.find((t) => t.testNumber === 1) || state.fitTests[0];
  const activeTest = state.fitTests.find((t) => t.testNumber === selectedTestNum) || test1;

  const fitTestChartData = FIT_TEST_EXERCISES.map((ex) => {
    const row: Record<string, string | number> = {
      name: ex.label.replace(/^\d+\.\s*/, '').split('(')[0].trim(),
    };
    state.fitTests.forEach((ft) => {
      row[`Test ${ft.testNumber}`] = ft.results[ex.key];
    });
    return row;
  });

  const test1Total = Object.values(test1.results).reduce((acc, v) => acc + v, 0);
  const activeTestTotal = Object.values(activeTest.results).reduce((acc, v) => acc + v, 0);
  const improvementPct =
    test1Total > 0 ? Math.round(((activeTestTotal - test1Total) / test1Total) * 1000) / 10 : 0;

  return (
    <div className="space-y-5 pb-8">
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
              Progreso global:{' '}
              <strong className="text-[#10B981]">
                {completedDaysCount}/63 días ({completedPercent}%)
              </strong>{' '}
              • Día Activo en Dashboard:{' '}
              <strong className="text-[#F59E0B]">Día {state.currentInsanityDay}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2 bg-[#090D16] p-1 rounded-xl border border-gray-800 self-start">
            <button
              onClick={() => setSubTab('calendar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                subTab === 'calendar' ? 'bg-[#F59E0B] text-gray-950' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Matriz 9 Semanas (63D)
            </button>
            <button
              onClick={() => setSubTab('fittest')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                subTab === 'fittest' ? 'bg-[#F59E0B] text-gray-950' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              Comparador Fit Test (1-5)
            </button>
          </div>
        </div>

        <div className="w-full h-2 bg-[#090D16] rounded-full overflow-hidden mt-3 border border-gray-800">
          <div
            className="h-full bg-gradient-to-r from-[#F59E0B] to-[#10B981] transition-all duration-500"
            style={{ width: `${completedPercent}%` }}
          />
        </div>
      </div>

      {subTab === 'calendar' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'all', label: 'Todas las 9 Semanas (63 Días)' },
                { id: 'm1', label: 'Mes 1 (Semanas 1-4)' },
                { id: 'w5', label: 'Semana 5 (Core Cardio & Balance)' },
                { id: 'm2', label: 'Mes 2 (Semanas 6-9 Max Interval)' },
              ] as const
            ).map((btn) => (
              <button
                key={btn.id}
                onClick={() => setPhaseFilter(btn.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                  phaseFilter === btn.id
                    ? 'bg-[#F59E0B]/20 border-[#F59E0B] text-[#F59E0B]'
                    : 'bg-[#111827] border-gray-800 text-gray-400 hover:text-gray-200'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {weeksData.map((week) => (
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
                    const isCurrentDay = day.dayNumber === state.currentInsanityDay;
                    return (
                      <div
                        key={day.dayNumber}
                        className={`p-3 rounded-xl border flex flex-col justify-between transition ${
                          day.completed
                            ? 'bg-[#10B981]/10 border-[#10B981]/40'
                            : isCurrentDay
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
                          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-gray-400">
                            <span className="flex items-center gap-0.5">
                              <Clock className="w-3 h-3" />
                              {day.durationMin}m
                            </span>
                            {!day.isRestDay &&
                              (day.completed && day.caloriesBurned ? (
                                <>
                                  <span className="flex items-center gap-0.5 text-[#10B981] font-bold">
                                    <Flame className="w-3 h-3" />
                                    {day.caloriesBurned} kcal
                                  </span>
                                  {day.avgHr ? (
                                    <span className="flex items-center gap-0.5 text-rose-400 font-bold">
                                      <HeartPulse className="w-3 h-3" />
                                      {day.avgHr} bpm
                                    </span>
                                  ) : null}
                                </>
                              ) : (
                                <span className="flex items-center gap-0.5 text-gray-500">
                                  <Watch className="w-3 h-3" />0 kcal (Pendiente)
                                </span>
                              ))}
                          </div>
                        </div>

                        <div className="mt-3 pt-2 border-t border-gray-800/80 flex items-center justify-between gap-1">
                          <button
                            onClick={() => handleOpenDayModal(day)}
                            className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition ${
                              day.completed
                                ? 'bg-[#10B981] text-gray-950'
                                : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                            }`}
                          >
                            <CircleCheck className="w-3 h-3" />
                            <span>{day.completed ? 'Hecho (Editar)' : 'Marcar + Watch 7'}</span>
                          </button>
                          <button
                            onClick={() => setCurrentInsanityDay(day.dayNumber)}
                            title="Fijar como sesión de hoy en Dashboard"
                            className={`p-1 rounded-lg text-[10px] font-bold transition ${
                              isCurrentDay
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
        <div className="space-y-5">
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
                {state.fitTests.map((ft) => {
                  const isActive = ft.testNumber === selectedTestNum;
                  return (
                    <button
                      key={ft.testNumber}
                      onClick={() => setSelectedTestNum(ft.testNumber)}
                      className={`p-2.5 rounded-xl border text-center transition ${
                        isActive
                          ? 'bg-[#F59E0B] text-gray-950 border-[#F59E0B] font-extrabold'
                          : ft.completed
                          ? 'bg-[#090D16] border-[#10B981]/40 text-white'
                          : 'bg-[#090D16] border-gray-800 text-gray-400'
                      }`}
                    >
                      <span className="text-xs block font-bold">FIT TEST #{ft.testNumber}</span>
                      <span className="text-[10px] block opacity-80">Día {ft.dayNumber}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-4 bg-[#111827] border border-[#10B981]/30 rounded-2xl p-4 flex flex-col justify-center">
              <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">
                Mejora Acumulada (Test #1 vs Test #{selectedTestNum})
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-extrabold font-mono text-[#10B981]">
                  {improvementPct >= 0 ? `+${improvementPct}%` : `${improvementPct}%`}
                </span>
                <span className="text-xs text-gray-300">
                  ({test1Total} → {activeTestTotal} reps totales)
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Incremento de capacidad anaeróbica y potencia pliométrica.
              </p>
            </div>
          </div>

          <div className="bg-[#111827] border border-gray-800 rounded-2xl p-4">
            <h3 className="text-sm font-bold text-white mb-3">
              Matriz de 8 Ejercicios Oficiales — Editando Fit Test #{selectedTestNum} (Día{' '}
              {activeTest.dayNumber})
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
                    <th className="py-2.5 px-2">Editar Test #{selectedTestNum}</th>
                    <th className="py-2.5 px-2 text-right">% Mejora (vs T1)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/70 text-xs">
                  {FIT_TEST_EXERCISES.map((ex) => {
                    const baseVal = test1.results[ex.key] || 1;
                    const currVal = activeTest.results[ex.key] || 0;
                    const deltaPct = Math.round(((currVal - baseVal) / baseVal) * 1000) / 10;
                    return (
                      <tr key={ex.key} className="hover:bg-gray-800/30">
                        <td className="py-2.5 px-2">
                          <span className="font-bold text-white block">{ex.label}</span>
                          <span className="text-[10px] text-gray-400">{ex.muscleFocus}</span>
                        </td>
                        {state.fitTests.map((ft) => (
                          <td
                            key={ft.testNumber}
                            className={`py-2.5 px-2 font-mono ${
                              ft.testNumber === selectedTestNum
                                ? 'text-[#F59E0B] font-extrabold'
                                : 'text-gray-300'
                            }`}
                          >
                            {ft.results[ex.key]}
                          </td>
                        ))}
                        <td className="py-2.5 px-2">
                          <input
                            type="number"
                            min={0}
                            max={300}
                            value={activeTest.results[ex.key]}
                            onChange={(e) =>
                              updateFitTestResult(selectedTestNum, ex.key, Number(e.target.value))
                            }
                            className="w-20 bg-[#090D16] border border-[#F59E0B]/60 rounded-lg px-2.5 py-1 font-mono font-bold text-white focus:border-[#F59E0B] focus:outline-none"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-bold">
                          <span
                            className={`px-2 py-0.5 rounded-md ${
                              deltaPct > 0
                                ? 'bg-[#10B981]/15 text-[#10B981]'
                                : 'bg-gray-800 text-gray-300'
                            }`}
                          >
                            {deltaPct >= 0 ? `+${deltaPct}%` : `${deltaPct}%`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

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
                <BarChart data={fitTestChartData} margin={{ top: 10, right: 12, left: -12, bottom: 5 }}>
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

      {modalDay && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-[#F59E0B]/40 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#F59E0B]/20 text-[#F59E0B]">
                  <Watch className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">
                    Registrar Sesión Real • Día {modalDay.dayNumber}
                  </h3>
                  <p className="text-xs text-[#F59E0B] font-semibold">{modalDay.workoutTitle}</p>
                </div>
              </div>
              <button
                onClick={() => setModalDay(null)}
                className="p-1.5 rounded-lg bg-gray-900 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#090D16] border border-gray-800 rounded-xl p-3 space-y-2.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.txt,.csv,.json"
                onChange={handleOcrFileChange}
                className="hidden"
              />
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <span className="text-xs text-gray-200 font-bold block">
                    ¿Tienes captura de Samsung Health?
                  </span>
                  <span className="text-[10px] text-gray-400">
                    Transcribe minutos, kcal y pulso automáticamente
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleResetModalFields}
                    className="px-2.5 py-1.5 rounded-xl bg-gray-800/80 hover:bg-gray-800 border border-gray-700 text-gray-300 font-semibold text-[11px] flex items-center gap-1 transition"
                    title="Poner todos los campos en 0"
                  >
                    <RotateCcw className="w-3 h-3 text-gray-400" />
                    <span>Limpiar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (fileInputRef.current) fileInputRef.current.value = '';
                      fileInputRef.current?.click();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-gray-950 font-extrabold text-xs flex items-center gap-1.5 transition shadow-sm shadow-[#10B981]/25"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>📂 Subir Captura</span>
                  </button>
                </div>
              </div>

              {ocrStatus && (
                <div
                  className={`p-2 rounded-lg text-xs font-bold border transition ${
                    ocrStatus.startsWith('✓')
                      ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30'
                      : ocrStatus.startsWith('⚠️')
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                  }`}
                >
                  {ocrStatus}
                </div>
              )}

              {extractedOcrText && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowOcrText(!showOcrText)}
                    className="text-[10px] text-gray-400 hover:text-gray-200 flex items-center gap-1 transition"
                  >
                    <FileText className="w-3 h-3" />
                    <span>{showOcrText ? 'Ocultar texto OCR' : 'Ver texto detectado por OCR'}</span>
                    {showOcrText ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {showOcrText && (
                    <pre className="mt-1.5 p-2 rounded-lg bg-black/60 border border-gray-800 text-[10px] text-gray-300 font-mono max-h-28 overflow-y-auto whitespace-pre-wrap leading-tight">
                      {extractedOcrText}
                    </pre>
                  )}
                </div>
              )}
            </div>

            <form onSubmit={handleSubmitDayMetrics} className="space-y-3">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-[#090D16] border border-gray-800 rounded-xl p-2.5">
                  <label className="text-[11px] text-gray-400 flex items-center gap-1 mb-1">
                    <Clock className="w-3 h-3 text-[#3B82F6]" /> Tiempo (min)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={durationInput}
                    onChange={(e) => setDurationInput(Number(e.target.value))}
                    className="w-full bg-[#111827] border border-gray-700 rounded-lg px-2 py-1.5 text-sm font-mono font-bold text-white"
                  />
                </div>
                <div className="bg-[#090D16] border border-[#F59E0B]/40 rounded-xl p-2.5">
                  <label className="text-[11px] text-[#F59E0B] font-bold flex items-center gap-1 mb-1">
                    <Flame className="w-3 h-3" /> Kcal Watch 7
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={2500}
                    value={kcalInput}
                    onChange={(e) => setKcalInput(Number(e.target.value))}
                    className="w-full bg-[#111827] border border-gray-700 rounded-lg px-2 py-1.5 text-sm font-mono font-bold text-[#F59E0B]"
                  />
                </div>
                <div className="bg-[#090D16] border border-gray-800 rounded-xl p-2.5">
                  <label className="text-[11px] text-rose-400 flex items-center gap-1 mb-1">
                    <HeartPulse className="w-3 h-3" /> FC Prom (bpm)
                  </label>
                  <input
                    type="number"
                    min={60}
                    max={220}
                    value={avgHrInput}
                    onChange={(e) => setAvgHrInput(Number(e.target.value))}
                    className="w-full bg-[#111827] border border-gray-700 rounded-lg px-2 py-1.5 text-sm font-mono font-bold text-rose-400"
                  />
                </div>
              </div>

              <div className="bg-[#090D16] p-3 rounded-xl border border-gray-800 space-y-2">
                <span className="text-[11px] font-bold text-gray-200 block">
                  ¿Cómo sincronizar con el Anillo Watch 7 de Hoy?
                </span>
                <div className="grid grid-cols-1 gap-1.5 text-xs">
                  <label
                    className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition ${
                      watchSyncMode === 'add'
                        ? 'bg-emerald-500/15 border-emerald-500/50 text-white'
                        : 'bg-[#111827]/70 border-gray-800 text-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="watchSyncMode"
                      checked={watchSyncMode === 'add'}
                      onChange={() => setWatchSyncMode('add')}
                      className="mt-0.5 accent-[#10B981]"
                    />
                    <div className="leading-snug">
                      <span className="font-bold block">
                        ➕ Sumar al Watch actual ({state.watchMetrics.activeCalories || 0} +{' '}
                        {kcalInput || 0} ={' '}
                        {(state.watchMetrics.activeCalories || 0) + (kcalInput || 0)} kcal)
                      </span>
                      <span className="text-[10px] text-gray-400">
                        Ideal si mediste pasos/calorías antes de entrenar y ahora agregas esta sesión.
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition ${
                      watchSyncMode === 'replace'
                        ? 'bg-cyan-500/15 border-cyan-500/50 text-white'
                        : 'bg-[#111827]/70 border-gray-800 text-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="watchSyncMode"
                      checked={watchSyncMode === 'replace'}
                      onChange={() => setWatchSyncMode('replace')}
                      className="mt-0.5 accent-cyan-400"
                    />
                    <div className="leading-snug">
                      <span className="font-bold block">
                        ⌚ Fijar en Watch como total ({kcalInput || 0} kcal)
                      </span>
                      <span className="text-[10px] text-gray-400">
                        Si hoy no habías cargado nada previo o este número ya es tu total.
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition ${
                      watchSyncMode === 'none'
                        ? 'bg-amber-500/15 border-amber-500/50 text-white'
                        : 'bg-[#111827]/70 border-gray-800 text-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="watchSyncMode"
                      checked={watchSyncMode === 'none'}
                      onChange={() => setWatchSyncMode('none')}
                      className="mt-0.5 accent-amber-400"
                    />
                    <div className="leading-snug">
                      <span className="font-bold block">
                        🛡️ Solo guardar sesión Insanity (mantener Watch en{' '}
                        {state.watchMetrics.activeCalories || 0} kcal)
                      </span>
                      <span className="text-[10px] text-gray-400">
                        Úsalo al editar un día o si prefieres subir el Anillo Diario final de S-Health.
                      </span>
                    </div>
                  </label>
                </div>
                <p className="text-[10px] text-amber-300/90 leading-snug pt-0.5">
                  Tip Samsung Health: el anillo diario final suele marcar ~15% menos que la suma directa
                  porque descuenta metabolismo basal y pasos repetidos durante el HIIT. Para máxima
                  precisión, al terminar sube tu captura del anillo diario en el Dashboard.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                {modalDay.completed && (
                  <button
                    type="button"
                    onClick={() => {
                      toggleInsanityDayCompleted(modalDay.dayNumber);
                      setModalDay(null);
                    }}
                    className="px-3 py-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold text-xs"
                  >
                    Desmarcar Día
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-gray-950 font-extrabold text-xs flex items-center justify-center gap-1.5"
                >
                  <CircleCheck className="w-4 h-4" />
                  <span>Guardar Datos Reales Watch 7</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
