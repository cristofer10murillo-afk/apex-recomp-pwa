export type NavigationTab = 'dashboard' | 'strength' | 'insanity' | 'camry' | 'nutrition';

export type EquipmentCategory =
  | 'forza_gym'
  | 'xr61_bench'
  | 'dumbbell_25kg'
  | 'dumbbell_adjustable'
  | 'dumbbell_red_light'
  | 'camry_scale'
  | 'galaxy_watch_7';

export interface HardwareItem {
  id: string;
  name: string;
  category: EquipmentCategory;
  subtitle: string;
  specs: string[];
  trackingUnit: string;
  badgeColor: 'blue' | 'emerald' | 'amber' | 'purple';
}

export interface GalaxyWatchMetrics {
  date: string;
  avgHeartRate: number;
  maxHeartRate: number;
  activeCalories: number;
  steps: number;
  sleepHours: number;
  sleepScore: number; // 0 - 100
}

export type ExerciseLoadType = 'fixed_25kg' | 'forza_plates' | 'adjustable_db' | 'red_light_db';

export interface SetRecord {
  setNumber: number;
  weightKg: number;
  platesCount?: number; // For Forza Gym (1 plate = ~4.5kg / 10lbs equivalent)
  reps: number;
  completed: boolean;
}

export interface StrengthExercise {
  id: string;
  name: string;
  equipmentName: string;
  loadType: ExerciseLoadType;
  targetSets: number;
  minReps: number;
  maxReps: number;
  restSeconds: 120 | 90 | 60;
  restCategoryLabel: 'Compuesto Pesado (120s)' | 'Multiarticular Intermedio (90s)' | 'Aislamiento / Metabólico (60s)';
  notes: string;
  sets: SetRecord[];
}

export type RoutineDayKey = 'lunes_torso_a' | 'martes_pierna_a' | 'jueves_torso_b' | 'viernes_pierna_b';

export interface StrengthRoutine {
  id: RoutineDayKey;
  dayName: string;
  weekdayIndex: number; // 1 = Monday, 2 = Tuesday, 4 = Thursday, 5 = Friday
  title: string;
  focus: string;
  exercises: StrengthExercise[];
}

export interface StrengthVolumeLog {
  date: string;
  routineId: RoutineDayKey;
  routineLabel: string;
  totalVolumeKg: number;
  completedSets: number;
}

export interface InsanityDay {
  dayNumber: number; // 1 to 63
  weekNumber: number; // 1 to 9
  monthPhase: 'Mes 1 (Base HIIT)' | 'Semana 5 (Core Cardio & Balance)' | 'Mes 2 (Max Interval)';
  weekdayLabel: 'Lun' | 'Mar' | 'Mié' | 'Jue' | 'Vie' | 'Sáb' | 'Dom';
  workoutTitle: string;
  durationMin: number;
  isFitTest: boolean;
  isRestDay: boolean;
  isMaxInterval: boolean;
  completed: boolean;
  completedDate?: string;
  avgHr?: number;
  caloriesBurned?: number;
}

export type FitTestExerciseKey =
  | 'switchKicks'
  | 'powerJacks'
  | 'powerKnees'
  | 'powerJumps'
  | 'globeJumps'
  | 'suicideJumps'
  | 'pushUpJacks'
  | 'lowPlankOblique';

export interface FitTestRecord {
  testNumber: 1 | 2 | 3 | 4 | 5;
  dayNumber: number;
  date: string;
  completed: boolean;
  results: Record<FitTestExerciseKey, number>;
}

export interface SegmentMetric {
  muscleKg: number;
  fatPercent: number;
}

export interface CamrySegmentalZones {
  leftArm: SegmentMetric;
  rightArm: SegmentMetric;
  trunk: SegmentMetric;
  leftLeg: SegmentMetric;
  rightLeg: SegmentMetric;
}

export interface CamryBiometricRecord {
  id: string;
  date: string;
  weightKg: number;
  bodyFatPercent: number;
  waterPercent: number;
  visceralFatIndex: number;
  boneMassKg: number;
  bmrKcal: number;
  segments: CamrySegmentalZones;
}

export interface NutritionLogItem {
  id: string;
  name: string;
  time: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  tag: 'Post-Entreno' | 'Comida Fuerte' | 'Snack Proteico' | 'Pre-HIIT';
}

export interface QuickMealPreset {
  id: string;
  name: string;
  portionLabel: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  tag: 'Post-Entreno' | 'Comida Fuerte' | 'Snack Proteico' | 'Pre-HIIT';
}

export interface DailyNutritionState {
  date: string;
  waterGlasses250ml: number; // 1 glass = 250ml, 1 bottle = 2 glasses (500ml)
  targetWaterGlasses: number;
  loggedMeals: NutritionLogItem[];
}

export interface FirebaseConfigState {
  enabled: boolean;
  projectId: string;
  apiKey: string;
  appId: string;
  lastSync?: string;
}

export interface AppState {
  selectedWeekdayIndex: number; // 0 (Dom) to 6 (Sáb) - defaults to current day or user toggle
  currentInsanityDay: number; // 1 to 63
  hardwareInventory: HardwareItem[];
  watchMetrics: GalaxyWatchMetrics;
  watchHistory: GalaxyWatchMetrics[];
  routines: StrengthRoutine[];
  strengthVolumeHistory: StrengthVolumeLog[];
  insanityCalendar: InsanityDay[];
  fitTests: FitTestRecord[];
  camryHistory: CamryBiometricRecord[];
  nutrition: DailyNutritionState;
  quickMealPresets: QuickMealPreset[];
  firebaseConfig: FirebaseConfigState;
}
