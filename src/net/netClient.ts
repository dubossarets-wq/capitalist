// Клиент локальной сети: WebSocket с автоматическим переподключением.
// Действия отправляются с уникальным id; при обрыве неподтверждённые действия
// отправляются повторно, а сервер отбрасывает дубликаты.
import type { ClientMsg, ServerMsg } from '../../shared/protocol';
import type { GameAction, GameSettings } from '../../shared/types';
import { store, lsGet, lsSet } from '../store';
import { director } from '../game/director';
import { sound } from '../audio/sound';
import { recordGameResult } from '../game/records';
import { WSTransport, type Transport } from './transports';

const TOKEN_KEY = 'capitalist.token.v1';
const SERVER_KEY = 'capitalist.server.v1';

type Waiter = { resolve: () => void; reject: (e: Error) => void };

export type NetMode = 'server' | 'host' | 'guest';

class NetClient {
  private transport: Transport | null = null;
  private factory: () => Transport = () => new WSTransport(this.url());
  mode: NetMode = 'server';
  private wanted = false;
  private retry = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pending = new Map<string, ClientMsg>();
  private waiters: Waiter[] = [];
  private seq = 0;
  private recorded = '';
  private afterWelcome: ClientMsg[] = [];

  get serverAddress(): string {
    return lsGet<string>(SERVER_KEY, '') || location.host;
  }

  set serverAddress(v: string) {
    lsSet(SERVER_KEY, v.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''));
  }

  private url() {
    const host = this.serverAddress;
    const secure = location.protocol === 'https:' && host === location.host;
    return `${secure ? 'wss' : 'ws'}://${host}/ws`;
  }

  /** Выбрать способ связи: сервер на компьютере, хозяин в этом браузере или гость хозяина */
  use(mode: NetMode, factory: () => Transport) {
    if (this.transport) this.disconnect();
    this.mode = mode;
    this.factory = factory;
    this.retry = 0;
  }

  useServer() {
    this.use('server', () => new WSTransport(this.url()));
  }

  /** Подключиться (или убедиться, что подключены) */
  connect(): Promise<void> {
    this.wanted = true;
    if (this.transport && this.transport.isOpen() && store().net.status === 'online') return Promise.resolve();
    const p = new Promise<void>((resolve, reject) => this.waiters.push({ resolve, reject }));
    if (!this.transport) this.open();
    return p;
  }

  private open() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    const st = store();
    st.set({ net: { ...st.net, status: this.retry ? 'reconnecting' : 'connecting', error: null } });
    const t = this.transport ?? this.factory();
    this.transport = t;
    t.open({
      onOpen: () => {
        if (this.transport !== t) return;
        const token = lsGet<string>(TOKEN_KEY, '');
        this.raw({ t: 'hello', token: token || undefined, profile: store().profile });
      },
      onMessage: (data) => {
        if (this.transport !== t) return;
        let msg: ServerMsg;
        try {
          msg = JSON.parse(data);
        } catch {
          return;
        }
        this.onMessage(msg);
      },
      onClose: (reason) => {
        if (this.transport !== t) return;
        if (this.pingTimer) clearInterval(this.pingTimer);
        this.pingTimer = null;
        if (!this.wanted) {
          this.transport = null;
          store().set({ net: { ...store().net, status: 'idle' } });
          return;
        }
        // Сервер — переоткрываем соединение заново; хозяин по WebRTC — ждём его возвращения в той же комнате
        if (t.kind === 'server') this.transport = null;
        this.retry++;
        if (this.waiters.length && (this.retry >= 2 || (reason && t.kind === 'guest'))) {
          this.fail(
            reason ??
              (t.kind === 'server'
                ? 'Сервер не отвечает. Убедитесь, что сервер запущен на компьютере и устройство в той же Wi-Fi сети.'
                : 'Не удалось подключиться к хозяину комнаты'),
          );
        }
        const delay = Math.min(5000, 600 * this.retry);
        store().set({ net: { ...store().net, status: 'reconnecting', error: reason ?? store().net.error } });
        this.retryTimer = setTimeout(() => this.open(), delay);
      },
    });
  }

  private fail(message: string) {
    const st = store();
    st.set({ net: { ...st.net, status: 'error', error: message } });
    const w = this.waiters;
    this.waiters = [];
    w.forEach((x) => x.reject(new Error(message)));
  }

  /** Немедленная попытка переподключения (после пробуждения устройства) */
  wake() {
    if (this.wanted && (!this.transport || !this.transport.isOpen())) {
      this.retry = Math.max(1, this.retry);
      this.open();
    }
  }

  disconnect() {
    this.wanted = false;
    this.retry = 0;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    const t = this.transport;
    this.transport = null;
    t?.close();
    const w = this.waiters;
    this.waiters = [];
    w.forEach((x) => x.reject(new Error('Отключено')));
    store().set({ net: { ...store().net, status: 'idle' }, room: null, rooms: [] });
  }

  private raw(msg: ClientMsg) {
    return !!this.transport && this.transport.send(JSON.stringify(msg));
  }

  send(msg: ClientMsg) {
    if (store().net.status !== 'online') {
      this.afterWelcome.push(msg);
      return;
    }
    this.raw(msg);
  }

  act(action: GameAction) {
    const id = `a${Date.now().toString(36)}${(++this.seq).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const msg: ClientMsg = { t: 'action', id, action };
    this.pending.set(id, msg);
    if (!this.raw(msg)) store().toast('Нет связи с сервером — действие будет отправлено после переподключения', 'error');
  }

  createRoom(settings: GameSettings) {
    this.send({ t: 'createRoom', settings, profile: store().profile });
  }

  joinRoom(code: string) {
    this.send({ t: 'joinRoom', code, profile: store().profile });
  }

  private onMessage(msg: ServerMsg) {
    const st = store();
    switch (msg.t) {
      case 'welcome': {
        lsSet(TOKEN_KEY, msg.token);
        this.retry = 0;
        st.set({ net: { status: 'online', error: null, info: msg.info, clientId: msg.clientId } });
        const w = this.waiters;
        this.waiters = [];
        w.forEach((x) => x.resolve());
        // Повторно отправляем то, что могло потеряться при обрыве
        for (const m of this.pending.values()) this.raw(m);
        const q = this.afterWelcome;
        this.afterWelcome = [];
        q.forEach((m) => this.raw(m));
        this.raw({ t: 'listRooms' });
        if (this.pingTimer) clearInterval(this.pingTimer);
        this.pingTimer = setInterval(() => this.raw({ t: 'ping', at: Date.now() }), 5000);
        return;
      }
      case 'pong': {
        const rtt = Date.now() - msg.at;
        st.set({ timeOffset: msg.now + rtt / 2 - Date.now() });
        return;
      }
      case 'rooms':
        st.set({ rooms: msg.rooms });
        return;
      case 'room': {
        const room = msg.room;
        st.set({ room });
        if (!room) {
          if (st.mode === 'net' && (st.screen === 'lobby' || st.screen === 'game')) {
            director.reset();
            st.set({ mode: null, game: null });
            st.go('join');
          } else if (st.screen === 'lobby') st.go('join');
          return;
        }
        if (room.status === 'lobby') {
          if (st.screen !== 'lobby') {
            director.reset();
            st.set({ mode: 'net', myId: st.net.clientId, game: null });
            st.go('lobby');
          }
        }
        return;
      }
      case 'state': {
        st.set({ timeOffset: msg.now - Date.now() });
        if (st.screen !== 'game' || st.mode !== 'net') {
          st.set({ mode: 'net', myId: st.net.clientId, dialog: null, card: null, wheel: null, order: null, banner: null });
          st.go('game');
        }
        director.push(msg.state);
        if (msg.state.phase === 'gameOver' && this.recorded !== msg.state.id) {
          this.recorded = msg.state.id;
          recordGameResult(msg.state, st.net.clientId);
        }
        return;
      }
      case 'actionResult': {
        this.pending.delete(msg.id);
        if (!msg.ok && msg.error) {
          sound.play('error');
          st.toast(msg.error, 'error');
        }
        return;
      }
      case 'error':
        sound.play('error');
        st.toast(msg.message, 'error');
        return;
      case 'emote': {
        const id = Math.random();
        st.set({ emotes: [...st.emotes.slice(-6), { id, from: msg.from, emote: msg.emote }] });
        setTimeout(() => store().set({ emotes: store().emotes.filter((e) => e.id !== id) }), 3000);
        return;
      }
    }
  }
}

export const net = new NetClient();

// Телефон проснулся или вкладка снова активна — сразу переподключаемся
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && store().net.status === 'reconnecting') net.wake();
});
