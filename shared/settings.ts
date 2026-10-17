import type { GameSettings, RuleSet, Economy, BoardDef } from './types';
import { BOARDS, validateBoard } from './boards';

export const PLAYER_COLORS = [
  '#FF4757', // красный
  '#1E90FF', // синий
  '#2ED573', // зелёный
  '#FFA502', // оранжевый
  '#A55EEA', // фиолетовый
  '#00D2D3', // бирюзовый
  '#FF6B9D', // розовый
  '#F1C40F', // жёлтый
];

export interface TokenInfo {
  id: string;
  name: string;
  set: string;
}

export const TOKEN_SETS = ['Классика', 'Космос', 'Сокровища', 'Зверята'];

export const TOKENS: TokenInfo[] = [
  { id: 'pawn', name: 'Пешка', set: 'Классика' },
  { id: 'tophat', name: 'Цилиндр', set: 'Классика' },
  { id: 'car', name: 'Автомобиль', set: 'Классика' },
  { id: 'boat', name: 'Кораблик', set: 'Классика' },
  { id: 'rocket', name: 'Ракета', set: 'Космос' },
  { id: 'ufo', name: 'НЛО', set: 'Космос' },
  { id: 'robot', name: 'Робот', set: 'Космос' },
  { id: 'planet', name: 'Планета', set: 'Космос' },
  { id: 'crown', name: 'Корона', set: 'Сокровища' },
  { id: 'diamond', name: 'Бриллиант', set: 'Сокровища' },
  { id: 'trophy', name: 'Кубок', set: 'Сокровища' },
  { id: 'moneybag', name: 'Мешок денег', set: 'Сокровища' },
  { id: 'penguin', name: 'Пингвин', set: 'Зверята' },
  { id: 'duck', name: 'Утёнок', set: 'Зверята' },
  { id: 'bear', name: 'Мишка', set: 'Зверята' },
  { id: 'frog', name: 'Лягушонок', set: 'Зверята' },
];

export const AVATARS = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10', 'a11', 'a12'];

export const BOT_NAMES = [
  'Бот Борис', 'Бот Вера', 'Бот Гоша', 'Бот Дина', 'Бот Жора', 'Бот Зоя', 'Бот Кеша', 'Бот Лиза',
  'Бот Макс', 'Бот Нина', 'Бот Олег', 'Бот Рита',
];

export const DEFAULT_RULES: RuleSet = {
  auctions: true,
  trading: true,
  sellProperty: true,
  mortgage: true,
  unmortgage: true,
  houses: true,
  hotels: true,
  goSalaryEnabled: true,
  extraTaxes: true,
  specialCells: true,
  cards: true,
  wheel: true,
  jail: true,
  doubleExtraRoll: true,
  bonuses: true,
  evenBuild: true,
  rentInJail: true,
};

export const DEFAULT_ECONOMY: Economy = {
  startMoney: 1500,
  goSalary: 200,
  priceMult: 1,
  rentMult: 1,
  taxMult: 1,
  buildCostMult: 1,
  jailFine: 50,
  mortgageRate: 0.5,
  unmortgageFee: 0.1,
  sellRate: 0.5,
};

export function defaultSettings(): GameSettings {
  return {
    roomName: 'Комната друзей',
    maxPlayers: 4,
    boardId: 'world',
    theme: 'classic',
    diceStyle: 'classic',
    turnOrder: 'random',
    turnTimer: 0,
    maxDuration: 0,
    maxTurns: 0,
    winCondition: 'lastStanding',
    targetNetWorth: 5000,
    quickGame: false,
    rules: { ...DEFAULT_RULES },
    economy: { ...DEFAULT_ECONOMY },
    customBoard: null,
  };
}

const clamp = (v: unknown, min: number, max: number, def: number) => {
  const n = typeof v === 'number' && isFinite(v) ? v : def;
  return Math.min(max, Math.max(min, n));
};

/** Приводит присланные настройки к безопасным значениям (на сервере это обязательно) */
export function sanitizeSettings(input: Partial<GameSettings> | undefined): GameSettings {
  const d = defaultSettings();
  const s = input ?? {};
  const rules: RuleSet = { ...d.rules };
  for (const k of Object.keys(rules) as (keyof RuleSet)[]) {
    if (s.rules && typeof s.rules[k] === 'boolean') rules[k] = s.rules[k] as boolean;
  }
  const e = s.economy ?? ({} as Partial<Economy>);
  const economy: Economy = {
    startMoney: Math.round(clamp(e.startMoney, 200, 20000, d.economy.startMoney)),
    goSalary: Math.round(clamp(e.goSalary, 0, 2000, d.economy.goSalary)),
    priceMult: clamp(e.priceMult, 0.25, 4, 1),
    rentMult: clamp(e.rentMult, 0.25, 5, 1),
    taxMult: clamp(e.taxMult, 0, 5, 1),
    buildCostMult: clamp(e.buildCostMult, 0.25, 4, 1),
    jailFine: Math.round(clamp(e.jailFine, 0, 1000, 50)),
    mortgageRate: clamp(e.mortgageRate, 0.1, 1, 0.5),
    unmortgageFee: clamp(e.unmortgageFee, 0, 1, 0.1),
    sellRate: clamp(e.sellRate, 0.1, 1, 0.5),
  };
  let customBoard: BoardDef | null = null;
  if (s.customBoard && typeof s.customBoard === 'object') {
    try {
      const cb = JSON.parse(JSON.stringify(s.customBoard)) as BoardDef;
      if (Array.isArray(cb.cells) && Array.isArray(cb.groups) && !validateBoard(cb)) {
        cb.id = 'custom';
        cb.name = String(cb.name || 'Моё поле').slice(0, 40);
        cb.cells = cb.cells.map((c) => ({ ...c, name: String(c.name ?? '').slice(0, 28) }));
        customBoard = cb;
      }
    } catch {
      customBoard = null;
    }
  }
  const boardIds = [...BOARDS.map((b) => b.id), ...(customBoard ? ['custom'] : [])];
  return {
    roomName: String(s.roomName ?? d.roomName).slice(0, 32) || d.roomName,
    maxPlayers: Math.round(clamp(s.maxPlayers, 2, 8, d.maxPlayers)),
    boardId: boardIds.includes(s.boardId as string) ? (s.boardId as string) : 'world',
    theme: (['classic', 'city', 'fairy'] as const).includes(s.theme as any) ? (s.theme as any) : 'classic',
    diceStyle: (['classic', 'ruby', 'gold', 'neon', 'wood', 'candy'] as const).includes(s.diceStyle as any)
      ? (s.diceStyle as any)
      : 'classic',
    turnOrder: s.turnOrder === 'fixed' ? 'fixed' : 'random',
    turnTimer: Math.round(clamp(s.turnTimer, 0, 300, 0)),
    maxDuration: Math.round(clamp(s.maxDuration, 0, 600, 0)),
    maxTurns: Math.round(clamp(s.maxTurns, 0, 500, 0)),
    winCondition: s.winCondition === 'netWorth' ? 'netWorth' : 'lastStanding',
    targetNetWorth: Math.round(clamp(s.targetNetWorth, 1000, 100000, 5000)),
    quickGame: !!s.quickGame,
    rules,
    economy,
    customBoard,
  };
}

export const SETTINGS_PRESETS: { id: string; name: string; apply: (s: GameSettings) => GameSettings }[] = [
  {
    id: 'classic',
    name: 'Классика',
    apply: (s) => ({ ...s, quickGame: false, rules: { ...DEFAULT_RULES }, economy: { ...DEFAULT_ECONOMY }, maxTurns: 0 }),
  },
  {
    id: 'quick',
    name: 'Быстрая',
    apply: (s) => ({
      ...s,
      quickGame: true,
      maxDuration: 30,
      economy: { ...DEFAULT_ECONOMY, rentMult: 1.5, goSalary: 300 },
    }),
  },
  {
    id: 'rich',
    name: 'Богачи',
    apply: (s) => ({ ...s, economy: { ...DEFAULT_ECONOMY, startMoney: 3000, goSalary: 400, rentMult: 1.5 } }),
  },
  {
    id: 'hardcore',
    name: 'Жёсткая',
    apply: (s) => ({
      ...s,
      rules: { ...DEFAULT_RULES, unmortgage: true, bonuses: false },
      economy: { ...DEFAULT_ECONOMY, startMoney: 1000, rentMult: 1.5, taxMult: 1.5, goSalary: 150 },
    }),
  },
];
