// Комнаты локальной сети: лобби, места игроков, запуск партии, сохранение на диск.

import fs from 'node:fs';
import path from 'node:path';
import type { WebSocket } from 'ws';
import type { ClientMsg, RoomSummary, RoomView, ServerInfo, ServerMsg } from '../shared/protocol';
import type { BotLevel, GameSettings, GameState, LobbySeat, PlayerProfile } from '../shared/types';
import { AVATARS, BOT_NAMES, PLAYER_COLORS, TOKENS, defaultSettings, sanitizeSettings } from '../shared/settings';
import { createGame, publicState } from '../shared/engine';
import { GameRunner } from '../shared/runner';
import { getBoard } from '../shared/boards';

interface Session {
  token: string;
  clientId: string;
  profile: PlayerProfile;
  roomId: string | null;
  sockets: Set<WebSocket>;
  lastSeen: number;
}

interface Room {
  id: string;
  code: string;
  hostId: string;
  settings: GameSettings;
  seats: LobbySeat[];
  status: 'lobby' | 'playing' | 'finished';
  runner: GameRunner | null;
  createdAt: number;
  updatedAt: number;
}

const rid = (n = 10) => Math.random().toString(36).slice(2, 2 + n) + Math.random().toString(36).slice(2, 2 + n);

export class RoomManager {
  sessions = new Map<string, Session>(); // по токену
  byClient = new Map<string, Session>();
  rooms = new Map<string, Room>();
  private saveTimer: NodeJS.Timeout | null = null;
  private lastBroadcast = new Map<string, number>();
  private closing = false;

  constructor(private saveDir: string, private info: () => ServerInfo) {
    this.load();
    setInterval(() => this.cleanup(), 60000).unref();
  }

  // ───────────── Подключения ─────────────

  attach(ws: WebSocket) {
    let session: Session | null = null;
    ws.on('message', (raw) => {
      if (this.closing) return;
      let msg: ClientMsg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      try {
        if (msg.t === 'hello') {
          session = this.hello(ws, msg.token, msg.profile);
          return;
        }
        if (msg.t === 'ping') {
          this.send(ws, { t: 'pong', at: msg.at, now: Date.now() });
          return;
        }
        if (!session) return this.send(ws, { t: 'error', message: 'Сначала выполните подключение' });
        session.lastSeen = Date.now();
        this.handle(session, ws, msg);
      } catch (e) {
        console.error('Ошибка обработки сообщения', e);
        this.send(ws, { t: 'error', message: 'Внутренняя ошибка сервера' });
      }
    });
    ws.on('close', () => {
      if (!session) return;
      session.sockets.delete(ws);
      if (session.sockets.size === 0) this.onDisconnect(session);
    });
  }

  private hello(ws: WebSocket, token: string | undefined, profile?: PlayerProfile): Session {
    let s = token ? this.sessions.get(token) : undefined;
    if (!s) {
      const clientId = `u${rid(6)}`;
      s = {
        token: rid(12),
        clientId,
        profile: this.cleanProfile(profile),
        roomId: null,
        sockets: new Set(),
        lastSeen: Date.now(),
      };
      this.sessions.set(s.token, s);
      this.byClient.set(clientId, s);
    } else if (profile && !s.roomId) {
      s.profile = this.cleanProfile(profile);
    }
    s.sockets.add(ws);
    s.lastSeen = Date.now();
    this.send(ws, { t: 'welcome', token: s.token, clientId: s.clientId, info: this.info() });
    // Восстановление после обрыва: возвращаем в комнату и в партию
    const room = s.roomId ? this.rooms.get(s.roomId) : undefined;
    if (room && room.seats.some((x) => x.id === s!.clientId)) {
      const seat = room.seats.find((x) => x.id === s!.clientId)!;
      seat.connected = true;
      if (room.runner) {
        room.runner.paused = false;
        room.runner.setConnected(s.clientId, true);
        this.send(ws, { t: 'state', state: publicState(room.runner.state), now: Date.now() });
      }
      this.broadcastRoom(room);
    } else {
      s.roomId = null;
      this.send(ws, { t: 'room', room: null });
    }
    return s;
  }

  private onDisconnect(s: Session) {
    const room = s.roomId ? this.rooms.get(s.roomId) : undefined;
    if (!room) return;
    const seat = room.seats.find((x) => x.id === s.clientId);
    if (seat) seat.connected = false;
    if (room.runner) room.runner.setConnected(s.clientId, false);
    this.broadcastRoom(room);
  }

  private handle(s: Session, ws: WebSocket, msg: ClientMsg) {
    const room = s.roomId ? this.rooms.get(s.roomId) : undefined;
    const isHost = !!room && room.hostId === s.clientId;
    const err = (message: string) => this.send(ws, { t: 'error', message });

    switch (msg.t) {
      case 'listRooms':
        return this.send(ws, { t: 'rooms', rooms: this.summaries(s) });

      case 'createRoom': {
        if (room) this.leave(s);
        s.profile = this.cleanProfile(msg.profile);
        const settings = sanitizeSettings(msg.settings);
        const r: Room = {
          id: rid(6),
          code: this.newCode(),
          hostId: s.clientId,
          settings,
          seats: [],
          status: 'lobby',
          runner: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        r.seats.push(this.humanSeat(r, s, true));
        this.rooms.set(r.id, r);
        s.roomId = r.id;
        console.log(`Создана комната «${settings.roomName}» (код ${r.code}) игроком ${s.profile.name}`);
        this.broadcastRoom(r);
        this.broadcastRoomList();
        return;
      }

      case 'joinRoom': {
        const code = String(msg.code || '').trim().toUpperCase();
        const r = [...this.rooms.values()].find((x) => x.code === code || x.id === msg.code);
        if (!r) return err('Комната с таким кодом не найдена');
        s.profile = this.cleanProfile(msg.profile);
        if (r.seats.some((x) => x.id === s.clientId)) {
          s.roomId = r.id;
          this.broadcastRoom(r);
          if (r.runner) this.send(ws, { t: 'state', state: publicState(r.runner.state), now: Date.now() });
          return;
        }
        if (r.status !== 'lobby') return err('Партия уже идёт — войти можно только тем, кто в ней участвует');
        if (r.seats.length >= r.settings.maxPlayers) {
          // Освобождаем место, убирая бота, если он есть
          const bot = [...r.seats].reverse().find((x) => x.isBot);
          if (!bot) return err('В комнате нет свободных мест');
          r.seats = r.seats.filter((x) => x !== bot);
        }
        if (room && room !== r) this.leave(s);
        r.seats.push(this.humanSeat(r, s, false));
        s.roomId = r.id;
        this.touch(r);
        this.broadcastRoom(r);
        this.broadcastRoomList();
        return;
      }

      case 'leaveRoom':
        this.leave(s);
        this.send(ws, { t: 'room', room: null });
        return;

      case 'updateSettings': {
        if (!room || !isHost) return err('Настройки меняет только хозяин комнаты');
        if (room.status !== 'lobby') return err('Партия уже началась');
        room.settings = sanitizeSettings(msg.settings);
        // Лишние места убираем (сначала ботов)
        while (room.seats.length > room.settings.maxPlayers) {
          const bot = [...room.seats].reverse().find((x) => x.isBot);
          if (!bot) {
            room.settings.maxPlayers = room.seats.length;
            break;
          }
          room.seats = room.seats.filter((x) => x !== bot);
        }
        // Изменение правил сбрасывает готовность
        room.seats.forEach((x) => !x.isBot && !x.isHost && (x.ready = false));
        this.touch(room);
        this.broadcastRoom(room);
        this.broadcastRoomList();
        return;
      }

      case 'updateProfile': {
        const p = this.cleanProfile(msg.profile);
        if (room && room.status === 'lobby') {
          const seat = room.seats.find((x) => x.id === s.clientId);
          if (seat) {
            const taken = room.seats.filter((x) => x !== seat);
            if (taken.some((x) => x.profile.color === p.color)) return err('Этот цвет уже занят');
            if (taken.some((x) => x.profile.token === p.token)) return err('Эта фишка уже занята');
            seat.profile = p;
            this.touch(room);
            this.broadcastRoom(room);
          }
        }
        s.profile = p;
        return;
      }

      case 'ready': {
        if (!room || room.status !== 'lobby') return;
        const seat = room.seats.find((x) => x.id === s.clientId);
        if (seat) seat.ready = !!msg.ready || seat.isHost;
        this.touch(room);
        this.broadcastRoom(room);
        return;
      }

      case 'addBot': {
        if (!room || !isHost || room.status !== 'lobby') return err('Ботов добавляет хозяин комнаты');
        if (room.seats.length >= room.settings.maxPlayers) return err('Все места заняты — увеличьте число участников');
        const level: BotLevel = ['easy', 'medium', 'hard'].includes(msg.level) ? msg.level : 'medium';
        room.seats.push(this.botSeat(room, level));
        this.touch(room);
        this.broadcastRoom(room);
        this.broadcastRoomList();
        return;
      }

      case 'removeSeat': {
        if (!room || !isHost || room.status !== 'lobby') return err('Только хозяин комнаты');
        const seat = room.seats.find((x) => x.id === msg.seatId);
        if (!seat || seat.isHost) return;
        room.seats = room.seats.filter((x) => x !== seat);
        if (!seat.isBot) {
          const other = this.byClient.get(seat.id);
          if (other) {
            other.roomId = null;
            other.sockets.forEach((w) => {
              this.send(w, { t: 'room', room: null });
              this.send(w, { t: 'error', message: 'Хозяин комнаты убрал вас из комнаты' });
            });
          }
        }
        this.touch(room);
        this.broadcastRoom(room);
        this.broadcastRoomList();
        return;
      }

      case 'setBotLevel': {
        if (!room || !isHost || room.status !== 'lobby') return;
        const seat = room.seats.find((x) => x.id === msg.seatId && x.isBot);
        if (seat && ['easy', 'medium', 'hard'].includes(msg.level)) seat.botLevel = msg.level;
        this.touch(room);
        this.broadcastRoom(room);
        return;
      }

      case 'moveSeat': {
        if (!room || !isHost || room.status !== 'lobby') return;
        const i = room.seats.findIndex((x) => x.id === msg.seatId);
        const j = i + (msg.dir === -1 ? -1 : 1);
        if (i < 0 || j < 0 || j >= room.seats.length) return;
        [room.seats[i], room.seats[j]] = [room.seats[j], room.seats[i]];
        this.touch(room);
        this.broadcastRoom(room);
        return;
      }

      case 'startGame': {
        if (!room || !isHost) return err('Начать игру может только хозяин комнаты');
        if (room.status === 'playing') return err('Партия уже идёт');
        if (room.seats.length < 2) return err('Нужно минимум 2 участника — добавьте игрока или бота');
        const notReady = room.seats.filter((x) => !x.isBot && !x.isHost && !x.ready);
        if (notReady.length) return err(`Не готовы: ${notReady.map((x) => x.profile.name).join(', ')}`);
        this.startGame(room);
        return;
      }

      case 'action': {
        if (!room || !room.runner) return err('Партия не идёт');
        const res = room.runner.act(s.clientId, msg.action, msg.id);
        this.send(ws, { t: 'actionResult', id: msg.id, ok: res.ok, error: res.error });
        return;
      }

      case 'replaceWithBot': {
        if (!room || !isHost || !room.runner) return;
        room.runner.replaceWithBot(msg.seatId);
        return;
      }

      case 'backToLobby': {
        if (!room || !isHost) return;
        if (room.runner && room.runner.state.phase !== 'gameOver') return err('Партия ещё не окончена');
        room.runner?.stop();
        room.runner = null;
        room.status = 'lobby';
        room.seats.forEach((x) => (x.ready = x.isBot || x.isHost));
        this.touch(room);
        this.broadcastRoom(room);
        this.broadcastRoomList();
        return;
      }

      case 'emote': {
        if (!room) return;
        const emote = String(msg.emote).slice(0, 16);
        this.forRoom(room, (w) => this.send(w, { t: 'emote', from: s.clientId, emote }));
        return;
      }
    }
  }

  // ───────────── Партия ─────────────

  private startGame(room: Room) {
    const seats = room.seats.map((x) => ({ id: x.id, isBot: x.isBot, botLevel: x.botLevel, profile: x.profile }));
    const state = createGame(room.settings, seats, Date.now());
    room.status = 'playing';
    this.attachRunner(room, state);
    room.runner!.start();
    console.log(`Партия в комнате ${room.code} началась: ${seats.map((x) => x.profile.name).join(', ')}`);
    this.broadcastRoom(room);
    this.broadcastState(room, true);
    this.broadcastRoomList();
  }

  private attachRunner(room: Room, state: GameState) {
    room.runner = new GameRunner(state, {
      tickMs: Number(process.env.TICK_MS) || 200,
      disconnectGraceMs: Number(process.env.DISCONNECT_GRACE_MS) || 40000,
      onChange: () => {
        if (room.runner?.state.phase === 'gameOver' && room.status !== 'finished') {
          room.status = 'finished';
          this.broadcastRoomList();
        }
        this.broadcastState(room);
      },
    });
  }

  private broadcastState(room: Room, force = false) {
    if (!room.runner) return;
    const msg: ServerMsg = { t: 'state', state: publicState(room.runner.state), now: Date.now() };
    const data = JSON.stringify(msg);
    this.forRoom(room, (w) => w.readyState === 1 && w.send(data));
    this.touch(room);
    void force;
  }

  private leave(s: Session) {
    const room = s.roomId ? this.rooms.get(s.roomId) : undefined;
    s.roomId = null;
    if (!room) return;
    if (room.status === 'lobby') {
      room.seats = room.seats.filter((x) => x.id !== s.clientId);
      const humans = room.seats.filter((x) => !x.isBot);
      if (!humans.length) {
        this.rooms.delete(room.id);
        this.broadcastRoomList();
        this.scheduleSave();
        return;
      }
      if (room.hostId === s.clientId) {
        room.hostId = humans[0].id;
        humans[0].isHost = true;
        humans[0].ready = true;
      }
    } else if (room.runner) {
      // Из идущей партии игрок уходит — его место занимает автопилот
      room.runner.setConnected(s.clientId, false);
    }
    this.touch(room);
    this.broadcastRoom(room);
    this.broadcastRoomList();
  }

  // ───────────── Места ─────────────

  private freeColor(room: Room, prefer?: string) {
    const used = new Set(room.seats.map((x) => x.profile.color));
    if (prefer && !used.has(prefer)) return prefer;
    return PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[0];
  }

  private freeToken(room: Room, prefer?: string) {
    const used = new Set(room.seats.map((x) => x.profile.token));
    if (prefer && !used.has(prefer)) return prefer;
    return TOKENS.find((t) => !used.has(t.id))?.id ?? TOKENS[0].id;
  }

  private humanSeat(room: Room, s: Session, isHost: boolean): LobbySeat {
    const profile = { ...s.profile, color: this.freeColor(room, s.profile.color), token: this.freeToken(room, s.profile.token) };
    s.profile = profile;
    return { id: s.clientId, isBot: false, botLevel: 'medium', profile, ready: isHost, connected: true, isHost };
  }

  private botSeat(room: Room, level: BotLevel): LobbySeat {
    const used = new Set(room.seats.map((x) => x.profile.name));
    const name = BOT_NAMES.find((n) => !used.has(n)) ?? `Бот ${room.seats.length + 1}`;
    const tokenPool = TOKENS.filter((t) => !room.seats.some((x) => x.profile.token === t.id));
    const token = tokenPool[Math.floor(Math.random() * tokenPool.length)]?.id ?? 'pawn';
    return {
      id: `bot-${rid(5)}`,
      isBot: true,
      botLevel: level,
      profile: { name, token, color: this.freeColor(room), avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)] },
      ready: true,
      connected: true,
      isHost: false,
    };
  }

  private cleanProfile(p?: PlayerProfile): PlayerProfile {
    const name = String(p?.name ?? '').trim().slice(0, 18) || `Игрок ${Math.floor(Math.random() * 900 + 100)}`;
    return {
      name,
      token: TOKENS.some((t) => t.id === p?.token) ? p!.token : 'pawn',
      color: PLAYER_COLORS.includes(p?.color ?? '') ? p!.color : PLAYER_COLORS[0],
      avatar: AVATARS.includes(p?.avatar ?? '') ? p!.avatar : AVATARS[0],
    };
  }

  private newCode() {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (;;) {
      let c = '';
      for (let i = 0; i < 4; i++) c += letters[Math.floor(Math.random() * letters.length)];
      if (![...this.rooms.values()].some((r) => r.code === c)) return c;
    }
  }

  // ───────────── Рассылка ─────────────

  private send(ws: WebSocket, msg: ServerMsg) {
    if (ws.readyState === 1) ws.send(JSON.stringify(msg));
  }

  private forRoom(room: Room, fn: (w: WebSocket) => void) {
    for (const seat of room.seats) {
      if (seat.isBot) continue;
      const s = this.byClient.get(seat.id);
      if (s && s.roomId === room.id) s.sockets.forEach(fn);
    }
  }

  private view(room: Room, s: Session): RoomView {
    return {
      id: room.id,
      code: room.code,
      hostId: room.hostId,
      settings: room.settings,
      seats: room.seats,
      status: room.status,
      mySeatId: room.seats.some((x) => x.id === s.clientId) ? s.clientId : null,
    };
  }

  private broadcastRoom(room: Room) {
    for (const seat of room.seats) {
      if (seat.isBot) continue;
      const s = this.byClient.get(seat.id);
      if (s && s.roomId === room.id) s.sockets.forEach((w) => this.send(w, { t: 'room', room: this.view(room, s) }));
    }
    this.scheduleSave();
  }

  private summaries(s?: Session): RoomSummary[] {
    return [...this.rooms.values()]
      .filter((r) => r.status === 'lobby' || (s && r.seats.some((x) => x.id === s.clientId)))
      .map((r) => ({
        id: r.id,
        code: r.code,
        name: r.settings.roomName,
        hostName: r.seats.find((x) => x.isHost)?.profile.name ?? '—',
        players: r.seats.length,
        maxPlayers: r.settings.maxPlayers,
        status: r.status,
        boardName: getBoard(r.settings.boardId, r.settings.customBoard).name,
        hasSeatFor: !!s && r.seats.some((x) => x.id === s.clientId),
      }));
  }

  private broadcastRoomList() {
    for (const s of this.sessions.values()) {
      if (s.roomId) continue;
      const rooms = this.summaries(s);
      s.sockets.forEach((w) => this.send(w, { t: 'rooms', rooms }));
    }
  }

  private touch(room: Room) {
    room.updatedAt = Date.now();
    this.scheduleSave();
  }

  // ───────────── Сохранение ─────────────

  private scheduleSave() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.save();
    }, 1500);
  }

  /** Остановить все партии (перед завершением сервера), чтобы сохранение было окончательным */
  stopAll() {
    this.closing = true;
    for (const r of this.rooms.values()) r.runner?.stop();
    // Закрываем соединения: действия, пришедшие после сохранения, не должны применяться
    for (const sess of this.sessions.values()) sess.sockets.forEach((w) => w.close(1012, 'restart'));
  }

  save() {
    try {
      fs.mkdirSync(this.saveDir, { recursive: true });
      const data = {
        savedAt: Date.now(),
        sessions: [...this.sessions.values()]
          .filter((s) => s.roomId)
          .map((s) => ({ token: s.token, clientId: s.clientId, profile: s.profile, roomId: s.roomId })),
        rooms: [...this.rooms.values()].map((r) => ({
          id: r.id,
          code: r.code,
          hostId: r.hostId,
          settings: r.settings,
          seats: r.seats,
          status: r.status,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          state: r.runner?.state ?? null,
        })),
      };
      const file = path.join(this.saveDir, 'rooms.json');
      fs.writeFileSync(file + '.tmp', JSON.stringify(data));
      fs.renameSync(file + '.tmp', file);
    } catch (e) {
      console.error('Не удалось сохранить комнаты', e);
    }
  }

  private load() {
    const file = path.join(this.saveDir, 'rooms.json');
    if (!fs.existsSync(file)) return;
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const s of data.sessions ?? []) {
        const sess: Session = { ...s, sockets: new Set(), lastSeen: Date.now() };
        this.sessions.set(sess.token, sess);
        this.byClient.set(sess.clientId, sess);
      }
      for (const r of data.rooms ?? []) {
        const room: Room = { ...r, runner: null };
        room.seats.forEach((x) => !x.isBot && (x.connected = false));
        if (r.state) {
          const st = r.state as GameState;
          st.players.forEach((p) => !p.isBot && (p.connected = false));
          // После перезапуска сервера даём время на анимации и возвращение игроков
          st.busyUntil = Date.now() + 1000;
          if (st.auction) st.auction.endsAt = Date.now() + 15000;
          if (st.deadline) st.deadline = Date.now() + st.settings.turnTimer * 1000;
          this.attachRunner(room, st);
          room.runner!.paused = true; // продолжится, когда вернётся кто-то из людей
          room.runner!.start();
        }
        this.rooms.set(room.id, room);
      }
      console.log(`Восстановлено комнат: ${this.rooms.size}`);
    } catch (e) {
      console.error('Не удалось загрузить сохранённые комнаты', e);
    }
  }

  private cleanup() {
    const now = Date.now();
    for (const r of this.rooms.values()) {
      const anyOnline = r.seats.some((x) => !x.isBot && this.byClient.get(x.id)?.sockets.size);
      const idle = now - r.updatedAt;
      const limit = r.status === 'playing' ? 6 * 3600_000 : r.status === 'finished' ? 30 * 60_000 : 2 * 3600_000;
      if (!anyOnline && idle > limit) {
        r.runner?.stop();
        this.rooms.delete(r.id);
        console.log(`Комната ${r.code} удалена по неактивности`);
      }
    }
    for (const [token, s] of this.sessions) {
      if (!s.sockets.size && !s.roomId && now - s.lastSeen > 3600_000) {
        this.sessions.delete(token);
        this.byClient.delete(s.clientId);
      }
    }
    this.scheduleSave();
  }
}

export { defaultSettings };
