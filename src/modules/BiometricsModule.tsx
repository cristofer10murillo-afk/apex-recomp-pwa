import React, { useRef, useState } from 'react';
import {
  Activity,
  Bluetooth,
  Bone,
  CircleCheck,
  CirclePlus,
  ClipboardPaste,
  Droplets,
  FileText,
  Flame,
  Scale,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Target,
  TriangleAlert,
  Upload,
  UserCheck,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApp } from '../context/AppContext';
import {
  calculateEstimatedCamryRecord,
  connectCamryScale,
  parseMovingLifeFile,
  parseMovingLifeText,
} from '../services/smartSyncService';
import { CamryBiometricRecord } from '../types/fitness';

export const BiometricsModule: React.FC = () => {
  const { state, addCamryRecord, getAsymmetryAnalysis } = useApp();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const latest = state.camryHistory[state.camryHistory.length - 1];
  const first = state.camryHistory[0];

  const [weightKg, setWeightKg] = useState(latest.weightKg);
  const [bodyFatPercent, setBodyFatPercent] = useState(latest.bodyFatPercent);
  const [waterPercent, setWaterPercent] = useState(latest.waterPercent);
  const [visceralFatIndex, setVisceralFatIndex] = useState(latest.visceralFatIndex);
  const [boneMassKg, setBoneMassKg] = useState(latest.boneMassKg);
  const [bmrKcal, setBmrKcal] = useState(latest.bmrKcal);
  const [leanBodyMassKg, setLeanBodyMassKg] = useState(latest.leanBodyMassKg ?? 55);
  const [subcutaneousFatKg, setSubcutaneousFatKg] = useState(latest.subcutaneousFatKg ?? 24.9);
  const [skeletalMusclePercent, setSkeletalMusclePercent] = useState(
    latest.skeletalMusclePercent ?? 37.2
  );
  const [proteinPercent] = useState(latest.proteinPercent ?? 13.1);
  const [healthScore] = useState(latest.healthScore ?? 63);

  const [leftArmMuscle, setLeftArmMuscle] = useState(latest.segments.leftArm.muscleKg);
  const [leftArmFatKg, setLeftArmFatKg] = useState(
    latest.segments.leftArm.fatKg ?? latest.segments.leftArm.fatPercent
  );
  const [rightArmMuscle, setRightArmMuscle] = useState(latest.segments.rightArm.muscleKg);
  const [rightArmFatKg, setRightArmFatKg] = useState(
    latest.segments.rightArm.fatKg ?? latest.segments.rightArm.fatPercent
  );
  const [trunkMuscle, setTrunkMuscle] = useState(latest.segments.trunk.muscleKg);
  const [trunkFatKg, setTrunkFatKg] = useState(
    latest.segments.trunk.fatKg ?? latest.segments.trunk.fatPercent
  );
  const [leftLegMuscle, setLeftLegMuscle] = useState(latest.segments.leftLeg.muscleKg);
  const [leftLegFatKg, setLeftLegFatKg] = useState(
    latest.segments.leftLeg.fatKg ?? latest.segments.leftLeg.fatPercent
  );
  const [rightLegMuscle, setRightLegMuscle] = useState(latest.segments.rightLeg.muscleKg);
  const [rightLegFatKg, setRightLegFatKg] = useState(
    latest.segments.rightLeg.fatKg ?? latest.segments.rightLeg.fatPercent
  );

  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteReportText, setPasteReportText] = useState('');
  const [isBleConnecting, setIsBleConnecting] = useState(false);
  const [ocrProgressMsg, setOcrProgressMsg] = useState<string | null>(null);
  const [previewImgUrl, setPreviewImgUrl] = useState<string | null>(null);

  const syncFormFieldsFromRecord = (rec: CamryBiometricRecord) => {
    setWeightKg(rec.weightKg);
    setBodyFatPercent(rec.bodyFatPercent);
    setWaterPercent(rec.waterPercent);
    setVisceralFatIndex(rec.visceralFatIndex);
    setBoneMassKg(rec.boneMassKg);
    setBmrKcal(rec.bmrKcal);
    if (rec.leanBodyMassKg !== undefined) setLeanBodyMassKg(rec.leanBodyMassKg);
    if (rec.subcutaneousFatKg !== undefined) setSubcutaneousFatKg(rec.subcutaneousFatKg);
    if (rec.skeletalMusclePercent !== undefined) setSkeletalMusclePercent(rec.skeletalMusclePercent);

    setLeftArmMuscle(rec.segments.leftArm.muscleKg);
    setLeftArmFatKg(rec.segments.leftArm.fatKg ?? rec.segments.leftArm.fatPercent);
    setRightArmMuscle(rec.segments.rightArm.muscleKg);
    setRightArmFatKg(rec.segments.rightArm.fatKg ?? rec.segments.rightArm.fatPercent);
    setTrunkMuscle(rec.segments.trunk.muscleKg);
    setTrunkFatKg(rec.segments.trunk.fatKg ?? rec.segments.trunk.fatPercent);
    setLeftLegMuscle(rec.segments.leftLeg.muscleKg);
    setLeftLegFatKg(rec.segments.leftLeg.fatKg ?? rec.segments.leftLeg.fatPercent);
    setRightLegMuscle(rec.segments.rightLeg.muscleKg);
    setRightLegFatKg(rec.segments.rightLeg.fatKg ?? rec.segments.rightLeg.fatPercent);
  };

  const showToast = (msg: string) => {
    setStatusBanner(msg);
    window.setTimeout(() => setStatusBanner(null), 5000);
  };

  const handleAutoCalculate8E = () => {
    const rec = calculateEstimatedCamryRecord(weightKg, bodyFatPercent, latest);
    syncFormFieldsFromRecord(rec);
    addCamryRecord(rec);
    showToast(
      `✓ Auto-Cálculo MovingLife 8E completado (${rec.weightKg} kg, ${rec.bodyFatPercent}% grasa, IMB ${rec.bmrKcal} kcal, Masa Magra ${rec.leanBodyMassKg} kg) y sincronizado en Firebase.`
    );
  };

  const handleBleConnect = async () => {
    setIsBleConnecting(true);
    try {
      const rec = await connectCamryScale(latest);
      syncFormFieldsFromRecord(rec);
      addCamryRecord(rec);
      showToast(`✓ Peso recibido por Bluetooth BLE (${rec.weightKg} kg) y 5 zonas actualizadas.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al conectar por Bluetooth BLE.');
    } finally {
      setIsBleConnecting(false);
    }
  };

  const handleProcessPastedText = () => {
    if (!pasteReportText.trim()) return;
    const rec = parseMovingLifeText(pasteReportText, latest);
    syncFormFieldsFromRecord(rec);
    addCamryRecord(rec);
    setPasteReportText('');
    setShowPasteModal(false);
    showToast(
      `✓ Informe MovingLife procesado (${rec.weightKg} kg, ${rec.bodyFatPercent}% grasa, IMB ${rec.bmrKcal} kcal) y sincronizado en Firebase.`
    );
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrProgressMsg('Abriendo archivo de reporte MovingLife...');
    try {
      const { record, previewUrl } = await parseMovingLifeFile(file, latest, (msg) =>
        setOcrProgressMsg(msg)
      );
      if (previewUrl) setPreviewImgUrl(previewUrl);
      syncFormFieldsFromRecord(record);
      addCamryRecord(record);
      showToast(
        `✓ Archivo MovingLife "${file.name}" importado (${record.weightKg} kg, ${record.bodyFatPercent}% grasa, IMB ${record.bmrKcal} kcal) y guardado en Firebase.`
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'No se pudo procesar el archivo de MovingLife.'
      );
    } finally {
      setOcrProgressMsg(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveManualReport = (e: React.FormEvent) => {
    e.preventDefault();
    const baseEst = calculateEstimatedCamryRecord(weightKg, bodyFatPercent, latest);
    const fullRecord: Omit<CamryBiometricRecord, 'id'> = {
      ...baseEst,
      weightKg,
      bodyFatPercent,
      waterPercent,
      visceralFatIndex,
      boneMassKg,
      bmrKcal,
      leanBodyMassKg,
      subcutaneousFatKg,
      skeletalMusclePercent,
      proteinPercent,
      healthScore,
      segments: {
        leftArm: { ...baseEst.segments.leftArm, muscleKg: leftArmMuscle, fatKg: leftArmFatKg },
        rightArm: { ...baseEst.segments.rightArm, muscleKg: rightArmMuscle, fatKg: rightArmFatKg },
        trunk: { ...baseEst.segments.trunk, muscleKg: trunkMuscle, fatKg: trunkFatKg },
        leftLeg: { ...baseEst.segments.leftLeg, muscleKg: leftLegMuscle, fatKg: leftLegFatKg },
        rightLeg: { ...baseEst.segments.rightLeg, muscleKg: rightLegMuscle, fatKg: rightLegFatKg },
      },
    };
    addCamryRecord(fullRecord);
    showToast('✓ Informe clínico MovingLife de 8 electrodos guardado y sincronizado en Firebase.');
  };

  const asymmetries = getAsymmetryAnalysis();
  const zonesChartData = [
    {
      zone: 'Brazo Izq',
      MusculoKg: latest.segments.leftArm.muscleKg,
      GrasaKg: latest.segments.leftArm.fatKg ?? 1.8,
      EquilibrioPct: latest.segments.leftArm.muscleRatioPct ?? 105.7,
    },
    {
      zone: 'Brazo Der',
      MusculoKg: latest.segments.rightArm.muscleKg,
      GrasaKg: latest.segments.rightArm.fatKg ?? 1.8,
      EquilibrioPct: latest.segments.rightArm.muscleRatioPct ?? 103.5,
    },
    {
      zone: 'Tronco',
      MusculoKg: latest.segments.trunk.muscleKg,
      GrasaKg: latest.segments.trunk.fatKg ?? 15.2,
      EquilibrioPct: latest.segments.trunk.muscleRatioPct ?? 97.1,
    },
    {
      zone: 'Pierna Izq',
      MusculoKg: latest.segments.leftLeg.muscleKg,
      GrasaKg: latest.segments.leftLeg.fatKg ?? 3.5,
      EquilibrioPct: latest.segments.leftLeg.muscleRatioPct ?? 87.7,
    },
    {
      zone: 'Pierna Der',
      MusculoKg: latest.segments.rightLeg.muscleKg,
      GrasaKg: latest.segments.rightLeg.fatKg ?? 3.7,
      EquilibrioPct: latest.segments.rightLeg.muscleRatioPct ?? 88.9,
    },
  ];

  const weightDelta = Math.round((latest.weightKg - first.weightKg) * 10) / 10;
  const fatDelta = Math.round((latest.bodyFatPercent - first.bodyFatPercent) * 10) / 10;

  return (
    <div className="space-y-5 pb-8">
      <div className="bg-[#111827] border border-gray-800 rounded-2xl p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-[#3B82F6]/15 text-[#3B82F6]">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-extrabold text-white">
                  INFORME DE ANÁLISIS DE COMPOSICIÓN CORPORAL (MOVINGLIFE 8E)
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30">
                  Puntuación de Salud: {latest.healthScore ?? 63}/100
                </span>
              </div>
              <p className="text-xs text-gray-400 flex items-center gap-2 flex-wrap mt-0.5">
                <span className="inline-flex items-center gap-1 text-gray-200 font-semibold">
                  <UserCheck className="w-3.5 h-3.5 text-[#10B981]" />
                  Usuario: {latest.userName || 'cristopher'}
                </span>
                <span>• Altura: {latest.heightCm || 168} cm</span>
                <span>• Género: {latest.gender || 'Hombre'}</span>
                <span>• Fecha: {latest.timestampLabel || latest.date}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start">
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#3B82F6]/15 text-[#3B82F6]">
              Δ Progreso: {weightDelta} kg / {fatDelta}% grasa
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div className="bg-[#090D16] border border-gray-800 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                <Scale className="w-3.5 h-3.5 text-[#3B82F6]" />
                Peso (kg)
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#F59E0B]/20 text-[#F59E0B]">
                {latest.weightKg > (latest.standardWeightKg || 71.4) ? 'Sobrepeso' : 'Normal'}
              </span>
            </div>
            <span className="text-lg font-mono font-extrabold text-white mt-1 block">
              {latest.weightKg} kg
            </span>
            <span className="text-[10px] text-gray-500">Normal: 53.8 ~ 71.4</span>
          </div>

          <div className="bg-[#090D16] border border-gray-800 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-[#F59E0B]" />
                Grasa (%)
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#F59E0B]/20 text-[#F59E0B]">
                {latest.bodyFatMassKg ?? 28.3} kg
              </span>
            </div>
            <span className="text-lg font-mono font-extrabold text-[#F59E0B] mt-1 block">
              {latest.bodyFatPercent}%
            </span>
            <span className="text-[10px] text-gray-500">Normal: 10.0 ~ 20.0%</span>
          </div>

          <div className="bg-[#090D16] border border-gray-800 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-[#10B981]" />
                IMB Basal
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#10B981]/20 text-[#10B981]">
                Katch-McArdle
              </span>
            </div>
            <span className="text-lg font-mono font-extrabold text-[#10B981] mt-1 block">
              {latest.bmrKcal} kcal
            </span>
            <span className="text-[10px] text-gray-500">
              Masa magra: {latest.leanBodyMassKg ?? 55} kg
            </span>
          </div>

          <div className="bg-[#090D16] border border-gray-800 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                <Droplets className="w-3.5 h-3.5 text-sky-400" />
                Agua (%)
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400">
                {latest.waterPercent < 54.1 ? 'Bajo' : 'Normal'}
              </span>
            </div>
            <span className="text-lg font-mono font-extrabold text-sky-400 mt-1 block">
              {latest.waterPercent}%
            </span>
            <span className="text-[10px] text-gray-500">Normal: 54.1 ~ 68.6%</span>
          </div>

          <div className="bg-[#090D16] border border-gray-800 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                Visceral
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400">
                {latest.visceralFatIndex > 9 ? 'Alto' : 'Normal'}
              </span>
            </div>
            <span className="text-lg font-mono font-extrabold text-rose-400 mt-1 block">
              Nivel {latest.visceralFatIndex}
            </span>
            <span className="text-[10px] text-gray-500">Normal: 1 ~ 9</span>
          </div>

          <div className="bg-[#090D16] border border-gray-800 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                <Bone className="w-3.5 h-3.5 text-purple-400" />
                Músc. Esq.
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
                SMI {latest.smi ?? 8.5}
              </span>
            </div>
            <span className="text-lg font-mono font-extrabold text-purple-400 mt-1 block">
              {latest.skeletalMusclePercent ?? 37.2}%
            </span>
            <span className="text-[10px] text-gray-500">
              Muscular: {latest.musclePercent ?? 61.5}%
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-1">
          <div className="bg-[#090D16]/90 border border-gray-800/80 rounded-xl p-2 text-center">
            <span className="text-[10px] text-gray-400 block">Peso Estándar</span>
            <span className="text-xs font-mono font-bold text-white">
              {latest.standardWeightKg ?? 64.8} kg
            </span>
          </div>
          <div className="bg-[#090D16]/90 border border-gray-800/80 rounded-xl p-2 text-center">
            <span className="text-[10px] text-gray-400 block">Control Grasa</span>
            <span className="text-xs font-mono font-bold text-[#F59E0B]">
              {latest.fatControlKg ?? -18.5} kg
            </span>
          </div>
          <div className="bg-[#090D16]/90 border border-gray-800/80 rounded-xl p-2 text-center">
            <span className="text-[10px] text-gray-400 block">Masa Magra</span>
            <span className="text-xs font-mono font-bold text-[#10B981]">
              {latest.leanBodyMassKg ?? 55} kg
            </span>
          </div>
          <div className="bg-[#090D16]/90 border border-gray-800/80 rounded-xl p-2 text-center">
            <span className="text-[10px] text-gray-400 block">Grasa Subcutánea</span>
            <span className="text-xs font-mono font-bold text-white">
              {latest.subcutaneousFatKg ?? 24.9} kg
            </span>
          </div>
          <div className="bg-[#090D16]/90 border border-gray-800/80 rounded-xl p-2 text-center">
            <span className="text-[10px] text-gray-400 block">IMC</span>
            <span className="text-xs font-mono font-bold text-white">{latest.bmi ?? 29.5}</span>
          </div>
          <div className="bg-[#090D16]/90 border border-gray-800/80 rounded-xl p-2 text-center">
            <span className="text-[10px] text-gray-400 block">Proteínas (%)</span>
            <span className="text-xs font-mono font-bold text-[#3B82F6]">
              {latest.proteinPercent ?? 13.1}%
            </span>
          </div>
          <div className="bg-[#090D16]/90 border border-gray-800/80 rounded-xl p-2 text-center">
            <span className="text-[10px] text-gray-400 block">Sal Inorgánica</span>
            <span className="text-xs font-mono font-bold text-purple-300">
              {latest.inorganicSaltPercent ?? 4.5}% ({latest.boneMassKg}kg)
            </span>
          </div>
          <div className="bg-[#090D16]/90 border border-gray-800/80 rounded-xl p-2 text-center">
            <span className="text-[10px] text-gray-400 block">Forma Cuerpo</span>
            <span className="text-xs font-bold text-[#F59E0B]">{latest.bodyType ?? 'Rellenito'}</span>
          </div>
        </div>
      </div>

      <div className="bg-[#111827] border border-gray-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Target className="w-4 h-4 text-[#F59E0B]" />
            Diagnóstico de Equilibrio Muscular y Asimetrías (MovingLife 8E)
          </h3>
          <span className="text-[11px] text-gray-400">Estándar Tronco/Piernas: 90% ~ 110%</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {asymmetries.map((item) => (
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
                    <TriangleAlert className="w-4 h-4" />
                  ) : (
                    <CircleCheck className="w-4 h-4" />
                  )}
                  {item.limb}: Izq {item.leftKg} kg vs Der {item.rightKg} kg
                </span>
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${
                    item.hasAlert ? 'bg-[#F59E0B]/20 text-[#F59E0B]' : 'bg-[#10B981]/20 text-[#10B981]'
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 bg-[#111827] border border-gray-800 rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">
              Equilibrio Muscular y Grasa Segmentaria (5 Zonas)
            </h3>
            <p className="text-xs text-gray-400">
              Datos exactos del reporte MovingLife (Masa Muscular kg + % Estándar y Masa Grasa kg)
            </p>
          </div>

          <div className="relative my-4 py-2 flex flex-col items-center">
            <div className="grid grid-cols-3 gap-2 w-full items-center">
              <div className="space-y-4">
                <div className="p-2.5 rounded-xl border bg-[#090D16] border-gray-800 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-[#3B82F6]">Brazo Izq (L)</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#10B981]/20 text-[#10B981] font-bold">
                      {latest.segments.leftArm.muscleStatus || 'Estándar'}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-extrabold text-white block mt-0.5">
                    {latest.segments.leftArm.muscleKg} kg (
                    {latest.segments.leftArm.muscleRatioPct ?? 105.7}%)
                  </span>
                  <span className="text-[11px] font-mono text-[#F59E0B] block">
                    Grasa: {latest.segments.leftArm.fatKg ?? 1.8} kg (
                    {latest.segments.leftArm.fatRatioPct ?? 259.1}%)
                  </span>
                </div>

                <div className="p-2.5 rounded-xl border bg-[#090D16] border-[#F59E0B]/50 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-[#3B82F6]">Pierna Izq (L)</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#F59E0B]/20 text-[#F59E0B] font-bold">
                      {latest.segments.leftLeg.muscleStatus || 'Bajo'}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-extrabold text-white block mt-0.5">
                    {latest.segments.leftLeg.muscleKg} kg (
                    {latest.segments.leftLeg.muscleRatioPct ?? 87.7}%)
                  </span>
                  <span className="text-[11px] font-mono text-[#F59E0B] block">
                    Grasa: {latest.segments.leftLeg.fatKg ?? 3.5} kg (
                    {latest.segments.leftLeg.fatRatioPct ?? 191.3}%)
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
                    fill="#10B981"
                    fillOpacity="0.25"
                    stroke="#10B981"
                    strokeWidth="2"
                  />
                  <rect
                    x="86"
                    y="46"
                    width="18"
                    height="68"
                    rx="8"
                    fill="#10B981"
                    fillOpacity="0.25"
                    stroke="#10B981"
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
                    stroke="#F59E0B"
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
                    stroke="#F59E0B"
                    strokeWidth="2"
                  />
                  <circle cx="25" cy="110" r="3.5" fill="#F59E0B" />
                  <circle cx="95" cy="110" r="3.5" fill="#F59E0B" />
                  <circle cx="47" cy="216" r="3.5" fill="#F59E0B" />
                  <circle cx="72" cy="216" r="3.5" fill="#F59E0B" />
                </svg>

                <div className="p-2.5 rounded-xl bg-[#090D16] border border-[#10B981]/40 text-center w-full mt-2">
                  <span className="text-[10px] font-bold uppercase text-[#10B981] block">
                    Tronco ({latest.segments.trunk.muscleStatus || 'Estándar'})
                  </span>
                  <span className="text-xs font-mono font-extrabold text-white block">
                    Músc: {latest.segments.trunk.muscleKg} kg (
                    {latest.segments.trunk.muscleRatioPct ?? 97.1}%)
                  </span>
                  <span className="text-[11px] font-mono text-[#F59E0B]">
                    Grasa: {latest.segments.trunk.fatKg ?? 15.2} kg (
                    {latest.segments.trunk.fatRatioPct ?? 252.6}%)
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-2.5 rounded-xl border bg-[#090D16] border-gray-800 text-right">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#10B981]/20 text-[#10B981] font-bold">
                      {latest.segments.rightArm.muscleStatus || 'Estándar'}
                    </span>
                    <span className="text-[10px] font-bold uppercase text-[#3B82F6]">Brazo Der (R)</span>
                  </div>
                  <span className="text-xs font-mono font-extrabold text-white block mt-0.5">
                    {latest.segments.rightArm.muscleKg} kg (
                    {latest.segments.rightArm.muscleRatioPct ?? 103.5}%)
                  </span>
                  <span className="text-[11px] font-mono text-[#F59E0B] block">
                    Grasa: {latest.segments.rightArm.fatKg ?? 1.8} kg (
                    {latest.segments.rightArm.fatRatioPct ?? 259.6}%)
                  </span>
                </div>

                <div className="p-2.5 rounded-xl border bg-[#090D16] border-[#F59E0B]/50 text-right">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#F59E0B]/20 text-[#F59E0B] font-bold">
                      {latest.segments.rightLeg.muscleStatus || 'Bajo'}
                    </span>
                    <span className="text-[10px] font-bold uppercase text-[#3B82F6]">Pierna Der (R)</span>
                  </div>
                  <span className="text-xs font-mono font-extrabold text-white block mt-0.5">
                    {latest.segments.rightLeg.muscleKg} kg (
                    {latest.segments.rightLeg.muscleRatioPct ?? 88.9}%)
                  </span>
                  <span className="text-[11px] font-mono text-[#F59E0B] block">
                    Grasa: {latest.segments.rightLeg.fatKg ?? 3.7} kg (
                    {latest.segments.rightLeg.fatRatioPct ?? 198.2}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-gray-400 text-center border-t border-gray-800 pt-2">
            Brazos y Tronco en rango <strong className="text-[#10B981]">Estándar</strong> • Piernas en
            rango <strong className="text-[#F59E0B]">Bajo (&lt;90%)</strong>
          </div>
        </div>

        <form
          onSubmit={handleSaveManualReport}
          className="lg:col-span-7 bg-[#111827] border border-gray-800 rounded-2xl p-4 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CirclePlus className="w-4 h-4 text-[#10B981]" />
                Importador de Reporte MovingLife (Imagen / Texto / Auto-8E)
              </h3>
              <p className="text-xs text-gray-400">
                Sube directamente la imagen/archivo que genera MovingLife o actualiza Peso + % Grasa
              </p>
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-gray-950 font-bold text-xs transition self-start"
            >
              Guardar en Firebase
            </button>
          </div>

          <div className="bg-[#090D16] border border-[#3B82F6]/40 rounded-xl p-3 space-y-2.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.txt,.csv,.json"
              onChange={handleFileImport}
              className="hidden"
            />
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-[11px] font-bold text-gray-200 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-[#10B981]" />
                Importar Informe de Composición Corporal MovingLife:
              </span>
              <div className="flex items-center flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={Boolean(ocrProgressMsg)}
                  className="px-3 py-1.5 rounded-lg bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-white font-extrabold text-[11px] flex items-center gap-1.5 transition shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{ocrProgressMsg ? 'Escaneando...' : '📂 Subir Imagen/Archivo MovingLife'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleAutoCalculate8E}
                  className="px-2.5 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#10B981]/90 text-gray-950 font-extrabold text-[11px] flex items-center gap-1 transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>⚡ Auto-Calcular 8E</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPasteModal(!showPasteModal)}
                  className="px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold text-[11px] flex items-center gap-1 transition"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span>Pegar Texto Reporte</span>
                </button>
                <button
                  type="button"
                  onClick={handleBleConnect}
                  disabled={isBleConnecting}
                  className="px-2.5 py-1.5 rounded-lg bg-[#3B82F6]/20 hover:bg-[#3B82F6]/30 text-[#3B82F6] font-bold text-[11px] flex items-center gap-1 transition"
                >
                  <Bluetooth className="w-3.5 h-3.5" />
                  <span>{isBleConnecting ? 'BLE...' : 'BLE'}</span>
                </button>
              </div>
            </div>

            {ocrProgressMsg && (
              <div className="p-2.5 rounded-lg bg-[#3B82F6]/15 border border-[#3B82F6]/40 text-[#3B82F6] text-xs font-bold flex items-center gap-2">
                <FileText className="w-4 h-4 animate-pulse" />
                <span>{ocrProgressMsg}</span>
              </div>
            )}

            {previewImgUrl && (
              <div className="flex items-center justify-between gap-3 p-2 rounded-lg bg-[#111827] border border-gray-800">
                <div className="flex items-center gap-2.5">
                  <img
                    src={previewImgUrl}
                    alt="Informe MovingLife"
                    className="w-10 h-14 object-cover rounded border border-gray-700"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-[#10B981] block">
                      ✓ Imagen de Informe MovingLife Procesada
                    </span>
                    <span className="text-[11px] text-gray-400">
                      Datos sincronizados con tu perfil de 168.0 cm
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewImgUrl(null)}
                  className="text-[11px] text-gray-400 hover:text-white px-2 py-1"
                >
                  Ocultar
                </button>
              </div>
            )}

            {showPasteModal && (
              <div className="pt-2 border-t border-gray-800 space-y-2">
                <p className="text-[11px] text-gray-300">
                  Abre la imagen del reporte de <em>MovingLife</em> en la Galería de tu S23 Ultra, toca{' '}
                  <strong className="text-[#10B981]">&quot;T&quot; (Extraer texto)</strong> y pégalo completo
                  aquí:
                </p>
                <div className="flex gap-2">
                  <textarea
                    rows={2}
                    value={pasteReportText}
                    onChange={(e) => setPasteReportText(e.target.value)}
                    placeholder="Pega aquí el texto del Informe de análisis de composición corporal (Peso(kg) 83.3, Grasa corporal(%) 33.9, IMB(kcal) 1558, Masa magra(kg) 55.0...)"
                    className="flex-1 bg-[#111827] border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={handleProcessPastedText}
                    className="px-3 py-1.5 rounded-lg bg-[#10B981] text-gray-950 font-bold text-xs shrink-0 self-center"
                  >
                    Procesar
                  </button>
                </div>
              </div>
            )}
          </div>

          {statusBanner && (
            <div className="p-2.5 rounded-xl bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] text-xs font-bold">
              {statusBanner}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="text-[11px] text-[#3B82F6] font-bold block mb-1">1. Peso (kg) *</label>
              <input
                type="number"
                step="0.1"
                value={weightKg}
                onChange={(e) => setWeightKg(Number(e.target.value))}
                className="w-full bg-[#090D16] border border-[#3B82F6]/50 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-[#F59E0B] font-bold block mb-1">
                2. Grasa Corporal (%) *
              </label>
              <input
                type="number"
                step="0.1"
                value={bodyFatPercent}
                onChange={(e) => setBodyFatPercent(Number(e.target.value))}
                className="w-full bg-[#090D16] border border-[#F59E0B]/50 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-[#F59E0B]"
              />
            </div>
            <div>
              <label className="text-[11px] text-[#10B981] font-bold block mb-1">
                IMB Basal (kcal)
              </label>
              <input
                type="number"
                step="1"
                value={bmrKcal}
                onChange={(e) => setBmrKcal(Number(e.target.value))}
                className="w-full bg-[#090D16] border border-gray-800 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-[#10B981]"
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Masa Magra (kg)</label>
              <input
                type="number"
                step="0.1"
                value={leanBodyMassKg}
                onChange={(e) => setLeanBodyMassKg(Number(e.target.value))}
                className="w-full bg-[#090D16] border border-gray-800 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Agua (%)</label>
              <input
                type="number"
                step="0.1"
                value={waterPercent}
                onChange={(e) => setWaterPercent(Number(e.target.value))}
                className="w-full bg-[#090D16] border border-gray-800 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-sky-400"
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Grasa Visceral</label>
              <input
                type="number"
                step="1"
                value={visceralFatIndex}
                onChange={(e) => setVisceralFatIndex(Number(e.target.value))}
                className="w-full bg-[#090D16] border border-gray-800 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-rose-400"
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Músc. Esquelético (%)</label>
              <input
                type="number"
                step="0.1"
                value={skeletalMusclePercent}
                onChange={(e) => setSkeletalMusclePercent(Number(e.target.value))}
                className="w-full bg-[#090D16] border border-gray-800 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-purple-400"
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Grasa Subcutánea (kg)</label>
              <input
                type="number"
                step="0.1"
                value={subcutaneousFatKg}
                onChange={(e) => setSubcutaneousFatKg(Number(e.target.value))}
                className="w-full bg-[#090D16] border border-gray-800 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-gray-200"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-gray-800">
            <span className="text-xs font-bold text-gray-300 block mb-2">
              5 Zonas Segmentarias MovingLife (Equilibrio Muscular kg y Grasa Segmentaria kg)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-2.5 rounded-xl bg-[#090D16] border border-gray-800 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-300">Brazo Izq (L)</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.01"
                    value={leftArmMuscle}
                    onChange={(e) => setLeftArmMuscle(Number(e.target.value))}
                    className="w-16 bg-[#111827] border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono text-white"
                    title="Equilibrio Muscular (kg)"
                  />
                  <span className="text-[10px] text-gray-400">kg M</span>
                  <input
                    type="number"
                    step="0.1"
                    value={leftArmFatKg}
                    onChange={(e) => setLeftArmFatKg(Number(e.target.value))}
                    className="w-14 bg-[#111827] border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono text-[#F59E0B]"
                    title="Grasa Segmentaria (kg)"
                  />
                  <span className="text-[10px] text-gray-400">kg G</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#090D16] border border-gray-800 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-300">Brazo Der (R)</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.01"
                    value={rightArmMuscle}
                    onChange={(e) => setRightArmMuscle(Number(e.target.value))}
                    className="w-16 bg-[#111827] border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono text-white"
                  />
                  <span className="text-[10px] text-gray-400">kg M</span>
                  <input
                    type="number"
                    step="0.1"
                    value={rightArmFatKg}
                    onChange={(e) => setRightArmFatKg(Number(e.target.value))}
                    className="w-14 bg-[#111827] border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono text-[#F59E0B]"
                  />
                  <span className="text-[10px] text-gray-400">kg G</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#090D16] border border-gray-800 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-300">Pierna Izq (L)</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.01"
                    value={leftLegMuscle}
                    onChange={(e) => setLeftLegMuscle(Number(e.target.value))}
                    className="w-16 bg-[#111827] border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono text-white"
                  />
                  <span className="text-[10px] text-gray-400">kg M</span>
                  <input
                    type="number"
                    step="0.1"
                    value={leftLegFatKg}
                    onChange={(e) => setLeftLegFatKg(Number(e.target.value))}
                    className="w-14 bg-[#111827] border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono text-[#F59E0B]"
                  />
                  <span className="text-[10px] text-gray-400">kg G</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#090D16] border border-gray-800 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-300">Pierna Der (R)</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.01"
                    value={rightLegMuscle}
                    onChange={(e) => setRightLegMuscle(Number(e.target.value))}
                    className="w-16 bg-[#111827] border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono text-white"
                  />
                  <span className="text-[10px] text-gray-400">kg M</span>
                  <input
                    type="number"
                    step="0.1"
                    value={rightLegFatKg}
                    onChange={(e) => setRightLegFatKg(Number(e.target.value))}
                    className="w-14 bg-[#111827] border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono text-[#F59E0B]"
                  />
                  <span className="text-[10px] text-gray-400">kg G</span>
                </div>
              </div>

              <div className="sm:col-span-2 p-2.5 rounded-xl bg-[#090D16] border border-gray-800 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-300">Tronco Central</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.01"
                    value={trunkMuscle}
                    onChange={(e) => setTrunkMuscle(Number(e.target.value))}
                    className="w-20 bg-[#111827] border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono text-white"
                  />
                  <span className="text-[10px] text-gray-400">kg músculo</span>
                  <input
                    type="number"
                    step="0.1"
                    value={trunkFatKg}
                    onChange={(e) => setTrunkFatKg(Number(e.target.value))}
                    className="w-16 bg-[#111827] border border-gray-700 rounded-lg px-2 py-1 text-xs font-mono text-[#F59E0B]"
                  />
                  <span className="text-[10px] text-gray-400">kg grasa</span>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#111827] border border-gray-800 rounded-2xl p-4">
          <h3 className="text-sm font-bold text-white mb-1">
            Evolución de Peso (kg), % Grasa y % Agua (MovingLife)
          </h3>
          <p className="text-xs text-gray-400 mb-3">
            Meta de Control de Peso MovingLife: alcanzar {latest.standardWeightKg ?? 64.8} kg (
            {latest.weightControlKg ?? -18.5} kg)
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
                  stroke="#F59E0B"
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
            Equilibrio Muscular (kg) vs Grasa Segmentaria (kg) por Zona
          </h3>
          <p className="text-xs text-gray-400 mb-3">
            Comparativa de las 5 zonas medidas por los 8 electrodos
          </p>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zonesChartData} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
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
                <Bar
                  dataKey="MusculoKg"
                  name="Equilibrio Muscular (kg)"
                  fill="#3B82F6"
                  radius={[5, 5, 0, 0]}
                />
                <Bar
                  dataKey="GrasaKg"
                  name="Grasa Segmentaria (kg)"
                  fill="#F59E0B"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
