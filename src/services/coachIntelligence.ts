import { INITIAL_APP_STATE } from '../data/seedData';
import { AppState, DailyNutritionHistoryEntry } from '../types/fitness';
import { getLocalISODate } from './storageService';

export type ReadinessLevel = 'optimo' | 'moderado' | 'precaucion';
export type NutritionTrafficLightStatus =
  | 'en_zona'
  | 'proteina_baja'
  | 'bajo_calorias'
  | 'superavit';

export interface CamryTrendAlert {
  hasComparison: boolean;
  triggeredLbmDrop: boolean;
  deltaWeightKg: number;
  deltaLeanKg: number;
  deltaFatPct: number;
  deltaVisceral: number;
  message: string;
}

export interface ReadinessAssessment {
  score: number;
  level: ReadinessLevel;
  label: string;
  yesterdaySessionLabel: string;
  yesterdayKcalBurned: number;
  yesterdayProteinPct: number | null;
  lbmTrend: CamryTrendAlert;
  recommendedFocus: 'hybrid' | 'insanity_only' | 'recovery';
  headline: string;
  reasons: string[];
}

export interface NutritionTrafficLight {
  status: NutritionTrafficLightStatus;
  badge: string;
  title: string;
  advice: string;
  remainingProteinG: number;
  remainingKcal: number;
}

export interface CoachBriefingSnapshot {
  readiness: ReadinessAssessment;
  greetingTitle: string;
  trainingDirective: string;
  alternatingAdvice: string;
  trafficLight: NutritionTrafficLight;
}

function getYesterdayIso(): string {
  const now = new Date();
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  return getLocalISODate(y);
}

function summarizeDaySessionLabel(
  entry: DailyNutritionHistoryEntry | undefined,
  insanityDoneYesterday: boolean
): string {
  const hadStrength = Boolean(entry?.completedStrengthRoutineId);
  const hadInsanity = Boolean(entry?.completedInsanityDay) || insanityDoneYesterday;

  if (hadStrength && hadInsanity) return 'Doble Impacto (Pesas + Insanity)';
  if (hadStrength) return 'Solo Fuerza (Pesas)';
  if (hadInsanity) return 'Solo Insanity HIIT';
  if (entry?.trainingMode === 'hybrid' && (entry?.watchActiveCalories || 0) >= 650) {
    return 'Sesión Alta Carga (Watch 7)';
  }
  if ((entry?.watchActiveCalories || 0) >= 350) {
    return 'Actividad Cardiovascular / HIIT';
  }
  if (entry && entry.loggedMeals.length > 0) {
    return 'Recuperación / Día Liviano';
  }
  return 'Sin entreno registrado ayer';
}

export function analyzeCamryTrend(state: AppState): CamryTrendAlert {
  const history = state.camryHistory || INITIAL_APP_STATE.camryHistory;
  const latest = history[history.length - 1] || INITIAL_APP_STATE.camryHistory[0];
  const prev = history.length >= 2 ? history[history.length - 2] : undefined;

  if (!prev) {
    return {
      hasComparison: false,
      triggeredLbmDrop: false,
      deltaWeightKg: 0,
      deltaLeanKg: 0,
      deltaFatPct: 0,
      deltaVisceral: 0,
      message: `Base clínica: ${latest.weightKg} kg • ${latest.bodyFatPercent}% grasa • LBM ${
        latest.leanBodyMassKg ?? 55
      } kg • Visceral Nivel ${latest.visceralFatIndex}.`,
    };
  }

  const latestLbm =
    latest.leanBodyMassKg ??
    Math.round(latest.weightKg * (1 - latest.bodyFatPercent / 100) * 10) / 10;
  const prevLbm =
    prev.leanBodyMassKg ?? Math.round(prev.weightKg * (1 - prev.bodyFatPercent / 100) * 10) / 10;

  const deltaWeightKg = Math.round((latest.weightKg - prev.weightKg) * 10) / 10;
  const deltaLeanKg = Math.round((latestLbm - prevLbm) * 10) / 10;
  const deltaFatPct = Math.round((latest.bodyFatPercent - prev.bodyFatPercent) * 10) / 10;
  const deltaVisceral = latest.visceralFatIndex - prev.visceralFatIndex;

  const triggeredLbmDrop = deltaLeanKg <= -0.4;

  let message = '';
  if (triggeredLbmDrop) {
    message = `⚠️ Alerta Clínica: Tu Masa Magra (LBM) bajó ${Math.abs(
      deltaLeanKg
    )} kg (${prevLbm}→${latestLbm} kg). Prioriza alcanzar tu tope proteico hoy, mantén mínimo 1,500–1,700 kcal y evita recortar comida los días de doble carga.`;
  } else if (deltaVisceral < 0 || deltaFatPct < 0) {
    message = `✓ Tendencia positiva Camry: Grasa ${
      deltaFatPct <= 0 ? `${deltaFatPct}%` : `+${deltaFatPct}%`
    } • LBM ${deltaLeanKg >= 0 ? `+${deltaLeanKg}` : deltaLeanKg} kg • Visceral Nivel ${
      latest.visceralFatIndex
    } (${deltaVisceral <= 0 ? deltaVisceral : `+${deltaVisceral}`}).`;
  } else {
    message = `Camry actual vs anterior: ${
      deltaWeightKg >= 0 ? `+${deltaWeightKg}` : deltaWeightKg
    } kg peso • LBM ${deltaLeanKg >= 0 ? `+${deltaLeanKg}` : deltaLeanKg} kg • Visceral Nivel ${
      latest.visceralFatIndex
    }.`;
  }

  return {
    hasComparison: true,
    triggeredLbmDrop,
    deltaWeightKg,
    deltaLeanKg,
    deltaFatPct,
    deltaVisceral,
    message,
  };
}

export function computeCoachIntelligence(
  state: AppState,
  targetCalories: number,
  consumedCalories: number,
  targetProteinG: number,
  consumedProteinG: number
): CoachBriefingSnapshot {
  const yesterdayIso = getYesterdayIso();
  const yEntry = state.nutritionHistory?.[yesterdayIso];
  const insanityDoneYesterday = state.insanityCalendar.some(
    (d) => d.completed && d.completedDate === yesterdayIso
  );

  const yesterdaySessionLabel = summarizeDaySessionLabel(yEntry, insanityDoneYesterday);
  const yesterdayWatchKcal = yEntry?.watchActiveCalories || 0;
  const yesterdayProtG = yEntry
    ? yEntry.loggedMeals.reduce((acc, m) => acc + m.proteinG, 0)
    : null;
  const yesterdayProteinPct =
    yesterdayProtG !== null && targetProteinG > 0
      ? Math.round((yesterdayProtG / targetProteinG) * 100)
      : null;

  const sleepScore = state.watchMetrics.sleepScore || 0;
  const sleepHours = state.watchMetrics.sleepHours || 0;
  const waterGlasses = state.nutrition.waterGlasses250ml || 0;
  const insanityDay =
    state.insanityCalendar.find((d) => d.dayNumber === state.currentInsanityDay) ||
    state.insanityCalendar[0];
  const isInsanityOnly = state.trainingMode === 'insanity_only';
  const todayRoutine = state.routines.find((r) => r.weekdayIndex === state.selectedWeekdayIndex);
  const latestCamry = state.camryHistory[state.camryHistory.length - 1];
  const currentLeanKg =
    latestCamry?.leanBodyMassKg ||
    Math.round(
      (latestCamry?.weightKg ?? 83.3) * (1 - (latestCamry?.bodyFatPercent ?? 33.9) / 100) * 10
    ) / 10;
  const lbmTrend = analyzeCamryTrend(state);

  // Readiness Score calculation (starts at 78 neutral baseline, adjusts with verified telemetry)
  let score = 78;
  const reasons: string[] = [];

  if (sleepScore > 0) {
    if (sleepScore >= 82) {
      score += 12;
      reasons.push(`Sueño Watch 7 sólido (${sleepScore}/100): SNC recuperado para alta intensidad.`);
    } else if (sleepScore >= 68) {
      score += 4;
      reasons.push(`Sueño Watch 7 aceptable (${sleepScore}/100, ${sleepHours}h).`);
    } else {
      score -= 16;
      reasons.push(
        `Sueño bajo (${sleepScore}/100): evita fallos musculares extremos y controla aterrizajes en Insanity.`
      );
    }
  } else {
    reasons.push('Tip: registra o sube captura de sueño Watch 7 para afinar tu fatiga nerviosa.');
  }

  const wasYesterdayDouble =
    Boolean(yEntry?.completedStrengthRoutineId) &&
    (Boolean(yEntry?.completedInsanityDay) || insanityDoneYesterday);

  if (wasYesterdayDouble || yesterdayWatchKcal >= 850) {
    score -= 12;
    reasons.push(
      `Carga alta ayer (${yesterdaySessionLabel}${
        yesterdayWatchKcal ? ` • ${yesterdayWatchKcal} kcal Watch` : ''
      }): prioriza recuperación muscular y carbohidrato limpio pre-entreno.`
    );
  } else if (yesterdaySessionLabel !== 'Sin entreno registrado ayer') {
    score += 3;
    reasons.push(`Sesión de ayer (${yesterdaySessionLabel}) en carga sostenible.`);
  }

  if (yesterdayProteinPct !== null) {
    if (yesterdayProteinPct >= 88) {
      score += 6;
      reasons.push(`Proteína de ayer cumplida (${yesterdayProteinPct}% de meta): buena síntesis proteica.`);
    } else if (yesterdayProteinPct < 70 && yesterdayProteinPct > 0) {
      score -= 8;
      reasons.push(
        `Ayer proteína quedó al ${yesterdayProteinPct}%: hoy sé estricto con tus ${targetProteinG} g para blindar músculo.`
      );
    }
  }

  if (lbmTrend.triggeredLbmDrop) {
    score -= 10;
    reasons.push(lbmTrend.message);
  } else if (lbmTrend.hasComparison && lbmTrend.deltaVisceral < 0) {
    score += 4;
  }

  if (waterGlasses >= 10) {
    score += 4;
  }

  score = Math.max(25, Math.min(99, Math.round(score)));

  const level: ReadinessLevel =
    score >= 80 ? 'optimo' : score >= 60 ? 'moderado' : 'precaucion';
  const label = level === 'optimo' ? 'Óptimo' : level === 'moderado' ? 'Moderado' : 'Precaución';

  let recommendedFocus: 'hybrid' | 'insanity_only' | 'recovery' = isInsanityOnly
    ? 'insanity_only'
    : 'hybrid';
  if (insanityDay.isRestDay && !todayRoutine) {
    recommendedFocus = 'recovery';
  } else if (level === 'precaucion' && !isInsanityOnly) {
    recommendedFocus = 'insanity_only';
  }

  const headline =
    level === 'optimo'
      ? isInsanityOnly
        ? 'Luz verde para atacar Insanity HIIT con máxima potencia y técnica.'
        : 'Listo para rendimiento óptimo en Fuerza + Insanity (si tu horario lo permite).'
      : level === 'moderado'
      ? 'Carga moderada: ejecuta tu bloque principal sin ir al fallo límite en todas las series.'
      : 'Fatiga acumulada detectada: prioriza solo 1 bloque (Insanity o Fuerza técnica), sueño e hidratación.';

  const hour = new Date().getHours();
  const greetingTitle =
    hour < 12
      ? 'Briefing Matutino del Entrenador'
      : hour < 19
      ? 'Directiva Táctica de Entreno y Macros'
      : 'Cierre Metabólico y Guardián Nocturno';

  let trainingDirective = '';
  if (insanityDay.isRestDay && (isInsanityOnly || !todayRoutine)) {
    trainingDirective =
      'Hoy toca Recuperación Activa: caminata ligera 8,000+ pasos, movilidad de cadera/tobillos y 3.5 L agua para llegar al 100% mañana.';
  } else if (isInsanityOnly) {
    trainingDirective = `Foco 100% Insanity Día ${insanityDay.dayNumber}/63 (${insanityDay.workoutTitle}, ${insanityDay.durationMin} min). Mantén el torso firme en saltos para cuidar rodillas; tu bloque de Fuerza sigue pausado a salvo.`;
  } else if (todayRoutine) {
    trainingDirective = `Día Híbrido (${todayRoutine.title} + Insanity ${insanityDay.workoutTitle}): haz Pesas primero si buscas fuerza/hipertrofia en piernas/torso y deja ≥4h antes del HIIT (o pausa Fuerza si te sientes sobrecargado).`;
  } else {
    trainingDirective = `Día sin rutina de pesas programada: ejecuta Insanity ${insanityDay.workoutTitle} (${insanityDay.durationMin} min) y trabajo ligero de postura/core.`;
  }

  const alternatingAdvice =
    wasYesterdayDouble && isInsanityOnly
      ? 'Venir de Doble Sesión ayer a Solo Insanity hoy es una excelente descarga inteligente: el balance calórico sigue protegido por tu gasto del Watch 7.'
      : !isInsanityOnly && yesterdaySessionLabel === 'Solo Insanity HIIT'
      ? 'Alternar días de Solo Insanity con días con Pesas funciona excelente: el sistema recalcula tus calorías según lo que realmente quemes hoy en el Watch.'
      : 'Puedes alternar libremente entre Solo Insanity e Híbrido según tu energía diaria; el déficit y tu proteína se adaptan al instante.';

  // Evening / Dynamic Nutrition Traffic Light
  const remainingKcal = targetCalories - consumedCalories;
  const remainingProteinG = Math.max(0, targetProteinG - consumedProteinG);

  let tlStatus: NutritionTrafficLightStatus = 'en_zona';
  let tlBadge = '🟢 EN ZONA RECOMP';
  let tlTitle = 'Balance calórico y proteico bien encaminado';
  let tlAdvice = `Te quedan ${Math.max(
    0,
    remainingKcal
  )} kcal y ${remainingProteinG} g de proteína para cerrar el día dentro del déficit ideal (-${
    state.userProfile?.dailyDeficitKcal ?? 300
  } kcal).`;

  if (remainingKcal < -180) {
    tlStatus = 'superavit';
    tlBadge = '🟠 EXCEDENTE HOY';
    tlTitle = `Excediste la meta por ${Math.abs(remainingKcal)} kcal`;
    tlAdvice =
      'Cierra cocina con agua o té sin calorías. No ayunes agresivo mañana: simplemente agrega +2,500 pasos o mantén tu déficit estándar.';
  } else if (hour >= 19 && consumedCalories > 0 && consumedCalories < 1350 && remainingKcal > 450) {
    tlStatus = 'bajo_calorias';
    tlBadge = '🔵 PISO METABÓLICO';
    tlTitle = `Llevas ${consumedCalories} kcal y ya es de noche`;
    tlAdvice = `Evita dormir muy por debajo de tu piso seguro (1,500 kcal): mete una cena ligera de ${Math.min(
      remainingKcal,
      450
    )} kcal rica en proteína (${Math.min(remainingProteinG, 45)}g) + vegetales.`;
  } else if (consumedCalories > 0 && remainingProteinG >= 45 && (remainingKcal <= 450 || hour >= 20)) {
    tlStatus = 'proteina_baja';
    tlBadge = '🟡 PROTEÍNA PRIORITARIA';
    tlTitle = `Faltan ${remainingProteinG} g de proteína con ${Math.max(0, remainingKcal)} kcal restantes`;
    tlAdvice = `Para blindar tus ${currentLeanKg} kg de masa magra sin pasarte de calorías, prioriza proteína magra limpia (ej. 1.5–2 scoops de whey en agua, 200 g pechuga/atún al agua o claras de huevo).`;
  }

  return {
    readiness: {
      score,
      level,
      label,
      yesterdaySessionLabel,
      yesterdayKcalBurned: yesterdayWatchKcal,
      yesterdayProteinPct,
      lbmTrend,
      recommendedFocus,
      headline,
      reasons,
    },
    greetingTitle,
    trainingDirective,
    alternatingAdvice,
    trafficLight: {
      status: tlStatus,
      badge: tlBadge,
      title: tlTitle,
      advice: tlAdvice,
      remainingProteinG,
      remainingKcal,
    },
  };
}
