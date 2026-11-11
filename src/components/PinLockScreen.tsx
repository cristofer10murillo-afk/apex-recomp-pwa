import React, { useEffect, useState } from 'react';
import {
  CircleCheck,
  Delete,
  Fingerprint,
  KeyRound,
  Lock,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

const OWNER_PIN_KEY = 'apex_recomp_owner_pin_v1';
const SESSION_UNLOCK_KEY = 'apex_recomp_session_unlocked_v1';
const BIOMETRIC_CRED_KEY = 'apex_recomp_biometric_cred_id';
const DEFAULT_PIN = '2026';

export function getStoredPin(): string {
  if (typeof window === 'undefined') return DEFAULT_PIN;
  return localStorage.getItem(OWNER_PIN_KEY) || DEFAULT_PIN;
}

export function saveStoredPin(pin: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(OWNER_PIN_KEY, pin);
}

export function isPinSessionUnlocked(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SESSION_UNLOCK_KEY) === 'true';
}

export function setPinSessionUnlocked(unlocked: boolean): void {
  if (typeof window === 'undefined') return;
  if (unlocked) {
    localStorage.setItem(SESSION_UNLOCK_KEY, 'true');
  } else {
    localStorage.removeItem(SESSION_UNLOCK_KEY);
  }
}

interface PinLockScreenProps {
  onUnlock: () => void;
}

export const PinLockScreen: React.FC<PinLockScreenProps> = ({ onUnlock }) => {
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricRegistered, setBiometricRegistered] = useState(false);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.PublicKeyCredential &&
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
    ) {
      window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then((avail) => {
          setBiometricAvailable(avail);
          setBiometricRegistered(Boolean(localStorage.getItem(BIOMETRIC_CRED_KEY)));
        })
        .catch(() => setBiometricAvailable(false));
    }
  }, []);

  const verifyPin = (candidate: string) => {
    const expected = getStoredPin();
    if (candidate === expected) {
      setPinSessionUnlocked(true);
      onUnlock();
    } else {
      setErrorMsg('PIN incorrecto. Acceso exclusivo para Cristopher.');
      setPinInput('');
      window.setTimeout(() => setErrorMsg(null), 3000);
    }
  };

  const handleDigit = (digit: string) => {
    if (pinInput.length >= 4) return;
    const next = pinInput + digit;
    setPinInput(next);
    if (next.length === 4) {
      window.setTimeout(() => verifyPin(next), 120);
    }
  };

  const handleBackspace = () => {
    setPinInput((prev) => prev.slice(0, -1));
  };

  const handleBiometric = async () => {
    if (!window.PublicKeyCredential || !navigator.credentials) {
      setErrorMsg('Biometría no disponible en este navegador. Ingresa tu PIN.');
      return;
    }
    try {
      const existingCredId = localStorage.getItem(BIOMETRIC_CRED_KEY);
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      if (existingCredId) {
        const assertion = await navigator.credentials.get({
          publicKey: {
            challenge,
            userVerification: 'required',
            timeout: 60000,
          },
        });
        if (assertion) {
          setPinSessionUnlocked(true);
          onUnlock();
        }
      } else {
        const userId = new Uint8Array(16);
        window.crypto.getRandomValues(userId);
        const created = await navigator.credentials.create({
          publicKey: {
            challenge,
            rp: { name: 'APEX RECOMP PWA - Cristopher' },
            user: {
              id: userId,
              name: 'cristopher@apexrecomp',
              displayName: 'Cristopher (Propietario)',
            },
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
            authenticatorSelection: {
              authenticatorAttachment: 'platform',
              userVerification: 'required',
            },
            timeout: 60000,
          },
        });
        if (created) {
          localStorage.setItem(BIOMETRIC_CRED_KEY, created.id);
          setBiometricRegistered(true);
          setPinSessionUnlocked(true);
          onUnlock();
        }
      }
    } catch {
      setErrorMsg('Verificación biométrica cancelada. Usa tu PIN de 4 dígitos.');
    }
  };

  return (
    <div className="min-h-screen bg-[#090D16] text-gray-100 flex flex-col items-center justify-center p-4 select-none">
      <div className="w-full max-w-sm bg-[#111827] border border-gray-800 rounded-3xl p-6 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#10B981] to-[#3B82F6] p-[1.5px] mx-auto shadow-lg shadow-[#10B981]/20">
            <div className="w-full h-full bg-[#090D16] rounded-[14px] flex items-center justify-center">
              <Lock className="w-6 h-6 text-[#10B981]" />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981] text-[10px] font-extrabold uppercase tracking-wider">
            <ShieldCheck className="w-3 h-3" />
            Bóveda Privada • Uso Exclusivo
          </div>

          <h1 className="text-lg font-extrabold text-white tracking-tight">
            APEX <span className="text-[#10B981]">RECOMP</span>
          </h1>
          <p className="text-xs text-gray-400">
            Perfil Biométrico Protegido de <strong className="text-gray-200">Cristopher</strong>
          </p>
        </div>

        <div className="flex items-center justify-center gap-4 py-2">
          {[0, 1, 2, 3].map((idx) => {
            const filled = pinInput.length > idx;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  filled
                    ? 'bg-[#10B981] scale-110 shadow-md shadow-[#10B981]/50'
                    : 'bg-[#090D16] border-2 border-gray-700'
                }`}
              />
            );
          })}
        </div>

        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5 text-center">
            <TriangleAlert className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="h-14 rounded-2xl bg-[#090D16] hover:bg-gray-800/90 active:scale-95 border border-gray-800 text-lg font-extrabold text-white font-mono transition flex items-center justify-center shadow-inner"
            >
              {digit}
            </button>
          ))}

          <button
            type="button"
            onClick={handleBiometric}
            title="Desbloquear con Huella Digital S23 Ultra / Windows Hello"
            className={`h-14 rounded-2xl border transition flex flex-col items-center justify-center ${
              biometricAvailable
                ? 'bg-[#3B82F6]/15 hover:bg-[#3B82F6]/25 border-[#3B82F6]/40 text-[#3B82F6]'
                : 'bg-[#090D16]/50 border-gray-800/60 text-gray-500'
            }`}
          >
            <Fingerprint className="w-5 h-5" />
            <span className="text-[9px] font-bold mt-0.5">
              {biometricRegistered ? 'Huella' : 'Activar Huella'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-14 rounded-2xl bg-[#090D16] hover:bg-gray-800/90 active:scale-95 border border-gray-800 text-lg font-extrabold text-white font-mono transition flex items-center justify-center shadow-inner"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleBackspace}
            className="h-14 rounded-2xl bg-[#090D16] hover:bg-gray-800/90 active:scale-95 border border-gray-800 text-gray-400 hover:text-white transition flex items-center justify-center"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        <p className="text-[11px] text-center text-gray-500">
          Ingresa tu PIN de 4 dígitos o usa el lector de huella de tu{' '}
          <strong>S23 Ultra</strong>.
        </p>
      </div>
    </div>
  );
};

interface PinSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLockNow: () => void;
}

export const PinSettingsModal: React.FC<PinSettingsModalProps> = ({
  isOpen,
  onClose,
  onLockNow,
}) => {
  const [newPin, setNewPin] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  if (!isOpen) return null;

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (/^\d{4}$/.test(newPin)) {
      saveStoredPin(newPin);
      setNewPin('');
      setSavedNotice(true);
      window.setTimeout(() => setSavedNotice(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#111827] border border-gray-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#10B981]" />
            <h3 className="text-sm font-extrabold text-white">Seguridad y Bloqueo Privado</h3>
          </div>
          <button
            onClick={onClose}
            className="text-xs text-gray-400 hover:text-white font-bold px-2 py-1"
          >
            Cerrar
          </button>
        </div>

        <p className="text-xs text-gray-300">
          Tu aplicación está protegida con PIN de 4 dígitos y huella digital en tu S23 Ultra.
        </p>

        <form onSubmit={handleSavePin} className="space-y-2">
          <label className="text-xs font-bold text-gray-400 block">
            Cambiar PIN de 4 dígitos (Actual:{' '}
            <span className="text-[#10B981] font-mono">{getStoredPin()}</span>):
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Nuevo PIN (4 números)"
              className="flex-1 bg-[#090D16] border border-gray-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-[#10B981] focus:outline-none"
            />
            <button
              type="submit"
              disabled={newPin.length !== 4}
              className="px-3 py-2 rounded-xl bg-[#10B981] text-gray-950 font-extrabold text-xs disabled:opacity-40"
            >
              Guardar PIN
            </button>
          </div>
          {savedNotice && (
            <p className="text-xs text-[#10B981] font-bold flex items-center gap-1">
              <CircleCheck className="w-3.5 h-3.5" />
              ¡Nuevo PIN guardado correctamente!
            </p>
          )}
        </form>

        <div className="pt-2 border-t border-gray-800 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              setPinSessionUnlocked(false);
              onClose();
              onLockNow();
            }}
            className="w-full py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-extrabold text-xs flex items-center justify-center gap-1.5 transition"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Bloquear Pantalla Ahora</span>
          </button>
        </div>
      </div>
    </div>
  );
};
