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

export function cellTexture(board: BoardDef, cell: CellDef, theme: ThemeDef): THREE.Texture {
  const [c, ctx] = mk(CELL_PX_W, CELL_PX_D);
  const W = CELL_PX_W;
  const H = CELL_PX_D;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, theme.cellBg);
  bg.addColorStop(1, theme.cellBg2);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = theme.cellText;

  const nameArea = (y: number, h: number, size = 34) => {
    const { lines, size: s } = fitText(ctx, cell.name.toUpperCase(), W - 30, 3, size, FONT_TEXT, 16);
    ctx.fillStyle = theme.cellText;
    drawLines(ctx, lines, W / 2, y + h / 2, s);
  };

  switch (cell.type) {
    case 'property': {
      const col = board.groups[cell.group!]?.color ?? '#888';
      const bh = 96;
      const g = ctx.createLinearGradient(0, 0, 0, bh);
      g.addColorStop(0, shade(col, 0.25));
      g.addColorStop(1, shade(col, -0.12));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, bh);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(0, 0, W, bh * 0.38);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, bh - 5, W, 5);
      nameArea(bh + 10, 170, 36);
      break;
    }
    case 'transport':
    case 'utility': {
      nameArea(10, 92, 28);
      const draw = ICONS[cell.icon ?? (cell.type === 'transport' ? 'plane' : 'bolt')] ?? iconBolt;
      draw(ctx, W / 2, 200, 120);
      break;
    }
    case 'tax': {
      nameArea(10, 92, 28);
      iconTax(ctx, W / 2, 196, 110);
      break;
    }
    case 'chance': {
      ctx.fillStyle = theme.cellText;
      ctx.font = `30px ${FONT_TITLE}`;
      ctx.fillText('ШАНС', W / 2, 50);
      iconQuestion(ctx, W / 2, 200, 170);
      break;
    }
    case 'chest': {
      ctx.fillStyle = theme.cellText;
      ctx.font = `30px ${FONT_TITLE}`;
      ctx.fillText('КАЗНА', W / 2, 50);
      iconChest(ctx, W / 2, 210, 140);
      break;
    }
    case 'wheel': {
      ctx.fillStyle = theme.cellText;
      ctx.font = `26px ${FONT_TITLE}`;
      ctx.fillText('КОЛЕСО', W / 2, 38);
      ctx.fillText('ФОРТУНЫ', W / 2, 70);
      iconWheel(ctx, W / 2, 210, 150);
      break;
    }
    default: {
      nameArea(40, 200, 34);
    }
  }
  // Внешняя рамка
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, W - 4, H - 4);
  return canvasTexture(c);
}

export function cornerTexture(cell: CellDef, theme: ThemeDef, salary: number): THREE.Texture {
  const S = 410;
  const [c, ctx] = mk(S, S);
  const bg = ctx.createRadialGradient(S / 2, S / 2, 20, S / 2, S / 2, S * 0.75);
  bg.addColorStop(0, theme.cornerBg);
  bg.addColorStop(1, theme.cornerBg2);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const title = (text: string, y: number, size: number, color: string) => {
    ctx.font = `${size}px ${FONT_TITLE}`;
    ctx.lineWidth = size * 0.16;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.strokeText(text, S / 2, y);
    ctx.fillStyle = color;
    ctx.fillText(text, S / 2, y);
  };

  switch (cell.type) {
    case 'start': {
      title('СТАРТ', 130, 84, '#ff3d3d');
      iconArrow(ctx, S / 2, 250, 230);
      ctx.font = `700 34px ${FONT_TEXT}`;
      ctx.fillStyle = theme.cellText;
      ctx.fillText(salary > 0 ? `+$${salary} за круг` : 'без зарплаты', S / 2, 345);
      break;
    }
    case 'jail': {
      // Камера — левый верхний угол (внутренний угол поля)
      const jw = 250;
      const g = ctx.createLinearGradient(0, 0, jw, jw);
      g.addColorStop(0, '#ffb74d');
      g.addColorStop(1, '#ef6c00');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, jw, jw);
      ctx.fillStyle = '#4e2a00';
      ctx.font = `40px ${FONT_TITLE}`;
      ctx.fillText('ТЮРЬМА', jw / 2, jw / 2);
      ctx.fillStyle = '#37474f';
      for (let x = 22; x < jw; x += 38) ctx.fillRect(x, 0, 10, jw);
      ctx.fillRect(0, 0, jw, 12);
      ctx.fillRect(0, jw - 12, jw, 12);
      ctx.strokeStyle = '#263238';
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, jw - 6, jw - 6);
      ctx.fillStyle = theme.cellText;
      ctx.font = `700 30px ${FONT_TEXT}`;
      ctx.fillText('ПРОСТО', S / 2 + 10, jw + 50);
      ctx.fillText('В ГОСТЯХ', S / 2 + 10, jw + 90);
      ctx.save();
      ctx.translate(jw + 80, jw / 2);
      ctx.rotate(Math.PI / 2);
      ctx.font = `700 28px ${FONT_TEXT}`;
      ctx.fillText('В ГОСТЯХ', 0, 0);
      ctx.restore();
      break;
    }
    case 'parking': {
      title('ОТПУСК', 80, 64, '#00a86b');
      iconPalm(ctx, S / 2, 230, 230);
      ctx.font = `700 26px ${FONT_TEXT}`;
      ctx.fillStyle = theme.cellText;
      ctx.fillText('джекпот налогов', S / 2, 370);
      break;
    }
    case 'gotojail': {
      title('В ТЮРЬМУ!', 84, 58, '#1e5bd8');
      iconPolice(ctx, S / 2, 240, 230);
      break;
    }
    default:
      title(cell.name.toUpperCase(), S / 2, 50, theme.cellText);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, S - 6, S - 6);
  return canvasTexture(c);
}

/** Ценник на клетке: цена (свободна), аренда в цвете владельца или пометка «залог» */
export function drawPriceTag(canvas: HTMLCanvasElement, text: string, bg: string, fg: string, mortgaged: boolean) {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
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

export function makePriceCanvas() {
  const [c] = mk(256, 88);
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
