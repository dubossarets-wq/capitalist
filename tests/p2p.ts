// Проверка игры по Wi-Fi без сервера на компьютере (онлайн-версия, WebRTC между браузерами).
// Хозяин и гости — отдельные окна браузера со своим хранилищем, как разные устройства.
// Требует собранной онлайн-версии (dist-pages) и доступа в интернет для сигнальных серверов.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page, type BrowserContext } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4179;
const URL = `http://localhost:${PORT}/capitalist/`;
const OUT = process.env.SHOTS_DIR || path.join(ROOT, 'tests', 'shots');
fs.mkdirSync(OUT, { recursive: true });
const exe = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((b) => fs.existsSync(b));
if (!exe) process.exit(0);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const failures: string[] = [];
const check = (c: unknown, m: string) => {
  if (!c) {
    failures.push(m);
    console.log('   ✗ ' + m);
  }
};

async function newDevice(browser: any, name: string, mobile = false): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  page.on('pageerror', (e: Error) => failures.push(`[${name}] ошибка JS: ${e.message}`));
  await page.addInitScript((n: string) => {
    if (!localStorage.getItem('capitalist.profile.v1')) localStorage.setItem('capitalist.profile.v1', JSON.stringify({ name: n }));
    localStorage.setItem('capitalist.prefs.v1', JSON.stringify({ quality: 'low', anim: 'minimal', sfx: 0, music: 0 }));
  }, name);
  return { ctx, page };
}

/** Простая «рука» игрока: действует в свой ход через тот же интерфейс действий, что и кнопки */
async function playStep(page: Page) {
  await page.evaluate(() => {
    const cap = (window as any).__cap;
    const st = cap.store.getState();
    const g = st.game;
    if (!g || st.animating || g.phase === 'gameOver') return;
    const me = g.players.find((p: any) => p.id === st.myId);
    if (!me || me.bankrupt) return;
    const t = g.trades.find((x: any) => x.status === 'pending' && x.to === me.id);
    if (t) return cap.act({ type: 'rejectTrade', tradeId: t.id });
    if (g.phase === 'auction' && g.auction?.participants.includes(me.id) && g.auction.highBidder !== me.id) return cap.act({ type: 'pass' });
    if (g.phase === 'debt' && g.debt?.player === me.id) return cap.act({ type: me.cash >= g.debt.amount ? 'payDebt' : 'bankrupt' });
    if (g.players[g.current].id !== me.id) return;
    if (g.phase === 'roll') cap.act({ type: 'roll' });
    else if (g.phase === 'buy') cap.act({ type: me.cash > 400 ? 'buy' : 'decline' });
    else if (g.phase === 'action') cap.act({ type: 'endTurn' });
  });
}

const snapshot = (page: Page) =>
  page.evaluate(() => {
    const g = (window as any).__cap.store.getState().game;
    return g ? { v: g.version, turn: g.turn, cash: g.players.map((p: any) => p.cash).join(','), owners: JSON.stringify(Object.values(g.props).map((x: any) => x.owner)) } : null;
  });

async function main() {
  // Раздаём онлайн-версию так же, как GitHub Pages (подпуть /capitalist/)
  const vite = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  const server = spawn(process.execPath, [vite, 'preview', '--outDir', 'dist-pages', '--base', '/capitalist/', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise<void>((r) => server.stdout!.on('data', (d) => String(d).includes(String(PORT)) && r()));
  const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

  try {
    // ───── 1. Вход по коду ─────
    console.log('1. Комната по коду: хозяин в браузере + 2 гостя');
    const host = await newDevice(browser, 'Хозяин');
    const g1 = await newDevice(browser, 'Гость1', true);
    const g2 = await newDevice(browser, 'Гость2', true);
    await host.page.goto(URL);
    await host.page.waitForSelector('text=СОЗДАТЬ WI-FI КОМНАТУ', { timeout: 60000 });
    await host.page.click('text=СОЗДАТЬ WI-FI КОМНАТУ');
    await host.page.waitForSelector('.room-code', { timeout: 20000 });
    const code = (await host.page.textContent('.room-code'))!.trim();
    console.log(`   комната создана в браузере хозяина, код ${code}`);

    const t0 = Date.now();
    // Гость 1 — по ссылке из QR-кода, гость 2 — вводит код вручную
    await g1.page.goto(`${URL}?room=${code}`);
    await g2.page.goto(URL);
    await g2.page.waitForSelector('text=ПРИСОЕДИНИТЬСЯ К КОМНАТЕ', { timeout: 60000 });
    await g2.page.click('text=ПРИСОЕДИНИТЬСЯ К КОМНАТЕ');
    await g2.page.fill('input.code', code);
    await g2.page.click('.g-btn:has-text("ВОЙТИ")');
    await Promise.all([g1.page.waitForSelector('.room-code', { timeout: 60000 }), g2.page.waitForSelector('.room-code', { timeout: 60000 })]);
    console.log(`   ✓ оба гостя вошли в лобби за ${((Date.now() - t0) / 1000).toFixed(1)} с`);
    await host.page.waitForFunction(() => (window as any).__cap.store.getState().room?.seats.length === 3, null, { timeout: 15000 });

    // Хозяин меняет настройки — гости видят сразу
    await host.page.evaluate(() => {
      const cap = (window as any).__cap;
      const r = cap.store.getState().room;
      cap.net.send({ t: 'updateSettings', settings: { ...r.settings, boardId: 'express', quickGame: true, maxTurns: 6 } });
    });
    await g1.page.waitForFunction(() => (window as any).__cap.store.getState().room?.settings.boardId === 'express', null, { timeout: 10000 });
    console.log('   ✓ гость видит изменения настроек хозяина');

    await host.page.click('.g-btn:has-text("ДОБАВИТЬ БОТА")');
    for (const g of [g1, g2]) await g.page.click('.g-btn:has-text("ГОТОВ")');
    await host.page.waitForFunction(() => (window as any).__cap.store.getState().room?.seats.every((s: any) => s.isBot || s.isHost || s.ready), null, { timeout: 10000 });
    await host.page.click('.g-btn:has-text("НАЧАТЬ ИГРУ")');
    await Promise.all([host, g1, g2].map((d) => d.page.waitForSelector('.player-card', { timeout: 30000 })));
    console.log('   ✓ партия началась у всех');

    // Играем; посреди партии гость 1 перезагружает страницу
    let reloaded = false;
    const end = Date.now() + 150000;
    while (Date.now() < end) {
      for (const d of [host, g1, g2]) await playStep(d.page).catch(() => {});
      const s = await snapshot(host.page);
      if (!reloaded && s && s.turn >= 4) {
        reloaded = true;
        await g1.page.reload();
        await g1.page.waitForSelector('.player-card', { timeout: 40000 });
        console.log('   ✓ гость перезагрузил страницу и вернулся в партию');
      }
      const over = await host.page.evaluate(() => (window as any).__cap.store.getState().game?.phase === 'gameOver');
      if (over) break;
      await sleep(400);
    }
    await sleep(3000);
    const [a, b, c] = await Promise.all([host, g1, g2].map((d) => snapshot(d.page)));
    console.log(`   хозяин: ход ${a?.turn}, версия ${a?.v}; гость1: ${b?.v}; гость2: ${c?.v}`);
    check(a && b && c && a.v === b.v && a.v === c.v, 'состояние партии у устройств различается по версии');
    check(a && b && c && a.cash === b.cash && a.cash === c.cash && a.owners === b.owners && a.owners === c.owners, 'балансы или владельцы участков различаются');
    const over = await host.page.evaluate(() => (window as any).__cap.store.getState().game?.phase);
    console.log(`   фаза партии: ${over}`);
    check(over === 'gameOver', 'партия не дошла до конца');
    if (!failures.length) console.log('   ✓ у всех трёх устройств одинаковое состояние партии');
    await host.page.screenshot({ path: path.join(OUT, 'p2p-host.png') });
    await g2.page.screenshot({ path: path.join(OUT, 'p2p-guest.png') });
    for (const d of [host, g1, g2]) await d.ctx.close();

    // ───── 2. Без интернета: обмен QR-кодами ─────
    console.log('2. Подключение без интернета (обмен QR-кодами)');
    const h2 = await newDevice(browser, 'Хозяин2');
    const g3 = await newDevice(browser, 'Гость3', true);
    await h2.page.goto(URL);
    await h2.page.waitForSelector('text=СОЗДАТЬ WI-FI КОМНАТУ', { timeout: 60000 });
    await h2.page.click('text=СОЗДАТЬ WI-FI КОМНАТУ');
    await h2.page.waitForSelector('.room-code', { timeout: 20000 });
    await g3.page.goto(URL);
    await g3.page.waitForSelector('text=ИГРАТЬ С БОТАМИ', { timeout: 60000 });
    // Хозяин показывает QR (здесь — текст из QR), гость «сканирует»
    const offer = await h2.page.evaluate(async () => {
      const inv = await (window as any).__cap.getHost().offlineInvite();
      (window as any).__inv = inv;
      return inv.code as string;
    });
    console.log(`   длина QR хозяина: ${offer.length} символов`);
    const answer = await g3.page.evaluate(
      (offer: string) =>
        new Promise<string>((resolve) => {
          (window as any).__cap.joinOffline(offer, (a: string) => resolve(a)).catch(() => {});
        }),
      offer,
    );
    console.log(`   длина ответного QR гостя: ${answer.length} символов`);
    await h2.page.evaluate((a: string) => (window as any).__inv.accept(a), answer);
    await g3.page.waitForSelector('.room-code', { timeout: 20000 });
    await h2.page.waitForFunction(() => (window as any).__cap.store.getState().room?.seats.length === 2, null, { timeout: 10000 });
    console.log('   ✓ гость вошёл в комнату без сигнальных серверов');
    await g3.page.screenshot({ path: path.join(OUT, 'p2p-offline-guest.png') });
  } finally {
    await browser.close();
    server.kill();
  }
  if (failures.length) {
    console.log(`\nОШИБКИ (${failures.length}):`);
    [...new Set(failures)].forEach((f) => console.log(' - ' + f));
    process.exit(1);
  }
  console.log('\nВсе проверки игры по Wi-Fi без сервера пройдены.');
  process.exit(0);
}

main().catch((e) => {
  console.error('Тест упал:', e.message);
  [...new Set(failures)].forEach((f) => console.log(' - ' + f));
  process.exit(1);
});
