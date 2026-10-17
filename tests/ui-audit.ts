// Аудит интерфейса: каждый экран и игровое окно на разных размерах экрана.
// Автоматически ищет перекрытый текст, обрезанный текст, элементы за краем экрана
// и слишком мелкие кнопки на сенсорных экранах. Скриншоты — в SHOTS_DIR.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.SHOTS_DIR || path.join(ROOT, 'tests', 'shots', 'audit');
const PORT = 8195;
fs.mkdirSync(OUT, { recursive: true });
const exe = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((b) => fs.existsSync(b));
if (!exe) process.exit(0);

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844, mobile: true },
  { name: 'phone-land', width: 844, height: 390, mobile: true },
  { name: 'tablet', width: 820, height: 1180, mobile: true },
  { name: 'desktop', width: 1440, height: 900, mobile: false },
].filter((v) => !process.env.ONLY || process.env.ONLY.split(',').includes(v.name));

const issues: string[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Проверки расположения элементов прямо в странице */
async function inspect(page: Page, label: string, touch: boolean) {
  const found: string[] = await page.evaluate((touch) => {
    const out: string[] = [];
    const vw = innerWidth;
    const vh = innerHeight;
    const layer = document.querySelector('.ui-layer')!;
    const visible = (e: Element) => {
      const st = getComputedStyle(e);
      return st.visibility !== 'hidden' && st.display !== 'none' && Number(st.opacity) > 0.05;
    };
    const scrollParent = (e: Element) => {
      for (let p = e.parentElement; p && p !== layer; p = p.parentElement) {
        const st = getComputedStyle(p);
        if (/(auto|scroll)/.test(st.overflowX + st.overflowY)) return p;
      }
      return null;
    };
    const leaves = [...layer.querySelectorAll('*')].filter((e) => visible(e) && !e.closest('.event-card__back') && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()));
    const related = (a: Element, b: Element) => a === b || a.contains(b) || b.contains(a);
    for (const e of leaves) {
      const r = e.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const text = (e.textContent || '').trim().slice(0, 28);
      const sp = scrollParent(e);
      // Видимость в пределах области прокрутки
      if (sp) {
        const pr = sp.getBoundingClientRect();
        if (r.bottom < pr.top || r.top > pr.bottom || r.right < pr.left || r.left > pr.right) continue;
      }
      if (r.bottom < 0 || r.top > vh) continue;
      // За краем экрана (без прокрутки)
      if (!sp && (r.right > vw + 1 || r.left < -1)) out.push(`за краем экрана: «${text}» (${Math.round(r.left)}…${Math.round(r.right)} из ${vw})`);
      // Перекрытие другим элементом с текстом
      const pts = [
        [r.left + r.width / 2, r.top + r.height / 2],
        [r.left + 3, r.top + r.height / 2],
        [r.right - 3, r.top + r.height / 2],
      ];
      for (const [x, y] of pts) {
        if (x < 0 || y < 0 || x > vw || y > vh) continue;
        const top = document.elementFromPoint(x, y);
        if (!top || related(top, e)) continue;
        // Перекрыто окном/затемнением — это нормально, если элемент под модальным окном
        if (top.closest('.modal-backdrop') && !e.closest('.modal-backdrop')) break;
        if (top.closest('.modal-backdrop') !== e.closest('.modal-backdrop') && e.closest('.modal-backdrop')) break;
        const topText = top.closest('*');
        const hasText = [...(topText?.childNodes ?? [])].some((n) => n.nodeType === 3 && n.textContent!.trim()) || !!top.closest('button, input, .g-btn, .tag, .chip-btn');
        // Перекрытие кнопкой/текстом другого текста
        if (hasText && !top.closest('.badge')) {
          out.push(`текст перекрыт: «${text}» ← «${(top.textContent || top.tagName).trim().slice(0, 24)}»`);
          break;
        }
      }
      // Вылезает за фон своего окна (если между ним и окном нет области прокрутки)
      const win = e.closest('.g-window');
      if (win && !(sp && win.contains(sp)) && !e.closest('.g-window__title, .g-window__close, .badge')) {
        const wr = win.getBoundingClientRect();
        if (r.bottom > wr.bottom + 2 || r.right > wr.right + 2 || r.left < wr.left - 2 || r.top < wr.top - 2) out.push(`вылезает за окно: «${text}»`);
      }
      // Обрезанный текст
      const st = getComputedStyle(e);
      if (e.scrollWidth > e.clientWidth + 2 && st.overflow !== 'visible' && e.clientWidth > 0) out.push(`текст обрезан${st.textOverflow === 'ellipsis' ? ' многоточием' : ''}: «${text}»`);
    }
    for (const b of layer.querySelectorAll('button, .pick-card, .seat-card, .inner, .setting-row')) {
      if (!visible(b)) continue;
      const win = b.closest('.g-window');
      if (!win || b.closest('.g-window__title, .g-window__close')) continue;
      const sp = scrollParent(b);
      const r = b.getBoundingClientRect();
      if (sp && win.contains(sp)) continue;
      const wr = win.getBoundingClientRect();
      if (r.bottom > wr.bottom + 2 || r.right > wr.right + 2 || r.left < wr.left - 2) out.push(`элемент вылезает за окно: «${(b.textContent || b.className).trim().slice(0, 24)}»`);
    }
    // Мелкие кнопки на сенсорных экранах
    if (touch) {
      for (const b of layer.querySelectorAll('button')) {
        if (!visible(b)) continue;
        const r = b.getBoundingClientRect();
        if (r.width === 0 || r.bottom < 0 || r.top > vh) continue;
        if (b.closest('.wheel-wrap')) continue;
        if (r.width < 30 || r.height < 30) out.push(`мелкая кнопка: «${(b.textContent || b.title || 'без текста').trim().slice(0, 20)}» ${Math.round(r.width)}×${Math.round(r.height)}`);
      }
    }
    // Горизонтальная прокрутка всей страницы
    if (document.documentElement.scrollWidth > vw + 1) out.push(`страница шире экрана: ${document.documentElement.scrollWidth} > ${vw}`);
    return [...new Set(out)];
  }, touch);
  for (const f of found) issues.push(`[${label}] ${f}`);
  return found.length;
}

async function shot(page: Page, vp: (typeof VIEWPORTS)[number], name: string) {
  await sleep(650);
  await page.screenshot({ path: path.join(OUT, `${vp.name}-${name}.png`) });
  const n = await inspect(page, `${vp.name}/${name}`, vp.mobile);
  process.stdout.write(n ? `  ${name}: ${n} замечаний\n` : `  ${name}: ок\n`);
}

/** Изменить состояние игры прямо в хранилище интерфейса */
async function setGame(page: Page, patch: string) {
  await page.evaluate((code) => {
    const st = (window as any).__cap.store.getState();
    const g = JSON.parse(JSON.stringify(st.game));
    const me = g.players.findIndex((p: any) => p.id === st.myId);
    // eslint-disable-next-line no-new-func
    const extra = new Function('g', 'me', 'st', code)(g, me, st) || {};
    st.set({ game: g, animating: false, dialog: null, selectedCell: null, card: null, wheel: null, order: null, banner: null, ...extra });
  }, patch);
}

async function main() {
  const cli = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const saveDir = fs.mkdtempSync(path.join(os.tmpdir(), 'capitalist-audit-'));
  const server = spawn(process.execPath, [cli, 'server/index.ts'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), SAVE_DIR: saveDir }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise<void>((r) => server.stdout!.on('data', (d) => String(d).includes('localhost:') && r()));
  const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const url = `http://localhost:${PORT}/`;

  for (const vp of VIEWPORTS) {
    console.log(`\n${vp.name} ${vp.width}×${vp.height}`);
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => issues.push(`[${vp.name}] ошибка JS: ${e.message}`));
    await page.addInitScript('window.__name = (f) => f;');
    await page.addInitScript(() => {
      localStorage.setItem('capitalist.prefs.v1', JSON.stringify({ quality: 'low', anim: 'minimal', sfx: 0, music: 0 }));
      localStorage.setItem('capitalist.profile.v1', JSON.stringify({ name: 'Александра', token: 'crown', color: '#A55EEA', avatar: 'a4' }));
    });
    await page.goto(url);
    await page.waitForSelector('.menu-buttons', { timeout: 120000 });
    const go = (s: string) => page.evaluate((s) => (window as any).__cap.store.getState().go(s), s);

    await shot(page, vp, '01-menu');
    for (const [s, n] of [
      ['settings', '02-settings'],
      ['rules', '03-rules'],
      ['profile', '04-profile'],
      ['records', '05-records'],
      ['editor', '06-editor'],
      ['join', '07-join'],
    ] as const) {
      await go(s);
      await shot(page, vp, n);
    }
    await go('setup');
    await shot(page, vp, '08-setup');
    for (const [tab, n] of [
      ['Поле', '09-setup-board'],
      ['Правила', '10-setup-rules'],
      ['Экономика', '11-setup-eco'],
    ]) {
      await page.click(`.tab:has-text("${tab}")`);
      await shot(page, vp, n);
    }
    // Лобби
    await go('menu');
    await page.click('.g-btn:has-text("СОЗДАТЬ WI-FI КОМНАТУ")');
    await page.waitForSelector('.room-code', { timeout: 20000 });
    await page.click('.g-btn:has-text("ДОБАВИТЬ БОТА")');
    await page.click('.g-btn:has-text("ДОБАВИТЬ БОТА")');
    await shot(page, vp, '12-lobby');
    await page.click('.g-btn[title="Выйти из комнаты"]');
    await page.waitForSelector('.screen-title:has-text("ИГРА ПО WI-FI")', { timeout: 10000 });
    await go('menu');

    // Игра с ботами
    await go('setup');
    await page.click('.g-btn:has-text("НАЧАТЬ ИГРУ")');
    await page.waitForSelector('.player-card', { timeout: 60000 });
    await sleep(2500);
    await page.evaluate(() => (globalThis as any).__capFreeze());
    await sleep(500);
    const base = `
      g.phase = 'roll'; g.current = me; g.players[me].position = 1; g.auction = null; g.debt = null;
      [1, 3, 6, 8, 9, 5, 12].forEach((i) => { g.props[i].owner = g.players[me].id; });
      g.props[1].houses = 2; g.props[3].houses = 2; g.props[6].mortgaged = true;
      [11, 13, 14].forEach((i) => { g.props[i].owner = g.players[(me + 1) % g.players.length].id; });
      g.props[14].houses = 0;
    `;
    await setGame(page, base);
    await shot(page, vp, '13-game-hud');
    await setGame(page, base + `g.phase = 'action';`);
    await shot(page, vp, '14-game-action');
    await setGame(page, base + `g.phase = 'buy'; g.players[me].position = 16; g.props[16].owner = null;`);
    await shot(page, vp, '15-buy');
    await setGame(page, base + `const other = g.players[(me + 1) % g.players.length]; g.phase = 'auction'; g.current = (me + 1) % g.players.length; g.auction = { cell: 16, highBid: 120, highBidder: other.id, participants: g.players.map((p) => p.id), endsAt: Date.now() + 8000, starter: other.id }; g.props[16].owner = null;`);
    await shot(page, vp, '16-auction');
    await setGame(page, base + `g.phase = 'debt'; g.debt = { player: g.players[me].id, amount: 350, creditor: g.players[(me + 1) % g.players.length].id, reason: 'аренда «Барселона»' }; g.players[me].cash = 120;`);
    await shot(page, vp, '17-debt');
    await setGame(page, base + `return { dialog: 'props', propsMode: 'all', propsOwner: st.myId };`);
    await shot(page, vp, '18-props');
    await setGame(page, base + `return { dialog: 'props', propsMode: 'build', propsOwner: st.myId };`);
    await shot(page, vp, '19-props-build');
    await setGame(page, base + `return { dialog: 'trade', tradeDraft: { to: g.players[(me + 1) % g.players.length].id, giveMoney: 150, giveCells: [9], getMoney: 0, getCells: [11] } };`);
    await shot(page, vp, '20-trade');
    await setGame(page, base + `const o = g.players[(me + 1) % g.players.length]; g.trades.push({ id: 'tx', from: o.id, to: g.players[me].id, giveMoney: 200, giveCells: [11], getMoney: 0, getCells: [9], status: 'pending', createdAt: Date.now() });`);
    await shot(page, vp, '21-trade-incoming');
    await setGame(page, base + `return { selectedCell: 11 };`);
    await shot(page, vp, '22-cell-info');
    await setGame(page, base + `return { selectedCell: 0 };`);
    await shot(page, vp, '23-cell-corner');
    await setGame(page, base + `return { dialog: 'pause' };`);
    await shot(page, vp, '24-pause');
    await setGame(page, base + `return { card: { deck: 'chance', title: 'Путешествие', text: 'Отправляйтесь к ближайшему транспорту. Если он чужой — заплатите двойную аренду', player: g.players[me].id, key: 1 } };`);
    await sleep(800);
    await shot(page, vp, '25-card');
    await setGame(page, base + `return { wheel: { sector: 7, text: 'ДЖЕКПОТ! +$300', player: g.players[me].id, key: 2 } };`);
    await sleep(4500);
    await shot(page, vp, '26-wheel');
    await setGame(page, base + `return { order: { rolls: g.players.map((p, i) => ({ player: p.id, roll: 12 - i })) } };`);
    await sleep(1400);
    await shot(page, vp, '27-order');
    await setGame(page, base + `g.phase = 'gameOver'; g.winner = g.players[me].id; g.players.forEach((p, i) => { if (i !== me) p.bankrupt = true; });`);
    await shot(page, vp, '28-gameover');
    await setGame(page, base + `return { dialog: 'log' };`);
    await shot(page, vp, '29-log');
    await ctx.close();
  }

  await browser.close();
  server.kill();
  fs.rmSync(saveDir, { recursive: true, force: true });
  console.log(`\nЗамечаний: ${issues.length}`);
  issues.forEach((i) => console.log(' - ' + i));
  console.log(`Скриншоты: ${OUT}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  issues.forEach((i) => console.log(' - ' + i));
  process.exit(1);
});
