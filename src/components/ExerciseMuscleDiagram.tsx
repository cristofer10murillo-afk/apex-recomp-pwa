import React, { useEffect, useState } from 'react';
import {
  Activity,
  CircleCheck,
  Eye,
  Flame,
  Layers,
  Maximize2,
  Pause,
  Play,
  Shield,
  TriangleAlert,
  Wind,
} from 'lucide-react';

export type MuscleGroupId =
  | 'chest_all'
  | 'chest_upper'
  | 'chest_mid'
  | 'deltoid_ant'
  | 'deltoid_lat'
  | 'deltoid_post'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'lats'
  | 'traps_up'
  | 'traps_mid'
  | 'lower_back'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'calves'
  | 'adductors';

interface MuscleStatus {
  isPrimary: boolean;
  isSecondary: boolean;
  fill: string;
  stroke: string;
  glowClass: string;
}

interface ExerciseBiomechanics {
  id: string;
  animationType: string;
  primaryMuscleIds: MuscleGroupId[];
  secondaryMuscleIds: MuscleGroupId[];
  primaryMuscles: string[];
  secondaryMuscles: string[];
  tempoLabel: string;
  breathingTip: string;
  correctFormTips: string[];
  commonMistakes: string[];
  proBiomechanicNote: string;
}

function getMuscleSpanishName(id: MuscleGroupId): string {
  switch (id) {
    case 'chest_all':
      return 'Pectoral Mayor Completo';
    case 'chest_upper':
      return 'Pectoral Superior (Haz Clavicular)';
    case 'chest_mid':
      return 'Pectoral Medio (Haz Esternal)';
    case 'deltoid_ant':
      return 'Deltoides Anterior (Hombro Frontal)';
    case 'deltoid_lat':
      return 'Deltoides Lateral (Amplitud 3D)';
    case 'deltoid_post':
      return 'Deltoides Posterior (Espalda Alta)';
    case 'biceps':
      return 'Bíceps Braquial y Braquial';
    case 'triceps':
      return 'Tríceps Braquial (Cabeza Lateral/Larga)';
    case 'forearms':
      return 'Antebrazo y Braquiorradial';
    case 'abs':
      return 'Recto Abdominal (Six-Pack)';
    case 'obliques':
      return 'Oblicuos y Core';
    case 'lats':
      return 'Dorsal Ancho (Amplitud en V)';
    case 'traps_up':
      return 'Trapecio Superior (Cuello/Hombro)';
    case 'traps_mid':
      return 'Romboides y Trapecio Medio';
    case 'lower_back':
      return 'Erectores Espinales (Lumbar)';
    case 'glutes':
      return 'Glúteo Mayor y Medio';
    case 'quads':
      return 'Cuádriceps (4 Cabezas)';
    case 'hamstrings':
      return 'Isquiosurales (Bíceps Femoral)';
    case 'calves':
      return 'Gemelos (Gastrocnemio y Sóleo)';
    case 'adductors':
      return 'Aductores de Cadera';
  }
}

const AnteriorAnatomySvg: React.FC<{ getMuscleStatus: (id: MuscleGroupId) => MuscleStatus }> = ({
  getMuscleStatus,
}) => {
  const chestMid = getMuscleStatus('chest_mid');
  const chestUpper = getMuscleStatus('chest_upper');
  const chestAll = getMuscleStatus('chest_all');
  const deltoidAnt = getMuscleStatus('deltoid_ant');
  const deltoidLat = getMuscleStatus('deltoid_lat');
  const biceps = getMuscleStatus('biceps');
  const forearms = getMuscleStatus('forearms');
  const abs = getMuscleStatus('abs');
  const obliques = getMuscleStatus('obliques');
  const quads = getMuscleStatus('quads');
  const calves = getMuscleStatus('calves');

  const chestFill = chestAll.isPrimary
    ? chestAll.fill
    : chestMid.isPrimary
    ? chestMid.fill
    : chestUpper.isPrimary
    ? chestUpper.fill
    : chestAll.isSecondary
    ? chestAll.fill
    : 'url(#muscleDarkGradient)';
  const chestGlow = chestAll.glowClass || chestMid.glowClass || chestUpper.glowClass || '';

  return (
    <svg viewBox="0 0 200 340" className="w-full h-full drop-shadow-2xl">
      <g>
        <ellipse
          cx="100"
          cy="24"
          rx="14"
          ry="17"
          fill="url(#muscleDarkGradient)"
          stroke="#334155"
          strokeWidth="1"
        />
        <path d="M 91 38 L 94 54 L 88 54 Z" fill="#475569" opacity="0.8" />
        <path d="M 109 38 L 106 54 L 112 54 Z" fill="#475569" opacity="0.8" />
        <line x1="100" y1="40" x2="100" y2="54" stroke="#1E293B" strokeWidth="1.5" />
      </g>

      <path
        d="M 72 54 Q 100 58 128 54"
        fill="none"
        stroke="url(#boneGradient)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path d="M 86 42 Q 74 48 68 54 L 86 54 Z" fill="#475569" stroke="#334155" strokeWidth="1" />
      <path d="M 114 42 Q 126 48 132 54 L 114 54 Z" fill="#475569" stroke="#334155" strokeWidth="1" />

      <g className={deltoidAnt.glowClass || deltoidLat.glowClass}>
        <path
          d="M 68 54 Q 52 58 48 74 Q 48 88 62 90 Q 68 76 70 60 Z"
          fill={
            deltoidAnt.isPrimary || deltoidLat.isPrimary || deltoidAnt.isSecondary || deltoidLat.isSecondary
              ? deltoidAnt.fill
              : 'url(#muscleDarkGradient)'
          }
          stroke={deltoidAnt.stroke}
          strokeWidth="1.5"
        />
        <path
          d="M 132 54 Q 148 58 152 74 Q 152 88 138 90 Q 132 76 130 60 Z"
          fill={
            deltoidAnt.isPrimary || deltoidLat.isPrimary || deltoidAnt.isSecondary || deltoidLat.isSecondary
              ? deltoidAnt.fill
              : 'url(#muscleDarkGradient)'
          }
          stroke={deltoidAnt.stroke}
          strokeWidth="1.5"
        />
      </g>

      <g className={chestGlow}>
        <path
          d="M 72 56 Q 98 56 98 70 Q 98 94 76 96 Q 64 94 66 74 Q 68 62 72 56 Z"
          fill={chestFill}
          stroke={chestAll.stroke || chestMid.stroke || '#334155'}
          strokeWidth="1.5"
        />
        <path
          d="M 128 56 Q 102 56 102 70 Q 102 94 124 96 Q 136 94 134 74 Q 132 62 128 56 Z"
          fill={chestFill}
          stroke={chestAll.stroke || chestMid.stroke || '#334155'}
          strokeWidth="1.5"
        />
        <line x1="100" y1="56" x2="100" y2="98" stroke="#0F172A" strokeWidth="2" />
        {(chestAll.isPrimary || chestMid.isPrimary) && (
          <path
            d="M 72 56 Q 98 56 98 70 Q 98 94 76 96 M 128 56 Q 102 56 102 70 Q 102 94 124 96"
            fill="url(#striatedPattern)"
            opacity="0.35"
          />
        )}
      </g>

      <g className={biceps.glowClass}>
        <path
          d="M 60 88 Q 50 102 52 118 Q 58 126 64 122 Q 68 108 64 88 Z"
          fill={biceps.fill}
          stroke={biceps.stroke}
          strokeWidth="1.5"
        />
        <path
          d="M 140 88 Q 150 102 148 118 Q 142 126 136 122 Q 132 108 136 88 Z"
          fill={biceps.fill}
          stroke={biceps.stroke}
          strokeWidth="1.5"
        />
      </g>

      <g className={forearms.glowClass}>
        <path
          d="M 52 122 Q 42 138 38 160 Q 42 166 48 162 Q 58 144 64 124 Z"
          fill={forearms.fill}
          stroke={forearms.stroke}
          strokeWidth="1.5"
        />
        <path
          d="M 148 122 Q 158 138 162 160 Q 158 166 152 162 Q 142 144 136 124 Z"
          fill={forearms.fill}
          stroke={forearms.stroke}
          strokeWidth="1.5"
        />
        <ellipse cx="36" cy="172" rx="6" ry="10" fill="#334155" />
        <ellipse cx="164" cy="172" rx="6" ry="10" fill="#334155" />
      </g>

      <g className={abs.glowClass || obliques.glowClass}>
        <path
          d="M 72 96 Q 76 120 74 146 Q 80 150 82 144 Q 82 114 76 96 Z"
          fill={obliques.fill}
          stroke={obliques.stroke}
          strokeWidth="1"
        />
        <path
          d="M 128 96 Q 124 120 126 146 Q 120 150 118 144 Q 118 114 124 96 Z"
          fill={obliques.fill}
          stroke={obliques.stroke}
          strokeWidth="1"
        />
        <rect x="84" y="98" width="14" height="11" rx="3" fill={abs.fill} stroke={abs.stroke} strokeWidth="1" />
        <rect x="102" y="98" width="14" height="11" rx="3" fill={abs.fill} stroke={abs.stroke} strokeWidth="1" />
        <rect x="84" y="112" width="14" height="12" rx="3" fill={abs.fill} stroke={abs.stroke} strokeWidth="1" />
        <rect x="102" y="112" width="14" height="12" rx="3" fill={abs.fill} stroke={abs.stroke} strokeWidth="1" />
        <rect x="86" y="127" width="12" height="13" rx="3" fill={abs.fill} stroke={abs.stroke} strokeWidth="1" />
        <rect x="102" y="127" width="12" height="13" rx="3" fill={abs.fill} stroke={abs.stroke} strokeWidth="1" />
        <line x1="100" y1="96" x2="100" y2="152" stroke="#0F172A" strokeWidth="2" />
      </g>

      <path
        d="M 74 148 L 126 148 L 132 178 L 100 174 L 68 178 Z"
        fill="#111827"
        stroke="#374151"
        strokeWidth="2"
      />

      <g className={quads.glowClass}>
        <path
          d="M 72 178 Q 62 208 64 240 Q 76 248 86 248 Q 94 220 90 178 Z"
          fill={quads.fill}
          stroke={quads.stroke}
          strokeWidth="1.5"
        />
        <ellipse
          cx="84"
          cy="238"
          rx="6"
          ry="8"
          fill={quads.isPrimary ? '#FF9E00' : '#475569'}
          opacity="0.75"
        />
        <path
          d="M 128 178 Q 138 208 136 240 Q 124 248 114 248 Q 106 220 110 178 Z"
          fill={quads.fill}
          stroke={quads.stroke}
          strokeWidth="1.5"
        />
        <ellipse
          cx="116"
          cy="238"
          rx="6"
          ry="8"
          fill={quads.isPrimary ? '#FF9E00' : '#475569'}
          opacity="0.75"
        />
      </g>

      <ellipse cx="78" cy="254" rx="6" ry="5" fill="url(#boneGradient)" />
      <ellipse cx="122" cy="254" rx="6" ry="5" fill="url(#boneGradient)" />

      <g className={calves.glowClass}>
        <path
          d="M 74 258 Q 66 280 72 312 L 84 312 Q 88 280 84 258 Z"
          fill={calves.fill}
          stroke={calves.stroke}
          strokeWidth="1.5"
        />
        <path
          d="M 126 258 Q 134 280 128 312 L 116 312 Q 112 280 116 258 Z"
          fill={calves.fill}
          stroke={calves.stroke}
          strokeWidth="1.5"
        />
      </g>

      <path d="M 68 312 Q 74 330 84 330 L 88 312 Z" fill="#334155" stroke="#1E293B" />
      <path d="M 132 312 Q 126 330 116 330 L 112 312 Z" fill="#334155" stroke="#1E293B" />
    </svg>
  );
};

const PosteriorAnatomySvg: React.FC<{ getMuscleStatus: (id: MuscleGroupId) => MuscleStatus }> = ({
  getMuscleStatus,
}) => {
  const lats = getMuscleStatus('lats');
  const trapsUp = getMuscleStatus('traps_up');
  const trapsMid = getMuscleStatus('traps_mid');
  const deltoidPost = getMuscleStatus('deltoid_post');
  const triceps = getMuscleStatus('triceps');
  const lowerBack = getMuscleStatus('lower_back');
  const glutes = getMuscleStatus('glutes');
  const hamstrings = getMuscleStatus('hamstrings');
  const calves = getMuscleStatus('calves');

  return (
    <svg viewBox="0 0 200 340" className="w-full h-full drop-shadow-2xl">
      <g>
        <ellipse
          cx="100"
          cy="24"
          rx="14"
          ry="17"
          fill="url(#muscleDarkGradient)"
          stroke="#334155"
          strokeWidth="1"
        />
      </g>

      <g className={trapsUp.glowClass || trapsMid.glowClass}>
        <path
          d="M 100 36 L 126 56 L 124 92 L 100 120 L 76 92 L 74 56 Z"
          fill={
            trapsUp.isPrimary || trapsMid.isPrimary || trapsUp.isSecondary || trapsMid.isSecondary
              ? trapsMid.fill
              : 'url(#muscleDarkGradient)'
          }
          stroke={trapsMid.stroke}
          strokeWidth="1.5"
        />
        <line
          x1="100"
          y1="36"
          x2="100"
          y2="150"
          stroke="#0F172A"
          strokeWidth="2"
          strokeDasharray="3 2"
        />
        {(trapsUp.isPrimary || trapsMid.isPrimary) && (
          <path
            d="M 100 36 L 126 56 L 124 92 L 100 120 L 76 92 L 74 56 Z"
            fill="url(#striatedPattern)"
            opacity="0.35"
          />
        )}
      </g>

      <g className={deltoidPost.glowClass}>
        <path
          d="M 72 58 Q 50 62 48 78 Q 52 90 64 92 Q 72 82 72 58 Z"
          fill={deltoidPost.fill}
          stroke={deltoidPost.stroke}
          strokeWidth="1.5"
        />
        <path
          d="M 128 58 Q 150 62 152 78 Q 148 90 136 92 Q 128 82 128 58 Z"
          fill={deltoidPost.fill}
          stroke={deltoidPost.stroke}
          strokeWidth="1.5"
        />
      </g>

      <g className={lats.glowClass}>
        <path
          d="M 72 86 Q 64 108 72 136 Q 88 138 98 122 Q 98 100 86 86 Z"
          fill={lats.fill}
          stroke={lats.stroke}
          strokeWidth="2"
        />
        <path
          d="M 128 86 Q 136 108 128 136 Q 112 138 102 122 Q 102 100 114 86 Z"
          fill={lats.fill}
          stroke={lats.stroke}
          strokeWidth="2"
        />
        {lats.isPrimary && (
          <g>
            <path
              d="M 72 86 Q 64 108 72 136 Q 88 138 98 122 Z M 128 86 Q 136 108 128 136 Q 112 138 102 122 Z"
              fill="url(#striatedPattern)"
              opacity="0.4"
            />
          </g>
        )}
      </g>

      <g className={triceps.glowClass}>
        <path
          d="M 60 88 Q 50 102 52 122 Q 62 124 64 116 Q 66 102 62 88 Z"
          fill={triceps.fill}
          stroke={triceps.stroke}
          strokeWidth="1.5"
        />
        <path
          d="M 140 88 Q 150 102 148 122 Q 138 124 136 116 Q 134 102 138 88 Z"
          fill={triceps.fill}
          stroke={triceps.stroke}
          strokeWidth="1.5"
        />
      </g>

      <path d="M 52 122 Q 44 140 40 160 Q 46 166 52 162 Q 60 144 64 124 Z" fill="#334155" stroke="#1E293B" />
      <path d="M 148 122 Q 156 140 160 160 Q 154 166 148 162 Q 140 144 136 124 Z" fill="#334155" stroke="#1E293B" />
      <ellipse cx="38" cy="172" rx="6" ry="10" fill="#334155" />
      <ellipse cx="162" cy="172" rx="6" ry="10" fill="#334155" />

      <g className={lowerBack.glowClass}>
        <path
          d="M 88 134 L 100 130 L 112 134 L 108 152 L 100 154 L 92 152 Z"
          fill={lowerBack.fill}
          stroke={lowerBack.stroke}
          strokeWidth="1"
        />
      </g>

      <g className={glutes.glowClass}>
        <path
          d="M 72 150 Q 64 172 70 192 Q 88 196 98 184 Q 98 160 88 150 Z"
          fill={glutes.fill}
          stroke={glutes.stroke}
          strokeWidth="2"
        />
        <path
          d="M 128 150 Q 136 172 130 192 Q 112 196 102 184 Q 102 160 112 150 Z"
          fill={glutes.fill}
          stroke={glutes.stroke}
          strokeWidth="2"
        />
        <line x1="100" y1="152" x2="100" y2="194" stroke="#0B0F19" strokeWidth="2.5" />
      </g>

      <g className={hamstrings.glowClass}>
        <path
          d="M 70 194 Q 64 220 70 248 Q 84 250 88 248 Q 94 220 88 194 Z"
          fill={hamstrings.fill}
          stroke={hamstrings.stroke}
          strokeWidth="1.5"
        />
        <path
          d="M 130 194 Q 136 220 130 248 Q 116 250 112 248 Q 106 220 112 194 Z"
          fill={hamstrings.fill}
          stroke={hamstrings.stroke}
          strokeWidth="1.5"
        />
      </g>

      <ellipse cx="78" cy="254" rx="6" ry="4" fill="#1E293B" />
      <ellipse cx="122" cy="254" rx="6" ry="4" fill="#1E293B" />

      <g className={calves.glowClass}>
        <path
          d="M 70 258 Q 62 278 70 304 L 84 304 Q 90 278 84 258 Z"
          fill={calves.fill}
          stroke={calves.stroke}
          strokeWidth="2"
        />
        <path
          d="M 130 258 Q 138 278 130 304 L 116 304 Q 110 278 116 258 Z"
          fill={calves.fill}
          stroke={calves.stroke}
          strokeWidth="2"
        />
        <rect x="74" y="304" width="6" height="12" rx="2" fill="url(#boneGradient)" />
        <rect x="120" y="304" width="6" height="12" rx="2" fill="url(#boneGradient)" />
      </g>

      <ellipse cx="77" cy="322" rx="8" ry="6" fill="#334155" />
      <ellipse cx="123" cy="322" rx="8" ry="6" fill="#334155" />
    </svg>
  );
};

export const MuscleHologram: React.FC<{
  primaryMuscleIds: MuscleGroupId[];
  secondaryMuscleIds: MuscleGroupId[];
  exerciseName: string;
  initialView?: 'dual' | 'anterior' | 'posterior';
}> = ({ primaryMuscleIds, secondaryMuscleIds, exerciseName, initialView = 'dual' }) => {
  const [viewMode, setViewMode] = useState<'dual' | 'anterior' | 'posterior'>(initialView);
  const [, setSelectedMuscle] = useState<MuscleGroupId | null>(primaryMuscleIds[0] || null);

  const getMuscleStatus = (id: MuscleGroupId): MuscleStatus => {
    const isPrimary = primaryMuscleIds.includes(id);
    const isSecondary = secondaryMuscleIds.includes(id);
    if (isPrimary) {
      return {
        isPrimary: true,
        isSecondary: false,
        fill: 'url(#muscleFireGradient)',
        stroke: '#FFA200',
        glowClass: 'filter drop-shadow-[0_0_12px_rgba(255,87,34,0.9)] animate-pulse',
      };
    }
    if (isSecondary) {
      return {
        isPrimary: false,
        isSecondary: true,
        fill: 'url(#muscleCyanGradient)',
        stroke: '#38BDF8',
        glowClass: 'filter drop-shadow-[0_0_8px_rgba(56,189,248,0.7)]',
      };
    }
    return {
      isPrimary: false,
      isSecondary: false,
      fill: 'url(#muscleDarkGradient)',
      stroke: '#334155',
      glowClass: '',
    };
  };

  return (
    <div className="bg-[#0B0F19] border border-gray-800 rounded-2xl p-3.5 sm:p-4 space-y-4 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>Holograma Anatómico Muscular</span>
              <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                Striated 3D
              </span>
            </h4>
            <p className="text-[11px] text-gray-400">
              Grupos musculares iluminados para <span className="text-white font-semibold">{exerciseName}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-[#111827] p-1 rounded-xl border border-gray-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('dual')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
              viewMode === 'dual' ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span>Dual 3D</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('anterior')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
              viewMode === 'anterior' ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            <span>Frente</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('posterior')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
              viewMode === 'posterior' ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            <span>Espalda</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {primaryMuscleIds.map((id) => (
          <div
            key={id}
            onClick={() => setSelectedMuscle(id)}
            className="p-2.5 rounded-xl bg-[#111827] border-2 border-orange-500/80 shadow-[0_0_15px_rgba(249,115,22,0.25)] flex items-center gap-2 cursor-pointer transition transform hover:scale-[1.02]"
          >
            <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
              <Flame className="w-4 h-4 animate-bounce" />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] uppercase font-bold text-orange-400 tracking-wider">
                Motor Principal (95%)
              </div>
              <div className="text-xs font-extrabold text-white truncate">{getMuscleSpanishName(id)}</div>
            </div>
          </div>
        ))}
        {secondaryMuscleIds.map((id) => (
          <div
            key={id}
            onClick={() => setSelectedMuscle(id)}
            className="p-2.5 rounded-xl bg-[#111827] border border-[#38BDF8]/40 shadow-[0_0_10px_rgba(56,189,248,0.15)] flex items-center gap-2 cursor-pointer transition hover:border-[#38BDF8]"
          >
            <div className="w-7 h-7 rounded-lg bg-[#38BDF8]/20 text-[#38BDF8] flex items-center justify-center shrink-0">
              <Shield className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] uppercase font-bold text-[#38BDF8] tracking-wider">
                Sinergista (65%)
              </div>
              <div className="text-xs font-bold text-gray-200 truncate">{getMuscleSpanishName(id)}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#06080F] border border-gray-800/90 rounded-2xl p-4 relative overflow-hidden flex flex-col md:flex-row items-center justify-around gap-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900/40 via-[#06080F] to-[#06080F] pointer-events-none" />
        <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-black to-transparent pointer-events-none" />

        <svg width="0" height="0" className="absolute">
          <defs>
            <linearGradient id="muscleFireGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF6B00" />
              <stop offset="50%" stopColor="#FF2A00" />
              <stop offset="100%" stopColor="#D90429" />
            </linearGradient>
            <linearGradient id="muscleCyanGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>
            <linearGradient id="muscleDarkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#475569" />
              <stop offset="40%" stopColor="#334155" />
              <stop offset="100%" stopColor="#1E293B" />
            </linearGradient>
            <linearGradient id="boneGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#94A3B8" />
              <stop offset="100%" stopColor="#64748B" />
            </linearGradient>
            <pattern
              id="striatedPattern"
              width="4"
              height="4"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line x1="0" y1="0" x2="0" y2="4" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
            </pattern>
          </defs>
        </svg>

        {(viewMode === 'dual' || viewMode === 'anterior') && (
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2 px-2.5 py-0.5 rounded-full bg-gray-900/80 border border-gray-800">
              Vista Anterior (Frente)
            </span>
            <div className="w-56 h-88 relative flex items-center justify-center">
              <AnteriorAnatomySvg getMuscleStatus={getMuscleStatus} />
            </div>
          </div>
        )}

        {(viewMode === 'dual' || viewMode === 'posterior') && (
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-2 px-2.5 py-0.5 rounded-full bg-gray-900/80 border border-gray-800">
              Vista Posterior (Espalda)
            </span>
            <div className="w-56 h-88 relative flex items-center justify-center">
              <PosteriorAnatomySvg getMuscleStatus={getMuscleStatus} />
            </div>
          </div>
        )}
      </div>

      <div className="p-3 rounded-xl bg-[#111827] border border-gray-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-md bg-gradient-to-r from-[#FF6B00] to-[#D90429] shadow-[0_0_8px_rgba(255,87,34,0.8)] inline-block" />
            <span className="text-white font-bold">Motor Principal (Activación Máxima)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-md bg-gradient-to-r from-[#38BDF8] to-[#0284C7] shadow-[0_0_8px_rgba(56,189,248,0.6)] inline-block" />
            <span className="text-gray-300 font-semibold">Músculo Sinergista / Asistente</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-md bg-[#334155] inline-block" />
            <span className="text-gray-400">Anatomía Estabilizadora</span>
          </div>
        </div>
        <div className="text-[11px] text-gray-400 font-mono">Modelado Biomecánico APEX • 2026</div>
      </div>
    </div>
  );
};

export const EXERCISE_BIOMECHANICS_MAP: Record<string, ExerciseBiomechanics> = {
  'ta-1': {
    id: 'ta-1',
    animationType: 'bench_press',
    primaryMuscleIds: ['chest_mid', 'chest_all'],
    secondaryMuscleIds: ['deltoid_ant', 'triceps'],
    primaryMuscles: ['Pectoral Mayor (Porción Esternal)'],
    secondaryMuscles: ['Deltoides Anterior', 'Tríceps Braquial'],
    tempoLabel: '3-1-1 (3s bajada • 1s pausa abajo • 1s subida explosiva)',
    breathingTip:
      'Inhala profundo mientras bajas las mancuernas de 25 kg; exhala fuerte al empujar hacia arriba.',
    correctFormTips: [
      'Junta y baja los omóplatos (retracción escapular) contra el respaldo del Banco XR 6.1 antes de sacar las mancuernas.',
      'Mantén los codos a un ángulo de 45°-60° respecto al torso (forma de flecha, no en "T" a 90°) para proteger el manguito rotador.',
      'Planta los pies firmes en el piso para generar estabilidad ("Leg Drive") sin despegar el glúteo del banco.',
    ],
    commonMistakes: [
      'Chocar las mancuernas de 25 kg arriba perdiendo la tensión en el pecho.',
      'Rebotar en la parte baja sin controlar los 3 segundos de fase excéntrica.',
    ],
    proBiomechanicNote:
      'Al bajar las mancuernas ligeramente por debajo de la línea de los pezones estirando las fibras pectorales 1 segundo, duplicas el reclutamiento mecánico con tus 25 kg fijos.',
  },
  'ta-2': {
    id: 'ta-2',
    animationType: 'pec_deck',
    primaryMuscleIds: ['chest_all', 'chest_mid'],
    secondaryMuscleIds: ['deltoid_ant'],
    primaryMuscles: ['Pectoral Mayor (Aducción Horizontal y Fibras Internas)'],
    secondaryMuscles: ['Deltoides Anterior', 'Coracobraquial'],
    tempoLabel: '2-2-2 (2s cierre • 2s contracción máxima • 2s apertura)',
    breathingTip:
      'Exhala al juntar los brazos frente al pecho y sostén 1-2s apretando; inhala al abrir lentamente.',
    correctFormTips: [
      'Ajusta tu postura en la Forza Gym con el pecho alto ("esternón hacia el techo") y hombros pegados al respaldo.',
      'Piensa en "juntar los bíceps/codos" en lugar de empujar solo con las manos para aislar el pectoral al 100%.',
      'Mantén una pausa isométrica real de 1 a 2 segundos cuando los brazos estén cerrados frente a ti.',
    ],
    commonMistakes: [
      'Adelantar los hombros al final del movimiento quitándole trabajo al pecho.',
      'Dejar que las placas de la Forza Gym choquen entre repeticiones.',
    ],
    proBiomechanicNote:
      'La torre de poleas Forza Gym mantiene tensión constante incluso en el cierre completo, donde las mancuernas pierden gravedad.',
  },
  'ta-3': {
    id: 'ta-3',
    animationType: 'seated_row',
    primaryMuscleIds: ['lats', 'traps_mid'],
    secondaryMuscleIds: ['biceps', 'deltoid_post', 'lower_back'],
    primaryMuscles: ['Dorsal Ancho', 'Romboides', 'Trapecio Medio'],
    secondaryMuscles: ['Bíceps Braquial', 'Deltoides Posterior', 'Erectores Espinales'],
    tempoLabel: '2-1-1 (1s tracción • 1s apretón escapular • 2s regreso controlado)',
    breathingTip:
      'Exhala al llevar el agarre hacia el abdomen bajo; inhala al estirar los dorsales hacia adelante.',
    correctFormTips: [
      'Inicia cada repetición retrayendo las escápulas (juntando omóplatos) una fracción de segundo antes de doblar los codos.',
      'Dirige el maneral de la polea baja de la Forza Gym hacia el ombligo/abdomen bajo con los codos pegados al cuerpo.',
      'Mantén la columna neutra y el pecho erguido sin columpiar el tronco hacia atrás.',
    ],
    commonMistakes: [
      'Usar el impulso lumbar columpiándose hacia adelante y atrás.',
      'Encoger los hombros hacia las orejas activando el trapecio superior en vez del dorsal.',
    ],
    proBiomechanicNote:
      'Tirar hacia la cadera/ombligo con los codos rozando las costillas maximiza el brazo de momento sobre el dorsal ancho.',
  },
  'ta-4': {
    id: 'ta-4',
    animationType: 'shoulder_press',
    primaryMuscleIds: ['deltoid_ant', 'deltoid_lat'],
    secondaryMuscleIds: ['triceps', 'traps_up'],
    primaryMuscles: ['Deltoides Anterior', 'Deltoides Lateral'],
    secondaryMuscles: ['Tríceps Braquial', 'Haz Clavicular del Pectoral'],
    tempoLabel: '2-1-1 (2s bajada a nivel de orejas • 1s subida firme)',
    breathingTip:
      'Inhala al bajar las mancuernas a la altura de la barbilla; exhala al extender sobre la cabeza.',
    correctFormTips: [
      'Coloca el respaldo del Banco XR 6.1 a ~80° (ligeramente inclinado) para liberar el espacio subacromial del hombro.',
      'Adelanta los codos unos 30° hacia el frente (plano escapular) en lugar de abrirlos totalmente a los lados.',
      'Mantén el abdomen y glúteos contraídos para no arquear la espalda baja.',
    ],
    commonMistakes: [
      'Arquear excesivamente la zona lumbar convirtiendo el ejercicio en un press inclinado.',
      'Hacer medias repeticiones sin bajar las mancuernas hasta el nivel del mentón/orejas.',
    ],
    proBiomechanicNote:
      'Empujar en el plano escapular (30° hacia adelante) alinea la cabeza del húmero con la cavidad glenoidea y evita pinzamientos.',
  },
  'ta-5': {
    id: 'ta-5',
    animationType: 'tricep_pushdown',
    primaryMuscleIds: ['triceps'],
    secondaryMuscleIds: ['forearms'],
    primaryMuscles: ['Tríceps Braquial (Cabeza Lateral y Medial)'],
    secondaryMuscles: ['Ancóneo', 'Cabeza Larga del Tríceps'],
    tempoLabel: '2-1-1 (1s empuje abajo • 1s bloqueo • 2s subida controlada)',
    breathingTip:
      'Exhala al extender completamente los codos hacia abajo; inhala mientras el antebrazo sube.',
    correctFormTips: [
      'Clava los codos a los costados de tus costillas; solo debe moverse la articulación del codo como una bisagra.',
      'Inclina el torso apenas 10°-15° hacia adelante desde la cadera y bloquea los codos por completo abajo 1 segundo.',
      'Controla la subida hasta que el antebrazo pase ligeramente de los 90° sin que los codos se vayan hacia adelante.',
    ],
    commonMistakes: [
      'Subir y bajar los codos usando el pecho y los hombros para mover más placas.',
      'No bloquear el codo al final del recorrido (ahí ocurre la máxima contracción del tríceps).',
    ],
    proBiomechanicNote:
      'Mantener el hombro en ligera extensión con los codos pegados al cuerpo enfatiza la cabeza lateral del tríceps (la que da forma de herradura al brazo).',
  },
  'ta-6': {
    id: 'ta-6',
    animationType: 'lateral_raise',
    primaryMuscleIds: ['deltoid_lat'],
    secondaryMuscleIds: ['traps_up', 'deltoid_ant'],
    primaryMuscles: ['Deltoides Lateral (Amplitud en "V")'],
    secondaryMuscles: ['Supraespinoso', 'Trapecio Superior (Estabilizador)'],
    tempoLabel: '2-1-1 + Drop Set inmediato sin descanso con Mancuernas Rojas',
    breathingTip: 'Exhala al elevar los brazos hacia los lados; inhala bajando en 2 segundos.',
    correctFormTips: [
      'Piensa en "lanzar las mancuernas lejos hacia las paredes laterales" en vez de subirlas hacia el techo.',
      'Mantén los codos ligeramente flexionados (15°) y sube hasta la línea de los hombros con los codos liderando el movimiento.',
      'Al terminar las 15 reps con ajustables, toma de inmediato las mancuernas rojas ligeras y haz 12 reps extras bombeando.',
    ],
    commonMistakes: [
      'Balancear la cadera para impulsar el peso hacia arriba.',
      'Subir las manos más alto que los codos o encoger el cuello.',
    ],
    proBiomechanicNote:
      'El deltoides lateral tiene alta proporción de fibras resistentes a la fatiga; el Drop Set con las mancuernas rojas agota hasta la última unidad motora.',
  },
  'pa-1': {
    id: 'pa-1',
    animationType: 'goblet_squat',
    primaryMuscleIds: ['quads', 'glutes'],
    secondaryMuscleIds: ['adductors', 'calves', 'abs'],
    primaryMuscles: ['Cuádriceps (Vasto Interno, Externo y Recto Femoral)', 'Glúteo Mayor'],
    secondaryMuscles: ['Aductores', 'Core Estabilizador', 'Erectores Espinales'],
    tempoLabel: '3-1-1 (3s bajada profunda • 1s pausa abajo • 1s subida potente)',
    breathingTip:
      'Inhala profundo inflando el abdomen (maniobra de Bracing) antes de bajar; exhala al pasar la mitad de la subida.',
    correctFormTips: [
      'Asegúrate de que las rodillas sigan la misma dirección que la punta de tus pies durante todo el descenso.',
      'Baja controlado en 3 segundos hasta romper el paralelo (cadera ligeramente por debajo de la línea de las rodillas).',
      'Empuja el piso con toda la planta del pie (trípode plantar: talón, base del dedo gordo y dedo pequeño).',
    ],
    commonMistakes: [
      'Dejar que las rodillas colapsen hacia adentro (valgo de rodilla) al subir.',
      'Levantar los talones del suelo o redondear la espalda baja.',
    ],
    proBiomechanicNote:
      'Prioridad MovingLife: Tus piernas están en 87.7% (Izq) y 88.9% (Der). La máxima flexión de rodilla en el fondo de la sentadilla es el estímulo #1 para hipertrofiar el cuádriceps.',
  },
  'pa-2': {
    id: 'pa-2',
    animationType: 'bulgarian_squat',
    primaryMuscleIds: ['quads', 'glutes'],
    secondaryMuscleIds: ['hamstrings', 'calves'],
    primaryMuscles: ['Cuádriceps Unilateral', 'Glúteo Mayor y Medio'],
    secondaryMuscles: ['Isquiosurales', 'Estabilizadores de Cadera'],
    tempoLabel: '3-1-1 (Empezar SIEMPRE con Pierna Izquierda 7.93 kg)',
    breathingTip:
      'Inhala durante los 3 segundos de descenso; exhala empujando fuerte con el talón/mediopié delantero.',
    correctFormTips: [
      'Apoya el empeine del pie trasero en el cojín del Banco XR 6.1 y da un paso medio hacia adelante.',
      'El 85%-90% de tu peso debe estar sobre la pierna delantera; la pierna trasera solo sirve de equilibrio.',
      'Inicia SIEMPRE con la pierna izquierda (7.93 kg en tu báscula Camry vs 8.04 kg derecha) y marca el número de repeticiones con ella.',
    ],
    commonMistakes: [
      'Empujar con el pie trasero sobre el banco en lugar de cargar toda la fuerza en la pierna delantera.',
      'Bajar demasiado rápido perdiendo el equilibrio de la rodilla.',
    ],
    proBiomechanicNote:
      'La Sentadilla Búlgara elimina el déficit bilateral y corrige directamente tu diferencia entre pierna izquierda (87.7%) y derecha (88.9%).',
  },
  'pa-3': {
    id: 'pa-3',
    animationType: 'leg_extension',
    primaryMuscleIds: ['quads'],
    secondaryMuscleIds: ['calves'],
    primaryMuscles: ['Recto Femoral', 'Vasto Medial (Gota de Agua)', 'Vasto Lateral'],
    secondaryMuscles: ['Estabilizadores Rotulianos'],
    tempoLabel: '2-2-1 (1s subida • 1.5s-2s pausa isométrica arriba • 2s bajada)',
    breathingTip: 'Exhala al extender las piernas y mantén el aire apretando 1.5s arriba; inhala al bajar.',
    correctFormTips: [
      'Alinea tus rodillas exactamente con el eje de giro de los rodillos inferiores de la Forza Gym.',
      'Sujétate fuerte del asiento para pegar la cadera al banco y que el recto femoral trabaje en su máxima longitud.',
      'Sostén 1.5 segundos en extensión completa con las puntas de los pies ligeramente hacia arriba (dorsiflexión).',
    ],
    commonMistakes: [
      'Patear las placas con impulso balístico y dejarlas caer de golpe.',
      'Levantar los glúteos del asiento al hacer fuerza.',
    ],
    proBiomechanicNote:
      'El Recto Femoral es el único músculo del cuádriceps que cruza la cadera y la rodilla; solo se activa al 100% en extensión de rodilla sentado.',
  },
  'pa-4': {
    id: 'pa-4',
    animationType: 'calf_raise',
    primaryMuscleIds: ['calves'],
    secondaryMuscleIds: ['forearms'],
    primaryMuscles: ['Gastrocnemio (Gemelos Interno y Externo)', 'Sóleo'],
    secondaryMuscles: ['Tibial Posterior', 'Estabilizadores del Tobillo'],
    tempoLabel: '2-2-2 (2s estiramiento abajo • 2s contracción en punta)',
    breathingTip: 'Exhala al subir sobre la base del dedo gordo; inhala al estirar el talón abajo.',
    correctFormTips: [
      'Haz una pausa obligatoria de 2 segundos abajo (estiramiento) para eliminar el reflejo elástico del tendón de Aquiles.',
      'Sube empujando sobre el metatarso del dedo gordo y segundo dedo (evita irte hacia el borde externo del pie).',
      'Sostén 2 segundos en la cima apretando los gemelos al máximo con las dos mancuernas de 25 kg (50 kg total).',
    ],
    commonMistakes: [
      'Hacer rebotes rápidos sin pausas (el tendón de Aquiles hace todo el trabajo y el músculo no crece).',
      'Flexionar las rodillas para ayudarse a subir.',
    ],
    proBiomechanicNote:
      'Fortalecer gemelos y sóleo con pausas isométricas protege tus tobillos y tendones para los saltos pliométricos de Insanity HIIT.',
  },
  'tb-1': {
    id: 'tb-1',
    animationType: 'lat_pulldown',
    primaryMuscleIds: ['lats'],
    secondaryMuscleIds: ['biceps', 'traps_mid'],
    primaryMuscles: ['Dorsal Ancho (Amplitud en "V")', 'Redondo Mayor'],
    secondaryMuscles: ['Bíceps Braquial', 'Romboides', 'Trapecio Inferior'],
    tempoLabel: '3-1-1 (1s tracción a clavícula • 1s pausa • 3s subida estirando)',
    breathingTip: 'Exhala al bajar la barra de la Forza Gym hacia el pecho superior; inhala al estirar arriba.',
    correctFormTips: [
      'Toma la barra un poco más ancho que tus hombros y deprime las escápulas (baja los hombros lejos de las orejas) antes de jalar.',
      'Inclina el torso apenas 15° hacia atrás, saca el pecho y lleva la barra hacia la clavícula pensando en "meter los codos en los bolsillos traseros".',
      'Controla los 3 segundos de subida dejando que los dorsales se estiren por completo arriba.',
    ],
    commonMistakes: [
      'Jalar la barra por detrás de la nuca (peligroso para el manguito rotador y cervicales).',
      'Bajar la barra hasta el estómago doblando las muñecas hacia adentro.',
    ],
    proBiomechanicNote:
      'Pensar en tus manos como "ganchos" y enfocar la mente en bajar los codos verticalmente reduce la fatiga del bíceps y dirige el estímulo al dorsal.',
  },
  'tb-2': {
    id: 'tb-2',
    animationType: 'one_arm_row',
    primaryMuscleIds: ['lats', 'traps_mid'],
    secondaryMuscleIds: ['biceps', 'deltoid_post'],
    primaryMuscles: ['Dorsal Ancho Unilateral', 'Trapecio Medio', 'Romboides'],
    secondaryMuscles: ['Deltoides Posterior', 'Braquiorradial'],
    tempoLabel: '2-1-1 (Tracción en arco tipo "sierra" hacia la cadera)',
    breathingTip: 'Exhala al llevar la mancuerna de 25 kg hacia el bolsillo de la cadera; inhala al bajar.',
    correctFormTips: [
      'Apoya la mano y rodilla contraria en el Banco XR 6.1 manteniendo la espalda totalmente plana y paralela al piso.',
      'No subas la mancuerna de 25 kg en línea recta hacia el hombro: llévala en un arco hacia atrás (hacia tu cadera/bolsillo).',
      'Deja que el omóplato baje ligeramente en la parte inferior para lograr un estiramiento completo del dorsal.',
    ],
    commonMistakes: [
      'Girar y torcer el torso en cada repetición usando impulso lumbar.',
      'Jalar hacia el pecho encogiendo el hombro y cargando solo el bíceps.',
    ],
    proBiomechanicNote:
      'La trayectoria curva ("J-curve") desde abajo del hombro hasta la cresta ilíaca sigue exactamente la dirección anatómica de las fibras del dorsal ancho.',
  },
  'tb-3': {
    id: 'tb-3',
    animationType: 'incline_press',
    primaryMuscleIds: ['chest_upper'],
    secondaryMuscleIds: ['deltoid_ant', 'triceps'],
    primaryMuscles: ['Pectoral Mayor (Haz Clavicular / Pecho Superior)'],
    secondaryMuscles: ['Deltoides Anterior', 'Tríceps Braquial'],
    tempoLabel: '3-1-1 (Banco XR 6.1 a 30° de inclinación)',
    breathingTip: 'Inhala en los 3 segundos de descenso hacia la parte alta del pecho; exhala al empujar.',
    correctFormTips: [
      'Ajusta el Banco XR 6.1 a 30° (primer o segundo nivel de inclinación); si lo subes a 45° o más, el hombro se lleva casi todo el trabajo.',
      'Baja las mancuernas controladamente hacia la línea clavicular (parte alta del pecho) con los codos a 45°.',
      'Empuja verticalmente manteniendo las escápulas retraídas contra el respaldo.',
    ],
    commonMistakes: [
      'Poner el banco demasiado vertical (45°-60°) convirtiéndolo en press de hombro.',
      'Despegar la cadera o arquear la espalda para compensar el peso.',
    ],
    proBiomechanicNote:
      'Estudios de electromiografía (EMG) confirman que 30° de inclinación es el ángulo exacto que maximiza la activación del haz clavicular sin sobreestimular el deltoides.',
  },
  'tb-4': {
    id: 'tb-4',
    animationType: 'preacher_curl',
    primaryMuscleIds: ['biceps'],
    secondaryMuscleIds: ['forearms'],
    primaryMuscles: ['Bíceps Braquial (Cabeza Corta y Braquial Anterior)'],
    secondaryMuscles: ['Cabeza Larga del Bíceps', 'Supinadores del Antebrazo'],
    tempoLabel: '3-1-1 (3s bajada estricta sin bloquear en hiperextensión)',
    breathingTip: 'Exhala al subir la carga hacia los hombros; inhala resistiendo los 3 segundos de bajada.',
    correctFormTips: [
      'Ajusta tu posición en el Banco Predicador (Scott) de la Forza Gym de modo que tus axilas descansen pegadas al borde superior del cojín.',
      'Pega todo el tríceps al cojín durante toda la serie; no levantes los codos al subir.',
      'Baja en 3 segundos hasta alcanzar el 95% de extensión (manteniendo tensión activa sin soltar el peso de golpe abajo).',
    ],
    commonMistakes: [
      'Echar el cuerpo hacia atrás o despegar los codos del cojín para hacer palanca.',
      'Soltar la tensión en la parte más baja poniendo en riesgo el tendón distal del bíceps.',
    ],
    proBiomechanicNote:
      'El banco Scott genera el pico de tensión en la posición de máximo estiramiento (hipertrofia mediada por estiramiento).',
  },
  'tb-5': {
    id: 'tb-5',
    animationType: 'rear_delt_fly',
    primaryMuscleIds: ['deltoid_post'],
    secondaryMuscleIds: ['traps_mid'],
    primaryMuscles: ['Deltoides Posterior (Postura 3D del Hombro)'],
    secondaryMuscles: ['Trapecio Medio', 'Infraespinoso', 'Redondo Menor'],
    tempoLabel: '2-1-1 (Pecho apoyado en Banco XR 6.1 inclinado)',
    breathingTip: 'Exhala al abrir los brazos hacia atrás; inhala al regresar controladamente.',
    correctFormTips: [
      'Acuéstate boca abajo sobre el respaldo inclinado del Banco XR 6.1 para eliminar cualquier balanceo del cuerpo.',
      'Abre los brazos en un ángulo de ~45°-60° respecto al torso pensando en "separar los codos hacia afuera", no en juntar los omóplatos.',
      'Usa las mancuernas rojas o ajustables ligeras para sentir el ardor puro en la parte trasera del hombro.',
    ],
    commonMistakes: [
      'Usar demasiado peso y terminar haciendo un remo con la espalda media.',
      'Doblar excesivamente los codos al subir.',
    ],
    proBiomechanicNote:
      'Un deltoides posterior fuerte equilibra todo el trabajo de empuje de pecho e Insanity (Push-Up Jacks), mejorando tu postura de inmediato.',
  },
  'tb-6': {
    id: 'tb-6',
    animationType: 'hammer_dips',
    primaryMuscleIds: ['forearms', 'triceps', 'biceps'],
    secondaryMuscleIds: ['deltoid_ant'],
    primaryMuscles: ['Braquiorradial y Braquial (Martillo) + Tríceps (Fondos)'],
    secondaryMuscles: ['Bíceps Braquial', 'Deltoides Anterior'],
    tempoLabel: 'Biserie Metabólica: 12-15 reps Curl Martillo + 12-15 reps Fondos sin pausa',
    breathingTip: 'Respiración rítmica y fluida: exhala en el esfuerzo e inhala al bajar.',
    correctFormTips: [
      'En el Curl Martillo: mantén las palmas mirándose entre sí (agarre neutro) y los codos fijos a los costados.',
      'Pasa sin descanso al Banco XR 6.1: apoya las manos en el borde, desliza el glúteo rozando el banco y baja hasta que los codos formen 90°.',
      'Empuja fuerte con las palmas extendiendo los tríceps por completo arriba.',
    ],
    commonMistakes: [
      'Alejar la espalda del Banco XR 6.1 durante los fondos (eso estresa la cápsula anterior del hombro).',
      'Balancear las mancuernas en el curl martillo.',
    ],
    proBiomechanicNote:
      'Las biseries agonista-antagonista (bíceps + tríceps) aumentan el flujo sanguíneo braquial y ahorran tiempo sin perder rendimiento.',
  },
  'pb-1': {
    id: 'pb-1',
    animationType: 'rdl',
    primaryMuscleIds: ['hamstrings', 'glutes'],
    secondaryMuscleIds: ['lower_back', 'traps_mid'],
    primaryMuscles: ['Isquiosurales (Bíceps Femoral, Semitendinoso)', 'Glúteo Mayor'],
    secondaryMuscles: ['Erectores Espinales', 'Dorsal Ancho (Estabilizador)', 'Trapecio'],
    tempoLabel: '3-1-1 (Bisagra de cadera pura con par de 25 kg = 50 kg)',
    breathingTip:
      'Inhala arriba bloqueando el abdomen; baja en 3s y exhala al empujar la cadera hacia adelante al subir.',
    correctFormTips: [
      'Desbloquea las rodillas apenas 15° y déjalas fijas ahí: el movimiento es empujar la cadera hacia la pared de atrás (como cerrar la puerta de un auto con los glúteos).',
      'Desliza las mancuernas de 25 kg pegadas a tus muslos y espinillas; baja solo hasta mitad de la espinilla (donde tu cadera deje de ir hacia atrás).',
      'Mantén la espalda neutra, cuello alineado con la columna y hombros atrás.',
    ],
    commonMistakes: [
      'Doblar las rodillas como si fuera una sentadilla.',
      'Bajar las mancuernas hasta el piso redondeando la espalda baja (cuando la cadera ya no va más atrás, ahí termina tu rango).',
    ],
    proBiomechanicNote:
      'Con tus 50 kg en mancuernas, mantener las pesas rozando tus piernas reduce la tensión lumbar y concentra el 100% de la carga en isquios y glúteo.',
  },
  'pb-2': {
    id: 'pb-2',
    animationType: 'hip_thrust',
    primaryMuscleIds: ['glutes'],
    secondaryMuscleIds: ['hamstrings', 'lower_back'],
    primaryMuscles: ['Glúteo Mayor (Máximo Reclutamiento en Acortamiento)'],
    secondaryMuscles: ['Glúteo Medio', 'Isquiosurales', 'Core'],
    tempoLabel: '2-2-1 (1s subida • 2s contracción máxima arriba • 2s bajada)',
    breathingTip: 'Exhala al subir la cadera y aprieta los glúteos 2 segundos arriba; inhala al bajar.',
    correctFormTips: [
      'Apoya la base de tus escápulas (justo debajo de los omóplatos) en el borde del Banco XR 6.1 y pon la colchoneta doblada bajo la mancuerna de 25 kg.',
      'En el punto más alto, tus espinillas deben quedar totalmente verticales (rodillas a 90°).',
      'Mantén la mirada al frente (mentón pegado al pecho) y haz una ligera retroversión pélvica arriba apretando el glúteo 2 segundos.',
    ],
    commonMistakes: [
      'Mirar al techo y arquear la espalda baja en lugar de extender la cadera con el glúteo.',
      'Poner los pies demasiado cerca (carga cuádriceps) o demasiado lejos (carga isquios).',
    ],
    proBiomechanicNote:
      'Mirar al frente con las costillas abajo ("cierre costal") bloquea la columna lumbar y obliga al glúteo mayor a hacer todo el trabajo.',
  },
  'pb-3': {
    id: 'pb-3',
    animationType: 'lunges',
    primaryMuscleIds: ['glutes', 'quads'],
    secondaryMuscleIds: ['hamstrings', 'calves'],
    primaryMuscles: ['Glúteo Mayor', 'Cuádriceps', 'Isquiosurales'],
    secondaryMuscles: ['Glúteo Medio (Estabilidad Pélvica)', 'Aductores'],
    tempoLabel: '2-1-1 (Zancada larga + ligera inclinación del torso a 15°)',
    breathingTip: 'Inhala al dar el paso y bajar la rodilla trasera; exhala empujando el piso con el pie delantero.',
    correctFormTips: [
      'Da un paso ligeramente más largo de lo normal e inclina el torso unos 15° hacia adelante (con espalda recta) para estirar al máximo el glúteo.',
      'Baja hasta que la rodilla trasera quede a 2-3 cm del suelo sin golpear.',
      'Empuja fuerte con el talón y mediopié de la pierna delantera para volver a subir.',
    ],
    commonMistakes: [
      'Caminar sobre una "cuerda floja" cruzando un pie detrás del otro (mantén los pies al ancho de tus caderas como en rieles de tren).',
      'Golpear la rodilla trasera contra el suelo.',
    ],
    proBiomechanicNote:
      'Este ejercicio en Viernes (Pierna B) complementa la Sentadilla Búlgara del martes para subir tus piernas por encima del 90% estándar en MovingLife.',
  },
  'pb-4': {
    id: 'pb-4',
    animationType: 'leg_curl',
    primaryMuscleIds: ['hamstrings'],
    secondaryMuscleIds: ['calves'],
    primaryMuscles: ['Isquiosurales (Flexión de Rodilla)', 'Sartorio y Grácil'],
    secondaryMuscles: ['Gastrocnemio', 'Glúteo (Estabilizador de Cadera)'],
    tempoLabel: '3-1-1 (3s fase negativa controlada)',
    breathingTip: 'Exhala al flexionar las rodillas acercando el talón al glúteo; inhala en los 3 segundos de bajada.',
    correctFormTips: [
      'Acuéstate boca abajo en el Banco XR 6.1 sujetando la mancuerna firmemente entre las plantas de tus pies.',
      'Mantén la pelvis y el pubis presionados contra el banco (no levantes la cadera al subir el peso).',
      'Resiste la bajada contando 3 segundos completos para maximizar el daño muscular controlado en los isquios.',
    ],
    commonMistakes: [
      'Levantar la cadera del banco formando una carpa para acortar el recorrido.',
      'Dejar caer los pies rápido después de subir.',
    ],
    proBiomechanicNote:
      'Los isquiosurales tienen dos funciones: extender la cadera (Peso Muerto Rumano) y flexionar la rodilla (Curl Femoral). Hacer ambos garantiza desarrollo completo.',
  },
};

function renderStudioRigSvg(animationType: string, isContracted: boolean, glowFilter: string): React.ReactNode {
  switch (animationType) {
    case 'lat_pulldown': {
      const yPos = isContracted ? 88 : 42;
      const elbowX = isContracted ? 132 : 142;
      const elbowY = isContracted ? 96 : 56;
      return (
        <g>
          <g>
            <rect x="45" y="10" width="8" height="150" fill="url(#silverSteel)" rx="2" />
            <rect x="75" y="10" width="8" height="150" fill="url(#silverSteel)" rx="2" />
            <line x1="45" y1="14" x2="185" y2="14" stroke="url(#silverSteel)" strokeWidth="6" />
            <circle cx="160" cy="14" r="7" fill="#1E293B" stroke="#94A3B8" strokeWidth="2" />
            <g>
              {Array.from({ length: 8 }, (_, idx) => (
                <rect
                  key={idx}
                  x="48"
                  y={45 + idx * 9 + (isContracted ? -12 : 0)}
                  width="31"
                  height="7"
                  rx="1.5"
                  fill="#334155"
                  stroke="#1E293B"
                  strokeWidth="0.8"
                />
              ))}
              <circle cx="63" cy={94 + (isContracted ? -12 : 0)} r="2" fill="#FACC15" />
            </g>
            <line x1="160" y1="14" x2="160" y2={yPos} stroke="#94A3B8" strokeWidth="2" />
            <path
              d={`M 115 ${yPos + 6} Q 160 ${yPos - 2} 205 ${yPos + 6}`}
              fill="none"
              stroke="#E2E8F0"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </g>

          <rect x="145" y="128" width="30" height="8" rx="2" fill="#0F172A" />
          <line x1="160" y1="136" x2="160" y2="162" stroke="#475569" strokeWidth="4" />
          <rect x="150" y="105" width="20" height="7" rx="3" fill="#DC2626" />

          <g>
            <ellipse cx="160" cy={yPos + 22} rx="9" ry="11" fill="url(#mannequinMuscularSkin)" />
            <path
              d={`M 152 ${yPos + 31} L 168 ${yPos + 31} L 174 ${yPos + 46} L 160 ${yPos + 60} L 146 ${yPos + 46} Z`}
              fill="#475569"
            />
            <g style={{ filter: glowFilter }}>
              <path
                d={`M 146 ${yPos + 42} Q ${isContracted ? 134 : 140} ${yPos + 54} 148 ${yPos + 70} Q 156 ${
                  yPos + 68
                } 160 ${yPos + 60} Z`}
                fill="url(#fieryMuscleGlow)"
                stroke="#FFA000"
                strokeWidth="1.5"
              />
              <path
                d={`M 174 ${yPos + 42} Q ${isContracted ? 186 : 180} ${yPos + 54} 172 ${yPos + 70} Q 164 ${
                  yPos + 68
                } 160 ${yPos + 60} Z`}
                fill="url(#fieryMuscleGlow)"
                stroke="#FFA000"
                strokeWidth="1.5"
              />
              <path
                d={`M 146 ${yPos + 42} Q ${isContracted ? 134 : 140} ${yPos + 54} 148 ${yPos + 70} M 174 ${
                  yPos + 42
                } Q ${isContracted ? 186 : 180} ${yPos + 54} 172 ${yPos + 70}`}
                fill="url(#studioStriations)"
              />
            </g>
            <line x1="160" y1={yPos + 32} x2="160" y2={yPos + 74} stroke="#0F172A" strokeWidth="1.5" />
            <path
              d={`M 148 ${yPos + 72} L 172 ${yPos + 72} L 176 130 L 144 130 Z`}
              fill="#111827"
              stroke="#1E293B"
            />
            <polyline
              points={`120,${yPos + 5} ${elbowX},${elbowY} 148,${yPos + 36}`}
              fill="none"
              stroke="url(#mannequinMuscularSkin)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points={`200,${yPos + 5} ${320 - elbowX},${elbowY} 172,${yPos + 36}`}
              fill="none"
              stroke="url(#mannequinMuscularSkin)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </g>
      );
    }

    case 'lateral_raise':
    case 'shoulder_press': {
      const isPress = animationType === 'shoulder_press';
      const handY = isContracted ? (isPress ? 38 : 74) : isPress ? 74 : 115;
      const leftX = isPress ? 142 : isContracted ? 104 : 144;
      const rightX = isPress ? 178 : isContracted ? 216 : 176;

      return (
        <g>
          <g>
            <ellipse cx="160" cy="40" rx="10" ry="13" fill="url(#mannequinMuscularSkin)" />
            <path d="M 136 60 Q 160 63 184 60" fill="none" stroke="#CBD5E1" strokeWidth="2" />
            <g style={{ filter: glowFilter }}>
              <ellipse
                cx={134}
                cy={62}
                rx={11}
                ry={9}
                fill="url(#fieryMuscleGlow)"
                stroke="#FFA000"
                strokeWidth="1.5"
              />
              <ellipse
                cx={186}
                cy={62}
                rx={11}
                ry={9}
                fill="url(#fieryMuscleGlow)"
                stroke="#FFA000"
                strokeWidth="1.5"
              />
            </g>
            <path
              d="M 138 62 Q 160 62 160 76 Q 160 92 144 94 Q 134 90 134 76 Z"
              fill="#475569"
              stroke="#334155"
            />
            <path
              d="M 182 62 Q 160 62 160 76 Q 160 92 176 94 Q 186 90 186 76 Z"
              fill="#475569"
              stroke="#334155"
            />
            <g>
              <rect x="151" y="96" width="8" height="8" rx="2" fill="#334155" />
              <rect x="161" y="96" width="8" height="8" rx="2" fill="#334155" />
              <rect x="151" y="106" width="8" height="8" rx="2" fill="#334155" />
              <rect x="161" y="106" width="8" height="8" rx="2" fill="#334155" />
              <line x1="160" y1="62" x2="160" y2="124" stroke="#0F172A" strokeWidth="1.5" />
            </g>
            <path d="M 142 120 L 178 120 L 182 146 L 160 144 L 138 146 Z" fill="#111827" stroke="#1E293B" />
            <g fill="url(#mannequinMuscularSkin)">
              <path d="M 142 146 Q 136 166 142 188 L 152 188 Q 156 166 150 146 Z" />
              <path d="M 178 146 Q 184 166 178 188 L 168 188 Q 164 166 170 146 Z" />
            </g>
            <polyline
              points={`134,64 ${isPress ? 130 : (134 + leftX) / 2},${(64 + handY) / 2} ${leftX},${handY}`}
              fill="none"
              stroke="url(#mannequinMuscularSkin)"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <rect
              x={leftX - 8}
              y={handY - 6}
              width="16"
              height="12"
              rx="2.5"
              fill="url(#hexRubber25)"
              stroke="#475569"
            />
            <polyline
              points={`186,64 ${isPress ? 190 : (186 + rightX) / 2},${(64 + handY) / 2} ${rightX},${handY}`}
              fill="none"
              stroke="url(#mannequinMuscularSkin)"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <rect
              x={rightX - 8}
              y={handY - 6}
              width="16"
              height="12"
              rx="2.5"
              fill="url(#hexRubber25)"
              stroke="#475569"
            />
          </g>
        </g>
      );
    }

    case 'bench_press':
    case 'incline_press': {
      const isIncline = animationType === 'incline_press';
      const dbY = isContracted ? 42 : 78;
      const elbowY = isContracted ? 62 : 98;
      return (
        <g>
          <g>
            <line x1="75" y1="120" x2="235" y2="120" stroke="#334155" strokeWidth="7" strokeLinecap="round" />
            <line x1="95" y1="120" x2="95" y2="160" stroke="#1E293B" strokeWidth="6" />
            <line x1="215" y1="120" x2="215" y2="160" stroke="#1E293B" strokeWidth="6" />
            <path
              d={
                isIncline
                  ? 'M 95 120 L 175 80 L 178 86 L 98 126 Z'
                  : 'M 95 116 L 225 116 L 225 124 L 95 124 Z'
              }
              fill="url(#goldsRedBench)"
              stroke="#DC2626"
              strokeWidth="1.5"
            />
          </g>
          <g>
            <circle cx={isIncline ? 104 : 108} cy={isIncline ? 75 : 104} r="10" fill="url(#mannequinMuscularSkin)" />
            <line
              x1={isIncline ? 114 : 118}
              y1={isIncline ? 82 : 108}
              x2={isIncline ? 172 : 190}
              y2={isIncline ? 105 : 108}
              stroke="url(#mannequinMuscularSkin)"
              strokeWidth="16"
              strokeLinecap="round"
            />
            <ellipse
              cx={isIncline ? 134 : 142}
              cy={isIncline ? 89 : 105}
              rx="16"
              ry="9"
              fill="url(#fieryMuscleGlow)"
              style={{ filter: glowFilter }}
            />
            <polyline
              points="190,108 215,115 224,160"
              fill="none"
              stroke="url(#mannequinMuscularSkin)"
              strokeWidth="9"
              strokeLinecap="round"
            />
            <polyline
              points={`${isIncline ? 136 : 142},${isIncline ? 88 : 105} 146,${elbowY} 142,${dbY}`}
              fill="none"
              stroke="url(#mannequinMuscularSkin)"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <g>
              <rect
                x="126"
                y={dbY - 7}
                width="32"
                height="13"
                rx="3.5"
                fill="url(#hexRubber25)"
                stroke="#10B981"
                strokeWidth="1.2"
              />
              <text x="142" y={dbY + 2} fontSize="7" fontWeight="bold" fill="#10B981" textAnchor="middle">
                25 KG
              </text>
            </g>
          </g>
        </g>
      );
    }

    default: {
      const isRdl = animationType === 'rdl';
      const hipY = isContracted ? 92 : 124;
      const headY = isContracted ? 42 : 74;
      return (
        <g>
          {animationType === 'bulgarian_squat' && (
            <g>
              <rect x="65" y="125" width="40" height="10" rx="3" fill="url(#goldsRedBench)" stroke="#DC2626" />
              <line x1="75" y1="135" x2="75" y2="160" stroke="#334155" strokeWidth="5" />
              <line x1="95" y1="135" x2="95" y2="160" stroke="#334155" strokeWidth="5" />
              <polyline
                points={`150,${hipY} 115,${isContracted ? 130 : 142} 85,125`}
                fill="none"
                stroke="url(#mannequinMuscularSkin)"
                strokeWidth="7"
                strokeLinecap="round"
              />
            </g>
          )}
          <g>
            <circle cx="160" cy={headY} r="10" fill="url(#mannequinMuscularSkin)" />
            <line
              x1="160"
              y1={headY + 10}
              x2={isRdl ? (isContracted ? 154 : 180) : 155}
              y2={hipY}
              stroke="url(#mannequinMuscularSkin)"
              strokeWidth="14"
              strokeLinecap="round"
            />
            <g style={{ filter: glowFilter }}>
              {isRdl ? (
                <line
                  x1={isContracted ? 154 : 180}
                  y1={hipY}
                  x2="152"
                  y2="135"
                  stroke="url(#fieryMuscleGlow)"
                  strokeWidth="13"
                  strokeLinecap="round"
                />
              ) : (
                <line
                  x1="155"
                  y1={hipY}
                  x2={isContracted ? 165 : 182}
                  y2={isContracted ? 130 : 138}
                  stroke="url(#fieryMuscleGlow)"
                  strokeWidth="14"
                  strokeLinecap="round"
                />
              )}
            </g>
            <line
              x1={isContracted ? 165 : 182}
              y1={isContracted ? 130 : 138}
              x2="170"
              y2="168"
              stroke="url(#mannequinMuscularSkin)"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <line x1="165" y1="168" x2="182" y2="168" stroke="#334155" strokeWidth="5" strokeLinecap="round" />
            <g>
              <rect
                x={isRdl ? 172 : 166}
                y={headY + (isRdl ? 38 : 22)}
                width="24"
                height="12"
                rx="3"
                fill="url(#hexRubber25)"
                stroke="#10B981"
                strokeWidth="1"
              />
              <text
                x={(isRdl ? 172 : 166) + 12}
                y={headY + (isRdl ? 38 : 22) + 8}
                fontSize="6"
                fontWeight="bold"
                fill="#10B981"
                textAnchor="middle"
              >
                25KG
              </text>
            </g>
          </g>
        </g>
      );
    }
  }
}

export const StudioExerciseCanvasSvg: React.FC<{ animationType: string; phaseIdx: number }> = ({
  animationType,
  phaseIdx,
}) => {
  const isContracted = phaseIdx === 1 || phaseIdx === 2;
  const isPeak = phaseIdx === 2;
  const glowFilter = isPeak
    ? 'drop-shadow(0 0 16px rgba(255, 160, 0, 0.95))'
    : 'drop-shadow(0 0 12px rgba(255, 59, 48, 0.85))';

  return (
    <svg viewBox="0 0 320 200" className="w-full h-full select-none">
      <defs>
        <linearGradient id="gymWoodFloor" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1E1610" />
          <stop offset="40%" stopColor="#2D2117" />
          <stop offset="100%" stopColor="#150E0A" />
        </linearGradient>
        <linearGradient id="fieryMuscleGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFA000" />
          <stop offset="45%" stopColor="#FF3B30" />
          <stop offset="100%" stopColor="#C9184A" />
        </linearGradient>
        <linearGradient id="silverSteel" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#64748B" />
          <stop offset="50%" stopColor="#CBD5E1" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>
        <linearGradient id="goldsRedBench" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1E293B" />
          <stop offset="85%" stopColor="#0F172A" />
          <stop offset="100%" stopColor="#DC2626" />
        </linearGradient>
        <linearGradient id="hexRubber25" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#374151" />
          <stop offset="50%" stopColor="#1F2937" />
          <stop offset="100%" stopColor="#111827" />
        </linearGradient>
        <linearGradient id="mannequinMuscularSkin" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#64748B" />
          <stop offset="35%" stopColor="#94A3B8" />
          <stop offset="70%" stopColor="#475569" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
        <pattern
          id="studioStriations"
          width="3"
          height="3"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(30)"
        >
          <line x1="0" y1="0" x2="0" y2="3" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
        </pattern>
      </defs>

      <rect x="0" y="0" width="320" height="135" fill="#060911" />
      <g opacity="0.18">
        <line x1="25" y1="15" x2="25" y2="135" stroke="#94A3B8" strokeWidth="3" />
        <line x1="75" y1="15" x2="75" y2="135" stroke="#94A3B8" strokeWidth="3" />
        <line x1="25" y1="20" x2="75" y2="20" stroke="#94A3B8" strokeWidth="2.5" />
        <line x1="285" y1="35" x2="285" y2="135" stroke="#94A3B8" strokeWidth="4" />
        <ellipse cx="285" cy="55" rx="14" ry="4" fill="#94A3B8" />
        <ellipse cx="285" cy="85" rx="18" ry="5" fill="#94A3B8" />
        <ellipse cx="285" cy="115" rx="22" ry="6" fill="#94A3B8" />
      </g>
      <ellipse cx="160" cy="135" rx="120" ry="14" fill="#FF8C00" opacity="0.08" />
      <polygon points="0,135 320,135 320,200 0,200" fill="url(#gymWoodFloor)" />
      <g stroke="#3A291E" strokeWidth="1.2" opacity="0.65">
        <line x1="0" y1="150" x2="320" y2="150" />
        <line x1="0" y1="170" x2="320" y2="170" />
        <line x1="0" y1="192" x2="320" y2="192" />
        <line x1="60" y1="135" x2="10" y2="200" />
        <line x1="120" y1="135" x2="90" y2="200" />
        <line x1="180" y1="135" x2="175" y2="200" />
        <line x1="240" y1="135" x2="260" y2="200" />
      </g>

      {renderStudioRigSvg(animationType, isContracted, glowFilter)}
    </svg>
  );
};

interface ExerciseMuscleDiagramProps {
  exerciseId: string;
  exerciseName: string;
}

export const ExerciseMuscleDiagram: React.FC<ExerciseMuscleDiagramProps> = ({
  exerciseId,
  exerciseName,
}) => {
  const bio = EXERCISE_BIOMECHANICS_MAP[exerciseId] || EXERCISE_BIOMECHANICS_MAP['ta-1'];
  const [activeTab, setActiveTab] = useState<'3d_studio' | 'anatomy_hologram' | 'coaching_tips'>('3d_studio');
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(() => {
      setPhaseIdx((prev) => (prev + 1) % 3);
    }, 1800);
    return () => window.clearInterval(id);
  }, [isPlaying]);

  const phaseInfo = [
    {
      title: 'Fase Excéntrica (Bajada / Estiramiento Controlado 3s)',
      tension: '75% Tensión Mecánica',
      color: 'text-sky-400 border-sky-500/40 bg-sky-500/10',
      badge: 'Control Negativo 3s',
      desc: 'Inhala inflando el abdomen (Bracing) y resiste la gravedad.',
    },
    {
      title: 'Fase Concéntrica (Empuje / Tracción Explosiva 1s)',
      tension: '95% Contracción Máxima',
      color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
      badge: 'Potencia 1s',
      desc: 'Exhala fuerte y recluta las fibras tipo II con velocidad controlada.',
    },
    {
      title: 'Contracción Isométrica (Pausa de Máxima Tensión 1-2s)',
      tension: '100% Pico de Activación',
      color: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
      badge: 'Pausa Isométrica 1s',
      desc: 'Aprieta al 100% el músculo objetivo en el punto de acortamiento.',
    },
  ][phaseIdx];

  return (
    <div className="mt-3 bg-[#07090F] border border-gray-800 rounded-2xl p-3.5 sm:p-4 space-y-4 shadow-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-orange-500/15 border border-orange-500/40 flex items-center justify-center text-orange-400">
            <Flame className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-white">{exerciseName}</span>
              <span className="text-[10px] font-extrabold px-2 py-0.2 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                PRO 3D KINEMATICS
              </span>
            </div>
            <p className="text-[11px] text-gray-400">
              Músculo Activo:{' '}
              <strong className="text-orange-400">{getMuscleSpanishName(bio.primaryMuscleIds[0])}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-[#111827] p-1 rounded-xl border border-gray-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('3d_studio')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 ${
              activeTab === '3d_studio'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>3D Studio</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('anatomy_hologram')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 ${
              activeTab === 'anatomy_hologram'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Mapa Muscular</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('coaching_tips')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 ${
              activeTab === 'coaching_tips'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Técnica &amp; Tips</span>
          </button>
        </div>
      </div>

      {activeTab === '3d_studio' && (
        <div className="space-y-3">
          <div className="bg-[#05070D] border border-gray-800 rounded-2xl p-3 sm:p-4 relative overflow-hidden flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-2 z-10">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/40 flex items-center gap-1 font-bold">
                  <Flame className="w-3 h-3" />
                  MÚSCULO EN TENSIÓN: {getMuscleSpanishName(bio.primaryMuscleIds[0])}
                </span>
                <span className="text-[10px] font-mono text-gray-400 hidden sm:inline">
                  Tempo: {bio.tempoLabel.split('(')[0]}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-700 text-gray-200 hover:text-white text-[11px] font-bold flex items-center gap-1"
                >
                  {isPlaying ? (
                    <Pause className="w-3 h-3 text-amber-400" />
                  ) : (
                    <Play className="w-3 h-3 text-emerald-400" />
                  )}
                  <span>{isPlaying ? 'Pausar' : 'Reanudar'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('anatomy_hologram')}
                  className="p-1 rounded-lg bg-gray-900 border border-gray-700 text-gray-400 hover:text-white"
                  title="Ver mapa anatómico completo"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="w-full h-64 sm:h-72 relative flex items-center justify-center">
              <StudioExerciseCanvasSvg animationType={bio.animationType} phaseIdx={phaseIdx} />
            </div>

            <div className="w-full grid grid-cols-1 sm:grid-cols-12 gap-2 mt-2 pt-2 border-t border-gray-800/80 z-10">
              <div className={`sm:col-span-8 px-3 py-2 rounded-xl border text-left transition-all duration-300 ${phaseInfo.color}`}>
                <div className="flex items-center justify-between text-xs font-black">
                  <span>{phaseInfo.title}</span>
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-black/40 border border-white/10">
                    {phaseInfo.badge}
                  </span>
                </div>
                <div className="text-[11px] opacity-90 mt-0.5">{phaseInfo.desc}</div>
              </div>
              <div className="sm:col-span-4 bg-[#090D16] border border-gray-800 rounded-xl p-2.5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[10px] text-gray-400 uppercase font-bold">
                  <span>Tensión Mecánica</span>
                  <span className="font-mono text-orange-400 font-bold">{phaseInfo.tension}</span>
                </div>
                <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mt-1.5">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-500 rounded-full"
                    style={{ width: phaseIdx === 2 ? '100%' : phaseIdx === 1 ? '95%' : '75%' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'anatomy_hologram' && (
        <MuscleHologram
          primaryMuscleIds={bio.primaryMuscleIds}
          secondaryMuscleIds={bio.secondaryMuscleIds}
          exerciseName={exerciseName}
          initialView="dual"
        />
      )}

      {activeTab === 'coaching_tips' && (
        <div className="space-y-4">
          <div className="bg-[#0B0F19] border border-gray-800 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {bio.primaryMuscles.map((m) => (
                <span
                  key={m}
                  className="text-xs font-extrabold px-3 py-1 rounded-xl bg-orange-500/15 border border-orange-500/40 text-orange-400 flex items-center gap-1.5"
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Motor Principal: {m}</span>
                </span>
              ))}
              {bio.secondaryMuscles.map((m) => (
                <span
                  key={m}
                  className="text-xs font-semibold px-3 py-1 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-300"
                >
                  + Sinergista: {m}
                </span>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-[#111827] border border-sky-500/30 flex items-start gap-2.5">
              <Wind className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <div className="text-xs text-gray-300">
                <span className="font-extrabold text-sky-400">Patrón de Respiración: </span>
                {bio.breathingTip}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs text-purple-200">
              <span className="font-extrabold text-purple-300">💡 Biomecánica APEX: </span>
              {bio.proBiomechanicNote}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-[#0B0F19] border border-emerald-500/30 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-black text-emerald-400 uppercase tracking-wider">
                <CircleCheck className="w-4 h-4" />
                <span>Técnica Correcta Paso a Paso</span>
              </div>
              <ul className="space-y-2">
                {bio.correctFormTips.map((tip, idx) => (
                  <li key={idx} className="text-xs text-gray-300 flex items-start gap-2 leading-relaxed">
                    <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-[#0B0F19] border border-amber-500/30 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-black text-amber-400 uppercase tracking-wider">
                <TriangleAlert className="w-4 h-4" />
                <span>Errores Comunes a Evitar</span>
              </div>
              <ul className="space-y-2">
                {bio.commonMistakes.map((err, idx) => (
                  <li key={idx} className="text-xs text-gray-300 flex items-start gap-2 leading-relaxed">
                    <span className="text-amber-400 font-bold shrink-0">✕</span>
                    <span>{err}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
