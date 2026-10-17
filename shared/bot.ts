// Искусственный интеллект ботов. Боты видят то же состояние, что и игроки,
// и действуют только через обычные игровые действия.

import type { BotLevel, GameAction, GameState, PlayerState, TradeOffer } from './types';
import {
  canBuild,
  canMortgage,
  canSellBuilding,
  canSellProperty,
  canUnmortgage,
  cellAt,
  currentPlayer,
  groupCells,
  houseCostOf,
  jailFine,
  liquidationValue,
  mortgageValue,
  ownedCells,
  playerById,
  priceOf,
  rentOf,
  tradeValidity,
  unmortgageCost,
} from './engine';

export interface BotMemory {
  lastTradeTurn: Record<string, number>;
  rejected: Record<string, number>; // ключ «бот:цель:клетка» → ход
  tradesThisTurn: Record<string, number>;
}

export const newBotMemory = (): BotMemory => ({ lastTradeTurn: {}, rejected: {}, tradesThisTurn: {} });

const rnd = Math.random;

// ───────────────────────── Оценка имущества ─────────────────────────

/** Сколько клеток группы будет у игрока при гипотетическом изменении владения */
function groupCount(s: GameState, pid: string, group: number, gain: number[] = [], lose: number[] = []) {
  return groupCells(s, group).filter((j) => (s.props[j].owner === pid && !lose.includes(j)) || gain.includes(j)).length;
}

function typeCount(s: GameState, pid: string, type: string, gain: number[] = [], lose: number[] = []) {
  return Object.keys(s.props)
    .map(Number)
    .filter((j) => cellAt(s, j).type === type && ((s.props[j].owner === pid && !lose.includes(j)) || gain.includes(j))).length;
}

/** Ценность клетки для игрока (с учётом комплектов), если владение изменится так, как указано */
export function cellValue(s: GameState, pid: string, i: number, level: BotLevel, gain: number[] = [], lose: number[] = []): number {
  const c = cellAt(s, i);
  const base = priceOf(s, i);
  const ps = s.props[i];
  let v = ps?.mortgaged ? base * 0.65 : base;
  if (c.type === 'property') {
    const g = groupCells(s, c.group!);
    const k = groupCount(s, pid, c.group!, gain.includes(i) ? gain : [...gain, i], lose.filter((x) => x !== i));
    const n = g.length;
    const mono = level === 'hard' ? 2.7 : level === 'medium' ? 2.2 : 1.5;
    if (k >= n) v *= mono;
    else if (k === n - 1) v *= level === 'easy' ? 1.1 : 1.4;
    // Средние группы поля посещаются чаще (оранжевые, красные)
    if (level === 'hard') {
      const ratio = (c.group! + 0.5) / s.board.groups.length;
      if (ratio > 0.3 && ratio < 0.65) v *= 1.15;
    }
    v += (ps?.houses ?? 0) * houseCostOf(s, i) * 0.6;
  } else if (c.type === 'transport') {
    const k = typeCount(s, pid, 'transport', gain.includes(i) ? gain : [...gain, i], lose);
    v *= 1 + 0.3 * (k - 1);
  } else if (c.type === 'utility') {
    const k = typeCount(s, pid, 'utility', gain.includes(i) ? gain : [...gain, i], lose);
    v *= k >= 2 ? 1.3 : 0.85;
  }
  return v;
}

/** Блокирует ли покупка чужую монополию */
function blocksOpponent(s: GameState, pid: string, i: number) {
  const c = cellAt(s, i);
  if (c.type !== 'property') return false;
  const g = groupCells(s, c.group!).filter((j) => j !== i);
  const owners = new Set(g.map((j) => s.props[j].owner));
  return owners.size === 1 && !owners.has(null) && !owners.has(pid);
}

/** Резерв наличных: сколько бот старается держать на руках */
function reserve(s: GameState, p: PlayerState, level: BotLevel) {
  if (level === 'easy') return 40;
  // Самая высокая аренда у соперников
  let maxRent = 0;
  for (const k of Object.keys(s.props)) {
    const i = Number(k);
    const ps = s.props[i];
    if (ps.owner && ps.owner !== p.id && !ps.mortgaged) maxRent = Math.max(maxRent, rentOf(s, i, 7));
  }
  const base = level === 'hard' ? 120 : 150;
  return Math.min(level === 'hard' ? 900 : 700, Math.max(base, maxRent * (level === 'hard' ? 0.8 : 0.6)));
}

// ───────────────────────── Главная функция ─────────────────────────

/** Следующее действие бота или null, если сейчас ему делать нечего */
export function botDecide(s: GameState, pid: string, level: BotLevel, mem: BotMemory): GameAction | null {
  const p = playerById(s, pid);
  if (!p || p.bankrupt || s.phase === 'gameOver') return null;

  // Ответ на входящие предложения сделок
  const incoming = s.trades.find((t) => t.status === 'pending' && t.to === pid);
  if (incoming) return evaluateTrade(s, p, level, incoming) ? { type: 'acceptTrade', tradeId: incoming.id } : { type: 'rejectTrade', tradeId: incoming.id };

  if (s.phase === 'auction') return auctionDecision(s, p, level);

  if (s.phase === 'debt') {
    if (s.debt?.player !== pid) return null;
    return debtDecision(s, p, level);
  }

  if (currentPlayer(s).id !== pid) return null;

  switch (s.phase) {
    case 'roll': {
      if (p.inJail) {
        const j = jailDecision(s, p, level);
        if (j) return j;
      }
      const m = manageDecision(s, p, level, mem);
      if (m) return m;
      return { type: 'roll' };
    }
    case 'buy':
      return buyDecision(s, p, level) ? { type: 'buy' } : { type: 'decline' };
    case 'action': {
      const m = manageDecision(s, p, level, mem);
      if (m) return m;
      return { type: 'endTurn' };
    }
  }
  return null;
}

function buyDecision(s: GameState, p: PlayerState, level: BotLevel): boolean {
  const i = p.position;
  const price = priceOf(s, i);
  if (p.cash < price) return false;
  const left = p.cash - price;
  const value = cellValue(s, p.id, i, level);
  if (level === 'easy') return left >= 20 && rnd() < 0.85;
  const res = reserve(s, p, level);
  const completes = value >= price * 2;
  const blocks = blocksOpponent(s, p.id, i);
  if (completes) return left >= 0;
  if (level === 'hard') {
    if (blocks && left >= res * 0.3) return true;
    if (cellAt(s, i).type === 'utility' && left < res * 1.5) return false;
    return left >= res * 0.6 || (value > price * 1.3 && left >= res * 0.3);
  }
  return left >= res || (blocks && left >= res * 0.5);
}

function auctionDecision(s: GameState, p: PlayerState, level: BotLevel): GameAction | null {
  const au = s.auction!;
  if (!au.participants.includes(p.id)) return null;
  if (au.highBidder === p.id) return null;
  const i = au.cell;
  const price = priceOf(s, i);
  const value = cellValue(s, p.id, i, level);
  let max: number;
  if (level === 'easy') max = Math.min(p.cash - 30, price * (0.55 + rnd() * 0.45));
  else if (level === 'medium') max = Math.min(p.cash - reserve(s, p, level) * 0.5, value * 0.95);
  else {
    let v = value;
    if (blocksOpponent(s, p.id, i)) v = Math.max(v, price * 1.4);
    max = Math.min(p.cash - reserve(s, p, level) * 0.3, v * 1.05);
  }
  const next = au.highBid + (au.highBid < 100 ? 10 : au.highBid < 300 ? 20 : 50);
  if (next > max || next > p.cash) return { type: 'pass' };
  // Немного случайности, чтобы боты не перебивали друг друга мгновенно
  const jump = level === 'easy' ? next : Math.min(Math.floor(max), next + (rnd() < 0.3 ? 20 : 0));
  return { type: 'bid', amount: Math.max(next, Math.floor(jump / 5) * 5) };
}

function jailDecision(s: GameState, p: PlayerState, level: BotLevel): GameAction | null {
  const fine = jailFine(s);
  const unowned = Object.values(s.props).filter((x) => !x.owner).length / Math.max(1, Object.keys(s.props).length);
  if (level === 'easy') {
    if (p.jailFreeCards > 0 && rnd() < 0.6) return { type: 'useJailCard' };
    if (p.cash > fine + 250 && rnd() < 0.5) return { type: 'payJail' };
    return null;
  }
  // Поздняя игра: тюрьма — безопасное место, если у соперников много домов
  const dangerous = Object.values(s.props).some((x) => x.owner && x.owner !== p.id && x.houses >= 2);
  if (level === 'hard' && dangerous && unowned < 0.2) return null;
  if (p.jailFreeCards > 0) return { type: 'useJailCard' };
  if (p.cash >= fine + reserve(s, p, level) * 0.5 && (unowned > 0.25 || !dangerous)) return { type: 'payJail' };
  return null;
}

/** Строительство, выкуп, сделки — во время своего хода */
function manageDecision(s: GameState, p: PlayerState, level: BotLevel, mem: BotMemory): GameAction | null {
  const res = reserve(s, p, level);
  const mine = ownedCells(s, p.id);

  // Выкуп заложенного
  if (level !== 'easy' || rnd() < 0.3) {
    const mort = mine
      .filter((i) => s.props[i].mortgaged && !canUnmortgage(s, p.id, i))
      .sort((a, b) => cellValue(s, p.id, b, level) - cellValue(s, p.id, a, level));
    for (const i of mort) {
      if (p.cash - unmortgageCost(s, i) >= res * 1.6) return { type: 'unmortgage', cell: i };
    }
  }

  // Строительство
  const buildable = mine.filter((i) => !canBuild(s, p.id, i));
  if (buildable.length) {
    // Предпочитаем участки с меньшим числом домов; сложный бот — более доходные группы
    buildable.sort((a, b) => {
      const ha = s.props[a].houses;
      const hb = s.props[b].houses;
      if (ha !== hb) return ha - hb;
      return level === 'hard' ? rentGain(s, b) - rentGain(s, a) : houseCostOf(s, a) - houseCostOf(s, b);
    });
    const i = buildable[0];
    const cost = houseCostOf(s, i);
    const limit = level === 'easy' ? 250 + rnd() * 200 : level === 'medium' ? res : res * 0.8;
    // Отель сложный бот строит, только если денег с запасом
    const hotelPenalty = s.props[i].houses === 4 && level === 'hard' ? 150 : 0;
    if (p.cash - cost >= limit + hotelPenalty) return { type: 'build', cell: i };
  }

  // Сделки
  if (s.settings.rules.trading) {
    const t = proposeTradeDecision(s, p, level, mem);
    if (t) return t;
  }
  return null;
}

function rentGain(s: GameState, i: number) {
  const c = cellAt(s, i);
  const h = s.props[i].houses;
  if (!c.rent) return 0;
  return (c.rent[Math.min(5, h + 1)] - c.rent[Math.min(5, h)]) / houseCostOf(s, i);
}

function debtDecision(s: GameState, p: PlayerState, level: BotLevel): GameAction {
  const d = s.debt!;
  if (p.cash >= d.amount) return { type: 'payDebt' };
  if (liquidationValue(s, p.id) < d.amount) return { type: 'bankrupt' };
  const mine = ownedCells(s, p.id);
  // 1. Залог участков вне монополий (дешёвые первыми)
  const mortgageable = mine
    .filter((i) => !canMortgage(s, p.id, i))
    .sort((a, b) => cellValue(s, p.id, a, level) - cellValue(s, p.id, b, level));
  // Сначала то, что не входит в собранную группу
  const nonMono = mortgageable.filter((i) => cellValue(s, p.id, i, level) < priceOf(s, i) * 1.8);
  if (nonMono.length) return { type: 'mortgage', cell: nonMono[0] };
  // 2. Продажа построек
  const sellable = mine.filter((i) => !canSellBuilding(s, p.id, i)).sort((a, b) => houseCostOf(s, a) - houseCostOf(s, b));
  if (sellable.length) return { type: 'sellBuilding', cell: sellable[0] };
  if (mortgageable.length) return { type: 'mortgage', cell: mortgageable[0] };
  // 3. Продажа банку
  const toSell = mine.filter((i) => !canSellProperty(s, p.id, i));
  if (toSell.length) return { type: 'sellProperty', cell: toSell[0] };
  return { type: 'bankrupt' };
}

// ───────────────────────── Сделки ─────────────────────────

/** Оценка входящего предложения */
export function evaluateTrade(s: GameState, bot: PlayerState, level: BotLevel, t: TradeOffer): boolean {
  if (tradeValidity(s, t)) return false;
  const other = t.from;
  // Бот получает: t.giveMoney + t.giveCells; отдаёт: t.getMoney + t.getCells
  const gain = t.giveCells;
  const lose = t.getCells;
  let received = t.giveMoney;
  for (const i of gain) received += cellValue(s, bot.id, i, level, gain, lose);
  let given = t.getMoney;
  for (const i of lose) given += cellValue(s, bot.id, i, level);
  // Не отдаём сопернику монополию задёшево
  for (const i of lose) {
    const c = cellAt(s, i);
    if (c.type === 'property') {
      const n = groupCells(s, c.group!).length;
      if (groupCount(s, other, c.group!, lose, gain) >= n) {
        given += groupCells(s, c.group!).reduce((sum, j) => sum + priceOf(s, j), 0) * (level === 'hard' ? 1.6 : level === 'medium' ? 1.1 : 0.4);
      }
    }
  }
  if (bot.cash - t.getMoney < 0) return false;
  const threshold = level === 'easy' ? 0.85 + rnd() * 0.3 : level === 'medium' ? 1.1 : 1.25;
  return received >= given * threshold && received > 0;
}

function proposeTradeDecision(s: GameState, p: PlayerState, level: BotLevel, mem: BotMemory): GameAction | null {
  const turnKey = `${p.id}:${s.turn}`;
  if ((mem.tradesThisTurn[turnKey] ?? 0) >= 1) return null;
  const last = mem.lastTradeTurn[p.id] ?? -100;
  const gap = level === 'easy' ? 12 : level === 'medium' ? 5 : 3;
  if (s.turn - last < gap) return null;
  if (level === 'easy' && rnd() < 0.7) return null;
  if (s.trades.some((t) => t.status === 'pending' && t.from === p.id)) return null;

  const res = reserve(s, p, level);
  // Ищем группу, где не хватает одной клетки, принадлежащей сопернику
  for (let g = 0; g < s.board.groups.length; g++) {
    const cells = groupCells(s, g);
    if (!cells.length) continue;
    const mineCount = cells.filter((j) => s.props[j].owner === p.id).length;
    if (mineCount !== cells.length - 1) continue;
    const missing = cells.find((j) => s.props[j].owner !== p.id)!;
    const owner = s.props[missing].owner;
    if (!owner) continue;
    const target = playerById(s, owner);
    if (!target || target.bankrupt) continue;
    const key = `${p.id}:${owner}:${missing}`;
    if (s.turn - (mem.rejected[key] ?? -100) < 10) continue;
    if (cells.some((j) => s.props[j].houses > 0) || s.props[missing].houses > 0) continue;

    const price = priceOf(s, missing);
    const k = level === 'hard' ? 1.5 + rnd() * 0.5 : level === 'medium' ? 1.3 + rnd() * 0.3 : 1.1;
    let money = Math.round((price * k) / 10) * 10;
    const giveCells: number[] = [];
    const affordable = p.cash - res * 0.5;
    if (money > affordable) {
      // Добавляем «лишний» участок, который не нужен боту
      const spare = ownedCells(s, p.id).find((j) => {
        const c = cellAt(s, j);
        if (c.type !== 'property' || s.props[j].houses > 0 || s.props[j].mortgaged || c.group === g) return false;
        // Не отдаём то, что даст сопернику монополию
        return groupCount(s, owner, c.group!, [j]) < groupCells(s, c.group!).length && groupCount(s, p.id, c.group!) <= 1;
      });
      if (spare != null) {
        giveCells.push(spare);
        money = Math.max(0, money - priceOf(s, spare));
      }
      money = Math.min(money, Math.max(0, Math.floor(affordable / 10) * 10));
    }
    if (money <= 0 && !giveCells.length) continue;
    const action: GameAction = { type: 'proposeTrade', to: owner, giveMoney: money, giveCells, getMoney: 0, getCells: [missing] };
    if (tradeValidity(s, { from: p.id, to: owner, giveMoney: money, giveCells, getMoney: 0, getCells: [missing] })) continue;
    mem.lastTradeTurn[p.id] = s.turn;
    mem.tradesThisTurn[turnKey] = (mem.tradesThisTurn[turnKey] ?? 0) + 1;
    mem.rejected[key] = s.turn; // повторно спросим не раньше чем через 10 ходов
    return action;
  }
  return null;
}

/** Простая подстраховка: какое значение бот считает справедливой ценой (для подсказок интерфейсу) */
export function fairPrice(s: GameState, pid: string, i: number) {
  return Math.round(cellValue(s, pid, i, 'medium') / 10) * 10;
}

export { mortgageValue };
