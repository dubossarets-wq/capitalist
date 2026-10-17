// Трёхмерная сцена: доска, фишки, дома, кубики, эффекты и камера.
// Сцена ничего не знает о правилах — ей сообщают, что показать.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { BoardDef, DiceStyleId, ThemeId } from '../../shared/types';
import { THEMES, type ThemeDef } from './themes';
import { computeLayout, boardSize, tokenSlot, type CellPlace, CORNER } from './layout';
import {
  cellTexture,
  cornerTexture,
  centerTexture,
  deckTexture,
  diceFaceTexture,
  DICE_STYLES,
  drawPriceTag,
  makePriceCanvas,
  mortgageStampTexture,
  tableTexture,
  textSprite,
  canvasTexture,
  setMaxAnisotropy,
} from './textures';
import { buildDecor, type Decor } from './decor';
import { buildToken, disposeObject } from './tokens';

export type Quality = 'low' | 'medium' | 'high';

export interface TagInfo {
  text: string;
  bg: string;
  fg: string;
  mortgaged: boolean;
}

interface TokenView {
  id: string;
  obj: THREE.Group;
  cell: number;
  inJail: boolean;
  hidden: boolean;
  moving: boolean;
}

interface Tween {
  start: number;
  dur: number;
  fn: (t: number) => void;
  resolve: () => void;
}

interface Particle {
  obj: THREE.Object3D;
  vel: THREE.Vector3;
  life: number;
  max: number;
  spin?: THREE.Vector3;
  gravity?: number;
  fade?: boolean;
  update?: (p: Particle, k: number) => void;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

const BOARD_TOP = 0.4;
const CELL_H = 0.08;
const CELL_TOP = BOARD_TOP + CELL_H;
const DIE = 0.55;

export class BoardScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  private container: HTMLElement;
  private root = new THREE.Group();
  private decor: Decor | null = null;
  private layout: CellPlace[] = [];
  private cells: THREE.Mesh[] = [];
  private tags: { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture; mesh: THREE.Mesh; key: string }[] = [];
  private stamps: (THREE.Mesh | null)[] = [];
  private houses: (THREE.Group | null)[] = [];
  private houseCount: number[] = [];
  private tokens = new Map<string, TokenView>();
  private dice: THREE.Mesh[] = [];
  private particles: Particle[] = [];
  private tweens: Tween[] = [];
  private time = 0;
  private last = performance.now();
  private raf = 0;
  private L = 12;
  private theme: ThemeDef = THEMES.classic;
  private sun!: THREE.DirectionalLight;
  private hemi!: THREE.HemisphereLight;
  private highlight: THREE.Mesh;
  private activeRing: THREE.Mesh;
  private activeId: string | null = null;
  private follow: THREE.Object3D | null = null;
  private focusPoint: THREE.Vector3 | null = null;
  private focusDist: number | null = null;
  private userActive = false;
  private lastUser = -1e9;
  private menuMode = false;
  private menuLoop = 0;
  private quality: Quality = 'high';
  private houseGeo: { box: THREE.BufferGeometry; roof: THREE.BufferGeometry; hotel: THREE.BufferGeometry; hotelRoof: THREE.BufferGeometry };
  private houseMat: { house: THREE.Material; roof: THREE.Material; hotel: THREE.Material; hotelRoof: THREE.Material };
  private coinGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.025, 18);
  private coinMat = new THREE.MeshStandardMaterial({ color: '#ffcf33', metalness: 0.85, roughness: 0.25, emissive: '#5a3a00', emissiveIntensity: 0.25 });
  private stampTex: THREE.Texture | null = null;
  private down: { x: number; y: number; t: number } | null = null;
  private dirty = true;
  /** Снижение разрешения, если устройство не тянет даже низкое качество */
  private resScale = 1;
  private lastRender = 0;
  private perf = { sum: 0, n: 0, quietUntil: 0 };
  speed = 1;
  cameraFollow = true;
  /** Вызывается, если во время анимаций устройство не тянет (низкий FPS) */
  onSlow: (() => void) | null = null;
  onCellClick: ((i: number) => void) | null = null;
  onStep: (() => void) | null = null;
  onDiceHit: (() => void) | null = null;

  constructor(container: HTMLElement, quality: Quality) {
    this.container = container;
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ antialias: quality !== 'low', alpha: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x000000, 0);
    setMaxAnisotropy(Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    this.camera.position.set(0, 12, 10);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = 1.3;
    this.controls.minPolarAngle = 0.15;
    this.controls.minDistance = 3.5;
    this.controls.maxDistance = 40;
    this.controls.screenSpacePanning = false;
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    this.controls.addEventListener('start', () => {
      this.userActive = true;
      this.lastUser = this.time;
    });
    this.controls.addEventListener('end', () => {
      this.userActive = false;
      this.lastUser = this.time;
    });

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.5);
    this.sun.position.set(8, 18, 10);
    this.scene.add(this.sun, this.sun.target);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    this.applyQuality();

    const hg = new THREE.PlaneGeometry(1, 1);
    this.highlight = new THREE.Mesh(
      hg,
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.highlight.rotation.x = -Math.PI / 2;
    this.highlight.renderOrder = 5;
    this.activeRing = new THREE.Mesh(
      new THREE.RingGeometry(0.26, 0.34, 40),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.activeRing.rotation.x = -Math.PI / 2;
    this.activeRing.visible = false;
    this.scene.add(this.root);

    this.houseGeo = {
      box: new RoundedBoxGeometry(0.17, 0.13, 0.17, 2, 0.02),
      roof: new THREE.ConeGeometry(0.15, 0.12, 4).rotateY(Math.PI / 4),
      hotel: new RoundedBoxGeometry(0.42, 0.18, 0.22, 2, 0.025),
      hotelRoof: new THREE.ConeGeometry(0.2, 0.13, 4).rotateY(Math.PI / 4).scale(1.5, 1, 0.8),
    };
    this.houseMat = {
      house: new THREE.MeshStandardMaterial({ color: '#34c759', roughness: 0.4 }),
      roof: new THREE.MeshStandardMaterial({ color: '#1e8e3e', roughness: 0.5 }),
      hotel: new THREE.MeshStandardMaterial({ color: '#ff3b30', roughness: 0.4 }),
      hotelRoof: new THREE.MeshStandardMaterial({ color: '#b3170f', roughness: 0.5 }),
    };

    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (e) => (this.down = { x: e.clientX, y: e.clientY, t: performance.now() }));
    el.addEventListener('pointerup', (e) => {
      const d = this.down;
      this.down = null;
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8 || performance.now() - d.t > 450) return;
      this.pick(e.clientX, e.clientY);
    });
    el.addEventListener('wheel', () => (this.lastUser = this.time), { passive: true });

    window.addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.finishAll();
    });
    this.resize();
    this.loop();
  }

  // ───────────── Общие настройки ─────────────

  setQuality(q: Quality) {
    this.quality = q;
    this.applyQuality();
  }

  private applyQuality() {
    this.dirty = true;
    const q = this.quality;
    const dpr = window.devicePixelRatio || 1;
    // Чёткость важнее всего: даже на низком качестве рисуем минимум в 2× на экранах высокой плотности.
    // В простое кадры не рисуются, так что это не нагружает устройство.
    const cap = q === 'high' ? 3 : 2;
    this.renderer.setPixelRatio(Math.max(1, Math.min(cap, dpr) * this.resScale));
    this.renderer.shadowMap.enabled = q !== 'low';
    this.sun.castShadow = q !== 'low';
    const size = q === 'high' ? 2048 : 1024;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      (this.sun.shadow as any).map = null;
    }
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m) m.needsUpdate = true;
    });
    this.resize();
  }

  invalidate() {
    this.dirty = true;
  }

  /** Масштаб текстур клеток: на экранах высокой плотности — крупнее, чтобы надписи были чёткими */
  private texScale() {
    const dpr = window.devicePixelRatio || 1;
    return dpr >= 1.75 ? 1.5 : dpr > 1.2 ? 1.25 : 1;
  }

  private resize = () => {
    this.dirty = true;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  // ───────────── Построение доски ─────────────

  setBoard(board: BoardDef, themeId: ThemeId, diceStyle: DiceStyleId, salary: number) {
    this.dirty = true;
    this.finishAll();
    this.clearBoard();
    const theme = (this.theme = THEMES[themeId] ?? THEMES.classic);
    const n = board.cells.length;
    this.layout = computeLayout(n);
    const L = (this.L = boardSize(n));
    this.renderer.toneMappingExposure = theme.exposure;
    this.hemi.color.set(theme.hemiSky);
    this.hemi.groundColor.set(theme.hemiGround);
    this.sun.color.set(theme.sunColor);
    this.sun.intensity = theme.sunIntensity;
    const sh = this.sun.shadow.camera;
    sh.left = -L * 0.75;
    sh.right = L * 0.75;
    sh.top = L * 0.75;
    sh.bottom = -L * 0.75;
    sh.near = 1;
    sh.far = 60;
    sh.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.02;
    this.sun.position.set(L * 0.5, L * 1.4, L * 0.8);

    // Стол с мягким затуханием к краям
    const tableR = L * 2.6;
    const tex = tableTexture(theme);
    tex.repeat.set(5, 5);
    const fade = document.createElement('canvas');
    fade.width = fade.height = 256;
    const fctx = fade.getContext('2d')!;
    const fg = fctx.createRadialGradient(128, 128, 40, 128, 128, 128);
    fg.addColorStop(0, '#fff');
    fg.addColorStop(0.62, '#fff');
    fg.addColorStop(1, '#000');
    fctx.fillStyle = fg;
    fctx.fillRect(0, 0, 256, 256);
    const table = new THREE.Mesh(
      new THREE.CircleGeometry(tableR, 64),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, transparent: true, alphaMap: new THREE.CanvasTexture(fade), depthWrite: false }),
    );
    table.rotation.x = -Math.PI / 2;
    table.receiveShadow = true;
    this.root.add(table);
    // Тень-подложка под доской
    const shadowBlob = new THREE.Mesh(
      new THREE.PlaneGeometry(L * 1.25, L * 1.25),
      new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.55 }),
    );
    shadowBlob.rotation.x = -Math.PI / 2;
    shadowBlob.position.y = 0.01;
    this.root.add(shadowBlob);

    // Основание доски
    const base = new THREE.Mesh(
      new RoundedBoxGeometry(L + 0.6, BOARD_TOP, L + 0.6, 4, 0.16),
      new THREE.MeshStandardMaterial({ color: theme.boardSide, roughness: 0.55, metalness: 0.05 }),
    );
    base.position.y = BOARD_TOP / 2;
    base.castShadow = true;
    base.receiveShadow = true;
    this.root.add(base);
    const grout = new THREE.Mesh(new THREE.PlaneGeometry(L + 0.1, L + 0.1), new THREE.MeshStandardMaterial({ color: theme.grout, roughness: 0.7 }));
    grout.rotation.x = -Math.PI / 2;
    grout.position.y = BOARD_TOP + 0.002;
    grout.receiveShadow = true;
    this.root.add(grout);
    // Золотая окантовка
    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(L + 0.34, 0.05, L + 0.34),
      new THREE.MeshStandardMaterial({ color: theme.id === 'city' ? '#00e5ff' : '#ffcf40', metalness: 0.8, roughness: 0.3, emissive: theme.id === 'city' ? '#00a5bb' : '#000000', emissiveIntensity: 0.6 }),
    );
    rim.position.y = BOARD_TOP - 0.02;
    this.root.add(rim);

    // Центр поля
    const inner = L - 2 * CORNER - 0.08;
    const center = new THREE.Mesh(new THREE.PlaneGeometry(inner, inner), new THREE.MeshStandardMaterial({ map: centerTexture(theme, board.name, this.texScale() > 1 ? 1.5 : 1), roughness: 0.6 }));
    center.rotation.x = -Math.PI / 2;
    center.position.y = BOARD_TOP + 0.006;
    center.receiveShadow = true;
    this.root.add(center);

    // Колоды карточек
    const deckOff = inner * 0.27;
    for (const [kind, x, z] of [
      ['chance', -deckOff, -deckOff],
      ['chest', deckOff, deckOff],
    ] as const) {
      const side = new THREE.MeshStandardMaterial({ color: '#fafafa', roughness: 0.6 });
      const top = new THREE.MeshStandardMaterial({ map: deckTexture(kind), roughness: 0.45 });
      const deck = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.16, 1.4), [side, side, top, side, side, side]);
      deck.position.set(x, BOARD_TOP + 0.08, z);
      deck.rotation.y = Math.PI / 4;
      deck.castShadow = true;
      deck.receiveShadow = true;
      this.root.add(deck);
    }

    // Клетки
    const sideMat = new THREE.MeshStandardMaterial({ color: theme.cellBg2, roughness: 0.6 });
    this.cells = [];
    this.tags = [];
    this.stamps = [];
    this.houses = [];
    this.houseCount = [];
    board.cells.forEach((cell, i) => {
      const p = this.layout[i];
      const tex = p.corner ? cornerTexture(cell, theme, salary, this.texScale()) : cellTexture(board, cell, theme, this.texScale());
      const top = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
      const m = new THREE.Mesh(new THREE.BoxGeometry(p.w - 0.05, CELL_H, p.d - 0.05), [sideMat, sideMat, top, sideMat, sideMat, sideMat]);
      m.position.set(p.x, BOARD_TOP + CELL_H / 2, p.z);
      m.rotation.y = p.rot;
      m.receiveShadow = true;
      m.castShadow = this.quality === 'high';
      m.userData.index = i;
      this.root.add(m);
      this.cells.push(m);
      this.stamps.push(null);
      this.houses.push(null);
      this.houseCount.push(0);
      const hasTag = cell.type === 'property' || cell.type === 'transport' || cell.type === 'utility' || cell.type === 'tax';
      if (hasTag && !p.corner) {
        const canvas = makePriceCanvas(this.texScale());
        const ttex = canvasTexture(canvas);
        const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.3), new THREE.MeshStandardMaterial({ map: ttex, transparent: true, roughness: 0.4 }));
        tag.rotation.x = -Math.PI / 2;
        tag.position.set(0, CELL_H / 2 + 0.004, 0.57);
        m.add(tag);
        this.tags[i] = { canvas, tex: ttex as THREE.CanvasTexture, mesh: tag, key: '' };
      }
    });

    // Подсветка и кольцо активного игрока
    this.highlight.scale.set(1, 1, 1);
    this.root.add(this.highlight, this.activeRing);

    // Кубики
    this.buildDice(diceStyle);

    // Декорации
    this.decor = buildDecor(theme, L, this.quality);
    this.root.add(this.decor.group);

    this.overview(true);
  }

  private clearBoard() {
    for (const t of this.tokens.values()) disposeObject(t.obj);
    this.tokens.clear();
    this.particles.forEach((p) => p.obj.parent?.remove(p.obj));
    this.particles = [];
    this.root.remove(this.highlight, this.activeRing);
    disposeObject(this.root);
    this.scene.remove(this.root);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.dice = [];
    this.decor = null;
    this.follow = null;
  }

  setDiceStyle(style: DiceStyleId) {
    this.dirty = true;
    const pos = this.dice.map((d) => [d.position.clone(), d.quaternion.clone()] as const);
    this.dice.forEach((d) => {
      this.root.remove(d);
      disposeObject(d);
    });
    this.buildDice(style);
    pos.forEach(([p, q], i) => {
      if (this.dice[i]) {
        this.dice[i].position.copy(p);
        this.dice[i].quaternion.copy(q);
      }
    });
  }

  private buildDice(styleId: DiceStyleId) {
    const style = DICE_STYLES.find((d) => d.id === styleId) ?? DICE_STYLES[0];
    // Порядок граней BoxGeometry: +X, -X, +Y, -Y, +Z, -Z → значения 2, 5, 1, 6, 3, 4
    const values = [2, 5, 1, 6, 3, 4];
    const matsArr = values.map(
      (v) =>
        new THREE.MeshStandardMaterial({
          map: diceFaceTexture(style, v),
          roughness: style.rough,
          metalness: style.metal,
          emissive: style.id === 'neon' ? '#39ff14' : '#000000',
          emissiveIntensity: style.id === 'neon' ? 0.08 : 0,
        }),
    );
    const geo = new RoundedBoxGeometry(DIE, DIE, DIE, 4, 0.09);
    this.dice = [0, 1].map((k) => {
      const d = new THREE.Mesh(geo, matsArr);
      d.castShadow = true;
      d.receiveShadow = true;
      d.position.set(k ? 0.5 : -0.5, BOARD_TOP + DIE / 2 + 0.01, k ? -0.3 : 0.4);
      d.quaternion.copy(faceQuat(k ? 3 : 5)).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), k ? 0.4 : -0.3));
      this.root.add(d);
      return d;
    });
  }

  // ───────────── Ценники, дома, залог ─────────────

  setTag(i: number, info: TagInfo) {
    this.dirty = true;
    const t = this.tags[i];
    if (!t) return;
    const key = `${info.text}|${info.bg}|${info.fg}|${info.mortgaged}`;
    if (t.key === key) return;
    t.key = key;
    drawPriceTag(t.canvas, info.text, info.bg, info.fg, info.mortgaged);
    t.tex.needsUpdate = true;
  }

  setMortgaged(i: number, mortgaged: boolean) {
    this.dirty = true;
    const cell = this.cells[i];
    if (!cell) return;
    const top = (cell.material as THREE.MeshStandardMaterial[])[2];
    top.color.set(mortgaged ? '#9a9a9a' : '#ffffff');
    if (mortgaged && !this.stamps[i]) {
      if (!this.stampTex) this.stampTex = mortgageStampTexture();
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: this.stampTex, transparent: true, depthWrite: false }));
      s.rotation.x = -Math.PI / 2;
      s.position.set(0, CELL_H / 2 + 0.008, -0.05);
      cell.add(s);
      this.stamps[i] = s;
    } else if (!mortgaged && this.stamps[i]) {
      cell.remove(this.stamps[i]!);
      this.stamps[i] = null;
    }
  }

  /** Дома (1–4) или отель (5). При animate — эффект строительства */
  setHouses(i: number, count: number, animate = false): Promise<void> {
    this.dirty = true;
    const cell = this.cells[i];
    if (!cell) return Promise.resolve();
    const prev = this.houseCount[i];
    if (prev === count && this.houses[i]) return Promise.resolve();
    this.houseCount[i] = count;
    if (this.houses[i]) {
      cell.remove(this.houses[i]!);
      this.houses[i] = null;
    }
    if (count <= 0) {
      if (animate && prev > 0) this.puff(this.cellWorld(i, -0.6), '#cccccc');
      return Promise.resolve();
    }
    const g = new THREE.Group();
    const items: THREE.Object3D[] = [];
    if (count >= 5) {
      const h = new THREE.Group();
      const b = new THREE.Mesh(this.houseGeo.hotel, this.houseMat.hotel);
      b.position.y = 0.09;
      const r = new THREE.Mesh(this.houseGeo.hotelRoof, this.houseMat.hotelRoof);
      r.position.y = 0.24;
      h.add(b, r);
      items.push(h);
    } else {
      for (let k = 0; k < count; k++) {
        const h = new THREE.Group();
        const b = new THREE.Mesh(this.houseGeo.box, this.houseMat.house);
        b.position.y = 0.065;
        const r = new THREE.Mesh(this.houseGeo.roof, this.houseMat.roof);
        r.position.y = 0.18;
        h.add(b, r);
        h.position.x = (k - 1.5) * 0.22;
        items.push(h);
      }
    }
    items.forEach((it) => {
      it.traverse((c) => ((c.castShadow = true), (c.receiveShadow = true)));
      g.add(it);
    });
    g.position.set(0, CELL_H / 2, -0.6);
    cell.add(g);
    this.houses[i] = g;
    if (!animate || count < prev) return Promise.resolve();
    // Новый дом (или отель) падает сверху с отскоком
    const newcomer = count >= 5 ? items : [items[items.length - 1]];
    newcomer.forEach((it) => it.scale.setScalar(0.01));
    const world = this.cellWorld(i, -0.6);
    return this.tween(520, (t) => {
      const k = easeOutBack(t);
      newcomer.forEach((it) => {
        it.scale.setScalar(Math.max(0.01, k));
        it.position.y = (1 - easeOutCubic(t)) * 0.9;
      });
      if (t >= 1) this.puff(world, count >= 5 ? '#ffb4ad' : '#c8f7c5');
    });
  }

  /** Мировые координаты точки клетки (локальное смещение к центру поля: lz < 0) */
  cellWorld(i: number, lz = 0, lx = 0) {
    const p = this.layout[i];
    if (!p) return new THREE.Vector3();
    const cos = Math.cos(p.rot);
    const sin = Math.sin(p.rot);
    return new THREE.Vector3(p.x + lx * cos + lz * sin, CELL_TOP, p.z - lx * sin + lz * cos);
  }

  // ───────────── Фишки ─────────────

  setPlayers(list: { id: string; token: string; color: string }[]) {
    this.dirty = true;
    const ids = new Set(list.map((x) => x.id));
    for (const [id, t] of this.tokens) {
      if (!ids.has(id)) {
        this.root.remove(t.obj);
        disposeObject(t.obj);
        this.tokens.delete(id);
      }
    }
    for (const p of list) {
      const existing = this.tokens.get(p.id);
      if (existing && existing.obj.userData.key === `${p.token}|${p.color}`) continue;
      if (existing) {
        this.root.remove(existing.obj);
        disposeObject(existing.obj);
      }
      const obj = buildToken(p.token, p.color);
      obj.userData.key = `${p.token}|${p.color}`;
      obj.position.set(this.layout[0]?.x ?? 0, CELL_TOP, this.layout[0]?.z ?? 0);
      this.root.add(obj);
      this.tokens.set(p.id, { id: p.id, obj, cell: existing?.cell ?? 0, inJail: existing?.inJail ?? false, hidden: false, moving: false });
    }
  }

  /** Мгновенно расставить фишку */
  placeToken(id: string, cell: number, inJail: boolean, hidden = false) {
    this.dirty = true;
    const t = this.tokens.get(id);
    if (!t) return;
    t.cell = cell;
    t.inJail = inJail;
    t.hidden = hidden;
    t.obj.visible = !hidden;
    t.obj.scale.setScalar(1);
    t.obj.rotation.set(0, t.obj.rotation.y, 0);
  }

  /** Пересчитать слоты фишек на клетках (с плавным сдвигом) */
  relayout(instant = false) {
    this.dirty = true;
    const groups = new Map<string, TokenView[]>();
    for (const t of this.tokens.values()) {
      if (t.hidden || t.moving) continue;
      const key = `${t.cell}|${t.inJail}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }
    for (const list of groups.values()) {
      list.forEach((t, k) => {
        const p = this.layout[t.cell];
        if (!p) return;
        const s = tokenSlot(p, k, list.length, t.inJail);
        const target = new THREE.Vector3(s.x, CELL_TOP, s.z);
        const face = this.faceAngle(t.cell);
        if (instant || document.hidden) {
          t.obj.position.copy(target);
          t.obj.rotation.y = face;
        } else {
          const from = t.obj.position.clone();
          if (from.distanceTo(target) < 0.001) return;
          const r0 = t.obj.rotation.y;
          this.tween(260, (k2) => {
            t.obj.position.lerpVectors(from, target, easeInOut(k2));
            t.obj.rotation.y = lerpAngle(r0, face, k2);
          });
        }
      });
    }
  }

  /** Направление «вперёд» вдоль поля на этой клетке */
  private faceAngle(cell: number) {
    const n = this.layout.length;
    const a = this.layout[cell];
    const b = this.layout[(cell + 1) % n];
    if (!a || !b) return 0;
    return Math.atan2(b.x - a.x, b.z - a.z);
  }

  /** Пошаговое перемещение фишки с прыжками */
  async moveToken(id: string, from: number, steps: number): Promise<void> {
    const t = this.tokens.get(id);
    if (!t) return;
    const n = this.layout.length;
    t.moving = true;
    t.inJail = false;
    t.obj.visible = true;
    if (this.cameraFollow) this.followObject(t.obj, this.near(0.62));
    const dir = Math.sign(steps) || 1;
    let cur = from;
    // Остальные фишки на стартовой клетке перестраиваются
    this.relayout();
    const stepMs = Math.max(90, 240 * this.speed);
    for (let k = 0; k < Math.abs(steps); k++) {
      const next = (((cur + dir) % n) + n) % n;
      const a = t.obj.position.clone();
      const p = this.layout[next];
      const b = new THREE.Vector3(p.x, CELL_TOP, p.z);
      if (k === Math.abs(steps) - 1) {
        // Последний прыжок — сразу в свободный слот
        const others = [...this.tokens.values()].filter((o) => o !== t && !o.hidden && o.cell === next && !o.inJail).length;
        const s = tokenSlot(p, others, others + 1);
        b.set(s.x, CELL_TOP, s.z);
      }
      const face = Math.atan2(b.x - a.x, b.z - a.z);
      const r0 = t.obj.rotation.y;
      await this.tween(stepMs, (q) => {
        t.obj.position.lerpVectors(a, b, q);
        t.obj.position.y = CELL_TOP + Math.sin(q * Math.PI) * 0.45;
        t.obj.rotation.y = lerpAngle(r0, face, Math.min(1, q * 2));
        const sq = q > 0.85 ? 1 - (q - 0.85) * 1.6 : 1;
        t.obj.scale.set(1 + (1 - sq) * 0.5, sq, 1 + (1 - sq) * 0.5);
      });
      t.obj.scale.setScalar(1);
      cur = next;
      t.cell = cur;
      this.onStep?.();
    }
    t.moving = false;
    t.cell = cur;
    this.relayout();
  }

  /** Перенос фишки (тюрьма, телепорт по карточке) */
  async teleportToken(id: string, to: number, inJail: boolean): Promise<void> {
    const t = this.tokens.get(id);
    if (!t) return;
    t.moving = true;
    const a = t.obj.position.clone();
    const p = this.layout[to];
    const others = [...this.tokens.values()].filter((o) => o !== t && !o.hidden && o.cell === to && o.inJail === inJail).length;
    const s = tokenSlot(p, others, others + 1, inJail);
    const b = new THREE.Vector3(s.x, CELL_TOP, s.z);
    if (this.cameraFollow) this.followObject(t.obj, this.near(0.7));
    await this.tween(Math.max(300, 800 * this.speed), (q) => {
      const e = easeInOut(q);
      t.obj.position.lerpVectors(a, b, e);
      t.obj.position.y = CELL_TOP + Math.sin(q * Math.PI) * 2.2;
      t.obj.rotation.y += 0.25;
    });
    t.cell = to;
    t.inJail = inJail;
    t.moving = false;
    this.relayout();
  }

  async bankruptToken(id: string): Promise<void> {
    const t = this.tokens.get(id);
    if (!t || t.hidden) return;
    const start = t.obj.position.clone();
    this.puff(start.clone().setY(CELL_TOP + 0.3), '#555555', 18);
    await this.tween(1200, (q) => {
      t.obj.rotation.y += 0.35;
      t.obj.position.y = start.y + Math.sin(q * Math.PI) * 0.8;
      t.obj.scale.setScalar(Math.max(0.01, 1 - easeInOut(q)));
    });
    t.hidden = true;
    t.obj.visible = false;
    this.relayout();
  }

  setActive(id: string | null, color?: string) {
    this.dirty = true;
    this.activeId = id;
    this.activeRing.visible = !!id && this.tokens.has(id);
    if (color) (this.activeRing.material as THREE.MeshBasicMaterial).color.set(color);
  }

  tokenPosition(id: string) {
    return this.tokens.get(id)?.obj.position.clone() ?? new THREE.Vector3(0, CELL_TOP, 0);
  }

  // ───────────── Кубики ─────────────

  async rollDice(d1: number, d2: number): Promise<void> {
    if (this.dice.length < 2) return;
    const inner = this.L - 2 * CORNER;
    const restY = BOARD_TOP + DIE / 2 + 0.006;
    const camDir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target).setY(0).normalize();
    const side = new THREE.Vector3(-camDir.z, 0, camDir.x);
    const ends = [
      side.clone().multiplyScalar(-0.42 + (Math.random() - 0.5) * 0.2).addScaledVector(camDir, (Math.random() - 0.5) * 0.4),
      side.clone().multiplyScalar(0.42 + (Math.random() - 0.5) * 0.2).addScaledVector(camDir, (Math.random() - 0.5) * 0.4),
    ];
    const starts = ends.map((e, k) => e.clone().addScaledVector(camDir, inner * 0.42).addScaledVector(side, (k ? 1 : -1) * 0.6).setY(restY + 1.6));
    const finals = [d1, d2].map((v) => faceQuat(v).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2)));
    const axes = [0, 1].map(() => new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize());
    const spins = [0, 1].map(() => Math.PI * (5 + Math.random() * 3));
    if (this.cameraFollow) this.focusOn(new THREE.Vector3(0, BOARD_TOP, 0), this.near(0.6));
    let hits = 0;
    const dur = Math.max(700, 1250 * this.speed);
    await this.tween(dur, (t) => {
      this.dice.forEach((d, k) => {
        const e = easeOutCubic(t);
        d.position.lerpVectors(starts[k], ends[k], e);
        const bounce = Math.abs(Math.sin(Math.PI * 3 * t)) * 0.75 * Math.pow(1 - t, 2);
        d.position.y = restY + 1.6 * Math.pow(1 - t, 3) + bounce;
        const spin = new THREE.Quaternion().setFromAxisAngle(axes[k], spins[k] * Math.pow(1 - t, 2));
        d.quaternion.copy(spin).multiply(finals[k]);
      });
      const h = Math.floor(t * 3);
      if (h > hits && t < 0.95) {
        hits = h;
        this.onDiceHit?.();
      }
    });
    this.dice.forEach((d, k) => {
      d.position.copy(ends[k]).setY(restY);
      d.quaternion.copy(finals[k]);
    });
    if (d1 === d2) this.sparkle(new THREE.Vector3(0, restY + 0.4, 0), '#ffd700', 24);
  }

  // ───────────── Камера ─────────────

  /** Дистанция камеры с поправкой на узкий (портретный) экран */
  private near(k: number) {
    return (this.L * k) / Math.min(1, this.camera.aspect / 1.15);
  }

  private fitDistance() {
    const vfov = (this.camera.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    const half = this.L * 0.62;
    return Math.max(half / Math.tan(vfov / 2) * 0.95, half / Math.tan(hfov / 2) * 1.0);
  }

  overview(instant = false) {
    this.follow = null;
    const dist = this.fitDistance();
    this.controls.maxDistance = Math.max(dist * 1.8, 20);
    const elev = 0.95; // ~54°
    const dir = new THREE.Vector3(0, Math.sin(elev), Math.cos(elev));
    if (instant) {
      this.controls.target.set(0, 0, 0);
      this.camera.position.copy(dir.multiplyScalar(dist));
      this.focusPoint = null;
      this.focusDist = null;
      this.controls.update();
    } else {
      this.focusOn(new THREE.Vector3(0, 0, 0), dist);
    }
    this.controls.maxDistance = Math.max(dist * 1.8, 20);
  }

  focusOn(p: THREE.Vector3, dist?: number) {
    this.follow = null;
    this.focusPoint = p.clone();
    this.focusDist = dist ?? null;
    this.lastUser = -1e9;
  }

  followObject(o: THREE.Object3D, dist?: number) {
    this.follow = o;
    this.focusPoint = null;
    this.focusDist = dist ?? null;
    this.lastUser = -1e9;
  }

  followToken(id: string, dist?: number) {
    const t = this.tokens.get(id);
    if (t && this.cameraFollow) this.followObject(t.obj, dist ?? this.near(0.62));
  }

  focusCell(i: number) {
    const p = this.layout[i];
    if (p) this.focusOn(new THREE.Vector3(p.x * 0.85, 0, p.z * 0.85), this.near(0.55));
  }

  private updateCamera(dt: number): boolean {
    const idle = !this.userActive && this.time - this.lastUser > 3500;
    if (this.menuMode) {
      const a = this.time * 0.00006;
      const dist = this.fitDistance() * 0.95;
      const elev = 0.62;
      const target = new THREE.Vector3(Math.cos(a) * dist * Math.cos(elev), dist * Math.sin(elev), Math.sin(a) * dist * Math.cos(elev));
      this.camera.position.lerp(target, 1 - Math.exp(-dt * 1.5));
      this.controls.target.lerp(new THREE.Vector3(0, 0, 0), 1 - Math.exp(-dt * 2));
      return true;
    }
    if (!idle) return false;
    let want = this.follow ? this.follow.position.clone().setY(0) : this.focusPoint?.clone() ?? null;
    if (!want) return false;
    // На узком (портретном) экране смотрим ближе к центру доски, чтобы поле оставалось в кадре
    if (this.camera.aspect < 1) want.multiplyScalar(0.25 + 0.5 * this.camera.aspect);
    const before = this.camera.position.clone();
    const k = 1 - Math.exp(-dt * 2.6);
    const delta = want.clone().sub(this.controls.target).multiplyScalar(k);
    this.controls.target.add(delta);
    this.camera.position.add(delta);
    if (this.focusDist) {
      const off = this.camera.position.clone().sub(this.controls.target);
      const len = off.length();
      const nl = len + (this.focusDist - len) * k * 0.8;
      off.setLength(nl);
      this.camera.position.copy(this.controls.target).add(off);
    }
    return before.distanceToSquared(this.camera.position) > 1e-7;
  }

  // ───────────── Эффекты ─────────────

  highlightCell(i: number | null, color = '#ffffff') {
    this.dirty = true;
    const m = this.highlight.material as THREE.MeshBasicMaterial;
    if (i == null || !this.layout[i]) {
      m.opacity = 0;
      this.highlight.userData.on = false;
      return;
    }
    const p = this.layout[i];
    this.highlight.position.set(p.x, CELL_TOP + 0.01, p.z);
    this.highlight.rotation.set(-Math.PI / 2, 0, p.rot);
    this.highlight.scale.set(p.w, p.d, 1);
    m.color.set(color);
    this.highlight.userData.on = true;
  }

  floatText(pos: THREE.Vector3, text: string, color: string) {
    const tex = textSprite(text, color);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    s.renderOrder = 20;
    s.scale.set(2.2, 0.55, 1);
    s.position.copy(pos).add(new THREE.Vector3(0, 0.9, 0));
    this.root.add(s);
    this.particles.push({
      obj: s,
      vel: new THREE.Vector3(0, 0.9, 0),
      life: 0,
      max: 1.7,
      update: (p, k) => {
        (p.obj as THREE.Sprite).material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
        const sc = k < 0.15 ? 0.6 + k * 2.6 : 1;
        p.obj.scale.set(2.2 * sc, 0.55 * sc, 1);
      },
    });
  }

  coinBurst(pos: THREE.Vector3, count = 10) {
    for (let i = 0; i < count; i++) {
      const c = new THREE.Mesh(this.coinGeo, this.coinMat);
      c.position.copy(pos).add(new THREE.Vector3(0, 0.4, 0));
      c.castShadow = this.quality === 'high';
      this.root.add(c);
      const a = Math.random() * Math.PI * 2;
      this.particles.push({
        obj: c,
        vel: new THREE.Vector3(Math.cos(a) * (0.6 + Math.random()), 2.5 + Math.random() * 2, Math.sin(a) * (0.6 + Math.random())),
        spin: new THREE.Vector3(Math.random() * 10, Math.random() * 10, 0),
        gravity: 9,
        life: 0,
        max: 0.9 + Math.random() * 0.4,
      });
    }
  }

  /** Монеты летят от одной точки к другой */
  coinFlow(from: THREE.Vector3, to: THREE.Vector3, count = 8) {
    for (let i = 0; i < count; i++) {
      const c = new THREE.Mesh(this.coinGeo, this.coinMat);
      c.visible = false;
      this.root.add(c);
      const delay = i * 0.06;
      const a = from.clone().add(new THREE.Vector3(0, 0.4, 0));
      const b = to.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.2, 0.4, (Math.random() - 0.5) * 0.2));
      const h = 1.2 + Math.random() * 0.8;
      this.particles.push({
        obj: c,
        vel: new THREE.Vector3(),
        life: 0,
        max: 0.75 + delay,
        update: (p, _k) => {
          const t = Math.max(0, (p.life - delay) / 0.75);
          c.visible = p.life > delay;
          c.position.lerpVectors(a, b, easeInOut(Math.min(1, t)));
          c.position.y += Math.sin(Math.min(1, t) * Math.PI) * h;
          c.rotation.x += 0.3;
          c.rotation.z += 0.2;
        },
      });
    }
  }

  sparkle(pos: THREE.Vector3, color: string, count = 16) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const geo = new THREE.OctahedronGeometry(0.06, 0);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(pos);
      this.root.add(m);
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 2 + 1;
      this.particles.push({
        obj: m,
        vel: new THREE.Vector3(Math.cos(a) * 1.5, up, Math.sin(a) * 1.5),
        gravity: 3,
        life: 0,
        max: 1,
        spin: new THREE.Vector3(5, 7, 0),
        update: (_p, k) => {
          mat.opacity = 1 - k;
        },
      });
    }
  }

  /** Эффект покупки: волна в цвете игрока и искры */
  buyFx(i: number, color: string) {
    const p = this.layout[i];
    if (!p) return;
    const center = new THREE.Vector3(p.x, CELL_TOP + 0.02, p.z);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.55, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(center);
    this.root.add(ring);
    this.particles.push({
      obj: ring,
      vel: new THREE.Vector3(),
      life: 0,
      max: 0.9,
      update: (pp, k) => {
        pp.obj.scale.setScalar(1 + k * 2.5);
        (ring.material as THREE.MeshBasicMaterial).opacity = 1 - k;
      },
    });
    this.sparkle(center.clone().setY(CELL_TOP + 0.3), color, 20);
    this.sparkle(center.clone().setY(CELL_TOP + 0.3), '#ffffff', 10);
  }

  puff(pos: THREE.Vector3, color: string, count = 10) {
    const mat = new THREE.MeshStandardMaterial({ color, transparent: true, depthWrite: false, roughness: 1 });
    const geo = new THREE.SphereGeometry(0.12, 8, 6);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.1, (Math.random() - 0.5) * 0.3));
      this.root.add(m);
      const a = Math.random() * Math.PI * 2;
      this.particles.push({
        obj: m,
        vel: new THREE.Vector3(Math.cos(a) * 0.8, 0.4 + Math.random() * 0.6, Math.sin(a) * 0.8),
        life: 0,
        max: 0.8,
        update: (pp, k) => {
          pp.obj.scale.setScalar(1 + k * 2);
          mat.opacity = 0.8 * (1 - k);
        },
      });
    }
  }

  confetti(count = 220) {
    const colors = ['#ff4757', '#ffa502', '#2ed573', '#1e90ff', '#a55eea', '#ffd32a', '#ff6b9d'];
    const geo = new THREE.PlaneGeometry(0.14, 0.08);
    const n = this.quality === 'low' ? Math.round(count / 3) : count;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide, transparent: true }));
      m.position.set((Math.random() - 0.5) * this.L, 6 + Math.random() * 6, (Math.random() - 0.5) * this.L);
      this.root.add(m);
      this.particles.push({
        obj: m,
        vel: new THREE.Vector3((Math.random() - 0.5) * 0.6, -1.4 - Math.random(), (Math.random() - 0.5) * 0.6),
        spin: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        life: 0,
        max: 6 + Math.random() * 2,
        update: (pp, k) => {
          pp.obj.position.x += Math.sin(pp.life * 3 + i) * 0.01;
          ((pp.obj as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = k > 0.85 ? (1 - k) / 0.15 : 1;
          if (pp.obj.position.y < BOARD_TOP + 0.1) {
            pp.obj.position.y = BOARD_TOP + 0.1;
            pp.vel.set(0, 0, 0);
            pp.spin?.set(0, 0, 0);
          }
        },
      });
    }
  }

  // ───────────── Режим главного меню ─────────────

  setMenuMode(on: boolean) {
    this.dirty = true;
    this.menuMode = on;
    this.controls.enabled = !on;
    this.activeRing.visible = !on && !!this.activeId;
    if (on) {
      this.startMenuDemo();
    } else {
      this.menuLoop++;
      this.overview(true);
    }
  }

  private async startMenuDemo() {
    const loopId = ++this.menuLoop;
    const ids = [...this.tokens.keys()];
    const n = this.layout.length;
    await sleep(1200);
    while (this.menuMode && loopId === this.menuLoop) {
      if (!document.hidden && ids.length) {
        const id = ids[Math.floor(Math.random() * ids.length)];
        const t = this.tokens.get(id);
        if (t) {
          const d1 = 1 + Math.floor(Math.random() * 6);
          const d2 = 1 + Math.floor(Math.random() * 6);
          const saveFollow = this.cameraFollow;
          this.cameraFollow = false;
          await this.rollDice(d1, d2);
          if (!this.menuMode || loopId !== this.menuLoop) break;
          await this.moveToken(id, t.cell, d1 + d2);
          this.cameraFollow = saveFollow;
          if (Math.random() < 0.4) {
            const cell = t.cell;
            if (this.tags[cell]) {
              this.buyFx(cell, (t.obj.userData.key as string).split('|')[1]);
              this.setTag(cell, { text: '$' + (20 + Math.floor(Math.random() * 30) * 10), bg: (t.obj.userData.key as string).split('|')[1], fg: '#ffffff', mortgaged: false });
              if (Math.random() < 0.5) this.setHouses(cell, 1 + Math.floor(Math.random() * 5), true);
            } else this.coinBurst(t.obj.position, 8);
          }
          void n;
        }
      }
      await sleep(1600);
    }
  }

  // ───────────── Служебное ─────────────

  tween(dur: number, fn: (t: number) => void): Promise<void> {
    if (dur <= 0 || document.hidden) {
      fn(1);
      return Promise.resolve();
    }
    return new Promise((resolve) => this.tweens.push({ start: this.time, dur, fn, resolve }));
  }

  finishAll() {
    const list = this.tweens;
    this.tweens = [];
    for (const tw of list) {
      try {
        tw.fn(1);
      } catch {
        /* ignore */
      }
      tw.resolve();
    }
  }

  private pick(x: number, y: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hit = ray.intersectObjects(this.cells, false)[0];
    if (hit) this.onCellClick?.(hit.object.userData.index as number);
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dtMs = Math.min(100, now - this.last);
    this.last = now;
    this.time += dtMs;
    const dt = dtMs / 1000;

    // Анимации
    if (this.tweens.length) {
      const list = this.tweens;
      this.tweens = [];
      const keep: Tween[] = [];
      for (const tw of list) {
        const k = Math.min(1, (this.time - tw.start) / tw.dur);
        tw.fn(k);
        if (k >= 1) tw.resolve();
        else keep.push(tw);
      }
      this.tweens = keep.concat(this.tweens);
    }

    // Частицы
    if (this.particles.length) {
      const keep: Particle[] = [];
      for (const p of this.particles) {
        p.life += dt;
        const k = Math.min(1, p.life / p.max);
        if (p.gravity) p.vel.y -= p.gravity * dt;
        p.obj.position.addScaledVector(p.vel, dt);
        if (p.spin) {
          p.obj.rotation.x += p.spin.x * dt;
          p.obj.rotation.y += p.spin.y * dt;
          p.obj.rotation.z += p.spin.z * dt;
        }
        p.update?.(p, k);
        if (k >= 1) {
          this.root.remove(p.obj);
          if ((p.obj as THREE.Sprite).isSprite) {
            const m = (p.obj as THREE.Sprite).material;
            m.map?.dispose();
            m.dispose();
          }
        } else keep.push(p);
      }
      this.particles = keep;
    }

    // Фоновые «живые» эффекты (парящие декорации, пульсация) — только на высоком качестве,
    // иначе кадры рисуются лишь когда что-то действительно меняется
    const ambient = this.quality === 'high';
    const busy = this.tweens.length > 0 || this.particles.length > 0 || this.menuMode;
    const pulse = ambient || busy ? Math.sin(this.time * 0.006) : 0;

    if (this.highlight.userData.on) {
      (this.highlight.material as THREE.MeshBasicMaterial).opacity = 0.32 + pulse * 0.15;
    }
    if (this.activeRing.visible && this.activeId) {
      const t = this.tokens.get(this.activeId);
      if (t && !t.hidden) {
        this.activeRing.position.set(t.obj.position.x, CELL_TOP + 0.015, t.obj.position.z);
        this.activeRing.scale.setScalar(1 + pulse * 0.12);
      } else this.activeRing.visible = false;
    }
    if (ambient || this.menuMode) this.decor?.update(this.time / 1000);

    const camMoved = this.updateCamera(dt);
    const ctrlMoved = this.controls.update();
    if (!(busy || ambient || camMoved || ctrlMoved || this.dirty || this.userActive)) return;
    // На низком качестве — не чаще 30 кадров в секунду
    if (this.quality === 'low' && now - this.lastRender < 31) return;

    // Контроль производительности: если во время анимаций кадры идут медленно — сообщаем
    if (busy && this.lastRender && now - this.lastRender < 400 && now > this.perf.quietUntil) {
      this.perf.sum += now - this.lastRender;
      this.perf.n++;
      if (this.perf.n >= 45) {
        const avg = this.perf.sum / this.perf.n;
        this.perf.sum = 0;
        this.perf.n = 0;
        if (avg > 48) {
          this.perf.quietUntil = now + 15000;
          if (this.quality !== 'low') this.onSlow?.();
          else if (this.resScale > 0.6) {
            // Уже низкое качество — плавно уменьшаем разрешение (но не ниже 1×)
            this.resScale -= 0.2;
            this.applyQuality();
          }
        }
      }
    }
    this.lastRender = now;
    this.dirty = false;
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.clearBoard();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

// ───────────── Вспомогательные ─────────────

/** Поворот кубика, при котором значение v смотрит вверх */
function faceQuat(v: number): THREE.Quaternion {
  const q = new THREE.Quaternion();
  const X = new THREE.Vector3(1, 0, 0);
  const Z = new THREE.Vector3(0, 0, 1);
  switch (v) {
    case 1:
      return q;
    case 6:
      return q.setFromAxisAngle(X, Math.PI);
    case 2:
      return q.setFromAxisAngle(Z, Math.PI / 2);
    case 5:
      return q.setFromAxisAngle(Z, -Math.PI / 2);
    case 3:
      return q.setFromAxisAngle(X, -Math.PI / 2);
    case 4:
      return q.setFromAxisAngle(X, Math.PI / 2);
  }
  return q;
}

function lerpAngle(a: number, b: number, t: number) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 20, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,0.9)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
