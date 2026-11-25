import * as THREE from 'three';
import { hash01 } from '../world/rng';

// Textures procédurales (dessinées par le code) : couleur + relief ("normal map").
// Le relief fait accrocher la lumière rasante de la torche aux joints des pierres.
// Elles restent provisoires : une vraie passe visuelle viendra plus tard.

const SIZE = 128;

/** Bruit de valeur lissé, 0..1, répétable (tuile sans couture). */
function noise(salt: number, x: number, y: number, cell: number): number {
  const n = SIZE / cell;
  const gx = x / cell, gy = y / cell;
  const x0 = Math.floor(gx), y0 = Math.floor(gy);
  const fx = gx - x0, fy = gy - y0;
  const v = (i: number, j: number) => hash01(salt, ((i % n) + n) % n, ((j % n) + n) % n);
  const s = (t: number) => t * t * (3 - 2 * t);
  const a = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * s(fx);
  const b = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * s(fx);
  return a + (b - a) * s(fy);
}
const fbm = (salt: number, x: number, y: number) =>
  noise(salt, x, y, 32) * 0.5 + noise(salt + 1, x, y, 16) * 0.3 + noise(salt + 2, x, y, 4) * 0.2;

interface Pixel {
  r: number;
  g: number;
  b: number;
  h: number; // hauteur 0..1 pour le relief
}

function build(paint: (x: number, y: number) => Pixel, normalStrength: number) {
  const color = document.createElement('canvas');
  color.width = color.height = SIZE;
  const cctx = color.getContext('2d')!;
  const img = cctx.createImageData(SIZE, SIZE);
  const height = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const p = paint(x, y);
      const i = (y * SIZE + x) * 4;
      img.data[i] = p.r;
      img.data[i + 1] = p.g;
      img.data[i + 2] = p.b;
      img.data[i + 3] = 255;
      height[y * SIZE + x] = p.h;
    }
  }
  cctx.putImageData(img, 0, 0);

  // Normal map à partir des différences de hauteur.
  const normal = document.createElement('canvas');
  normal.width = normal.height = SIZE;
  const nctx = normal.getContext('2d')!;
  const nimg = nctx.createImageData(SIZE, SIZE);
  const h = (x: number, y: number) => height[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * normalStrength;
      const dy = (h(x, y + 1) - h(x, y - 1)) * normalStrength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * SIZE + x) * 4;
      nimg.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      nimg.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      nimg.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      nimg.data[i + 3] = 255;
    }
  }
  nctx.putImageData(nimg, 0, 0);

  const map = new THREE.CanvasTexture(color);
  map.colorSpace = THREE.SRGBColorSpace;
  const normalMap = new THREE.CanvasTexture(normal);
  for (const t of [map, normalMap]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
  }
  return { map, normalMap };
}

const clamp255 = (v: number) => Math.max(0, Math.min(255, v));

/** Pierres taillées irrégulières, joints profonds, mousse dans le bas et dans les joints. */
function stoneWall(x: number, y: number): Pixel {
  const rowH = 32;
  const row = Math.floor(y / rowH);
  const offset = (row % 2) * 24 + Math.floor(hash01(9, row) * 10);
  const brickW = 48 + Math.floor(hash01(10, row) * 3) * 8;
  const bx = Math.floor((x + offset) / brickW);
  const lx = (x + offset) % brickW, ly = y % rowH;
  const edge = Math.min(lx, brickW - 1 - lx, ly, rowH - 1 - ly);
  const n = fbm(11, x, y);
  const mortar = edge < 2 + n * 2;
  const tint = 0.85 + hash01(12, bx, row) * 0.3;
  const moss = Math.max(0, fbm(13, x, y) - 0.55) * 3;
  let r = 118 * tint, g = 120 * tint, b = 126 * tint;
  r = r * (0.8 + n * 0.4);
  g = g * (0.8 + n * 0.4);
  b = b * (0.8 + n * 0.4);
  if (mortar) [r, g, b] = [52, 54, 56];
  r = r * (1 - moss) + 64 * moss;
  g = g * (1 - moss) + 92 * moss;
  b = b * (1 - moss) + 52 * moss;
  const h = mortar ? 0.1 : 0.6 + Math.min(edge, 6) / 15 + n * 0.25;
  return { r: clamp255(r), g: clamp255(g), b: clamp255(b), h };
}

/** Dalles usées et fissurées. */
function flagstones(x: number, y: number): Pixel {
  const s = 64;
  const lx = x % s, ly = y % s;
  const edge = Math.min(lx, s - 1 - lx, ly, s - 1 - ly);
  const n = fbm(21, x, y);
  const tint = 0.85 + hash01(22, Math.floor(x / s), Math.floor(y / s)) * 0.25;
  const joint = edge < 2;
  const v = joint ? 40 : 88 * tint * (0.75 + n * 0.5);
  const dirt = fbm(24, x, y) * 18;
  return { r: clamp255(v + dirt * 0.6), g: clamp255(v + dirt * 0.4), b: clamp255(v), h: joint ? 0.1 : 0.5 + n * 0.3 };
}

/** Herbe dense et irrégulière. */
function grass(x: number, y: number): Pixel {
  const n = fbm(31, x, y);
  const blade = hash01(32, x, y);
  const dry = Math.max(0, noise(33, x, y, 32) - 0.6) * 2;
  const k = 0.65 + n * 0.5 + (blade > 0.85 ? 0.25 : 0);
  return {
    r: clamp255((52 + dry * 60) * k),
    g: clamp255((92 + dry * 20) * k),
    b: clamp255(44 * k),
    h: n * 0.6 + (blade > 0.85 ? 0.4 : 0),
  };
}

/** Bois massif cerclé de fer, pour les portes du refuge. */
function gateWood(x: number, y: number): Pixel {
  const plank = Math.floor(x / 21);
  const grain = noise(41 + plank, x * 4, y, 16);
  const seam = x % 21 < 2;
  const iron = y % 64 < 6;
  const rivet = iron && x % 21 > 8 && x % 21 < 12 && y % 64 > 1 && y % 64 < 5;
  if (iron) return { r: rivet ? 120 : 60, g: rivet ? 116 : 58, b: rivet ? 110 : 60, h: rivet ? 1 : 0.8 };
  const v = 0.7 + grain * 0.4;
  return { r: clamp255(92 * v), g: clamp255(62 * v), b: clamp255(38 * v), h: seam ? 0.1 : 0.5 + grain * 0.2 };
}

export function makeTextures() {
  return {
    wall: build(stoneWall, 6),
    floor: build(flagstones, 5),
    grass: build(grass, 3),
    gate: build(gateWood, 5),
  };
}
export type Textures = ReturnType<typeof makeTextures>;
