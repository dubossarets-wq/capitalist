// Сквозной сетевой тест: настоящий сервер + несколько WebSocket-клиентов («телефонов»).
// Клиенты-люди принимают решения логикой ботов, но действуют через сеть, как живые игроки.
// Проверяется: лобби, синхронизация, дубли действий, ошибочные действия, обрыв и
// переподключение, автопилот по таймеру, сохранение и восстановление после перезапуска сервера.
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import type { ClientMsg, RoomView, ServerMsg } from '../shared/protocol';
import type { BotLevel, GameAction, GameSettings, GameState } from '../shared/types';
import { botDecide, newBotMemory } from '../shared/bot';
import { defaultSettings } from '../shared/settings';
import { decisionMaker, ownedCells, priceOf } from '../shared/engine';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8199;
const SAVE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'capitalist-test-'));
let server: ChildProcess | null = null;
const failures: string[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function check(cond: unknown, msg: string) {
  if (!cond) {
    failures.push(msg);
    console.log('   ✗ ' + msg);
  }
}

async function startServer() {
  const cli = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  server = spawn(process.execPath, [cli, 'server/index.ts'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), SAVE_DIR, SPEED: '0.01', TICK_MS: '4', DISCONNECT_GRACE_MS: '1500', TEST_SHUTDOWN: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr!.on('data', (d) => process.stderr.write('[server] ' + d));
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Сервер не запустился')), 20000);
    server!.stdout!.on('data', (d) => {
      if (String(d).includes('localhost:')) {
        clearTimeout(t);
        resolve();
      }
    });
  });
}

async function stopServer() {
  if (!server) return;
  const s = server;
  server = null;
  // Корректная остановка с сохранением (как Ctrl+C)
  await new Promise<void>((r) => {
    s.once('exit', () => r());
    // Корректная остановка с сохранением через служебный адрес
    fetch(`http://localhost:${PORT}/api/shutdown`).catch(() => s.kill());
    setTimeout(() => s.kill(), 5000);
  });
}

function stateHash(s: GameState) {
  return JSON.stringify({
    v: s.version,
    ph: s.phase,
    cur: s.current,
    pl: s.players.map((p) => [p.id, p.cash, p.position, p.bankrupt, p.inJail, p.jailFreeCards]),
    pr: s.props,
    tr: s.trades.map((t) => [t.id, t.status]),
    au: s.auction,
  });
}

interface Behaviour {
  level: BotLevel;
  dupRate: number; // доля повторно отправленных действий
  junkRate: number; // доля заведомо неверных действий
  idle?: boolean; // игрок «ушёл пить чай» и ничего не делает
  tradeRate?: number; // как часто сам предлагает сделки людям
}

class Client {
  ws: WebSocket | null = null;
  token = '';
  clientId = '';
  room: RoomView | null = null;
  state: GameState | null = null;
  firstState: GameState | null = null;
  errors: string[] = [];
  seen = new Map<number, string>();
  lastVersion = -1;
  outOfOrder = 0;
  pending: string | null = null;
  pendingSince = 0;
  actsSent = 0;
  dupsSent = 0;
  junkSent = 0;
  mem = newBotMemory();
  auto = false;
  seq = 0;
  private waiters: { pred: () => boolean; resolve: () => void }[] = [];

  constructor(public name: string, public beh: Behaviour) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
      this.ws = ws;
      ws.on('open', () => this.raw({ t: 'hello', token: this.token || undefined, profile: { name: this.name, token: 'pawn', color: '#FF4757', avatar: 'a1' } }));
      ws.on('message', (d) => this.onMsg(JSON.parse(String(d)) as ServerMsg, resolve));
      ws.on('error', reject);
      ws.on('close', () => {
        if (this.ws === ws) this.ws = null;
      });
    });
  }

  drop() {
    this.ws?.terminate();
    this.ws = null;
    this.lastVersion = -1; // после переподключения придёт свежий снимок
  }

  raw(m: ClientMsg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  waitFor(pred: () => boolean, ms = 15000, what = 'условие') {
    if (pred()) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const w = { pred, resolve };
      this.waiters.push(w);
      setTimeout(() => {
        const i = this.waiters.indexOf(w);
        if (i >= 0) {
          this.waiters.splice(i, 1);
          reject(new Error(`${this.name}: не дождались — ${what}`));
        }
      }, ms);
    });
  }

  private wake() {
    this.waiters = this.waiters.filter((w) => {
      if (w.pred()) {
        w.resolve();
        return false;
      }
      return true;
    });
  }

  private onMsg(m: ServerMsg, onWelcome: () => void) {
    switch (m.t) {
      case 'welcome':
        this.token = m.token;
        this.clientId = m.clientId;
        onWelcome();
        break;
      case 'room':
        this.room = m.room;
        break;
      case 'state': {
        const s = m.state;
        if (this.lastVersion >= 0 && s.version < this.lastVersion) this.outOfOrder++;
        this.lastVersion = s.version;
        this.state = s;
        if (!this.firstState) this.firstState = s;
        const h = stateHash(s);
        this.seen.set(s.version, h);
        validate(s, this.name);
        if (this.auto) this.think();
        break;
      }
      case 'actionResult':
        if (m.id === this.pending) this.pending = null;
        if (!m.ok && m.error) this.errors.push(m.error);
        if (this.auto) setTimeout(() => this.think(), 1);
        break;
      case 'error':
        this.errors.push(m.message);
        break;
    }
    this.wake();
  }

  act(a: GameAction) {
    const id = `${this.name}-${++this.seq}`;
    this.pending = id;
    this.pendingSince = Date.now();
    this.actsSent++;
    this.raw({ t: 'action', id, action: a });
    // Иногда то же действие уходит ещё раз (как при переотправке после обрыва)
    if (Math.random() < this.beh.dupRate) {
      this.dupsSent++;
      setTimeout(() => this.raw({ t: 'action', id, action: a }), Math.random() * 20);
    }
  }

  think() {
    const s = this.state;
    if (!s || s.phase === 'gameOver' || this.beh.idle) return;
    if (this.pending && Date.now() - this.pendingSince < 3000) return;
    const me = s.players.find((p) => p.id === this.clientId);
    if (!me || me.bankrupt) return;
    // Мусорные действия: не в свой ход, чужие сделки, покупки без повода
    if (Math.random() < this.beh.junkRate) {
      this.junkSent++;
      const junk: GameAction[] = [{ type: 'roll' }, { type: 'buy' }, { type: 'endTurn' }, { type: 'acceptTrade', tradeId: 'нет-такой' }, { type: 'build', cell: 1 }, { type: 'bid', amount: -5 }, { type: 'payDebt' }];
      this.raw({ t: 'action', id: `${this.name}-junk-${++this.seq}`, action: junk[Math.floor(Math.random() * junk.length)] });
    }
    // Иногда сами предлагаем сделку другому человеку
    if (this.beh.tradeRate && Math.random() < this.beh.tradeRate && s.settings.rules.trading && decisionMaker(s) === me.id && s.phase === 'action') {
      const others = s.players.filter((p) => !p.bankrupt && p.id !== me.id && !p.isBot);
      const target = others[Math.floor(Math.random() * others.length)];
      if (target && !s.trades.some((t) => t.status === 'pending' && t.from === me.id)) {
        const theirs = ownedCells(s, target.id).filter((i) => s.props[i].houses === 0);
        const mine = ownedCells(s, me.id).filter((i) => s.props[i].houses === 0);
        const getCells = theirs.length ? [theirs[Math.floor(Math.random() * theirs.length)]] : [];
        const giveCells = mine.length && Math.random() < 0.5 ? [mine[0]] : [];
        const giveMoney = getCells.length ? Math.min(me.cash, priceOf(s, getCells[0])) : Math.min(me.cash, 50);
        this.act({ type: 'proposeTrade', to: target.id, giveMoney, giveCells, getMoney: 0, getCells });
        return;
      }
    }
    const a = botDecide(s, this.clientId, this.beh.level, this.mem);
    if (!a) return;
    // Встречное предложение вместо простого отказа
    if (a.type === 'rejectTrade' && Math.random() < 0.3) {
      const t = s.trades.find((x) => x.id === a.tradeId)!;
      this.act({ type: 'proposeTrade', to: t.from, giveMoney: Math.floor(t.getMoney / 2), giveCells: [], getMoney: 0, getCells: t.giveCells.slice(0, 1), counterOf: t.id });
      return;
    }
    this.act(a);
  }
}

function validate(s: GameState, who: string) {
  for (const p of s.players) {
    if (p.cash < 0) check(false, `${who}: отрицательный баланс ${p.name} = ${p.cash}`);
  }
  for (const [k, ps] of Object.entries(s.props)) {
    if (ps.owner && !s.players.some((p) => p.id === ps.owner)) check(false, `${who}: владелец клетки ${k} не существует`);
    if (ps.owner && s.players.find((p) => p.id === ps.owner)?.bankrupt) check(false, `${who}: клетка ${k} принадлежит банкроту`);
  }
  if (s.decks.chance.length || s.rng) check(false, `${who}: сервер раскрыл скрытые данные (колоды/генератор)`);
}

function compareClients(clients: Client[], label: string) {
  let compared = 0;
  let mismatches = 0;
  for (let i = 0; i < clients.length; i++) {
    for (let j = i + 1; j < clients.length; j++) {
      for (const [v, h] of clients[i].seen) {
        const h2 = clients[j].seen.get(v);
        if (h2 === undefined) continue;
        compared++;
        if (h2 !== h) mismatches++;
      }
    }
  }
  check(mismatches === 0, `${label}: рассинхронизация в ${mismatches} версиях состояния`);
  const finals = clients.map((c) => (c.state ? stateHash(c.state) : 'нет'));
  check(new Set(finals).size === 1, `${label}: итоговые состояния у клиентов различаются`);
  return compared;
}

async function lobby(host: Client, guests: Client[], settings: GameSettings, bots: BotLevel[]) {
  host.raw({ t: 'createRoom', settings, profile: { name: host.name, token: 'car', color: '#FF4757', avatar: 'a2' } });
  await host.waitFor(() => !!host.room, 5000, 'создание комнаты');
  const code = host.room!.code;
  for (const g of guests) {
    g.raw({ t: 'joinRoom', code, profile: { name: g.name, token: 'car', color: '#FF4757', avatar: 'a3' } });
    await g.waitFor(() => g.room?.code === code, 5000, 'вход в комнату');
  }
  for (const lv of bots) host.raw({ t: 'addBot', level: lv });
  await host.waitFor(() => host.room!.seats.length === 1 + guests.length + bots.length, 5000, 'добавление ботов');
  const colors = new Set(host.room!.seats.map((s) => s.profile.color));
  const tokens = new Set(host.room!.seats.map((s) => s.profile.token));
  check(colors.size === host.room!.seats.length, 'лобби: цвета игроков не уникальны');
  check(tokens.size === host.room!.seats.length, 'лобби: фишки игроков не уникальны');
  return code;
}

async function startAndPlay(label: string, host: Client, guests: Client[], opts: { timeoutMs: number; during?: (all: Client[]) => Promise<void> }) {
  const all = [host, ...guests];
  // Старт до готовности гостей должен быть отклонён
  const errBefore = host.errors.length;
  host.raw({ t: 'startGame' });
  await sleep(150);
  if (guests.length) check(host.errors.length > errBefore && !host.state, `${label}: игра стартовала без готовности игроков`);
  for (const g of guests) g.raw({ t: 'ready', ready: true });
  await host.waitFor(() => host.room!.seats.every((s) => s.isBot || s.isHost || s.ready), 5000, 'готовность');
  all.forEach((c) => (c.auto = true));
  host.raw({ t: 'startGame' });
  await Promise.all(all.map((c) => c.waitFor(() => !!c.state, 5000, 'начало партии')));
  // Подталкиваем клиентов, если они ждут
  const nudge = setInterval(() => all.forEach((c) => c.think()), 50);
  if (opts.during) await opts.during(all);
  try {
    await Promise.all(all.map((c) => c.waitFor(() => c.state?.phase === 'gameOver', opts.timeoutMs, 'окончание партии')));
  } catch (e) {
    check(false, `${label}: ${(e as Error).message} (ход ${host.state?.turn}, фаза ${host.state?.phase})`);
  }
  clearInterval(nudge);
  await sleep(300);
  all.forEach((c) => (c.auto = false));
  const s = host.state!;
  const winner = s.players.find((p) => p.id === s.winner);
  const compared = compareClients(all, label);
  for (const c of all) check(c.outOfOrder === 0, `${label}: ${c.name} получил состояния не по порядку`);
  const errs = all.reduce((a, c) => a + c.errors.length, 0);
  const junk = all.reduce((a, c) => a + c.junkSent, 0);
  const dups = all.reduce((a, c) => a + c.dupsSent, 0);
  const acts = all.reduce((a, c) => a + c.actsSent, 0);
  console.log(
    `   ✓ ${label}: ${s.turn} ходов, ${s.round} кругов, победитель — ${winner?.name ?? 'нет'} (${winner?.isBot ? 'бот' : 'человек'}); ` +
      `действий людей ${acts}, дублей ${dups}, мусорных ${junk}, отказов сервера ${errs}; сверено версий ${compared}`,
  );
  check(!!winner, `${label}: нет победителя`);
  return s;
}

async function backToLobby(host: Client) {
  host.raw({ t: 'backToLobby' });
  await host.waitFor(() => host.room?.status === 'lobby', 5000, 'возврат в лобби');
  host.raw({ t: 'leaveRoom' });
  await host.waitFor(() => host.room === null, 5000, 'выход из комнаты');
}

async function main() {
  console.log('Запуск сервера…');
  await startServer();
  const t0 = Date.now();

  // ───── 1. Лобби: проверки правил комнаты ─────
  console.log('\n1. Лобби и синхронизация настроек');
  {
    const a = new Client('Аня', { level: 'medium', dupRate: 0, junkRate: 0 });
    const b = new Client('Боря', { level: 'medium', dupRate: 0, junkRate: 0 });
    const c = new Client('Вика', { level: 'medium', dupRate: 0, junkRate: 0 });
    await Promise.all([a.connect(), b.connect(), c.connect()]);
    const st = { ...defaultSettings(), maxPlayers: 3, roomName: 'Тест лобби' };
    await lobby(a, [b], st, []);
    // Гость видит изменение настроек сразу
    a.raw({ t: 'updateSettings', settings: { ...a.room!.settings, boardId: 'mega', theme: 'fairy', economy: { ...a.room!.settings.economy, startMoney: 3000 } } });
    await b.waitFor(() => b.room?.settings.boardId === 'mega' && b.room.settings.economy.startMoney === 3000, 3000, 'настройки у гостя');
    console.log('   ✓ гость сразу видит новые настройки хозяина');
    // Гость не может менять настройки
    const e0 = b.errors.length;
    b.raw({ t: 'updateSettings', settings: { ...b.room!.settings, boardId: 'express' } });
    await sleep(150);
    check(b.errors.length > e0 && a.room!.settings.boardId === 'mega', 'гость смог изменить настройки');
    // Занятый цвет
    const e1 = b.errors.length;
    b.raw({ t: 'updateProfile', profile: { ...b.room!.seats.find((s) => s.id === b.clientId)!.profile, color: a.room!.seats[0].profile.color } });
    await sleep(150);
    check(b.errors.length > e1, 'удалось занять чужой цвет');
    // Третий игрок заполняет комнату, бот не влезает
    c.raw({ t: 'joinRoom', code: a.room!.code, profile: { name: 'Вика', token: 'duck', color: '#2ED573', avatar: 'a4' } });
    await c.waitFor(() => !!c.room, 3000, 'вход третьего');
    const e2 = a.errors.length;
    a.raw({ t: 'addBot', level: 'hard' });
    await sleep(150);
    check(a.errors.length > e2, 'бот добавился сверх лимита мест');
    // Хозяин убирает игрока
    a.raw({ t: 'removeSeat', seatId: c.clientId });
    await c.waitFor(() => c.room === null, 3000, 'удаление игрока');
    // Неверный код
    const e3 = c.errors.length;
    c.raw({ t: 'joinRoom', code: 'ZZZZ', profile: { name: 'Вика', token: 'duck', color: '#2ED573', avatar: 'a4' } });
    await sleep(150);
    check(c.errors.length > e3, 'вход по неверному коду не отклонён');
    // Хозяин уходит — хозяином становится гость
    a.raw({ t: 'leaveRoom' });
    await b.waitFor(() => b.room?.hostId === b.clientId, 3000, 'передача прав хозяина');
    console.log('   ✓ права хозяина, лимит мест, занятые цвета, неверный код — работают');
    [a, b, c].forEach((x) => x.ws?.close());
  }

  // ───── 2. Три человека + два бота, обрыв и переподключение ─────
  console.log('\n2. Партия: 3 человека + 2 бота, обрывы связи, дубли и мусорные действия');
  {
    const h = new Client('Хозяин', { level: 'hard', dupRate: 0.15, junkRate: 0.05 });
    const g1 = new Client('Гость1', { level: 'medium', dupRate: 0.15, junkRate: 0.05, tradeRate: 0.05 });
    const g2 = new Client('Гость2', { level: 'easy', dupRate: 0.15, junkRate: 0.05, tradeRate: 0.05 });
    await Promise.all([h.connect(), g1.connect(), g2.connect()]);
    const st = { ...defaultSettings(), maxPlayers: 5, roomName: 'Партия 2', maxTurns: 40 };
    await lobby(h, [g1, g2], st, ['easy', 'hard']);
    await startAndPlay('партия 2', h, [g1, g2], {
      timeoutMs: 180000,
      during: async () => {
        // Гость1 теряет Wi-Fi на 0.5 с и возвращается (автопилот не успевает включиться)
        await sleep(800);
        g1.drop();
        await sleep(500);
        await g1.connect();
        await g1.waitFor(() => !!g1.state, 3000, 'снимок после переподключения');
        console.log('   ✓ Гость1 переподключился и получил актуальное состояние');
        // Гость2 пропадает надолго — за него ходит автопилот, потом он возвращается
        await sleep(500);
        g2.drop();
        await h.waitFor(() => !!h.state?.players.find((p) => p.id === g2.clientId)?.autopilot || h.state?.phase === 'gameOver', 8000, 'автопилот за отключившегося');
        console.log('   ✓ за отключившегося Гостя2 включился автопилот');
        await sleep(1000);
        await g2.connect();
        await h.waitFor(() => h.state?.players.find((p) => p.id === g2.clientId)?.autopilot === false || h.state?.phase === 'gameOver', 5000, 'возврат управления');
        console.log('   ✓ Гость2 вернулся, автопилот выключен');
      },
    });
    await backToLobby(h);
    [h, g1, g2].forEach((x) => x.ws?.close());
  }

  // ───── 3. Четыре человека, большое поле, активная торговля ─────
  console.log('\n3. Партия: 4 человека на поле «Мегаполис», активная торговля и встречные предложения');
  {
    const cs = ['П1', 'П2', 'П3', 'П4'].map((n, i) => new Client(n, { level: (['hard', 'medium', 'medium', 'easy'] as BotLevel[])[i], dupRate: 0.1, junkRate: 0.03, tradeRate: 0.15 }));
    await Promise.all(cs.map((c) => c.connect()));
    const st = { ...defaultSettings(), boardId: 'mega', maxPlayers: 4, roomName: 'Партия 3', maxTurns: 35, theme: 'city' as const };
    await lobby(cs[0], cs.slice(1), st, []);
    const s = await startAndPlay('партия 3', cs[0], cs.slice(1), { timeoutMs: 180000 });
    const trades = s.trades.filter((t) => t.status === 'accepted').length;
    const countered = s.trades.filter((t) => t.status === 'countered').length;
    console.log(`   ✓ сделок принято (в последних 40): ${trades}, встречных предложений: ${countered}`);
    await backToLobby(cs[0]);
    cs.forEach((x) => x.ws?.close());
  }

  // ───── 4. 8 участников, быстрая игра, таймер хода и «спящий» игрок ─────
  console.log('\n4. Партия: 2 человека + 6 ботов, «Экспресс», быстрая игра, таймер хода 1 с, один игрок бездействует');
  {
    const a = new Client('Активный', { level: 'medium', dupRate: 0.1, junkRate: 0.05 });
    const z = new Client('Соня', { level: 'medium', dupRate: 0, junkRate: 0, idle: true });
    await Promise.all([a.connect(), z.connect()]);
    const st = { ...defaultSettings(), boardId: 'express', maxPlayers: 8, roomName: 'Партия 4', quickGame: true, turnTimer: 1, maxTurns: 30 };
    await lobby(a, [z], st, ['easy', 'easy', 'medium', 'medium', 'hard', 'hard']);
    // «Соня» готовится вручную (idle-клиент сам ничего не делает)
    const s = await startAndPlay('партия 4', a, [z], { timeoutMs: 240000 });
    const sonya = s.players.find((p) => p.id === z.clientId)!;
    check(sonya.stats.laps > 0 || sonya.bankrupt, 'партия 4: за бездействующего игрока никто не ходил');
    console.log(`   ✓ за бездействующую Соню ходил автопилот по таймеру (кругов: ${sonya.stats.laps})`);
    await backToLobby(a);
    [a, z].forEach((x) => x.ws?.close());
  }

  // ───── 5. Перезапуск сервера посреди партии ─────
  console.log('\n5. Сохранение: сервер перезапускается посреди партии, игроки возвращаются');
  {
    const a = new Client('Первый', { level: 'hard', dupRate: 0.05, junkRate: 0 });
    const b = new Client('Второй', { level: 'medium', dupRate: 0.05, junkRate: 0 });
    await Promise.all([a.connect(), b.connect()]);
    const st = { ...defaultSettings(), maxPlayers: 3, roomName: 'Партия 5', maxTurns: 30 };
    await lobby(a, [b], st, ['medium']);
    let turnBefore = 0;
    let cashBefore = '';
    await startAndPlay('партия 5', a, [b], {
      timeoutMs: 180000,
      during: async (all) => {
        await a.waitFor(() => (a.state?.turn ?? 0) >= 12, 30000, '12-й ход');
        all.forEach((c) => (c.auto = false));
        await stopServer();
        await sleep(200);
        // Последнее полученное состояние совпадает с тем, что сервер сохранил при остановке
        turnBefore = a.state!.turn;
        cashBefore = JSON.stringify(a.state!.players.map((p) => p.cash));
        all.forEach((c) => c.drop());
        console.log(`   … сервер остановлен на ходу ${turnBefore}`);
        await startServer();
        all.forEach((c) => (c.seen.clear(), (c.state = null), (c.firstState = null)));
        await Promise.all(all.map((c) => c.connect()));
        await Promise.all(all.map((c) => c.waitFor(() => !!c.state, 5000, 'восстановленная партия')));
        const restored = a.firstState!;
        check(restored.turn === turnBefore, `партия 5: после перезапуска ход ${restored.turn}, ожидали ${turnBefore}`);
        const after = JSON.stringify(restored.players.map((p) => p.cash));
        const sameCash = after === cashBefore;
        check(sameCash, `партия 5: после перезапуска изменились балансы: было ${cashBefore}, стало ${after}`);
        if (sameCash && restored.turn === turnBefore) console.log(`   ✓ партия восстановлена с хода ${restored.turn}, балансы совпадают`);
        all.forEach((c) => (c.auto = true));
      },
    });
    [a, b].forEach((x) => x.ws?.close());
  }

  await stopServer();
  fs.rmSync(SAVE_DIR, { recursive: true, force: true });
  console.log(`\nВремя теста: ${((Date.now() - t0) / 1000).toFixed(1)} c`);
  if (failures.length) {
    console.log(`\nОШИБКИ (${failures.length}):`);
    failures.forEach((f) => console.log(' - ' + f));
    process.exit(1);
  }
  console.log('Все сетевые проверки пройдены.');
  process.exit(0);
}

main().catch(async (e) => {
  console.error('Тест упал:', e);
  await stopServer();
  process.exit(1);
});
