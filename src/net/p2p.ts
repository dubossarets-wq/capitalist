// Игра по Wi-Fi без сервера на компьютере.
// Браузер хозяина комнаты сам ведёт партию (то же ядро комнат, что и на сервере),
// гости подключаются к нему напрямую через WebRTC.
//
// Как устройства находят друг друга:
//  • по коду комнаты — через публичные сигнальные серверы Nostr (нужен интернет на несколько
//    секунд подключения); сама игра идёт напрямую между устройствами;
//  • без интернета — обменом QR-кодами: гость сканирует QR хозяина, хозяин — ответный QR гостя.
import { joinRoom, type Room, type MessageAction } from 'trystero';
import { RoomCore } from '../../shared/roomCore';
import { LoopTransport, VirtualSock, type Transport, type TransportHandlers } from './transports';

const APP_ID = 'kapitalist-board-game-v1';
const HOST_KEY = 'capitalist.p2phost.v1';
const HOST_MARK = '__host__';

import { siteBase } from './staticMode';
export { siteBase };

function signalRoom(code: string): Room {
  return joinRoom({ appId: APP_ID }, `room-${code}`);
}

// ───────────────────────── Хозяин комнаты ─────────────────────────

export class P2PHost {
  readonly core: RoomCore;
  private room: Room | null = null;
  private act: MessageAction<string> | null = null;
  private code: string | null = null;
  private socks = new Map<string, VirtualSock>();
  private watch: ReturnType<typeof setInterval>;
  private announce: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.core = new RoomCore(
      {
        read: () => {
          try {
            return localStorage.getItem(HOST_KEY);
          } catch {
            return null;
          }
        },
        write: (json) => {
          try {
            localStorage.setItem(HOST_KEY, json);
          } catch {
            /* хранилище недоступно — партия просто не сохранится */
          }
        },
      },
      () => ({ urls: [siteBase()], port: 0, version: '1.0.0' }),
      { tickMs: 200, graceMs: 40000 },
    );
    // Код комнаты появляется после её создания — тогда и открываем «дверь» для гостей
    this.watch = setInterval(() => this.syncSignal(), 400);
    this.syncSignal();
  }

  /** Есть ли сохранённая комната хозяина (после перезагрузки страницы) */
  static hasSaved(): boolean {
    try {
      const raw = localStorage.getItem(HOST_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      return Array.isArray(data.rooms) && data.rooms.length > 0;
    } catch {
      return false;
    }
  }

  static clearSaved() {
    try {
      localStorage.removeItem(HOST_KEY);
    } catch {
      /* нет доступа */
    }
  }

  transport(): Transport {
    return new LoopTransport((sock) => this.core.attach(sock));
  }

  currentCode(): string | null {
    const r = [...this.core.rooms.values()][0];
    return r ? r.code : null;
  }

  private syncSignal() {
    const code = this.currentCode();
    if (code === this.code) return;
    this.leaveSignal();
    this.code = code;
    if (!code) return;
    const room = signalRoom(code);
    const act = room.makeAction<string>('m');
    this.room = room;
    this.act = act;
    room.onPeerJoin = (peer) => {
      void act.send(HOST_MARK, { target: peer });
      this.ensureSock(peer);
    };
    room.onPeerLeave = (peer) => {
      this.socks.get(peer)?.drop();
      this.socks.delete(peer);
    };
    act.onMessage = (data, ctx) => {
      if (typeof data !== 'string' || data === HOST_MARK) return;
      this.ensureSock(ctx.peerId).deliver(data);
    };
    // Повторяем отметку хозяина — на случай, если гость подключился раньше, чем начал слушать
    this.announce = setInterval(() => void act.send(HOST_MARK).catch(() => {}), 3000);
  }

  private ensureSock(peer: string) {
    let sock = this.socks.get(peer);
    if (!sock || sock.readyState !== 1) {
      const act = this.act!;
      sock = new VirtualSock((d) => void act.send(d, { target: peer }).catch(() => {}));
      this.socks.set(peer, sock);
      this.core.attach(sock);
    }
    return sock;
  }

  private leaveSignal() {
    if (this.announce) clearInterval(this.announce);
    this.announce = null;
    this.socks.forEach((s) => s.drop());
    this.socks.clear();
    void this.room?.leave();
    this.room = null;
    this.act = null;
  }

  /** Подключение гостя без интернета: QR-код с предложением соединения */
  async offlineInvite(): Promise<{ code: string; accept: (answer: string) => Promise<void>; close: () => void }> {
    const pc = new RTCPeerConnection({ iceServers: [] });
    const dc = pc.createDataChannel('m', { ordered: true });
    const sock = new VirtualSock((d) => dc.readyState === 'open' && dc.send(d));
    dc.onopen = () => this.core.attach(sock);
    dc.onmessage = (e) => sock.deliver(String(e.data));
    dc.onclose = () => sock.drop();
    await pc.setLocalDescription(await pc.createOffer());
    await gathered(pc);
    const code = await pack({ k: 'O', c: this.currentCode(), s: pc.localDescription!.sdp });
    return {
      code,
      accept: async (answer) => {
        const data = await unpack(answer);
        if (data.k !== 'A') throw new Error('Это не ответный QR-код гостя');
        await pc.setRemoteDescription({ type: 'answer', sdp: data.s });
      },
      close: () => {
        if (dc.readyState !== 'open') pc.close();
      },
    };
  }

  stop() {
    clearInterval(this.watch);
    this.leaveSignal();
  }
}

let host: P2PHost | null = null;

export function getHost(): P2PHost {
  if (!host) host = new P2PHost();
  return host;
}

export function stopHost(clear = false) {
  host?.stop();
  host = null;
  if (clear) P2PHost.clearSaved();
}

// ───────────────────────── Гость: по коду ─────────────────────────

export class P2PGuestTransport implements Transport {
  readonly kind = 'guest' as const;
  private room: Room | null = null;
  private act: MessageAction<string> | null = null;
  private hostPeer: string | null = null;
  private h: TransportHandlers | null = null;
  private waiting: ReturnType<typeof setTimeout> | null = null;
  private opened = false;

  constructor(readonly code: string) {}

  open(h: TransportHandlers) {
    this.h = h;
    this.opened = false;
    if (!this.room) this.join();
    if (this.hostPeer) {
      this.opened = true;
      queueMicrotask(() => h.onOpen());
      return;
    }
    if (this.waiting) clearTimeout(this.waiting);
    this.waiting = setTimeout(() => {
      if (this.opened) return;
      h.onClose(
        navigator.onLine === false
          ? 'Нет интернета для подключения по коду. Попросите хозяина показать QR для подключения без интернета.'
          : `Комната ${this.code} не найдена. Проверьте код и что хозяин держит игру открытой.`,
      );
    }, 20000);
  }

  private join() {
    const room = signalRoom(this.code);
    const act = room.makeAction<string>('m');
    this.room = room;
    this.act = act;
    act.onMessage = (data, ctx) => {
      if (typeof data !== 'string') return;
      if (data === HOST_MARK) {
        if (this.hostPeer !== ctx.peerId) this.hostPeer = ctx.peerId;
        if (!this.opened && this.h) {
          this.opened = true;
          if (this.waiting) clearTimeout(this.waiting);
          this.h.onOpen();
        }
        return;
      }
      if (ctx.peerId === this.hostPeer && this.opened) this.h?.onMessage(data);
    };
    room.onPeerLeave = (peer) => {
      if (peer !== this.hostPeer) return;
      this.hostPeer = null;
      if (this.opened) {
        this.opened = false;
        this.h?.onClose('Связь с хозяином комнаты потеряна');
      }
    };
  }

  send(data: string) {
    if (!this.act || !this.hostPeer || !this.opened) return false;
    void this.act.send(data, { target: this.hostPeer }).catch(() => {});
    return true;
  }

  close() {
    if (this.waiting) clearTimeout(this.waiting);
    this.opened = false;
    this.hostPeer = null;
    void this.room?.leave();
    this.room = null;
    this.act = null;
  }

  isOpen() {
    return this.opened;
  }
}

// ───────────────────────── Гость: без интернета (QR) ─────────────────────────

export class RtcGuestTransport implements Transport {
  readonly kind = 'guest' as const;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private used = false;
  roomCode: string | null = null;

  /** offer — содержимое QR-кода хозяина; onAnswer получает ответный код для показа хозяину */
  constructor(private offer: { c: string | null; s: string }, private onAnswer: (code: string) => void) {
    this.roomCode = offer.c;
  }

  open(h: TransportHandlers) {
    if (this.used) {
      // Прямое соединение без интернета нельзя восстановить само — нужен новый обмен QR
      queueMicrotask(() => h.onClose('Связь потеряна. Попросите хозяина показать новый QR и отсканируйте его.'));
      return;
    }
    this.used = true;
    const pc = new RTCPeerConnection({ iceServers: [] });
    this.pc = pc;
    pc.ondatachannel = (e) => {
      const dc = e.channel;
      this.dc = dc;
      dc.onopen = () => h.onOpen();
      dc.onmessage = (m) => h.onMessage(String(m.data));
      dc.onclose = () => h.onClose('Связь с хозяином потеряна');
    };
    void (async () => {
      try {
        await pc.setRemoteDescription({ type: 'offer', sdp: this.offer.s });
        await pc.setLocalDescription(await pc.createAnswer());
        await gathered(pc);
        this.onAnswer(await pack({ k: 'A', s: pc.localDescription!.sdp }));
      } catch {
        h.onClose('QR-код хозяина повреждён или устарел');
      }
    })();
  }

  send(data: string) {
    if (this.dc && this.dc.readyState === 'open') {
      this.dc.send(data);
      return true;
    }
    return false;
  }

  close() {
    this.dc?.close();
    this.pc?.close();
  }

  isOpen() {
    return !!this.dc && this.dc.readyState === 'open';
  }
}

// ───────────────────────── Упаковка данных соединения в QR ─────────────────────────

function gathered(pc: RTCPeerConnection, ms = 2500): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(t);
        resolve();
      }
    });
  });
}

const PREFIX = 'KAP1.';

export function isOfflineCode(text: string) {
  return text.startsWith(PREFIX);
}

/** Сжатие (deflate) + base64url, чтобы QR-код оставался читаемым */
export async function pack(obj: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let out: Uint8Array = bytes;
  let flag = 'r';
  if (typeof CompressionStream !== 'undefined') {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    out = new Uint8Array(await new Response(stream).arrayBuffer());
    flag = 'z';
  }
  let bin = '';
  out.forEach((b) => (bin += String.fromCharCode(b)));
  return PREFIX + flag + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function unpack(text: string): Promise<any> {
  if (!text.startsWith(PREFIX)) throw new Error('Неизвестный QR-код');
  const flag = text[PREFIX.length];
  const b64 = text.slice(PREFIX.length + 1).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  let json: string;
  if (flag === 'z') {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    json = await new Response(stream).text();
  } else json = new TextDecoder().decode(bytes);
  return JSON.parse(json);
}
