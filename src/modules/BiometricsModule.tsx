import React, { useState } from 'react';
import {
  Scale,
  Activity,
  Droplets,
  Flame,
  Bone,
  AlertTriangle,
  CheckCircle2,
  PlusCircle,
  ShieldAlert,
  Bluetooth,
  ClipboardPaste,
  Sparkles,
  Smartphone,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { useApp } from '../context/AppContext';
import {
  connectCamryScaleBluetoothBLE,
  estimateSmartSegmentalFromWeightAndFat,
  parseMovingLifeText,
} from '../services/smartSyncService';

export const BiometricsModule: React.FC = () => {
  const { state, addCamryRecord, getAsymmetryAnalysis } = useApp();

  const latest = state.camryHistory[state.camryHistory.length - 1];
  const first = state.camryHistory[0];

  const [weightKg, setWeightKg] = useState(latest.weightKg);
  const [bodyFatPercent, setBodyFatPercent] = useState(latest.bodyFatPercent);
  const [waterPercent, setWaterPercent] = useState(latest.waterPercent);
  const [visceralFatIndex, setVisceralFatIndex] = useState(latest.visceralFatIndex);
  const [boneMassKg, setBoneMassKg] = useState(latest.boneMassKg);
  const [bmrKcal, setBmrKcal] = useState(latest.bmrKcal);

  // 5 Zones Segmental inputs
  const [leftArmMuscle, setLeftArmMuscle] = useState(latest.segments.leftArm.muscleKg);
  const [leftArmFat, setLeftArmFat] = useState(latest.segments.leftArm.fatPercent);
  const [rightArmMuscle, setRightArmMuscle] = useState(latest.segments.rightArm.muscleKg);
  const [rightArmFat, setRightArmFat] = useState(latest.segments.rightArm.fatPercent);
  const [trunkMuscle, setTrunkMuscle] = useState(latest.segments.trunk.muscleKg);
  const [trunkFat, setTrunkFat] = useState(latest.segments.trunk.fatPercent);
  const [leftLegMuscle, setLeftLegMuscle] = useState(latest.segments.leftLeg.muscleKg);
  const [leftLegFat, setLeftLegFat] = useState(latest.segments.leftLeg.fatPercent);
  const [rightLegMuscle, setRightLegMuscle] = useState(latest.segments.rightLeg.muscleKg);
  const [rightLegFat, setRightLegFat] = useState(latest.segments.rightLeg.fatPercent);

  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [movingLifeText, setMovingLifeText] = useState('');
  const [bleScanning, setBleScanning] = useState(false);

  const applyRecordToForm = (rec: Omit<typeof latest, 'id'>) => {
    setWeightKg(rec.weightKg);
    setBodyFatPercent(rec.bodyFatPercent);
    setWaterPercent(rec.waterPercent);
    setVisceralFatIndex(rec.visceralFatIndex);
    setBoneMassKg(rec.boneMassKg);
    setBmrKcal(rec.bmrKcal);
    setLeftArmMuscle(rec.segments.leftArm.muscleKg);
    setLeftArmFat(rec.segments.leftArm.fatPercent);
    setRightArmMuscle(rec.segments.rightArm.muscleKg);
    setRightArmFat(rec.segments.rightArm.fatPercent);
    setTrunkMuscle(rec.segments.trunk.muscleKg);
    setTrunkFat(rec.segments.trunk.fatPercent);
    setLeftLegMuscle(rec.segments.leftLeg.muscleKg);
    setLeftLegFat(rec.segments.leftLeg.fatPercent);
    setRightLegMuscle(rec.segments.rightLeg.muscleKg);
    setRightLegFat(rec.segments.rightLeg.fatPercent);
  };

  const notify = (msg: string) => {
    setSavedNotice(msg);
    window.setTimeout(() => setSavedNotice(null), 4000);
  };

  const handleSmartAutoCalculate = () => {
    const estimated = estimateSmartSegmentalFromWeightAndFat(weightKg, bodyFatPercent, latest);
    applyRecordToForm(estimated);
    addCamryRecord(estimated);
    notify(
      `✓ Auto-Cálculo 8E completado (${estimated.weightKg} kg, ${estimated.bodyFatPercent}% grasa, BMR ${estimated.bmrKcal} kcal) y guardado en Firebase.`
    );
  };

  const handleCamryBluetooth = async () => {
    setBleScanning(true);
    try {
      const record = await connectCamryScaleBluetoothBLE(latest);
      applyRecordToForm(record);
      addCamryRecord(record);
      notify(`✓ Peso recibido por Bluetooth BLE (${record.weightKg} kg) y 5 zonas actualizadas.`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Error al conectar por Bluetooth BLE.');
    } finally {
      setBleScanning(false);
    }
  };

  const handlePasteMovingLife = () => {
    if (!movingLifeText.trim()) return;
    const parsed = parseMovingLifeText(movingLifeText, latest);
    applyRecordToForm(parsed);
    addCamryRecord(parsed);
    setMovingLifeText('');
    setShowPasteBox(false);
    notify('✓ Reporte de MovingLife procesado y sincronizado en Firebase.');
  };

  const handleSaveMeasurement = (e: React.FormEvent) => {
    e.preventDefault();
    const today = new Date().toISOString().slice(0, 10);
    addCamryRecord({
      date: today,
      weightKg,
      bodyFatPercent,
      waterPercent,
      visceralFatIndex,
      boneMassKg,
      bmrKcal,
      segments: {
        leftArm: { muscleKg: leftArmMuscle, fatPercent: leftArmFat },
        rightArm: { muscleKg: rightArmMuscle, fatPercent: rightArmFat },
        trunk: { muscleKg: trunkMuscle, fatPercent: trunkFat },
        leftLeg: { muscleKg: leftLegMuscle, fatPercent: leftLegFat },
        rightLeg: { muscleKg: rightLegMuscle, fatPercent: rightLegFat },
      },
    });
    notify('✓ Lectura biométrica de 8 electrodos guardada y sincronizada en Firebase.');
  };

  const asymmetryReports = getAsymmetryAnalysis();

  const liveArmDiff =
    Math.round(
      (Math.abs(leftArmMuscle - rightArmMuscle) / Math.max(leftArmMuscle, rightArmMuscle, 0.1)) *
        1000
    ) / 10;
  const liveLegDiff =
    Math.round(
      (Math.abs(leftLegMuscle - rightLegMuscle) / Math.max(leftLegMuscle, rightLegMuscle, 0.1)) *
        1000
    ) / 10;

  const segmentalChartData = [
    {
      zone: 'Brazo Izq',
      MusculoKg: latest.segments.leftArm.muscleKg,
      GrasaPct: latest.segments.leftArm.fatPercent,
    },
    {
      zone: 'Brazo Der',
      MusculoKg: latest.segments.rightArm.muscleKg,
      GrasaPct: latest.segments.rightArm.fatPercent,
    },
    {
      zone: 'Tronco',
      MusculoKg: latest.segments.trunk.muscleKg,
      GrasaPct: latest.segments.trunk.fatPercent,
    },
    {
      zone: 'Pierna Izq',
      MusculoKg: latest.segments.leftLeg.muscleKg,
      GrasaPct: latest.segments.leftLeg.fatPercent,
    },
    {
      zone: 'Pierna Der',
      MusculoKg: latest.segments.rightLeg.muscleKg,
      GrasaPct: latest.segments.rightLeg.fatPercent,
    },
  ];

  const weightDelta = Math.round((latest.weightKg - first.weightKg) * 10) / 10;
  const fatDelta = Math.round((latest.bodyFatPercent - first.bodyFatPercent) * 10) / 10;

  return (
    <div className="space-y-5 pb-8">
      {/* Top Clinical KPIs from Camry 8-Electrode Scale */}
      <div className="bg-[#111827] border border-gray-800 rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#3B82F6]/15 text-[#3B82F6]">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">
                BÁSCULA CAMRY BLUETOOTH SMART (8 ELECTRODOS / 6 CANALES)
              </h2>
              <p className="text-xs text-gray-400">
                Bioimpedancia Segmentaria compatible con MovingLife • Última lectura: {latest.date}
              </p>
            </div>
          </div>

          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#10B981]/15 text-[#10B981] self-start">
            Δ Recomposición: {weightDelta} kg peso / {fatDelta}% grasa
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div className="bg-[#090D16] border border-gray-800 rounded-xl p-3">
            <span className="text-[11px] text-gray-400 flex items-center gap-1">
              <Scale className="w-3.5 h-3.5 text-[#3B82F6]" />
              Peso Corporal
            </span>
            <span className="text-lg font-mono font-extrabold text-white mt-1 block">
              {latest.weightKg} kg
            </span>
          </div>

          <div className="bg-[#090D16] border border-gray-800 rounded-xl p-3">
            <span className="text-[11px] text-gray-400 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-[#10B981]" />% Grasa Corporal
            </span>
            <span className="text-lg font-mono font-extrabold text-[#10B981] mt-1 block">
              {latest.bodyFatPercent}%
            </span>
          </div>

          <div className="bg-[#090D16] border border-gray-800 rounded-xl p-3">
            <span className="text-[11px] text-gray-400 flex items-center gap-1">
              <Droplets className="w-3.5 h-3.5 text-sky-400" />% Agua Corporal
            </span>
            <span className="text-lg font-mono font-extrabold text-sky-400 mt-1 block">
              {latest.waterPercent}%
            </span>
          </div>

          <div className="bg-[#090D16] border border-gray-800 rounded-xl p-3">
            <span className="text-[11px] text-gray-400 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-[#F59E0B]" />
              Grasa Visceral
            </span>
            <span className="text-lg font-mono font-extrabold text-[#F59E0B] mt-1 block">
              Nivel {latest.visceralFatIndex}
            </span>
          </div>

          <div className="bg-[#090D16] border border-gray-800 rounded-xl p-3">
            <span className="text-[11px] text-gray-400 flex items-center gap-1">
              <Bone className="w-3.5 h-3.5 text-purple-400" />
              Masa Ósea
            </span>
            <span className="text-lg font-mono font-extrabold text-purple-400 mt-1 block">
              {latest.boneMassKg} kg
            </span>
          </div>

          <div className="bg-[#090D16] border border-gray-800 rounded-xl p-3">
            <span className="text-[11px] text-gray-400 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-emerald-400" />
              Tasa BMR Basal
            </span>
            <span className="text-lg font-mono font-extrabold text-white mt-1 block">
              {latest.bmrKcal} kcal
            </span>
          </div>
        </div>
      </div>

      {/* Detector Automático de Asimetrías (>5%) */}
      <div className="bg-[#111827] border border-gray-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
            Detector Automático de Asimetrías Musculares (Umbral &gt; 5%)
          </h3>
          <span className="text-[11px] text-gray-400">Análisis Bilateral Izquierda vs Derecha</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {asymmetryReports.map((item) => (
            <div
              key={item.limb}
              className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2 ${
                item.hasAlert
                  ? 'bg-[#F59E0B]/10 border-[#F59E0B]/50'
                  : 'bg-[#10B981]/10 border-[#10B981]/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${
                    item.hasAlert ? 'text-[#F59E0B]' : 'text-[#10B981]'
                  }`}
                >
                  {item.hasAlert ? (
                    <AlertTriangle className="w-4 h-4" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {item.limb}: Izq {item.leftKg} kg vs Der {item.rightKg} kg
                </span>
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${
                    item.hasAlert
                      ? 'bg-[#F59E0B]/20 text-[#F59E0B]'
                      : 'bg-[#10B981]/20 text-[#10B981]'
                  }`}
                >
                  Δ {item.diffPercent}%
                </span>
              </div>
              <p className="text-xs text-gray-200 leading-relaxed">{item.prescription}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Mapa Anatómico Segmentario (5 Zonas) + Formulario de Registro Camry 8E */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Visual 5-Zone Anatomical Map */}
        <div className="lg:col-span-5 bg-[#111827] border border-gray-800 rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Mapa Anatómico Segmentario (5 Zonas)</h3>
            <p className="text-xs text-gray-400">
              Distribución actual de Masa Muscular (kg) y % Grasa por canal
            </p>
          </div>

          <div className="relative my-4 py-2 flex flex-col items-center">
            <div className="grid grid-cols-3 gap-2 w-full items-center">
              <div className="space-y-4">
                <div
                  className={`p-2.5 rounded-xl border text-left ${
                    liveArmDiff > 5
                      ? 'bg-[#090D16] border-[#F59E0B]/50'
                      : 'bg-[#090D16] border-gray-800'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase text-[#3B82F6] block">
                    Brazo Izquierdo
                  </span>
                  <span className="text-xs font-mono font-extrabold text-white block mt-0.5">
                    {latest.segments.leftArm.muscleKg} kg músc.
                  </span>
                  <span className="text-[11px] font-mono text-[#10B981]">
                    {latest.segments.leftArm.fatPercent}% grasa
                  </span>
                </div>

                <div
                  className={`p-2.5 rounded-xl border text-left ${
                    liveLegDiff > 5
                      ? 'bg-[#090D16] border-[#F59E0B]/50'
                      : 'bg-[#090D16] border-gray-800'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase text-[#3B82F6] block">
                    Pierna Izquierda
                  </span>
                  <span className="text-xs font-mono font-extrabold text-white block mt-0.5">
                    {latest.segments.leftLeg.muscleKg} kg músc.
                  </span>
                  <span className="text-[11px] font-mono text-[#10B981]">
                    {latest.segments.leftLeg.fatPercent}% grasa
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center">
                <svg
                  viewBox="0 0 120 240"
                  className="w-28 h-48 drop-shadow-[0_0_12px_rgba(59,130,246,0.3)]"
                >
                  <circle cx="60" cy="24" r="14" fill="#1F2937" stroke="#3B82F6" strokeWidth="2" />
                  <rect
                    x="40"
                    y="44"
                    width="40"
                    height="78"
                    rx="10"
                    fill="#10B981"
                    fillOpacity="0.22"
                    stroke="#10B981"
                    strokeWidth="2"
                  />
                  <rect
                    x="16"
                    y="46"
                    width="18"
                    height="68"
                    rx="8"
                    fill="#3B82F6"
                    fillOpacity="0.25"
                    stroke={liveArmDiff > 5 ? '#F59E0B' : '#3B82F6'}
                    strokeWidth="2"
                  />
                  <rect
                    x="86"
                    y="46"
                    width="18"
                    height="68"
                    rx="8"
                    fill="#3B82F6"
                    fillOpacity="0.25"
                    stroke={liveArmDiff > 5 ? '#F59E0B' : '#3B82F6'}
                    strokeWidth="2"
                  />
                  <rect
                    x="38"
                    y="128"
                    width="19"
                    height="92"
                    rx="8"
                    fill="#3B82F6"
                    fillOpacity="0.25"
                    stroke={liveLegDiff > 5 ? '#F59E0B' : '#3B82F6'}
                    strokeWidth="2"
                  />
                  <rect
                    x="63"
                    y="128"
                    width="19"
                    height="92"
                    rx="8"
                    fill="#3B82F6"
                    fillOpacity="0.25"
                    stroke={liveLegDiff > 5 ? '#F59E0B' : '#3B82F6'}
                    strokeWidth="2"
                  />
                  <circle cx="25" cy="110" r="3.5" fill="#F59E0B" />
                  <circle cx="95" cy="110" r="3.5" fill="#F59E0B" />
                  <circle cx="47" cy="216" r="3.5" fill="#F59E0B" />
                  <circle cx="72" cy="216" r="3.5" fill="#F59E0B" />
                </svg>

                <div className="p-2.5 rounded-xl bg-[#090D16] border border-[#10B981]/40 text-center w-full mt-2">
                  <span className="text-[10px] font-bold uppercase text-[#10B981] block">
                    Tronco Central
                  </span>
                  <span className="text-xs font-mono font-extrabold text-white">
                    {latest.segments.trunk.muscleKg} kg músc. • {latest.segments.trunk.fatPercent}% grasa
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div
                  className={`p-2.5 rounded-xl border text-right ${
                    liveArmDiff > 5
                      ? 'bg-[#090D16] border-[#F59E0B]/50'
                      : 'bg-[#090D16] border-gray-800'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase text-[#3B82F6] block">
                    Brazo Derecho
                  </span>
                  <span className="text-xs font-mono font-extrabold text-white block mt-0.5">
                    {latest.segments.rightArm.muscleKg} kg músc.
                  </span>
                  <span className="text-[11px] font-mono text-[#10B981]">
                    {latest.segments.rightArm.fatPercent}% grasa
                  </span>
                </div>

                <div
                  className={`p-2.5 rounded-xl border text-right ${
                    liveLegDiff > 5
                      ? 'bg-[#090D16] border-[#F59E0B]/50'
                      : 'bg-[#090D16] border-gray-800'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase text-[#3B82F6] block">
                    Pierna Derecha
                  </span>
                  <span className="text-xs font-mono font-extrabold text-white block mt-0.5">
                    {latest.segments.rightLeg.muscleKg} kg músc.
                  </span>
                  <span className="text-[11px] font-mono text-[#10B981]">
                    {latest.segments.rightLeg.fatPercent}% grasa
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-gray-400 text-center border-t border-gray-800 pt-2">
            Puntos ámbar: 8 electrodos de contacto (Manubrio retráctil + Base de vidrio conductivo)
          </div>
        </div>

        {/* Form to Record New Camry 8-Electrode Measurement + Smart S23 Ultra Sync */}
        <form
          onSubmit={handleSaveMeasurement}
          className="lg:col-span-7 bg-[#111827] border border-gray-800 rounded-2xl p-4 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-[#10B981]" />
                Sincronización Rápida Báscula Camry 8E (S23 Ultra)
              </h3>
              <p className="text-xs text-gray-400">
                Actualiza solo Peso + % Grasa y usa el Auto-Cálculo 8E, o conecta por Bluetooth BLE
              </p>
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-gray-950 font-bold text-xs transition self-start"
            >
              Guardar Lectura 8E
            </button>
          </div>

          {/* S23 Ultra Smart Sync Bar for Camry 8E */}
          <div className="bg-[#090D16] border border-[#3B82F6]/40 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-[11px] font-bold text-gray-300 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-[#3B82F6]" />
                Modo Rápido S23 Ultra (Sin llenar los 16 campos a mano):
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSmartAutoCalculate}
                  className="px-2.5 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#10B981]/90 text-gray-950 font-extrabold text-[11px] flex items-center gap-1 transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>⚡ Auto-Calcular 5 Zonas + BMR</span>
                </button>
                <button
                  type="button"
                  onClick={handleCamryBluetooth}
                  disabled={bleScanning}
                  className="px-2.5 py-1.5 rounded-lg bg-[#3B82F6]/20 hover:bg-[#3B82F6]/30 text-[#3B82F6] font-bold text-[11px] flex items-center gap-1 transition"
                >
                  <Bluetooth className="w-3.5 h-3.5" />
                  <span>{bleScanning ? 'Escaneando...' : 'BLE Camry'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPasteBox(!showPasteBox)}
                  className="px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold text-[11px] flex items-center gap-1 transition"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span>Pegar MovingLife</span>
                </button>
              </div>
            </div>

            {showPasteBox && (
              <div className="pt-2 border-t border-gray-800 space-y-2">
                <p className="text-[11px] text-gray-300">
                  Toma captura en <em>MovingLife</em> en tu S23 Ultra, toca el botón{' '}
                  <strong className="text-[#10B981]">&quot;T&quot; (Extraer texto)</strong> y pégalo aquí:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={movingLifeText}
                    onChange={(e) => setMovingLifeText(e.target.value)}
                    placeholder="Ej: 79.4 kg, Grasa 15.1%, Agua 60.5%, Visceral 6, 1860 kcal"
                    className="flex-1 bg-[#111827] border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={handlePasteMovingLife}
                    className="px-3 py-1.5 rounded-lg bg-[#10B981] text-gray-950 font-bold text-xs shrink-0"
                  >
                    Procesar
                  </button>
                </div>
              </div>
            )}
          </div>

          {savedNotice && (
            <div className="p-2.5 rounded-xl bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] text-xs font-bold">
              {savedNotice}
            </div>
          )}

          {/* Global Biometrics Inputs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="text-[11px] text-[#3B82F6] font-bold block mb-1">
                1. Peso Actual (kg) *
              </label>
              <input
                type="number"
                step="0.1"
                value={weightKg}
                onChange={(e) => setWeightKg(Number(e.target.value))}
                className="w-full bg-[#090D16] border border-[#3B82F6]/50 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-[#10B981] font-bold block mb-1">
                2. % Grasa Corporal *
              </label>
              <input
                type="number"
                step="0.1"
                value={bodyFatPercent}
                onChange={(e) => setBodyFatPercent(Number(e.target.value))}
                className="w-full bg-[#090D16] border border-[#10B981]/50 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-[#10B981]"
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">% Agua Corporal</label>
              <input
                type="number"
                step="0.1"
                value={waterPercent}
                onChange={(e) => setWaterPercent(Number(e.target.value))}
                className="w-full bg-[#090D16] border border-gray-800 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-sky-400"
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Grasa Visceral</label>
              <input
                type="number"
                step="1"
                value={visceralFatIndex}
                onChange={(e) => setVisceralFatIndex(Number(e.target.value))}
                className="w-full bg-[#090D16] border border-gray-800 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-[#F59E0B]"
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Masa Ósea (kg)</label>
              <input
                type="number"
                step="0.1"
                value={boneMassKg}
                onChange={(e) => setBoneMassKg(Number(e.target.value))}
                className="w-full bg-[#090D16] border border-gray-800 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-purple-400"
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">BMR Basal (kcal)</label>
              <input
                type="number"
                step="5"
                value={bmrKcal}
                onChange={(e) => setBmrKcal(Number(e.target.value))}
                className="w-full bg-[#090D16] border border-gray-800 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-white"
              />
            </div>
          </div>

          {/* 5 Segmental Zones Inputs */}
          <div className="pt-2 border-t border-gray-800">
            <span className="text-xs font-bold text-gray-300 block mb-2">
              Datos Segmentarios (5 Zonas: Masa Muscular kg y % Grasa)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-2.5 rounded-xl bg-[#090D16] border border-gray-800 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-300">Brazo Izq.</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.01"
                    value={leftArmMuscle}
                    onChange={(e) => setLeftArmMuscle(Number(e.target.value))}
                    className="w-16 bg-[#111827] border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono text-white"
                    title="Músculo (kg)"
                  />
                  <span className="text-[10px] text-gray-400">kg</span>
                  <input
                    type="number"
                    step="0.1"
                    value={leftArmFat}
                    onChange={(e) => setLeftArmFat(Number(e.target.value))}
                    className="w-14 bg-[#111827] border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono text-[#10B981]"
                    title="% Grasa"
                  />
                  <span className="text-[10px] text-gray-400">%</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#090D16] border border-gray-800 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-300">Brazo Der.</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.01"
                    value={rightArmMuscle}
                    onChange={(e) => setRightArmMuscle(Number(e.target.value))}
                    className="w-16 bg-[#111827] border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono text-white"
                  />
                  <span className="text-[10px] text-gray-400">kg</span>
                  <input
                    type="number"
                    step="0.1"
                    value={rightArmFat}
                    onChange={(e) => setRightArmFat(Number(e.target.value))}
                    className="w-14 bg-[#111827] border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono text-[#10B981]"
                  />
                  <span className="text-[10px] text-gray-400">%</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#090D16] border border-gray-800 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-300">Pierna Izq.</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.01"
                    value={leftLegMuscle}
                    onChange={(e) => setLeftLegMuscle(Number(e.target.value))}
                    className="w-16 bg-[#111827] border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono text-white"
                  />
                  <span className="text-[10px] text-gray-400">kg</span>
                  <input
                    type="number"
                    step="0.1"
                    value={leftLegFat}
                    onChange={(e) => setLeftLegFat(Number(e.target.value))}
                    className="w-14 bg-[#111827] border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono text-[#10B981]"
                  />
                  <span className="text-[10px] text-gray-400">%</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#090D16] border border-gray-800 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-300">Pierna Der.</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.01"
                    value={rightLegMuscle}
                    onChange={(e) => setRightLegMuscle(Number(e.target.value))}
                    className="w-16 bg-[#111827] border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono text-white"
                  />
                  <span className="text-[10px] text-gray-400">kg</span>
                  <input
                    type="number"
                    step="0.1"
                    value={rightLegFat}
                    onChange={(e) => setRightLegFat(Number(e.target.value))}
                    className="w-14 bg-[#111827] border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono text-[#10B981]"
                  />
                  <span className="text-[10px] text-gray-400">%</span>
                </div>
              </div>

              <div className="sm:col-span-2 p-2.5 rounded-xl bg-[#090D16] border border-gray-800 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-300">Tronco Central</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.1"
                    value={trunkMuscle}
                    onChange={(e) => setTrunkMuscle(Number(e.target.value))}
                    className="w-20 bg-[#111827] border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono text-white"
                  />
                  <span className="text-[10px] text-gray-400">kg músculo</span>
                  <input
                    type="number"
                    step="0.1"
                    value={trunkFat}
                    onChange={(e) => setTrunkFat(Number(e.target.value))}
                    className="w-16 bg-[#111827] border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono text-[#10B981]"
                  />
                  <span className="text-[10px] text-gray-400">% grasa</span>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Charts: Historical Composition + Segmental Bar Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#111827] border border-gray-800 rounded-2xl p-4">
          <h3 className="text-sm font-bold text-white mb-1">
            Historial de Peso (kg), % Grasa y % Agua Corporal
          </h3>
          <p className="text-xs text-gray-400 mb-3">
            Tendencia de recomposición registrada por la báscula Camry 8E
          </p>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={state.camryHistory} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
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
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line
                  type="monotone"
                  dataKey="weightKg"
                  name="Peso (kg)"
                  stroke="#3B82F6"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="bodyFatPercent"
                  name="% Grasa"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="waterPercent"
                  name="% Agua"
                  stroke="#38BDF8"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#111827] border border-gray-800 rounded-2xl p-4">
          <h3 className="text-sm font-bold text-white mb-1">
            Comparativa Segmentaria de 5 Zonas (Músculo kg vs % Grasa)
          </h3>
          <p className="text-xs text-gray-400 mb-3">
            Balance muscular y adiposo por extremidad y tronco
          </p>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={segmentalChartData} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                <XAxis dataKey="zone" stroke="#9CA3AF" fontSize={11} />
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
                <Bar dataKey="MusculoKg" name="Masa Muscular (kg)" fill="#3B82F6" radius={[5, 5, 0, 0]} />
                <Bar dataKey="GrasaPct" name="% Grasa Zonal" fill="#10B981" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
