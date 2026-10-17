// Действия игры по Wi-Fi. Онлайн-версия (сайт) работает без сервера на компьютере:
// хозяин — этот браузер, гости — через WebRTC. Версия с локального сервера — через WebSocket.
import { net } from './netClient';
import { store, lsGet, lsSet } from '../store';
import { STATIC_SITE } from './staticMode';
import { getHost, stopHost, P2PHost, P2PGuestTransport, RtcGuestTransport, unpack, isOfflineCode } from './p2p';

const GUEST_KEY = 'capitalist.p2pguest.v1';

/** Без сервера на компьютере: хозяин — браузер */
export const P2P = STATIC_SITE;

function defaultRoomSettings() {
  return { ...store().setupSettings, roomName: `Комната ${store().profile.name}` };
}

export async function createWifiRoom() {
  if (!P2P) {
    net.useServer();
    await net.connect();
    net.createRoom(defaultRoomSettings());
    return;
  }
  stopHost(true);
  lsSet(GUEST_KEY, '');
  net.use('host', () => getHost().transport());
  await net.connect();
  net.createRoom(defaultRoomSettings());
}

export async function joinByCode(code: string) {
  const c = code.trim().toUpperCase();
  if (!P2P) {
    net.useServer();
    await net.connect();
    net.joinRoom(c);
    return;
  }
  net.use('guest', () => new P2PGuestTransport(c));
  lsSet(GUEST_KEY, c);
  // Запрос входа уйдёт сразу после приветствия и повторится, если связь пересоздастся
  net.joinRoom(c);
  await net.connect();
}

/** Подключение без интернета по QR-коду хозяина; onAnswer — ответный код, который нужно показать хозяину */
export async function joinOffline(text: string, onAnswer: (code: string) => void) {
  const data = await unpack(text);
  if (data.k !== 'O') throw new Error('Это не QR-код хозяина комнаты');
  const t = new RtcGuestTransport(data, onAnswer);
  net.use('guest', () => t);
  lsSet(GUEST_KEY, '');
  if (data.c) net.joinRoom(data.c);
  await net.connect();
}

/** Что делать с отсканированным QR-кодом: ссылка с кодом комнаты или код для подключения без интернета */
export function parseScanned(text: string): { kind: 'code'; code: string } | { kind: 'offline'; text: string } | null {
  const t = text.trim();
  if (isOfflineCode(t)) return { kind: 'offline', text: t };
  const m = t.match(/[?&]room=([A-Za-z0-9]{4})/);
  if (m) return { kind: 'code', code: m[1].toUpperCase() };
  if (/^[A-Za-z0-9]{4}$/.test(t)) return { kind: 'code', code: t.toUpperCase() };
  return null;
}

export function leaveWifi() {
  net.send({ t: 'leaveRoom' });
  if (net.mode === 'host') {
    setTimeout(() => {
      net.disconnect();
      stopHost(true);
    }, 200);
  } else if (P2P) {
    lsSet(GUEST_KEY, '');
    setTimeout(() => net.disconnect(), 200);
  }
}

/** После перезагрузки страницы вернуться в свою комнату (хозяином или гостем) */
export function resumeWifi() {
  if (!P2P) {
    try {
      if (localStorage.getItem('capitalist.token.v1')) net.connect().catch(() => {});
    } catch {
      /* нет доступа */
    }
    return;
  }
  if (P2PHost.hasSaved()) {
    net.use('host', () => getHost().transport());
    net.connect().catch(() => {});
    return;
  }
  const code = lsGet<string>(GUEST_KEY, '');
  if (code) {
    net.use('guest', () => new P2PGuestTransport(code));
    net.connect().catch(() => lsSet(GUEST_KEY, ''));
  }
}

export function isHosting() {
  return net.mode === 'host';
}
