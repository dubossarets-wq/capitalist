// Хост партии: применяет действия, запускает ботов, следит за таймерами.
// Один и тот же код работает в браузере (игра с ботами) и на локальном сервере (Wi-Fi).

import type { ActionResult, GameAction, GameState } from './types';
import { applyAction, decisionMaker, playerById, speedFactor, tick } from './engine';
import { botDecide, newBotMemory, type BotMemory } from './bot';

export interface RunnerOptions {
  onChange: (s: GameState) => void;
  /** Через сколько мс отключившегося игрока подменяет автопилот */
  disconnectGraceMs?: number;
  now?: () => number;
  tickMs?: number;
}

export class GameRunner {
  state: GameState;
  private mem: BotMemory = newBotMemory();
  private seen = new Map<string, string[]>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextBotAt = 0;
  private auctionNext = new Map<string, number>();
  private tradeSeenAt = new Map<string, number>();
  private disconnectedAt = new Map<string, number>();
  private opts: Required<RunnerOptions>;
  paused = false;

  constructor(state: GameState, opts: RunnerOptions) {
    this.state = state;
    this.opts = { disconnectGraceMs: 40000, now: () => Date.now(), tickMs: 200, ...opts };
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.loop(), this.opts.tickMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private now() {
    return this.opts.now();
  }

  /** Действие игрока. actionId защищает от повторного выполнения при переотправке */
  act(pid: string, action: GameAction, actionId?: string): ActionResult & { duplicate?: boolean } {
    if (actionId) {
      const list = this.seen.get(pid) ?? [];
      if (list.includes(actionId)) return { ok: true, duplicate: true };
      list.push(actionId);
      if (list.length > 300) list.splice(0, list.length - 300);
      this.seen.set(pid, list);
    }
    const res = applyAction(this.state, pid, action, this.now());
    if (res.ok) {
      // После действия человека боты ждут окончания анимаций
      this.nextBotAt = Math.max(this.nextBotAt, this.state.busyUntil);
      this.emit();
    }
    return res;
  }

  setConnected(pid: string, connected: boolean) {
    const p = playerById(this.state, pid);
    if (!p) return;
    if (connected) {
      this.disconnectedAt.delete(pid);
      if (!p.connected || p.autopilot) {
        p.connected = true;
        p.autopilot = false;
        this.state.version++;
        this.emit();
      }
    } else {
      this.disconnectedAt.set(pid, this.now());
      if (p.connected) {
        p.connected = false;
        this.state.version++;
        this.emit();
      }
    }
  }

  /** Передать место игрока боту навсегда (по решению хозяина комнаты) */
  replaceWithBot(pid: string) {
    const p = playerById(this.state, pid);
    if (!p || p.isBot) return;
    p.isBot = true;
    p.botLevel = 'medium';
    p.autopilot = false;
    p.name = `${p.name} (бот)`;
    this.state.version++;
    this.emit();
  }

  private emit() {
    this.opts.onChange(this.state);
  }

  private isAuto(pid: string) {
    const p = playerById(this.state, pid);
    return !!p && !p.bankrupt && (p.isBot || p.autopilot);
  }

  /** Один шаг цикла хоста (вызывается таймером; в тестах — вручную) */
  pump() {
    this.loop();
  }

  private loop() {
    if (this.paused) return;
    const s = this.state;
    const now = this.now();
    if (tick(s, now)) this.emit();
    if (s.phase === 'gameOver') return;

    // Автопилот для давно отключившихся игроков
    for (const [pid, at] of this.disconnectedAt) {
      const p = playerById(s, pid);
      if (p && !p.autopilot && !p.isBot && now - at > this.opts.disconnectGraceMs) {
        p.autopilot = true;
        s.version++;
        this.emit();
      }
    }

    // Пока идут анимации — никто из автоматических игроков не действует
    if (now < s.busyUntil) return;
    const f = speedFactor(s);

    // Ответы ботов на сделки (с небольшой паузой «на раздумье»)
    for (const t of s.trades) {
      if (t.status !== 'pending') continue;
      const first = this.tradeSeenAt.get(t.id) ?? now;
      this.tradeSeenAt.set(t.id, first);
      if (this.isAuto(t.to) && now - first > 1600 * f) {
        const p = playerById(s, t.to)!;
        const a = botDecide(s, t.to, p.isBot ? p.botLevel : 'medium', this.mem);
        if (a) this.applyAuto(t.to, a);
        return;
      }
      // Старые предложения людям, на которые никто не ответил, снимаем
      if (now - first > 120000 && this.isAuto(t.from)) {
        this.applyAuto(t.from, { type: 'cancelTrade', tradeId: t.id });
        return;
      }
    }

    // Аукцион: каждый бот делает ставку в своём темпе
    if (s.phase === 'auction' && s.auction) {
      for (const pid of s.auction.participants) {
        if (!this.isAuto(pid)) continue;
        const at = this.auctionNext.get(pid) ?? now + (500 + Math.random() * 1500) * f;
        if (!this.auctionNext.has(pid)) this.auctionNext.set(pid, at);
        if (now < at) continue;
        this.auctionNext.set(pid, now + (900 + Math.random() * 1600) * f);
        const p = playerById(s, pid)!;
        const a = botDecide(s, pid, p.isBot ? p.botLevel : 'easy', this.mem);
        if (a && (a.type === 'bid' || a.type === 'pass')) {
          this.applyAuto(pid, a);
          return;
        }
      }
      return;
    } else if (this.auctionNext.size) this.auctionNext.clear();

    const dm = decisionMaker(s);
    if (!dm) return;

    // Таймер хода: за человека, который не успел, решает автопилот
    if (s.deadline && now > s.deadline && !this.isAuto(dm)) {
      const a = this.timeoutAction(dm);
      if (a) {
        this.applyAuto(dm, a);
        return;
      }
    }

    if (!this.isAuto(dm)) return;
    if (now < this.nextBotAt) return;
    const p = playerById(s, dm)!;
    const a = botDecide(s, dm, p.isBot ? p.botLevel : 'medium', this.mem);
    if (a) {
      const res = this.applyAuto(dm, a);
      if (!res.ok) {
        // Подстраховка от зацикливания: если действие не прошло — пробуем завершить ход
        const fallback: GameAction =
          s.phase === 'roll' ? { type: 'roll' } : s.phase === 'buy' ? { type: 'decline' } : s.phase === 'debt' ? { type: 'bankrupt' } : { type: 'endTurn' };
        this.applyAuto(dm, fallback);
      }
    }
  }

  private timeoutAction(pid: string): GameAction | null {
    const s = this.state;
    switch (s.phase) {
      case 'roll':
        return { type: 'roll' };
      case 'buy':
        return { type: 'decline' };
      case 'action':
        return { type: 'endTurn' };
      case 'debt':
        return botDecide(s, pid, 'medium', this.mem);
    }
    return null;
  }

  private applyAuto(pid: string, a: GameAction) {
    const res = applyAction(this.state, pid, a, this.now());
    const f = speedFactor(this.state);
    this.nextBotAt = Math.max(this.now(), this.state.busyUntil) + (300 + Math.random() * 400) * f;
    if (res.ok) this.emit();
    return res;
  }
}
