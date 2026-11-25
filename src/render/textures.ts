import * as THREE from 'three';
import { hash01 } from '../world/rng';

// Textures "pixel" 16x16 dessinées par le code, filtrées sans lissage (look blocs).
// Provisoires : elles seront remplacées par de vraies textures plus tard.

type Painter = (x: number, y: number, n: number) => string;

function pixelTexture(salt: number, paint: Painter): THREE.CanvasTexture {
  const size = 16;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      ctx.fillStyle = paint(x, y, hash01(salt, x, y));
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapNearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const shade = (base: [number, number, number], k: number) =>
  `rgb(${base.map((c) => Math.max(0, Math.min(255, Math.round(c * k)))).join(',')})`;

export function makeTextures() {
  // Pierre ancienne : blocs avec joints, quelques taches de mousse.
  const wall = pixelTexture(1, (x, y, n) => {
    const row = Math.floor(y / 4);
    const joint = y % 4 === 3 || (x + (row % 2) * 4) % 8 === 7;
    if (joint) return shade([60, 62, 70], 0.8 + n * 0.1);
    if (hash01(2, x >> 1, y >> 1) < 0.08) return shade([70, 96, 66], 0.9 + n * 0.2);
    return shade([112, 116, 128], 0.82 + n * 0.22);
  });
  const floor = pixelTexture(3, (_x, _y, n) => shade([74, 76, 82], 0.8 + n * 0.25));
  const grass = pixelTexture(4, (x, y, n) =>
    hash01(5, x, y) < 0.12 ? shade([96, 140, 80], 1) : shade([58, 96, 56], 0.8 + n * 0.3),
  );
  return { wall, floor, grass };
}
