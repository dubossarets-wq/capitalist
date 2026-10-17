// Протокол обмена между браузером и локальным сервером (WebSocket, JSON)

import type { BotLevel, GameAction, GameSettings, GameState, LobbySeat, PlayerProfile } from './types';

export interface RoomSummary {
  id: string;
  code: string;
  name: string;
  hostName: string;
  players: number;
  maxPlayers: number;
  status: 'lobby' | 'playing' | 'finished';
  boardName: string;
  hasSeatFor?: boolean;
}

export interface RoomView {
  id: string;
  code: string;
  hostId: string;
  settings: GameSettings;
  seats: LobbySeat[];
  status: 'lobby' | 'playing' | 'finished';
  mySeatId: string | null;
}

export interface ServerInfo {
  urls: string[];
  port: number;
  version: string;
}

export type ClientMsg =
  | { t: 'hello'; token?: string; profile?: PlayerProfile }
  | { t: 'listRooms' }
  | { t: 'createRoom'; settings: GameSettings; profile: PlayerProfile }
  | { t: 'joinRoom'; code: string; profile: PlayerProfile }
  | { t: 'leaveRoom' }
  | { t: 'updateSettings'; settings: GameSettings }
  | { t: 'updateProfile'; profile: PlayerProfile }
  | { t: 'ready'; ready: boolean }
  | { t: 'addBot'; level: BotLevel }
  | { t: 'removeSeat'; seatId: string }
  | { t: 'setBotLevel'; seatId: string; level: BotLevel }
  | { t: 'moveSeat'; seatId: string; dir: -1 | 1 }
  | { t: 'startGame' }
  | { t: 'action'; id: string; action: GameAction }
  | { t: 'replaceWithBot'; seatId: string }
  | { t: 'backToLobby' }
  | { t: 'emote'; emote: string }
  | { t: 'ping'; at: number };

export type ServerMsg =
  | { t: 'welcome'; token: string; clientId: string; info: ServerInfo }
  | { t: 'rooms'; rooms: RoomSummary[] }
  | { t: 'room'; room: RoomView | null }
  | { t: 'state'; state: GameState; now: number }
  | { t: 'actionResult'; id: string; ok: boolean; error?: string }
  | { t: 'error'; message: string }
  | { t: 'emote'; from: string; emote: string }
  | { t: 'pong'; at: number; now: number };
