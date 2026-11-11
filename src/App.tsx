import React, { Suspense, lazy, useEffect, useState } from 'react';
import {
  Activity,
  Bot,
  Download,
  Dumbbell,
  LayoutDashboard,
  LoaderCircle,
  Lock,
  Scale,
  Settings,
  Timer,
  Utensils,
  WifiOff,
  Zap,
} from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { ActiveTab } from './types/fitness';
import { RestTimerBanner } from './components/RestTimerBanner';
import { ModuleErrorBoundary } from './components/ModuleErrorBoundary';
import {
  PinLockScreen,
  PinSettingsModal,
  isPinSessionUnlocked,
} from './components/PinLockScreen';
import { DashboardModule } from './modules/DashboardModule';
import {
  PendingSharedPayload,
  consumePendingShare,
} from './services/shareTargetService';
import { exportBackupJson } from './services/storageService';

const StrengthModule = lazy(() =>
  import('./modules/StrengthModule').then((m) => ({ default: m.StrengthModule }))
);
const InsanityModule = lazy(() =>
  import('./modules/InsanityModule').then((m) => ({ default: m.InsanityModule }))
);
const BiometricsModule = lazy(() =>
  import('./modules/BiometricsModule').then((m) => ({ default: m.BiometricsModule }))
);
const NutritionModule = lazy(() =>
  import('./modules/NutritionModule').then((m) => ({ default: m.NutritionModule }))
);
const SettingsModal = lazy(() =>
  import('./components/SettingsModal').then((m) => ({ default: m.SettingsModal }))
);
const CoachAIModal = lazy(() =>
  import('./components/CoachAIModal').then((m) => ({ default: m.CoachAIModal }))
);
const SharedMediaRouterModal = lazy(() =>
  import('./components/SharedMediaRouterModal').then((m) => ({
    default: m.SharedMediaRouterModal,
  }))
);

const ModuleSuspenseFallback: React.FC = () => (
  <div className="py-16 flex flex-col items-center justify-center gap-3 text-gray-400">
    <LoaderCircle className="w-7 h-7 text-[#10B981] animate-spin" />
    <span className="text-xs font-mono tracking-wider uppercase">Cargando módulo...</span>
  </div>
);

const AppContent: React.FC = () => {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => isPinSessionUnlocked());
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [showSettings, setShowSettings] = useState(false);
  const [hasOpenedSettings, setHasOpenedSettings] = useState(false);
  const [showCoach, setShowCoach] = useState(false);
  const [hasOpenedCoach, setHasOpenedCoach] = useState(false);
  const [showPinSettings, setShowPinSettings] = useState(false);

  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingShare, setPendingShare] = useState<PendingSharedPayload | null>(null);
  const [sharedMealFile, setSharedMealFile] = useState<File | null>(null);
  const [globalNotice, setGlobalNotice] = useState<string | null>(null);

  const { state, setTrainingMode, restTimer, startRestTimer } = useApp();

  const triggerGlobalNotice = (msg: string) => {
    setGlobalNotice(msg);
    window.setTimeout(() => setGlobalNotice(null), 6500);
  };

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Check IndexedDB for incoming Android Web Share Target files (?shared=1)
  useEffect(() => {
    if (!isUnlocked) return;
    const checkShareInbox = async () => {
      const item = await consumePendingShare();
      if (item) {
        setPendingShare(item);
      }
      if (window.location.search.includes('shared=1')) {
        const cleanUrl = `${window.location.pathname}${window.location.hash || ''}`;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    };
    void checkShareInbox();
    const onFocus = () => {
      void checkShareInbox();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [isUnlocked]);

  // Allow Ctrl+V image screenshot paste anywhere outside form inputs
  useEffect(() => {
    if (!isUnlocked) return;
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            setPendingShare({
              file,
              title: '',
              text: '',
              url: '',
              receivedAt: Date.now(),
            });
            break;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [isUnlocked]);

  if (!isUnlocked) {
    return <PinLockScreen onUnlock={() => setIsUnlocked(true)} />;
  }

  const isInsanityOnly = state.trainingMode === 'insanity_only';

  const navItems: Array<{
    id: ActiveTab;
    label: string;
    icon: React.FC<{ className?: string }>;
    accent: string;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, accent: 'text-[#10B981]' },
    { id: 'strength', label: 'Fuerza', icon: Dumbbell, accent: 'text-[#3B82F6]' },
    { id: 'insanity', label: 'Insanity', icon: Zap, accent: 'text-[#F59E0B]' },
    { id: 'camry', label: 'Camry 8E', icon: Scale, accent: 'text-[#3B82F6]' },
    { id: 'nutrition', label: 'Nutrición', icon: Utensils, accent: 'text-[#10B981]' },
  ];

  return (
    <div className="min-h-screen bg-[#090D16] text-gray-100 flex flex-col">
      {/* Sticky Top Header */}
      <header className="sticky top-0 z-30 bg-[#090D16]/90 backdrop-blur-xl border-b border-gray-800/80">
        <div className="max-w-6xl mx-auto px-3.5 sm:px-6 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#3B82F6] via-[#10B981] to-[#F59E0B] p-[1.5px]">
              <div className="w-full h-full bg-[#090D16] rounded-[10px] flex items-center justify-center">
                <Activity className="w-4 h-4 text-[#10B981]" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-white">
                  APEX <span className="text-[#10B981]">RECOMP</span>
                </h1>
                <button
                  type="button"
                  onClick={() => setTrainingMode(isInsanityOnly ? 'hybrid' : 'insanity_only')}
                  title="Cambiar entre Solo Insanity y Modo Híbrido (Fuerza + Insanity)"
                  className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full transition ${
                    isInsanityOnly
                      ? 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30 hover:bg-[#F59E0B]/30'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {isInsanityOnly ? '⚡ Solo Insanity' : '🏋️ Hybrid PWA'}
                </button>
                {!isOnline && (
                  <span
                    title="Sin conexión: tus cambios se guardan localmente y se sincronizarán al volver"
                    className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  >
                    <WifiOff className="w-3 h-3" />
                    <span className="hidden md:inline">Offline • Local</span>
                  </span>
                )}
              </div>
              <p className="text-[10px] text-gray-400 hidden sm:block">
                {isInsanityOnly
                  ? 'Solo Insanity 63D • Camry 8E • Galaxy Watch 7'
                  : 'Torso/Pierna • Insanity 63D • Camry 8E • Galaxy Watch 7'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Coach AI Modal Trigger */}
            <button
              onClick={() => {
                setHasOpenedCoach(true);
                setShowCoach(true);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-[#10B981] to-[#3B82F6] text-gray-950 text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-[#10B981]/20 hover:opacity-95 transition"
              title="Abrir APEX AI Coach"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Coach IA</span>
            </button>

            {/* Quick Rest Timer Launcher */}
            {!restTimer.isActive && (
              <button
                onClick={() =>
                  startRestTimer(90, 'Descanso Rápido', 'Multiarticular Intermedio (90s)')
                }
                className="px-2.5 py-1.5 rounded-xl bg-[#111827] hover:bg-gray-800 border border-gray-800 text-xs font-bold text-[#3B82F6] flex items-center gap-1.5 transition"
                title="Iniciar Temporizador de 90s"
              >
                <Timer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Timer 90s</span>
              </button>
            )}

            {/* Direct JSON Backup Export */}
            <button
              onClick={() => exportBackupJson(state)}
              className="px-2.5 py-1.5 rounded-xl bg-[#111827] hover:bg-gray-800 border border-gray-800 text-xs font-bold text-[#10B981] flex items-center gap-1.5 transition"
              title="Exportar Respaldo JSON inmediato"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Respaldo JSON</span>
            </button>

            {/* PIN & Biometric Security Modal */}
            <button
              onClick={() => setShowPinSettings(true)}
              className="p-2 rounded-xl bg-[#111827] hover:bg-gray-800 border border-[#10B981]/30 text-[#10B981] transition"
              title="Seguridad Privada, Cambiar PIN o Bloquear App"
            >
              <Lock className="w-4 h-4" />
            </button>

            {/* Settings & Import/Export Modal */}
            <button
              onClick={() => {
                setHasOpenedSettings(true);
                setShowSettings(true);
              }}
              className="p-2 rounded-xl bg-[#111827] hover:bg-gray-800 border border-gray-800 text-gray-300 hover:text-white transition"
              title="Ajustes, Importar/Exportar JSON, Firebase y Hardware"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Persistent Floating Rest Timer */}
      <RestTimerBanner />

      {/* Global Toast Notice (Share Target / Offline Sync) */}
      {globalNotice && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] px-4 py-2.5 rounded-xl bg-emerald-500 text-gray-950 font-extrabold text-xs shadow-2xl border border-emerald-300 text-center">
          {globalNotice}
        </div>
      )}

      {/* Main Content Container */}
      <main
        className={`flex-1 max-w-6xl w-full mx-auto px-3.5 sm:px-6 pb-24 ${
          restTimer.isActive || restTimer.isFinishedAlert ? 'pt-20' : 'pt-4'
        }`}
      >
        <ModuleErrorBoundary>
          <Suspense fallback={<ModuleSuspenseFallback />}>
            {activeTab === 'dashboard' && <DashboardModule onNavigate={setActiveTab} />}
            {activeTab === 'strength' && <StrengthModule />}
            {activeTab === 'insanity' && <InsanityModule />}
            {(activeTab === 'camry' || activeTab === 'biometrics') && <BiometricsModule />}
            {activeTab === 'nutrition' && (
              <NutritionModule
                sharedMealFile={sharedMealFile}
                onClearSharedMealFile={() => setSharedMealFile(null)}
              />
            )}
          </Suspense>
        </ModuleErrorBoundary>
      </main>

      {/* Floating Coach AI Action Button */}
      <button
        onClick={() => {
          setHasOpenedCoach(true);
          setShowCoach(true);
        }}
        className="fixed bottom-20 right-4 z-30 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-[#10B981] to-[#3B82F6] text-gray-950 font-extrabold text-xs flex items-center gap-2 shadow-xl shadow-[#10B981]/30 border border-white/20 hover:scale-105 transition"
        title="Consultar a tu Coach IA Biométrico"
      >
        <Bot className="w-4 h-4" />
        <span>🤖 Coach IA</span>
      </button>

      {/* Fixed Mobile-First One-Handed Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#090D16]/95 backdrop-blur-xl border-t border-gray-800/90">
        <div className="max-w-xl mx-auto px-2 h-16 grid grid-cols-5 gap-1 items-center">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            const isSelected = activeTab === item.id;
            const isPausedStrength = item.id === 'strength' && isInsanityOnly;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 transition relative ${
                  isSelected
                    ? 'bg-[#111827] text-white border border-gray-700/80 shadow-lg'
                    : isPausedStrength
                    ? 'text-gray-500 opacity-75 hover:opacity-100'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {isSelected && (
                  <span className="absolute -top-[1px] w-7 h-0.5 rounded-full bg-[#10B981]" />
                )}
                {isPausedStrength && (
                  <span className="absolute top-0.5 right-1 text-[8px] font-extrabold uppercase px-1 rounded bg-[#F59E0B]/20 text-[#F59E0B]">
                    Pausa
                  </span>
                )}
                <IconComponent
                  className={`w-4 h-4 ${isSelected ? item.accent : 'text-gray-400'}`}
                />
                <span
                  className={`text-[10px] font-bold tracking-tight ${
                    isSelected ? 'text-white' : 'text-gray-400'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modals (lazy-loaded on first open) */}
      {(hasOpenedSettings || showSettings) && (
        <Suspense fallback={null}>
          <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
        </Suspense>
      )}
      {(hasOpenedCoach || showCoach) && (
        <Suspense fallback={null}>
          <CoachAIModal isOpen={showCoach} onClose={() => setShowCoach(false)} />
        </Suspense>
      )}
      {pendingShare && (
        <Suspense fallback={null}>
          <SharedMediaRouterModal
            payload={pendingShare}
            onClose={() => setPendingShare(null)}
            onNavigate={setActiveTab}
            onSendMealFile={(file) => setSharedMealFile(file)}
            onNotify={triggerGlobalNotice}
          />
        </Suspense>
      )}
      <PinSettingsModal
        isOpen={showPinSettings}
        onClose={() => setShowPinSettings(false)}
        onLockNow={() => setIsUnlocked(false)}
      />
    </div>
  );
};

export function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
