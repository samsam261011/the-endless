import Phaser from 'phaser';
import { TILE_W, TILE_H, WALL_H } from './iso';
import { hash01 } from '../world/rng';

// Textures provisoires dessinées par le code (pas encore de pixel art).
// Un léger bruit "pixel" évite l'aspect plat.

const W = TILE_W, H = TILE_H, HW = W / 2, HH = H / 2;

function diamond(g: Phaser.GameObjects.Graphics, ox: number, oy: number, color: number) {
  g.fillStyle(color, 1);
  g.fillPoints(
    [
      new Phaser.Math.Vector2(ox + HW, oy),
      new Phaser.Math.Vector2(ox + W, oy + HH),
      new Phaser.Math.Vector2(ox + HW, oy + H),
      new Phaser.Math.Vector2(ox, oy + HH),
    ],
    true,
  );
}

function speckle(g: Phaser.GameObjects.Graphics, ox: number, oy: number, colors: number[], n: number, salt: number) {
  for (let i = 0; i < n; i++) {
    // Points aléatoires dans le losange.
    const u = hash01(salt, i, 1), v = hash01(salt, i, 2);
    const px = ox + HW + (u - v) * HW;
    const py = oy + HH + (u + v - 1) * HH;
    g.fillStyle(colors[i % colors.length], 1);
    g.fillRect(Math.round(px), Math.round(py), 2, 2);
  }
}

export const FLOOR_VARIANTS = 3;
export const WALL_VARIANTS = 3;

export function createTextures(scene: Phaser.Scene): void {
  const g = scene.add.graphics();

  for (let v = 0; v < FLOOR_VARIANTS; v++) {
    g.clear();
    diamond(g, 0, 0, 0x2a2d33);
    speckle(g, 0, 0, [0x33373e, 0x24272c, 0x2f3a33], 40, 10 + v);
    g.generateTexture(`floor${v}`, W, H);

    g.clear();
    diamond(g, 0, 0, 0x2c4a32);
    speckle(g, 0, 0, [0x37603d, 0x24402a, 0x4a6e3c], 60, 20 + v);
    g.generateTexture(`grass${v}`, W, H);
  }

  for (let v = 0; v < WALL_VARIANTS; v++) {
    g.clear();
    // Face gauche
    g.fillStyle(0x3d4048, 1);
    g.fillPoints(
      [
        new Phaser.Math.Vector2(0, HH),
        new Phaser.Math.Vector2(HW, H),
        new Phaser.Math.Vector2(HW, H + WALL_H),
        new Phaser.Math.Vector2(0, HH + WALL_H),
      ],
      true,
    );
    // Face droite (plus sombre)
    g.fillStyle(0x2b2d33, 1);
    g.fillPoints(
      [
        new Phaser.Math.Vector2(HW, H),
        new Phaser.Math.Vector2(W, HH),
        new Phaser.Math.Vector2(W, HH + WALL_H),
        new Phaser.Math.Vector2(HW, H + WALL_H),
      ],
      true,
    );
    // Joints de pierre
    g.fillStyle(0x24262b, 1);
    for (let row = 1; row < 4; row++) {
      const y = HH + (WALL_H / 4) * row;
      for (let x = 0; x < W; x += 2) {
        const yy = x < HW ? y + x / 2 : y + (W - x) / 2;
        g.fillRect(x, Math.round(yy), 2, 1);
      }
    }
    // Dessus
    diamond(g, 0, 0, 0x5a5e68);
    speckle(g, 0, 0, [0x666b76, 0x4d515a, 0x4f6152], 30, 30 + v);
    g.generateTexture(`wall${v}`, W, H + WALL_H);
  }

  // Personnage provisoire : ombre + corps encapuchonné.
  g.clear();
  g.fillStyle(0x000000, 0.35);
  g.fillEllipse(12, 38, 22, 8);
  g.fillStyle(0x6b4f2a, 1);
  g.fillRect(6, 14, 12, 22);
  g.fillStyle(0x8a6a3a, 1);
  g.fillRect(6, 14, 5, 22);
  g.fillStyle(0xd9b58c, 1);
  g.fillCircle(12, 10, 6);
  g.fillStyle(0x4a3620, 1);
  g.fillRect(6, 3, 12, 5);
  g.generateTexture('player', 24, 42);

  g.destroy();
}
