// Статистика и таблица рекордов (хранятся на этом устройстве)
import type { GameState } from '../../shared/types';
import { netWorth } from '../../shared/engine';
import { lsGet, lsSet } from '../store';

const KEY = 'capitalist.records.v1';

export interface RecordEntry {
  date: number;
  board: string;
  players: number;
  winner: string;
  winnerIsMe: boolean;
  myPlace: number;
  myWorth: number;
  turns: number;
  durationMin: number;
}

export interface Records {
  games: number;
  wins: number;
  bestWorth: number;
  totalRent: number;
  totalBought: number;
  history: RecordEntry[];
  winners: Record<string, number>;
}

export function getRecords(): Records {
  return lsGet<Records>(KEY, { games: 0, wins: 0, bestWorth: 0, totalRent: 0, totalBought: 0, history: [], winners: {} });
}

export function recordGameResult(s: GameState, myId: string | null) {
  const r = getRecords();
  const me = s.players.find((p) => p.id === myId);
  const ranking = rankPlayers(s);
  const winner = s.players.find((p) => p.id === s.winner);
  r.games++;
  if (winner && winner.id === myId) r.wins++;
  if (winner) r.winners[winner.name] = (r.winners[winner.name] ?? 0) + 1;
  if (me) {
    r.bestWorth = Math.max(r.bestWorth, me.stats.maxNetWorth);
    r.totalRent += me.stats.rentReceived;
    r.totalBought += me.stats.propertiesBought;
  }
  r.history.unshift({
    date: Date.now(),
    board: s.board.name,
    players: s.players.length,
    winner: winner?.name ?? '—',
    winnerIsMe: !!winner && winner.id === myId,
    myPlace: me ? ranking.findIndex((p) => p.id === me.id) + 1 : 0,
    myWorth: me ? me.stats.maxNetWorth : 0,
    turns: s.turn,
    durationMin: Math.round((Date.now() - s.startedAt) / 60000),
  });
  r.history = r.history.slice(0, 30);
  lsSet(KEY, r);
}

/** Места игроков: сначала победитель, затем по капиталу, банкроты — в порядке выбывания (позже — выше) */
export function rankPlayers(s: GameState) {
  return [...s.players].sort((a, b) => {
    if (a.id === s.winner) return -1;
    if (b.id === s.winner) return 1;
    if (a.bankrupt !== b.bankrupt) return a.bankrupt ? 1 : -1;
    return netWorth(s, b.id) - netWorth(s, a.id) || b.stats.maxNetWorth - a.stats.maxNetWorth;
  });
}
