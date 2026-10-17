// Локальный сервер для игры по Wi-Fi.
// Раздаёт собранную игру и синхронизирует партии через WebSocket. Интернет не нужен.

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import qrcodeTerminal from 'qrcode-terminal';
import { RoomManager } from './rooms';
import type { ServerInfo } from '../shared/protocol';
import { setGlobalSpeed } from '../shared/engine';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 8080;
const SAVE_DIR = process.env.SAVE_DIR || path.join(ROOT, 'saves');
if (process.env.SPEED) setGlobalSpeed(Number(process.env.SPEED));

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8',
};

function lanAddresses(): string[] {
  const out: { ip: string; score: number }[] = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      // Виртуальные адаптеры (VirtualBox, WSL, VPN) ставим в конец
      const virtual = /virtual|vbox|vmware|wsl|hyper-v|vethernet|docker|tailscale|zerotier|hamachi/i.test(name);
      const privateNet = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address);
      out.push({ ip: a.address, score: (privateNet ? 2 : 0) + (virtual ? -3 : 0) + (a.address.startsWith('192.168.') ? 1 : 0) });
    }
  }
  return out.sort((a, b) => b.score - a.score).map((x) => x.ip);
}

const info = (): ServerInfo => ({
  urls: lanAddresses().map((ip) => `http://${ip}:${PORT}`),
  port: PORT,
  version: '1.0.0',
});

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname === '/api/info') {
    res.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(info()));
    return;
  }
  // Служебная остановка с сохранением — только для автотестов
  if (url.pathname === '/api/shutdown' && process.env.TEST_SHUTDOWN === '1') {
    manager.stopAll();
    manager.save();
    res.end('ok');
    setTimeout(() => process.exit(0), 50);
    return;
  }
  if (!fs.existsSync(DIST)) {
    res.writeHead(200, { 'Content-Type': MIME['.html'] });
    res.end('<h1>Игра ещё не собрана</h1><p>Выполните <code>npm run build</code> или запустите <code>npm start</code>.</p>');
    return;
  }
  let file = path.normalize(path.join(DIST, decodeURIComponent(url.pathname)));
  if (!file.startsWith(DIST)) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  const ext = path.extname(file).toLowerCase();
  const immutable = file.includes(`${path.sep}assets${path.sep}`);
  res.writeHead(200, {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  fs.createReadStream(file).pipe(res);
});

const manager = new RoomManager(SAVE_DIR, info);
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 512 * 1024 });
wss.on('connection', (ws) => {
  manager.attach(ws as any);
  // Пинг для обнаружения оборванных соединений
  (ws as any).alive = true;
  ws.on('pong', () => ((ws as any).alive = true));
});
setInterval(() => {
  for (const ws of wss.clients) {
    if (!(ws as any).alive) {
      ws.terminate();
      continue;
    }
    (ws as any).alive = false;
    ws.ping();
  }
}, 10000).unref();

server.listen(PORT, '0.0.0.0', () => {
  const urls = info().urls;
  console.log('\n  ╔══════════════════════════════════════════════╗');
  console.log('  ║        КАПИТАЛИСТ — локальный сервер         ║');
  console.log('  ╚══════════════════════════════════════════════╝\n');
  console.log(`  На этом компьютере:  http://localhost:${PORT}`);
  if (urls.length) {
    console.log('  Для телефонов и других устройств в той же Wi-Fi сети:');
    urls.forEach((u) => console.log(`     ${u}`));
    console.log('\n  Отсканируйте QR-код камерой телефона:\n');
    qrcodeTerminal.generate(urls[0], { small: true }, (q: string) => console.log(q.replace(/^/gm, '     ')));
  } else {
    console.log('  Сетевой адрес не найден — подключитесь к Wi-Fi.');
  }
  console.log('  Остановить сервер: Ctrl+C\n');
});

server.on('error', (e: NodeJS.ErrnoException) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n  Порт ${PORT} занят. Возможно, сервер уже запущен. Укажите другой порт: PORT=8081 npm run serve\n`);
    process.exit(1);
  }
  throw e;
});

const shutdown = () => {
  manager.stopAll();
  manager.save();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
