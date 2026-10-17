// Объёмные игровые фишки, собранные из примитивов
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const V = (x: number, y: number) => new THREE.Vector2(x, y);

function mats(color: string) {
  const c = new THREE.Color(color);
  return {
    main: new THREE.MeshStandardMaterial({ color: c, roughness: 0.32, metalness: 0.15 }),
    dark: new THREE.MeshStandardMaterial({ color: c.clone().multiplyScalar(0.55), roughness: 0.4, metalness: 0.1 }),
    light: new THREE.MeshStandardMaterial({ color: c.clone().lerp(new THREE.Color('#ffffff'), 0.55), roughness: 0.3 }),
    gold: new THREE.MeshStandardMaterial({ color: '#ffcf40', roughness: 0.22, metalness: 0.85 }),
    silver: new THREE.MeshStandardMaterial({ color: '#dfe6ee', roughness: 0.2, metalness: 0.9 }),
    white: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35 }),
    black: new THREE.MeshStandardMaterial({ color: '#1b1b22', roughness: 0.4 }),
    orange: new THREE.MeshStandardMaterial({ color: '#ff9800', roughness: 0.35 }),
    glass: new THREE.MeshStandardMaterial({ color: '#9fe8ff', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.75 }),
    glow: new THREE.MeshStandardMaterial({ color: '#fff59d', emissive: '#ffeb3b', emissiveIntensity: 1.2 }),
  };
}

type M = ReturnType<typeof mats>;

function mesh(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

function lathe(points: THREE.Vector2[], m: THREE.Material, seg = 28) {
  return mesh(new THREE.LatheGeometry(points, seg), m);
}

const builders: Record<string, (m: M) => THREE.Object3D[]> = {
  pawn: (m) => [
    lathe([V(0, 0), V(0.2, 0), V(0.2, 0.05), V(0.15, 0.09), V(0.09, 0.2), V(0.07, 0.32), V(0.13, 0.34), V(0.13, 0.36), V(0.05, 0.38), V(0, 0.38)], m.main),
    mesh(new THREE.SphereGeometry(0.11, 24, 16), m.main, 0, 0.46, 0),
    mesh(new THREE.TorusGeometry(0.15, 0.02, 8, 32), m.gold, 0, 0.06, 0).rotateX(Math.PI / 2),
  ],
  tophat: (m) => [
    mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.035, 32), m.black, 0, 0.02, 0),
    mesh(new THREE.CylinderGeometry(0.15, 0.14, 0.36, 32), m.black, 0, 0.21, 0),
    mesh(new THREE.CylinderGeometry(0.152, 0.145, 0.07, 32), m.main, 0, 0.09, 0),
    mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), m.gold, 0, 0.09, 0.15),
  ],
  car: (m) => {
    const body = mesh(new RoundedBoxGeometry(0.5, 0.15, 0.27, 3, 0.05), m.main, 0, 0.12, 0);
    const cabin = mesh(new RoundedBoxGeometry(0.26, 0.13, 0.23, 3, 0.05), m.light, -0.03, 0.24, 0);
    const out: THREE.Object3D[] = [body, cabin];
    for (const [x, z] of [
      [0.15, 0.13],
      [-0.15, 0.13],
      [0.15, -0.13],
      [-0.15, -0.13],
    ]) {
      const w = mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.06, 18), m.black, x, 0.065, z);
      w.rotation.x = Math.PI / 2;
      out.push(w);
      const hub = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.065, 12), m.silver, x, 0.065, z);
      hub.rotation.x = Math.PI / 2;
      out.push(hub);
    }
    out.push(mesh(new THREE.SphereGeometry(0.025, 10, 8), m.glow, 0.25, 0.13, 0.08));
    out.push(mesh(new THREE.SphereGeometry(0.025, 10, 8), m.glow, 0.25, 0.13, -0.08));
    // Машина смотрит вдоль +X; разворачиваем к +Z (направление «вперёд» фишки)
    out.forEach((o) => {
      const p = o.position.clone();
      o.position.set(-p.z, p.y, p.x);
      o.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
    });
    return out;
  },
  boat: (m) => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.26, 0.12);
    shape.lineTo(0.26, 0.12);
    shape.quadraticCurveTo(0.2, 0, 0.12, -0.0);
    shape.lineTo(-0.16, 0);
    shape.quadraticCurveTo(-0.24, 0.02, -0.26, 0.12);
    const hull = mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 }), m.main, 0, 0.0, -0.1);
    const mast = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 8), m.dark, 0, 0.32, 0);
    const sailShape = new THREE.Shape();
    sailShape.moveTo(0, 0);
    sailShape.lineTo(0, 0.34);
    sailShape.lineTo(0.2, 0.02);
    const sail = mesh(new THREE.ShapeGeometry(sailShape), new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, roughness: 0.6 }), 0.015, 0.16, 0);
    const flag = mesh(new THREE.BoxGeometry(0.08, 0.04, 0.005), m.gold, 0.05, 0.52, 0);
    const g = new THREE.Group();
    g.add(hull, mast, sail, flag);
    g.rotation.y = -Math.PI / 2;
    return [g];
  },
  rocket: (m) => {
    const body = lathe([V(0, 0.08), V(0.1, 0.08), V(0.12, 0.2), V(0.11, 0.36), V(0.07, 0.48), V(0.0, 0.56)], m.white);
    const nose = lathe([V(0.0, 0.42), V(0.095, 0.42), V(0.07, 0.48), V(0, 0.565)], m.main);
    const out: THREE.Object3D[] = [body, nose];
    for (let i = 0; i < 3; i++) {
      const fs = new THREE.Shape();
      fs.moveTo(0, 0);
      fs.lineTo(0.12, -0.04);
      fs.lineTo(0.12, 0.04);
      fs.lineTo(0, 0.16);
      const fin = mesh(new THREE.ExtrudeGeometry(fs, { depth: 0.02, bevelEnabled: false }), m.main, 0, 0.06, 0);
      const holder = new THREE.Group();
      fin.position.set(0.08, 0.06, -0.01);
      holder.add(fin);
      holder.rotation.y = (i / 3) * Math.PI * 2;
      out.push(holder);
    }
    out.push(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 20), m.glass, 0, 0.3, 0.105).rotateX(Math.PI / 2));
    out.push(mesh(new THREE.TorusGeometry(0.045, 0.012, 8, 20), m.gold, 0, 0.3, 0.108));
    out.push(mesh(new THREE.ConeGeometry(0.06, 0.1, 12), m.glow, 0, 0.04, 0).rotateX(Math.PI));
    return out;
  },
  ufo: (m) => [
    mesh(new THREE.SphereGeometry(0.26, 32, 16).scale(1, 0.28, 1), m.main, 0, 0.2, 0),
    mesh(new THREE.SphereGeometry(0.12, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), m.glass, 0, 0.24, 0),
    mesh(new THREE.TorusGeometry(0.24, 0.018, 8, 40), m.silver, 0, 0.2, 0).rotateX(Math.PI / 2),
    ...Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return mesh(new THREE.SphereGeometry(0.025, 10, 8), m.glow, Math.cos(a) * 0.2, 0.17, Math.sin(a) * 0.2);
    }),
    mesh(new THREE.CylinderGeometry(0.02, 0.08, 0.12, 16), m.glass, 0, 0.08, 0),
  ],
  robot: (m) => [
    mesh(new RoundedBoxGeometry(0.26, 0.24, 0.18, 3, 0.04), m.main, 0, 0.16, 0),
    mesh(new RoundedBoxGeometry(0.22, 0.16, 0.18, 3, 0.04), m.light, 0, 0.37, 0),
    mesh(new THREE.SphereGeometry(0.03, 12, 8), m.glow, -0.05, 0.38, 0.09),
    mesh(new THREE.SphereGeometry(0.03, 12, 8), m.glow, 0.05, 0.38, 0.09),
    mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 6), m.silver, 0, 0.5, 0),
    mesh(new THREE.SphereGeometry(0.025, 10, 8), m.main, 0, 0.56, 0),
    mesh(new THREE.BoxGeometry(0.12, 0.05, 0.01), m.gold, 0, 0.18, 0.095),
    mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.18, 10), m.dark, -0.17, 0.16, 0),
    mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.18, 10), m.dark, 0.17, 0.16, 0),
  ],
  planet: (m) => [
    mesh(new THREE.CylinderGeometry(0.03, 0.1, 0.14, 16), m.gold, 0, 0.07, 0),
    mesh(new THREE.SphereGeometry(0.17, 32, 24), m.main, 0, 0.32, 0),
    mesh(new THREE.TorusGeometry(0.25, 0.025, 8, 48).scale(1, 1, 0.25), m.light, 0, 0.32, 0).rotateX(Math.PI / 2.4),
    mesh(new THREE.SphereGeometry(0.04, 12, 8), m.white, 0.24, 0.45, 0.05),
  ],
  crown: (m) => {
    const out: THREE.Object3D[] = [
      mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.16, 32, 1, true), m.gold, 0, 0.12, 0),
      mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 32), m.main, 0, 0.05, 0),
    ];
    (out[0] as THREE.Mesh).material = m.gold.clone();
    ((out[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      out.push(mesh(new THREE.ConeGeometry(0.045, 0.14, 8), m.gold, Math.cos(a) * 0.19, 0.27, Math.sin(a) * 0.19));
      out.push(mesh(new THREE.SphereGeometry(0.025, 10, 8), m.white, Math.cos(a) * 0.19, 0.35, Math.sin(a) * 0.19));
      out.push(mesh(new THREE.SphereGeometry(0.03, 10, 8), m.main, Math.cos(a + 0.5) * 0.2, 0.12, Math.sin(a + 0.5) * 0.2));
    }
    out.push(mesh(new THREE.SphereGeometry(0.15, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), m.main, 0, 0.15, 0));
    return out;
  },
  diamond: (m) => {
    const gem = new THREE.MeshStandardMaterial({ color: m.main.color, roughness: 0.05, metalness: 0.3, flatShading: true, emissive: m.main.color, emissiveIntensity: 0.15 });
    return [
      mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.06, 6), m.gold, 0, 0.03, 0),
      lathe([V(0, 0.08), V(0.2, 0.32), V(0.13, 0.42), V(0, 0.44)], gem, 8),
    ];
  },
  trophy: (m) => [
    lathe([V(0, 0), V(0.16, 0), V(0.16, 0.05), V(0.06, 0.08), V(0.04, 0.18), V(0.03, 0.22)], m.main),
    lathe([V(0.03, 0.22), V(0.06, 0.24), V(0.15, 0.32), V(0.18, 0.48), V(0.17, 0.5), V(0.14, 0.38), V(0.0, 0.3)], m.gold),
    mesh(new THREE.TorusGeometry(0.07, 0.018, 8, 20, Math.PI), m.gold, 0.18, 0.4, 0).rotateZ(-Math.PI / 2),
    mesh(new THREE.TorusGeometry(0.07, 0.018, 8, 20, Math.PI), m.gold, -0.18, 0.4, 0).rotateZ(Math.PI / 2),
  ],
  moneybag: (m) => [
    mesh(new THREE.SphereGeometry(0.2, 28, 20).scale(1, 0.95, 1), m.main, 0, 0.2, 0),
    mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.08, 20), m.main, 0, 0.4, 0),
    mesh(new THREE.TorusGeometry(0.075, 0.02, 8, 24), m.gold, 0, 0.38, 0).rotateX(Math.PI / 2),
    mesh(new THREE.SphereGeometry(0.07, 16, 10).scale(1.4, 0.6, 1.4), m.main, 0, 0.46, 0),
    mesh(new THREE.TorusGeometry(0.06, 0.018, 8, 20, Math.PI * 1.5), m.gold, 0, 0.22, 0.19),
  ],
  penguin: (m) => [
    mesh(new THREE.SphereGeometry(0.17, 24, 18).scale(1, 1.25, 0.95), m.black, 0, 0.22, 0),
    mesh(new THREE.SphereGeometry(0.13, 24, 18).scale(1, 1.2, 0.6), m.white, 0, 0.2, 0.08),
    mesh(new THREE.SphereGeometry(0.12, 20, 16), m.black, 0, 0.45, 0),
    mesh(new THREE.ConeGeometry(0.035, 0.08, 10), m.orange, 0, 0.44, 0.13).rotateX(Math.PI / 2),
    mesh(new THREE.SphereGeometry(0.022, 8, 8), m.white, -0.045, 0.49, 0.1),
    mesh(new THREE.SphereGeometry(0.022, 8, 8), m.white, 0.045, 0.49, 0.1),
    mesh(new THREE.TorusGeometry(0.11, 0.035, 8, 24), m.main, 0, 0.36, 0).rotateX(Math.PI / 2),
    mesh(new THREE.SphereGeometry(0.05, 10, 8).scale(1.2, 0.4, 1.6), m.orange, -0.06, 0.02, 0.06),
    mesh(new THREE.SphereGeometry(0.05, 10, 8).scale(1.2, 0.4, 1.6), m.orange, 0.06, 0.02, 0.06),
  ],
  duck: (m) => [
    mesh(new THREE.SphereGeometry(0.18, 24, 18).scale(1.1, 0.85, 1.25), m.main, 0, 0.16, -0.02),
    mesh(new THREE.SphereGeometry(0.12, 20, 16), m.main, 0, 0.38, 0.08),
    mesh(new THREE.SphereGeometry(0.06, 12, 8).scale(1.3, 0.5, 1.3), m.orange, 0, 0.36, 0.2),
    mesh(new THREE.SphereGeometry(0.022, 8, 8), m.black, -0.05, 0.42, 0.17),
    mesh(new THREE.SphereGeometry(0.022, 8, 8), m.black, 0.05, 0.42, 0.17),
    mesh(new THREE.ConeGeometry(0.06, 0.12, 10), m.light, 0, 0.22, -0.24).rotateX(-1.1),
  ],
  bear: (m) => [
    mesh(new THREE.SphereGeometry(0.17, 24, 18).scale(1, 1.05, 0.9), m.main, 0, 0.17, 0),
    mesh(new THREE.SphereGeometry(0.1, 16, 12).scale(1, 1, 0.6), m.light, 0, 0.15, 0.11),
    mesh(new THREE.SphereGeometry(0.14, 22, 16), m.main, 0, 0.42, 0),
    mesh(new THREE.SphereGeometry(0.055, 12, 10), m.main, -0.1, 0.53, 0),
    mesh(new THREE.SphereGeometry(0.055, 12, 10), m.main, 0.1, 0.53, 0),
    mesh(new THREE.SphereGeometry(0.06, 14, 10).scale(1, 0.8, 0.8), m.light, 0, 0.39, 0.12),
    mesh(new THREE.SphereGeometry(0.022, 8, 8), m.black, 0, 0.41, 0.17),
    mesh(new THREE.SphereGeometry(0.018, 8, 8), m.black, -0.05, 0.46, 0.12),
    mesh(new THREE.SphereGeometry(0.018, 8, 8), m.black, 0.05, 0.46, 0.12),
  ],
  frog: (m) => [
    mesh(new THREE.SphereGeometry(0.2, 24, 18).scale(1.1, 0.7, 1), m.main, 0, 0.14, 0),
    mesh(new THREE.SphereGeometry(0.07, 14, 12), m.main, -0.09, 0.27, 0.07),
    mesh(new THREE.SphereGeometry(0.07, 14, 12), m.main, 0.09, 0.27, 0.07),
    mesh(new THREE.SphereGeometry(0.045, 12, 10), m.white, -0.09, 0.29, 0.11),
    mesh(new THREE.SphereGeometry(0.045, 12, 10), m.white, 0.09, 0.29, 0.11),
    mesh(new THREE.SphereGeometry(0.022, 8, 8), m.black, -0.09, 0.3, 0.15),
    mesh(new THREE.SphereGeometry(0.022, 8, 8), m.black, 0.09, 0.3, 0.15),
    mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 20, Math.PI), m.dark, 0, 0.16, 0.17).rotateZ(Math.PI),
    mesh(new THREE.SphereGeometry(0.05, 10, 8).scale(1.6, 0.4, 1.2), m.light, -0.14, 0.03, 0.1),
    mesh(new THREE.SphereGeometry(0.05, 10, 8).scale(1.6, 0.4, 1.2), m.light, 0.14, 0.03, 0.1),
  ],
};

/** Готовая фишка на цветной подставке. Высота ~0.6 единицы. */
export function buildToken(tokenId: string, color: string): THREE.Group {
  const m = mats(color);
  const root = new THREE.Group();
  const base = mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.05, 32), m.main, 0, 0.025, 0);
  const rim = mesh(new THREE.TorusGeometry(0.21, 0.015, 8, 40), m.white, 0, 0.05, 0);
  rim.rotation.x = Math.PI / 2;
  root.add(base, rim);
  const body = new THREE.Group();
  body.position.y = 0.05;
  (builders[tokenId] ?? builders.pawn)(m).forEach((o) => body.add(o));
  body.name = 'body';
  root.add(body);
  root.userData.materials = Object.values(m);
  return root;
}

export function disposeObject(o: THREE.Object3D) {
  o.traverse((c) => {
    const mm = c as THREE.Mesh;
    if (mm.geometry) mm.geometry.dispose();
    const mat = mm.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else if (mat) {
      const anyMat = mat as THREE.MeshStandardMaterial;
      anyMat.map?.dispose();
      mat.dispose();
    }
  });
}

// ───────────── Миниатюры фишек для интерфейса ─────────────

let thumbRenderer: THREE.WebGLRenderer | null = null;
const thumbCache = new Map<string, string>();

export function tokenThumbnail(tokenId: string, color: string, size = 160): string {
  const key = `${tokenId}|${color}|${size}`;
  const hit = thumbCache.get(key);
  if (hit) return hit;
  try {
    if (!thumbRenderer) {
      thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      thumbRenderer.outputColorSpace = THREE.SRGBColorSpace;
      thumbRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    }
    thumbRenderer.setSize(size, size, false);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6));
    const d = new THREE.DirectionalLight(0xffffff, 2.4);
    d.position.set(2, 4, 3);
    scene.add(d);
    const tok = buildToken(tokenId, color);
    tok.rotation.y = -0.5;
    scene.add(tok);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    cam.position.set(0, 0.75, 1.75);
    cam.lookAt(0, 0.28, 0);
    thumbRenderer.render(scene, cam);
    const url = thumbRenderer.domElement.toDataURL('image/png');
    disposeObject(tok);
    thumbCache.set(key, url);
    return url;
  } catch {
    return '';
  }
}
