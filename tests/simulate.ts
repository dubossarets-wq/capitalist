// Симуляция множества партий ботов: проверка, что игра доходит до конца,
// деньги не уходят в минус, а состояние остаётся согласованным.
import { createGame, netWorth } from '../shared/engine';
import { GameRunner } from '../shared/runner';
import { defaultSettings } from '../shared/settings';
import type { BotLevel, GameSettings, GameState } from '../shared/types';
import { BOARDS } from '../shared/boards';

function check(s: GameState) {
  for (const p of s.players) {
    if (p.cash < 0) throw new Error(`Отрицательный баланс у ${p.name}: ${p.cash}`);
    if (!Number.isInteger(p.cash)) throw new Error(`Нецелый баланс у ${p.name}: ${p.cash}`);
  }
  for (const [k, ps] of Object.entries(s.props)) {
    if (ps.houses < 0 || ps.houses > 5) throw new Error(`Неверное число домов на ${k}`);
    if (ps.owner && s.players.find((p) => p.id === ps.owner)?.bankrupt) throw new Error(`Клетка ${k} у банкрота`);
    if (!ps.owner && (ps.houses || ps.mortgaged)) throw new Error(`Бесхозная клетка ${k} с постройками/залогом`);
  }
}

function runGame(settings: GameSettings, levels: BotLevel[], seed: number) {
  let clock = 1_000_000;
  const seats = levels.map((lv, i) => ({
    id: `p${i}`,
    isBot: true,
    botLevel: lv,
    profile: { name: `Бот${i}-${lv}`, token: 'pawn', color: '#f00', avatar: 'a1' },
  }));
  const state = createGame(settings, seats, clock, seed);
  const runner = new GameRunner(state, { onChange: () => {}, now: () => clock });
  let steps = 0;
  while (state.phase !== 'gameOver' && steps < 400000) {
    clock += 250;
    runner.pump();
    check(state);
    steps++;
  }
  return { state, steps };
}

const levels: BotLevel[][] = [
  ['easy', 'medium', 'hard', 'hard'],
  ['hard', 'hard'],
  ['easy', 'easy', 'medium', 'medium', 'hard', 'hard', 'medium', 'easy'],
];

let total = 0;
const wins: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
let unfinished = 0;
let totalTurns = 0;
const t0 = Date.now();
for (const board of BOARDS) {
  for (let seed = 1; seed <= 25; seed++) {
    for (const lv of levels) {
      const st = defaultSettings();
      st.boardId = board.id;
      st.maxTurns = 150; // защита от бесконечных партий
      if (seed % 5 === 0) st.quickGame = true;
      if (seed % 7 === 0) st.rules.auctions = false;
      if (seed % 3 === 0) st.winCondition = 'netWorth';
      const { state } = runGame(st, lv, seed * 7919 + lv.length);
      total++;
      totalTurns += state.turn;
      if (state.phase !== 'gameOver') {
        unfinished++;
        console.log('Не завершена', board.id, seed, lv.join(','), 'ход', state.turn, 'фаза', state.phase);
        continue;
      }
      const w = state.players.find((p) => p.id === state.winner);
      if (w) wins[w.botLevel]++;
    }
  }
}
console.log(`Сыграно партий: ${total}, не завершено: ${unfinished}, средняя длина: ${Math.round(totalTurns / total)} ходов`);
console.log('Победы по уровням:', wins, `время ${((Date.now() - t0) / 1000).toFixed(1)} c`);

// Подробная партия: сложные против лёгких один на один
{
  const st = defaultSettings();
  st.maxTurns = 0;
  let hardWins = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const { state } = runGame(st, ['hard', 'easy'], seed);
    if (state.players.find((p) => p.id === state.winner)?.botLevel === 'hard') hardWins++;
  }
  console.log(`Сложный против лёгкого (1×1, без лимита): ${hardWins} из 40 побед`);
}
if (unfinished > total * 0.02) {
  console.error('Слишком много незавершённых партий');
  process.exit(1);
}
void netWorth;

// Регрессия: первым ходит человек, который ничего не делает, включён таймер хода —
// партия не должна зависнуть (раньше дедлайн не назначался на первом ходу)
{
  let clock = 5_000_000;
  const st = defaultSettings();
  st.turnTimer = 5;
  st.turnOrder = 'fixed';
  st.maxTurns = 5;
  const seats = [
    { id: 'idle1', isBot: false, botLevel: 'medium' as BotLevel, profile: { name: 'Спящий', token: 'pawn', color: '#f00', avatar: 'a1' } },
    { id: 'idle2', isBot: false, botLevel: 'medium' as BotLevel, profile: { name: 'Спящий 2', token: 'car', color: '#0f0', avatar: 'a2' } },
    { id: 'b1', isBot: true, botLevel: 'hard' as BotLevel, profile: { name: 'Бот', token: 'duck', color: '#00f', avatar: 'a3' } },
  ];
  const state = createGame(st, seats, clock, 99);
  if (!state.deadline) {
    console.error('Регрессия: на первом ходу не назначен таймер');
    process.exit(1);
  }
  const runner = new GameRunner(state, { onChange: () => {}, now: () => clock });
  for (let k = 0; k < 200000 && state.phase !== 'gameOver'; k++) {
    clock += 250;
    runner.pump();
  }
  if (state.phase !== 'gameOver') {
    console.error(`Регрессия: партия бездействующих игроков с таймером зависла на ходу ${state.turn}`);
    process.exit(1);
  }
  console.log(`Партия бездействующих людей с таймером дошла до конца: ${state.turn} ходов`);
}
