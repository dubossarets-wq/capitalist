// Процедурные текстуры (Canvas 2D): клетки, углы, центр поля, стол, кубики, ценники.
import * as THREE from 'three';
import type { BoardDef, CellDef, DiceStyleId } from '../../shared/types';
import type { ThemeDef } from './themes';

export const FONT_TITLE = '"Russo One", "Rubik", sans-serif';
export const FONT_TEXT = '"Rubik", sans-serif';

let maxAniso = 4;
export function setMaxAnisotropy(v: number) {
  maxAniso = v;
}

export function canvasTexture(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  t.needsUpdate = true;
  return t;
}

function mk(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function shade(hex: string, k: number) {
  const c = new THREE.Color(hex);
  if (k > 0) c.lerp(new THREE.Color('#ffffff'), k);
  else c.lerp(new THREE.Color('#000000'), -k);
  return '#' + c.getHexString();
}
export { shade };

/** Перенос текста по словам с подбором размера шрифта */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number, size: number, font: string, minSize = 16) {
  for (let s = size; s >= minSize; s -= 2) {
    ctx.font = `${font.startsWith('700') || font.startsWith('900') ? '' : '700 '}${s}px ${font}`;
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width <= maxW) cur = t;
      else {
        if (cur) lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxW)) return { lines, size: s };
  }
  ctx.font = `700 ${minSize}px ${font}`;
  return { lines: [text], size: minSize };
}

function drawLines(ctx: CanvasRenderingContext2D, lines: string[], cx: number, cy: number, size: number) {
  const lh = size * 1.08;
  const y0 = cy - ((lines.length - 1) * lh) / 2;
  lines.forEach((l, i) => ctx.fillText(l, cx, y0 + i * lh));
}

// ───────────── Иконки клеток ─────────────

type Draw = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => void;

const iconPlane: Draw = (ctx, x, y, s) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 4);
  ctx.scale(s / 100, s / 100);
  const g = ctx.createLinearGradient(0, -50, 0, 50);
  g.addColorStop(0, '#9fd8ff');
  g.addColorStop(1, '#1e6fd9');
  ctx.fillStyle = g;
  ctx.strokeStyle = '#0d3b7a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, -50);
  ctx.quadraticCurveTo(9, -40, 8, -12);
  ctx.lineTo(48, 12);
  ctx.lineTo(48, 22);
  ctx.lineTo(8, 10);
  ctx.lineTo(6, 34);
  ctx.lineTo(20, 44);
  ctx.lineTo(20, 50);
  ctx.lineTo(0, 45);
  ctx.lineTo(-20, 50);
  ctx.lineTo(-20, 44);
  ctx.lineTo(-6, 34);
  ctx.lineTo(-8, 10);
  ctx.lineTo(-48, 22);
  ctx.lineTo(-48, 12);
  ctx.lineTo(-8, -12);
  ctx.quadraticCurveTo(-9, -40, 0, -50);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
};

const iconShip: Draw = (ctx, x, y, s) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 100, s / 100);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#3a1c05';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-14, -44, 28, 34);
  ctx.strokeRect(-14, -44, 28, 34);
  ctx.fillStyle = '#e53935';
  ctx.fillRect(-14, -44, 28, 10);
  ctx.fillStyle = '#ffd54f';
  ctx.beginPath();
  ctx.moveTo(-34, -10);
  ctx.lineTo(34, -10);
  ctx.lineTo(28, 4);
  ctx.lineTo(-28, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  const g = ctx.createLinearGradient(0, 0, 0, 34);
  g.addColorStop(0, '#455a64');
  g.addColorStop(1, '#1c2b33');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-48, 4);
  ctx.lineTo(48, 4);
  ctx.lineTo(34, 30);
  ctx.lineTo(-34, 30);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#29b6f6';
  ctx.lineWidth = 6;
  ctx.beginPath();
  for (let i = -50; i <= 50; i += 20) {
    ctx.moveTo(i, 40);
    ctx.quadraticCurveTo(i + 5, 34, i + 10, 40);
    ctx.quadraticCurveTo(i + 15, 46, i + 20, 40);
  }
  ctx.stroke();
  ctx.restore();
};

const iconTrain: Draw = (ctx, x, y, s) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 100, s / 100);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#1a0f05';
  const g = ctx.createLinearGradient(0, -46, 0, 30);
  g.addColorStop(0, '#ff6f61');
  g.addColorStop(1, '#b71c1c');
  ctx.fillStyle = g;
  roundRect(ctx, -32, -46, 64, 72, 16);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#bde8ff';
  roundRect(ctx, -22, -36, 44, 26, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffe082';
  ctx.beginPath();
  ctx.arc(-16, 10, 7, 0, Math.PI * 2);
  ctx.arc(16, 10, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-24, 30);
  ctx.lineTo(-36, 48);
  ctx.moveTo(24, 30);
  ctx.lineTo(36, 48);
  ctx.moveTo(-30, 42);
  ctx.lineTo(30, 42);
  ctx.stroke();
  ctx.restore();
};

const iconBolt: Draw = (ctx, x, y, s) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 100, s / 100);
  ctx.fillStyle = '#fff3a0';
  ctx.beginPath();
  ctx.arc(0, 0, 46, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createLinearGradient(0, -40, 0, 40);
  g.addColorStop(0, '#ffee58');
  g.addColorStop(1, '#ff9800');
  ctx.fillStyle = g;
  ctx.strokeStyle = '#7a3e00';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(8, -44);
  ctx.lineTo(-24, 6);
  ctx.lineTo(-2, 6);
  ctx.lineTo(-10, 44);
  ctx.lineTo(24, -8);
  ctx.lineTo(2, -8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
};

const iconDrop: Draw = (ctx, x, y, s) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 100, s / 100);
  const g = ctx.createLinearGradient(-30, -40, 30, 40);
  g.addColorStop(0, '#81d4fa');
  g.addColorStop(1, '#0277bd');
  ctx.fillStyle = g;
  ctx.strokeStyle = '#01385f';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, -46);
  ctx.bezierCurveTo(10, -24, 36, 0, 36, 18);
  ctx.arc(0, 18, 36, 0, Math.PI);
  ctx.bezierCurveTo(-36, 0, -10, -24, 0, -46);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.ellipse(-14, 14, 7, 13, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const iconWifi: Draw = (ctx, x, y, s) => {
  ctx.save();
  ctx.translate(x, y + s * 0.25);
  ctx.scale(s / 100, s / 100);
  ctx.strokeStyle = '#7c4dff';
  ctx.lineCap = 'round';
  for (let i = 1; i <= 3; i++) {
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.arc(0, 0, i * 20, -Math.PI * 0.78, -Math.PI * 0.22);
    ctx.stroke();
  }
  ctx.fillStyle = '#7c4dff';
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const iconQuestion: Draw = (ctx, x, y, s) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.font = `${s * 1.2}px ${FONT_TITLE}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = s * 0.08;
  ctx.strokeStyle = '#7a2e00';
  const g = ctx.createLinearGradient(0, -s / 2, 0, s / 2);
  g.addColorStop(0, '#ffcc33');
  g.addColorStop(1, '#ff6d00');
  ctx.fillStyle = g;
  ctx.strokeText('?', 0, s * 0.05);
  ctx.fillText('?', 0, s * 0.05);
  ctx.restore();
};

const iconChest: Draw = (ctx, x, y, s) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 100, s / 100);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#3b1f05';
  const g = ctx.createLinearGradient(0, -30, 0, 40);
  g.addColorStop(0, '#a0612b');
  g.addColorStop(1, '#5d3412');
  ctx.fillStyle = g;
  roundRect(ctx, -44, -6, 88, 46, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#8d5524';
  ctx.beginPath();
  ctx.moveTo(-44, -6);
  ctx.quadraticCurveTo(-44, -40, 0, -40);
  ctx.quadraticCurveTo(44, -40, 44, -6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffd54f';
  ctx.fillRect(-44, -8, 88, 8);
  ctx.fillRect(-26, -38, 8, 78);
  ctx.fillRect(18, -38, 8, 78);
  ctx.fillStyle = '#ffca28';
  roundRect(ctx, -9, -10, 18, 20, 4);
  ctx.fill();
  ctx.stroke();
  // монеты
  ctx.fillStyle = '#ffe57f';
  ctx.beginPath();
  ctx.arc(-30, -44, 8, 0, Math.PI * 2);
  ctx.arc(30, -46, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const iconWheel: Draw = (ctx, x, y, s) => {
  ctx.save();
  ctx.translate(x, y);
  const r = s / 2;
  const colors = ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#fb8c00', '#00acc1', '#ec407a'];
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = colors[i];
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, (i / 8) * Math.PI * 2, ((i + 1) / 8) * Math.PI * 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.lineWidth = r * 0.12;
  ctx.strokeStyle = '#ffd54f';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d32f2f';
  ctx.beginPath();
  ctx.moveTo(-r * 0.16, -r - 4);
  ctx.lineTo(r * 0.16, -r - 4);
  ctx.lineTo(0, -r + r * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const iconTax: Draw = (ctx, x, y, s) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 100, s / 100);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#4a2a00';
  const g = ctx.createRadialGradient(-10, -5, 5, 0, 10, 50);
  g.addColorStop(0, '#d7b98e');
  g.addColorStop(1, '#8a6235');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-14, -30);
  ctx.quadraticCurveTo(-50, 0, -40, 32);
  ctx.quadraticCurveTo(0, 50, 40, 32);
  ctx.quadraticCurveTo(50, 0, 14, -30);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#8a6235';
  ctx.beginPath();
  ctx.moveTo(-16, -30);
  ctx.lineTo(-24, -46);
  ctx.lineTo(24, -46);
  ctx.lineTo(16, -30);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.font = `48px ${FONT_TITLE}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#2e7d32';
  ctx.fillText('$', 0, 10);
  ctx.restore();
};

const iconPalm: Draw = (ctx, x, y, s) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 100, s / 100);
  ctx.fillStyle = '#ffeb3b';
  ctx.beginPath();
  ctx.arc(30, -30, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f4c27a';
  ctx.beginPath();
  ctx.ellipse(0, 40, 50, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7b4a1e';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-6, 38);
  ctx.quadraticCurveTo(-12, 0, 2, -24);
  ctx.stroke();
  ctx.fillStyle = '#2e9d48';
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.62;
    ctx.save();
    ctx.translate(2, -24);
    ctx.rotate(a + Math.PI / 2);
    ctx.beginPath();
    ctx.ellipse(0, -22, 9, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
};

const iconPolice: Draw = (ctx, x, y, s) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 100, s / 100);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#0b1a3a';
  const g = ctx.createLinearGradient(0, -40, 0, 20);
  g.addColorStop(0, '#3f6fd8');
  g.addColorStop(1, '#14307a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-46, 6);
  ctx.quadraticCurveTo(-40, -40, 0, -42);
  ctx.quadraticCurveTo(40, -40, 46, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.ellipse(0, 10, 52, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd54f';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? 7 : 16;
    ctx.lineTo(Math.cos(a) * r, -18 + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const iconArrow: Draw = (ctx, x, y, s) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 100, s / 100);
  const g = ctx.createLinearGradient(-50, 0, 50, 0);
  g.addColorStop(0, '#ff1744');
  g.addColorStop(1, '#ff8a65');
  ctx.fillStyle = g;
  ctx.strokeStyle = '#6d0010';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-50, 0);
  ctx.lineTo(-10, -32);
  ctx.lineTo(-10, -14);
  ctx.lineTo(50, -14);
  ctx.lineTo(50, 14);
  ctx.lineTo(-10, 14);
  ctx.lineTo(-10, 32);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
};

const ICONS: Record<string, Draw> = {
  plane: iconPlane,
  ship: iconShip,
  train: iconTrain,
  bolt: iconBolt,
  drop: iconDrop,
  wifi: iconWifi,
};

// ───────────── Клетки ─────────────

const CELL_PX_W = 256;
const CELL_PX_D = 410;

/**
 * Поворот холста под сторону поля. Картинка клетки рисуется «как её видит игрок снизу»
 * (текст всегда горизонтален и читается снизу), а преобразование укладывает её
 * в систему координат клетки, повёрнутой вдоль своей стороны поля.
 * cw/ch — размеры холста (вдоль локальной ширины и глубины клетки).
 */
function applySide(ctx: CanvasRenderingContext2D, side: number, cw: number, ch: number) {
  if (side === 1) ctx.transform(0, -1, 1, 0, 0, ch);
  else if (side === 2) ctx.transform(-1, 0, 0, -1, cw, ch);
  else if (side === 3) ctx.transform(0, 1, -1, 0, cw, 0);
}

/** Положение ценника относительно центра клетки в мировых координатах (x — вправо, z — вниз), единицы поля */
export function tagOffset(side: number): [number, number] {
  switch (side) {
    case 1:
      return [-0.1875, 0.332];
    case 2:
      return [0, -0.57];
    case 3:
      return [0.1875, 0.332];
    default:
      return [0, 0.57];
  }
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function cellTexture(board: BoardDef, cell: CellDef, theme: ThemeDef, side = 0, scale = 1): THREE.Texture {
  const CW = CELL_PX_W;
  const CD = CELL_PX_D;
  const [c, ctx] = mk(Math.round(CW * scale), Math.round(CD * scale));
  ctx.scale(scale, scale);
  applySide(ctx, side, CW, CD);
  const land = side % 2 === 1;
  const W = land ? CD : CW; // ширина картинки на экране
  const H = land ? CW : CD; // высота картинки на экране

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, theme.cellBg);
  bg.addColorStop(1, theme.cellBg2);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Цветная полоса — на внутренней стороне поля
  const B = 96;
  let content: Rect = { x: 0, y: 0, w: W, h: H };
  const hasTag = cell.type === 'property' || cell.type === 'transport' || cell.type === 'utility' || cell.type === 'tax';
  if (cell.type === 'property') {
    const col = board.groups[cell.group!]?.color ?? '#888';
    const band: Rect =
      side === 0 ? { x: 0, y: 0, w: W, h: B } : side === 2 ? { x: 0, y: H - B, w: W, h: B } : side === 1 ? { x: W - B, y: 0, w: B, h: H } : { x: 0, y: 0, w: B, h: H };
    const g = ctx.createLinearGradient(0, band.y, 0, band.y + band.h);
    g.addColorStop(0, shade(col, 0.25));
    g.addColorStop(1, shade(col, -0.12));
    ctx.fillStyle = g;
    ctx.fillRect(band.x, band.y, band.w, band.h);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(band.x, band.y, band.w, band.h * 0.38);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    if (side === 0) ctx.fillRect(0, B - 5, W, 5);
    else if (side === 2) ctx.fillRect(0, H - B, W, 5);
    else if (side === 1) ctx.fillRect(W - B, 0, 5, H);
    else ctx.fillRect(B - 5, 0, 5, H);
    content = side === 0 ? { x: 0, y: B, w: W, h: H - B } : side === 2 ? { x: 0, y: 0, w: W, h: H - B } : side === 1 ? { x: 0, y: 0, w: W - B, h: H } : { x: B, y: 0, w: W - B, h: H };
  }
  // Место под ценник (сам ценник — отдельный объект над клеткой)
  if (hasTag) {
    const T = land ? 90 : 104;
    if (side === 2) content = { ...content, y: content.y + T, h: content.h - T };
    else content = { ...content, h: content.h - T };
  }

  const pad = 14;
  const nameIn = (r: Rect, size: number, maxLines: number) => {
    const { lines, size: sz } = fitText(ctx, cell.name.toUpperCase(), r.w - pad * 2, maxLines, size, FONT_TEXT, 15);
    ctx.fillStyle = theme.cellText;
    drawLines(ctx, lines, r.x + r.w / 2, r.y + r.h / 2, sz);
  };
  const titleIn = (text: string, r: Rect, size: number) => {
    ctx.fillStyle = theme.cellText;
    ctx.font = `${size}px ${FONT_TITLE}`;
    const w = ctx.measureText(text).width;
    if (w > r.w - pad * 2) ctx.font = `${Math.floor((size * (r.w - pad * 2)) / w)}px ${FONT_TITLE}`;
    ctx.fillText(text, r.x + r.w / 2, r.y + r.h / 2);
  };
  const withIcon = (draw: Draw, r: Rect, nameH: number, iconMax: number) => {
    // Название сверху, иконка — по центру оставшегося места
    nameIn({ x: r.x, y: r.y + 6, w: r.w, h: nameH }, land ? 24 : 28, 2);
    const rest: Rect = { x: r.x, y: r.y + nameH + 6, w: r.w, h: r.h - nameH - 6 };
    const sz = Math.min(iconMax, rest.h * 0.86, rest.w * 0.7);
    draw(ctx, rest.x + rest.w / 2, rest.y + rest.h / 2, sz);
  };

  switch (cell.type) {
    case 'property':
      nameIn(content, land ? 42 : 38, land ? 2 : 3);
      break;
    case 'transport':
    case 'utility': {
      const draw = ICONS[cell.icon ?? (cell.type === 'transport' ? 'plane' : 'bolt')] ?? iconBolt;
      withIcon(draw, content, land ? 62 : 92, 120);
      break;
    }
    case 'tax':
      withIcon(iconTax, content, land ? 62 : 92, 110);
      break;
    case 'chance':
      titleIn('ШАНС', { x: content.x, y: content.y + 8, w: content.w, h: 52 }, 30);
      iconQuestion(ctx, content.x + content.w / 2, content.y + 60 + (content.h - 60) / 2, Math.min(170, (content.h - 60) * 0.85));
      break;
    case 'chest':
      titleIn('КАЗНА', { x: content.x, y: content.y + 8, w: content.w, h: 52 }, 30);
      iconChest(ctx, content.x + content.w / 2, content.y + 60 + (content.h - 60) / 2, Math.min(140, (content.h - 60) * 0.8));
      break;
    case 'wheel': {
      if (land) {
        titleIn('КОЛЕСО ФОРТУНЫ', { x: content.x, y: content.y + 8, w: content.w, h: 48 }, 28);
        iconWheel(ctx, content.x + content.w / 2, content.y + 56 + (content.h - 56) / 2, Math.min(150, (content.h - 56) * 0.8));
      } else {
        titleIn('КОЛЕСО', { x: content.x, y: content.y + 6, w: content.w, h: 40 }, 26);
        titleIn('ФОРТУНЫ', { x: content.x, y: content.y + 40, w: content.w, h: 40 }, 26);
        iconWheel(ctx, content.x + content.w / 2, content.y + 84 + (content.h - 84) / 2, Math.min(150, (content.h - 84) * 0.8));
      }
      break;
    }
    default:
      nameIn(content, 34, 3);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, W - 4, H - 4);
  return canvasTexture(c);
}

export function cornerTexture(cell: CellDef, theme: ThemeDef, salary: number, side = 0, scale = 1): THREE.Texture {
  const S = 410;
  const [c, ctx] = mk(Math.round(S * scale), Math.round(S * scale));
  ctx.scale(scale, scale);
  applySide(ctx, side, S, S);
  const bg = ctx.createRadialGradient(S / 2, S / 2, 20, S / 2, S / 2, S * 0.75);
  bg.addColorStop(0, theme.cornerBg);
  bg.addColorStop(1, theme.cornerBg2);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const title = (text: string, x: number, y: number, size: number, color: string, maxW = S - 40) => {
    ctx.font = `${size}px ${FONT_TITLE}`;
    const w = ctx.measureText(text).width;
    const sz = w > maxW ? Math.floor((size * maxW) / w) : size;
    ctx.font = `${sz}px ${FONT_TITLE}`;
    ctx.lineWidth = sz * 0.16;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  };
  const caption = (text: string, x: number, y: number, size: number, maxW = S - 40) => {
    ctx.font = `700 ${size}px ${FONT_TEXT}`;
    const w = ctx.measureText(text).width;
    if (w > maxW) ctx.font = `700 ${Math.floor((size * maxW) / w)}px ${FONT_TEXT}`;
    ctx.fillStyle = theme.cellText;
    ctx.fillText(text, x, y);
  };

  switch (cell.type) {
    case 'start': {
      title('СТАРТ', S / 2, 110, 84, '#ff3d3d');
      iconArrow(ctx, S / 2, 235, 230);
      caption(salary > 0 ? `+$${salary} за круг` : 'без зарплаты', S / 2, 345, 34);
      break;
    }
    case 'jail': {
      // Камера — во внутреннем углу поля (на экране — справа сверху), «в гостях» — внизу
      const jw = 250;
      const x0 = S - jw;
      const g = ctx.createLinearGradient(x0, 0, S, jw);
      g.addColorStop(0, '#ffb74d');
      g.addColorStop(1, '#ef6c00');
      ctx.fillStyle = g;
      ctx.fillRect(x0, 0, jw, jw);
      ctx.fillStyle = '#37474f';
      for (let x = x0 + 22; x < S; x += 38) ctx.fillRect(x, 0, 10, jw);
      ctx.fillRect(x0, 0, jw, 12);
      ctx.fillRect(x0, jw - 12, jw, 12);
      title('ТЮРЬМА', x0 + jw / 2, jw / 2, 40, '#ffe0b2', jw - 30);
      ctx.strokeStyle = '#263238';
      ctx.lineWidth = 6;
      ctx.strokeRect(x0 + 3, 3, jw - 6, jw - 6);
      caption('ПРОСТО В ГОСТЯХ', S / 2, S - 70, 30, S - 40);
      break;
    }
    case 'parking': {
      title('ОТПУСК', S / 2, 66, 60, '#00a86b');
      iconPalm(ctx, S / 2, 245, 180);
      caption('джекпот налогов', S / 2, 365, 26);
      break;
    }
    case 'gotojail': {
      title('В ТЮРЬМУ!', S / 2, 78, 58, '#1e5bd8');
      iconPolice(ctx, S / 2, 245, 230);
      break;
    }
    default:
      title(cell.name.toUpperCase(), S / 2, S / 2, 50, theme.cellText);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, S - 6, S - 6);
  return canvasTexture(c);
}

/** Ценник на клетке: цена (свободна), аренда в цвете владельца или пометка «залог» */
export function drawPriceTag(canvas: HTMLCanvasElement, text: string, bg: string, fg: string, mortgaged: boolean) {
  const ctx = canvas.getContext('2d')!;
  // Холст может быть увеличен для экранов высокой плотности — рисуем в логических 256×88
  const k = canvas.width / 256;
  const W = 256;
  const H = 88;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, shade(bg, 0.18));
  g.addColorStop(1, shade(bg, -0.1));
  ctx.fillStyle = g;
  roundRect(ctx, 4, 4, W - 8, H - 8, 18);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  roundRect(ctx, 10, 8, W - 20, H * 0.35, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 4;
  roundRect(ctx, 4, 4, W - 8, H - 8, 18);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${mortgaged ? 34 : 44}px ${FONT_TITLE}`;
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.strokeText(text, W / 2, H / 2 + 3);
  ctx.fillStyle = fg;
  ctx.fillText(text, W / 2, H / 2 + 3);
}

export function makePriceCanvas(scale = 1) {
  const [c] = mk(Math.round(256 * scale), Math.round(88 * scale));
  return c;
}

// ───────────── Центр поля ─────────────

export function centerTexture(theme: ThemeDef, boardName: string, scale = 1): THREE.Texture {
  const S = 1024;
  const [c, ctx] = mk(S * scale, S * scale);
  ctx.scale(scale, scale);
  const g = ctx.createRadialGradient(S / 2, S / 2, 40, S / 2, S / 2, S * 0.72);
  g.addColorStop(0, theme.center1);
  g.addColorStop(1, theme.center2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  // Узор
  ctx.save();
  if (theme.table === 'asphalt') {
    ctx.strokeStyle = 'rgba(0,229,255,0.12)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= S; i += 48) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, S);
      ctx.moveTo(0, i);
      ctx.lineTo(S, i);
      ctx.stroke();
    }
    // Силуэт города
    ctx.fillStyle = 'rgba(255,61,242,0.18)';
    let x = 120;
    const rnd = mulberry(7);
    while (x < S - 120) {
      const w = 30 + rnd() * 50;
      const h = 60 + rnd() * 180;
      ctx.fillRect(x, 760 - h, w, h);
      x += w + 6;
    }
  } else if (theme.table === 'meadow') {
    const rnd = mulberry(3);
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.12 + rnd() * 0.2})`;
      const x = rnd() * S;
      const y = rnd() * S;
      star(ctx, x, y, 6 + rnd() * 10);
    }
    ctx.fillStyle = 'rgba(255,240,250,0.25)';
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, 330, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    for (let r = 120; r < 700; r += 70) {
      ctx.beginPath();
      ctx.arc(S / 2, S / 2, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // Логотип по диагонали
  ctx.save();
  ctx.translate(S / 2, S / 2);
  ctx.rotate(-Math.PI / 4);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `128px ${FONT_TITLE}`;
  // Плашка под логотипом
  const lw = 860;
  const lg = ctx.createLinearGradient(0, -110, 0, 110);
  lg.addColorStop(0, theme.accent);
  lg.addColorStop(1, shade(theme.accent, -0.35));
  ctx.fillStyle = lg;
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 12;
  roundRect(ctx, -lw / 2, -100, lw, 200, 40);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 8;
  roundRect(ctx, -lw / 2 + 12, -88, lw - 24, 176, 32);
  ctx.stroke();
  ctx.lineWidth = 22;
  ctx.strokeStyle = theme.logoStroke;
  ctx.lineJoin = 'round';
  ctx.strokeText('КАПИТАЛИСТ', 0, 6);
  const tg = ctx.createLinearGradient(0, -60, 0, 60);
  tg.addColorStop(0, theme.logoFill[0]);
  tg.addColorStop(1, theme.logoFill[1]);
  ctx.fillStyle = tg;
  ctx.fillText('КАПИТАЛИСТ', 0, 6);
  ctx.font = `700 40px ${FONT_TEXT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText(boardName.toUpperCase(), 0, 150);
  ctx.restore();
  return canvasTexture(c);
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

export function mulberry(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Рубашка колоды карточек */
export function deckTexture(kind: 'chance' | 'chest'): THREE.Texture {
  const [c, ctx] = mk(256, 360);
  const g = ctx.createLinearGradient(0, 0, 256, 360);
  if (kind === 'chance') {
    g.addColorStop(0, '#ffb300');
    g.addColorStop(1, '#f4511e');
  } else {
    g.addColorStop(0, '#42a5f5');
    g.addColorStop(1, '#283593');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 360);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 10;
  roundRect(ctx, 16, 16, 224, 328, 20);
  ctx.stroke();
  if (kind === 'chance') iconQuestion(ctx, 128, 160, 190);
  else iconChest(ctx, 128, 160, 150);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `40px ${FONT_TITLE}`;
  ctx.fillStyle = '#fff';
  ctx.fillText(kind === 'chance' ? 'ШАНС' : 'КАЗНА', 128, 300);
  return canvasTexture(c);
}

// ───────────── Стол ─────────────

export function tableTexture(theme: ThemeDef, scale = 1): THREE.Texture {
  const S = 1024;
  const [c, ctx] = mk(S * scale, S * scale);
  ctx.scale(scale, scale);
  const rnd = mulberry(11);
  if (theme.table === 'wood') {
    ctx.fillStyle = theme.tableColor;
    ctx.fillRect(0, 0, S, S);
    const plank = S / 6;
    for (let p = 0; p < 6; p++) {
      const base = new THREE.Color(theme.tableColor).offsetHSL(0, 0, (rnd() - 0.5) * 0.06);
      ctx.fillStyle = '#' + base.getHexString();
      ctx.fillRect(0, p * plank, S, plank);
      for (let i = 0; i < 40; i++) {
        ctx.strokeStyle = `rgba(60,30,10,${0.05 + rnd() * 0.1})`;
        ctx.lineWidth = 1 + rnd() * 3;
        ctx.beginPath();
        const y = p * plank + rnd() * plank;
        ctx.moveTo(0, y);
        for (let x = 0; x <= S; x += 64) ctx.lineTo(x, y + Math.sin(x * 0.01 + i) * 4 + (rnd() - 0.5) * 3);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(30,15,5,0.5)';
      ctx.fillRect(0, p * plank, S, 3);
    }
  } else if (theme.table === 'asphalt') {
    ctx.fillStyle = '#151827';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 9000; i++) {
      ctx.fillStyle = `rgba(255,255,255,${rnd() * 0.05})`;
      ctx.fillRect(rnd() * S, rnd() * S, 2, 2);
    }
    ctx.strokeStyle = 'rgba(0,229,255,0.25)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= S; i += 128) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, S);
      ctx.moveTo(0, i);
      ctx.lineTo(S, i);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,61,242,0.18)';
    for (let i = 64; i <= S; i += 128) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, S);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = theme.tableColor;
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 2500; i++) {
      const x = rnd() * S;
      const y = rnd() * S;
      ctx.strokeStyle = `rgba(${30 + rnd() * 40},${120 + rnd() * 80},${40 + rnd() * 40},0.6)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rnd() - 0.5) * 6, y - 8 - rnd() * 8);
      ctx.stroke();
    }
    const flowers = ['#ffffff', '#ffd1f0', '#fff59d', '#b3e5fc'];
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = flowers[i % flowers.length];
      const x = rnd() * S;
      const y = rnd() * S;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffb300';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const t = canvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  return t;
}

// ───────────── Кубики ─────────────

export interface DiceStyle {
  id: DiceStyleId;
  name: string;
  body: string;
  body2: string;
  pip: string;
  metal: number;
  rough: number;
}

export const DICE_STYLES: DiceStyle[] = [
  { id: 'classic', name: 'Классика', body: '#ffffff', body2: '#e8e8e8', pip: '#1a1a1a', metal: 0, rough: 0.35 },
  { id: 'ruby', name: 'Рубин', body: '#ff3b47', body2: '#b5121b', pip: '#ffffff', metal: 0.1, rough: 0.2 },
  { id: 'gold', name: 'Золото', body: '#ffe082', body2: '#e0a800', pip: '#5d3b00', metal: 0.7, rough: 0.25 },
  { id: 'neon', name: 'Неон', body: '#1b1b3a', body2: '#0b0b20', pip: '#39ff14', metal: 0.2, rough: 0.3 },
  { id: 'wood', name: 'Дерево', body: '#d9a066', body2: '#a86b32', pip: '#3b1f08', metal: 0, rough: 0.7 },
  { id: 'candy', name: 'Карамель', body: '#ff9ad5', body2: '#c86bff', pip: '#ffffff', metal: 0, rough: 0.25 },
];

const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.27, 0.25], [0.73, 0.25], [0.27, 0.5], [0.73, 0.5], [0.27, 0.75], [0.73, 0.75]],
};

export function diceFaceTexture(style: DiceStyle, value: number): THREE.Texture {
  const S = 256;
  const [c, ctx] = mk(S, S);
  const g = ctx.createRadialGradient(S * 0.4, S * 0.35, 10, S / 2, S / 2, S * 0.75);
  g.addColorStop(0, style.body);
  g.addColorStop(1, style.body2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  if (style.id === 'wood') {
    const rnd = mulberry(value * 13);
    for (let i = 0; i < 18; i++) {
      ctx.strokeStyle = `rgba(80,40,10,${0.08 + rnd() * 0.12})`;
      ctx.lineWidth = 2 + rnd() * 3;
      ctx.beginPath();
      const y = rnd() * S;
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(S * 0.3, y + 10, S * 0.6, y - 10, S, y + 4);
      ctx.stroke();
    }
  }
  const r = value === 1 ? 30 : 23;
  for (const [x, y] of PIPS[value]) {
    if (style.id === 'neon') {
      ctx.shadowColor = style.pip;
      ctx.shadowBlur = 24;
    }
    const pg = ctx.createRadialGradient(x * S - 4, y * S - 4, 2, x * S, y * S, r);
    const pipColor = value === 1 && style.id === 'classic' ? '#d50000' : style.pip;
    pg.addColorStop(0, shade(pipColor, 0.25));
    pg.addColorStop(1, pipColor);
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(x * S, y * S, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  return canvasTexture(c);
}

/** Текстовый спрайт (всплывающие суммы и подписи) */
export function textSprite(text: string, color: string, size = 64, stroke = 'rgba(0,0,0,0.55)') {
  const [c, ctx] = mk(512, 128);
  ctx.font = `${size}px ${FONT_TITLE}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = size * 0.18;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, 256, 64);
  const g = ctx.createLinearGradient(0, 30, 0, 100);
  g.addColorStop(0, shade(color, 0.35));
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  ctx.fillText(text, 256, 64);
  return canvasTexture(c);
}

/** Печать «ЗАЛОГ» поверх клетки */
export function mortgageStampTexture(): THREE.Texture {
  const [c, ctx] = mk(256, 256);
  ctx.translate(128, 128);
  ctx.rotate(-0.5);
  ctx.strokeStyle = '#d50000';
  ctx.lineWidth = 10;
  roundRect(ctx, -110, -40, 220, 80, 14);
  ctx.stroke();
  ctx.font = `52px ${FONT_TITLE}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#d50000';
  ctx.fillText('ЗАЛОГ', 0, 4);
  return canvasTexture(c);
}
