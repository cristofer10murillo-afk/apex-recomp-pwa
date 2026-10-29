import React, { useState } from 'react';
import {
  Utensils,
  Flame,
  Droplets,
  Plus,
  Trash2,
  Zap,
  ShieldCheck,
  GlassWater,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { NutritionLogItem } from '../types/fitness';

const WEEKDAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export const NutritionModule: React.FC = () => {
  const {
    state,
    setSelectedWeekday,
    getDynamicCalorieTarget,
    QuickAddMeal,
    addCustomMeal,
    removeLoggedMeal,
    updateWaterGlasses,
  } = useApp();

  const [customName, setCustomName] = useState('');
  const [customCal, setCustomCal] = useState(350);
  const [customProt, setCustomProt] = useState(32);
  const [customCarb, setCustomCarb] = useState(35);
  const [customFat, setCustomFat] = useState(9);
  const [customTag, setCustomTag] = useState<NutritionLogItem['tag']>('Comida Fuerte');

  const { targetCalories, consumedCalories, remainingCalories } = getDynamicCalorieTarget();
  const latestWeightKg =
    state.camryHistory[state.camryHistory.length - 1]?.weightKg || 80;

  const activeInsanityDay =
    state.insanityCalendar.find((d) => d.dayNumber === state.currentInsanityDay) ||
    state.insanityCalendar[0];

  const isRecoveryDay =
    state.selectedWeekdayIndex === 0 ||
    state.selectedWeekdayIndex === 4 ||
    state.selectedWeekdayIndex === 3;

  const isHighCarbDay =
    !isRecoveryDay ||
    [1, 2, 5].includes(state.selectedWeekdayIndex) ||
    (activeInsanityDay.isMaxInterval && state.selectedWeekdayIndex !== 0 && state.selectedWeekdayIndex !== 4);

  const targetProteinG = isHighCarbDay
    ? Math.round(latestWeightKg * 2.2)
    : Math.round(latestWeightKg * 2.35);

  const targetFatG = isHighCarbDay
    ? Math.round(latestWeightKg * 0.8)
    : Math.round(latestWeightKg * 1.15);

  const proteinKcal = targetProteinG * 4;
  const fatKcal = targetFatG * 9;
  const remainingCarbKcal = Math.max(240, targetCalories - proteinKcal - fatKcal);
  const targetCarbsG = Math.round(remainingCarbKcal / 4);

  const consumedProtein = state.nutrition.loggedMeals.reduce((a, b) => a + b.proteinG, 0);
  const consumedCarbs = state.nutrition.loggedMeals.reduce((a, b) => a + b.carbsG, 0);
  const consumedFat = state.nutrition.loggedMeals.reduce((a, b) => a + b.fatG, 0);

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    addCustomMeal({
      name: customName.trim(),
      calories: customCal,
      proteinG: customProt,
      carbsG: customCarb,
      fatG: customFat,
      tag: customTag,
    });
    setCustomName('');
  };

  const waterLiters = ((state.nutrition.waterGlasses250ml * 250) / 1000).toFixed(2);
  const targetLiters = ((state.nutrition.targetWaterGlasses * 250) / 1000).toFixed(2);
  const waterPct = Math.min(
    100,
    Math.round((state.nutrition.waterGlasses250ml / state.nutrition.targetWaterGlasses) * 100)
  );

  return (
    <div className="space-y-5 pb-8">
      <div className="bg-[#111827] border border-gray-800 rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl ${
                isHighCarbDay
                  ? 'bg-[#F59E0B]/20 text-[#F59E0B]'
                  : 'bg-[#10B981]/20 text-[#10B981]'
              }`}
            >
              {isHighCarbDay ? <Zap className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-extrabold text-white">
                  CICLADO DE CARBOHIDRATOS ({WEEKDAY_NAMES[state.selectedWeekdayIndex].toUpperCase()})
                </h2>
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                    isHighCarbDay
                      ? 'bg-[#F59E0B]/20 text-[#F59E0B]'
                      : 'bg-[#10B981]/20 text-[#10B981]'
                  }`}
                >
                  {isHighCarbDay
                    ? '🔥 Día Alto en Carbohidratos (Doble Impacto / Max Interval)'
                    : '🛡️ Día Bajo/Moderado en Carbohidratos (Recuperación / Oxidación)'}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Calculado sobre peso Camry ({latestWeightKg} kg) y Meta Dinámica ({targetCalories} kcal)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-[#090D16] p-1 rounded-xl border border-gray-800 self-start">
            {[
              { idx: 1, label: 'Lun (Alto)' },
              { idx: 2, label: 'Mar (Alto)' },
              { idx: 4, label: 'Jue (Recup)' },
              { idx: 5, label: 'Vie (Alto)' },
              { idx: 0, label: 'Dom (OFF)' },
            ].map((d) => (
              <button
                key={d.idx}
                onClick={() => setSelectedWeekday(d.idx)}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition ${
                  state.selectedWeekdayIndex === d.idx
                    ? 'bg-[#3B82F6] text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
          <div className="bg-[#090D16] border border-gray-800 rounded-xl p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400 font-semibold flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-[#10B981]" />
                Calorías Día
              </span>
              <span className="font-mono font-bold text-[#10B981]">
                {remainingCalories >= 0 ? `${remainingCalories} rest.` : 'Meta cubierta'}
              </span>
            </div>
            <div className="text-lg font-mono font-extrabold text-white mt-1">
              {consumedCalories} / {targetCalories} kcal
            </div>
            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-[#10B981]"
                style={{ width: `${Math.min(100, (consumedCalories / targetCalories) * 100)}%` }}
              />
            </div>
          </div>

          <div className="bg-[#090D16] border border-gray-800 rounded-xl p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400 font-semibold">
                Proteína ({isHighCarbDay ? '2.2g/kg' : '2.35g/kg'})
              </span>
              <span className="font-mono text-[#3B82F6] font-bold">
                {Math.round((consumedProtein / targetProteinG) * 100)}%
              </span>
            </div>
            <div className="text-lg font-mono font-extrabold text-[#3B82F6] mt-1">
              {consumedProtein}g / {targetProteinG}g
            </div>
            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-[#3B82F6]"
                style={{ width: `${Math.min(100, (consumedProtein / targetProteinG) * 100)}%` }}
              />
            </div>
          </div>

          <div className="bg-[#090D16] border border-gray-800 rounded-xl p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400 font-semibold">
                Carbohidratos ({isHighCarbDay ? 'Carga' : 'Control'})
              </span>
              <span className="font-mono text-[#F59E0B] font-bold">
                {Math.round((consumedCarbs / targetCarbsG) * 100)}%
              </span>
            </div>
            <div className="text-lg font-mono font-extrabold text-[#F59E0B] mt-1">
              {consumedCarbs}g / {targetCarbsG}g
            </div>
            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-[#F59E0B]"
                style={{ width: `${Math.min(100, (consumedCarbs / targetCarbsG) * 100)}%` }}
              />
            </div>
          </div>

          <div className="bg-[#090D16] border border-gray-800 rounded-xl p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400 font-semibold">
                Grasas ({isHighCarbDay ? '0.8g/kg' : '1.15g/kg'})
              </span>
              <span className="font-mono text-purple-400 font-bold">
                {Math.round((consumedFat / targetFatG) * 100)}%
              </span>
            </div>
            <div className="text-lg font-mono font-extrabold text-purple-400 mt-1">
              {consumedFat}g / {targetFatG}g
            </div>
            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-purple-500"
                style={{ width: `${Math.min(100, (consumedFat / targetFatG) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 bg-[#111827] border border-gray-800 rounded-2xl p-4 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Droplets className="w-4 h-4 text-sky-400" />
                Tracker de Hidratación Electrolítica
              </h3>
              <span className="text-xs font-mono font-bold text-sky-400">
                {waterLiters}L / {targetLiters}L ({waterPct}%)
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Reposición hídrica para sesiones de Insanity HIIT y Fuerza
            </p>

            <div className="grid grid-cols-7 gap-2 mt-4">
              {Array.from({ length: state.nutrition.targetWaterGlasses }, (_, i) => {
                const filled = i < state.nutrition.waterGlasses250ml;
                return (
                  <button
                    key={i}
                    onClick={() =>
                      updateWaterGlasses(i + 1 - state.nutrition.waterGlasses250ml)
                    }
                    className={`h-11 rounded-xl border flex flex-col items-center justify-center transition ${
                      filled
                        ? 'bg-sky-500/20 border-sky-400 text-sky-300 shadow-sm shadow-sky-500/20'
                        : 'bg-[#090D16] border-gray-800 text-gray-600 hover:border-gray-700'
                    }`}
                    title={`Vaso #${i + 1} (250ml)`}
                  >
                    <GlassWater className="w-4 h-4" />
                    <span className="text-[9px] font-mono mt-0.5">250</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-800">
            <button
              onClick={() => updateWaterGlasses(1)}
              className="py-2 px-2.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 font-bold text-xs transition"
            >
              +1 Vaso (250ml)
            </button>
            <button
              onClick={() => updateWaterGlasses(2)}
              className="py-2 px-2.5 rounded-xl bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-white font-bold text-xs transition"
            >
              +1 Botella (500ml)
            </button>
            <button
              onClick={() => updateWaterGlasses(-1)}
              className="py-2 px-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold text-xs transition"
            >
              −1 Vaso
            </button>
          </div>
        </div>

        <div className="lg:col-span-7 bg-[#111827] border border-gray-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#10B981]" />
                Registro Rápido (Quick-Add 1 Toque)
              </h3>
              <p className="text-xs text-gray-400">
                Toca cualquier comida frecuente para sumarla inmediatamente al día
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {state.quickMealPresets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => QuickAddMeal(preset)}
                className="p-3 rounded-xl bg-[#090D16] hover:bg-gray-800/70 border border-gray-800 hover:border-[#10B981]/50 text-left transition flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white group-hover:text-[#10B981] transition">
                      {preset.name}
                    </span>
                    <span className="p-1 rounded-lg bg-[#10B981]/15 text-[#10B981] shrink-0">
                      <Plus className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">{preset.portionLabel}</p>
                </div>

                <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gray-800/80 text-[11px] font-mono">
                  <span className="font-bold text-white">{preset.calories} kcal</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[#3B82F6]">P: {preset.proteinG}g</span>
                    <span className="text-[#F59E0B]">C: {preset.carbsG}g</span>
                    <span className="text-purple-400">G: {preset.fatG}g</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-[#111827] border border-gray-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Utensils className="w-4 h-4 text-[#10B981]" />
              Bitácora de Comidas Registradas Hoy ({state.nutrition.loggedMeals.length})
            </h3>
            <span className="text-xs font-mono text-gray-400">
              Total: {consumedCalories} kcal
            </span>
          </div>

          <div className="space-y-2">
            {state.nutrition.loggedMeals.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-[#090D16] border border-gray-800 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">
                      {item.time}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#3B82F6]/15 text-[#3B82F6]">
                      {item.tag}
                    </span>
                    <span className="text-xs font-bold text-white truncate">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] font-mono text-gray-400">
                    <span className="text-white font-bold">{item.calories} kcal</span>
                    <span className="text-[#3B82F6]">Prot: {item.proteinG}g</span>
                    <span className="text-[#F59E0B]">Carbs: {item.carbsG}g</span>
                    <span className="text-purple-400">Grasas: {item.fatG}g</span>
                  </div>
                </div>

                <button
                  onClick={() => removeLoggedMeal(item.id)}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition shrink-0"
                  title="Eliminar registro"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <form
          onSubmit={handleAddCustom}
          className="lg:col-span-5 bg-[#111827] border border-gray-800 rounded-2xl p-4 space-y-3 self-start"
        >
          <h3 className="text-sm font-bold text-white">Añadir Alimento Personalizado</h3>
          <div>
            <label className="text-[11px] text-gray-400 block mb-1">Nombre de la comida</label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Ej. Carne magra 200g + Papa al horno"
              className="w-full bg-[#090D16] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:border-[#10B981] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Calorías (kcal)</label>
              <input
                type="number"
                value={customCal}
                onChange={(e) => setCustomCal(Number(e.target.value))}
                className="w-full bg-[#090D16] border border-gray-800 rounded-xl px-3 py-1.5 text-xs font-mono text-white"
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Momento</label>
              <select
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value as NutritionLogItem['tag'])}
                className="w-full bg-[#090D16] border border-gray-800 rounded-xl px-2.5 py-1.5 text-xs text-white"
              >
                <option value="Comida Fuerte">Comida Fuerte</option>
                <option value="Post-Entreno">Post-Entreno</option>
                <option value="Pre-HIIT">Pre-HIIT</option>
                <option value="Snack Proteico">Snack Proteico</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Proteína (g)</label>
              <input
                type="number"
                value={customProt}
                onChange={(e) => setCustomProt(Number(e.target.value))}
                className="w-full bg-[#090D16] border border-gray-800 rounded-xl px-3 py-1.5 text-xs font-mono text-[#3B82F6]"
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Carbohidratos (g)</label>
              <input
                type="number"
                value={customCarb}
                onChange={(e) => setCustomCarb(Number(e.target.value))}
                className="w-full bg-[#090D16] border border-gray-800 rounded-xl px-3 py-1.5 text-xs font-mono text-[#F59E0B]"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[11px] text-gray-400 block mb-1">Grasas (g)</label>
              <input
                type="number"
                value={customFat}
                onChange={(e) => setCustomFat(Number(e.target.value))}
                className="w-full bg-[#090D16] border border-gray-800 rounded-xl px-3 py-1.5 text-xs font-mono text-purple-400"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-gray-950 font-bold text-xs flex items-center justify-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" />
            Registrar Comida
          </button>
        </form>
      </div>
    </div>
  );
};
