import React, { useState } from 'react';
import {
  LayoutDashboard,
  Dumbbell,
  Zap,
  Scale,
  Utensils,
  Settings,
  Download,
  Timer,
  Activity,
} from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { NavigationTab } from './types/fitness';
import { RestTimerBanner } from './components/RestTimerBanner';
import { SettingsModal } from './components/SettingsModal';
import { DashboardModule } from './modules/DashboardModule';
import { StrengthModule } from './modules/StrengthModule';
import { InsanityModule } from './modules/InsanityModule';
import { BiometricsModule } from './modules/BiometricsModule';
import { NutritionModule } from './modules/NutritionModule';
import { exportStateAsJson } from './services/storageService';

const MainShell: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { state, restTimer, startRestTimer } = useApp();

  const navItems: Array<{
    id: NavigationTab;
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
                <span className="hidden sm:inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-gray-800 text-gray-300">
                  Hybrid PWA
                </span>
              </div>
              <p className="text-[10px] text-gray-400 hidden sm:block">
                Torso/Pierna • Insanity 63D • Camry 8E • Galaxy Watch 7
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Quick Rest Timer Launcher if not active */}
            {!restTimer.isActive && (
              <button
                onClick={() => startRestTimer(90, 'Descanso Rápido', 'Multiarticular Intermedio (90s)')}
                className="px-2.5 py-1.5 rounded-xl bg-[#111827] hover:bg-gray-800 border border-gray-800 text-xs font-bold text-[#3B82F6] flex items-center gap-1.5 transition"
                title="Iniciar Temporizador de 90s"
              >
                <Timer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Timer 90s</span>
              </button>
            )}

            {/* Direct JSON Backup Export Button */}
            <button
              onClick={() => exportStateAsJson(state)}
              className="px-2.5 py-1.5 rounded-xl bg-[#111827] hover:bg-gray-800 border border-gray-800 text-xs font-bold text-[#10B981] flex items-center gap-1.5 transition"
              title="Exportar Respaldo JSON inmediato"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Respaldo JSON</span>
            </button>

            {/* Settings & Import/Export Modal */}
            <button
              onClick={() => setIsSettingsOpen(true)}
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

      {/* Main Content Container */}
      <main
        className={`flex-1 max-w-6xl w-full mx-auto px-3.5 sm:px-6 pb-24 ${
          restTimer.isActive || restTimer.isFinishedAlert ? 'pt-20' : 'pt-4'
        }`}
      >
        {activeTab === 'dashboard' && <DashboardModule onNavigate={setActiveTab} />}
        {activeTab === 'strength' && <StrengthModule />}
        {activeTab === 'insanity' && <InsanityModule />}
        {activeTab === 'camry' && <BiometricsModule />}
        {activeTab === 'nutrition' && <NutritionModule />}
      </main>

      {/* Fixed Mobile-First One-Handed Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#090D16]/95 backdrop-blur-xl border-t border-gray-800/90">
        <div className="max-w-xl mx-auto px-2 h-16 grid grid-cols-5 gap-1 items-center">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            const isSelected = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 transition relative ${
                  isSelected
                    ? 'bg-[#111827] text-white border border-gray-700/80 shadow-lg'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {isSelected && (
                  <span className="absolute -top-[1px] w-7 h-0.5 rounded-full bg-[#10B981]" />
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

      {/* Settings / JSON Backup / Hardware Modal */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};

export function App() {
  return (
    <AppProvider>
      <MainShell />
    </AppProvider>
  );
}

export default App;
