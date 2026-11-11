export type EquipmentCategory =
  | 'forza_gym'
  | 'xr61_bench'
  | 'dumbbell_25kg'
  | 'camry_scale'
  | 'galaxy_watch_7';

export type LoadType = 'fixed_25kg' | 'forza_plates' | 'adjustable_db' | 'red_light_db';

export type TrainingMode = 'insanity_only' | 'hybrid';

export interface EquipmentSpec {
  id: string;
  name: string;
  category: EquipmentCategory;
  subtitle: string;
  specs: string[];
  trackingUnit: string;
  badgeColor: 'blue' | 'emerald' | 'amber' | 'purple';
}

export interface UserProfileState {
  age: number;
  heightCm: number;
  targetWeightKg: number;
  targetBodyFatPercent: number;
  dailyDeficitKcal: number;
  primaryGoalTitle: string;
  targetWeeks: number;
  geminiApiKey?: string;
}

export interface ExerciseSet {
  setNumber: number;
  weightKg: number;
  platesCount?: number;
  reps: number;
  completed: boolean;
}

export interface ExerciseItem {
  id: string;
  name: string;
  equipmentName: string;
  loadType: LoadType;
  targetSets: number;
  minReps: number;
  maxReps: number;
  restSeconds: number;
  restCategoryLabel: string;
  notes: string;
  sets: ExerciseSet[];
}

export interface StrengthRoutine {
  id: string;
  dayName: string;
  weekdayIndex: number; // 1=Lun, 2=Mar, 4=Jue, 5=Vie
  title: string;
  focus: string;
  exercises: ExerciseItem[];
}

export interface StrengthSessionLog {
  date: string;
  routineId: string;
  routineLabel: string;
  totalVolumeKg: number;
  completedSets: number;
}

export interface InsanityDay {
  dayNumber: number; // 1 to 63
  weekNumber: number; // 1 to 9
  monthPhase: string;
  weekdayLabel: string;
  workoutTitle: string;
  durationMin: number;
  isFitTest: boolean;
  isRestDay: boolean;
  isMaxInterval: boolean;
  completed: boolean;
  completedDate?: string;
  caloriesBurned?: number;
  avgHr?: number;
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
  testNumber: number; // 1 to 5
  dayNumber: number;
  date: string;
  completed: boolean;
  results: Record<FitTestExerciseKey, number>;
}

export interface SegmentMeasurement {
  muscleKg: number;
  fatPercent: number;
  fatKg: number;
  muscleRatioPct?: number;
  fatRatioPct?: number;
  muscleStatus?: 'Bajo' | 'Estándar' | 'Alto';
  fatStatus?: 'Bajo' | 'Estándar' | 'Alto';
}

export interface CamryBiometricRecord {
  id: string;
  date: string;
  timestampLabel: string;
  userName: string;
  heightCm: number;
  gender: 'Hombre' | 'Mujer';
  weightKg: number;
  bodyFatPercent: number;
  waterPercent: number;
  visceralFatIndex: number;
  boneMassKg: number;
  bmrKcal: number;
  bmi?: number;
  bodyFatMassKg?: number;
  skeletalMusclePercent?: number;
  musclePercent?: number;
  proteinPercent?: number;
  inorganicSaltPercent?: number;
  subcutaneousFatKg?: number;
  leanBodyMassKg?: number;
  smi?: number;
  healthScore?: number;
  standardWeightKg?: number;
  weightControlKg?: number;
  fatControlKg?: number;
  muscleControlKg?: number;
  bodyType?: string;
  segments: {
    leftArm: SegmentMeasurement;
    rightArm: SegmentMeasurement;
    trunk: SegmentMeasurement;
    leftLeg: SegmentMeasurement;
    rightLeg: SegmentMeasurement;
  };
}

export interface WatchDailyMetrics {
  date: string;
  avgHeartRate: number;
  maxHeartRate: number;
  activeCalories: number;
  steps: number;
  sleepHours: number;
  sleepScore: number;
}

export type NutritionMealTag =
  | 'Desayuno'
  | 'Almuerzo'
  | 'Merienda'
  | 'Cena'
  | 'Post-Entreno'
  | 'Comida Fuerte'
  | 'Snack Proteico'
  | 'Pre-HIIT';

export interface NutritionLogItem {
  id: string;
  name: string;
  time: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  tag: NutritionMealTag;
}

export interface DailyNutritionState {
  date: string;
  waterGlasses250ml: number;
  targetWaterGlasses: number; // 14 (3.5L)
  loggedMeals: NutritionLogItem[];
  trainingMode?: TrainingMode;
  completedStrengthRoutineId?: string;
  completedInsanityDay?: number;
}

export interface DailyNutritionHistoryEntry {
  date: string;
  waterGlasses250ml: number;
  targetWaterGlasses: number;
  loggedMeals: NutritionLogItem[];
  watchActiveCalories?: number;
  trainingMode?: TrainingMode;
  completedStrengthRoutineId?: string;
  completedInsanityDay?: number;
  avgHeartRate?: number;
  sleepScore?: number;
}

export interface QuickMealPreset {
  id: string;
  name: string;
  portionLabel: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  tag: NutritionMealTag;
}

export interface FirebaseCloudConfig {
  enabled: boolean;
  projectId: string;
  apiKey: string;
  appId?: string;
  lastSync?: string;
}

export interface AppState {
  selectedWeekdayIndex: number; // 0=Dom ... 6=Sab
  currentInsanityDay: number; // 1..63
  trainingMode: TrainingMode;
  userProfile: UserProfileState;
  hardwareInventory: EquipmentSpec[];
  watchMetrics: WatchDailyMetrics;
  watchHistory: WatchDailyMetrics[];
  routines: StrengthRoutine[];
  strengthVolumeHistory: StrengthSessionLog[];
  insanityCalendar: InsanityDay[];
  fitTests: FitTestRecord[];
  camryHistory: CamryBiometricRecord[];
  nutrition: DailyNutritionState;
  nutritionHistory?: Record<string, DailyNutritionHistoryEntry>;
  coachChatHistory?: CoachChatMessage[];
  quickMealPresets: QuickMealPreset[];
  firebaseConfig: FirebaseCloudConfig;
}

export interface RestTimerState {
  isActive: boolean;
  isFinishedAlert: boolean;
  totalSeconds: number;
  remainingSeconds: number;
  exerciseName: string;
  categoryLabel: string;
}

export interface DynamicCalorieTarget {
  bmr: number;
  neatBasal: number;
  activeCalories: number;
  deficit: number;
  rawTarget: number;
  isFloored: boolean;
  targetCalories: number;
  consumedCalories: number;
  remainingCalories: number;
}

export interface AsymmetryReport {
  limb: 'Brazos' | 'Piernas';
  leftKg: number;
  rightKg: number;
  diffPercent: number;
  weakerSide: 'Izquierdo' | 'Derecho';
  hasAlert: boolean;
  prescription: string;
}

export interface WatchTelemetryInput {
  avgHeartRate: number;
  maxHeartRate: number;
  activeCalories: number;
  steps: number;
  sleepHours: number;
  sleepScore: number;
}

export type ActiveTab = 'dashboard' | 'strength' | 'insanity' | 'camry' | 'biometrics' | 'nutrition';

export interface CupToGramsRef {
  foodKey: string;
  name: string;
  oneCupGrams: number;
  halfCupGrams: number;
  quarterCupGrams: number;
  notes: string;
}

export interface DetectedIngredient {
  name: string;
  portion: string;
  grams?: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface MealAIResult {
  dishName: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  portionDetails: string;
  ingredients: DetectedIngredient[];
  explanation: string;
  recommendedTag: NutritionMealTag;
  source: 'gemini-cloud' | 'clinical-database';
}

export interface MealPhotoAIResult {
  dishName: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  portionDetails: string;
  detectedIngredients: DetectedIngredient[];
  coachRecommendation: string;
  recommendedTag: NutritionMealTag;
  source: 'gemini-vision' | 'apex-smart-estimator';
  visionUnavailable: boolean;
}

export interface CoachQuickAction {
  type: 'log_meal';
  label: string;
  payload: Omit<NutritionLogItem, 'id' | 'time'>;
}

export interface CoachChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  source?: string;
  quickAction?: CoachQuickAction;
}

export interface SamsungHealthImportResult {
  metrics: Partial<WatchDailyMetrics>;
  durationMin?: number;
  activeCalories?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  steps?: number;
  sleepScore?: number;
  sleepHours?: number;
  extractedText: string;
  success: boolean;
  fieldsDetected: string[];
  summaryMessage?: string;
}

export interface MovingLifeImportResult {
  record: CamryBiometricRecord;
  previewUrl?: string;
  extractedText: string;
}
