import React, { useMemo, useState } from 'react';
import {
  Award,
  Calendar,
  Download,
  Droplets,
  Dumbbell,
  Flame,
  Printer,
  Scale,
  Share2,
  TrendingDown,
  X,
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getLocalISODate } from '../services/storageService';

interface WeeklyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DaySummaryRow {
  isoDate: string;
  shortLabel: string;
  kcal: number;
  protG: number;
  carbsG: number;
  fatG: number;
  waterGlasses: number;
  watchKcal: number;
  mealsCount: number;
}

export const WeeklyReportModal: React.FC<WeeklyReportModalProps> = ({ isOpen, onClose }) => {
  const { state, getDynamicCalorieTarget } = useApp();
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const report = useMemo(() => {
    const todayIso = getLocalISODate();
    const { bmr, neatBasal, deficit } = getDynamicCalorieTarget();
    const days: DaySummaryRow[] = [];

    for (let offset = 6; offset >= 0; offset -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - offset);
      const iso = getLocalISODate(d);
      const shortLabel = d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' });

      if (iso === todayIso) {
        const kcal = state.nutrition.loggedMeals.reduce((a, m) => a + m.calories, 0);
        const protG = state.nutrition.loggedMeals.reduce((a, m) => a + m.proteinG, 0);
        const carbsG = state.nutrition.loggedMeals.reduce((a, m) => a + m.carbsG, 0);
        const fatG = state.nutrition.loggedMeals.reduce((a, m) => a + m.fatG, 0);
        days.push({
          isoDate: iso,
          shortLabel: `Hoy`,
          kcal,
          protG,
          carbsG,
          fatG,
          waterGlasses: state.nutrition.waterGlasses250ml,
          watchKcal: state.watchMetrics.activeCalories || 0,
          mealsCount: state.nutrition.loggedMeals.length,
        });
      } else {
        const entry = state.nutritionHistory?.[iso];
        const meals = entry?.loggedMeals || [];
        days.push({
          isoDate: iso,
          shortLabel,
          kcal: meals.reduce((a, m) => a + m.calories, 0),
          protG: meals.reduce((a, m) => a + m.proteinG, 0),
          carbsG: meals.reduce((a, m) => a + m.carbsG, 0),
          fatG: meals.reduce((a, m) => a + m.fatG, 0),
          waterGlasses: entry?.waterGlasses250ml ?? 0,
          watchKcal: entry?.watchActiveCalories ?? 0,
          mealsCount: meals.length,
        });
      }
    }

    const activeNutritionDays = days.filter((d) => d.kcal > 0 || d.mealsCount > 0);
    const divisor = Math.max(1, activeNutritionDays.length);
    const avgKcal = Math.round(activeNutritionDays.reduce((a, d) => a + d.kcal, 0) / divisor);
    const avgProtG = Math.round(activeNutritionDays.reduce((a, d) => a + d.protG, 0) / divisor);
    const waterDays = days.filter((d) => d.waterGlasses > 0);
    const avgWaterLiters =
      waterDays.length > 0
        ? (
            (waterDays.reduce((a, d) => a + d.waterGlasses, 0) / waterDays.length) *
            0.25
          ).toFixed(1)
        : '0.0';

    const totalWatchKcal = days.reduce((a, d) => a + d.watchKcal, 0);
    const watchDaysCount = days.filter((d) => d.watchKcal > 0).length;
    const avgWatchKcal = watchDaysCount > 0 ? Math.round(totalWatchKcal / watchDaysCount) : 0;
    const avgMetaKcal = Math.max(1500, bmr + neatBasal + avgWatchKcal - deficit);

    const firstCamry = state.camryHistory[0];
    const latestCamry = state.camryHistory[state.camryHistory.length - 1];
    const weightDelta = Math.round((latestCamry.weightKg - firstCamry.weightKg) * 10) / 10;
    const fatPctDelta =
      Math.round((latestCamry.bodyFatPercent - firstCamry.bodyFatPercent) * 10) / 10;
    const leanDelta =
      Math.round(
        ((latestCamry.leanBodyMassKg ?? 55) - (firstCamry.leanBodyMassKg ?? 55)) * 10
      ) / 10;
    const visceralDelta = latestCamry.visceralFatIndex - firstCamry.visceralFatIndex;

    const currentFatPct = latestCamry.bodyFatPercent || 33.9;
    const leanKg =
      latestCamry.leanBodyMassKg ||
      Math.round(latestCamry.weightKg * (1 - currentFatPct / 100) * 10) / 10;
    const refWeight =
      currentFatPct > 25 ? latestCamry.standardWeightKg || Math.round(leanKg * 1.18 * 10) / 10 : latestCamry.weightKg;
    const ageBonus = (state.userProfile?.age ?? 38) >= 35 ? 0.1 : 0;
    const proteinGoalG = Math.round(refWeight * (2.25 + ageBonus));
    const proteinCompliancePct =
      activeNutritionDays.length > 0
        ? Math.min(130, Math.round((avgProtG / Math.max(1, proteinGoalG)) * 100))
        : 0;

    const insanityCompleted = state.insanityCalendar.filter((d) => d.completed).length;
    const maxKcalInWeek = Math.max(avgMetaKcal, ...days.map((d) => d.kcal), 1800);
    const recentStrengthSessions = state.strengthVolumeHistory.slice(-4);
    const lastStrengthVol =
      recentStrengthSessions[recentStrengthSessions.length - 1]?.totalVolumeKg ?? 0;

    return {
      todayIso,
      days,
      loggedDaysCount: activeNutritionDays.length,
      avgKcal,
      avgMetaKcal,
      avgProtG,
      proteinGoalG,
      proteinCompliancePct,
      avgWaterLiters,
      totalWatchKcal,
      avgWatchKcal,
      latestCamry,
      weightDelta,
      fatPctDelta,
      leanDelta,
      visceralDelta,
      insanityCompleted,
      maxKcalInWeek,
      lastStrengthVol,
      strengthCount: state.strengthVolumeHistory.length,
    };
  }, [state, getDynamicCalorieTarget]);

  if (!isOpen) return null;

  const generateReportCanvasBlob = async (): Promise<Blob | null> => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, 1080, 1350);
    bg.addColorStop(0, '#050811');
    bg.addColorStop(0.5, '#091022');
    bg.addColorStop(1, '#060A14');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1080, 1350);

    // Subtle decorative glow
    ctx.fillStyle = 'rgba(16, 185, 129, 0.10)';
    ctx.beginPath();
    ctx.arc(920, 140, 260, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(6, 182, 212, 0.08)';
    ctx.beginPath();
    ctx.arc(140, 1180, 280, 0, Math.PI * 2);
    ctx.fill();

    // Header
    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText('APEX RECOMP // REPORTE EJECUTIVO SEMANAL', 72, 95);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 54px system-ui, sans-serif';
    ctx.fillText('CRISTOPHER • ESTADO BIOMÉTRICO', 72, 162);

    ctx.fillStyle = '#9CA3AF';
    ctx.font = '600 24px system-ui, sans-serif';
    const modeLabel =
      state.trainingMode === 'insanity_only'
        ? 'Modo: Solo Insanity HIIT'
        : 'Modo: Híbrido (Fuerza + Insanity)';
    ctx.fillText(`Fecha: ${report.todayIso}   •   ${modeLabel}`, 72, 206);

    const drawCard = (
      x: number,
      y: number,
      w: number,
      h: number,
      borderColor: string,
      title: string,
      value: string,
      sub: string
    ) => {
      ctx.fillStyle = '#0D1426';
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 24);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#9CA3AF';
      ctx.font = '700 21px system-ui, sans-serif';
      ctx.fillText(title.toUpperCase(), x + 28, y + 48);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 48px system-ui, sans-serif';
      ctx.fillText(value, x + 28, y + 110);

      ctx.fillStyle = '#34D399';
      ctx.font = '700 22px system-ui, sans-serif';
      ctx.fillText(sub, x + 28, y + 150);
    };

    // Row 1: 2 big cards
    drawCard(
      72,
      250,
      452,
      180,
      'rgba(16, 185, 129, 0.45)',
      'Promedio Calórico (7 días)',
      `${report.avgKcal} kcal`,
      `Meta prom.: ${report.avgMetaKcal} kcal (${report.loggedDaysCount}/7 días reg.)`
    );
    drawCard(
      556,
      250,
      452,
      180,
      'rgba(6, 182, 212, 0.45)',
      'Proteína Media Diaria',
      `${report.avgProtG} g`,
      `Meta: ${report.proteinGoalG} g (${report.proteinCompliancePct}% cumplimiento)`
    );

    // Row 2: 2 big cards
    drawCard(
      72,
      455,
      452,
      180,
      'rgba(245, 158, 11, 0.45)',
      'Campaña Insanity 63D',
      `${report.insanityCompleted}/63 días`,
      `Watch 7 (7d): ${report.totalWatchKcal.toLocaleString()} kcal activas`
    );
    drawCard(
      556,
      455,
      452,
      180,
      'rgba(168, 85, 247, 0.45)',
      'Báscula Camry 8E',
      `${report.latestCamry.weightKg} kg`,
      `Grasa: ${report.latestCamry.bodyFatPercent}% • Visceral: Nivel ${report.latestCamry.visceralFatIndex}`
    );

    // Chart Panel
    ctx.fillStyle = '#0D1426';
    ctx.strokeStyle = 'rgba(55, 65, 81, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(72, 665, 936, 430, 26);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 28px system-ui, sans-serif';
    ctx.fillText('HISTORIAL NUTRICIONAL ÚLTIMOS 7 DÍAS (KCAL / PROTEÍNA)', 106, 720);

    const chartBaseY = 1015;
    const chartHeight = 220;
    const colW = 112;
    report.days.forEach((day, idx) => {
      const cx = 116 + idx * 124;
      const barH = Math.max(8, Math.round((day.kcal / report.maxKcalInWeek) * chartHeight));
      const barY = chartBaseY - barH;

      ctx.fillStyle = day.kcal > 0 ? '#10B981' : '#1F2937';
      ctx.beginPath();
      ctx.roundRect(cx, barY, colW - 28, barH, 10);
      ctx.fill();

      ctx.fillStyle = '#E5E7EB';
      ctx.font = '700 20px system-ui, sans-serif';
      ctx.fillText(day.kcal > 0 ? `${day.kcal}` : '—', cx + 4, barY - 12);

      ctx.fillStyle = '#38BDF8';
      ctx.font = '700 19px system-ui, sans-serif';
      ctx.fillText(day.protG > 0 ? `${day.protG}gP` : '', cx + 6, chartBaseY + 28);

      ctx.fillStyle = '#9CA3AF';
      ctx.font = '600 18px system-ui, sans-serif';
      ctx.fillText(day.shortLabel.slice(0, 7), cx + 2, chartBaseY + 54);
    });

    // Footer insights
    ctx.fillStyle = '#0D1426';
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
    ctx.beginPath();
    ctx.roundRect(72, 1125, 936, 150, 24);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#10B981';
    ctx.font = '800 24px system-ui, sans-serif';
    ctx.fillText('RESUMEN CLÍNICO', 106, 1172);

    ctx.fillStyle = '#E5E7EB';
    ctx.font = '600 23px system-ui, sans-serif';
    ctx.fillText(
      `• Masa Magra actual: ${report.latestCamry.leanBodyMassKg ?? 55} kg (${report.leanDelta >= 0 ? '+' : ''}${report.leanDelta} kg desde inicio)`,
      106,
      1215
    );
    ctx.fillText(
      `• Hidratación promedio: ${report.avgWaterLiters} L/día  •  Objetivo Peso: ${state.userProfile?.targetWeightKg ?? 70} kg`,
      106,
      1250
    );

    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
  };

  const handleDownloadPng = async (tryShare = false) => {
    setExportStatus('Generando tarjeta ejecutiva PNG...');
    try {
      const blob = await generateReportCanvasBlob();
      if (!blob) {
        setExportStatus('No se pudo generar la imagen.');
        return;
      }
      const filename = `apex-reporte-semanal-${report.todayIso}.png`;
      const file = new File([blob], filename, { type: 'image/png' });

      if (tryShare && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: 'APEX RECOMP • Reporte Semanal',
          text: `Mi progreso semanal APEX RECOMP (${report.latestCamry.weightKg} kg | ${report.insanityCompleted}/63 días Insanity)`,
          files: [file],
        });
        setExportStatus('✓ Tarjeta semanal compartida.');
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setExportStatus(`✓ Descargado como ${filename}`);
      }
    } catch {
      setExportStatus('Acción cancelada o no disponible en este navegador.');
    } finally {
      window.setTimeout(() => setExportStatus(null), 4000);
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="apex-print-host fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 print:static print:block print:bg-white print:p-0">
      <div className="apex-printable-report bg-[#0B1120] border border-cyan-500/30 rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl print:max-h-none print:border-0 print:shadow-none print:bg-white print:text-black">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-[#0B1120]/95 backdrop-blur border-b border-gray-800 px-4 py-3.5 flex items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white tracking-tight">
                Reporte Ejecutivo Semanal
              </h2>
              <p className="text-[11px] text-gray-400">
                Consolidado de Nutrición, Insanity 63D, Watch 7 y Báscula Camry 8E
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          {/* Print-only header */}
          <div className="hidden print:block border-b pb-3 mb-3">
            <h1 className="text-xl font-black">APEX RECOMP • Reporte Ejecutivo Semanal</h1>
            <p className="text-xs text-gray-600">
              Atleta: Cristopher ({state.userProfile?.age ?? 38} años, {state.userProfile?.heightCm ?? 168} cm) •
              Fecha: {report.todayIso}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#070B14] border border-gray-800 rounded-2xl p-3 print:hidden">
            <span className="text-xs text-gray-300 flex items-center gap-1.5 font-medium">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              Ventana analizada: <strong className="text-white">Últimos 7 días ({report.loggedDaysCount} con registro)</strong>
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleDownloadPng(true)}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#10B981] to-cyan-500 text-gray-950 font-extrabold text-xs flex items-center gap-1.5 transition hover:opacity-95"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Compartir Tarjeta PNG</span>
              </button>
              <button
                type="button"
                onClick={() => handleDownloadPng(false)}
                className="px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs flex items-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5 text-[#10B981]" />
                <span>Descargar PNG</span>
              </button>
              <button
                type="button"
                onClick={handlePrintPdf}
                className="px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs flex items-center gap-1.5 transition"
              >
                <Printer className="w-3.5 h-3.5 text-cyan-400" />
                <span>PDF / Imprimir</span>
              </button>
            </div>
          </div>

          {exportStatus && (
            <div className="p-2.5 rounded-xl bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] text-xs font-bold print:hidden">
              {exportStatus}
            </div>
          )}

          {/* KPI Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#070B14] border border-emerald-500/30 rounded-2xl p-3.5 print:border-gray-300 print:bg-gray-50">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-emerald-400 font-bold">
                <Flame className="w-3.5 h-3.5" />
                Promedio Ingesta
              </div>
              <p className="text-xl font-black text-white mt-1 font-mono print:text-black">
                {report.avgKcal} <span className="text-xs font-normal text-gray-400">kcal</span>
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">Meta prom: {report.avgMetaKcal} kcal</p>
            </div>

            <div className="bg-[#070B14] border border-cyan-500/30 rounded-2xl p-3.5 print:border-gray-300 print:bg-gray-50">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-cyan-400 font-bold">
                <Dumbbell className="w-3.5 h-3.5" />
                Proteína Media
              </div>
              <p className="text-xl font-black text-white mt-1 font-mono print:text-black">
                {report.avgProtG} <span className="text-xs font-normal text-gray-400">g/día</span>
              </p>
              <p className="text-[11px] text-cyan-300 mt-0.5 print:text-cyan-700">
                {report.proteinCompliancePct}% de {report.proteinGoalG} g
              </p>
            </div>

            <div className="bg-[#070B14] border border-amber-500/30 rounded-2xl p-3.5 print:border-gray-300 print:bg-gray-50">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-amber-400 font-bold">
                <Zap className="w-3.5 h-3.5" />
                Campaña Insanity
              </div>
              <p className="text-xl font-black text-white mt-1 font-mono print:text-black">
                {report.insanityCompleted}/63
              </p>
              <p className="text-[11px] text-amber-300 mt-0.5 print:text-amber-700">
                Watch 7d: {report.totalWatchKcal.toLocaleString()} kcal
              </p>
            </div>

            <div className="bg-[#070B14] border border-blue-500/30 rounded-2xl p-3.5 print:border-gray-300 print:bg-gray-50">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-blue-400 font-bold">
                <Droplets className="w-3.5 h-3.5" />
                Hidratación
              </div>
              <p className="text-xl font-black text-white mt-1 font-mono print:text-black">
                {report.avgWaterLiters} <span className="text-xs font-normal text-gray-400">L/día</span>
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">Meta clínica: 3.5 L/día</p>
            </div>
          </div>

          {/* 7-Day Visual Bar Breakdown */}
          <div className="bg-[#070B14] border border-gray-800 rounded-2xl p-4 space-y-3 print:border-gray-300 print:bg-white">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-xs font-mono font-extrabold uppercase tracking-wider text-white print:text-black">
                Consumo Diario Últimos 7 Días (Calorías y Proteína)
              </h3>
              <span className="text-[11px] text-gray-400">
                Referencia meta promedio: {report.avgMetaKcal} kcal
              </span>
            </div>

            <div className="grid grid-cols-7 gap-2 items-end h-40 pt-4">
              {report.days.map((d) => {
                const heightPct = Math.min(
                  100,
                  Math.max(8, Math.round((d.kcal / report.maxKcalInWeek) * 100))
                );
                const onTarget = d.kcal >= 1500 && d.kcal <= report.avgMetaKcal + 150;
                return (
                  <div key={d.isoDate} className="flex flex-col items-center h-full justify-end gap-1">
                    <span className="text-[10px] font-mono font-bold text-gray-300 print:text-black">
                      {d.kcal > 0 ? d.kcal : '—'}
                    </span>
                    <div className="w-full max-w-[38px] flex-1 bg-gray-900 rounded-xl flex items-end overflow-hidden border border-gray-800 print:bg-gray-200 print:border-gray-300">
                      <div
                        className={`w-full rounded-t-lg transition-all ${
                          d.kcal === 0
                            ? 'bg-gray-800 print:bg-gray-300'
                            : onTarget
                            ? 'bg-gradient-to-t from-emerald-600 to-emerald-400'
                            : d.kcal < 1500
                            ? 'bg-amber-500/80'
                            : 'bg-rose-500/80'
                        }`}
                        style={{ height: `${d.kcal > 0 ? heightPct : 6}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-cyan-400 font-bold print:text-cyan-700">
                      {d.protG > 0 ? `${d.protG}g` : ''}
                    </span>
                    <span className="text-[10px] text-gray-400 capitalize truncate max-w-full">
                      {d.shortLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Biometrics Deltas + Training Volume */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-[#070B14] border border-gray-800 rounded-2xl p-4 space-y-2.5 print:border-gray-300 print:bg-gray-50">
              <h3 className="text-xs font-mono font-extrabold uppercase tracking-wider text-purple-300 flex items-center gap-1.5 print:text-purple-700">
                <Scale className="w-4 h-4" />
                Evolución Báscula Camry 8E
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-[#0B1120] border border-gray-800 print:bg-white print:border-gray-200">
                  <span className="text-[10px] text-gray-400 block">Peso Actual</span>
                  <strong className="text-white text-sm print:text-black">
                    {report.latestCamry.weightKg} kg
                  </strong>
                  <span className="text-[10px] text-emerald-400 block">
                    Delta: {report.weightDelta > 0 ? `+${report.weightDelta}` : report.weightDelta} kg
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#0B1120] border border-gray-800 print:bg-white print:border-gray-200">
                  <span className="text-[10px] text-gray-400 block">% Grasa Corporal</span>
                  <strong className="text-[#F59E0B] text-sm">{report.latestCamry.bodyFatPercent}%</strong>
                  <span className="text-[10px] text-cyan-400 block">
                    Delta: {report.fatPctDelta > 0 ? `+${report.fatPctDelta}` : report.fatPctDelta}%
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#0B1120] border border-gray-800 print:bg-white print:border-gray-200">
                  <span className="text-[10px] text-gray-400 block">Masa Magra (LBM)</span>
                  <strong className="text-[#10B981] text-sm">
                    {report.latestCamry.leanBodyMassKg ?? 55} kg
                  </strong>
                  <span className="text-[10px] text-gray-300 block print:text-gray-600">
                    {report.leanDelta >= 0 ? `+${report.leanDelta}` : report.leanDelta} kg
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#0B1120] border border-gray-800 print:bg-white print:border-gray-200">
                  <span className="text-[10px] text-gray-400 block">Grasa Visceral</span>
                  <strong className="text-rose-400 text-sm">
                    Nivel {report.latestCamry.visceralFatIndex}
                  </strong>
                  <span className="text-[10px] text-gray-300 block print:text-gray-600">
                    {report.visceralDelta <= 0 ? `${report.visceralDelta}` : `+${report.visceralDelta}`} niveles (Meta ≤9)
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-[#070B14] border border-gray-800 rounded-2xl p-4 space-y-2.5 print:border-gray-300 print:bg-gray-50">
              <h3 className="text-xs font-mono font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 print:text-emerald-700">
                <TrendingDown className="w-4 h-4" />
                Estado del Plan y Entrenamiento
              </h3>
              <ul className="space-y-2 text-xs text-gray-300 print:text-gray-800">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">•</span>
                  <span>
                    <strong>Modo actual:</strong>{' '}
                    {state.trainingMode === 'insanity_only'
                      ? '⚡ Solo Insanity HIIT (Fuerza en pausa temporal)'
                      : '🏋️ Híbrido (Fuerza Torso/Pierna + Insanity)'}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 font-bold">•</span>
                  <span>
                    <strong>Sesiones de Fuerza registradas:</strong> {report.strengthCount} históricas
                    {report.lastStrengthVol > 0
                      ? ` (último volumen: ${report.lastStrengthVol.toLocaleString()} kg)`
                      : ''}
                    .
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">•</span>
                  <span>
                    <strong>Foco clínico actual:</strong> proteger masa magra con{' '}
                    {report.proteinGoalG} g proteína/día y llevar grasa visceral de Nivel{' '}
                    {report.latestCamry.visceralFatIndex} → ≤9.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
