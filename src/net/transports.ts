// Транспорты сетевого клиента. Клиент говорит на одном протоколе (shared/protocol.ts),
// а доставка бывает разной: WebSocket до сервера на компьютере, локальная «петля»
// в браузере хозяина комнаты или канал WebRTC до хозяина (см. p2p.ts).
import type { Sock } from '../../shared/roomCore';

export interface TransportHandlers {
  onOpen(): void;
  onMessage(data: string): void;
  onClose(reason?: string): void;
}

export interface Transport {
  readonly kind: 'server' | 'host' | 'guest';
  open(h: TransportHandlers): void;
  send(data: string): boolean;
  close(): void;
  isOpen(): boolean;
}

/** WebSocket до локального сервера (запуск «Запустить игру.bat») */
export class WSTransport implements Transport {
  readonly kind = 'server' as const;
  private ws: WebSocket | null = null;
  constructor(private url: string) {}

  open(h: TransportHandlers) {
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch {
      setTimeout(() => h.onClose('Неверный адрес сервера'), 0);
      return;
    }
    this.ws = ws;
    const timeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) ws.close();
    }, 6000);
    ws.onopen = () => {
      clearTimeout(timeout);
      h.onOpen();
    };
    ws.onmessage = (e) => h.onMessage(String(e.data));
    ws.onclose = () => {
      clearTimeout(timeout);
      if (this.ws === ws) this.ws = null;
      h.onClose();
    };
    ws.onerror = () => {
      /* обработается в onclose */
    };
  }

  send(data: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
      return true;
    }
    return false;
  }

  close() {
    const ws = this.ws;
    this.ws = null;
    ws?.close();
  }

  isOpen() {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

/**
 * Серверная сторона «сокета» для ядра комнат, когда данные приходят не из WebSocket.
 * deliver() — передать ядру входящее сообщение, onSend — куда ядро отправляет ответы.
 */
export class VirtualSock implements Sock {
  readyState = 1;
  private msgHandlers: ((raw: unknown) => void)[] = [];
  private closeHandlers: (() => void)[] = [];
  constructor(private onSend: (data: string) => void, private onCloseReq?: () => void) {}

  send(data: string) {
    if (this.readyState === 1) this.onSend(data);
  }

  close() {
    if (this.readyState !== 1) return;
    this.readyState = 3;
    this.onCloseReq?.();
    this.closeHandlers.forEach((f) => f());
  }

  on(event: 'message' | 'close', cb: any) {
    if (event === 'message') this.msgHandlers.push(cb);
    else this.closeHandlers.push(cb);
  }

  deliver(data: string) {
    if (this.readyState === 1) this.msgHandlers.forEach((f) => f(data));
  }

  /** Соединение пропало со стороны устройства */
  drop() {
    if (this.readyState !== 1) return;
    this.readyState = 3;
    this.closeHandlers.forEach((f) => f());
  }
}

/** Локальная петля: клиент в браузере хозяина говорит с ядром комнат в том же браузере */
export class LoopTransport implements Transport {
  readonly kind = 'host' as const;
  private sock: VirtualSock | null = null;
  private h: TransportHandlers | null = null;
  constructor(private attach: (sock: VirtualSock) => void) {}

  open(h: TransportHandlers) {
    this.h = h;
    const sock = new VirtualSock(
      (data) => queueMicrotask(() => this.sock === sock && this.h?.onMessage(data)),
      () => queueMicrotask(() => this.sock === sock && this.h?.onClose()),
    );
    this.sock = sock;
    this.attach(sock);
    queueMicrotask(() => h.onOpen());
  }

  send(data: string) {
    const s = this.sock;
    if (!s || s.readyState !== 1) return false;
    queueMicrotask(() => s.deliver(data));
    return true;
  }

  close() {
    const s = this.sock;
    this.sock = null;
    s?.drop();
  }

  isOpen() {
    return !!this.sock && this.sock.readyState === 1;
  }
}
