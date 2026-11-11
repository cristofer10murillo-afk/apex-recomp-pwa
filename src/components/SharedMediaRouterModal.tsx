import React, { useEffect, useState } from 'react';
import {
  Camera,
  LoaderCircle,
  Scale,
  Share2,
  Sparkles,
  Utensils,
  Watch,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  PendingSharedPayload,
  saveSharedFileToPhotoVault,
} from '../services/shareTargetService';
import {
  parseMovingLifeFile,
  parseMovingLifeText,
  parseSamsungHealthFile,
  parseSamsungHealthText,
} from '../services/smartSyncService';
import { ActiveTab } from '../types/fitness';

interface SharedMediaRouterModalProps {
  payload: PendingSharedPayload | null;
  onClose: () => void;
  onNavigate: (tab: ActiveTab) => void;
  onSendMealFile: (file: File) => void;
  onNotify: (message: string) => void;
}

export const SharedMediaRouterModal: React.FC<SharedMediaRouterModalProps> = ({
  payload,
  onClose,
  onNavigate,
  onSendMealFile,
  onNotify,
}) => {
  const { state, updateWatchMetrics, addCamryRecord } = useApp();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [vaultPose, setVaultPose] = useState<'Frente' | 'Perfil' | 'Espalda'>('Frente');

  useEffect(() => {
    if (payload?.file && payload.file.type.startsWith('image/')) {
      const url = URL.createObjectURL(payload.file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
    return undefined;
  }, [payload]);

  if (!payload) return null;

  const latestCamry = state.camryHistory[state.camryHistory.length - 1];
  const combinedText = [payload.title, payload.text, payload.url].filter(Boolean).join(' ').trim();
  const isImageFile = Boolean(payload.file && payload.file.type.startsWith('image/'));

  const handleRouteWatch = async () => {
    setIsProcessing(true);
    setErrorMsg(null);
    setProgressMsg('Leyendo métricas de Samsung Health con OCR / Gemini Vision...');
    try {
      if (payload.file) {
        const res = await parseSamsungHealthFile(payload.file, state.watchMetrics, (msg) =>
          setProgressMsg(msg)
        );
        if (res.fieldsDetected.length > 0 || Object.keys(res.metrics).length > 0) {
          updateWatchMetrics(res.metrics);
          onNotify(res.summaryMessage || '✓ Telemetría Samsung Health importada correctamente.');
          onNavigate('dashboard');
          onClose();
          return;
        }
        setErrorMsg(
          'No se detectaron números claros para Watch 7 en esa captura. Prueba con otra ruta o súbela directo.'
        );
      } else if (combinedText) {
        const parsed = parseSamsungHealthText(combinedText, state.watchMetrics);
        updateWatchMetrics(parsed);
        onNotify('✓ Texto de Samsung Health procesado y sincronizado en Dashboard.');
        onNavigate('dashboard');
        onClose();
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No se pudo procesar la captura para Galaxy Watch 7.'
      );
    } finally {
      setIsProcessing(false);
      setProgressMsg(null);
    }
  };

  const handleRouteMealPhoto = () => {
    if (!payload.file) return;
    onSendMealFile(payload.file);
    onNavigate('nutrition');
    onClose();
  };

  const handleRouteCamry = async () => {
    setIsProcessing(true);
    setErrorMsg(null);
    setProgressMsg('Analizando reporte Camry / MovingLife 8E...');
    try {
      if (payload.file) {
        const { record } = await parseMovingLifeFile(payload.file, latestCamry, (msg) =>
          setProgressMsg(msg)
        );
        addCamryRecord(record);
        onNotify(
          `✓ Pesaje Camry 8E importado (${record.weightKg} kg • ${record.bodyFatPercent}% grasa • IMB ${record.bmrKcal} kcal).`
        );
        onNavigate('camry');
        onClose();
      } else if (combinedText) {
        const rec = parseMovingLifeText(combinedText, latestCamry);
        addCamryRecord(rec);
        onNotify(
          `✓ Texto MovingLife aplicado (${rec.weightKg} kg • ${rec.bodyFatPercent}% grasa).`
        );
        onNavigate('camry');
        onClose();
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No se pudo interpretar el reporte MovingLife / Camry.'
      );
    } finally {
      setIsProcessing(false);
      setProgressMsg(null);
    }
  };

  const handleRouteVaultPhoto = async () => {
    if (!payload.file) return;
    setIsProcessing(true);
    setErrorMsg(null);
    setProgressMsg(`Guardando foto (${vaultPose}) en Bóveda local...`);
    try {
      const ok = await saveSharedFileToPhotoVault(payload.file, latestCamry, vaultPose);
      if (ok) {
        onNotify(`✓ Foto (${vaultPose}) guardada en tu Bóveda Privada Antes vs Hoy.`);
        onNavigate('camry');
        onClose();
      } else {
        setErrorMsg('No se pudo guardar en IndexedDB.');
      }
    } catch {
      setErrorMsg('Error al comprimir y guardar la foto.');
    } finally {
      setIsProcessing(false);
      setProgressMsg(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#0B1120] border border-cyan-500/40 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
        <div className="px-4 py-3.5 bg-[#070B14] border-b border-gray-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                Captura Recibida
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              </h3>
              <p className="text-[11px] text-gray-400">
                Elige en qué módulo procesarla automáticamente
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3.5 max-h-[82vh] overflow-y-auto">
          {previewUrl && (
            <div className="rounded-xl overflow-hidden bg-black/70 border border-gray-800">
              <img
                src={previewUrl}
                alt="Captura recibida"
                className="w-full max-h-52 object-contain mx-auto"
              />
            </div>
          )}

          {!previewUrl && combinedText && (
            <div className="p-3 rounded-xl bg-[#070B14] border border-gray-800 text-xs font-mono text-gray-300 max-h-28 overflow-y-auto">
              {combinedText}
            </div>
          )}

          {progressMsg && (
            <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-xs font-bold flex items-center gap-2">
              <LoaderCircle className="w-4 h-4 animate-spin shrink-0" />
              <span>{progressMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          <div className="space-y-2">
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => void handleRouteWatch()}
              className="w-full p-3 rounded-xl bg-gradient-to-r from-cyan-500/15 to-blue-500/15 hover:from-cyan-500/25 hover:to-blue-500/25 border border-cyan-500/40 text-left flex items-center gap-3 transition disabled:opacity-50"
            >
              <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 shrink-0">
                <Watch className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-extrabold text-white">
                  Samsung Health / Galaxy Watch 7
                </div>
                <div className="text-[11px] text-gray-400">
                  Extraer calorías activas, pasos, FC y sueño hacia tu Dashboard
                </div>
              </div>
            </button>

            {isImageFile && (
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleRouteMealPhoto}
                className="w-full p-3 rounded-xl bg-gradient-to-r from-emerald-500/15 to-teal-500/15 hover:from-emerald-500/25 hover:to-teal-500/25 border border-emerald-500/40 text-left flex items-center gap-3 transition disabled:opacity-50"
              >
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 shrink-0">
                  <Utensils className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-white">
                    Foto de Comida (Nutrición IA)
                  </div>
                  <div className="text-[11px] text-gray-400">
                    Abrir Cámara IA para calcular calorías, proteína y macros del plato
                  </div>
                </div>
              </button>
            )}

            <button
              type="button"
              disabled={isProcessing}
              onClick={() => void handleRouteCamry()}
              className="w-full p-3 rounded-xl bg-gradient-to-r from-blue-500/15 to-indigo-500/15 hover:from-blue-500/25 hover:to-indigo-500/25 border border-blue-500/40 text-left flex items-center gap-3 transition disabled:opacity-50"
            >
              <div className="p-2 rounded-xl bg-blue-500/20 text-blue-300 shrink-0">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-extrabold text-white">
                  Báscula Camry 8E / MovingLife
                </div>
                <div className="text-[11px] text-gray-400">
                  Registrar peso, % grasa, visceral, LBM y 5 zonas segmentales
                </div>
              </div>
            </button>

            {isImageFile && (
              <div className="p-3 rounded-xl bg-[#070B14] border border-gray-800 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-purple-400" />
                    Bóveda Privada (Antes vs Hoy)
                  </span>
                  <div className="flex gap-1">
                    {(['Frente', 'Perfil', 'Espalda'] as const).map((pose) => (
                      <button
                        key={pose}
                        type="button"
                        onClick={() => setVaultPose(pose)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          vaultPose === pose
                            ? 'bg-purple-500/25 border-purple-400 text-purple-200'
                            : 'bg-[#111827] border-gray-700 text-gray-400'
                        }`}
                      >
                        {pose}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => void handleRouteVaultPhoto()}
                  className="w-full py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-200 font-bold text-xs transition"
                >
                  Guardar en Bóveda Local ({vaultPose})
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
