// Общие типы игрового движка. Используются и сервером, и клиентом.

export type BotLevel = 'easy' | 'medium' | 'hard';

export type CellType =
  | 'start'
  | 'property'
  | 'transport'
  | 'utility'
  | 'tax'
  | 'chance'
  | 'chest'
  | 'jail'
  | 'gotojail'
  | 'parking'
  | 'wheel'
  | 'rest';

export interface CellDef {
  type: CellType;
  name: string;
  /** Цветовая группа (только для property) */
  group?: number;
  price?: number;
  /** Аренда: [база, 1 дом, 2, 3, 4, отель] */
  rent?: number[];
  houseCost?: number;
  /** Для налога — сумма */
  amount?: number;
  /** Подвид иконки (самолёт, лампочка, капля и т.п.) */
  icon?: string;
  /** Налог на роскошь (дополнительный налог, отключается правилом) */
  extraTax?: boolean;
}

export interface GroupDef {
  name: string;
  color: string;
}

export interface BoardDef {
  id: string;
  name: string;
  description: string;
  cells: CellDef[];
  groups: GroupDef[];
}

export type WinCondition = 'lastStanding' | 'netWorth';

export interface RuleSet {
  auctions: boolean;
  trading: boolean;
  sellProperty: boolean;
  mortgage: boolean;
  unmortgage: boolean;
  houses: boolean;
  hotels: boolean;
  goSalaryEnabled: boolean;
  extraTaxes: boolean;
  specialCells: boolean;
  cards: boolean;
  wheel: boolean;
  jail: boolean;
  doubleExtraRoll: boolean;
  bonuses: boolean;
  evenBuild: boolean;
  rentInJail: boolean;
}

export interface Economy {
  startMoney: number;
  goSalary: number;
  priceMult: number;
  rentMult: number;
  taxMult: number;
  buildCostMult: number;
  jailFine: number;
  mortgageRate: number; // доля цены при залоге
  unmortgageFee: number; // надбавка при выкупе (0.1 = 10%)
  sellRate: number; // доля цены при продаже банку
}

export interface GameSettings {
  roomName: string;
  maxPlayers: number;
  boardId: string;
  theme: ThemeId;
  diceStyle: DiceStyleId;
  turnOrder: 'random' | 'fixed';
  turnTimer: number; // секунд, 0 — без ограничения
  maxDuration: number; // минут, 0 — без ограничения
  maxTurns: number; // кругов, 0 — без ограничения
  winCondition: WinCondition;
  targetNetWorth: number;
  quickGame: boolean;
  rules: RuleSet;
  economy: Economy;
  customBoard?: BoardDef | null;
}

export type ThemeId = 'classic' | 'city' | 'fairy';
export type DiceStyleId = 'classic' | 'ruby' | 'gold' | 'neon' | 'wood' | 'candy';

export interface PlayerProfile {
  name: string;
  token: string; // id фишки
  color: string;
  avatar: string; // id аватара
}

export interface PlayerState extends PlayerProfile {
  id: string;
  isBot: boolean;
  botLevel: BotLevel;
  cash: number;
  position: number;
  inJail: boolean;
  jailTurns: number;
  jailFreeCards: number;
  bankrupt: boolean;
  connected: boolean;
  /** Временное управление ботом (игрок отключился или не успел) */
  autopilot: boolean;
  stats: PlayerStats;
}

export interface PlayerStats {
  rentPaid: number;
  rentReceived: number;
  propertiesBought: number;
  housesBuilt: number;
  tradesDone: number;
  maxNetWorth: number;
  laps: number;
  jailVisits: number;
}

export interface PropState {
  owner: string | null;
  houses: number; // 0..4 дома, 5 — отель
  mortgaged: boolean;
}

export type Phase =
  | 'order'
  | 'roll'
  | 'buy'
  | 'auction'
  | 'action'
  | 'debt'
  | 'gameOver';

export interface AuctionState {
  cell: number;
  highBid: number;
  highBidder: string | null;
  participants: string[]; // ещё не спасовавшие
  endsAt: number; // мс
  starter: string;
}

export interface TradeOffer {
  id: string;
  from: string;
  to: string;
  giveMoney: number;
  giveCells: number[];
  getMoney: number;
  getCells: number[];
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'countered' | 'failed';
  createdAt: number;
  counterOf?: string;
}

export interface DebtState {
  player: string;
  amount: number;
  creditor: string | null; // null — банк
  reason: string;
  /** Распределить платёж между этими игроками (карта «заплатите каждому») */
  split?: string[];
  /** После оплаты продолжить движение на столько клеток (выход из тюрьмы) */
  resumeMove?: number;
  rent?: boolean;
}

export interface LogEntry {
  t: number;
  turn: number;
  text: string;
  player?: string;
  kind?: 'money' | 'buy' | 'build' | 'trade' | 'jail' | 'card' | 'bankrupt' | 'info' | 'win';
}

export type GameEvent =
  | { id: number; type: 'order'; rolls: { player: string; roll: number }[] }
  | { id: number; type: 'turn'; player: string }
  | { id: number; type: 'dice'; player: string; d1: number; d2: number }
  | { id: number; type: 'move'; player: string; from: number; to: number; steps: number; direct: boolean }
  | { id: number; type: 'money'; player: string; delta: number; reason: string }
  | { id: number; type: 'transfer'; from: string; to: string; amount: number; reason: string }
  | { id: number; type: 'buy'; player: string; cell: number; price: number }
  | { id: number; type: 'build'; player: string; cell: number; houses: number; sold: boolean }
  | { id: number; type: 'mortgage'; player: string; cell: number; mortgaged: boolean }
  | { id: number; type: 'card'; player: string; deck: 'chance' | 'chest'; text: string; title: string }
  | { id: number; type: 'wheel'; player: string; sector: number; text: string }
  | { id: number; type: 'jail'; player: string; enter: boolean }
  | { id: number; type: 'auction'; cell: number; winner: string | null; price: number; started: boolean }
  | { id: number; type: 'trade'; tradeId: string; accepted: boolean; from: string; to: string }
  | { id: number; type: 'bankrupt'; player: string; creditor: string | null }
  | { id: number; type: 'gameOver'; winner: string | null }
  | { id: number; type: 'jackpot'; player: string; amount: number }
  | { id: number; type: 'owner'; cell: number; owner: string | null };

export type GameEventInput = GameEvent extends infer E ? (E extends { id: number } ? Omit<E, 'id'> : never) : never;

export interface GameState {
  id: string;
  version: number;
  settings: GameSettings;
  board: BoardDef;
  players: PlayerState[];
  current: number;
  phase: Phase;
  turn: number; // общий счётчик ходов
  round: number; // номер круга (все игроки сходили)
  dice: [number, number] | null;
  doublesCount: number;
  rolledThisTurn: boolean;
  extraRoll: boolean;
  props: Record<number, PropState>;
  decks: { chance: number[]; chest: number[] };
  jackpot: number;
  auction: AuctionState | null;
  trades: TradeOffer[];
  debt: DebtState | null;
  log: LogEntry[];
  events: GameEvent[];
  eventSeq: number;
  winner: string | null;
  startedAt: number;
  endsAt: number; // 0 — без лимита
  /** Дедлайн текущего решения (таймер хода) */
  deadline: number;
  /** Время, когда закончатся анимации последнего действия (для ботов и таймеров) */
  busyUntil: number;
  rng: number;
  tradeSeq: number;
}

export type GameAction =
  | { type: 'roll' }
  | { type: 'buy' }
  | { type: 'decline' } // отказ от покупки → аукцион или пропуск
  | { type: 'bid'; amount: number }
  | { type: 'pass' } // пас в аукционе
  | { type: 'build'; cell: number }
  | { type: 'sellBuilding'; cell: number }
  | { type: 'mortgage'; cell: number }
  | { type: 'unmortgage'; cell: number }
  | { type: 'sellProperty'; cell: number }
  | { type: 'payJail' }
  | { type: 'useJailCard' }
  | { type: 'payDebt' }
  | { type: 'bankrupt' }
  | { type: 'endTurn' }
  | {
      type: 'proposeTrade';
      to: string;
      giveMoney: number;
      giveCells: number[];
      getMoney: number;
      getCells: number[];
      counterOf?: string;
    }
  | { type: 'acceptTrade'; tradeId: string }
  | { type: 'rejectTrade'; tradeId: string }
  | { type: 'cancelTrade'; tradeId: string }
  | { type: 'ackOrder' };

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface LobbySeat {
  id: string;
  isBot: boolean;
  botLevel: BotLevel;
  profile: PlayerProfile;
  ready: boolean;
  connected: boolean;
  isHost: boolean;
}
