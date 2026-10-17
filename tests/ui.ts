// Проверка интерфейса в настоящем браузере (Edge/Chrome через playwright-core):
// скриншоты экранов, несколько ходов против ботов, сбор ошибок консоли.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.SHOTS_DIR || path.join(ROOT, 'tests', 'shots');
const PORT = 8198;
fs.mkdirSync(OUT, { recursive: true });

const browsers = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];
const exe = browsers.find((b) => fs.existsSync(b));
if (!exe) {
  console.log('Браузер не найден — пропускаю проверку интерфейса');
  process.exit(0);
}

const errors: string[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const cli = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const saveDir = fs.mkdtempSync(path.join(os.tmpdir(), 'capitalist-ui-'));
  const server = spawn(process.execPath, [cli, 'server/index.ts'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), SAVE_DIR: saveDir }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise<void>((r) => server.stdout!.on('data', (d) => String(d).includes('localhost:') && r()));

  const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const url = `http://localhost:${PORT}/`;

  // Иконки приложения из SVG
  {
    const p = await browser.newPage();
    const svg = fs.readFileSync(path.join(ROOT, 'public', 'icon.svg'), 'utf8');
    for (const size of [192, 512]) {
      await p.setViewportSize({ width: size, height: size });
      await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
      await p.screenshot({ path: path.join(ROOT, 'public', `icon-${size}.png`), omitBackground: true });
    }
    await p.close();
  }

  const lowGfx = (page: Page) =>
    page.addInitScript(() => {
      try {
        localStorage.setItem('capitalist.prefs.v1', JSON.stringify({ quality: 'low', anim: 'full', sfx: 0, music: 0 }));
      } catch {}
    });
  const watch = (page: Page, tag: string) => {
    void lowGfx(page);
    page.on('pageerror', (e) => errors.push(`[${tag}] ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`[${tag}] console: ${m.text()}`);
    });
  };

  // ───── Компьютер ─────
  const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  watch(desk, 'desktop');
  await desk.goto(url);
  await desk.waitForSelector('text=ИГРАТЬ С БОТАМИ', { timeout: 20000 });
  await sleep(2500);
  await desk.screenshot({ path: path.join(OUT, '01-menu.png') });

  await desk.click('text=ИГРАТЬ С БОТАМИ');
  await sleep(800);
  await desk.screenshot({ path: path.join(OUT, '02-setup.png') });
  await desk.click('.tab:has-text("Правила")');
  await sleep(300);
  await desk.screenshot({ path: path.join(OUT, '03-setup-rules.png') });
  await desk.click('.tab:has-text("Поле")');
  await sleep(300);
  await desk.screenshot({ path: path.join(OUT, '04-setup-board.png') });

  await desk.click('text=НАЧАТЬ ИГРУ');
  await sleep(4500);
  await desk.screenshot({ path: path.join(OUT, '05-game-start.png') });

  // Играем несколько ходов
  let shotBuy = false;
  let shotDice = false;
  let shotProps = false;
  const deadline = Date.now() + 100000;
  let turns = 0;
  while (Date.now() < deadline && turns < 8) {
    if (await desk.isVisible('text=КУПИТЬ $')) {
      if (!shotBuy) {
        await desk.screenshot({ path: path.join(OUT, '07-buy.png') });
        shotBuy = true;
      }
      const btn = desk.locator('.g-btn:has-text("КУПИТЬ $")').first();
      if (await btn.isEnabled()) await btn.click();
      else await desk.click('.g-btn:has-text("АУКЦИОН")');
    } else if (await desk.isVisible('.g-btn:has-text("БРОСИТЬ КУБИКИ")')) {
      await desk.click('.g-btn:has-text("БРОСИТЬ КУБИКИ")');
      if (!shotDice) {
        await sleep(700);
        await desk.screenshot({ path: path.join(OUT, '06-dice.png') });
        shotDice = true;
      }
    } else if (await desk.isVisible('.g-btn:has-text("ЗАВЕРШИТЬ ХОД")')) {
      if (!shotProps) {
        await desk.click('.g-btn:has-text("МОЯ НЕДВИЖИМОСТЬ")');
        await sleep(500);
        await desk.screenshot({ path: path.join(OUT, '08-props.png') });
        await desk.click('.g-window__close .g-btn');
        shotProps = true;
        await sleep(300);
      }
      await desk.click('.g-btn:has-text("ЗАВЕРШИТЬ ХОД")');
      turns++;
    } else if (await desk.isVisible('.g-btn:has-text("ПРИНЯТЬ")')) {
      await desk.click('.g-btn:has-text("ОТКЛОНИТЬ")');
    } else if (await desk.isVisible('.g-btn:has-text("ПАС")')) {
      const pas = desk.locator('.g-btn:has-text("ПАС")');
      if (await pas.isEnabled()) await pas.click();
    } else if (await desk.isVisible('.g-btn:has-text("ЗАПЛАТИТЬ")') && (await desk.isVisible('text=Нужно заплатить'))) {
      await desk.click('.g-btn:has-text("ОБЪЯВИТЬ БАНКРОТСТВО")');
      await desk.click('.g-btn:has-text("ДА")');
    }
    await sleep(400);
    if (process.env.UI_DEBUG) {
      const pill = await desk.locator('.status-pill').first().textContent({ timeout: 200 }).catch(() => '');
      const btns = await desk.locator('.action-bar .g-btn').allTextContents().catch(() => []);
      const modal = await desk.locator('.g-window__title').allTextContents().catch(() => []);
      console.log(new Date().toISOString().slice(14, 19), 'ходов', turns, '| статус:', pill, '| кнопки:', btns.join(' / '), '| окна:', modal.join(' / '));
    }
    if (turns === 3) await desk.screenshot({ path: path.join(OUT, '09-midgame.png') });
  }
  console.log(`Сыграно ходов человеком в браузере: ${turns}`);
  // Торговля
  await desk.click('.g-btn:has-text("ТОРГОВЛЯ")').catch(() => {});
  await sleep(500);
  await desk.screenshot({ path: path.join(OUT, '10-trade.png') });
  await desk.locator('.g-window__close .g-btn').first().click().catch(() => {});
  await sleep(400);
  // Пауза
  await desk.locator('button[title="Меню"]').click({ timeout: 5000 }).catch((e) => errors.push('[desktop] не открылось меню паузы: ' + e.message));
  await sleep(500);
  await desk.screenshot({ path: path.join(OUT, '11-pause.png') });
  await desk.close();

  // ───── Лобби Wi-Fi ─────
  const lob = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  watch(lob, 'lobby');
  await lob.goto(url);
  await lob.waitForSelector('text=СОЗДАТЬ WI-FI КОМНАТУ', { timeout: 20000 });
  await lob.click('text=СОЗДАТЬ WI-FI КОМНАТУ');
  await lob.waitForSelector('.room-code', { timeout: 10000 });
  await lob.click('.g-btn:has-text("ДОБАВИТЬ БОТА")');
  await sleep(1200);
  await lob.screenshot({ path: path.join(OUT, '12-lobby.png') });
  const code = (await lob.textContent('.room-code'))?.trim();

  // ───── Телефон (портрет) — входит в комнату по ссылке ─────
  const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' });
  const phone = await phoneCtx.newPage();
  watch(phone, 'phone');
  await phone.goto(url);
  await phone.waitForSelector('text=ИГРАТЬ С БОТАМИ', { timeout: 90000 });
  await sleep(1500);
  await phone.screenshot({ path: path.join(OUT, '13-phone-menu.png') });
  await phone.goto(`${url}?room=${code}`);
  try {
    await phone.waitForSelector('.room-code', { timeout: 60000 });
  } catch (e) {
    const toasts = await phone.locator('.toast').allTextContents();
    const title = await phone.locator('.screen-title').allTextContents();
    await phone.screenshot({ path: path.join(OUT, 'xx-phone-fail.png') });
    throw new Error(`Телефон не вошёл в комнату: экран «${title.join()}», уведомления: ${toasts.join(' | ')}`);
  }
  await sleep(800);
  await phone.screenshot({ path: path.join(OUT, '14-phone-lobby.png') });
  await phone.click('.g-btn:has-text("ГОТОВ")');
  await sleep(500);
  await lob.click('.g-btn:has-text("НАЧАТЬ ИГРУ")');
  await phone.waitForSelector('.player-card', { timeout: 60000 });
  await sleep(5000);
  await phone.screenshot({ path: path.join(OUT, '15-phone-game.png') });
  await lob.screenshot({ path: path.join(OUT, '16-host-game.png') });

  // Телефон в альбомной ориентации
  await phone.setViewportSize({ width: 844, height: 390 });
  await sleep(1200);
  await phone.screenshot({ path: path.join(OUT, '17-phone-landscape.png') });

  await browser.close();
  server.kill();
  fs.rmSync(saveDir, { recursive: true, force: true });
  if (errors.length) {
    console.log(`Ошибки в браузере (${errors.length}):`);
    [...new Set(errors)].slice(0, 30).forEach((e) => console.log(' - ' + e));
    process.exit(1);
  }
  console.log(`Ошибок в браузере нет. Скриншоты: ${OUT}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  if (errors.length) console.log(errors.join('\n'));
  process.exit(1);
});
