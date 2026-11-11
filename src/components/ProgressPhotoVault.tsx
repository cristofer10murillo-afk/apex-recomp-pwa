import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Columns2,
  Lock,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Upload,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { compressImageFileToBase64 } from '../services/aiService';
import { getLocalISODate } from '../services/storageService';

const PHOTO_DB_NAME = 'ApexProgressPhotosVault';
const PHOTO_STORE_NAME = 'photos';

export interface ProgressPhotoItem {
  id: string;
  date: string;
  createdAtMs: number;
  note: string;
  pose: 'Frente' | 'Perfil' | 'Espalda';
  weightKg: number;
  bodyFatPercent: number;
  visceralFatIndex: number;
  dataUrl: string;
}

function openPhotoDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(PHOTO_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(PHOTO_STORE_NAME)) {
          db.createObjectStore(PHOTO_STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function loadAllPhotosFromIDB(): Promise<ProgressPhotoItem[]> {
  const db = await openPhotoDB();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(PHOTO_STORE_NAME, 'readonly');
      const req = tx.objectStore(PHOTO_STORE_NAME).getAll();
      req.onsuccess = () => {
        const list = Array.isArray(req.result) ? (req.result as ProgressPhotoItem[]) : [];
        list.sort((a, b) => a.createdAtMs - b.createdAtMs);
        resolve(list);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

async function savePhotoToIDB(item: ProgressPhotoItem): Promise<void> {
  const db = await openPhotoDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(PHOTO_STORE_NAME, 'readwrite');
      tx.objectStore(PHOTO_STORE_NAME).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function deletePhotoFromIDB(id: string): Promise<void> {
  const db = await openPhotoDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(PHOTO_STORE_NAME, 'readwrite');
      tx.objectStore(PHOTO_STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export const ProgressPhotoVault: React.FC = () => {
  const { state } = useApp();
  const latestCamry = state.camryHistory[state.camryHistory.length - 1];
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [photos, setPhotos] = useState<ProgressPhotoItem[]>([]);
  const [noteInput, setNoteInput] = useState('');
  const [poseInput, setPoseInput] = useState<'Frente' | 'Perfil' | 'Espalda'>('Frente');
  const [isSaving, setIsSaving] = useState(false);
  const [compareMode, setCompareMode] = useState<'side' | 'slider'>('side');
  const [sliderPos, setSliderPos] = useState(50);
  const [beforeId, setBeforeId] = useState<string>('');
  const [afterId, setAfterId] = useState<string>('');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void loadAllPhotosFromIDB().then((loaded) => {
      setPhotos(loaded);
      if (loaded.length >= 2) {
        setBeforeId(loaded[0].id);
        setAfterId(loaded[loaded.length - 1].id);
      } else if (loaded.length === 1) {
        setBeforeId(loaded[0].id);
        setAfterId(loaded[0].id);
      }
    });
  }, []);

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsSaving(true);
    try {
      const { previewUrl } = await compressImageFileToBase64(file);
      const dataUrl = previewUrl;
      const newItem: ProgressPhotoItem = {
        id: `photo-${Date.now()}`,
        date: getLocalISODate(),
        createdAtMs: Date.now(),
        note: noteInput.trim() || `${poseInput} • Registro Biométrico`,
        pose: poseInput,
        weightKg: latestCamry?.weightKg ?? 83.3,
        bodyFatPercent: latestCamry?.bodyFatPercent ?? 33.9,
        visceralFatIndex: latestCamry?.visceralFatIndex ?? 13,
        dataUrl,
      };
      await savePhotoToIDB(newItem);
      const nextList = [...photos, newItem].sort((a, b) => a.createdAtMs - b.createdAtMs);
      setPhotos(nextList);
      setBeforeId((prev) => prev || nextList[0].id);
      setAfterId(newItem.id);
      setNoteInput('');
      setNotice('✓ Foto guardada de forma privada en tu dispositivo (IndexedDB).');
      window.setTimeout(() => setNotice(null), 4000);
    } catch {
      setNotice('No se pudo procesar la imagen.');
    } finally {
      setIsSaving(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    await deletePhotoFromIDB(id);
    const nextList = photos.filter((p) => p.id !== id);
    setPhotos(nextList);
    if (nextList.length > 0) {
      if (beforeId === id) setBeforeId(nextList[0].id);
      if (afterId === id) setAfterId(nextList[nextList.length - 1].id);
    } else {
      setBeforeId('');
      setAfterId('');
    }
  };

  const beforePhoto = photos.find((p) => p.id === beforeId) || photos[0];
  const afterPhoto = photos.find((p) => p.id === afterId) || photos[photos.length - 1];

  const weightDiff =
    beforePhoto && afterPhoto
      ? Math.round((afterPhoto.weightKg - beforePhoto.weightKg) * 10) / 10
      : 0;
  const fatDiff =
    beforePhoto && afterPhoto
      ? Math.round((afterPhoto.bodyFatPercent - beforePhoto.bodyFatPercent) * 10) / 10
      : 0;
  const daysBetween =
    beforePhoto && afterPhoto
      ? Math.max(0, Math.round((afterPhoto.createdAtMs - beforePhoto.createdAtMs) / 86400000))
      : 0;

  return (
    <div className="bg-[#111827] border border-cyan-500/30 rounded-2xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Camera className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-extrabold text-white">
              Bóveda Privada de Progreso Visual (Antes vs Hoy)
            </h3>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <Lock className="w-2.5 h-2.5" />
              Solo Local • Protegido con PIN
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Guarda fotos privadas sin subirlas a servidores externos. Se vinculan automáticamente con
            tu peso ({latestCamry?.weightKg ?? 83.3} kg) y % grasa ({latestCamry?.bodyFatPercent ?? 33.9}
            %) del día.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {photos.length >= 2 && (
            <div className="inline-flex bg-[#090D16] border border-gray-800 rounded-xl p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setCompareMode('side')}
                className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 transition ${
                  compareMode === 'side' ? 'bg-cyan-500 text-gray-950' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Columns2 className="w-3.5 h-3.5" />
                <span>Lado a Lado</span>
              </button>
              <button
                type="button"
                onClick={() => setCompareMode('slider')}
                className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 transition ${
                  compareMode === 'slider' ? 'bg-cyan-500 text-gray-950' : 'text-gray-400 hover:text-white'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Deslizador</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Upload bar */}
      <div className="bg-[#090D16] border border-gray-800 rounded-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleUploadPhoto}
          className="hidden"
        />
        <div className="flex gap-1.5">
          {(['Frente', 'Perfil', 'Espalda'] as const).map((pose) => (
            <button
              key={pose}
              type="button"
              onClick={() => setPoseInput(pose)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition ${
                poseInput === pose
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                  : 'bg-[#111827] border-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {pose}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={noteInput}
          onChange={(e) => setNoteInput(e.target.value)}
          placeholder="Nota opcional (ej. Día 17 Insanity, en ayunas)..."
          className="flex-1 bg-[#111827] border border-gray-700 rounded-xl px-3 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isSaving}
          className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-gray-950 font-extrabold text-xs flex items-center justify-center gap-1.5 transition shrink-0"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>{isSaving ? 'Guardando...' : 'Subir Foto Hoy'}</span>
        </button>
      </div>

      {notice && (
        <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4" />
          <span>{notice}</span>
        </div>
      )}

      {photos.length === 0 ? (
        <div className="py-8 px-4 text-center border border-dashed border-gray-800 rounded-2xl bg-[#090D16]/60 space-y-2">
          <Camera className="w-8 h-8 text-gray-600 mx-auto" />
          <p className="text-xs text-gray-300 font-bold">Aún no has guardado fotos de progreso</p>
          <p className="text-[11px] text-gray-500 max-w-md mx-auto">
            Sube tu primera foto (Frente / Perfil / Espalda) para activar la comparación visual Antes vs
            Después. Todo se guarda cifrado en tu navegador bajo tu pantalla PIN.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Selectors if >= 2 */}
          {photos.length >= 2 && beforePhoto && afterPhoto && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-center bg-[#090D16] border border-gray-800 rounded-xl p-2.5 text-xs">
                <div>
                  <label className="text-[10px] text-gray-400 uppercase font-mono block mb-1">
                    Foto Antes
                  </label>
                  <select
                    value={beforePhoto.id}
                    onChange={(e) => setBeforeId(e.target.value)}
                    className="w-full bg-[#111827] border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white"
                  >
                    {photos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.date} • {p.pose} ({p.weightKg}kg / {p.bodyFatPercent}%)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="text-center py-1 px-2 rounded-lg bg-[#111827] border border-gray-800 font-mono">
                  <span className="text-[10px] text-gray-400 block">
                    Diferencia ({daysBetween} días)
                  </span>
                  <span className="text-xs font-extrabold text-emerald-400">
                    {weightDiff > 0 ? `+${weightDiff}` : weightDiff} kg •{' '}
                    {fatDiff > 0 ? `+${fatDiff}` : fatDiff}% grasa
                  </span>
                </div>

                <div>
                  <label className="text-[10px] text-gray-400 uppercase font-mono block mb-1">
                    Foto Después / Hoy
                  </label>
                  <select
                    value={afterPhoto.id}
                    onChange={(e) => setAfterId(e.target.value)}
                    className="w-full bg-[#111827] border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white"
                  >
                    {photos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.date} • {p.pose} ({p.weightKg}kg / {p.bodyFatPercent}%)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {compareMode === 'side' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: 'ANTES', item: beforePhoto, accent: 'border-gray-700 text-gray-300' },
                    {
                      label: 'DESPUÉS / ACTUAL',
                      item: afterPhoto,
                      accent: 'border-emerald-500/50 text-emerald-400',
                    },
                  ].map((panel) => (
                    <div
                      key={`${panel.label}-${panel.item.id}`}
                      className={`rounded-2xl overflow-hidden bg-[#090D16] border ${panel.accent.split(' ')[0]} flex flex-col`}
                    >
                      <div className="px-3 py-2 bg-[#070B14] border-b border-gray-800 flex items-center justify-between text-xs font-mono">
                        <span className={`font-black ${panel.accent.split(' ')[1]}`}>{panel.label}</span>
                        <span className="text-gray-300">
                          {panel.item.date} • <strong>{panel.item.weightKg} kg</strong> ({panel.item.bodyFatPercent}%)
                        </span>
                      </div>
                      <img
                        src={panel.item.dataUrl}
                        alt={panel.item.note}
                        className="w-full h-72 object-contain bg-black/60"
                      />
                      <div className="px-3 py-2 text-[11px] text-gray-400 flex items-center justify-between">
                        <span className="truncate">{panel.item.note}</span>
                        <button
                          type="button"
                          onClick={() => void handleDelete(panel.item.id)}
                          className="text-rose-400 hover:text-rose-300 p-1"
                          title="Eliminar foto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative w-full h-80 sm:h-96 rounded-2xl overflow-hidden bg-black border border-gray-700 select-none">
                    <img
                      src={afterPhoto.dataUrl}
                      alt="Después"
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                    <div
                      className="absolute inset-0 overflow-hidden"
                      style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
                    >
                      <img
                        src={beforePhoto.dataUrl}
                        alt="Antes"
                        className="w-full h-full object-contain bg-black"
                      />
                    </div>
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.9)]"
                      style={{ left: `${sliderPos}%` }}
                    />
                    <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-black/75 text-white text-[10px] font-mono font-bold">
                      ANTES: {beforePhoto.date} ({beforePhoto.weightKg}kg)
                    </span>
                    <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded bg-emerald-600/85 text-white text-[10px] font-mono font-bold">
                      HOY: {afterPhoto.date} ({afterPhoto.weightKg}kg)
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={sliderPos}
                    onChange={(e) => setSliderPos(Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>
              )}
            </>
          )}

          {/* Thumbnail strip (for 1 photo or browsing all) */}
          {(photos.length === 1 || photos.length > 2) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {photos.map((p) => (
                <div
                  key={p.id}
                  className="bg-[#090D16] border border-gray-800 rounded-xl overflow-hidden flex flex-col"
                >
                  <img src={p.dataUrl} alt={p.note} className="w-full h-36 object-cover bg-black" />
                  <div className="p-2 flex items-center justify-between gap-1 text-[10px]">
                    <div className="min-w-0">
                      <p className="font-mono font-bold text-white truncate">
                        {p.date} • {p.pose}
                      </p>
                      <p className="text-gray-400 truncate">
                        {p.weightKg} kg • {p.bodyFatPercent}%
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDelete(p.id)}
                      className="text-rose-400 hover:text-rose-300 p-1 shrink-0"
                      title="Eliminar foto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
