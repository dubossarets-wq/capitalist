// Набор мультяшных игровых иконок (SVG, 64×64)
import type { ReactNode } from 'react';

const O = '#2a1659'; // контур
const sw = 3.5;
const st = { stroke: O, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const hl = { fill: 'rgba(255,255,255,0.55)' };

const ICONS: Record<string, ReactNode> = {
  dice: (
    <>
      <rect x="6" y="18" width="30" height="30" rx="7" fill="#fff" {...st} transform="rotate(-12 21 33)" />
      <circle cx="14" cy="28" r="3" fill="#e53935" transform="rotate(-12 21 33)" />
      <circle cx="21" cy="34" r="3" fill={O} transform="rotate(-12 21 33)" />
      <circle cx="28" cy="40" r="3" fill={O} transform="rotate(-12 21 33)" />
      <rect x="28" y="10" width="28" height="28" rx="7" fill="#ffe259" {...st} transform="rotate(14 42 24)" />
      <circle cx="36" cy="18" r="3" fill={O} transform="rotate(14 42 24)" />
      <circle cx="48" cy="18" r="3" fill={O} transform="rotate(14 42 24)" />
      <circle cx="36" cy="30" r="3" fill={O} transform="rotate(14 42 24)" />
      <circle cx="48" cy="30" r="3" fill={O} transform="rotate(14 42 24)" />
    </>
  ),
  robot: (
    <>
      <line x1="32" y1="6" x2="32" y2="14" {...st} />
      <circle cx="32" cy="6" r="4" fill="#ff4757" {...st} />
      <rect x="12" y="14" width="40" height="30" rx="10" fill="#7fd6ff" {...st} />
      <rect x="18" y="20" width="28" height="14" rx="6" fill="#1c2b5a" {...st} />
      <circle cx="26" cy="27" r="3.5" fill="#6dff8e" />
      <circle cx="38" cy="27" r="3.5" fill="#6dff8e" />
      <rect x="18" y="46" width="28" height="12" rx="5" fill="#a29bfe" {...st} />
      <rect x="6" y="24" width="6" height="12" rx="3" fill="#a29bfe" {...st} />
      <rect x="52" y="24" width="6" height="12" rx="3" fill="#a29bfe" {...st} />
      <rect x="16" y="16" width="14" height="4" rx="2" {...hl} />
    </>
  ),
  wifi: (
    <>
      <path d="M8 26 Q32 4 56 26" fill="none" stroke={O} strokeWidth="11" strokeLinecap="round" />
      <path d="M8 26 Q32 4 56 26" fill="none" stroke="#4fc3f7" strokeWidth="6" strokeLinecap="round" />
      <path d="M17 35 Q32 21 47 35" fill="none" stroke={O} strokeWidth="11" strokeLinecap="round" />
      <path d="M17 35 Q32 21 47 35" fill="none" stroke="#4fc3f7" strokeWidth="6" strokeLinecap="round" />
      <path d="M25 44 Q32 37 39 44" fill="none" stroke={O} strokeWidth="11" strokeLinecap="round" />
      <path d="M25 44 Q32 37 39 44" fill="none" stroke="#4fc3f7" strokeWidth="6" strokeLinecap="round" />
      <circle cx="32" cy="53" r="6" fill="#ffe259" {...st} />
    </>
  ),
  join: (
    <>
      <rect x="10" y="8" width="30" height="48" rx="5" fill="#ffb74d" {...st} />
      <rect x="15" y="13" width="20" height="38" rx="3" fill="#8d5524" {...st} />
      <circle cx="30" cy="33" r="2.5" fill="#ffe259" />
      <path d="M38 32 H58 M50 24 L58 32 L50 40" fill="none" stroke={O} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M38 32 H58 M50 24 L58 32 L50 40" fill="none" stroke="#6dff8e" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  gear: (
    <>
      <path
        d="M27 4h10l2 7 6 3 7-3 7 7-3 7 3 6 7 2v10l-7 2-3 6 3 7-7 7-7-3-6 3-2 7H27l-2-7-6-3-7 3-7-7 3-7-3-6-7-2V27l7-2 3-6-3-7 7-7 7 3 6-3z"
        fill="#b0bec5"
        {...st}
        transform="translate(4 4) scale(0.875)"
      />
      <circle cx="32" cy="32" r="9" fill="#ffe259" {...st} />
    </>
  ),
  book: (
    <>
      <path d="M8 12 Q20 8 32 14 Q44 8 56 12 V54 Q44 50 32 56 Q20 50 8 54 Z" fill="#ff7a59" {...st} />
      <path d="M12 14 Q22 11 30 16 V51 Q22 47 12 50 Z" fill="#fff" {...st} />
      <path d="M52 14 Q42 11 34 16 V51 Q42 47 52 50 Z" fill="#fff" {...st} />
      <path d="M16 22 H26 M16 29 H26 M38 22 H48 M38 29 H48" stroke="#b0bec5" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  play: (
    <>
      <path d="M18 10 L52 32 L18 54 Z" fill="#6dff8e" {...st} />
      <path d="M22 18 L36 27 L22 30 Z" {...hl} />
    </>
  ),
  back: (
    <>
      <path d="M40 10 L18 32 L40 54" fill="none" stroke={O} strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M40 10 L18 32 L40 54" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  close: (
    <>
      <path d="M16 16 L48 48 M48 16 L16 48" stroke={O} strokeWidth="14" strokeLinecap="round" />
      <path d="M16 16 L48 48 M48 16 L16 48" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
    </>
  ),
  check: (
    <>
      <circle cx="32" cy="32" r="26" fill="#2ed573" {...st} />
      <path d="M19 33 L28 42 L46 22" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  plus: (
    <>
      <path d="M32 12 V52 M12 32 H52" stroke={O} strokeWidth="15" strokeLinecap="round" />
      <path d="M32 12 V52 M12 32 H52" stroke="#fff" strokeWidth="8" strokeLinecap="round" />
    </>
  ),
  minus: (
    <>
      <path d="M12 32 H52" stroke={O} strokeWidth="15" strokeLinecap="round" />
      <path d="M12 32 H52" stroke="#fff" strokeWidth="8" strokeLinecap="round" />
    </>
  ),
  house: (
    <>
      <path d="M8 30 L32 8 L56 30 Z" fill="#1e8e3e" {...st} />
      <rect x="14" y="28" width="36" height="26" rx="3" fill="#34c759" {...st} />
      <rect x="27" y="38" width="10" height="16" rx="2" fill="#8d5524" {...st} />
      <rect x="40" y="10" width="7" height="12" fill="#c62828" {...st} />
      <path d="M18 31 H30" stroke="rgba(255,255,255,.6)" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  hotel: (
    <>
      <path d="M6 22 L32 6 L58 22 Z" fill="#b3170f" {...st} />
      <rect x="10" y="20" width="44" height="36" rx="3" fill="#ff3b30" {...st} />
      {[16, 28, 40].map((x) => (
        <g key={x}>
          <rect x={x} y="26" width="8" height="7" rx="1.5" fill="#fff59d" />
          <rect x={x} y="37" width="8" height="7" rx="1.5" fill="#fff59d" />
        </g>
      ))}
      <rect x="27" y="47" width="10" height="9" fill="#8d5524" {...st} />
    </>
  ),
  coin: (
    <>
      <circle cx="32" cy="32" r="25" fill="#ffc928" {...st} />
      <circle cx="32" cy="32" r="18" fill="#ffe082" stroke="#e0a000" strokeWidth="3" />
      <text x="32" y="42" textAnchor="middle" fontSize="28" fontFamily="Russo One, sans-serif" fill="#b07800">$</text>
      <path d="M18 22 Q24 14 34 13" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" opacity="0.8" />
    </>
  ),
  cash: (
    <>
      <rect x="6" y="20" width="44" height="26" rx="4" fill="#81c784" {...st} transform="rotate(-8 28 33)" />
      <rect x="14" y="18" width="44" height="26" rx="4" fill="#43a047" {...st} />
      <circle cx="36" cy="31" r="7" fill="#c8e6c9" stroke={O} strokeWidth="2.5" />
      <text x="36" y="35.5" textAnchor="middle" fontSize="12" fontFamily="Russo One, sans-serif" fill="#1b5e20">$</text>
      <rect x="18" y="36" width="10" height="4" rx="2" fill="#c8e6c9" />
    </>
  ),
  handshake: (
    <>
      <path d="M4 26 L16 20 L28 26 L22 40 L10 42 Z" fill="#ffb74d" {...st} />
      <path d="M60 26 L48 20 L34 24 L24 32 Q22 38 28 38 L38 32 L46 42 L54 40 Z" fill="#ffd180" {...st} />
      <path d="M26 44 L32 50 Q36 52 38 48 L44 42" fill="#ffb74d" {...st} />
      <rect x="2" y="20" width="10" height="24" rx="3" fill="#5c6bc0" {...st} transform="rotate(-20 7 32)" />
      <rect x="52" y="20" width="10" height="24" rx="3" fill="#ec407a" {...st} transform="rotate(20 57 32)" />
    </>
  ),
  gavel: (
    <>
      <rect x="10" y="48" width="30" height="8" rx="3" fill="#8d5524" {...st} />
      <rect x="20" y="10" width="30" height="16" rx="5" fill="#a0612b" {...st} transform="rotate(35 35 18)" />
      <rect x="30" y="22" width="7" height="30" rx="3" fill="#ffcc80" {...st} transform="rotate(-55 33 37)" />
      <rect x="22" y="12" width="12" height="3" rx="1.5" {...hl} transform="rotate(35 35 18)" />
    </>
  ),
  lock: (
    <>
      <path d="M20 28 V20 Q20 8 32 8 Q44 8 44 20 V28" fill="none" stroke={O} strokeWidth="10" />
      <path d="M20 28 V20 Q20 8 32 8 Q44 8 44 20 V28" fill="none" stroke="#b0bec5" strokeWidth="5" />
      <rect x="12" y="28" width="40" height="28" rx="6" fill="#ffc928" {...st} />
      <circle cx="32" cy="40" r="4.5" fill={O} />
      <rect x="30" y="41" width="4" height="9" rx="2" fill={O} />
    </>
  ),
  unlock: (
    <>
      <path d="M20 28 V18 Q20 6 32 6 Q42 6 44 14" fill="none" stroke={O} strokeWidth="10" strokeLinecap="round" />
      <path d="M20 28 V18 Q20 6 32 6 Q42 6 44 14" fill="none" stroke="#b0bec5" strokeWidth="5" strokeLinecap="round" />
      <rect x="12" y="28" width="40" height="28" rx="6" fill="#6dff8e" {...st} />
      <circle cx="32" cy="40" r="4.5" fill={O} />
      <rect x="30" y="41" width="4" height="9" rx="2" fill={O} />
    </>
  ),
  cart: (
    <>
      <path d="M4 10 H14 L20 40 H50 L56 18 H17" fill="#ffe259" {...st} />
      <circle cx="24" cy="50" r="5" fill="#5c6bc0" {...st} />
      <circle cx="46" cy="50" r="5" fill="#5c6bc0" {...st} />
      <path d="M22 24 H50 M24 32 H48" stroke="#e0a000" strokeWidth="3" />
    </>
  ),
  hammer: (
    <>
      <rect x="27" y="20" width="9" height="40" rx="4" fill="#a0612b" {...st} transform="rotate(30 32 40)" />
      <path d="M14 10 L42 10 Q48 10 50 16 L52 22 L14 22 Z" fill="#90a4ae" {...st} transform="rotate(30 32 16)" />
      <rect x="18" y="12" width="20" height="3" rx="1.5" {...hl} transform="rotate(30 32 16)" />
    </>
  ),
  sell: (
    <>
      <path d="M8 30 L30 8 H54 V32 L32 54 Z" fill="#ff7a59" {...st} />
      <circle cx="44" cy="18" r="5" fill="#fff" {...st} />
      <text x="28" y="40" textAnchor="middle" fontSize="20" fontFamily="Russo One, sans-serif" fill="#fff" transform="rotate(-45 28 34)">$</text>
    </>
  ),
  briefcase: (
    <>
      <rect x="22" y="8" width="20" height="12" rx="4" fill="none" stroke={O} strokeWidth="8" />
      <rect x="22" y="8" width="20" height="12" rx="4" fill="none" stroke="#8d5524" strokeWidth="3.5" />
      <rect x="6" y="18" width="52" height="38" rx="7" fill="#a0612b" {...st} />
      <rect x="6" y="30" width="52" height="6" fill="#7b4a1e" />
      <rect x="27" y="28" width="10" height="10" rx="2" fill="#ffc928" {...st} />
      <rect x="10" y="21" width="20" height="4" rx="2" {...hl} />
    </>
  ),
  flag: (
    <>
      <rect x="10" y="6" width="6" height="54" rx="3" fill="#b0bec5" {...st} />
      <path d="M16 8 Q28 4 36 10 Q46 16 56 10 V34 Q46 40 36 34 Q28 28 16 32 Z" fill="#ff4757" {...st} />
      <path d="M20 12 Q28 9 34 13" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
    </>
  ),
  crown: (
    <>
      <path d="M6 22 L18 34 L32 12 L46 34 L58 22 L52 50 H12 Z" fill="#ffc928" {...st} />
      <rect x="12" y="46" width="40" height="8" rx="3" fill="#ffa000" {...st} />
      <circle cx="32" cy="36" r="4" fill="#e53935" />
      <circle cx="20" cy="40" r="3" fill="#1e88e5" />
      <circle cx="44" cy="40" r="3" fill="#43a047" />
    </>
  ),
  trophy: (
    <>
      <path d="M16 8 H48 V24 Q48 40 32 40 Q16 40 16 24 Z" fill="#ffc928" {...st} />
      <path d="M16 14 H8 Q8 28 18 30 M48 14 H56 Q56 28 46 30" fill="none" stroke={O} strokeWidth="5" strokeLinecap="round" />
      <rect x="28" y="40" width="8" height="8" fill="#ffa000" {...st} />
      <rect x="18" y="48" width="28" height="9" rx="3" fill="#8d5524" {...st} />
      <path d="M22 13 V24" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.7" />
    </>
  ),
  user: (
    <>
      <circle cx="32" cy="22" r="13" fill="#ffcc80" {...st} />
      <path d="M8 58 Q8 38 32 38 Q56 38 56 58 Z" fill="#5c6bc0" {...st} />
    </>
  ),
  users: (
    <>
      <circle cx="22" cy="22" r="10" fill="#ffcc80" {...st} />
      <path d="M4 54 Q4 36 22 36 Q40 36 40 54 Z" fill="#ec407a" {...st} />
      <circle cx="44" cy="20" r="10" fill="#ffe0b2" {...st} />
      <path d="M30 52 Q30 34 44 34 Q60 34 60 52 Z" fill="#5c6bc0" {...st} />
    </>
  ),
  music: (
    <>
      <path d="M24 46 V14 L52 8 V40" fill="none" stroke={O} strokeWidth="9" strokeLinejoin="round" />
      <path d="M24 46 V14 L52 8 V40" fill="none" stroke="#ec407a" strokeWidth="4" strokeLinejoin="round" />
      <ellipse cx="18" cy="48" rx="9" ry="7" fill="#ec407a" {...st} />
      <ellipse cx="46" cy="42" rx="9" ry="7" fill="#ec407a" {...st} />
    </>
  ),
  sound: (
    <>
      <path d="M8 24 H20 L34 10 V54 L20 40 H8 Z" fill="#4fc3f7" {...st} />
      <path d="M42 22 Q48 32 42 42 M48 14 Q60 32 48 50" fill="none" stroke={O} strokeWidth="5" strokeLinecap="round" />
    </>
  ),
  star: <path d="M32 4 L40 23 L60 24 L44 37 L50 57 L32 46 L14 57 L20 37 L4 24 L24 23 Z" fill="#ffd23f" {...st} />,
  key: (
    <>
      <circle cx="20" cy="22" r="13" fill="#ffc928" {...st} />
      <circle cx="20" cy="22" r="5" fill="#7b4a1e" />
      <path d="M28 30 L54 56 M44 46 L50 40 M50 52 L56 46" stroke={O} strokeWidth="9" strokeLinecap="round" />
      <path d="M28 30 L54 56 M44 46 L50 40 M50 52 L56 46" stroke="#ffc928" strokeWidth="4" strokeLinecap="round" />
    </>
  ),
  jail: (
    <>
      <rect x="6" y="8" width="52" height="48" rx="6" fill="#ff9800" {...st} />
      {[16, 26, 36, 46].map((x) => (
        <rect key={x} x={x - 2.5} y="8" width="5" height="48" fill="#455a64" />
      ))}
      <rect x="6" y="8" width="52" height="7" fill="#37474f" />
      <rect x="6" y="49" width="52" height="7" fill="#37474f" />
      <rect x="6" y="8" width="52" height="48" rx="6" fill="none" {...st} />
    </>
  ),
  refresh: (
    <>
      <path d="M50 22 A20 20 0 1 0 52 36" fill="none" stroke={O} strokeWidth="11" strokeLinecap="round" />
      <path d="M50 22 A20 20 0 1 0 52 36" fill="none" stroke="#6dff8e" strokeWidth="5.5" strokeLinecap="round" />
      <path d="M40 18 L54 14 L54 28 Z" fill="#6dff8e" {...st} />
    </>
  ),
  qr: (
    <>
      <rect x="6" y="6" width="52" height="52" rx="6" fill="#fff" {...st} />
      <rect x="13" y="13" width="14" height="14" rx="2" fill={O} />
      <rect x="37" y="13" width="14" height="14" rx="2" fill={O} />
      <rect x="13" y="37" width="14" height="14" rx="2" fill={O} />
      <rect x="37" y="37" width="6" height="6" fill={O} />
      <rect x="45" y="45" width="6" height="6" fill={O} />
      <rect x="45" y="37" width="6" height="4" fill="#6c47ff" />
    </>
  ),
  copy: (
    <>
      <rect x="20" y="6" width="34" height="40" rx="6" fill="#b39ddb" {...st} />
      <rect x="10" y="18" width="34" height="40" rx="6" fill="#fff" {...st} />
      <path d="M18 30 H36 M18 38 H36 M18 46 H30" stroke="#9575cd" strokeWidth="3.5" strokeLinecap="round" />
    </>
  ),
  chart: (
    <>
      <rect x="8" y="34" width="12" height="22" rx="3" fill="#4fc3f7" {...st} />
      <rect x="26" y="20" width="12" height="36" rx="3" fill="#6dff8e" {...st} />
      <rect x="44" y="8" width="12" height="48" rx="3" fill="#ffd23f" {...st} />
    </>
  ),
  clock: (
    <>
      <circle cx="32" cy="34" r="24" fill="#fff" {...st} />
      <path d="M32 20 V34 L42 40" fill="none" stroke={O} strokeWidth="5" strokeLinecap="round" />
      <rect x="27" y="4" width="10" height="6" rx="2" fill="#ff4757" {...st} />
    </>
  ),
  edit: (
    <>
      <path d="M12 52 L16 38 L44 10 L54 20 L26 48 Z" fill="#ffd23f" {...st} />
      <path d="M38 16 L48 26" stroke={O} strokeWidth="3.5" />
      <path d="M12 52 L16 38 L26 48 Z" fill="#ffcc80" {...st} />
      <path d="M44 10 L54 20 L58 16 Q60 12 56 8 Q52 4 48 6 Z" fill="#ff7a9a" {...st} />
    </>
  ),
  save: (
    <>
      <path d="M8 12 Q8 8 12 8 H46 L56 18 V52 Q56 56 52 56 H12 Q8 56 8 52 Z" fill="#5c6bc0" {...st} />
      <rect x="18" y="8" width="24" height="14" fill="#fff" {...st} />
      <rect x="16" y="34" width="32" height="22" fill="#e8eaf6" {...st} />
    </>
  ),
  download: (
    <>
      <path d="M32 6 V38 M20 26 L32 38 L44 26" fill="none" stroke={O} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M32 6 V38 M20 26 L32 38 L44 26" fill="none" stroke="#6dff8e" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="8" y="46" width="48" height="10" rx="4" fill="#4fc3f7" {...st} />
    </>
  ),
  upload: (
    <>
      <path d="M32 38 V6 M20 18 L32 6 L44 18" fill="none" stroke={O} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M32 38 V6 M20 18 L32 6 L44 18" fill="none" stroke="#ffd23f" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="8" y="46" width="48" height="10" rx="4" fill="#4fc3f7" {...st} />
    </>
  ),
  exit: (
    <>
      <rect x="8" y="6" width="30" height="52" rx="5" fill="#a0612b" {...st} />
      <circle cx="31" cy="34" r="2.5" fill="#ffd23f" />
      <path d="M36 32 H58 M50 24 L58 32 L50 40" fill="none" stroke={O} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M36 32 H58 M50 24 L58 32 L50 40" fill="none" stroke="#ff8a8a" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  eye: (
    <>
      <path d="M4 32 Q32 6 60 32 Q32 58 4 32 Z" fill="#fff" {...st} />
      <circle cx="32" cy="32" r="12" fill="#4fc3f7" {...st} />
      <circle cx="32" cy="32" r="5" fill={O} />
      <circle cx="28" cy="28" r="2.5" fill="#fff" />
    </>
  ),
  info: (
    <>
      <circle cx="32" cy="32" r="26" fill="#4fc3f7" {...st} />
      <circle cx="32" cy="19" r="4.5" fill="#fff" />
      <rect x="28" y="27" width="8" height="22" rx="4" fill="#fff" />
    </>
  ),
  map: (
    <>
      <path d="M6 14 L22 8 L42 14 L58 8 V50 L42 56 L22 50 L6 56 Z" fill="#aed581" {...st} />
      <path d="M22 8 V50 M42 14 V56" stroke={O} strokeWidth="3" />
      <path d="M10 40 Q20 30 30 36 T52 26" fill="none" stroke="#ff7043" strokeWidth="3.5" strokeDasharray="4 4" />
      <circle cx="50" cy="24" r="4" fill="#e53935" {...st} />
    </>
  ),
  palette: (
    <>
      <path d="M32 6 Q58 6 58 30 Q58 42 46 42 H40 Q34 42 36 48 Q38 56 30 58 Q6 56 6 32 Q6 6 32 6 Z" fill="#ffe0b2" {...st} />
      <circle cx="20" cy="26" r="5" fill="#e53935" />
      <circle cx="32" cy="18" r="5" fill="#fdd835" />
      <circle cx="44" cy="24" r="5" fill="#43a047" />
      <circle cx="18" cy="40" r="5" fill="#1e88e5" />
    </>
  ),
  fullscreen: (
    <>
      <path d="M8 22 V8 H22 M42 8 H56 V22 M56 42 V56 H42 M22 56 H8 V42" fill="none" stroke={O} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 22 V8 H22 M42 8 H56 V22 M56 42 V56 H42 M22 56 H8 V42" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  bank: (
    <>
      <path d="M4 22 L32 6 L60 22 Z" fill="#ffd23f" {...st} />
      {[12, 24, 36, 48].map((x) => (
        <rect key={x} x={x - 3} y="24" width="8" height="24" fill="#eceff1" {...st} />
      ))}
      <rect x="4" y="48" width="56" height="9" rx="2" fill="#b0bec5" {...st} />
    </>
  ),
  fire: (
    <>
      <path d="M32 4 Q44 18 46 28 Q52 22 50 14 Q60 26 58 40 Q56 58 32 60 Q8 58 6 40 Q6 26 18 18 Q18 28 24 30 Q22 14 32 4 Z" fill="#ff7043" {...st} />
      <path d="M32 30 Q42 40 40 48 Q38 56 32 56 Q24 56 24 48 Q24 40 32 30 Z" fill="#ffd23f" />
    </>
  ),
  bolt: <path d="M36 4 L12 36 H28 L22 60 L52 24 H36 Z" fill="#ffd23f" {...st} />,
  heart: <path d="M32 56 Q6 40 6 22 Q6 8 20 8 Q28 8 32 16 Q36 8 44 8 Q58 8 58 22 Q58 40 32 56 Z" fill="#ff4d6d" {...st} />,
  pause: (
    <>
      <rect x="14" y="10" width="13" height="44" rx="4" fill="#fff" {...st} />
      <rect x="37" y="10" width="13" height="44" rx="4" fill="#fff" {...st} />
    </>
  ),
  menu: (
    <>
      <rect x="8" y="10" width="48" height="10" rx="5" fill="#fff" {...st} />
      <rect x="8" y="27" width="48" height="10" rx="5" fill="#fff" {...st} />
      <rect x="8" y="44" width="48" height="10" rx="5" fill="#fff" {...st} />
    </>
  ),
  scroll: (
    <>
      <rect x="12" y="10" width="40" height="44" rx="4" fill="#fff3d6" {...st} />
      <path d="M20 22 H44 M20 30 H44 M20 38 H36" stroke="#a1887f" strokeWidth="3.5" strokeLinecap="round" />
      <rect x="6" y="6" width="52" height="10" rx="5" fill="#d7a86e" {...st} />
      <rect x="6" y="48" width="52" height="10" rx="5" fill="#d7a86e" {...st} />
    </>
  ),
  wheel: (
    <>
      <circle cx="32" cy="34" r="25" fill="#fff" {...st} />
      {['#e53935', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#fb8c00'].map((c, i) => {
        const a1 = (i / 6) * Math.PI * 2;
        const a2 = ((i + 1) / 6) * Math.PI * 2;
        return <path key={i} d={`M32 34 L${32 + Math.cos(a1) * 22} ${34 + Math.sin(a1) * 22} A22 22 0 0 1 ${32 + Math.cos(a2) * 22} ${34 + Math.sin(a2) * 22} Z`} fill={c} />;
      })}
      <circle cx="32" cy="34" r="5" fill="#fff" {...st} />
      <path d="M26 4 H38 L32 14 Z" fill="#e53935" {...st} />
    </>
  ),
  question: (
    <>
      <circle cx="32" cy="32" r="26" fill="#ff9800" {...st} />
      <text x="32" y="45" textAnchor="middle" fontSize="36" fontFamily="Russo One, sans-serif" fill="#fff" stroke={O} strokeWidth="1.5">?</text>
    </>
  ),
  chest: (
    <>
      <path d="M8 28 Q8 10 32 10 Q56 10 56 28 Z" fill="#a0612b" {...st} />
      <rect x="8" y="28" width="48" height="26" rx="4" fill="#8d5524" {...st} />
      <rect x="8" y="26" width="48" height="6" fill="#ffc928" stroke={O} strokeWidth="2.5" />
      <rect x="27" y="28" width="10" height="12" rx="2" fill="#ffc928" {...st} />
    </>
  ),
  plane: (
    <>
      <path d="M32 4 Q37 10 36 24 L58 36 V42 L36 36 L35 50 L43 56 V60 L32 57 L21 60 V56 L29 50 L28 36 L6 42 V36 L28 24 Q27 10 32 4 Z" fill="#4fc3f7" {...st} />
    </>
  ),
  train: (
    <>
      <rect x="14" y="6" width="36" height="42" rx="9" fill="#ff5252" {...st} />
      <rect x="20" y="12" width="24" height="14" rx="3" fill="#bbdefb" {...st} />
      <circle cx="23" cy="36" r="4" fill="#ffe082" {...st} />
      <circle cx="41" cy="36" r="4" fill="#ffe082" {...st} />
      <path d="M20 48 L12 60 M44 48 L52 60 M16 55 H48" stroke={O} strokeWidth="4.5" strokeLinecap="round" />
    </>
  ),
  ship: (
    <>
      <rect x="24" y="8" width="16" height="18" fill="#fff" {...st} />
      <rect x="24" y="8" width="16" height="6" fill="#e53935" />
      <path d="M6 30 H58 L50 50 H14 Z" fill="#455a64" {...st} />
      <path d="M4 56 Q12 50 20 56 T36 56 T52 56 T64 56" fill="none" stroke="#29b6f6" strokeWidth="4.5" strokeLinecap="round" />
    </>
  ),
  drop: <path d="M32 6 Q40 22 48 32 Q56 46 46 54 Q32 62 18 54 Q8 46 16 32 Q24 22 32 6 Z" fill="#29b6f6" {...st} />,
  tax: (
    <>
      <path d="M22 16 L16 6 H48 L42 16 Z" fill="#a1887f" {...st} />
      <path d="M22 16 Q4 30 10 48 Q16 58 32 58 Q48 58 54 48 Q60 30 42 16 Z" fill="#bcaaa4" {...st} />
      <text x="32" y="48" textAnchor="middle" fontSize="24" fontFamily="Russo One, sans-serif" fill="#2e7d32">$</text>
    </>
  ),
  palm: (
    <>
      <circle cx="48" cy="14" r="8" fill="#ffeb3b" {...st} />
      <path d="M30 58 Q26 40 32 24" fill="none" stroke={O} strokeWidth="9" strokeLinecap="round" />
      <path d="M30 58 Q26 40 32 24" fill="none" stroke="#8d5524" strokeWidth="5" strokeLinecap="round" />
      <path d="M32 24 Q20 14 8 22 Q20 20 32 24 Q24 8 36 6 Q30 14 32 24 Q44 12 56 22 Q44 18 32 24" fill="#43a047" {...st} />
    </>
  ),
  police: (
    <>
      <path d="M8 34 Q10 10 32 8 Q54 10 56 34 Z" fill="#1e5bd8" {...st} />
      <ellipse cx="32" cy="38" rx="28" ry="7" fill="#1b1b22" {...st} />
      <path d="M32 14 L35 21 L42 21 L36 26 L38 33 L32 29 L26 33 L28 26 L22 21 L29 21 Z" fill="#ffd23f" />
    </>
  ),
  start: (
    <>
      <path d="M4 32 L26 12 V24 H58 V40 H26 V52 Z" fill="#ff4757" {...st} />
    </>
  ),
  timer: (
    <>
      <circle cx="32" cy="36" r="22" fill="#fff" {...st} />
      <path d="M32 36 V22" stroke="#ff4757" strokeWidth="5" strokeLinecap="round" />
      <rect x="26" y="6" width="12" height="7" rx="2" fill="#5c6bc0" {...st} />
    </>
  ),
  infinity: (
    <path d="M32 32 Q22 18 14 22 Q4 28 14 40 Q22 46 32 32 Q42 18 50 22 Q60 28 50 40 Q42 46 32 32 Z" fill="none" stroke={O} strokeWidth="6" />
  ),
  chat: (
    <>
      <path d="M8 12 Q8 6 14 6 H50 Q56 6 56 12 V38 Q56 44 50 44 H26 L14 56 V44 Q8 44 8 38 Z" fill="#fff" {...st} />
      <circle cx="22" cy="25" r="4" fill="#6c47ff" />
      <circle cx="32" cy="25" r="4" fill="#6c47ff" />
      <circle cx="42" cy="25" r="4" fill="#6c47ff" />
    </>
  ),
  camera: (
    <>
      <rect x="6" y="18" width="52" height="36" rx="7" fill="#78909c" {...st} />
      <rect x="20" y="10" width="24" height="10" rx="3" fill="#546e7a" {...st} />
      <circle cx="32" cy="36" r="11" fill="#4fc3f7" {...st} />
      <circle cx="28" cy="32" r="3" fill="#fff" />
    </>
  ),
  bomb: (
    <>
      <circle cx="28" cy="38" r="20" fill="#37474f" {...st} />
      <path d="M40 22 L46 14" stroke={O} strokeWidth="6" strokeLinecap="round" />
      <path d="M46 14 Q50 6 56 8" fill="none" stroke="#ff9800" strokeWidth="4" strokeLinecap="round" />
      <circle cx="56" cy="8" r="4" fill="#ffd23f" />
      <circle cx="20" cy="30" r="5" fill="rgba(255,255,255,.4)" />
    </>
  ),
  medal: (
    <>
      <path d="M18 4 L28 26 M46 4 L36 26" stroke={O} strokeWidth="9" strokeLinecap="round" />
      <path d="M18 4 L28 26 M46 4 L36 26" stroke="#e53935" strokeWidth="5" strokeLinecap="round" />
      <circle cx="32" cy="40" r="18" fill="#ffc928" {...st} />
      <path d="M32 30 L35 37 L42 37 L36 41 L38 48 L32 44 L26 48 L28 41 L22 37 L29 37 Z" fill="#fff59d" />
    </>
  ),
};

export type IconName = keyof typeof ICONS;

export function Icon({ name, size, className = '' }: { name: string; size?: number | string; className?: string }) {
  const content = ICONS[name] ?? ICONS.star;
  return (
    <svg className={`g-icon ${className}`} viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      {content}
    </svg>
  );
}

export const ICON_FOR_CELL: Record<string, string> = {
  plane: 'plane',
  ship: 'ship',
  train: 'train',
  bolt: 'bolt',
  drop: 'drop',
  wifi: 'wifi',
};
