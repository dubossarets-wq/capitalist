// Замер нагрузки: сколько кадров рисуется в простое и во время игры на каждом уровне качества.
// Браузер без видеокарты (программный рендеринг) — заведомо «слабое устройство».
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8197;
const exe = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((b) => fs.existsSync(b));
if (!exe) process.exit(0);

async function main() {
  const cli = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const saveDir = fs.mkdtempSync(path.join(os.tmpdir(), 'capitalist-perf-'));
  const server = spawn(process.execPath, [cli, 'server/index.ts'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), SAVE_DIR: saveDir }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise<void>((r) => server.stdout!.on('data', (d) => String(d).includes('localhost:') && r()));
  const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const quality of ['low', 'medium', 'high']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.addInitScript((q) => {
      localStorage.setItem('capitalist.prefs.v1', JSON.stringify({ quality: q, anim: 'full', sfx: 0, music: 0 }));
      // Считаем реальные вызовы отрисовки WebGL
      (window as any).__draws = 0;
      const orig = WebGLRenderingContext.prototype.drawElements;
      WebGLRenderingContext.prototype.drawElements = function (...a: any[]) {
        (window as any).__draws++;
        return (orig as any).apply(this, a);
      };
      const orig2 = WebGL2RenderingContext.prototype.drawElements;
      WebGL2RenderingContext.prototype.drawElements = function (...a: any[]) {
        (window as any).__draws++;
        return (orig2 as any).apply(this, a);
      };
    }, quality);
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForSelector('text=ИГРАТЬ С БОТАМИ', { timeout: 60000 });
    await page.click('text=ИГРАТЬ С БОТАМИ');
    await page.click('text=НАЧАТЬ ИГРУ');
    await page.waitForSelector('.player-card', { timeout: 60000 });
    // Игра идёт (боты ходят) — меряем
    await page.waitForTimeout(3000);
    let d0 = await page.evaluate(() => (window as any).__draws);
    await page.waitForTimeout(5000);
    const playing = (await page.evaluate(() => (window as any).__draws)) - d0;
    // Пауза: открываем меню, ждём пока всё успокоится. Ботов тормозим, выйдя на паузу? Нет — меряем ход человека в ожидании
    await page.waitForSelector('.g-btn:has-text("БРОСИТЬ КУБИКИ")', { timeout: 90000 });
    await page.waitForTimeout(2500);
    d0 = await page.evaluate(() => (window as any).__draws);
    await page.waitForTimeout(4000);
    const idle = (await page.evaluate(() => (window as any).__draws)) - d0;
    console.log(`Качество «${quality}»: вызовов отрисовки за 5 с игры — ${playing}, за 4 с простоя (ждём ход человека) — ${idle}`);
    await page.close();
  }
  await browser.close();
  server.kill();
  fs.rmSync(saveDir, { recursive: true, force: true });
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
