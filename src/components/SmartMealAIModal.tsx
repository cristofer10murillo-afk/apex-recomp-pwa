import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Flame,
  Image as ImageIcon,
  RefreshCw,
  Scale,
  Sparkles,
  TriangleAlert,
  Utensils,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  analyzeMealPhotoWithGemini,
  compressImageFileToBase64,
  CUPS_TO_GRAMS_GUIDE,
} from '../services/aiService';
import { MealPhotoAIResult, NutritionMealTag } from '../types/fitness';

interface SmartMealAIModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTag?: NutritionMealTag;
  targetDate?: string;
  targetDateLabel?: string;
  initialFile?: File | null;
  onInitialFileConsumed?: () => void;
}

export const SmartMealAIModal: React.FC<SmartMealAIModalProps> = ({
  isOpen,
  onClose,
  defaultTag,
  targetDate,
  targetDateLabel,
  initialFile,
  onInitialFileConsumed,
}) => {
  const { state, addCustomMeal } = useApp();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState('');
  const [imageMimeType, setImageMimeType] = useState('image/jpeg');
  const [optionalNote, setOptionalNote] = useState('');
  const [correctionInput, setCorrectionInput] = useState('');
  const [showCupsGuide, setShowCupsGuide] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<MealPhotoAIResult | null>(null);
  const [multiplier, setMultiplier] = useState(1);

  const [dishName, setDishName] = useState('');
  const [baseCalories, setBaseCalories] = useState(0);
  const [baseProteinG, setBaseProteinG] = useState(0);
  const [baseCarbsG, setBaseCarbsG] = useState(0);
  const [baseFatG, setBaseFatG] = useState(0);
  const [selectedTag, setSelectedTag] = useState<NutritionMealTag>(defaultTag || 'Almuerzo');

  const populateResult = (res: MealPhotoAIResult) => {
    setResult(res);
    setMultiplier(1);
    setDishName(res.dishName);
    setBaseCalories(res.calories);
    setBaseProteinG(res.proteinG);
    setBaseCarbsG(res.carbsG);
    setBaseFatG(res.fatG);
    setSelectedTag(defaultTag || res.recommendedTag);
  };

  const processIncomingFile = async (file: File) => {
    setIsAnalyzing(true);
    setErrorMsg(null);
    setResult(null);
    try {
      const compressed = await compressImageFileToBase64(file);
      setPreviewUrl(compressed.previewUrl);
      setImageBase64(compressed.base64);
      setImageMimeType(compressed.mimeType);
      const aiRes = await analyzeMealPhotoWithGemini(
        compressed.base64,
        compressed.mimeType,
        optionalNote,
        state
      );
      populateResult(aiRes);
    } catch {
      setErrorMsg(
        'No se pudo procesar la fotografía seleccionada. Intenta tomarla de nuevo o describir el plato abajo.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (isOpen && defaultTag) {
      setSelectedTag(defaultTag);
    }
  }, [isOpen, defaultTag]);

  useEffect(() => {
    if (isOpen && initialFile) {
      void processIncomingFile(initialFile).finally(() => {
        onInitialFileConsumed?.();
      });
    }
  }, [isOpen, initialFile]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processIncomingFile(file);
    e.target.value = '';
  };

  const handleAnalyzeClick = async () => {
    if (!imageBase64 && !optionalNote.trim()) return;
    setIsAnalyzing(true);
    setErrorMsg(null);
    try {
      const aiRes = await analyzeMealPhotoWithGemini(
        imageBase64,
        imageMimeType,
        optionalNote,
        state
      );
      populateResult(aiRes);
    } catch {
      setErrorMsg('Error al consultar Gemini Vision. Verifica tu señal e intenta de nuevo.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applyCorrection = async (overrideText?: string) => {
    const corr = (overrideText ?? correctionInput).trim();
    if (!corr) return;
    setIsAnalyzing(true);
    setErrorMsg(null);
    try {
      const aiRes = await analyzeMealPhotoWithGemini(
        imageBase64,
        imageMimeType,
        optionalNote,
        state,
        result,
        corr
      );
      populateResult(aiRes);
      if (!aiRes.visionUnavailable) {
        setCorrectionInput('');
      }
    } catch (err) {
      console.warn('Error applying vision correction:', err);
      setErrorMsg('No se pudo recalcular el plato. Intenta nuevamente.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const scaledCalories = Math.round(baseCalories * multiplier);
  const scaledProtein = Math.round(baseProteinG * multiplier);
  const scaledCarbs = Math.round(baseCarbsG * multiplier);
  const scaledFat = Math.round(baseFatG * multiplier);

  const handleRegisterMeal = () => {
    if (!dishName.trim()) return;
    addCustomMeal(
      {
        name: `📸 ${dishName.trim()}`,
        calories: scaledCalories,
        proteinG: scaledProtein,
        carbsG: scaledCarbs,
        fatG: scaledFat,
        tag: selectedTag,
      },
      targetDate
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-xl bg-[#111827] border border-[#10B981]/50 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 my-auto max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10B981]/25 to-[#3B82F6]/25 border border-[#10B981]/40 flex items-center justify-center text-[#10B981] shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#10B981]/20 text-[#10B981]">
                Escáner Nutricional Gemini Vision IA
              </span>
              <h3 className="text-base font-extrabold text-white mt-0.5">
                Calcular Calorías y Macros por Fotografía
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="bg-[#090D16] border border-gray-800 rounded-xl p-3 space-y-2">
          <label className="text-[11px] font-bold text-gray-300 block">
            Nota opcional para mayor precisión (o déjalo en blanco y toma la foto):
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={optionalNote}
              onChange={(e) => setOptionalNote(e.target.value)}
              placeholder="Ej. Pechuga a la plancha con arroz y aguacate, o 4 huevos con tortilla..."
              className="flex-1 bg-[#111827] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:border-[#10B981] focus:outline-none"
            />
            {(imageBase64 || optionalNote.trim()) && (
              <button
                type="button"
                onClick={handleAnalyzeClick}
                disabled={isAnalyzing}
                className="px-3 py-2 rounded-xl bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-white font-bold text-xs flex items-center gap-1.5 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                <span>Analizar IA</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={isAnalyzing}
            className="p-3.5 rounded-2xl bg-gradient-to-r from-[#10B981] to-emerald-500 hover:opacity-95 text-gray-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#10B981]/20 transition"
          >
            <Camera className="w-4 h-4" />
            <span>📷 Tomar Foto al Plato (Cámara)</span>
          </button>

          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            disabled={isAnalyzing}
            className="p-3.5 rounded-2xl bg-[#090D16] hover:bg-gray-800 border border-[#3B82F6]/40 text-[#3B82F6] font-extrabold text-xs flex items-center justify-center gap-2 transition"
          >
            <ImageIcon className="w-4 h-4" />
            <span>🖼️ Subir Foto desde Galería</span>
          </button>
        </div>

        {previewUrl && (
          <div className="relative rounded-2xl overflow-hidden border border-gray-700 bg-black max-h-56 flex items-center justify-center">
            <img
              src={previewUrl}
              alt="Plato capturado"
              className="max-h-56 w-auto object-contain"
            />
            {isAnalyzing && (
              <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2">
                <div className="w-10 h-10 rounded-full border-2 border-[#10B981] border-t-transparent animate-spin" />
                <span className="text-xs font-extrabold text-[#10B981] animate-pulse">
                  Escaneando ingredientes, gramaje y densidad calórica con IA...
                </span>
              </div>
            )}
          </div>
        )}

        {errorMsg && !isAnalyzing && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 text-xs text-amber-200 flex items-center gap-2">
            <TriangleAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {result && !isAnalyzing && (
          <div
            className={`space-y-3.5 bg-[#090D16] border rounded-2xl p-3.5 ${
              result.visionUnavailable ? 'border-amber-500/50' : 'border-[#10B981]/40'
            }`}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                  result.visionUnavailable
                    ? 'bg-amber-500/20 text-amber-300'
                    : result.source === 'gemini-vision'
                    ? 'bg-[#10B981]/20 text-[#10B981]'
                    : 'bg-[#3B82F6]/20 text-[#3B82F6]'
                }`}
              >
                {result.visionUnavailable ? (
                  <TriangleAlert className="w-3 h-3" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                {result.visionUnavailable
                  ? 'Sin respuesta de Gemini Vision'
                  : result.source === 'gemini-vision'
                  ? 'Detectado por Google Gemini Cloud Vision'
                  : 'Calculado por Motor Clínico APEX'}
              </span>
              <span className="text-[11px] font-mono text-gray-400">{result.portionDetails}</span>
            </div>

            {result.visionUnavailable && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/35 space-y-2.5">
                <p className="text-xs text-amber-200 leading-relaxed">
                  {result.coachRecommendation}
                </p>
                {imageBase64 && (
                  <button
                    type="button"
                    onClick={() => void handleAnalyzeClick()}
                    disabled={isAnalyzing}
                    className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-gray-950 font-extrabold text-xs flex items-center justify-center gap-2 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                    <span>Reintentar Foto con Gemini Vision</span>
                  </button>
                )}
              </div>
            )}

            {result.detectedIngredients.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-gray-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-[#3B82F6]" />
                    <span>Desglose de Alimentos Detectados en el Plato:</span>
                  </span>
                  <span className="text-[10px] font-mono text-[#10B981]">Tazas ⇄ Gramos</span>
                </div>

                <div className="grid grid-cols-1 gap-1.5">
                  {result.detectedIngredients.map((ing, idx) => (
                    <div
                      key={idx}
                      className="px-2.5 py-2 rounded-xl bg-[#111827] border border-gray-800 flex items-center justify-between text-[11px] gap-2"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-gray-200 break-words">{ing.name}</span>
                        <span className="text-cyan-300 font-mono text-[10px] font-bold">
                          📏{' '}
                          {ing.portion
                            ? ing.portion
                            : `~${Math.round((ing.grams || 100) * multiplier)}g`}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 font-mono shrink-0">
                        <span className="text-white font-bold">
                          {Math.round(ing.calories * multiplier)} kcal
                        </span>
                        <span className="text-[#3B82F6]">
                          P:{Math.round(ing.proteinG * multiplier)}g
                        </span>
                        <span className="text-[#F59E0B]">
                          C:{Math.round(ing.carbsG * multiplier)}g
                        </span>
                        <span className="text-purple-400">
                          G:{Math.round(ing.fatG * multiplier)}g
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-[#111827] border border-[#3B82F6]/50 rounded-2xl p-3 space-y-2.5 shadow-lg">
              <div className="flex items-center justify-between gap-1 flex-wrap">
                <span className="text-xs font-extrabold text-[#3B82F6] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {result.visionUnavailable
                    ? 'Escribe qué tiene tu plato para calcularlo al instante:'
                    : '¿La IA calculó mal algo o cambió una porción? Corrígela aquí:'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowCupsGuide(!showCupsGuide)}
                  className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1 font-mono"
                >
                  📏 {showCupsGuide ? 'Ocultar Guía' : 'Ver Guía Tazas a Gramos'}
                </button>
              </div>

              {showCupsGuide && (
                <div className="p-2.5 rounded-xl bg-[#090D16] border border-cyan-500/30 text-[10px] text-gray-300 space-y-1.5 font-mono">
                  <span className="text-cyan-300 font-bold block">
                    📏 Equivalencias Oficiales (Tazas ⇄ Gramos):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[10px]">
                    {CUPS_TO_GRAMS_GUIDE.map((item) => (
                      <div key={item.foodKey} className="text-gray-300">
                        • <strong className="text-white">{item.name}:</strong> {item.notes}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  value={correctionInput}
                  onChange={(e) => setCorrectionInput(e.target.value)}
                  placeholder="Ej: '1 huevo frito, gallopinto y 4 rodajas de salchichón' o 'Fue 1/2 taza de arroz'"
                  className="flex-1 bg-[#090D16] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:border-[#3B82F6] focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void applyCorrection();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => void applyCorrection()}
                  disabled={isAnalyzing || !correctionInput.trim()}
                  className="px-3.5 py-2 rounded-xl bg-[#3B82F6] hover:bg-[#3B82F6]/90 disabled:opacity-50 text-white font-extrabold text-xs flex items-center gap-1.5 shrink-0 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                  <span>{result.visionUnavailable ? 'Calcular' : 'Re-calcular'}</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[10px] text-gray-400 font-mono">Ajustes frecuentes:</span>
                {[
                  'Fue 1/2 taza de gallo pinto',
                  'No fue 1 taza de arroz, fue 1/2 taza solamente (~80g)',
                  'Fue 1/4 taza de arroz (~40g)',
                  'Fue 1/2 taza de frijoles (~85g)',
                  'Fueron 100g de carne',
                  'Fueron 150g de pechuga de pollo',
                  'Sin aceite añadido',
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={isAnalyzing}
                    onClick={() => {
                      setCorrectionInput(preset);
                      void applyCorrection(preset);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-[#090D16] hover:bg-gray-800 border border-gray-700 hover:border-[#3B82F6] text-gray-300 text-[10px] transition"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {!result.visionUnavailable && (
              <>
                <div className="pt-1">
                  <label className="text-[11px] text-gray-400 block mb-1.5">
                    Ajustar tamaño del plato servido (Multiplicador de Porción):
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { mult: 0.5, label: '0.5x (Medio)' },
                      { mult: 0.75, label: '0.75x (Ligero)' },
                      { mult: 1, label: '1.0x (Estándar)' },
                      { mult: 1.25, label: '1.25x (Grande)' },
                      { mult: 1.5, label: '1.5x (Doble)' },
                    ].map((opt) => (
                      <button
                        key={opt.mult}
                        type="button"
                        onClick={() => setMultiplier(opt.mult)}
                        className={`py-1.5 px-1 rounded-xl text-[10px] font-bold border transition ${
                          multiplier === opt.mult
                            ? 'bg-[#3B82F6] border-[#3B82F6] text-white'
                            : 'bg-[#111827] border-gray-800 text-gray-400 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">
                      Nombre del Plato
                    </label>
                    <input
                      type="text"
                      value={dishName}
                      onChange={(e) => setDishName(e.target.value)}
                      className="w-full bg-[#111827] border border-gray-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">
                      Momento / Comida del Día
                    </label>
                    <select
                      value={selectedTag}
                      onChange={(e) => setSelectedTag(e.target.value as NutritionMealTag)}
                      className="w-full bg-[#111827] border border-gray-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="Desayuno">🌅 Desayuno</option>
                      <option value="Almuerzo">☀️ Almuerzo</option>
                      <option value="Merienda">🍎 Merienda / Colación</option>
                      <option value="Cena">🌙 Cena</option>
                      <option value="Post-Entreno">⚡ Post-Entreno</option>
                      <option value="Pre-HIIT">🔥 Pre-HIIT</option>
                      <option value="Comida Fuerte">🍽️ Comida Fuerte</option>
                      <option value="Snack Proteico">🥜 Snack Proteico</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-[#111827] border border-gray-800 rounded-xl p-2 text-center">
                    <span className="text-[10px] text-gray-400 block flex items-center justify-center gap-1">
                      <Flame className="w-3 h-3 text-[#10B981]" />
                      Calorías
                    </span>
                    <input
                      type="number"
                      value={scaledCalories}
                      onChange={(e) => {
                        setMultiplier(1);
                        setBaseCalories(Number(e.target.value));
                      }}
                      className="w-full bg-transparent text-center font-mono font-extrabold text-sm text-white focus:outline-none mt-0.5"
                    />
                  </div>

                  <div className="bg-[#111827] border border-gray-800 rounded-xl p-2 text-center">
                    <span className="text-[10px] text-gray-400 block">Proteína (g)</span>
                    <input
                      type="number"
                      value={scaledProtein}
                      onChange={(e) => {
                        setMultiplier(1);
                        setBaseProteinG(Number(e.target.value));
                      }}
                      className="w-full bg-transparent text-center font-mono font-extrabold text-sm text-[#3B82F6] focus:outline-none mt-0.5"
                    />
                  </div>

                  <div className="bg-[#111827] border border-gray-800 rounded-xl p-2 text-center">
                    <span className="text-[10px] text-gray-400 block">Carbs (g)</span>
                    <input
                      type="number"
                      value={scaledCarbs}
                      onChange={(e) => {
                        setMultiplier(1);
                        setBaseCarbsG(Number(e.target.value));
                      }}
                      className="w-full bg-transparent text-center font-mono font-extrabold text-sm text-[#F59E0B] focus:outline-none mt-0.5"
                    />
                  </div>

                  <div className="bg-[#111827] border border-gray-800 rounded-xl p-2 text-center">
                    <span className="text-[10px] text-gray-400 block">Grasas (g)</span>
                    <input
                      type="number"
                      value={scaledFat}
                      onChange={(e) => {
                        setMultiplier(1);
                        setBaseFatG(Number(e.target.value));
                      }}
                      className="w-full bg-transparent text-center font-mono font-extrabold text-sm text-purple-400 focus:outline-none mt-0.5"
                    />
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#3B82F6]/10 border border-[#3B82F6]/30 text-[11px] text-blue-200 flex items-start gap-2">
                  <Utensils className="w-4 h-4 text-[#3B82F6] shrink-0 mt-0.5" />
                  <span>{result.coachRecommendation}</span>
                </div>

                <button
                  type="button"
                  onClick={handleRegisterMeal}
                  disabled={!dishName.trim() || scaledCalories <= 0}
                  className="w-full py-3 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 disabled:opacity-45 text-gray-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#10B981]/20 transition"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    Registrar Plato en {targetDateLabel || 'Mi Día'} (+{scaledCalories} kcal •{' '}
                    {scaledProtein}g Proteína)
                  </span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
