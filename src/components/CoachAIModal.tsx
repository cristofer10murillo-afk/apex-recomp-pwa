import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  CircleCheck,
  Dumbbell,
  Flame,
  KeyRound,
  Scale,
  Send,
  Sparkles,
  Trash2,
  Utensils,
  X,
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  getEffectiveGeminiKey,
  getQuickCoachPrompts,
  saveCustomGeminiKey,
  sendMessageToCoachAI,
  testGeminiApiKey,
} from '../services/aiService';
import { computeCoachIntelligence } from '../services/coachIntelligence';
import { CoachChatMessage } from '../types/fitness';

interface CoachAIModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CoachAIModal: React.FC<CoachAIModalProps> = ({ isOpen, onClose }) => {
  const {
    state,
    addCustomMeal,
    updateUserProfile,
    getDynamicCalorieTarget,
    setCoachChatHistory,
  } = useApp();
  const latestCamry = state.camryHistory[state.camryHistory.length - 1];
  const isInsanityOnly = state.trainingMode === 'insanity_only';
  const quickPrompts = getQuickCoachPrompts(state);
  const { targetCalories, consumedCalories } = getDynamicCalorieTarget();
  const totalProt = state.nutrition.loggedMeals.reduce((a, m) => a + m.proteinG, 0);
  const currentWeightKg = latestCamry?.weightKg || 83.3;
  const currentFatPct = latestCamry?.bodyFatPercent || 33.9;
  const currentLeanKg =
    latestCamry?.leanBodyMassKg || Math.round(currentWeightKg * (1 - currentFatPct / 100) * 10) / 10;
  const proteinBaseWeightKg =
    currentFatPct > 25
      ? latestCamry?.standardWeightKg || Math.round(currentLeanKg * 1.18 * 10) / 10
      : currentWeightKg;
  const insanityDay =
    state.insanityCalendar.find((d) => d.dayNumber === state.currentInsanityDay) ||
    state.insanityCalendar[0];
  const weekday = state.selectedWeekdayIndex;
  const isHighCarbDay = isInsanityOnly
    ? !insanityDay.isRestDay && weekday !== 0
    : !(weekday === 0 || weekday === 4 || weekday === 3) ||
      [1, 2, 5].includes(weekday) ||
      (insanityDay.isMaxInterval && weekday !== 0 && weekday !== 4);
  const ageFactor = (state.userProfile?.age ?? 38) >= 35 ? 0.1 : 0;
  const targetProteinG = Math.round(
    isHighCarbDay ? proteinBaseWeightKg * (2.25 + ageFactor) : proteinBaseWeightKg * (2.4 + ageFactor)
  );
  const intel = computeCoachIntelligence(
    state,
    targetCalories,
    consumedCalories,
    targetProteinG,
    totalProt
  );

  const buildWelcomeMessage = (): CoachChatMessage => ({
    id: 'welcome-ai',
    role: 'assistant',
    timestamp: 'En vivo',
    source: 'apex-neural-local',
    content: `¡Hola **Cristopher**! Soy tu **APEX AI Coach** (${
      isInsanityOnly ? '⚡ Modo Solo Insanity Activo' : '🏋️ Modo Híbrido Completo'
    }). Tengo cargado tu reporte **MovingLife (${latestCamry?.weightKg ?? 83.3} kg | ${
      latestCamry?.bodyFatPercent ?? 33.9
    }% grasa | IMB ${latestCamry?.bmrKcal ?? 1558} kcal | Masa Magra ${
      latestCamry?.leanBodyMassKg ?? 55
    } kg)**${
      isInsanityOnly
        ? ', tu rutina **Solo Insanity (Fuerza en pausa temporal)**'
        : ', tu equipamiento (**Forza Gym, Banco XR 6.1, Mancuernas de 25 kg**)'
    }, tu calendario **Insanity (Día ${state.currentInsanityDay}/63)** y tu **Readiness de hoy (${
      intel.readiness.score
    }/100 — ${intel.readiness.label})**.

Escribe cualquier pregunta o elige una opción:
1️⃣ **Escribe 1:** Si quieres que te arme una comida exacta para tus calorías y proteínas restantes de hoy.
2️⃣ **Escribe 2:** Para revisar ${
      isInsanityOnly
        ? 'tu estrategia táctica Solo Insanity HIIT de hoy y cómo proteger músculo.'
        : 'tu rutina de entrenamiento y orden de ejecución hoy.'
    }
3️⃣ **Escribe 3:** Para ver el plan clínico para bajar tu grasa visceral de Nivel ${
      latestCamry?.visceralFatIndex ?? 13
    } a Nivel ≤9.`,
  });

  const [messages, setMessages] = useState<CoachChatMessage[]>(() =>
    state.coachChatHistory && state.coachChatHistory.length > 0
      ? state.coachChatHistory
      : [buildWelcomeMessage()]
  );

  // Sync cloud chat history if downloaded after initial mount and user hasn't started chatting locally
  useEffect(() => {
    if (
      state.coachChatHistory &&
      state.coachChatHistory.length > 0 &&
      messages.length <= 1 &&
      messages[0]?.id === 'welcome-ai'
    ) {
      setMessages(state.coachChatHistory);
    }
  }, [state.coachChatHistory]);

  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showKeyPanel, setShowKeyPanel] = useState(false);
  const [keyInput, setKeyInput] = useState(() => getEffectiveGeminiKey(state));
  const [testingKey, setTestingKey] = useState(false);
  const [keyFeedback, setKeyFeedback] = useState<string | null>(null);
  const [keyActive, setKeyActive] = useState(Boolean(getEffectiveGeminiKey(state)));
  const [mealLoggedToast, setMealLoggedToast] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = async (overrideText?: string) => {
    const query = (overrideText ?? inputText).trim();
    if (!query || isSending) return;

    const userMsg: CoachChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    const nextWithUser = [...messages, userMsg];
    setMessages(nextWithUser);
    if (!overrideText) setInputText('');
    setIsSending(true);

    try {
      const reply = await sendMessageToCoachAI(query, state, messages);
      const nextWithReply = [...nextWithUser, reply];
      setMessages(nextWithReply);
      setCoachChatHistory(nextWithReply);
    } finally {
      setIsSending(false);
    }
  };

  const handleTestAndSaveKey = async () => {
    if (!keyInput.trim()) {
      saveCustomGeminiKey('');
      updateUserProfile({ geminiApiKey: '' });
      setKeyActive(false);
      setKeyFeedback(
        'Clave eliminada. El coach continuará operando con el Motor Biométrico Local.'
      );
      return;
    }

    setTestingKey(true);
    setKeyFeedback('Verificando clave con Google Generative Language API...');
    try {
      const res = await testGeminiApiKey(keyInput.trim());
      if (res.ok) {
        saveCustomGeminiKey(keyInput.trim());
        updateUserProfile({ geminiApiKey: keyInput.trim() });
        setKeyActive(true);
        setKeyFeedback(`✅ ¡Conexión exitosa! ${res.message}`);
        window.setTimeout(() => setShowKeyPanel(false), 2000);
      } else {
        setKeyActive(false);
        setKeyFeedback(`❌ ${res.message}`);
      }
    } finally {
      setTestingKey(false);
    }
  };

  const handleQuickAction = (msg: CoachChatMessage) => {
    if (msg.quickAction && msg.quickAction.type === 'log_meal') {
      const meal = msg.quickAction.payload;
      addCustomMeal(meal);
      setMealLoggedToast(`✓ "${meal.name}" añadida a tu registro de Nutrición de hoy.`);
      window.setTimeout(() => setMealLoggedToast(null), 4000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#111827] border border-gray-800 w-full max-w-2xl h-[90vh] sm:h-[82vh] sm:rounded-2xl rounded-t-3xl flex flex-col overflow-hidden shadow-2xl">
        <div className="bg-[#090D16] border-b border-gray-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#10B981] to-[#3B82F6] flex items-center justify-center text-gray-950 shadow-md">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-extrabold text-white">APEX AI COACH</h2>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    keyActive && keyInput
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-[#3B82F6]/20 text-[#3B82F6] border-[#3B82F6]/30'
                  }`}
                >
                  {keyActive && keyInput
                    ? '🟢 Gemini Cloud Activo'
                    : '⚡ Motor Biométrico Local (Activo)'}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                    isInsanityOnly
                      ? 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30'
                      : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                  }`}
                >
                  {isInsanityOnly ? (
                    <>
                      <Zap className="w-2.5 h-2.5" />
                      Solo Insanity
                    </>
                  ) : (
                    <>
                      <Dumbbell className="w-2.5 h-2.5" />
                      Híbrido
                    </>
                  )}
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                Conectado a tu báscula Camry ({latestCamry?.weightKg ?? 83.3} kg •{' '}
                {latestCamry?.bodyFatPercent ?? 33.9}% grasa • {latestCamry?.bmrKcal ?? 1558} kcal
                IMB)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowKeyPanel(!showKeyPanel)}
              title="Configurar API Key de Google Gemini"
              className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1 transition ${
                keyInput
                  ? 'bg-[#3B82F6]/20 border-[#3B82F6]/40 text-[#3B82F6]'
                  : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Gemini API</span>
            </button>

            <button
              onClick={() => {
                const cleared = [buildWelcomeMessage()];
                setMessages(cleared);
                setCoachChatHistory([]);
              }}
              title="Limpiar conversación"
              className="p-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 hover:text-white transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showKeyPanel && (
          <div className="bg-[#090D16]/95 border-b border-gray-800 px-4 py-3 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-gray-200">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#10B981]" />
                Conectar con Google AI Studio (Gemini en la Nube)
              </span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[#3B82F6] hover:underline flex items-center gap-1 text-[11px]"
              >
                Obtener clave gratis ↗
              </a>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              El <strong>Motor Biométrico Local APEX</strong> ya funciona al 100% sin claves. Si
              deseas conectar el modelo masivo en la nube de Google, pega una API Key gratuita
              generada en <strong className="text-gray-200">Google AI Studio</strong> (la clave de
              Firebase tiene restricciones de servicio impuestas por Google).
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="AIzaSy... (API Key de Google AI Studio)"
                className="flex-1 bg-[#111827] border border-gray-700 rounded-xl px-3 py-1.5 text-xs text-white focus:border-[#10B981] focus:outline-none"
              />
              <button
                onClick={handleTestAndSaveKey}
                disabled={testingKey}
                className="px-3.5 py-1.5 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-gray-950 font-bold text-xs flex items-center gap-1 transition"
              >
                <CircleCheck className="w-3.5 h-3.5" />
                <span>{testingKey ? 'Verificando...' : 'Probar y Guardar'}</span>
              </button>
            </div>
            {keyFeedback && (
              <p
                className={`text-[11px] font-medium ${
                  keyActive ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {keyFeedback}
              </p>
            )}
          </div>
        )}

        <div className="bg-[#090D16]/60 border-b border-gray-800/80 px-4 py-2 flex items-center gap-3 overflow-x-auto text-[11px] shrink-0">
          <span className="inline-flex items-center gap-1 text-gray-300 shrink-0">
            <Scale className="w-3 h-3 text-purple-400" />
            <strong>{latestCamry?.weightKg ?? 83.3} kg</strong> ({latestCamry?.bodyFatPercent ?? 33.9}
            % grasa)
          </span>
          <span className="text-gray-700">•</span>
          <span className="inline-flex items-center gap-1 text-gray-300 shrink-0">
            <Dumbbell className="w-3 h-3 text-[#3B82F6]" />
            Piernas:{' '}
            <strong className="text-[#F59E0B]">
              {latestCamry?.segments.leftLeg.muscleRatioPct ?? 87.7}% L /{' '}
              {latestCamry?.segments.rightLeg.muscleRatioPct ?? 88.9}% R (
              {latestCamry?.segments.leftLeg.muscleStatus ?? 'Bajo'})
            </strong>
          </span>
          <span className="text-gray-700">•</span>
          <span className="inline-flex items-center gap-1 text-gray-300 shrink-0">
            <Flame className="w-3 h-3 text-[#10B981]" />
            IMB: <strong>{latestCamry?.bmrKcal ?? 1558} kcal</strong>
          </span>
          <span className="text-gray-700">•</span>
          <span className="inline-flex items-center gap-1 text-gray-300 shrink-0">
            Readiness:{' '}
            <strong
              className={
                intel.readiness.level === 'optimo'
                  ? 'text-emerald-400'
                  : intel.readiness.level === 'moderado'
                  ? 'text-amber-300'
                  : 'text-rose-400'
              }
            >
              {intel.readiness.score}/100 ({intel.readiness.label})
            </strong>
          </span>
        </div>

        {mealLoggedToast && (
          <div className="mx-4 mt-2 p-2 rounded-xl bg-[#10B981]/20 border border-[#10B981]/40 text-[#10B981] text-xs font-bold">
            {mealLoggedToast}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[90%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#3B82F6] text-white font-medium rounded-br-sm'
                    : 'bg-[#090D16] border border-gray-800 text-gray-200 rounded-bl-sm'
                }`}
              >
                <div className="whitespace-pre-line">{msg.content}</div>
                {msg.quickAction && (
                  <button
                    onClick={() => handleQuickAction(msg)}
                    className="mt-3 w-full py-2 px-3 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-gray-950 font-extrabold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <Utensils className="w-3.5 h-3.5" />
                    <span>{msg.quickAction.label}</span>
                  </button>
                )}
              </div>
              <span className="text-[10px] text-gray-500 mt-1 px-1">
                {msg.role === 'user' ? 'Tú' : 'APEX AI Coach'} • {msg.timestamp}
              </span>
            </div>
          ))}

          {isSending && (
            <div className="flex items-center gap-2 text-xs text-[#10B981] bg-[#090D16] border border-gray-800 rounded-2xl px-4 py-3 w-fit">
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>Analizando tu biometría MovingLife, macros y rutina...</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="px-4 py-2 bg-[#090D16]/90 border-t border-gray-800/80 flex items-center gap-2 overflow-x-auto shrink-0">
          {quickPrompts.map((qp) => (
            <button
              key={qp.label}
              onClick={() => handleSend(qp.prompt)}
              disabled={isSending}
              className="px-2.5 py-1.5 rounded-xl bg-[#111827] hover:bg-gray-800 border border-gray-700/80 text-[11px] font-bold text-gray-200 whitespace-nowrap transition shrink-0"
            >
              {qp.label}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-3 bg-[#090D16] border-t border-gray-800 flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Pregúntale a tu Coach IA (ej: ¿Qué ceno hoy?, ¿Cómo bajo grasa visceral?)..."
            className="flex-1 bg-[#111827] border border-gray-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-[#10B981] focus:outline-none"
          />
          <button
            type="submit"
            disabled={isSending || !inputText.trim()}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#10B981] to-[#3B82F6] text-gray-950 font-extrabold text-xs flex items-center gap-1.5 disabled:opacity-40 transition shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Preguntar</span>
          </button>
        </form>
      </div>
    </div>
  );
};
