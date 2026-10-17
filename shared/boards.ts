import type { BoardDef, CellDef, GroupDef } from './types';

export const GROUP_COLORS = [
  '#8B4E2F', // коричневый
  '#4FC3F7', // голубой
  '#EC407A', // розовый
  '#FF9800', // оранжевый
  '#E53935', // красный
  '#FDD835', // жёлтый
  '#43A047', // зелёный
  '#3949AB', // синий
];

// Классические таблицы аренды: цена → [база, 1д, 2д, 3д, 4д, отель]
const CLASSIC_RENT: [number, number[]][] = [
  [60, [2, 10, 30, 90, 160, 250]],
  [60, [4, 20, 60, 180, 320, 450]],
  [100, [6, 30, 90, 270, 400, 550]],
  [120, [8, 40, 100, 300, 450, 600]],
  [140, [10, 50, 150, 450, 625, 750]],
  [160, [12, 60, 180, 500, 700, 900]],
  [180, [14, 70, 200, 550, 750, 950]],
  [200, [16, 80, 220, 600, 800, 1000]],
  [220, [18, 90, 250, 700, 875, 1050]],
  [240, [20, 100, 300, 750, 925, 1100]],
  [260, [22, 110, 330, 800, 975, 1150]],
  [280, [24, 120, 360, 850, 1025, 1200]],
  [300, [26, 130, 390, 900, 1100, 1275]],
  [320, [28, 150, 450, 1000, 1200, 1400]],
  [350, [35, 175, 500, 1100, 1300, 1500]],
  [400, [50, 200, 600, 1400, 1700, 2000]],
];

/** Аренда для произвольной цены — интерполяция классических таблиц */
export function genRent(price: number): number[] {
  const t = CLASSIC_RENT;
  if (price <= t[0][0]) return t[0][1].map((v) => Math.max(1, Math.round((v * price) / t[0][0])));
  for (let i = 0; i < t.length - 1; i++) {
    const [p1, r1] = t[i];
    const [p2, r2] = t[i + 1];
    if (price >= p1 && price <= p2) {
      const k = p2 === p1 ? 0 : (price - p1) / (p2 - p1);
      return r1.map((v, j) => round5(v + (r2[j] - v) * k, v < 30));
    }
  }
  const [pl, rl] = t[t.length - 1];
  return rl.map((v) => round5((v * price) / pl, false));
}

function round5(v: number, small: boolean) {
  if (small) return Math.max(1, Math.round(v));
  return Math.max(5, Math.round(v / 5) * 5);
}

export function houseCostFor(price: number) {
  if (price <= 120) return 50;
  if (price <= 200) return 100;
  if (price <= 280) return 150;
  if (price <= 400) return 200;
  return 250;
}

const P = (name: string, group: number, price: number, rent?: number[]): CellDef => ({
  type: 'property',
  name,
  group,
  price,
  rent: rent ?? genRent(price),
  houseCost: houseCostFor(price),
});
const T = (name: string, icon = 'plane'): CellDef => ({ type: 'transport', name, price: 200, icon });
const U = (name: string, icon: string): CellDef => ({ type: 'utility', name, price: 150, icon });
const TAX = (name: string, amount: number, extraTax = false): CellDef => ({ type: 'tax', name, amount, extraTax });
const CH: CellDef = { type: 'chance', name: 'Шанс' };
const CS: CellDef = { type: 'chest', name: 'Казна' };
const WH: CellDef = { type: 'wheel', name: 'Колесо фортуны' };

const START: CellDef = { type: 'start', name: 'СТАРТ' };
const JAIL: CellDef = { type: 'jail', name: 'Тюрьма' };
const PARK: CellDef = { type: 'parking', name: 'Отпуск' };
const GOJAIL: CellDef = { type: 'gotojail', name: 'В тюрьму' };

const rentOf = (price: number) => CLASSIC_RENT.find((r) => r[0] === price)![1];

const worldGroups: GroupDef[] = [
  { name: 'Африка', color: GROUP_COLORS[0] },
  { name: 'Южная Америка', color: GROUP_COLORS[1] },
  { name: 'Средиземноморье', color: GROUP_COLORS[2] },
  { name: 'Европа', color: GROUP_COLORS[3] },
  { name: 'Восток', color: GROUP_COLORS[4] },
  { name: 'Азия', color: GROUP_COLORS[5] },
  { name: 'Содружество', color: GROUP_COLORS[6] },
  { name: 'Мегаполисы', color: GROUP_COLORS[7] },
];

export const WORLD_BOARD: BoardDef = {
  id: 'world',
  name: 'Вокруг света',
  description: 'Классическое поле на 40 клеток: города мира, аэропорты и колесо фортуны',
  groups: worldGroups,
  cells: [
    START,
    P('Каир', 0, 60, [2, 10, 30, 90, 160, 250]),
    CS,
    P('Марракеш', 0, 60, [4, 20, 60, 180, 320, 450]),
    TAX('Подоходный налог', 200),
    T('Аэропорт Север', 'plane'),
    P('Лима', 1, 100, rentOf(100)),
    CH,
    P('Буэнос-Айрес', 1, 100, rentOf(100)),
    P('Рио-де-Жанейро', 1, 120, rentOf(120)),
    JAIL,
    P('Афины', 2, 140, rentOf(140)),
    U('Электростанция', 'bolt'),
    P('Барселона', 2, 140, rentOf(140)),
    P('Рим', 2, 160, rentOf(160)),
    T('Морской порт', 'ship'),
    P('Прага', 3, 180, rentOf(180)),
    CS,
    P('Вена', 3, 180, rentOf(180)),
    P('Берлин', 3, 200, rentOf(200)),
    PARK,
    P('Стамбул', 4, 220, rentOf(220)),
    WH,
    P('Мумбаи', 4, 220, rentOf(220)),
    P('Дубай', 4, 240, rentOf(240)),
    T('Ж/д вокзал', 'train'),
    P('Сеул', 5, 260, rentOf(260)),
    P('Шанхай', 5, 260, rentOf(260)),
    U('Водоканал', 'drop'),
    P('Сингапур', 5, 280, rentOf(280)),
    GOJAIL,
    P('Сидней', 6, 300, rentOf(300)),
    P('Торонто', 6, 300, rentOf(300)),
    CS,
    P('Лондон', 6, 320, rentOf(320)),
    T('Аэропорт Юг', 'plane'),
    CH,
    P('Нью-Йорк', 7, 350, rentOf(350)),
    TAX('Налог на роскошь', 100, true),
    P('Токио', 7, 400, rentOf(400)),
  ],
};

const megaGroups: GroupDef[] = [
  { name: 'Окраина', color: GROUP_COLORS[0] },
  { name: 'Спальный район', color: GROUP_COLORS[1] },
  { name: 'Студгородок', color: GROUP_COLORS[2] },
  { name: 'Исторический центр', color: GROUP_COLORS[3] },
  { name: 'Деловой квартал', color: GROUP_COLORS[4] },
  { name: 'Курорт', color: GROUP_COLORS[5] },
  { name: 'Сити', color: GROUP_COLORS[6] },
  { name: 'Элита', color: GROUP_COLORS[7] },
];

export const MEGA_BOARD: BoardDef = {
  id: 'mega',
  name: 'Мегаполис',
  description: 'Большое поле на 48 клеток: 8 районов по 3–4 улицы, метро и два колеса фортуны',
  groups: megaGroups,
  cells: [
    START,
    P('Гаражная', 0, 60),
    CS,
    P('Складская', 0, 70),
    P('Промзона', 0, 80),
    TAX('Подоходный налог', 200),
    T('Метро «Северная»', 'train'),
    P('Берёзовая', 1, 100),
    CH,
    P('Липовая', 1, 100),
    P('Кленовая', 1, 110),
    P('Сосновая', 1, 120),
    JAIL,
    P('Кампус', 2, 140),
    U('ТЭЦ', 'bolt'),
    P('Библиотечная', 2, 150),
    P('Технопарк', 2, 160),
    T('Метро «Восточная»', 'train'),
    P('Ратуша', 3, 180),
    CS,
    P('Театральная', 3, 180),
    WH,
    P('Музейная', 3, 190),
    P('Набережная', 3, 200),
    PARK,
    P('Биржевая', 4, 220),
    CH,
    P('Банковская', 4, 220),
    P('Офисная', 4, 230),
    P('Конгресс-холл', 4, 240),
    T('Метро «Южная»', 'train'),
    P('Пляжная', 5, 260),
    CS,
    P('Яхт-клуб', 5, 270),
    U('Интернет-провайдер', 'wifi'),
    P('Аквапарк', 5, 280),
    GOJAIL,
    P('Сити-Тауэр', 6, 300),
    P('Нео-Плаза', 6, 300),
    WH,
    P('Скайлайн', 6, 310),
    P('Меркурий', 6, 320),
    T('Метро «Западная»', 'train'),
    CH,
    P('Золотой квартал', 7, 360),
    TAX('Налог на роскошь', 150, true),
    P('Президент-отель', 7, 400),
    P('Дворцовая', 7, 450),
  ],
};

const expressGroups: GroupDef[] = [
  { name: 'Запад', color: GROUP_COLORS[0] },
  { name: 'Золотое кольцо', color: GROUP_COLORS[1] },
  { name: 'Волга', color: GROUP_COLORS[2] },
  { name: 'Юг', color: GROUP_COLORS[3] },
  { name: 'Урал', color: GROUP_COLORS[4] },
  { name: 'Сибирь', color: GROUP_COLORS[5] },
  { name: 'Курорты', color: GROUP_COLORS[6] },
  { name: 'Столицы', color: GROUP_COLORS[7] },
];

export const EXPRESS_BOARD: BoardDef = {
  id: 'express',
  name: 'Экспресс',
  description: 'Быстрое поле на 32 клетки: 8 пар городов, монополии собираются быстрее',
  groups: expressGroups,
  cells: [
    START,
    P('Псков', 0, 60),
    CS,
    P('Калининград', 0, 80),
    T('Аэропорт Пулково', 'plane'),
    P('Тверь', 1, 100),
    CH,
    P('Ярославль', 1, 120),
    JAIL,
    P('Казань', 2, 140),
    TAX('Подоходный налог', 150),
    P('Нижний Новгород', 2, 160),
    T('Речной вокзал', 'ship'),
    P('Ростов', 3, 180),
    WH,
    P('Краснодар', 3, 200),
    PARK,
    P('Пермь', 4, 220),
    CH,
    P('Екатеринбург', 4, 240),
    T('Транссиб', 'train'),
    P('Красноярск', 5, 260),
    CS,
    P('Новосибирск', 5, 280),
    GOJAIL,
    P('Сочи', 6, 300),
    WH,
    P('Владивосток', 6, 320),
    T('Аэропорт Внуково', 'plane'),
    P('Санкт-Петербург', 7, 350),
    TAX('Налог на роскошь', 100, true),
    P('Москва', 7, 400),
  ],
};

export const BOARDS: BoardDef[] = [WORLD_BOARD, MEGA_BOARD, EXPRESS_BOARD];

export function getBoard(id: string, custom?: BoardDef | null): BoardDef {
  if (custom && custom.id === id) return custom;
  return BOARDS.find((b) => b.id === id) ?? WORLD_BOARD;
}

export function isOwnable(c: CellDef) {
  return c.type === 'property' || c.type === 'transport' || c.type === 'utility';
}

/** Проверка корректности пользовательского поля */
export function validateBoard(b: BoardDef): string | null {
  const n = b.cells.length;
  if (n < 24 || n > 64 || n % 4 !== 0) return 'Количество клеток должно делиться на 4 (от 24 до 64)';
  const side = n / 4;
  const corners = [0, side, side * 2, side * 3].map((i) => b.cells[i].type);
  if (corners[0] !== 'start') return 'Первая клетка должна быть СТАРТ';
  if (!b.cells.some((c) => c.type === 'jail')) return 'На поле должна быть тюрьма';
  for (const c of b.cells) {
    if (c.type === 'property') {
      if (c.group == null || c.group < 0 || c.group >= b.groups.length) return `Клетка «${c.name}» без группы`;
      if (!c.price || c.price <= 0) return `Клетка «${c.name}» без цены`;
      if (!c.rent || c.rent.length !== 6) return `Клетка «${c.name}» без таблицы аренды`;
    }
  }
  return null;
}
