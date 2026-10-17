// Авторитетный игровой движок. Все деньги и права собственности считаются только здесь.
// Движок детерминирован: случайность берётся из генератора, состояние которого хранится в партии.

import type {
  ActionResult,
  BotLevel,
  CellDef,
  GameAction,
  GameEventInput,
  GameSettings,
  GameState,
  PlayerProfile,
  PlayerState,
  TradeOffer,
} from './types';
import { getBoard, isOwnable } from './boards';
import { CHANCE_CARDS, CHEST_CARDS, WHEEL_SECTORS, type CardEffect } from './cards';

export interface SeatInput {
  id: string;
  isBot: boolean;
  botLevel: BotLevel;
  profile: PlayerProfile;
}

let NOW = 0;

// ───────────────────────── Случайные числа ─────────────────────────

export function rand(s: GameState): number {
  let a = s.rng | 0;
  a = (a + 0x6d2b79f5) | 0;
  s.rng = a;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const randInt = (s: GameState, n: number) => Math.floor(rand(s) * n);
function shuffle<T>(s: GameState, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(s, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ───────────────────────── Длительность анимаций ─────────────────────────

let GLOBAL_SPEED = 1;
/** Общий множитель скорости (только для автотестов сервера) */
export function setGlobalSpeed(k: number) {
  GLOBAL_SPEED = k > 0 ? k : 1;
}

export function speedFactor(s: GameState) {
  return (s.settings.quickGame ? 0.6 : 1) * GLOBAL_SPEED;
}

export const STEP_MS = 260;

function eventDuration(ev: GameEventInput): number {
  switch (ev.type) {
    case 'order':
      return 3400;
    case 'turn':
      return 350;
    case 'dice':
      return 1700;
    case 'move':
      return ev.direct ? 900 : 350 + Math.abs(ev.steps) * STEP_MS;
    case 'money':
      return 250;
    case 'transfer':
      return 650;
    case 'buy':
      return 900;
    case 'build':
      return 600;
    case 'mortgage':
      return 400;
    case 'card':
      return 3200;
    case 'wheel':
      return 5600;
    case 'jail':
      return 1000;
    case 'auction':
      return ev.started ? 400 : 1300;
    case 'trade':
      return 1100;
    case 'bankrupt':
      return 2600;
    case 'jackpot':
      return 1500;
    default:
      return 0;
  }
}

function push(s: GameState, ev: GameEventInput) {
  const id = ++s.eventSeq;
  s.events.push({ ...(ev as any), id });
  if (s.events.length > 80) s.events.splice(0, s.events.length - 80);
  s.busyUntil = Math.max(s.busyUntil, NOW) + eventDuration(ev) * speedFactor(s);
}

function log(s: GameState, text: string, kind: GameState['log'][number]['kind'] = 'info', player?: string) {
  s.log.push({ t: NOW, turn: s.turn, text, player, kind });
  if (s.log.length > 250) s.log.splice(0, s.log.length - 250);
}

// ───────────────────────── Вспомогательные функции ─────────────────────────

export const cellsCount = (s: GameState) => s.board.cells.length;
export const cellAt = (s: GameState, i: number): CellDef => s.board.cells[i];
export const playerById = (s: GameState, id: string | null | undefined) => s.players.find((p) => p.id === id);
export const currentPlayer = (s: GameState) => s.players[s.current];
export const alivePlayers = (s: GameState) => s.players.filter((p) => !p.bankrupt);
export const jailIndex = (s: GameState) => {
  const i = s.board.cells.findIndex((c) => c.type === 'jail');
  return i < 0 ? Math.floor(cellsCount(s) / 4) : i;
};
const round10 = (v: number) => Math.max(10, Math.round(v / 10) * 10);
const round5 = (v: number) => Math.max(0, Math.round(v / 5) * 5);

export function priceOf(s: GameState, i: number) {
  const c = cellAt(s, i);
  return round10((c.price ?? 0) * s.settings.economy.priceMult);
}
export function houseCostOf(s: GameState, i: number) {
  const c = cellAt(s, i);
  return round10((c.houseCost ?? 100) * s.settings.economy.buildCostMult);
}
export function mortgageValue(s: GameState, i: number) {
  return round5(priceOf(s, i) * s.settings.economy.mortgageRate);
}
export function unmortgageCost(s: GameState, i: number) {
  return round5(mortgageValue(s, i) * (1 + s.settings.economy.unmortgageFee));
}
export function sellValue(s: GameState, i: number) {
  return round5(priceOf(s, i) * s.settings.economy.sellRate);
}
export function taxOf(s: GameState, c: CellDef) {
  return round5((c.amount ?? 0) * s.settings.economy.taxMult);
}
export function jailFine(s: GameState) {
  return s.settings.economy.jailFine;
}
export function goSalary(s: GameState) {
  return s.settings.rules.goSalaryEnabled ? s.settings.economy.goSalary : 0;
}

export function groupCells(s: GameState, group: number): number[] {
  const out: number[] = [];
  s.board.cells.forEach((c, i) => {
    if (c.type === 'property' && c.group === group) out.push(i);
  });
  return out;
}

export function ownsGroup(s: GameState, pid: string, group: number) {
  const g = groupCells(s, group);
  return g.length > 0 && g.every((i) => s.props[i]?.owner === pid);
}

export function groupHasBuildings(s: GameState, i: number) {
  const c = cellAt(s, i);
  if (c.type !== 'property') return false;
  return groupCells(s, c.group!).some((j) => s.props[j].houses > 0);
}

export function ownedCells(s: GameState, pid: string) {
  return Object.keys(s.props)
    .map(Number)
    .filter((i) => s.props[i].owner === pid)
    .sort((a, b) => a - b);
}

export function countOwnedOfType(s: GameState, pid: string, type: CellDef['type']) {
  return ownedCells(s, pid).filter((i) => cellAt(s, i).type === type).length;
}

/** Аренда клетки при текущем состоянии */
export function rentOf(s: GameState, i: number, diceTotal: number, opts: { doubleTransport?: boolean; utility10?: boolean } = {}) {
  const c = cellAt(s, i);
  const ps = s.props[i];
  if (!ps || !ps.owner || ps.mortgaged) return 0;
  const mult = s.settings.economy.rentMult;
  if (c.type === 'property') {
    const rent = c.rent ?? [0, 0, 0, 0, 0, 0];
    let r: number;
    if (ps.houses > 0) r = rent[Math.min(5, ps.houses)];
    else r = rent[0] * (ownsGroup(s, ps.owner, c.group!) ? 2 : 1);
    return round5(r * mult) || Math.max(1, Math.round(r * mult));
  }
  if (c.type === 'transport') {
    const n = countOwnedOfType(s, ps.owner, 'transport');
    let r = 25 * Math.pow(2, Math.max(0, n - 1));
    if (opts.doubleTransport) r *= 2;
    return round5(r * mult);
  }
  if (c.type === 'utility') {
    const n = countOwnedOfType(s, ps.owner, 'utility');
    const k = opts.utility10 || n >= 2 ? 10 : 4;
    return Math.round(k * diceTotal * mult);
  }
  return 0;
}

export function netWorth(s: GameState, pid: string) {
  const p = playerById(s, pid);
  if (!p || p.bankrupt) return 0;
  let w = p.cash;
  for (const i of ownedCells(s, pid)) {
    const ps = s.props[i];
    w += ps.mortgaged ? priceOf(s, i) - mortgageValue(s, i) : priceOf(s, i);
    w += ps.houses * houseCostOf(s, i);
  }
  return w;
}

/** Сколько денег игрок может собрать, продав всё (дома за полцены, залог участков) */
export function liquidationValue(s: GameState, pid: string) {
  const p = playerById(s, pid);
  if (!p) return 0;
  let v = p.cash;
  for (const i of ownedCells(s, pid)) {
    const ps = s.props[i];
    v += Math.floor((ps.houses * houseCostOf(s, i)) / 2);
    if (!ps.mortgaged) {
      if (s.settings.rules.mortgage) v += mortgageValue(s, i);
      else if (s.settings.rules.sellProperty) v += sellValue(s, i);
    }
  }
  return v;
}

const fmt = (n: number) => `$${n.toLocaleString('ru-RU')}`;
export const formatMoney = fmt;

// ───────────────────────── Создание партии ─────────────────────────

const emptyStats = () => ({
  rentPaid: 0,
  rentReceived: 0,
  propertiesBought: 0,
  housesBuilt: 0,
  tradesDone: 0,
  maxNetWorth: 0,
  laps: 0,
  jailVisits: 0,
});

export function createGame(settings: GameSettings, seats: SeatInput[], now: number, seed?: number, id?: string): GameState {
  NOW = now;
  const board = getBoard(settings.boardId, settings.customBoard);
  const s: GameState = {
    id: id ?? `g${now.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    version: 0,
    settings,
    board,
    players: seats.map((seat) => ({
      ...seat.profile,
      id: seat.id,
      isBot: seat.isBot,
      botLevel: seat.botLevel,
      cash: settings.economy.startMoney,
      position: 0,
      inJail: false,
      jailTurns: 0,
      jailFreeCards: 0,
      bankrupt: false,
      connected: true,
      autopilot: false,
      stats: emptyStats(),
    })),
    current: 0,
    phase: 'roll',
    turn: 1,
    round: 1,
    dice: null,
    doublesCount: 0,
    rolledThisTurn: false,
    extraRoll: false,
    props: {},
    decks: { chance: [], chest: [] },
    jackpot: 0,
    auction: null,
    trades: [],
    debt: null,
    log: [],
    events: [],
    eventSeq: 0,
    winner: null,
    startedAt: now,
    endsAt: settings.maxDuration > 0 ? now + settings.maxDuration * 60000 : 0,
    deadline: 0,
    busyUntil: now,
    rng: (seed ?? Math.floor(Math.random() * 2 ** 31)) | 0,
    tradeSeq: 0,
  };
  board.cells.forEach((c, i) => {
    if (isOwnable(c)) s.props[i] = { owner: null, houses: 0, mortgaged: false };
  });
  s.decks.chance = shuffle(s, CHANCE_CARDS.map((_, i) => i));
  s.decks.chest = shuffle(s, CHEST_CARDS.map((_, i) => i));

  // Очерёдность ходов
  if (settings.turnOrder === 'random') {
    const rolls = s.players.map((p) => ({ p, roll: 2 + randInt(s, 6) + randInt(s, 6), tie: rand(s) }));
    rolls.sort((a, b) => b.roll - a.roll || b.tie - a.tie);
    s.players = rolls.map((r) => r.p);
    push(s, { type: 'order', rolls: rolls.map((r) => ({ player: r.p.id, roll: r.roll })) });
    log(s, `Очерёдность определена броском кубиков: ${rolls.map((r) => `${r.p.name} (${r.roll})`).join(', ')}`);
  } else {
    push(s, { type: 'order', rolls: s.players.map((p) => ({ player: p.id, roll: 0 })) });
  }

  // Быстрая игра: каждому раздаются по 2 случайных участка
  if (settings.quickGame) {
    const free = shuffle(
      s,
      Object.keys(s.props)
        .map(Number)
        .filter((i) => cellAt(s, i).type === 'property'),
    );
    for (const p of s.players) {
      for (let k = 0; k < 2 && free.length; k++) {
        const i = free.pop()!;
        s.props[i].owner = p.id;
        p.stats.propertiesBought++;
      }
    }
    log(s, 'Быстрая игра: каждый игрок получил по 2 случайных участка');
  }

  log(s, `Партия началась! Поле «${board.name}», стартовый капитал ${fmt(settings.economy.startMoney)}`);
  beginTurn(s);
  updateStats(s);
  refreshDeadline(s); // таймер хода действует с самого первого хода
  return s;
}

// ───────────────────────── Ход ─────────────────────────

function beginTurn(s: GameState) {
  const p = currentPlayer(s);
  s.phase = 'roll';
  s.dice = null;
  s.doublesCount = 0;
  s.rolledThisTurn = false;
  s.extraRoll = false;
  push(s, { type: 'turn', player: p.id });
  log(s, `Ход игрока ${p.name}`, 'info', p.id);
}

function afterLanding(s: GameState) {
  if (s.phase === 'debt' || s.phase === 'buy' || s.phase === 'auction' || s.phase === 'gameOver') return;
  const p = currentPlayer(s);
  if (s.extraRoll && !p.inJail && !p.bankrupt) {
    s.phase = 'roll';
  } else {
    s.extraRoll = false;
    s.phase = 'action';
  }
}

function nextTurn(s: GameState) {
  s.auction = null;
  s.debt = null;
  if (checkGameEnd(s)) return;
  const n = s.players.length;
  let idx = s.current;
  for (let k = 0; k < n; k++) {
    idx = (idx + 1) % n;
    if (!s.players[idx].bankrupt) break;
  }
  // Переход через начало списка игроков — новый круг
  if (idx <= s.current) s.round++;
  s.current = idx;
  s.turn++;
  if (checkGameEnd(s)) return;
  beginTurn(s);
}

function checkGameEnd(s: GameState): boolean {
  if (s.phase === 'gameOver') return true;
  const alive = alivePlayers(s);
  let winner: PlayerState | undefined;
  let reason = '';
  if (alive.length <= 1) {
    winner = alive[0];
    reason = 'остался последним игроком';
  } else if (s.settings.winCondition === 'netWorth') {
    const rich = alive.find((p) => netWorth(s, p.id) >= s.settings.targetNetWorth);
    if (rich) {
      winner = rich;
      reason = `первым достиг капитала ${fmt(s.settings.targetNetWorth)}`;
    }
  }
  if (!winner && s.settings.maxTurns > 0 && s.round > s.settings.maxTurns) {
    winner = richest(s);
    reason = `самый богатый после ${s.settings.maxTurns} кругов`;
  }
  if (!winner && s.endsAt > 0 && NOW >= s.endsAt) {
    winner = richest(s);
    reason = 'самый богатый по истечении времени партии';
  }
  if (!winner && alive.length > 1) return false;
  s.phase = 'gameOver';
  s.winner = winner?.id ?? null;
  s.auction = null;
  s.debt = null;
  s.trades.forEach((t) => t.status === 'pending' && (t.status = 'cancelled'));
  push(s, { type: 'gameOver', winner: s.winner });
  log(s, winner ? `🏆 ${winner.name} побеждает — ${reason}!` : 'Игра окончена', 'win', winner?.id);
  updateStats(s);
  return true;
}

function richest(s: GameState) {
  return alivePlayers(s).sort((a, b) => netWorth(s, b.id) - netWorth(s, a.id))[0];
}

function updateStats(s: GameState) {
  for (const p of s.players) {
    if (!p.bankrupt) p.stats.maxNetWorth = Math.max(p.stats.maxNetWorth, netWorth(s, p.id));
  }
}

// ───────────────────────── Деньги ─────────────────────────

function gain(s: GameState, p: PlayerState, amount: number, reason: string) {
  if (amount <= 0) return;
  p.cash += amount;
  push(s, { type: 'money', player: p.id, delta: amount, reason });
}

/**
 * Платёж. Если наличных не хватает — игрок попадает в фазу долга.
 * Возвращает true, если оплачено сразу.
 */
function charge(
  s: GameState,
  p: PlayerState,
  amount: number,
  creditor: PlayerState | null,
  reason: string,
  extra: { split?: string[]; resumeMove?: number; rent?: boolean } = {},
): boolean {
  if (amount <= 0) return true;
  if (p.cash >= amount) {
    doPay(s, p, amount, creditor, reason, extra.split, extra.rent);
    return true;
  }
  s.debt = {
    player: p.id,
    amount,
    creditor: creditor?.id ?? null,
    reason,
    split: extra.split,
    resumeMove: extra.resumeMove,
    rent: extra.rent,
  };
  s.phase = 'debt';
  log(s, `${p.name} должен заплатить ${fmt(amount)} (${reason}), но наличных не хватает`, 'money', p.id);
  return false;
}

function doPay(s: GameState, p: PlayerState, amount: number, creditor: PlayerState | null, reason: string, split?: string[], rent?: boolean) {
  p.cash -= amount;
  if (split && split.length) {
    const each = Math.floor(amount / split.length);
    for (const id of split) {
      const r = playerById(s, id);
      if (r && !r.bankrupt) {
        r.cash += each;
        push(s, { type: 'transfer', from: p.id, to: r.id, amount: each, reason });
      }
    }
    log(s, `${p.name} платит ${fmt(each)} каждому игроку (${reason})`, 'money', p.id);
    return;
  }
  if (creditor) {
    creditor.cash += amount;
    if (rent) {
      p.stats.rentPaid += amount;
      creditor.stats.rentReceived += amount;
    }
    push(s, { type: 'transfer', from: p.id, to: creditor.id, amount, reason });
    log(s, `${p.name} платит ${fmt(amount)} игроку ${creditor.name} (${reason})`, 'money', p.id);
  } else {
    push(s, { type: 'money', player: p.id, delta: -amount, reason });
    log(s, `${p.name} платит ${fmt(amount)} (${reason})`, 'money', p.id);
    if (s.settings.rules.bonuses && /налог|штраф|сбор/i.test(reason)) s.jackpot += amount;
  }
}

// ───────────────────────── Перемещение ─────────────────────────

function moveSteps(s: GameState, p: PlayerState, steps: number, ctx: LandCtx) {
  const n = cellsCount(s);
  const from = p.position;
  const to = (((from + steps) % n) + n) % n;
  p.position = to;
  push(s, { type: 'move', player: p.id, from, to, steps, direct: false });
  if (steps > 0 && from + steps >= n) passStart(s, p, to === 0);
  land(s, p, ctx);
}

function moveToCell(s: GameState, p: PlayerState, target: number, ctx: LandCtx, collect = true) {
  const n = cellsCount(s);
  const steps = (target - p.position + n) % n;
  if (steps === 0) {
    land(s, p, ctx);
    return;
  }
  if (!collect) {
    const from = p.position;
    p.position = target;
    push(s, { type: 'move', player: p.id, from, to: target, steps, direct: true });
    land(s, p, ctx);
    return;
  }
  moveSteps(s, p, steps, ctx);
}

function passStart(s: GameState, p: PlayerState, exact: boolean) {
  p.stats.laps++;
  const sal = goSalary(s);
  if (sal <= 0) return;
  const amount = exact && s.settings.rules.bonuses ? sal * 2 : sal;
  gain(s, p, amount, exact && s.settings.rules.bonuses ? 'Точно на СТАРТ — двойная зарплата' : 'Проход через СТАРТ');
  log(s, `${p.name} получает ${fmt(amount)} за ${exact ? 'остановку на' : 'проход'} СТАРТ`, 'money', p.id);
}

function sendToJail(s: GameState, p: PlayerState) {
  const from = p.position;
  const j = jailIndex(s);
  p.position = j;
  p.inJail = true;
  p.jailTurns = 0;
  p.stats.jailVisits++;
  s.extraRoll = false;
  s.doublesCount = 0;
  push(s, { type: 'move', player: p.id, from, to: j, steps: 0, direct: true });
  push(s, { type: 'jail', player: p.id, enter: true });
  log(s, `${p.name} отправляется в тюрьму!`, 'jail', p.id);
}

interface LandCtx {
  dice: number;
  depth: number;
  doubleTransport?: boolean;
  utility10?: boolean;
}

function land(s: GameState, p: PlayerState, ctx: LandCtx) {
  if (ctx.depth > 4) return;
  const i = p.position;
  const c = cellAt(s, i);
  const r = s.settings.rules;
  switch (c.type) {
    case 'property':
    case 'transport':
    case 'utility': {
      const ps = s.props[i];
      if (!ps.owner) {
        s.phase = 'buy';
        return;
      }
      if (ps.owner === p.id) return;
      const owner = playerById(s, ps.owner)!;
      if (ps.mortgaged) {
        log(s, `${c.name} заложен — аренда не взимается`, 'info', p.id);
        return;
      }
      if (owner.inJail && !r.rentInJail) {
        log(s, `${owner.name} в тюрьме и не собирает аренду`, 'info', p.id);
        return;
      }
      const rent = rentOf(s, i, ctx.dice, { doubleTransport: ctx.doubleTransport, utility10: ctx.utility10 });
      charge(s, p, rent, owner, `аренда «${c.name}»`, { rent: true });
      return;
    }
    case 'tax': {
      if (c.extraTax && !r.extraTaxes) return;
      charge(s, p, taxOf(s, c), null, /налог/i.test(c.name) ? c.name : `налог: ${c.name}`);
      return;
    }
    case 'chance':
    case 'chest': {
      if (!r.cards) return;
      drawCard(s, p, c.type, ctx);
      return;
    }
    case 'wheel': {
      if (!r.wheel || !r.specialCells) return;
      const sector = randInt(s, WHEEL_SECTORS.length);
      const w = WHEEL_SECTORS[sector];
      push(s, { type: 'wheel', player: p.id, sector, text: w.text });
      log(s, `${p.name} крутит колесо фортуны: ${w.text}`, 'card', p.id);
      applyEffect(s, p, w.effect, ctx, 'колесо фортуны');
      return;
    }
    case 'gotojail': {
      if (!r.jail) return;
      sendToJail(s, p);
      return;
    }
    case 'parking': {
      if (r.bonuses && r.specialCells && s.jackpot > 0) {
        const amount = s.jackpot;
        s.jackpot = 0;
        p.cash += amount;
        push(s, { type: 'jackpot', player: p.id, amount });
        log(s, `${p.name} срывает джекпот отпуска: ${fmt(amount)}!`, 'money', p.id);
      }
      return;
    }
    default:
      return;
  }
}

function drawCard(s: GameState, p: PlayerState, deck: 'chance' | 'chest', ctx: LandCtx) {
  const cards = deck === 'chance' ? CHANCE_CARDS : CHEST_CARDS;
  let pile = s.decks[deck];
  if (!pile.length) pile = s.decks[deck] = shuffle(s, cards.map((_, i) => i));
  const idx = pile.shift()!;
  pile.push(idx);
  const card = cards[idx];
  push(s, { type: 'card', player: p.id, deck, title: card.title, text: card.text });
  log(s, `${p.name} тянет карту «${deck === 'chance' ? 'Шанс' : 'Казна'}»: ${card.text}`, 'card', p.id);
  applyEffect(s, p, card.effect, ctx, deck === 'chance' ? 'карта «Шанс»' : 'карта «Казна»');
}

function applyEffect(s: GameState, p: PlayerState, e: CardEffect, ctx: LandCtx, source: string) {
  const n = cellsCount(s);
  const sub: LandCtx = { dice: ctx.dice, depth: ctx.depth + 1 };
  switch (e.kind) {
    case 'money':
      if (e.amount > 0) gain(s, p, e.amount, source);
      else charge(s, p, -e.amount, null, `штраф: ${source}`);
      return;
    case 'moveTo': {
      let target = 0;
      if (e.target === 'start') target = 0;
      else if (e.target === 'jail') {
        if (s.settings.rules.jail) sendToJail(s, p);
        return;
      } else if (e.target === 'lastProp') {
        target = lastIndexOf(s, (c) => c.type === 'property');
      } else if (e.target === 'firstTransport') {
        target = s.board.cells.findIndex((c) => c.type === 'transport');
      } else if (e.target === 'parking') {
        target = s.board.cells.findIndex((c) => c.type === 'parking');
      }
      if (target < 0) return;
      moveToCell(s, p, target, sub);
      return;
    }
    case 'moveRel': {
      moveSteps(s, p, e.steps, sub);
      return;
    }
    case 'nearest': {
      const type = e.what;
      let target = -1;
      for (let k = 1; k <= n; k++) {
        const j = (p.position + k) % n;
        if (cellAt(s, j).type === type) {
          target = j;
          break;
        }
      }
      if (target < 0) return;
      moveToCell(s, p, target, { ...sub, doubleTransport: type === 'transport', utility10: type === 'utility' });
      return;
    }
    case 'goJail':
      if (s.settings.rules.jail) sendToJail(s, p);
      return;
    case 'jailFree':
      p.jailFreeCards++;
      return;
    case 'repairs': {
      let total = 0;
      for (const i of ownedCells(s, p.id)) {
        const h = s.props[i].houses;
        total += h === 5 ? e.hotel : h * e.house;
      }
      if (total > 0) charge(s, p, total, null, `сбор: ${source}`);
      else log(s, `${p.name}: построек нет — платить не нужно`, 'info', p.id);
      return;
    }
    case 'payEach': {
      const others = alivePlayers(s).filter((o) => o.id !== p.id);
      if (!others.length) return;
      charge(s, p, e.amount * others.length, null, source, { split: others.map((o) => o.id) });
      return;
    }
    case 'collectEach': {
      for (const o of alivePlayers(s)) {
        if (o.id === p.id) continue;
        const amt = Math.min(o.cash, e.amount);
        if (amt > 0) {
          o.cash -= amt;
          p.cash += amt;
          push(s, { type: 'transfer', from: o.id, to: p.id, amount: amt, reason: source });
        }
      }
      log(s, `${p.name} получает по ${fmt(e.amount)} от каждого игрока`, 'money', p.id);
      return;
    }
    case 'jackpot':
    case 'nothing':
      return;
  }
}

function lastIndexOf(s: GameState, pred: (c: CellDef) => boolean) {
  for (let i = s.board.cells.length - 1; i >= 0; i--) if (pred(s.board.cells[i])) return i;
  return -1;
}

// ───────────────────────── Проверки доступности действий ─────────────────────────

export function canBuild(s: GameState, pid: string, i: number): string | null {
  const r = s.settings.rules;
  if (!r.houses) return 'Строительство отключено правилами';
  const c = cellAt(s, i);
  const ps = s.props[i];
  if (!c || c.type !== 'property' || !ps) return 'Здесь нельзя строить';
  if (ps.owner !== pid) return 'Это не ваш участок';
  if (!ownsGroup(s, pid, c.group!)) return 'Нужно собрать всю цветовую группу';
  const g = groupCells(s, c.group!);
  if (g.some((j) => s.props[j].mortgaged)) return 'В группе есть заложенные участки';
  const maxH = r.hotels ? 5 : 4;
  if (ps.houses >= maxH) return r.hotels ? 'Отель уже построен' : 'Отели отключены правилами';
  if (r.evenBuild) {
    const min = Math.min(...g.map((j) => s.props[j].houses));
    if (ps.houses > min) return 'Стройте равномерно по всей группе';
  }
  const p = playerById(s, pid)!;
  if (p.cash < houseCostOf(s, i)) return 'Недостаточно денег';
  return null;
}

export function canSellBuilding(s: GameState, pid: string, i: number): string | null {
  const c = cellAt(s, i);
  const ps = s.props[i];
  if (!ps || c.type !== 'property') return 'Нет построек';
  if (ps.owner !== pid) return 'Это не ваш участок';
  if (ps.houses <= 0) return 'Нет построек';
  if (s.settings.rules.evenBuild) {
    const g = groupCells(s, c.group!);
    const max = Math.max(...g.map((j) => s.props[j].houses));
    if (ps.houses < max) return 'Продавайте равномерно по всей группе';
  }
  return null;
}

export function canMortgage(s: GameState, pid: string, i: number): string | null {
  if (!s.settings.rules.mortgage) return 'Залог отключён правилами';
  const ps = s.props[i];
  if (!ps || ps.owner !== pid) return 'Это не ваш участок';
  if (ps.mortgaged) return 'Уже заложен';
  if (groupHasBuildings(s, i)) return 'Сначала продайте постройки в группе';
  return null;
}

export function canUnmortgage(s: GameState, pid: string, i: number): string | null {
  if (!s.settings.rules.unmortgage) return 'Выкуп отключён правилами';
  const ps = s.props[i];
  if (!ps || ps.owner !== pid) return 'Это не ваш участок';
  if (!ps.mortgaged) return 'Участок не заложен';
  const p = playerById(s, pid)!;
  if (p.cash < unmortgageCost(s, i)) return 'Недостаточно денег';
  return null;
}

export function canSellProperty(s: GameState, pid: string, i: number): string | null {
  if (!s.settings.rules.sellProperty) return 'Продажа банку отключена правилами';
  const ps = s.props[i];
  if (!ps || ps.owner !== pid) return 'Это не ваш участок';
  if (ps.mortgaged) return 'Сначала выкупите участок';
  if (groupHasBuildings(s, i)) return 'Сначала продайте постройки в группе';
  return null;
}

/** Может ли игрок сейчас управлять имуществом (строить, закладывать, продавать) */
export function canManage(s: GameState, pid: string): boolean {
  if (s.phase === 'gameOver' || s.phase === 'auction') return false;
  const p = playerById(s, pid);
  if (!p || p.bankrupt) return false;
  if (s.phase === 'debt') return s.debt?.player === pid;
  return currentPlayer(s).id === pid;
}

export function tradeValidity(s: GameState, t: Pick<TradeOffer, 'from' | 'to' | 'giveMoney' | 'giveCells' | 'getMoney' | 'getCells'>): string | null {
  if (!s.settings.rules.trading) return 'Торговля отключена правилами';
  const a = playerById(s, t.from);
  const b = playerById(s, t.to);
  if (!a || !b || a.bankrupt || b.bankrupt) return 'Игрок недоступен';
  if (a.id === b.id) return 'Нельзя торговать с собой';
  if (t.giveMoney < 0 || t.getMoney < 0 || !Number.isFinite(t.giveMoney) || !Number.isFinite(t.getMoney)) return 'Неверная сумма';
  if (t.giveMoney > a.cash) return `${a.name}: недостаточно денег`;
  if (t.getMoney > b.cash) return `${b.name}: недостаточно денег`;
  if (!t.giveMoney && !t.getMoney && !t.giveCells.length && !t.getCells.length) return 'Сделка пустая';
  for (const i of t.giveCells) {
    if (s.props[i]?.owner !== a.id) return 'Участок больше не принадлежит игроку';
    if (groupHasBuildings(s, i)) return `«${cellAt(s, i).name}»: сначала продайте постройки в группе`;
  }
  for (const i of t.getCells) {
    if (s.props[i]?.owner !== b.id) return 'Участок больше не принадлежит игроку';
    if (groupHasBuildings(s, i)) return `«${cellAt(s, i).name}»: сначала продайте постройки в группе`;
  }
  return null;
}

/** Кто сейчас должен принять решение (для ботов и таймеров) */
export function decisionMaker(s: GameState): string | null {
  switch (s.phase) {
    case 'roll':
    case 'buy':
    case 'action':
      return currentPlayer(s).id;
    case 'debt':
      return s.debt?.player ?? null;
    default:
      return null;
  }
}

// ───────────────────────── Применение действий ─────────────────────────

export function applyAction(s: GameState, pid: string, a: GameAction, now: number): ActionResult {
  NOW = now;
  const res = applyInner(s, pid, a);
  if (res.ok) {
    s.version++;
    updateStats(s);
    refreshDeadline(s);
  }
  return res;
}

let lastDeadlineKey = new WeakMap<GameState, string>();
function refreshDeadline(s: GameState) {
  const key = `${s.phase}:${s.current}:${s.turn}:${s.debt?.player ?? ''}`;
  if (lastDeadlineKey.get(s) === key && s.deadline) return;
  lastDeadlineKey.set(s, key);
  if (s.settings.turnTimer > 0 && decisionMaker(s)) {
    s.deadline = Math.max(NOW, s.busyUntil) + s.settings.turnTimer * 1000;
  } else s.deadline = 0;
}

function fail(error: string): ActionResult {
  return { ok: false, error };
}

function applyInner(s: GameState, pid: string, a: GameAction): ActionResult {
  const p = playerById(s, pid);
  if (!p) return fail('Игрок не найден');
  if (s.phase === 'gameOver') return fail('Игра окончена');
  if (p.bankrupt) return fail('Вы обанкротились');
  const isCurrent = currentPlayer(s).id === pid;
  const r = s.settings.rules;

  switch (a.type) {
    case 'ackOrder':
      return { ok: true };

    case 'roll': {
      if (!isCurrent || s.phase !== 'roll') return fail('Сейчас нельзя бросать кубики');
      const d1 = 1 + randInt(s, 6);
      const d2 = 1 + randInt(s, 6);
      const total = d1 + d2;
      const doubles = d1 === d2;
      s.dice = [d1, d2];
      s.rolledThisTurn = true;
      push(s, { type: 'dice', player: p.id, d1, d2 });
      log(s, `${p.name} выбрасывает ${d1} и ${d2}${doubles ? ' — дубль!' : ''}`, 'info', p.id);
      const ctx: LandCtx = { dice: total, depth: 0 };

      if (p.inJail) {
        if (doubles) {
          p.inJail = false;
          p.jailTurns = 0;
          s.extraRoll = false;
          push(s, { type: 'jail', player: p.id, enter: false });
          log(s, `${p.name} выбрасывает дубль и выходит из тюрьмы`, 'jail', p.id);
          moveSteps(s, p, total, ctx);
          afterLanding(s);
          return { ok: true };
        }
        p.jailTurns++;
        if (p.jailTurns >= 3) {
          p.inJail = false;
          p.jailTurns = 0;
          push(s, { type: 'jail', player: p.id, enter: false });
          log(s, `${p.name} отсидел 3 хода и обязан заплатить штраф ${fmt(jailFine(s))}`, 'jail', p.id);
          s.extraRoll = false;
          if (!charge(s, p, jailFine(s), null, 'штраф за выход из тюрьмы', { resumeMove: total })) return { ok: true };
          moveSteps(s, p, total, ctx);
          afterLanding(s);
          return { ok: true };
        }
        log(s, `${p.name} остаётся в тюрьме (попытка ${p.jailTurns} из 3)`, 'jail', p.id);
        s.phase = 'action';
        return { ok: true };
      }

      if (doubles) {
        s.doublesCount++;
        if (s.doublesCount >= 3 && r.jail) {
          log(s, `${p.name} выбрасывает третий дубль подряд!`, 'jail', p.id);
          sendToJail(s, p);
          s.phase = 'action';
          return { ok: true };
        }
      }
      s.extraRoll = doubles && r.doubleExtraRoll;
      moveSteps(s, p, total, ctx);
      afterLanding(s);
      return { ok: true };
    }

    case 'buy': {
      if (!isCurrent || s.phase !== 'buy') return fail('Сейчас нельзя купить');
      const i = p.position;
      const ps = s.props[i];
      if (!ps || ps.owner) return fail('Участок нельзя купить');
      const price = priceOf(s, i);
      if (p.cash < price) return fail('Недостаточно денег');
      p.cash -= price;
      ps.owner = p.id;
      p.stats.propertiesBought++;
      push(s, { type: 'buy', player: p.id, cell: i, price });
      log(s, `${p.name} покупает «${cellAt(s, i).name}» за ${fmt(price)}`, 'buy', p.id);
      s.phase = 'action';
      afterLanding(s);
      return { ok: true };
    }

    case 'decline': {
      if (!isCurrent || s.phase !== 'buy') return fail('Нечего отклонять');
      const i = p.position;
      if (r.auctions && alivePlayers(s).length > 1) {
        startAuction(s, i, p.id);
      } else {
        log(s, `${p.name} отказывается от покупки «${cellAt(s, i).name}»`, 'info', p.id);
        s.phase = 'action';
        afterLanding(s);
      }
      return { ok: true };
    }

    case 'bid': {
      const au = s.auction;
      if (s.phase !== 'auction' || !au) return fail('Аукцион не идёт');
      if (!au.participants.includes(pid)) return fail('Вы вышли из аукциона');
      const amount = Math.floor(a.amount);
      if (!(amount > au.highBid)) return fail('Ставка должна быть выше текущей');
      if (amount > p.cash) return fail('Недостаточно денег');
      au.highBid = amount;
      au.highBidder = pid;
      au.endsAt = Math.max(au.endsAt, NOW + 6000 * speedFactor(s));
      log(s, `${p.name} ставит ${fmt(amount)}`, 'buy', p.id);
      checkAuctionEnd(s);
      return { ok: true };
    }

    case 'pass': {
      const au = s.auction;
      if (s.phase !== 'auction' || !au) return fail('Аукцион не идёт');
      if (!au.participants.includes(pid)) return fail('Вы уже вышли из аукциона');
      if (au.highBidder === pid) return fail('Ваша ставка лидирует');
      au.participants = au.participants.filter((x) => x !== pid);
      log(s, `${p.name} выходит из аукциона`, 'info', p.id);
      checkAuctionEnd(s);
      return { ok: true };
    }

    case 'build': {
      if (!canManage(s, pid) || s.phase === 'debt') return fail('Строить можно только в свой ход');
      const err = canBuild(s, pid, a.cell);
      if (err) return fail(err);
      const cost = houseCostOf(s, a.cell);
      const ps = s.props[a.cell];
      p.cash -= cost;
      ps.houses++;
      p.stats.housesBuilt++;
      push(s, { type: 'build', player: pid, cell: a.cell, houses: ps.houses, sold: false });
      log(s, `${p.name} строит ${ps.houses === 5 ? 'отель' : 'дом'} на «${cellAt(s, a.cell).name}» за ${fmt(cost)}`, 'build', pid);
      return { ok: true };
    }

    case 'sellBuilding': {
      if (!canManage(s, pid)) return fail('Сейчас нельзя продавать');
      const err = canSellBuilding(s, pid, a.cell);
      if (err) return fail(err);
      const ps = s.props[a.cell];
      const refund = Math.floor(houseCostOf(s, a.cell) / 2);
      const wasHotel = ps.houses === 5;
      ps.houses--;
      p.cash += refund;
      push(s, { type: 'build', player: pid, cell: a.cell, houses: ps.houses, sold: true });
      log(s, `${p.name} продаёт ${wasHotel ? 'отель' : 'дом'} на «${cellAt(s, a.cell).name}» за ${fmt(refund)}`, 'build', pid);
      return { ok: true };
    }

    case 'mortgage': {
      if (!canManage(s, pid)) return fail('Сейчас нельзя закладывать');
      const err = canMortgage(s, pid, a.cell);
      if (err) return fail(err);
      const v = mortgageValue(s, a.cell);
      s.props[a.cell].mortgaged = true;
      p.cash += v;
      push(s, { type: 'mortgage', player: pid, cell: a.cell, mortgaged: true });
      log(s, `${p.name} закладывает «${cellAt(s, a.cell).name}» и получает ${fmt(v)}`, 'money', pid);
      return { ok: true };
    }

    case 'unmortgage': {
      if (!canManage(s, pid) || s.phase === 'debt') return fail('Выкупать можно только в свой ход');
      const err = canUnmortgage(s, pid, a.cell);
      if (err) return fail(err);
      const v = unmortgageCost(s, a.cell);
      s.props[a.cell].mortgaged = false;
      p.cash -= v;
      push(s, { type: 'mortgage', player: pid, cell: a.cell, mortgaged: false });
      log(s, `${p.name} выкупает «${cellAt(s, a.cell).name}» за ${fmt(v)}`, 'money', pid);
      return { ok: true };
    }

    case 'sellProperty': {
      if (!canManage(s, pid)) return fail('Сейчас нельзя продавать');
      const err = canSellProperty(s, pid, a.cell);
      if (err) return fail(err);
      const v = sellValue(s, a.cell);
      s.props[a.cell].owner = null;
      p.cash += v;
      cancelTradesWithCell(s, a.cell);
      push(s, { type: 'owner', cell: a.cell, owner: null });
      push(s, { type: 'money', player: pid, delta: v, reason: 'продажа банку' });
      log(s, `${p.name} продаёт «${cellAt(s, a.cell).name}» банку за ${fmt(v)}`, 'money', pid);
      return { ok: true };
    }

    case 'payJail': {
      if (!isCurrent || s.phase !== 'roll' || !p.inJail) return fail('Вы не в тюрьме');
      const fine = jailFine(s);
      if (p.cash < fine) return fail('Недостаточно денег');
      doPay(s, p, fine, null, 'штраф за выход из тюрьмы');
      p.inJail = false;
      p.jailTurns = 0;
      push(s, { type: 'jail', player: p.id, enter: false });
      log(s, `${p.name} платит штраф и выходит из тюрьмы`, 'jail', p.id);
      return { ok: true };
    }

    case 'useJailCard': {
      if (!isCurrent || s.phase !== 'roll' || !p.inJail) return fail('Вы не в тюрьме');
      if (p.jailFreeCards <= 0) return fail('Нет карты освобождения');
      p.jailFreeCards--;
      p.inJail = false;
      p.jailTurns = 0;
      push(s, { type: 'jail', player: p.id, enter: false });
      log(s, `${p.name} использует карту освобождения из тюрьмы`, 'jail', p.id);
      return { ok: true };
    }

    case 'payDebt': {
      const d = s.debt;
      if (s.phase !== 'debt' || !d || d.player !== pid) return fail('Долгов нет');
      if (p.cash < d.amount) return fail('Недостаточно денег — заложите или продайте имущество');
      const creditor = d.creditor ? playerById(s, d.creditor) ?? null : null;
      doPay(s, p, d.amount, creditor, d.reason, d.split, d.rent);
      s.debt = null;
      s.phase = 'action';
      if (d.resumeMove) {
        moveSteps(s, p, d.resumeMove, { dice: d.resumeMove, depth: 0 });
      }
      afterLanding(s);
      return { ok: true };
    }

    case 'bankrupt': {
      const inDebt = s.phase === 'debt' && s.debt?.player === pid;
      declareBankrupt(s, p, inDebt ? s.debt!.creditor : null);
      return { ok: true };
    }

    case 'endTurn': {
      if (!isCurrent) return fail('Сейчас не ваш ход');
      if (s.phase !== 'action') return fail(s.phase === 'roll' ? 'Сначала бросьте кубики' : 'Сначала завершите текущее действие');
      nextTurn(s);
      return { ok: true };
    }

    case 'proposeTrade': {
      const t = {
        from: pid,
        to: a.to,
        giveMoney: Math.floor(a.giveMoney || 0),
        giveCells: [...new Set((a.giveCells || []).map(Number))],
        getMoney: Math.floor(a.getMoney || 0),
        getCells: [...new Set((a.getCells || []).map(Number))],
      };
      const err = tradeValidity(s, t);
      if (err) return fail(err);
      const outgoing = s.trades.filter((x) => x.status === 'pending' && x.from === pid).length;
      if (outgoing >= 3) return fail('Слишком много активных предложений');
      if (a.counterOf) {
        const orig = s.trades.find((x) => x.id === a.counterOf);
        if (orig && orig.status === 'pending' && orig.to === pid) orig.status = 'countered';
      }
      const offer: TradeOffer = {
        id: `t${++s.tradeSeq}`,
        ...t,
        status: 'pending',
        createdAt: NOW,
        counterOf: a.counterOf,
      };
      s.trades.push(offer);
      if (s.trades.length > 40) s.trades.splice(0, s.trades.length - 40);
      log(s, `${p.name} предлагает сделку игроку ${playerById(s, a.to)!.name}`, 'trade', pid);
      return { ok: true };
    }

    case 'acceptTrade': {
      const t = s.trades.find((x) => x.id === a.tradeId);
      if (!t || t.status !== 'pending') return fail('Предложение уже неактуально');
      if (t.to !== pid) return fail('Это предложение не вам');
      const err = tradeValidity(s, t);
      if (err) {
        t.status = 'failed';
        log(s, `Сделка сорвалась: ${err}`, 'trade');
        return { ok: true };
      }
      executeTrade(s, t);
      return { ok: true };
    }

    case 'rejectTrade': {
      const t = s.trades.find((x) => x.id === a.tradeId);
      if (!t || t.status !== 'pending' || t.to !== pid) return fail('Предложение неактуально');
      t.status = 'rejected';
      push(s, { type: 'trade', tradeId: t.id, accepted: false, from: t.from, to: t.to });
      log(s, `${p.name} отклоняет сделку`, 'trade', pid);
      return { ok: true };
    }

    case 'cancelTrade': {
      const t = s.trades.find((x) => x.id === a.tradeId);
      if (!t || t.status !== 'pending' || t.from !== pid) return fail('Предложение неактуально');
      t.status = 'cancelled';
      return { ok: true };
    }
  }
  return fail('Неизвестное действие');
}

function executeTrade(s: GameState, t: TradeOffer) {
  const a = playerById(s, t.from)!;
  const b = playerById(s, t.to)!;
  a.cash -= t.giveMoney;
  b.cash += t.giveMoney;
  b.cash -= t.getMoney;
  a.cash += t.getMoney;
  for (const i of t.giveCells) {
    s.props[i].owner = b.id;
    push(s, { type: 'owner', cell: i, owner: b.id });
  }
  for (const i of t.getCells) {
    s.props[i].owner = a.id;
    push(s, { type: 'owner', cell: i, owner: a.id });
  }
  t.status = 'accepted';
  a.stats.tradesDone++;
  b.stats.tradesDone++;
  push(s, { type: 'trade', tradeId: t.id, accepted: true, from: a.id, to: b.id });
  const desc = (money: number, cells: number[]) =>
    [money ? fmt(money) : '', ...cells.map((i) => `«${cellAt(s, i).name}»`)].filter(Boolean).join(', ') || 'ничего';
  log(s, `Сделка: ${a.name} отдаёт ${desc(t.giveMoney, t.giveCells)} — ${b.name} отдаёт ${desc(t.getMoney, t.getCells)}`, 'trade', a.id);
  // Остальные предложения с этими участками становятся неактуальными
  for (const i of [...t.giveCells, ...t.getCells]) cancelTradesWithCell(s, i);
}

function cancelTradesWithCell(s: GameState, cell: number) {
  for (const o of s.trades) {
    if (o.status === 'pending' && (o.giveCells.includes(cell) || o.getCells.includes(cell))) {
      if (tradeValidity(s, o)) o.status = 'failed';
    }
  }
}

// ───────────────────────── Аукцион ─────────────────────────

function startAuction(s: GameState, cell: number, starter: string) {
  s.phase = 'auction';
  s.auction = {
    cell,
    highBid: 0,
    highBidder: null,
    participants: alivePlayers(s).map((x) => x.id),
    endsAt: Math.max(NOW, s.busyUntil) + 12000 * speedFactor(s),
    starter,
  };
  push(s, { type: 'auction', cell, winner: null, price: 0, started: true });
  log(s, `Аукцион за «${cellAt(s, cell).name}» начался`, 'buy');
}

function checkAuctionEnd(s: GameState, timeUp = false) {
  const au = s.auction;
  if (!au) return;
  const others = au.participants.filter((x) => x !== au.highBidder);
  const done = timeUp || (au.highBidder ? others.length === 0 : au.participants.length === 0);
  if (!done) return;
  const cellName = cellAt(s, au.cell).name;
  if (au.highBidder) {
    const w = playerById(s, au.highBidder)!;
    if (w.cash >= au.highBid && !w.bankrupt) {
      w.cash -= au.highBid;
      s.props[au.cell].owner = w.id;
      w.stats.propertiesBought++;
      push(s, { type: 'auction', cell: au.cell, winner: w.id, price: au.highBid, started: false });
      log(s, `${w.name} выигрывает аукцион: «${cellName}» за ${fmt(au.highBid)}`, 'buy', w.id);
    }
  } else {
    push(s, { type: 'auction', cell: au.cell, winner: null, price: 0, started: false });
    log(s, `Никто не купил «${cellName}» — участок остаётся у банка`, 'info');
  }
  s.auction = null;
  s.phase = 'action';
  afterLanding(s);
}

// ───────────────────────── Банкротство ─────────────────────────

function declareBankrupt(s: GameState, p: PlayerState, creditorId: string | null) {
  const creditor = creditorId ? playerById(s, creditorId) : undefined;
  const wasCurrent = currentPlayer(s).id === p.id;
  // Постройки продаются банку за полцены
  for (const i of ownedCells(s, p.id)) {
    const ps = s.props[i];
    if (ps.houses > 0) {
      p.cash += Math.floor((ps.houses * houseCostOf(s, i)) / 2);
      ps.houses = 0;
      push(s, { type: 'build', player: p.id, cell: i, houses: 0, sold: true });
    }
  }
  if (creditor && !creditor.bankrupt) {
    if (p.cash > 0) {
      creditor.cash += p.cash;
      push(s, { type: 'transfer', from: p.id, to: creditor.id, amount: p.cash, reason: 'имущество банкрота' });
    }
    for (const i of ownedCells(s, p.id)) {
      s.props[i].owner = creditor.id;
      push(s, { type: 'owner', cell: i, owner: creditor.id });
    }
    creditor.jailFreeCards += p.jailFreeCards;
  } else {
    for (const i of ownedCells(s, p.id)) {
      s.props[i] = { owner: null, houses: 0, mortgaged: false };
      push(s, { type: 'owner', cell: i, owner: null });
    }
  }
  p.cash = 0;
  p.jailFreeCards = 0;
  p.bankrupt = true;
  p.inJail = false;
  s.trades.forEach((t) => {
    if (t.status === 'pending' && (t.from === p.id || t.to === p.id)) t.status = 'cancelled';
  });
  push(s, { type: 'bankrupt', player: p.id, creditor: creditor?.id ?? null });
  log(s, `💥 ${p.name} — банкрот!${creditor ? ` Всё имущество переходит игроку ${creditor.name}` : ' Имущество возвращается банку'}`, 'bankrupt', p.id);

  if (s.debt?.player === p.id) s.debt = null;
  if (s.auction) {
    s.auction.participants = s.auction.participants.filter((x) => x !== p.id);
    if (s.auction.highBidder === p.id) {
      s.auction.highBidder = null;
      s.auction.highBid = 0;
    }
  }
  if (checkGameEnd(s)) return;
  if (wasCurrent) {
    nextTurn(s);
  } else if (s.phase === 'debt' && !s.debt) {
    s.phase = 'action';
    afterLanding(s);
  } else if (s.auction) {
    checkAuctionEnd(s);
  }
}

// ───────────────────────── Таймеры ─────────────────────────

/** Обработка таймеров: окончание аукциона, лимит времени партии. Возвращает true при изменении. */
export function tick(s: GameState, now: number): boolean {
  NOW = now;
  if (s.phase === 'gameOver') return false;
  let changed = false;
  if (s.phase === 'auction' && s.auction && now >= s.auction.endsAt) {
    checkAuctionEnd(s, true);
    changed = true;
  }
  // Принудительное завершение партии, если время давно вышло
  if (s.endsAt > 0 && now >= s.endsAt + 90000 && s.phase !== 'auction') {
    changed = checkGameEnd(s) || changed;
  }
  // Таймер включён, а срок решения не назначен (например, после загрузки) — назначаем
  if (!changed && s.settings.turnTimer > 0 && !s.deadline && decisionMaker(s)) refreshDeadline(s);
  if (changed) {
    s.version++;
    refreshDeadline(s);
  }
  return changed;
}

/** Для сервера: убрать скрытую информацию (порядок колод и состояние генератора) */
export function publicState(s: GameState): GameState {
  return { ...s, decks: { chance: [], chest: [] }, rng: 0 };
}

export function setPlayerConnected(s: GameState, pid: string, connected: boolean) {
  const p = playerById(s, pid);
  if (!p) return;
  p.connected = connected;
  if (connected) p.autopilot = false;
  s.version++;
}
