// «Режиссёр» партии: принимает новые состояния от движка (локального или сетевого),
// проигрывает события анимациями и только потом показывает новое состояние в интерфейсе.
import * as THREE from 'three';
import type { GameEvent, GameState } from '../../shared/types';
import { cellAt, goSalary, playerById, priceOf, rentOf, taxOf, countOwnedOfType, formatMoney } from '../../shared/engine';
import { isOwnable } from '../../shared/boards';
import { getScene } from '../three/sceneHost';
import { leaveMenuScene } from '../three/sceneHost';
import { THEMES } from '../three/themes';
import { sound } from '../audio/sound';
import { store } from '../store';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, document.hidden ? 0 : ms));

class Director {
  private queue: GameState[] = [];
  private lastEvent = 0;
  private running = false;
  private gameId = '';
  private skipWait: (() => void) | null = null;

  reset() {
    this.queue = [];
    this.lastEvent = 0;
    this.gameId = '';
    this.running = false;
  }

  push(s: GameState) {
    this.queue.push(s);
    if (!this.running) void this.run();
  }

  /** Ускорить текущую паузу (клик по карточке) */
  skip() {
    this.skipWait?.();
  }

  private speed(s: GameState) {
    const user = store().prefs.anim;
    const u = user === 'full' ? 1 : user === 'fast' ? 0.65 : 0.35;
    return (s.settings.quickGame ? 0.6 : 1) * u;
  }

  private wait(ms: number) {
    return new Promise<void>((resolve) => {
      const t = setTimeout(done, document.hidden ? 0 : ms);
      function done() {
        clearTimeout(t);
        resolve();
      }
      this.skipWait = done;
    });
  }

  private async run() {
    this.running = true;
    store().set({ animating: true });
    try {
      while (this.queue.length) {
        const s = this.queue.shift()!;
        const scene = getScene();
        let snap = false;
        if (s.id !== this.gameId) {
          this.gameId = s.id;
          this.setupBoard(s);
          // Новая партия с начала — проигрываем всё; иначе (переподключение) сразу показываем итог
          const fresh = s.events[0]?.id === 1 && s.events[0]?.type === 'order' && s.turn <= 2 && s.version < 6;
          if (!fresh) {
            this.lastEvent = s.eventSeq;
            snap = true;
          } else this.lastEvent = 0;
        }
        const evs = s.events.filter((e) => e.id > this.lastEvent);
        if (evs.length && evs[0].id > this.lastEvent + 1 && this.lastEvent > 0) snap = true;
        if (this.queue.length > 4 || document.hidden) snap = true;
        // Отстаём от игры (медленное устройство) — ускоряем анимации, чтобы догнать
        const lag = this.queue.length >= 3 ? 0.35 : this.queue.length >= 1 ? 0.65 : 1;
        const f = this.speed(s) * lag;
        if (scene) {
          scene.speed = f;
          scene.cameraFollow = store().prefs.cameraFollow;
        }
        const cash: Record<string, number> = { ...store().cashView };
        for (let k = 0; k < evs.length; k++) {
          const ev = evs[k];
          if (!snap) {
            try {
              await this.play(ev, s, f, cash, evs[k + 1]);
            } catch (e) {
              console.warn('Ошибка анимации', e);
            }
          }
        }
        if (evs.length) this.lastEvent = evs[evs.length - 1].id;
        const real: Record<string, number> = {};
        s.players.forEach((p) => (real[p.id] = p.cash));
        this.syncScene(s);
        store().set({ game: s, cashView: real });
      }
    } finally {
      this.running = false;
      store().set({ animating: false });
    }
  }

  private setupBoard(s: GameState) {
    const scene = getScene();
    if (!scene) return;
    leaveMenuScene();
    scene.setBoard(s.board, s.settings.theme, s.settings.diceStyle, goSalary(s));
    scene.setViewMode(store().prefs.view);
    scene.setPlayers(s.players.map((p) => ({ id: p.id, token: p.token, color: p.color })));
    // Фишки ставим по фактическим позициям; для свежей партии — на СТАРТ
    for (const p of s.players) scene.placeToken(p.id, p.position, p.inJail, p.bankrupt);
    scene.relayout(true);
    const cash: Record<string, number> = {};
    s.players.forEach((p) => (cash[p.id] = s.events[0]?.id === 1 ? s.settings.economy.startMoney : p.cash));
    store().set({ cashView: cash, game: store().game?.id === s.id ? store().game : s });
    this.syncProps(s, false);
  }

  /** Привести сцену в точное соответствие с состоянием */
  private syncScene(s: GameState) {
    const scene = getScene();
    if (!scene) return;
    scene.setPlayers(s.players.map((p) => ({ id: p.id, token: p.token, color: p.color })));
    for (const p of s.players) scene.placeToken(p.id, p.position, p.inJail, p.bankrupt);
    scene.relayout();
    this.syncProps(s, false);
    const cur = s.players[s.current];
    if (s.phase !== 'gameOver' && cur) scene.setActive(cur.id, cur.color);
    else scene.setActive(null);
  }

  private syncProps(s: GameState, animate: boolean) {
    const scene = getScene();
    if (!scene) return;
    s.board.cells.forEach((c, i) => {
      if (isOwnable(c)) {
        const ps = s.props[i];
        scene.setTag(i, this.tagInfo(s, i));
        scene.setMortgaged(i, !!ps?.mortgaged);
        void scene.setHouses(i, ps?.houses ?? 0, animate);
      } else if (c.type === 'tax') {
        const t = THEMES[s.settings.theme];
        const off = c.extraTax && !s.settings.rules.extraTaxes;
        scene.setTag(i, { text: off ? '—' : `$${taxOf(s, c)}`, bg: '#ffcc80', fg: t.id === 'city' ? '#3a1d00' : '#4a2a00', mortgaged: false });
      }
    });
  }

  tagInfo(s: GameState, i: number) {
    const ps = s.props[i];
    const theme = THEMES[s.settings.theme];
    if (!ps?.owner) return { text: `$${priceOf(s, i)}`, bg: theme.priceBg, fg: theme.priceText, mortgaged: false };
    const owner = playerById(s, ps.owner);
    if (ps.mortgaged) return { text: 'ЗАЛОГ', bg: '#7d7d8a', fg: '#ffffff', mortgaged: true };
    const c = cellAt(s, i);
    let text: string;
    if (c.type === 'utility') text = countOwnedOfType(s, ps.owner, 'utility') >= 2 ? '×10' : '×4';
    else text = `$${rentOf(s, i, 7)}`;
    return { text, bg: owner?.color ?? '#888', fg: '#ffffff', mortgaged: false };
  }

  private tokenPos(pid: string) {
    return getScene()?.tokenPosition(pid) ?? new THREE.Vector3();
  }

  private name(s: GameState, pid: string | null | undefined) {
    return playerById(s, pid)?.name ?? 'Банк';
  }

  private banner(text: string, color: string, sub?: string) {
    store().set({ banner: { text, color, sub, key: Math.random() } });
  }

  private async play(ev: GameEvent, s: GameState, f: number, cash: Record<string, number>, next?: GameEvent) {
    const scene = getScene();
    if (!scene) return;
    const me = store().myId;
    const setCash = () => store().set({ cashView: { ...cash } });
    const center = new THREE.Vector3(0, 0.4, 0);
    switch (ev.type) {
      case 'order': {
        if (ev.rolls.some((r) => r.roll > 0)) {
          store().set({ order: { rolls: ev.rolls } });
          sound.play('dice');
          await this.wait(3200 * f);
          store().set({ order: null });
        }
        return;
      }
      case 'turn': {
        const p = playerById(s, ev.player);
        if (!p) return;
        scene.setActive(p.id, p.color);
        scene.followToken(p.id);
        if (ev.player === me) {
          sound.play('turn');
          this.banner('ВАШ ХОД!', p.color);
        }
        await sleep(300 * f);
        return;
      }
      case 'dice': {
        sound.play('dice');
        store().set({ lastDice: [ev.d1, ev.d2] });
        await scene.rollDice(ev.d1, ev.d2);
        if (ev.d1 === ev.d2) this.banner('ДУБЛЬ!', '#ffd23f');
        await sleep(250 * f);
        return;
      }
      case 'move': {
        if (ev.direct) {
          const toJail = next?.type === 'jail' && next.enter && next.player === ev.player;
          sound.play('whoosh');
          await scene.teleportToken(ev.player, ev.to, toJail);
        } else {
          await scene.moveToken(ev.player, ev.from, ev.steps);
        }
        await sleep(150 * f);
        return;
      }
      case 'money': {
        const pos = this.tokenPos(ev.player);
        cash[ev.player] = (cash[ev.player] ?? 0) + ev.delta;
        setCash();
        if (ev.delta > 0) {
          scene.floatText(pos, `+${formatMoney(ev.delta)}`, '#4cff7a');
          scene.coinBurst(pos, Math.min(16, 4 + Math.round(ev.delta / 40)));
          sound.play('coin');
        } else {
          scene.floatText(pos, `−${formatMoney(-ev.delta)}`, '#ff5252');
          scene.coinFlow(pos, center, 5);
          sound.play('lose');
        }
        await sleep(300 * f);
        return;
      }
      case 'transfer': {
        const a = this.tokenPos(ev.from);
        const b = this.tokenPos(ev.to);
        cash[ev.from] = (cash[ev.from] ?? 0) - ev.amount;
        cash[ev.to] = (cash[ev.to] ?? 0) + ev.amount;
        scene.coinFlow(a, b, Math.min(14, 4 + Math.round(ev.amount / 50)));
        scene.floatText(a, `−${formatMoney(ev.amount)}`, '#ff5252');
        sound.play('cash');
        await sleep(450 * f);
        scene.floatText(b, `+${formatMoney(ev.amount)}`, '#4cff7a');
        setCash();
        if (ev.from === me && ev.amount >= 100) this.banner(`−${formatMoney(ev.amount)}`, '#ff5252', ev.reason);
        await sleep(250 * f);
        return;
      }
      case 'buy': {
        const p = playerById(s, ev.player);
        cash[ev.player] = (cash[ev.player] ?? 0) - ev.price;
        setCash();
        scene.buyFx(ev.cell, p?.color ?? '#fff');
        scene.setTag(ev.cell, { text: `$${rentOf(s, ev.cell, 7)}`, bg: p?.color ?? '#888', fg: '#fff', mortgaged: false });
        scene.floatText(this.tokenPos(ev.player), `−${formatMoney(ev.price)}`, '#ffd23f');
        sound.play('buy');
        if (ev.player === me) this.banner('КУПЛЕНО!', p?.color ?? '#2ed573', cellAt(s, ev.cell).name);
        await sleep(800 * f);
        return;
      }
      case 'build': {
        sound.play(ev.sold ? 'pop' : 'build');
        scene.focusCell(ev.cell);
        await scene.setHouses(ev.cell, ev.houses, !ev.sold);
        scene.setTag(ev.cell, this.tagInfo(s, ev.cell));
        if (!ev.sold && ev.houses === 5) {
          scene.sparkle(scene.cellWorld(ev.cell, -0.6), '#ff5252', 30);
          this.banner('ОТЕЛЬ!', '#ff3b30', cellAt(s, ev.cell).name);
        }
        await sleep(200 * f);
        return;
      }
      case 'mortgage': {
        scene.setMortgaged(ev.cell, ev.mortgaged);
        scene.setTag(ev.cell, ev.mortgaged ? { text: 'ЗАЛОГ', bg: '#7d7d8a', fg: '#fff', mortgaged: true } : this.tagInfo(s, ev.cell));
        sound.play('coin');
        await sleep(350 * f);
        return;
      }
      case 'card': {
        sound.play('card');
        store().set({ card: { deck: ev.deck, title: ev.title, text: ev.text, player: ev.player, key: ev.id } });
        await this.wait(3000 * f);
        store().set({ card: null });
        return;
      }
      case 'wheel': {
        store().set({ wheel: { sector: ev.sector, text: ev.text, player: ev.player, key: ev.id } });
        await this.wait(Math.max(3000, 5300 * f));
        store().set({ wheel: null });
        return;
      }
      case 'jail': {
        if (ev.enter) {
          sound.play('jail');
          this.banner('В ТЮРЬМУ!', '#ff7a00', this.name(s, ev.player));
        } else {
          sound.play('pop');
          scene.sparkle(this.tokenPos(ev.player).setY(0.8), '#ffffff', 14);
        }
        await sleep(700 * f);
        return;
      }
      case 'auction': {
        if (ev.started) {
          sound.play('auction');
          return;
        }
        if (ev.winner) {
          const p = playerById(s, ev.winner);
          cash[ev.winner] = (cash[ev.winner] ?? 0) - ev.price;
          setCash();
          scene.buyFx(ev.cell, p?.color ?? '#fff');
          scene.setTag(ev.cell, { text: `$${rentOf(s, ev.cell, 7)}`, bg: p?.color ?? '#888', fg: '#fff', mortgaged: false });
          sound.play('auction');
          store().toast(`${p?.name} выигрывает аукцион: «${cellAt(s, ev.cell).name}» за ${formatMoney(ev.price)}`, 'success');
        } else store().toast(`«${cellAt(s, ev.cell).name}» остаётся у банка`, 'info');
        await sleep(900 * f);
        return;
      }
      case 'trade': {
        if (ev.accepted) {
          sound.play('trade');
          this.banner('СДЕЛКА!', '#2ed573', `${this.name(s, ev.from)} ⇄ ${this.name(s, ev.to)}`);
          scene.coinFlow(this.tokenPos(ev.from), this.tokenPos(ev.to), 6);
          scene.coinFlow(this.tokenPos(ev.to), this.tokenPos(ev.from), 6);
        } else if (ev.from === me) {
          sound.play('error');
          store().toast(`${this.name(s, ev.to)} отклоняет вашу сделку`, 'error');
        }
        await sleep(800 * f);
        return;
      }
      case 'owner': {
        const owner = playerById(s, ev.owner);
        if (owner) {
          scene.buyFx(ev.cell, owner.color);
          const ps = s.props[ev.cell];
          scene.setTag(ev.cell, ps?.mortgaged ? { text: 'ЗАЛОГ', bg: '#7d7d8a', fg: '#fff', mortgaged: true } : { text: `$${rentOf(s, ev.cell, 7)}`, bg: owner.color, fg: '#fff', mortgaged: false });
        } else {
          scene.setTag(ev.cell, { text: `$${priceOf(s, ev.cell)}`, bg: THEMES[s.settings.theme].priceBg, fg: THEMES[s.settings.theme].priceText, mortgaged: false });
          scene.setMortgaged(ev.cell, false);
          void scene.setHouses(ev.cell, 0, false);
        }
        await sleep(120 * f);
        return;
      }
      case 'bankrupt': {
        sound.play('bankrupt');
        this.banner('БАНКРОТ!', '#ff3b30', this.name(s, ev.player));
        await scene.bankruptToken(ev.player);
        await sleep(900 * f);
        return;
      }
      case 'jackpot': {
        const pos = this.tokenPos(ev.player);
        cash[ev.player] = (cash[ev.player] ?? 0) + ev.amount;
        setCash();
        scene.coinBurst(pos, 24);
        scene.floatText(pos, `ДЖЕКПОТ +${formatMoney(ev.amount)}`, '#ffd23f');
        sound.play('cash');
        this.banner('ДЖЕКПОТ!', '#ffd23f', `+${formatMoney(ev.amount)}`);
        await sleep(1200 * f);
        return;
      }
      case 'gameOver': {
        scene.confetti();
        sound.play('win');
        scene.overview();
        await sleep(600);
        return;
      }
    }
  }
}

export const director = new Director();
