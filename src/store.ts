import { create } from 'zustand';
import type { BotLevel, GameSettings, GameState, PlayerProfile, ThemeId, TradeOffer } from '../shared/types';
import type { RoomSummary, RoomView, ServerInfo } from '../shared/protocol';
import { AVATARS, PLAYER_COLORS, TOKENS, defaultSettings, sanitizeSettings } from '../shared/settings';
import type { Quality } from './three/BoardScene';

export type Screen = 'menu' | 'setup' | 'join' | 'lobby' | 'game' | 'settings' | 'rules' | 'profile' | 'records' | 'editor';

export interface Prefs {
  sfx: number;
  music: number;
  quality: Quality;
  anim: 'full' | 'fast' | 'minimal';
  cameraFollow: boolean;
  menuTheme: ThemeId;
  showLog: boolean;
  /** Вид поля в игре: объёмный или плоский сверху */
  view: '3d' | '2d';
}

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error' | 'success' | 'money';
}

export interface OfflineSeat {
  id: string;
  isBot: boolean;
  botLevel: BotLevel;
  profile: PlayerProfile;
}

export type Dialog = null | 'props' | 'trade' | 'log' | 'pause' | 'stats';
export type PropsMode = 'all' | 'build' | 'sell' | 'mortgage' | 'unmortgage';

export interface TradeDraft {
  to: string;
  giveMoney: number;
  giveCells: number[];
  getMoney: number;
  getCells: number[];
  counterOf?: string;
}

export interface NetState {
  status: 'idle' | 'connecting' | 'online' | 'reconnecting' | 'error';
  error: string | null;
  info: ServerInfo | null;
  clientId: string | null;
}

interface Store {
  screen: Screen;
  profile: PlayerProfile;
  prefs: Prefs;
  mode: 'local' | 'net' | null;
  myId: string | null;
  game: GameState | null;
  animating: boolean;
  cashView: Record<string, number>;
  card: { deck: 'chance' | 'chest'; title: string; text: string; player: string; key: number } | null;
  wheel: { sector: number; text: string; player: string; key: number } | null;
  order: { rolls: { player: string; roll: number }[] } | null;
  banner: { text: string; sub?: string; color: string; key: number } | null;
  lastDice: [number, number] | null;
  selectedCell: number | null;
  dialog: Dialog;
  propsMode: PropsMode;
  propsOwner: string | null;
  tradeDraft: TradeDraft | null;
  viewTrade: TradeOffer | null;
  room: RoomView | null;
  rooms: RoomSummary[];
  net: NetState;
  timeOffset: number;
  setupSettings: GameSettings;
  setupSeats: OfflineSeat[];
  toasts: Toast[];
  emotes: { id: number; from: string; emote: string }[];
  set: (p: Partial<Store>) => void;
  go: (s: Screen) => void;
  toast: (text: string, kind?: Toast['kind']) => void;
  setPrefs: (p: Partial<Prefs>) => void;
  setProfile: (p: Partial<PlayerProfile>) => void;
}

const LS = {
  profile: 'capitalist.profile.v1',
  prefs: 'capitalist.prefs.v1',
  settings: 'capitalist.settings.v1',
  seats: 'capitalist.seats.v1',
};

export function lsGet<T>(key: string, def: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : def;
  } catch {
    return def;
  }
}
export function lsSet(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* хранилище недоступно */
  }
}

const defaultProfile = (): PlayerProfile => ({
  name: `Игрок ${Math.floor(Math.random() * 900 + 100)}`,
  token: TOKENS[Math.floor(Math.random() * TOKENS.length)].id,
  color: PLAYER_COLORS[0],
  avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
});

/** Оценка мощности устройства при первом запуске */
export function detectQuality(): Quality {
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as any).deviceMemory as number | undefined;
  const weak = cores <= 4 || (mem !== undefined && mem <= 4);
  const veryWeak = cores <= 2 || (mem !== undefined && mem <= 2);
  if (veryWeak || (mobile && weak)) return 'low';
  if (mobile || weak) return 'medium';
  return 'high';
}

const defaultPrefs = (): Prefs => {
  const quality = detectQuality();
  return { sfx: 0.7, music: 0.3, quality, anim: 'full', cameraFollow: true, menuTheme: 'classic', showLog: true, view: '3d' };
};

let toastSeq = 0;

export const useStore = create<Store>((set, get) => ({
  screen: 'menu',
  profile: { ...defaultProfile(), ...lsGet(LS.profile, {}) },
  prefs: { ...defaultPrefs(), ...lsGet(LS.prefs, {}) },
  mode: null,
  myId: null,
  game: null,
  animating: false,
  cashView: {},
  card: null,
  wheel: null,
  order: null,
  banner: null,
  lastDice: null,
  selectedCell: null,
  dialog: null,
  propsMode: 'all',
  propsOwner: null,
  tradeDraft: null,
  viewTrade: null,
  room: null,
  rooms: [],
  net: { status: 'idle', error: null, info: null, clientId: null },
  timeOffset: 0,
  setupSettings: sanitizeSettings(lsGet(LS.settings, defaultSettings())),
  setupSeats: lsGet<OfflineSeat[]>(LS.seats, []),
  toasts: [],
  emotes: [],
  set: (p) => {
    set(p);
    if (p.setupSettings) lsSet(LS.settings, p.setupSettings);
    if (p.setupSeats) lsSet(LS.seats, p.setupSeats);
  },
  go: (screen) => set({ screen, dialog: null, selectedCell: null }),
  toast: (text, kind = 'info') => {
    const id = ++toastSeq;
    set({ toasts: [...get().toasts.slice(-4), { id, text, kind }] });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), kind === 'error' ? 4200 : 3200);
  },
  setPrefs: (p) => {
    const prefs = { ...get().prefs, ...p };
    lsSet(LS.prefs, prefs);
    set({ prefs });
  },
  setProfile: (p) => {
    const profile = { ...get().profile, ...p };
    lsSet(LS.profile, profile);
    set({ profile });
  },
}));

export const store = () => useStore.getState();
