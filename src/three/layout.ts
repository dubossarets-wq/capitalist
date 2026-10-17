// Геометрия поля: положение и поворот каждой клетки для поля на любое число клеток (кратное 4)

export const CELL_W = 1;
export const CORNER = 1.6;
export const CELL_D = 1.6;

export interface CellPlace {
  x: number;
  z: number;
  rot: number; // поворот вокруг Y: локальная +Z смотрит наружу поля
  w: number;
  d: number;
  corner: boolean;
  side: number; // 0 — низ, 1 — лево, 2 — верх, 3 — право
}

export function boardSize(n: number) {
  const s = n / 4;
  return 2 * CORNER + (s - 1) * CELL_W;
}

/** Размеры поля: ширина (x) и высота (z). k — во сколько раз вытянуты клетки левого и правого рядов */
export function boardDims(n: number, k = 1) {
  const s = n / 4;
  return { W: 2 * CORNER + (s - 1) * CELL_W, H: 2 * CORNER + (s - 1) * CELL_W * k };
}

export function computeLayout(n: number, k = 1): CellPlace[] {
  const s = n / 4;
  const { W, H } = boardDims(n, k);
  const hw = W / 2;
  const hh = H / 2;
  const c = CORNER;
  const out: CellPlace[] = [];
  for (let i = 0; i < n; i++) {
    const side = Math.floor(i / s);
    const j = i % s;
    const rot = [0, -Math.PI / 2, Math.PI, Math.PI / 2][side];
    if (j === 0) {
      const pos = [
        [hw - c / 2, hh - c / 2],
        [-hw + c / 2, hh - c / 2],
        [-hw + c / 2, -hh + c / 2],
        [hw - c / 2, -hh + c / 2],
      ][side];
      out.push({ x: pos[0], z: pos[1], rot, w: c, d: c, corner: true, side });
      continue;
    }
    const vertical = side % 2 === 1;
    const len = vertical ? CELL_W * k : CELL_W;
    const off = c + (j - 0.5) * len;
    let x = 0;
    let z = 0;
    if (side === 0) {
      x = hw - off;
      z = hh - c / 2;
    } else if (side === 1) {
      x = -hw + c / 2;
      z = hh - off;
    } else if (side === 2) {
      x = -hw + off;
      z = -hh + c / 2;
    } else {
      x = hw - c / 2;
      z = -hh + off;
    }
    out.push({ x, z, rot, w: len, d: CELL_D, corner: false, side });
  }
  return out;
}

/** Точка внутри клетки для фишки номер slot из total (чтобы фишки не накладывались) */
export function tokenSlot(p: CellPlace, slot: number, total: number, inJail = false): { x: number; z: number } {
  // Локальные координаты: x — вдоль ширины, z — от центра поля (-) наружу (+)
  let lx = 0;
  let lz = 0;
  if (p.corner) {
    const r = 0.38;
    const n = Math.max(1, total);
    const a = (slot / n) * Math.PI * 2 + 0.6;
    lx = n === 1 ? 0 : Math.cos(a) * r;
    lz = n === 1 ? 0 : Math.sin(a) * r;
    if (inJail) {
      // Сама тюрьма — внутренний угол клетки (левый верхний на текстуре)
      lx = lx * 0.45 - 0.25;
      lz = lz * 0.45 - 0.25;
    } else if (p.side === 1) {
      // «Просто в гостях» — внешний край
      lx = lx * 0.55 + 0.42;
      lz = lz * 0.55 + 0.42;
    }
  } else {
    const cols = total <= 2 ? total : total <= 4 ? 2 : 3;
    const rows = Math.ceil(total / cols);
    const cx = slot % cols;
    const cz = Math.floor(slot / cols);
    lx = cols === 1 ? 0 : (cx / (cols - 1) - 0.5) * 0.52;
    lz = 0.1 + (rows === 1 ? 0 : (cz / (rows - 1) - 0.5) * 0.7);
  }
  const cos = Math.cos(p.rot);
  const sin = Math.sin(p.rot);
  return { x: p.x + lx * cos + lz * sin, z: p.z - lx * sin + lz * cos };
}

/** Точка внутри клетки в локальных координатах → мировые */
export function localToWorld(p: CellPlace, lx: number, lz: number) {
  const cos = Math.cos(p.rot);
  const sin = Math.sin(p.rot);
  return { x: p.x + lx * cos + lz * sin, z: p.z - lx * sin + lz * cos };
}
