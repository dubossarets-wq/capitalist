// Декорации вокруг поля для каждой темы
import * as THREE from 'three';
import type { ThemeDef } from './themes';
import { canvasTexture, mulberry } from './textures';

export interface Decor {
  group: THREE.Group;
  update: (t: number) => void;
}

function cast<T extends THREE.Object3D>(o: T): T {
  o.traverse((c) => {
    c.castShadow = true;
    c.receiveShadow = true;
  });
  return o;
}

function windowTexture(seed: number) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#0d1030';
  ctx.fillRect(0, 0, 64, 128);
  const r = mulberry(seed);
  for (let y = 4; y < 128; y += 10) {
    for (let x = 4; x < 64; x += 10) {
      const on = r() < 0.55;
      ctx.fillStyle = on ? (r() < 0.5 ? '#ffe9a3' : '#8ff4ff') : '#1a1f4a';
      ctx.fillRect(x, y, 6, 6);
    }
  }
  const t = canvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  return t;
}

export function buildDecor(theme: ThemeDef, L: number, quality: 'low' | 'medium' | 'high'): Decor {
  const g = new THREE.Group();
  const rnd = mulberry(42);
  const count = quality === 'low' ? 0.4 : quality === 'medium' ? 0.7 : 1;
  const floaters: { o: THREE.Object3D; base: number; phase: number; spin: number }[] = [];
  const R0 = L * 0.62;

  const around = (n: number, rMin: number, rMax: number, fn: (x: number, z: number, a: number, i: number) => void) => {
    for (let i = 0; i < Math.round(n * count); i++) {
      const a = rnd() * Math.PI * 2;
      const r = rMin + rnd() * (rMax - rMin);
      fn(Math.cos(a) * r, Math.sin(a) * r, a, i);
    }
  };

  if (theme.id === 'classic') {
    const gold = new THREE.MeshStandardMaterial({ color: '#ffc928', metalness: 0.9, roughness: 0.25 });
    const coinG = new THREE.CylinderGeometry(0.28, 0.28, 0.06, 28);
    const billM = new THREE.MeshStandardMaterial({ color: '#6fbf73', roughness: 0.6 });
    const billM2 = new THREE.MeshStandardMaterial({ color: '#e8f5e9', roughness: 0.6 });
    around(14, R0 + 0.8, R0 + 4, (x, z) => {
      const stack = new THREE.Group();
      const h = 2 + Math.floor(rnd() * 7);
      for (let k = 0; k < h; k++) {
        const c = new THREE.Mesh(coinG, gold);
        c.position.set((rnd() - 0.5) * 0.04, 0.03 + k * 0.065, (rnd() - 0.5) * 0.04);
        stack.add(c);
      }
      stack.position.set(x, 0, z);
      g.add(cast(stack));
    });
    around(6, R0 + 1.2, R0 + 4, (x, z, a) => {
      const bundle = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, 0.5), k % 2 ? billM : billM2);
        b.position.y = 0.02 + k * 0.045;
        b.rotation.y = (rnd() - 0.5) * 0.2;
        bundle.add(b);
      }
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.52), new THREE.MeshStandardMaterial({ color: '#c62828' }));
      band.position.y = 0.09;
      bundle.add(band);
      bundle.position.set(x, 0, z);
      bundle.rotation.y = a;
      g.add(cast(bundle));
    });
    // Парящие монеты
    around(8, R0 + 0.5, R0 + 3, (x, z) => {
      const c = new THREE.Mesh(coinG, gold);
      c.rotation.x = Math.PI / 2;
      c.position.set(x, 1.5 + rnd() * 1.5, z);
      c.scale.setScalar(1.3);
      g.add(cast(c));
      floaters.push({ o: c, base: c.position.y, phase: rnd() * 6, spin: 1 + rnd() });
    });
  } else if (theme.id === 'city') {
    const n = quality === 'low' ? 14 : 34;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.1;
      const r = R0 + 3 + rnd() * 4;
      const w = 0.8 + rnd() * 1.2;
      const h = 1.5 + rnd() * 6;
      const tex = windowTexture(i + 1);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(Math.max(1, Math.round(w)), Math.max(1, Math.round(h / 2)));
      const m = new THREE.MeshStandardMaterial({ color: '#2a2f5e', emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.9, roughness: 0.6, map: tex });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), m);
      b.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
      g.add(cast(b));
      if (rnd() < 0.35) {
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.8, 6), new THREE.MeshStandardMaterial({ color: '#ff3df2', emissive: '#ff3df2', emissiveIntensity: 2 }));
        tip.position.set(b.position.x, h + 0.4, b.position.z);
        g.add(tip);
        floaters.push({ o: tip, base: tip.position.y, phase: rnd() * 6, spin: 0 });
      }
    }
    // Неоновое кольцо вокруг поля
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(L * 0.74, 0.05, 8, 96),
      new THREE.MeshStandardMaterial({ color: '#00e5ff', emissive: '#00e5ff', emissiveIntensity: 2.5 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.05;
    g.add(ring);
    const ring2 = ring.clone();
    (ring2 as THREE.Mesh).material = new THREE.MeshStandardMaterial({ color: '#ff3df2', emissive: '#ff3df2', emissiveIntensity: 2.5 });
    ring2.scale.setScalar(1.06);
    g.add(ring2);
    // Фонари
    around(10, R0 + 1, R0 + 2.5, (x, z) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.6, 8), new THREE.MeshStandardMaterial({ color: '#333a55' }));
      pole.position.set(x, 0.8, z);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#9ff', emissiveIntensity: 2 }));
      lamp.position.set(x, 1.65, z);
      g.add(cast(pole), lamp);
    });
  } else {
    const trunk = new THREE.MeshStandardMaterial({ color: '#8d5a3b', roughness: 0.8 });
    const leaves = ['#7ee081', '#ff9ed8', '#b48cff', '#5fd39a'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }));
    around(16, R0 + 1.2, R0 + 6, (x, z) => {
      const tree = new THREE.Group();
      const h = 0.6 + rnd() * 0.8;
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, h, 8), trunk);
      t.position.y = h / 2;
      tree.add(t);
      const lm = leaves[Math.floor(rnd() * leaves.length)];
      for (let k = 0; k < 3; k++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.55 - k * 0.13, 0.7, 10), lm);
        c.position.y = h + 0.2 + k * 0.38;
        tree.add(c);
      }
      tree.position.set(x, 0, z);
      tree.scale.setScalar(0.9 + rnd() * 0.9);
      g.add(cast(tree));
    });
    const cap = new THREE.MeshStandardMaterial({ color: '#ff4d6d', roughness: 0.4 });
    const stem = new THREE.MeshStandardMaterial({ color: '#fff3e0', roughness: 0.6 });
    const dot = new THREE.MeshStandardMaterial({ color: '#ffffff' });
    around(12, R0 + 0.6, R0 + 3.5, (x, z) => {
      const mush = new THREE.Group();
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.35, 12), stem);
      s.position.y = 0.17;
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), cap);
      c.position.y = 0.33;
      mush.add(s, c);
      for (let k = 0; k < 5; k++) {
        const a = rnd() * Math.PI * 2;
        const d = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), dot);
        d.position.set(Math.cos(a) * 0.2, 0.33 + 0.2, Math.sin(a) * 0.2);
        mush.add(d);
      }
      mush.position.set(x, 0, z);
      mush.scale.setScalar(0.8 + rnd() * 1.2);
      g.add(cast(mush));
    });
    const crystalColors = ['#a7f3ff', '#ffb3f2', '#d4b3ff', '#fff59d'];
    around(10, R0 + 0.6, R0 + 3, (x, z, _a, i) => {
      const col = crystalColors[i % crystalColors.length];
      const cr = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.25, 0),
        new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.6, roughness: 0.1, flatShading: true }),
      );
      cr.scale.set(1, 1.6, 1);
      cr.position.set(x, 0.9 + rnd(), z);
      g.add(cr);
      floaters.push({ o: cr, base: cr.position.y, phase: rnd() * 6, spin: 0.8 });
    });
    // Замок
    const castle = new THREE.Group();
    const wall = new THREE.MeshStandardMaterial({ color: '#fbe7ff', roughness: 0.7 });
    const roof = new THREE.MeshStandardMaterial({ color: '#8e5bd8', roughness: 0.5 });
    const keep = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.2), wall);
    keep.position.y = 0.7;
    castle.add(keep);
    for (const [x, z] of [
      [-0.9, -0.7],
      [0.9, -0.7],
      [-0.9, 0.7],
      [0.9, 0.7],
    ]) {
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 2, 14), wall);
      tw.position.set(x, 1, z);
      const rf = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.8, 14), roof);
      rf.position.set(x, 2.4, z);
      castle.add(tw, rf);
    }
    const big = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 2.6, 14), wall);
    big.position.y = 1.3;
    const bigRoof = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.1, 14), roof);
    bigRoof.position.y = 3.15;
    castle.add(big, bigRoof);
    castle.position.set(-(R0 + 4.5), 0, -(R0 + 3));
    castle.rotation.y = 0.7;
    g.add(cast(castle));
  }

  return {
    group: g,
    update: (t: number) => {
      for (const f of floaters) {
        f.o.position.y = f.base + Math.sin(t * 1.4 + f.phase) * 0.18;
        if (f.spin) f.o.rotation.y = t * f.spin + f.phase;
      }
    },
  };
}
