// Игровая сессия: локальная (движок и боты работают в браузере) или сетевая (через сервер Wi-Fi).
import type { GameAction, GameSettings, GameState } from '../../shared/types';
import { createGame } from '../../shared/engine';
import { GameRunner } from '../../shared/runner';
import { director } from './director';
import { store, lsGet, lsSet, type OfflineSeat } from '../store';
import { net } from '../net/netClient';
import { sound } from '../audio/sound';
import { recordGameResult } from './records';

const SAVE_KEY = 'capitalist.save.v1';
export const LOCAL_ID = 'me';

let runner: GameRunner | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let recorded = '';

function clone<T>(v: T): T {
  return typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v));
}

function onLocalChange(s: GameState) {
  director.push(clone(s));
  if (s.phase === 'gameOver') {
    if (recorded !== s.id) {
      recorded = s.id;
      recordGameResult(s, LOCAL_ID);
    }
    clearSave();
    return;
  }
  if (!saveTimer) {
    saveTimer = setTimeout(() => {
      saveTimer = null;
      if (runner) saveLocal(runner.state);
    }, 1200);
  }
}

function saveLocal(s: GameState) {
  lsSet(SAVE_KEY, { savedAt: Date.now(), state: s });
}

export function hasSave(): { savedAt: number; state: GameState } | null {
  const v = lsGet<{ savedAt: number; state: GameState } | null>(SAVE_KEY, null);
  if (!v || !v.state || v.state.phase === 'gameOver') return null;
  return v;
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* нет доступа */
  }
}

function attachRunner(state: GameState) {
  stopLocal();
  director.reset();
  runner = new GameRunner(state, { onChange: onLocalChange });
  store().set({ mode: 'local', myId: LOCAL_ID, timeOffset: 0, game: null, dialog: null, selectedCell: null, tradeDraft: null, card: null, wheel: null, order: null, banner: null });
  store().go('game');
  director.push(clone(state));
  runner.start();
}

export function startLocalGame(settings: GameSettings, seats: OfflineSeat[]) {
  const state = createGame(
    settings,
    seats.map((s) => ({ id: s.id, isBot: s.isBot, botLevel: s.botLevel, profile: s.profile })),
    Date.now(),
  );
  attachRunner(state);
  saveLocal(state);
}

/** Продолжить сохранённую партию (после перезагрузки страницы) */
export function resumeLocalGame(state: GameState) {
  const now = Date.now();
  // Смещаем таймеры на время, пока игра была закрыта
  const pausedFor = Math.max(0, now - (state.busyUntil || now));
  state.busyUntil = now + 500;
  if (state.endsAt) state.endsAt += pausedFor;
  if (state.deadline) state.deadline = now + state.settings.turnTimer * 1000;
  if (state.auction) state.auction.endsAt = now + 12000;
  attachRunner(state);
}

export function exportSave(): string | null {
  const s = runner?.state ?? hasSave()?.state;
  return s ? JSON.stringify({ format: 'capitalist-save', version: 1, savedAt: Date.now(), state: s }) : null;
}

export function importSave(text: string): string | null {
  try {
    const data = JSON.parse(text);
    const st = data.state as GameState;
    if (data.format !== 'capitalist-save' || !st?.players || !st.board) return 'Это не файл сохранения «Капиталиста»';
    if (!st.players.some((p) => p.id === LOCAL_ID)) {
      // Сохранение сетевой партии: первый живой человек становится «мной», остальные люди — ботами
      const human = st.players.find((p) => !p.isBot && !p.bankrupt);
      st.players.forEach((p) => {
        if (p === human) p.id = LOCAL_ID;
        else if (!p.isBot) p.isBot = true;
      });
    }
    resumeLocalGame(st);
    return null;
  } catch {
    return 'Не удалось прочитать файл';
  }
}

export function stopLocal() {
  runner?.stop();
  if (runner && runner.state.phase !== 'gameOver') saveLocal(runner.state);
  runner = null;
}

export function restartLocal() {
  const s = runner?.state;
  if (!s) return;
  const seats: OfflineSeat[] = s.players.map((p) => ({
    id: p.id,
    isBot: p.isBot,
    botLevel: p.botLevel,
    profile: { name: p.name.replace(/ \(бот\)$/, ''), token: p.token, color: p.color, avatar: p.avatar },
  }));
  startLocalGame(s.settings, seats);
}

let actSeq = 0;

/** Действие текущего игрока */
export function act(a: GameAction) {
  const st = store();
  if (st.mode === 'local') {
    if (!runner) return;
    const res = runner.act(LOCAL_ID, a, `l${++actSeq}`);
    if (!res.ok && res.error) {
      sound.play('error');
      st.toast(res.error, 'error');
    }
  } else if (st.mode === 'net') {
    net.act(a);
  }
}

export function leaveGame() {
  const st = store();
  if (st.mode === 'local') stopLocal();
  if (st.mode === 'net') net.send({ t: 'leaveRoom' });
  director.reset();
  st.set({ mode: null, game: null, myId: null, dialog: null, card: null, wheel: null, order: null, banner: null, room: null });
  st.go('menu');
}

/** Для автотестов интерфейса: остановить ботов, чтобы окна не менялись во время снимков */
(globalThis as any).__capFreeze = () => runner?.stop();

export function isLocalRunning() {
  return !!runner;
}
