import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { INITIAL_APP_STATE } from '../data/seedData';
import {
  flushPendingCloudSync,
  getLastLocalEditMs,
  getLocalISODate,
  loadFromIndexedDB,
  loadInitialState,
  loadStateFromFirebaseCloud,
  sanitizeAppState,
  saveAppState,
  saveStateToFirebaseCloud,
  STORAGE_KEY,
} from '../services/storageService';
import {
  AppState,
  AsymmetryReport,
  CamryBiometricRecord,
  CoachChatMessage,
  DailyNutritionHistoryEntry,
  DynamicCalorieTarget,
  ExerciseItem,
  FirebaseCloudConfig,
  FitTestExerciseKey,
  NutritionLogItem,
  QuickMealPreset,
  RestTimerState,
  TrainingMode,
  UserProfileState,
  WatchDailyMetrics,
} from '../types/fitness';

interface DoubleProgressionResult {
  achieved: boolean;
  type: 'fixed_25kg' | 'scalable';
  badgeText: string;
  subText: string;
}

interface InsanityCompletionMetrics {
  durationMin: number;
  caloriesBurned: number;
  avgHr: number;
  syncToWatchToday?: boolean;
}

interface AppContextValue {
  state: AppState;
  restTimer: RestTimerState;
  startRestTimer: (seconds: number, exerciseName: string, categoryLabel: string) => void;
  adjustRestTimer: (deltaSeconds: number) => void;
  stopRestTimer: () => void;
  setSelectedWeekday: (weekdayIndex: number) => void;
  setTrainingMode: (mode: TrainingMode) => void;
  setCurrentInsanityDay: (dayNumber: number) => void;
  updateUserProfile: (partial: Partial<UserProfileState>) => void;
  updateWatchMetrics: (partial: Partial<WatchDailyMetrics>) => void;
  toggleExerciseSet: (routineId: string, exerciseId: string, setNumber: number) => void;
  updateExerciseSetValues: (
    routineId: string,
    exerciseId: string,
    setNumber: number,
    field: 'weightKg' | 'reps' | 'platesCount',
    value: number
  ) => void;
  saveWorkoutSessionVolume: (routineId: string) => void;
  toggleInsanityDayCompleted: (dayNumber: number) => void;
  completeInsanityDayWithMetrics: (dayNumber: number, metrics: InsanityCompletionMetrics) => void;
  updateFitTestResult: (testNumber: number, key: FitTestExerciseKey, reps: number) => void;
  addCamryRecord: (record: Omit<CamryBiometricRecord, 'id'>) => void;
  QuickAddMeal: (preset: QuickMealPreset, targetDate?: string) => void;
  addCustomMeal: (meal: Omit<NutritionLogItem, 'id' | 'time'>, targetDate?: string) => void;
  removeLoggedMeal: (id: string, targetDate?: string) => void;
  clearAllLoggedMeals: (targetDate?: string) => void;
  resetTodayWatchActiveCalories: () => void;
  updateWaterGlasses: (delta: number, targetDate?: string) => void;
  updateHistoryWatchCalories: (isoDate: string, kcal: number) => void;
  replaceFullState: (newState: AppState) => void;
  resetToFactorySeed: () => void;
  updateFirebaseConfig: (cfg: FirebaseCloudConfig) => void;
  evaluateDoubleProgression: (exercise: ExerciseItem) => DoubleProgressionResult;
  getAsymmetryAnalysis: () => AsymmetryReport[];
  getDynamicCalorieTarget: () => DynamicCalorieTarget;
  setCoachChatHistory: (messages: CoachChatMessage[]) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

function playRestFinishedBeep(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    [880, 1108.73, 1318.51].forEach((freq, idx) => {
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
    // ignore audio issues
  }
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(() => loadInitialState());
  const latestStateRef = useRef<AppState>(state);
  latestStateRef.current = state;

  const hasUserEditedRef = useRef(false);
  const skipCloudSyncRef = useRef(true);
  const isInitialMountRef = useRef(true);

  const commitStateChange = useCallback((updater: AppState | ((prev: AppState) => AppState)) => {
    hasUserEditedRef.current = true;
    skipCloudSyncRef.current = false;
    setState(updater);
  }, []);

  const [restTimer, setRestTimer] = useState<RestTimerState>({
    isActive: false,
    isFinishedAlert: false,
    totalSeconds: 90,
    remainingSeconds: 0,
    exerciseName: '',
    categoryLabel: '',
  });

  useEffect(() => {
    let mounted = true;
    const currentWeekday = new Date().getDay();
    const hasLocalData = Boolean(localStorage.getItem(STORAGE_KEY));
    const localEditMs = getLastLocalEditMs();

    loadStateFromFirebaseCloud()
      .then((cloudRes) => {
        if (!mounted) return;
        if (hasUserEditedRef.current) {
          void saveStateToFirebaseCloud(latestStateRef.current);
          return;
        }
        if (cloudRes?.notFound) {
          void saveStateToFirebaseCloud(latestStateRef.current);
          return;
        }
        if (cloudRes?.state && cloudRes.state.routines?.length) {
          if (!hasLocalData || cloudRes.updatedAtMs > localEditMs + 2000) {
            skipCloudSyncRef.current = true;
            setState({
              ...cloudRes.state,
              selectedWeekdayIndex: currentWeekday,
            });
            return;
          }
          if (localEditMs > cloudRes.updatedAtMs) {
            void saveStateToFirebaseCloud(latestStateRef.current);
          }
        }
      })
      .catch(() => {
        void loadFromIndexedDB().then((idbState) => {
          if (mounted && !hasUserEditedRef.current && idbState && idbState.routines?.length) {
            setState((prev) => {
              if (localStorage.getItem(STORAGE_KEY)) return prev;
              skipCloudSyncRef.current = true;
              return {
                ...idbState,
                selectedWeekdayIndex: currentWeekday,
              };
            });
          }
        });
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const checkDayRollover = () => {
      const todayWeekday = new Date().getDay();
      const todayIso = getLocalISODate();

      setState((prev) => {
        let changed = false;
        const next: AppState = { ...prev };

        if (prev.selectedWeekdayIndex !== todayWeekday) {
          next.selectedWeekdayIndex = todayWeekday;
          changed = true;
        }

        if (prev.nutrition.date !== todayIso) {
          if (
            prev.nutrition.date &&
            prev.nutrition.date !== '2026-10-29' &&
            (prev.nutrition.loggedMeals.length > 0 ||
              prev.nutrition.waterGlasses250ml > 0 ||
              Boolean(prev.nutrition.completedStrengthRoutineId) ||
              Boolean(prev.nutrition.completedInsanityDay))
          ) {
            const oldDate = prev.nutrition.date;
            const prevWatchKcal =
              prev.watchMetrics.date === oldDate && prev.watchMetrics.activeCalories > 0
                ? prev.watchMetrics.activeCalories
                : prev.nutritionHistory?.[oldDate]?.watchActiveCalories;
            next.nutritionHistory = {
              ...(prev.nutritionHistory || {}),
              [oldDate]: {
                date: oldDate,
                waterGlasses250ml: prev.nutrition.waterGlasses250ml,
                targetWaterGlasses: prev.nutrition.targetWaterGlasses,
                loggedMeals: prev.nutrition.loggedMeals,
                watchActiveCalories: prevWatchKcal,
                trainingMode: prev.nutrition.trainingMode || prev.trainingMode,
                completedStrengthRoutineId: prev.nutrition.completedStrengthRoutineId,
                completedInsanityDay: prev.nutrition.completedInsanityDay,
                avgHeartRate:
                  prev.watchMetrics.date === oldDate ? prev.watchMetrics.avgHeartRate : undefined,
                sleepScore:
                  prev.watchMetrics.date === oldDate ? prev.watchMetrics.sleepScore : undefined,
              },
            };
          }
          next.nutrition = {
            ...prev.nutrition,
            date: todayIso,
            waterGlasses250ml: 0,
            loggedMeals: [],
            trainingMode: prev.trainingMode,
            completedStrengthRoutineId: undefined,
            completedInsanityDay: undefined,
          };
          changed = true;
        }

        if (prev.watchMetrics.date !== todayIso) {
          if (
            prev.watchMetrics.date &&
            prev.watchMetrics.date !== '2026-10-29' &&
            prev.watchMetrics.activeCalories > 0
          ) {
            const oldWatchDate = prev.watchMetrics.date;
            const histBase = next.nutritionHistory || prev.nutritionHistory || {};
            const existing = histBase[oldWatchDate];
            next.nutritionHistory = {
              ...histBase,
              [oldWatchDate]: existing
                ? { ...existing, watchActiveCalories: prev.watchMetrics.activeCalories }
                : {
                    date: oldWatchDate,
                    waterGlasses250ml: 0,
                    targetWaterGlasses: prev.nutrition.targetWaterGlasses || 14,
                    loggedMeals: [],
                    watchActiveCalories: prev.watchMetrics.activeCalories,
                  },
            };
          }
          next.watchMetrics = {
            ...prev.watchMetrics,
            date: todayIso,
            activeCalories: 0,
          };
          changed = true;
        }

        if (changed) {
          hasUserEditedRef.current = true;
          skipCloudSyncRef.current = false;
        }
        return changed ? next : prev;
      });
    };

    checkDayRollover();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkDayRollover();
      } else {
        flushPendingCloudSync();
      }
    };
    const onPageHide = () => {
      flushPendingCloudSync();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    const interval = window.setInterval(checkDayRollover, 30000);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      if (!localStorage.getItem(STORAGE_KEY)) {
        saveAppState(state, { syncCloud: false, markEdited: false });
      }
      return;
    }
    const shouldSync = !skipCloudSyncRef.current && hasUserEditedRef.current;
    saveAppState(state, { syncCloud: shouldSync, markEdited: shouldSync });
    skipCloudSyncRef.current = false;
  }, [state]);

  useEffect(() => {
    if (!restTimer.isActive) return;
    const id = window.setInterval(() => {
      setRestTimer((prev) => {
        if (!prev.isActive) return prev;
        if (prev.remainingSeconds <= 1) {
          playRestFinishedBeep();
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
    return () => window.clearInterval(id);
  }, [restTimer.isActive]);

  const startRestTimer = useCallback(
    (seconds: number, exerciseName: string, categoryLabel: string) => {
      setRestTimer({
        isActive: true,
        isFinishedAlert: false,
        totalSeconds: seconds,
        remainingSeconds: seconds,
        exerciseName,
        categoryLabel,
      });
    },
    []
  );

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

  const setSelectedWeekday = (weekdayIndex: number) => {
    setState((prev) => ({
      ...prev,
      selectedWeekdayIndex: weekdayIndex,
    }));
  };

  const setTrainingMode = (mode: TrainingMode) => {
    commitStateChange((prev) => ({
      ...prev,
      trainingMode: mode,
      nutrition: {
        ...prev.nutrition,
        trainingMode: mode,
      },
    }));
  };

  const setCurrentInsanityDay = (dayNumber: number) => {
    commitStateChange((prev) => ({
      ...prev,
      currentInsanityDay: Math.min(63, Math.max(1, dayNumber)),
    }));
  };

  const updateUserProfile = (partial: Partial<UserProfileState>) => {
    commitStateChange((prev) => ({
      ...prev,
      userProfile: {
        age: prev.userProfile?.age ?? 38,
        heightCm: prev.userProfile?.heightCm ?? 168,
        targetWeightKg: prev.userProfile?.targetWeightKg ?? 70,
        targetBodyFatPercent: prev.userProfile?.targetBodyFatPercent ?? 18,
        dailyDeficitKcal: prev.userProfile?.dailyDeficitKcal ?? 300,
        primaryGoalTitle:
          prev.userProfile?.primaryGoalTitle ??
          'Recomposición Corporal: Oxidar Grasa Visceral y Subir Masa en Piernas',
        targetWeeks: prev.userProfile?.targetWeeks ?? 12,
        ...partial,
      },
    }));
  };

  const updateWatchMetrics = (partial: Partial<WatchDailyMetrics>) => {
    commitStateChange((prev) => ({
      ...prev,
      watchMetrics: {
        ...prev.watchMetrics,
        ...partial,
        date: getLocalISODate(),
      },
    }));
  };

  const toggleExerciseSet = (routineId: string, exerciseId: string, setNumber: number) => {
    let targetExercise: ExerciseItem | null = null;
    let toggledToCompleted = false;

    commitStateChange((prev) => {
      const updatedRoutines = prev.routines.map((routine) => {
        if (routine.id !== routineId) return routine;
        return {
          ...routine,
          exercises: routine.exercises.map((ex) => {
            if (ex.id !== exerciseId) return ex;
            const updatedSets = ex.sets.map((s) => {
              if (s.setNumber !== setNumber) return s;
              toggledToCompleted = !s.completed;
              return { ...s, completed: toggledToCompleted };
            });
            targetExercise = { ...ex, sets: updatedSets };
            return targetExercise;
          }),
        };
      });
      return {
        ...prev,
        routines: updatedRoutines,
        nutrition: toggledToCompleted
          ? {
              ...prev.nutrition,
              trainingMode: prev.trainingMode,
              completedStrengthRoutineId: routineId,
            }
          : prev.nutrition,
      };
    });

    if (toggledToCompleted && targetExercise) {
      const ex = targetExercise as ExerciseItem;
      startRestTimer(ex.restSeconds, ex.name, ex.restCategoryLabel);
    }
  };

  const updateExerciseSetValues = (
    routineId: string,
    exerciseId: string,
    setNumber: number,
    field: 'weightKg' | 'reps' | 'platesCount',
    value: number
  ) => {
    const cleanVal = Number.isNaN(value) ? 0 : Math.max(0, value);
    commitStateChange((prev) => ({
      ...prev,
      routines: prev.routines.map((r) => {
        if (r.id !== routineId) return r;
        return {
          ...r,
          exercises: r.exercises.map((ex) => {
            if (ex.id !== exerciseId) return ex;
            return {
              ...ex,
              sets: ex.sets.map((s) => {
                if (s.setNumber !== setNumber) return s;
                if (field === 'platesCount') {
                  return {
                    ...s,
                    platesCount: cleanVal,
                    weightKg: Math.round(cleanVal * 4.5 * 10) / 10,
                  };
                }
                return { ...s, [field]: cleanVal };
              }),
            };
          }),
        };
      }),
    }));
  };

  const saveWorkoutSessionVolume = (routineId: string) => {
    commitStateChange((prev) => {
      const routine = prev.routines.find((r) => r.id === routineId);
      if (!routine) return prev;

      let totalVolume = 0;
      let completedSets = 0;
      routine.exercises.forEach((ex) => {
        ex.sets.forEach((s) => {
          if (s.completed) {
            totalVolume += s.weightKg * s.reps;
            completedSets += 1;
          }
        });
      });

      if (totalVolume === 0) {
        routine.exercises.forEach((ex) => {
          ex.sets.forEach((s) => {
            totalVolume += s.weightKg * s.reps;
            completedSets += 1;
          });
        });
      }

      const logEntry = {
        date: new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }),
        routineId,
        routineLabel: routine.title.split('(')[0].trim(),
        totalVolumeKg: Math.round(totalVolume),
        completedSets,
      };

      return {
        ...prev,
        strengthVolumeHistory: [...prev.strengthVolumeHistory.slice(-9), logEntry],
        nutrition: {
          ...prev.nutrition,
          trainingMode: prev.trainingMode,
          completedStrengthRoutineId: routineId,
        },
      };
    });
  };

  const toggleInsanityDayCompleted = (dayNumber: number) => {
    commitStateChange((prev) => {
      const targetDay = prev.insanityCalendar.find((d) => d.dayNumber === dayNumber);
      const nextCompleted = targetDay ? !targetDay.completed : true;
      return {
        ...prev,
        insanityCalendar: prev.insanityCalendar.map((day) =>
          day.dayNumber === dayNumber
            ? {
                ...day,
                completed: !day.completed,
                completedDate: day.completed ? undefined : getLocalISODate(),
                avgHr: day.completed ? undefined : prev.watchMetrics.avgHeartRate || 158,
                caloriesBurned: day.completed
                  ? undefined
                  : prev.watchMetrics.activeCalories > 0
                  ? prev.watchMetrics.activeCalories
                  : Math.round(day.durationMin * 11.5),
              }
            : day
        ),
        nutrition: {
          ...prev.nutrition,
          trainingMode: prev.trainingMode,
          completedInsanityDay: nextCompleted
            ? dayNumber
            : prev.nutrition.completedInsanityDay === dayNumber
            ? undefined
            : prev.nutrition.completedInsanityDay,
        },
      };
    });
  };

  const completeInsanityDayWithMetrics = (
    dayNumber: number,
    metrics: InsanityCompletionMetrics
  ) => {
    commitStateChange((prev) => {
      const todayIso = getLocalISODate();
      const updatedWatch =
        metrics.syncToWatchToday !== false
          ? {
              ...prev.watchMetrics,
              date: todayIso,
              activeCalories: Math.max(prev.watchMetrics.activeCalories, metrics.caloriesBurned),
              avgHeartRate:
                metrics.avgHr > 0 ? metrics.avgHr : prev.watchMetrics.avgHeartRate,
              maxHeartRate: Math.max(
                prev.watchMetrics.maxHeartRate,
                metrics.avgHr > 0 ? Math.round(metrics.avgHr * 1.15) : 0
              ),
            }
          : prev.watchMetrics;

      return {
        ...prev,
        currentInsanityDay: Math.min(63, Math.max(prev.currentInsanityDay, dayNumber + 1)),
        watchMetrics: updatedWatch,
        insanityCalendar: prev.insanityCalendar.map((day) =>
          day.dayNumber === dayNumber
            ? {
                ...day,
                completed: true,
                completedDate: todayIso,
                durationMin: metrics.durationMin > 0 ? metrics.durationMin : day.durationMin,
                caloriesBurned: metrics.caloriesBurned,
                avgHr: metrics.avgHr,
              }
            : day
        ),
        nutrition: {
          ...prev.nutrition,
          trainingMode: prev.trainingMode,
          completedInsanityDay: dayNumber,
        },
      };
    });
  };

  const updateFitTestResult = (testNumber: number, key: FitTestExerciseKey, reps: number) => {
    const cleanReps = Number.isNaN(reps) ? 0 : Math.max(0, Math.round(reps));
    commitStateChange((prev) => ({
      ...prev,
      fitTests: prev.fitTests.map((ft) =>
        ft.testNumber === testNumber
          ? {
              ...ft,
              completed: true,
              results: { ...ft.results, [key]: cleanReps },
            }
          : ft
      ),
    }));
  };

  const addCamryRecord = (record: Omit<CamryBiometricRecord, 'id'>) => {
    const newRec: CamryBiometricRecord = { ...record, id: `camry-${Date.now()}` };
    commitStateChange((prev) => ({
      ...prev,
      camryHistory: [...prev.camryHistory, newRec],
    }));
  };

  const mutateNutritionForDate = (
    targetDate: string | undefined,
    fn: (entry: DailyNutritionHistoryEntry) => DailyNutritionHistoryEntry
  ) => {
    const todayIso = getLocalISODate();
    const resolvedDate =
      targetDate && /^\d{4}-\d{2}-\d{2}$/.test(targetDate) && targetDate < todayIso
        ? targetDate
        : todayIso;

    commitStateChange((prev) => {
      if (resolvedDate === todayIso) {
        const currentEntry: DailyNutritionHistoryEntry = {
          date: todayIso,
          waterGlasses250ml: prev.nutrition.waterGlasses250ml,
          targetWaterGlasses: prev.nutrition.targetWaterGlasses,
          loggedMeals: prev.nutrition.loggedMeals,
        };
        const updated = fn(currentEntry);
        return {
          ...prev,
          nutrition: {
            ...prev.nutrition,
            date: todayIso,
            waterGlasses250ml: updated.waterGlasses250ml,
            targetWaterGlasses: updated.targetWaterGlasses,
            loggedMeals: updated.loggedMeals,
          },
        };
      }

      const historyMap = prev.nutritionHistory || {};
      const existing: DailyNutritionHistoryEntry = historyMap[resolvedDate] || {
        date: resolvedDate,
        waterGlasses250ml: 0,
        targetWaterGlasses: prev.nutrition.targetWaterGlasses || 14,
        loggedMeals: [],
        watchActiveCalories: 0,
      };
      const updated = fn(existing);
      return {
        ...prev,
        nutritionHistory: {
          ...historyMap,
          [resolvedDate]: {
            ...existing,
            ...updated,
            date: resolvedDate,
          },
        },
      };
    });
  };

  const QuickAddMeal = (preset: QuickMealPreset, targetDate?: string) => {
    const timeStr = new Date().toTimeString().slice(0, 5);
    const meal: NutritionLogItem = {
      id: `meal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: preset.name,
      time: timeStr,
      calories: preset.calories,
      proteinG: preset.proteinG,
      carbsG: preset.carbsG,
      fatG: preset.fatG,
      tag: preset.tag,
    };
    mutateNutritionForDate(targetDate, (entry) => ({
      ...entry,
      loggedMeals: [meal, ...entry.loggedMeals],
    }));
  };

  const addCustomMeal = (meal: Omit<NutritionLogItem, 'id' | 'time'>, targetDate?: string) => {
    const timeStr = new Date().toTimeString().slice(0, 5);
    const fullMeal: NutritionLogItem = {
      ...meal,
      id: `meal-${Date.now()}`,
      time: timeStr,
    };
    mutateNutritionForDate(targetDate, (entry) => ({
      ...entry,
      loggedMeals: [fullMeal, ...entry.loggedMeals],
    }));
  };

  const removeLoggedMeal = (id: string, targetDate?: string) => {
    mutateNutritionForDate(targetDate, (entry) => ({
      ...entry,
      loggedMeals: entry.loggedMeals.filter((m) => m.id !== id),
    }));
  };

  const clearAllLoggedMeals = (targetDate?: string) => {
    mutateNutritionForDate(targetDate, (entry) => ({
      ...entry,
      loggedMeals: [],
    }));
  };

  const resetTodayWatchActiveCalories = () => {
    commitStateChange((prev) => ({
      ...prev,
      watchMetrics: {
        ...prev.watchMetrics,
        date: getLocalISODate(),
        activeCalories: 0,
      },
    }));
  };

  const updateWaterGlasses = (delta: number, targetDate?: string) => {
    mutateNutritionForDate(targetDate, (entry) => ({
      ...entry,
      waterGlasses250ml: Math.max(0, entry.waterGlasses250ml + delta),
    }));
  };

  const updateHistoryWatchCalories = (isoDate: string, kcal: number) => {
    const cleanVal = Number.isNaN(kcal) ? 0 : Math.max(0, Math.round(kcal));
    const todayIso = getLocalISODate();
    if (isoDate >= todayIso) {
      updateWatchMetrics({ activeCalories: cleanVal });
      return;
    }
    mutateNutritionForDate(isoDate, (entry) => ({
      ...entry,
      watchActiveCalories: cleanVal,
    }));
  };

  const replaceFullState = (newState: AppState) => {
    commitStateChange(sanitizeAppState(newState));
  };

  const resetToFactorySeed = () => {
    commitStateChange(sanitizeAppState(null));
  };

  const updateFirebaseConfig = (cfg: FirebaseCloudConfig) => {
    commitStateChange((prev) => ({
      ...prev,
      firebaseConfig: cfg,
    }));
  };

  const evaluateDoubleProgression = (exercise: ExerciseItem): DoubleProgressionResult => {
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

    const scaleText =
      exercise.loadType === 'forza_plates'
        ? '🔥 Subir +1 Placa/Bloque en Forza Gym (+4.5 kg)'
        : '🔥 Subir Discos en Mancuernas Ajustables (+2 kg)';

    return {
      achieved: allHitMax,
      type: 'scalable',
      badgeText: allHitMax
        ? scaleText
        : `Progresión activa: alcanzar ${exercise.targetSets}x${exercise.maxReps} reps`,
      subText: allHitMax
        ? `Has completado todas las series de ${exercise.maxReps} reps. En la próxima sesión incrementa carga y reinicia en ${exercise.minReps} reps.`
        : 'Mantén la carga actual hasta completar el tope del rango en todas las series.',
    };
  };

  const getAsymmetryAnalysis = (): AsymmetryReport[] => {
    const latest = state.camryHistory[state.camryHistory.length - 1] || INITIAL_APP_STATE.camryHistory[0];
    const { leftArm, rightArm, leftLeg, rightLeg } = latest.segments;
    const isInsanityOnly = state.trainingMode === 'insanity_only';

    const maxArm = Math.max(leftArm.muscleKg, rightArm.muscleKg, 0.1);
    const armDiff = (Math.abs(leftArm.muscleKg - rightArm.muscleKg) / maxArm) * 100;
    const weakerArm: 'Izquierdo' | 'Derecho' =
      leftArm.muscleKg < rightArm.muscleKg ? 'Izquierdo' : 'Derecho';
    const armLow =
      (leftArm.muscleRatioPct !== undefined && leftArm.muscleRatioPct < 90) ||
      (rightArm.muscleRatioPct !== undefined && rightArm.muscleRatioPct < 90) ||
      leftArm.muscleStatus === 'Bajo' ||
      rightArm.muscleStatus === 'Bajo';

    const maxLeg = Math.max(leftLeg.muscleKg, rightLeg.muscleKg, 0.1);
    const legDiff = (Math.abs(leftLeg.muscleKg - rightLeg.muscleKg) / maxLeg) * 100;
    const weakerLeg: 'Izquierdo' | 'Derecho' =
      leftLeg.muscleKg < rightLeg.muscleKg ? 'Izquierdo' : 'Derecho';
    const legLow =
      (leftLeg.muscleRatioPct !== undefined && leftLeg.muscleRatioPct < 90) ||
      (rightLeg.muscleRatioPct !== undefined && rightLeg.muscleRatioPct < 90) ||
      leftLeg.muscleStatus === 'Bajo' ||
      rightLeg.muscleStatus === 'Bajo';

    const armPrescription = armDiff > 5
      ? isInsanityOnly
        ? `Asimetría >5% en Brazo ${weakerArm}. (⏸️ Fuerza en Pausa — al volver a Modo Híbrido añade +2 series unilaterales en Remo 25kg / Banco Scott).`
        : `Asimetría >5%: Añadir +2 series unilaterales para Brazo ${weakerArm} en Remo Unilateral con 25kg y Curl en Banco Predicador Forza Gym.`
      : armLow
      ? isInsanityOnly
        ? 'Masa braquial baja en MovingLife. (⏸️ Fuerza en Pausa — prioriza buena técnica en Push-Up Jacks).'
        : 'Masa braquial baja en MovingLife: Priorizar Press con mancuernas de 25kg y Remo en Forza Gym.'
      : `Equilibrio muscular Estándar en MovingLife (Izq ${leftArm.muscleRatioPct || 105.7}% / Der ${rightArm.muscleRatioPct || 103.5}% • Simetría Δ ${Math.round(armDiff * 10) / 10}%).`;

    const legPrescription = legDiff > 5
      ? isInsanityOnly
        ? `Asimetría >5% en Pierna ${weakerLeg}. En Insanity cuida aterrizajes parejos. (⏸️ Fuerza en Pausa — al volver a Híbrido: +2 series de Búlgara).`
        : `Asimetría >5%: Añadir +2 series unilaterales para Pierna ${weakerLeg} en Sentadilla Búlgara en Banco XR 6.1 y Desplantes.`
      : legLow
      ? isInsanityOnly
        ? `Alerta MovingLife: Piernas en Nivel Bajo (Izq ${leftLeg.muscleRatioPct || 87.7}% vs Der ${rightLeg.muscleRatioPct || 88.9}% — Estándar 90%-110%). En Modo Solo Insanity protege esta masa muscular asegurando alta proteína diaria e hidratación 3.5L; al reactivar Modo Híbrido priorizaremos Sentadilla Búlgara (empezando pierna ${weakerLeg.toLowerCase()}) + Extensión Forza Gym.`
        : `Alerta MovingLife: Equilibrio muscular Bajo en Piernas (Izq ${leftLeg.muscleRatioPct || 87.7}% vs Der ${rightLeg.muscleRatioPct || 88.9}% — Estándar 90%-110%). Priorizar Sentadilla Búlgara en Banco XR 6.1 (+1 serie para pierna ${weakerLeg.toLowerCase()}), Extensión en Forza Gym y Peso Muerto Rumano con 25kg.`
      : 'Simetría de tren inferior dentro del rango óptimo (<5%).';

    return [
      {
        limb: 'Brazos',
        leftKg: leftArm.muscleKg,
        rightKg: rightArm.muscleKg,
        diffPercent: Math.round(armDiff * 10) / 10,
        weakerSide: weakerArm,
        hasAlert: armDiff > 5 || armLow,
        prescription: armPrescription,
      },
      {
        limb: 'Piernas',
        leftKg: leftLeg.muscleKg,
        rightKg: rightLeg.muscleKg,
        diffPercent: Math.round(legDiff * 10) / 10,
        weakerSide: weakerLeg,
        hasAlert: legDiff > 5 || legLow,
        prescription: legPrescription,
      },
    ];
  };

  const getDynamicCalorieTarget = (): DynamicCalorieTarget => {
    const latest = state.camryHistory[state.camryHistory.length - 1] || INITIAL_APP_STATE.camryHistory[0];
    const bmr = latest.bmrKcal;
    const neatBasal = Math.round(bmr * 0.1);
    const activeCalories = state.watchMetrics.activeCalories || 0;
    const deficit = state.userProfile?.dailyDeficitKcal ?? 300;
    const rawTarget = bmr + neatBasal + activeCalories - deficit;
    const isFloored = rawTarget < 1500;
    const targetCalories = Math.max(1500, rawTarget);
    const consumedCalories = state.nutrition.loggedMeals.reduce((acc, m) => acc + m.calories, 0);
    const remainingCalories = targetCalories - consumedCalories;

    return {
      bmr,
      neatBasal,
      activeCalories,
      deficit,
      rawTarget,
      isFloored,
      targetCalories,
      consumedCalories,
      remainingCalories,
    };
  };

  const setCoachChatHistory = useCallback(
    (messages: CoachChatMessage[]) => {
      commitStateChange((prev) => ({
        ...prev,
        coachChatHistory: messages.slice(-24),
      }));
    },
    [commitStateChange]
  );

  return (
    <AppContext.Provider
      value={{
        state,
        restTimer,
        startRestTimer,
        adjustRestTimer,
        stopRestTimer,
        setSelectedWeekday,
        setTrainingMode,
        setCurrentInsanityDay,
        updateUserProfile,
        updateWatchMetrics,
        toggleExerciseSet,
        updateExerciseSetValues,
        saveWorkoutSessionVolume,
        toggleInsanityDayCompleted,
        completeInsanityDayWithMetrics,
        updateFitTestResult,
        addCamryRecord,
        QuickAddMeal,
        addCustomMeal,
        removeLoggedMeal,
        clearAllLoggedMeals,
        resetTodayWatchActiveCalories,
        updateWaterGlasses,
        updateHistoryWatchCalories,
        replaceFullState,
        resetToFactorySeed,
        updateFirebaseConfig,
        evaluateDoubleProgression,
        getAsymmetryAnalysis,
        getDynamicCalorieTarget,
        setCoachChatHistory,
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
