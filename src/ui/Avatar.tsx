// Мультяшные аватары игроков (12 вариантов) и миниатюры фишек
import { useMemo } from 'react';
import { tokenThumbnail } from '../three/tokens';

const SKIN = ['#ffd7b5', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffe0bd'];
const HAIR = ['#2b1d0e', '#f4c542', '#c0392b', '#6d4c41', '#8e44ad', '#16a085', '#ecf0f1', '#e67e22'];

interface Look {
  skin: string;
  hair: string;
  style: number;
  acc: number; // 0 — нет, 1 — очки, 2 — шляпа, 3 — корона, 4 — наушники
  bot?: boolean;
}

const LOOKS: Record<string, Look> = {
  a1: { skin: SKIN[0], hair: HAIR[0], style: 0, acc: 0 },
  a2: { skin: SKIN[1], hair: HAIR[1], style: 1, acc: 1 },
  a3: { skin: SKIN[3], hair: HAIR[0], style: 2, acc: 2 },
  a4: { skin: SKIN[5], hair: HAIR[2], style: 3, acc: 0 },
  a5: { skin: SKIN[4], hair: HAIR[0], style: 0, acc: 4 },
  a6: { skin: SKIN[2], hair: HAIR[4], style: 1, acc: 0 },
  a7: { skin: SKIN[0], hair: HAIR[3], style: 2, acc: 1 },
  a8: { skin: SKIN[1], hair: HAIR[5], style: 3, acc: 3 },
  a9: { skin: SKIN[3], hair: HAIR[6], style: 0, acc: 1 },
  a10: { skin: SKIN[5], hair: HAIR[7], style: 1, acc: 2 },
  a11: { skin: SKIN[2], hair: HAIR[2], style: 2, acc: 4 },
  a12: { skin: SKIN[4], hair: HAIR[1], style: 3, acc: 3 },
};

const O = '#2a1659';

function Face({ look }: { look: Look }) {
  const { skin, hair, style, acc } = look;
  return (
    <svg viewBox="0 0 100 100">
      {/* волосы сзади */}
      {style === 3 && <path d="M18 50 Q14 90 30 96 H70 Q86 90 82 50 Z" fill={hair} stroke={O} strokeWidth="3" />}
      {style === 1 && <ellipse cx="50" cy="44" rx="34" ry="30" fill={hair} stroke={O} strokeWidth="3" />}
      {/* плечи */}
      <path d="M14 100 Q16 78 50 76 Q84 78 86 100 Z" fill="rgba(255,255,255,0.85)" stroke={O} strokeWidth="3" />
      {/* голова */}
      <ellipse cx="50" cy="52" rx="25" ry="27" fill={skin} stroke={O} strokeWidth="3" />
      <ellipse cx="25" cy="54" rx="4" ry="6" fill={skin} stroke={O} strokeWidth="2.5" />
      <ellipse cx="75" cy="54" rx="4" ry="6" fill={skin} stroke={O} strokeWidth="2.5" />
      {/* глаза */}
      <ellipse cx="41" cy="52" rx="4" ry="5" fill={O} />
      <ellipse cx="59" cy="52" rx="4" ry="5" fill={O} />
      <circle cx="42.5" cy="50" r="1.5" fill="#fff" />
      <circle cx="60.5" cy="50" r="1.5" fill="#fff" />
      {/* щёки и улыбка */}
      <ellipse cx="34" cy="62" rx="5" ry="3" fill="#ff8a80" opacity="0.55" />
      <ellipse cx="66" cy="62" rx="5" ry="3" fill="#ff8a80" opacity="0.55" />
      <path d="M41 64 Q50 72 59 64" fill="#fff" stroke={O} strokeWidth="3" strokeLinecap="round" />
      {/* причёски спереди */}
      {style === 0 && <path d="M25 46 Q26 22 50 22 Q74 22 75 46 Q64 32 50 36 Q36 32 25 46 Z" fill={hair} stroke={O} strokeWidth="3" />}
      {style === 1 && <path d="M24 48 Q28 24 50 24 Q72 24 76 48 Q70 36 56 34 Q60 40 52 42 Q42 34 24 48 Z" fill={hair} stroke={O} strokeWidth="3" />}
      {style === 2 && (
        <>
          <path d="M26 40 Q30 18 50 20 Q70 18 74 40 L68 34 L62 40 L56 32 L50 40 L44 32 L38 40 L32 34 Z" fill={hair} stroke={O} strokeWidth="3" strokeLinejoin="round" />
        </>
      )}
      {style === 3 && <path d="M24 50 Q24 22 50 22 Q76 22 76 50 Q72 34 50 32 Q28 34 24 50 Z" fill={hair} stroke={O} strokeWidth="3" />}
      {/* аксессуары */}
      {acc === 1 && (
        <g fill="rgba(180,230,255,0.45)" stroke={O} strokeWidth="3">
          <circle cx="41" cy="52" r="8" />
          <circle cx="59" cy="52" r="8" />
          <path d="M49 52 H51" />
        </g>
      )}
      {acc === 2 && (
        <g stroke={O} strokeWidth="3">
          <ellipse cx="50" cy="30" rx="34" ry="6" fill="#3949ab" />
          <path d="M32 30 Q32 10 50 10 Q68 10 68 30 Z" fill="#3949ab" />
          <path d="M33 26 H67" stroke="#ffd23f" strokeWidth="4" />
        </g>
      )}
      {acc === 3 && <path d="M30 28 L36 12 L44 22 L50 8 L56 22 L64 12 L70 28 Z" fill="#ffc928" stroke={O} strokeWidth="3" strokeLinejoin="round" />}
      {acc === 4 && (
        <g stroke={O} strokeWidth="3">
          <path d="M24 50 Q24 18 50 18 Q76 18 76 50" fill="none" stroke={O} strokeWidth="7" />
          <path d="M24 50 Q24 18 50 18 Q76 18 76 50" fill="none" stroke="#ff4d6d" strokeWidth="3" />
          <rect x="16" y="44" width="12" height="18" rx="5" fill="#ff4d6d" />
          <rect x="72" y="44" width="12" height="18" rx="5" fill="#ff4d6d" />
        </g>
      )}
    </svg>
  );
}

function BotFace() {
  return (
    <svg viewBox="0 0 100 100">
      <path d="M14 100 Q16 78 50 76 Q84 78 86 100 Z" fill="rgba(255,255,255,0.85)" stroke={O} strokeWidth="3" />
      <line x1="50" y1="12" x2="50" y2="24" stroke={O} strokeWidth="4" />
      <circle cx="50" cy="12" r="5" fill="#ff4757" stroke={O} strokeWidth="3" />
      <rect x="22" y="24" width="56" height="48" rx="14" fill="#cfd8dc" stroke={O} strokeWidth="3" />
      <rect x="30" y="34" width="40" height="20" rx="8" fill="#1c2b5a" stroke={O} strokeWidth="3" />
      <circle cx="41" cy="44" r="4.5" fill="#6dff8e" />
      <circle cx="59" cy="44" r="4.5" fill="#6dff8e" />
      <rect x="38" y="60" width="24" height="5" rx="2.5" fill="#90a4ae" />
      <rect x="14" y="38" width="8" height="18" rx="4" fill="#90a4ae" stroke={O} strokeWidth="3" />
      <rect x="78" y="38" width="8" height="18" rx="4" fill="#90a4ae" stroke={O} strokeWidth="3" />
    </svg>
  );
}

export function Avatar({ id, color, size = 2.6, bot = false }: { id: string; color: string; size?: number; bot?: boolean }) {
  const look = LOOKS[id] ?? LOOKS.a1;
  return (
    <div className="avatar" style={{ width: `${size}rem`, height: `${size}rem`, ['--c' as any]: color }}>
      {bot ? <BotFace /> : <Face look={look} />}
    </div>
  );
}

export function TokenImg({ token, color, size = 2.4 }: { token: string; color: string; size?: number }) {
  const url = useMemo(() => tokenThumbnail(token, color), [token, color]);
  if (!url) return <div style={{ width: `${size}rem`, height: `${size}rem`, borderRadius: '50%', background: color }} />;
  return <img className="token-img" src={url} alt="" style={{ width: `${size}rem`, height: `${size}rem` }} draggable={false} />;
}
