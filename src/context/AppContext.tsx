import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  AppState,
  CamryBiometricRecord,
  FitTestExerciseKey,
  GalaxyWatchMetrics,
  NutritionLogItem,
  QuickMealPreset,
  RoutineDayKey,
  StrengthExercise,
} from '../types/fitness';
import { INITIAL_APP_STATE } from '../data/seedData';
import {
  loadAppStateSync,
  loadFromFirestoreCloud,
  loadFromIndexedDB,
  saveAppState,
  syncToFirestoreCloud,
} from '../services/storageService';

export interface RestTimerState {
  isActive: boolean;
  isFinishedAlert: boolean;
  totalSeconds: number;
  remainingSeconds: number;
  exerciseName: string;
  categoryLabel: string;
}

export interface DoubleProgressionStatus {
  achieved: boolean;
  badgeText: string;
  subText: string;
  type: 'fixed_25kg' | 'scalable';
}

export interface AsymmetryAlert {
  limb: 'Brazos' | 'Piernas';
  leftKg: number;
  rightKg: number;
  diffPercent: number;
  weakerSide: 'Izquierdo' | 'Derecho';
  hasAlert: boolean;
  prescription: string;
}

interface AppContextValue {
  state: AppState;
  restTimer: RestTimerState;
  startRestTimer: (seconds: number, exerciseName: string, categoryLabel: string) => void;
  adjustRestTimer: (deltaSeconds: number) => void;
  stopRestTimer: () => void;
  setSelectedWeekday: (weekdayIdx: number) => void;
  setCurrentInsanityDay: (dayNumber: number) => void;
  updateWatchMetrics: (metrics: Partial<GalaxyWatchMetrics>) => void;
  toggleExerciseSet: (routineId: RoutineDayKey, exerciseId: string, setNumber: number) => void;
  updateExerciseSetValues: (
    routineId: RoutineDayKey,
    exerciseId: string,
    setNumber: number,
    field: 'weightKg' | 'reps' | 'platesCount',
    value: number
  ) => void;
  saveWorkoutSessionVolume: (routineId: RoutineDayKey) => void;
  toggleInsanityDayCompleted: (dayNumber: number) => void;
  updateFitTestResult: (testNumber: 1 | 2 | 3 | 4 | 5, exerciseKey: FitTestExerciseKey, value: number) => void;
  addCamryRecord: (record: Omit<CamryBiometricRecord, 'id'>) => void;
  QuickAddMeal: (preset: QuickMealPreset) => void;
  addCustomMeal: (meal: Omit<NutritionLogItem, 'id' | 'time'>) => void;
  removeLoggedMeal: (id: string) => void;
  updateWaterGlasses: (delta: number) => void;
  replaceFullState: (newState: AppState) => void;
  resetToFactorySeed: () => void;
  updateFirebaseConfig: (cfg: AppState['firebaseConfig']) => void;
  evaluateDoubleProgression: (exercise: StrengthExercise) => DoubleProgressionStatus;
  getAsymmetryAnalysis: () => AsymmetryAlert[];
  getDynamicCalorieTarget: () => {
    bmr: number;
    activeCalories: number;
    deficit: number;
    targetCalories: number;
    consumedCalories: number;
    remainingCalories: number;
  };
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

function playCompletionBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const frequencies = [880, 1108.73, 1318.51];
    frequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.14);
      gain.gain.setValueAtTime(0.18, ctx.currentTime + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.14 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.14);
      osc.stop(ctx.currentTime + idx * 0.14 + 0.26);
    });
  } catch {
    // Ignore audio errors if blocked by browser policy
  }
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(() => loadAppStateSync());

  const [restTimer, setRestTimer] = useState<RestTimerState>({
    isActive: false,
    isFinishedAlert: false,
    totalSeconds: 90,
    remainingSeconds: 0,
    exerciseName: '',
    categoryLabel: '',
  });

  // Hydrate from Cloud Firestore or IndexedDB on startup
  useEffect(() => {
    let mounted = true;
    loadFromFirestoreCloud()
      .then((cloudState) => {
        if (mounted && cloudState && cloudState.routines?.length) {
          setState(cloudState);
          return;
        }
        // If Firestore doesn't have the document yet, seed it now
        void syncToFirestoreCloud(state);
      })
      .catch(() => {
        loadFromIndexedDB().then((idbState) => {
          if (mounted && idbState && idbState.routines?.length) {
            setState((prev) => {
              if (localStorage.getItem('apex_recomp_pwa_state_v1')) return prev;
              return idbState;
            });
          }
        });
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Persist every state change to localStorage & IndexedDB
  useEffect(() => {
    saveAppState(state);
  }, [state]);

  // Countdown interval for Rest Timer
  useEffect(() => {
    if (!restTimer.isActive) return;

    const timer = window.setInterval(() => {
      setRestTimer((prev) => {
        if (!prev.isActive) return prev;
        if (prev.remainingSeconds <= 1) {
          playCompletionBeep();
          return {
            ...prev,
            isActive: false,
            isFinishedAlert: true,
            remainingSeconds: 0,
          };
        }
        return {
          ...prev,
          remainingSeconds: prev.remainingSeconds - 1,
        };
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [restTimer.isActive]);

  const startRestTimer = useCallback((seconds: number, exerciseName: string, categoryLabel: string) => {
    setRestTimer({
      isActive: true,
      isFinishedAlert: false,
      totalSeconds: seconds,
      remainingSeconds: seconds,
      exerciseName,
      categoryLabel,
    });
  }, []);

  const adjustRestTimer = useCallback((deltaSeconds: number) => {
    setRestTimer((prev) => {
      const nextRemaining = Math.max(0, prev.remainingSeconds + deltaSeconds);
      const nextTotal = Math.max(prev.totalSeconds, nextRemaining);
      return {
        ...prev,
        isActive: nextRemaining > 0,
        isFinishedAlert: nextRemaining === 0,
        totalSeconds: nextTotal,
        remainingSeconds: nextRemaining,
      };
    });
  }, []);

  const stopRestTimer = useCallback(() => {
    setRestTimer((prev) => ({
      ...prev,
      isActive: false,
      isFinishedAlert: false,
      remainingSeconds: 0,
    }));
  }, []);

  const setSelectedWeekday = (weekdayIdx: number) => {
    setState((prev) => ({ ...prev, selectedWeekdayIndex: weekdayIdx }));
  };

  const setCurrentInsanityDay = (dayNumber: number) => {
    setState((prev) => ({ ...prev, currentInsanityDay: Math.min(63, Math.max(1, dayNumber)) }));
  };

  const updateWatchMetrics = (metrics: Partial<GalaxyWatchMetrics>) => {
    setState((prev) => ({
      ...prev,
      watchMetrics: {
        ...prev.watchMetrics,
        ...metrics,
      },
    }));
  };

  const toggleExerciseSet = (routineId: RoutineDayKey, exerciseId: string, setNumber: number) => {
    let triggeredExercise: StrengthExercise | null = null;
    let newlyCompleted = false;

    setState((prev) => {
      const nextRoutines = prev.routines.map((routine) => {
        if (routine.id !== routineId) return routine;
        return {
          ...routine,
          exercises: routine.exercises.map((ex) => {
            if (ex.id !== exerciseId) return ex;
            const nextSets = ex.sets.map((s) => {
              if (s.setNumber !== setNumber) return s;
              newlyCompleted = !s.completed;
              return { ...s, completed: newlyCompleted };
            });
            triggeredExercise = { ...ex, sets: nextSets };
            return triggeredExercise;
          }),
        };
      });
      return { ...prev, routines: nextRoutines };
    });

    if (newlyCompleted && triggeredExercise) {
      const ex = triggeredExercise as StrengthExercise;
      startRestTimer(ex.restSeconds, ex.name, ex.restCategoryLabel);
    }
  };

  const updateExerciseSetValues = (
    routineId: RoutineDayKey,
    exerciseId: string,
    setNumber: number,
    field: 'weightKg' | 'reps' | 'platesCount',
    value: number
  ) => {
    const cleanValue = Number.isNaN(value) ? 0 : Math.max(0, value);
    setState((prev) => ({
      ...prev,
      routines: prev.routines.map((routine) => {
        if (routine.id !== routineId) return routine;
        return {
          ...routine,
          exercises: routine.exercises.map((ex) => {
            if (ex.id !== exerciseId) return ex;
            return {
              ...ex,
              sets: ex.sets.map((s) => {
                if (s.setNumber !== setNumber) return s;
                if (field === 'platesCount') {
                  // Forza Gym: 1 plate ≈ 4.5 kg
                  return {
                    ...s,
                    platesCount: cleanValue,
                    weightKg: Math.round(cleanValue * 4.5 * 10) / 10,
                  };
                }
                return { ...s, [field]: cleanValue };
              }),
            };
          }),
        };
      }),
    }));
  };

  const saveWorkoutSessionVolume = (routineId: RoutineDayKey) => {
    setState((prev) => {
      const routine = prev.routines.find((r) => r.id === routineId);
      if (!routine) return prev;

      let totalVol = 0;
      let completedSetsCount = 0;
      routine.exercises.forEach((ex) => {
        ex.sets.forEach((s) => {
          if (s.completed) {
            totalVol += s.weightKg * s.reps;
            completedSetsCount += 1;
          }
        });
      });

      if (totalVol === 0) {
        // Calculate planned volume if user clicks save before checking all boxes
        routine.exercises.forEach((ex) => {
          ex.sets.forEach((s) => {
            totalVol += s.weightKg * s.reps;
            completedSetsCount += 1;
          });
        });
      }

      const todayLabel = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
      const newEntry = {
        date: todayLabel,
        routineId,
        routineLabel: routine.title.split('(')[0].trim(),
        totalVolumeKg: Math.round(totalVol),
        completedSets: completedSetsCount,
      };

      return {
        ...prev,
        strengthVolumeHistory: [...prev.strengthVolumeHistory.slice(-9), newEntry],
      };
    });
  };

  const toggleInsanityDayCompleted = (dayNumber: number) => {
    setState((prev) => ({
      ...prev,
      insanityCalendar: prev.insanityCalendar.map((d) =>
        d.dayNumber === dayNumber
          ? {
              ...d,
              completed: !d.completed,
              completedDate: !d.completed ? new Date().toISOString().slice(0, 10) : undefined,
              avgHr: !d.completed ? prev.watchMetrics.avgHeartRate : undefined,
              caloriesBurned: !d.completed ? Math.round(d.durationMin * 11.5) : undefined,
            }
          : d
      ),
    }));
  };

  const updateFitTestResult = (
    testNumber: 1 | 2 | 3 | 4 | 5,
    exerciseKey: FitTestExerciseKey,
    value: number
  ) => {
    const cleanVal = Number.isNaN(value) ? 0 : Math.max(0, Math.round(value));
    setState((prev) => ({
      ...prev,
      fitTests: prev.fitTests.map((t) =>
        t.testNumber === testNumber
          ? {
              ...t,
              completed: true,
              results: {
                ...t.results,
                [exerciseKey]: cleanVal,
              },
            }
          : t
      ),
    }));
  };

  const addCamryRecord = (record: Omit<CamryBiometricRecord, 'id'>) => {
    const newRecord: CamryBiometricRecord = {
      ...record,
      id: `camry-${Date.now()}`,
    };
    setState((prev) => ({
      ...prev,
      camryHistory: [...prev.camryHistory, newRecord],
    }));
  };

  const QuickAddMeal = (preset: QuickMealPreset) => {
    const nowTime = new Date().toTimeString().slice(0, 5);
    const item: NutritionLogItem = {
      id: `meal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: preset.name,
      time: nowTime,
      calories: preset.calories,
      proteinG: preset.proteinG,
      carbsG: preset.carbsG,
      fatG: preset.fatG,
      tag: preset.tag,
    };
    setState((prev) => ({
      ...prev,
      nutrition: {
        ...prev.nutrition,
        loggedMeals: [item, ...prev.nutrition.loggedMeals],
      },
    }));
  };

  const addCustomMeal = (meal: Omit<NutritionLogItem, 'id' | 'time'>) => {
    const nowTime = new Date().toTimeString().slice(0, 5);
    const item: NutritionLogItem = {
      ...meal,
      id: `meal-${Date.now()}`,
      time: nowTime,
    };
    setState((prev) => ({
      ...prev,
      nutrition: {
        ...prev.nutrition,
        loggedMeals: [item, ...prev.nutrition.loggedMeals],
      },
    }));
  };

  const removeLoggedMeal = (id: string) => {
    setState((prev) => ({
      ...prev,
      nutrition: {
        ...prev.nutrition,
        loggedMeals: prev.nutrition.loggedMeals.filter((m) => m.id !== id),
      },
    }));
  };

  const updateWaterGlasses = (delta: number) => {
    setState((prev) => ({
      ...prev,
      nutrition: {
        ...prev.nutrition,
        waterGlasses250ml: Math.max(0, prev.nutrition.waterGlasses250ml + delta),
      },
    }));
  };

  const replaceFullState = (newState: AppState) => {
    setState(newState);
  };

  const resetToFactorySeed = () => {
    setState(INITIAL_APP_STATE);
  };

  const updateFirebaseConfig = (cfg: AppState['firebaseConfig']) => {
    setState((prev) => ({
      ...prev,
      firebaseConfig: cfg,
    }));
  };

  const evaluateDoubleProgression = (exercise: StrengthExercise): DoubleProgressionStatus => {
    const allHitMax =
      exercise.sets.length > 0 && exercise.sets.every((s) => s.reps >= exercise.maxReps);

    if (exercise.loadType === 'fixed_25kg') {
      return {
        achieved: allHitMax,
        type: 'fixed_25kg',
        badgeText: allHitMax
          ? '🔥 Subir meta de repeticiones o reducir descanso'
          : `Meta Doble Progresión: ${exercise.targetSets}x${exercise.maxReps} reps con 25kg`,
        subText: allHitMax
          ? `Rango superior (${exercise.maxReps} reps) dominado con mancuernas fijas de 25 kg. Incrementa el techo a ${
              exercise.maxReps + 3
            } reps, añade tempo 3-1-1 o reduce el descanso en 15-30s.`
          : 'Completa todas las series en el límite superior de repeticiones antes de modificar densidad.',
      };
    }

    const equipmentHint =
      exercise.loadType === 'forza_plates'
        ? '🔥 Subir +1 Placa/Bloque en Forza Gym (+4.5 kg)'
        : '🔥 Subir Discos en Mancuernas Ajustables (+2 kg)';

    return {
      achieved: allHitMax,
      type: 'scalable',
      badgeText: allHitMax
        ? equipmentHint
        : `Progresión activa: alcanzar ${exercise.targetSets}x${exercise.maxReps} reps`,
      subText: allHitMax
        ? `Has completado todas las series de ${exercise.maxReps} reps. En la próxima sesión incrementa carga y reinicia en ${exercise.minReps} reps.`
        : 'Mantén la carga actual hasta completar el tope del rango en todas las series.',
    };
  };

  const getAsymmetryAnalysis = (): AsymmetryAlert[] => {
    const latest = state.camryHistory[state.camryHistory.length - 1] || INITIAL_APP_STATE.camryHistory[0];
    const { leftArm, rightArm, leftLeg, rightLeg } = latest.segments;

    const armMax = Math.max(leftArm.muscleKg, rightArm.muscleKg, 0.1);
    const armDiffPct = (Math.abs(leftArm.muscleKg - rightArm.muscleKg) / armMax) * 100;
    const armWeaker: 'Izquierdo' | 'Derecho' = leftArm.muscleKg < rightArm.muscleKg ? 'Izquierdo' : 'Derecho';

    const legMax = Math.max(leftLeg.muscleKg, rightLeg.muscleKg, 0.1);
    const legDiffPct = (Math.abs(leftLeg.muscleKg - rightLeg.muscleKg) / legMax) * 100;
    const legWeaker: 'Izquierdo' | 'Derecho' = leftLeg.muscleKg < rightLeg.muscleKg ? 'Izquierdo' : 'Derecho';

    return [
      {
        limb: 'Brazos',
        leftKg: leftArm.muscleKg,
        rightKg: rightArm.muscleKg,
        diffPercent: Math.round(armDiffPct * 10) / 10,
        weakerSide: armWeaker,
        hasAlert: armDiffPct > 5,
        prescription:
          armDiffPct > 5
            ? `Añadir +2 series unilaterales extra para Brazo ${armWeaker} en Remo Unilateral con 25kg y Curl Martillo con mancuernas ajustables.`
            : 'Simetría braquial y escapular dentro del rango óptimo (<5%).',
      },
      {
        limb: 'Piernas',
        leftKg: leftLeg.muscleKg,
        rightKg: rightLeg.muscleKg,
        diffPercent: Math.round(legDiffPct * 10) / 10,
        weakerSide: legWeaker,
        hasAlert: legDiffPct > 5,
        prescription:
          legDiffPct > 5
            ? `Añadir +2 series unilaterales extra para Pierna ${legWeaker} en Sentadilla Búlgara en Banco XR 6.1 y Desplantes con mancuernas.`
            : 'Simetría de tren inferior dentro del rango óptimo (<5%).',
      },
    ];
  };

  const getDynamicCalorieTarget = () => {
    const latestCamry =
      state.camryHistory[state.camryHistory.length - 1] || INITIAL_APP_STATE.camryHistory[0];
    const bmr = latestCamry.bmrKcal;
    const activeCalories = state.watchMetrics.activeCalories;
    const deficit = 250;
    const targetCalories = Math.max(1400, bmr + activeCalories - deficit);
    const consumedCalories = state.nutrition.loggedMeals.reduce((acc, m) => acc + m.calories, 0);
    const remainingCalories = targetCalories - consumedCalories;

    return {
      bmr,
      activeCalories,
      deficit,
      targetCalories,
      consumedCalories,
      remainingCalories,
    };
  };

  return (
    <AppContext.Provider
      value={{
        state,
        restTimer,
        startRestTimer,
        adjustRestTimer,
        stopRestTimer,
        setSelectedWeekday,
        setCurrentInsanityDay,
        updateWatchMetrics,
        toggleExerciseSet,
        updateExerciseSetValues,
        saveWorkoutSessionVolume,
        toggleInsanityDayCompleted,
        updateFitTestResult,
        addCamryRecord,
        QuickAddMeal,
        addCustomMeal,
        removeLoggedMeal,
        updateWaterGlasses,
        replaceFullState,
        resetToFactorySeed,
        updateFirebaseConfig,
        evaluateDoubleProgression,
        getAsymmetryAnalysis,
        getDynamicCalorieTarget,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp debe utilizarse dentro de un AppProvider');
  }
  return ctx;
}
