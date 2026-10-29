import React, { useRef, useState } from 'react';
import {
  X,
  Download,
  Upload,
  Database,
  Cloud,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Dumbbell,
  Cpu,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { exportStateAsJson, parseImportedJson } from '../services/storageService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { state, replaceFullState, resetToFactorySeed, updateFirebaseConfig } = useApp();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [fbProjectId, setFbProjectId] = useState(state.firebaseConfig.projectId);
  const [fbApiKey, setFbApiKey] = useState(state.firebaseConfig.apiKey);
  const [fbAppId, setFbAppId] = useState(state.firebaseConfig.appId);

  if (!isOpen) return null;

  const handleExport = () => {
    exportStateAsJson(state);
    setStatusMsg({
      type: 'success',
      text: 'Respaldo JSON descargado exitosamente. Tus datos están seguros localmente.',
    });
  };

  const handleImportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = String(event.target?.result || '');
        const importedState = parseImportedJson(content);
        replaceFullState(importedState);
        setStatusMsg({
          type: 'success',
          text: 'Respaldo JSON importado y sincronizado en localStorage + IndexedDB.',
        });
      } catch (err) {
        setStatusMsg({
          type: 'error',
          text: err instanceof Error ? err.message : 'Error al leer el archivo JSON.',
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSaveFirebase = (e: React.FormEvent) => {
    e.preventDefault();
    updateFirebaseConfig({
      enabled: Boolean(fbProjectId.trim() && fbApiKey.trim()),
      projectId: fbProjectId.trim(),
      apiKey: fbApiKey.trim(),
      appId: fbAppId.trim(),
      lastSync: new Date().toLocaleTimeString(),
    });
    setStatusMsg({
      type: 'success',
      text: fbProjectId.trim()
        ? 'Configuración Firebase guardada. Persistencia dual activa (Firestore + IndexedDB/localStorage).'
        : 'Modo Offline-First local (IndexedDB + localStorage) activo.',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111827] border border-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#111827]/95 backdrop-blur border-b border-gray-800 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#10B981]/15 text-[#10B981]">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Ajustes, Respaldo JSON y Hardware</h2>
              <p className="text-xs text-gray-400">Persistencia Híbrida IndexedDB + localStorage + Firebase Ready</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-gray-800 text-gray-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {statusMsg && (
            <div
              className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-medium ${
                statusMsg.type === 'success'
                  ? 'bg-[#10B981]/10 border-[#10B981]/40 text-[#10B981]'
                  : 'bg-red-500/10 border-red-500/40 text-red-400'
              }`}
            >
              {statusMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* Export / Import JSON Section */}
          <div className="bg-[#090D16] border border-gray-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Download className="w-4 h-4 text-[#10B981]" />
                  Exportar / Importar Respaldo JSON
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Guarda o restaura tu historial completo (Fuerza, Insanity 63D, Fit Tests, Báscula Camry 8E y Nutrición).
                </p>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#10B981]/15 text-[#10B981]">
                100% Offline Ready
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
              <button
                onClick={handleExport}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#10B981]/90 text-gray-950 font-bold text-xs transition"
              >
                <Download className="w-4 h-4" />
                Exportar Respaldo JSON
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#3B82F6] hover:bg-[#3B82F6]/90 text-white font-bold text-xs transition"
              >
                <Upload className="w-4 h-4" />
                Importar Respaldo JSON
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImportChange}
                className="hidden"
              />

              <button
                onClick={() => {
                  resetToFactorySeed();
                  setStatusMsg({
                    type: 'success',
                    text: 'Datos restaurados al Seed Data inicial preconfigurado.',
                  });
                }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold text-xs transition"
              >
                <RotateCcw className="w-4 h-4" />
                Restaurar Seed Data
              </button>
            </div>
          </div>

          {/* Hardware Inventory Section */}
          <div className="bg-[#090D16] border border-gray-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-[#3B82F6]" />
                Inventario de Hardware y Equipo Preconfigurado
              </h3>
              <span className="text-[11px] text-gray-400">5 Sistemas Activos</span>
            </div>

            <div className="space-y-2.5">
              {state.hardwareInventory.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-[#111827] border border-gray-800/90 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white">{item.name}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#3B82F6]/15 text-[#3B82F6]">
                      {item.trackingUnit}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400">{item.subtitle}</p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-1">
                    {item.specs.map((s, i) => (
                      <li key={i} className="text-[11px] text-gray-300 flex items-start gap-1.5">
                        <span className="text-[#10B981] mt-0.5">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Firebase Cloud Sync Connector */}
          <form onSubmit={handleSaveFirebase} className="bg-[#090D16] border border-gray-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-[#F59E0B]" />
                  Conector Modular Firebase (Firestore + Auth)
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Fallback activo en <code className="text-[#10B981]">localStorage + IndexedDB</code> para uso 100% offline.
                </p>
              </div>
              <span
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                  state.firebaseConfig.enabled
                    ? 'bg-[#10B981]/15 text-[#10B981]'
                    : 'bg-gray-800 text-gray-300'
                }`}
              >
                {state.firebaseConfig.enabled ? 'Cloud Sync Preparado' : 'Local / Offline Mode'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">Firebase Project ID</label>
                <input
                  type="text"
                  value={fbProjectId}
                  onChange={(e) => setFbProjectId(e.target.value)}
                  placeholder="ej. apex-recomp-fit"
                  className="w-full px-3 py-2 rounded-xl bg-[#111827] border border-gray-800 text-xs text-white focus:border-[#3B82F6] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">Firebase API Key</label>
                <input
                  type="password"
                  value={fbApiKey}
                  onChange={(e) => setFbApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-3 py-2 rounded-xl bg-[#111827] border border-gray-800 text-xs text-white focus:border-[#3B82F6] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">App ID</label>
                <input
                  type="text"
                  value={fbAppId}
                  onChange={(e) => setFbAppId(e.target.value)}
                  placeholder="1:123456:web:abcdef"
                  className="w-full px-3 py-2 rounded-xl bg-[#111827] border border-gray-800 text-xs text-white focus:border-[#3B82F6] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-bold text-white flex items-center gap-1.5 transition"
              >
                <Cpu className="w-3.5 h-3.5 text-[#F59E0B]" />
                Guardar Configuración de Persistencia
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
