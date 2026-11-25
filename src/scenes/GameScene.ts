import Phaser from 'phaser';
import { World } from '../world/world';
import { CHUNK_SIZE, Tile } from '../world/chunk';
import { hash } from '../world/rng';
import { toScreen, depthOf, TILE_W, TILE_H, WALL_H } from '../render/iso';
import { createTextures, FLOOR_VARIANTS, WALL_VARIANTS } from '../render/textures';
import { Player } from '../player/Player';

const VIEW_RADIUS = 2; // chunks affichés autour du joueur (5 x 5)

interface ChunkView {
  floor: Phaser.GameObjects.Blitter;
  walls: Map<string, Phaser.GameObjects.Image>;
}

export class GameScene extends Phaser.Scene {
  private world!: World;
  private player!: Player;
  private sprite!: Phaser.GameObjects.Image;
  private views = new Map<string, ChunkView>();
  private fadedWalls: Phaser.GameObjects.Image[] = [];
  private currentChunk = { cx: NaN, cy: NaN };
  private hud!: Phaser.GameObjects.Text;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  constructor() {
    super('game');
  }

  init(data: { seed?: number }): void {
    this.world = new World(data.seed ?? initialSeed());
    this.views = new Map();
    this.fadedWalls = [];
    this.currentChunk = { cx: NaN, cy: NaN };
  }

  create(): void {
    if (!this.textures.exists('player')) createTextures(this);
    this.cameras.main.setBackgroundColor('#0b0d12');

    // Départ : centre de la clairière d'entrée (chunk 0,0).
    this.player = new Player(7.5, 7.5);
    this.sprite = this.add.image(0, 0, 'player').setOrigin(0.5, 0.92);
    this.cameras.main.startFollow(this.sprite, true, 0.15, 0.15);
    this.cameras.main.roundPixels = true;

    const kb = this.input.keyboard!;
    // ZQSD (AZERTY) + WASD (QWERTY) + flèches.
    this.keys = kb.addKeys('Z,Q,S,D,W,A,UP,DOWN,LEFT,RIGHT,R') as Record<string, Phaser.Input.Keyboard.Key>;
    this.keys.R.on('down', () => this.scene.restart({ seed: randomSeed() }));

    this.hud = this.add
      .text(12, 10, '', { fontFamily: 'monospace', fontSize: '14px', color: '#c9d1d9' })
      .setScrollFactor(0)
      .setDepth(1e9);

    this.syncPlayer();
    this.refreshChunks();
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.05);
    const k = this.keys;
    // Direction voulue à l'écran...
    let ex = 0, ey = 0;
    if (k.Z.isDown || k.W.isDown || k.UP.isDown) ey -= 1;
    if (k.S.isDown || k.DOWN.isDown) ey += 1;
    if (k.Q.isDown || k.A.isDown || k.LEFT.isDown) ex -= 1;
    if (k.D.isDown || k.RIGHT.isDown) ex += 1;
    if (ex !== 0 || ey !== 0) {
      // ... convertie en direction dans la grille (écran droite = (+1,-1), écran haut = (-1,-1)).
      let gx = ex + ey, gy = ey - ex;
      const len = Math.hypot(gx, gy);
      gx /= len;
      gy /= len;
      this.player.move(this.world, gx, gy, dt);
      if (ex !== 0) this.sprite.setFlipX(ex < 0);
    }
    this.syncPlayer();
    this.refreshChunks();
    this.fadeOccludingWalls();
    this.updateHud();
  }

  private syncPlayer(): void {
    const { sx, sy } = toScreen(this.player.x, this.player.y);
    this.sprite.setPosition(sx, sy).setDepth(depthOf(this.player.x, this.player.y));
  }

  /** Charge les chunks proches, détruit les lointains. */
  private refreshChunks(): void {
    const cx = Math.floor(this.player.x / CHUNK_SIZE);
    const cy = Math.floor(this.player.y / CHUNK_SIZE);
    if (cx === this.currentChunk.cx && cy === this.currentChunk.cy) return;
    this.currentChunk = { cx, cy };

    for (const [key, view] of this.views) {
      const [vx, vy] = key.split(',').map(Number);
      if (Math.abs(vx - cx) > VIEW_RADIUS || Math.abs(vy - cy) > VIEW_RADIUS) {
        view.floor.destroy();
        view.walls.forEach((w) => w.destroy());
        this.views.delete(key);
      }
    }
    for (let y = cy - VIEW_RADIUS; y <= cy + VIEW_RADIUS; y++) {
      for (let x = cx - VIEW_RADIUS; x <= cx + VIEW_RADIUS; x++) {
        const key = World.key(x, y);
        if (!this.views.has(key)) this.views.set(key, this.buildChunkView(x, y));
      }
    }
    this.world.forgetFarChunks(cx, cy, VIEW_RADIUS + 1);
  }

  private buildChunkView(cx: number, cy: number): ChunkView {
    const chunk = this.world.getChunk(cx, cy);
    const seed = this.world.seed;
    const floor = this.add.blitter(0, 0, 'floor0').setDepth(-1e9);
    const walls = new Map<string, Phaser.GameObjects.Image>();
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const tx = cx * CHUNK_SIZE + lx;
        const ty = cy * CHUNK_SIZE + ly;
        const t = chunk.tiles[ly * CHUNK_SIZE + lx] as Tile;
        const variant = hash(seed, tx, ty, 7);
        const { sx, sy } = toScreen(tx + 0.5, ty + 0.5);
        if (t === Tile.Wall) {
          const img = this.add
            .image(sx, sy, `wall${variant % WALL_VARIANTS}`)
            .setOrigin(0.5, 1 - TILE_H / 2 / (TILE_H + WALL_H))
            .setDepth(depthOf(tx + 0.5, ty + 0.5) + 0.5);
          walls.set(`${tx},${ty}`, img);
        } else {
          const tex = t === Tile.Grass ? 'grass' : 'floor';
          floor.create(sx - TILE_W / 2, sy - TILE_H / 2, this.textures.getFrame(`${tex}${variant % FLOOR_VARIANTS}`));
        }
      }
    }
    return { floor, walls };
  }

  /** Rend transparents les murs juste devant le joueur, pour ne jamais le perdre de vue. */
  private fadeOccludingWalls(): void {
    for (const w of this.fadedWalls) w.setAlpha(1);
    this.fadedWalls = [];
    const px = Math.floor(this.player.x), py = Math.floor(this.player.y);
    for (let dy = 0; dy <= 2; dy++) {
      for (let dx = 0; dx <= 2; dx++) {
        if (dx === 0 && dy === 0) continue;
        const tx = px + dx, ty = py + dy;
        const view = this.views.get(World.key(Math.floor(tx / CHUNK_SIZE), Math.floor(ty / CHUNK_SIZE)));
        const w = view?.walls.get(`${tx},${ty}`);
        if (w) {
          w.setAlpha(0.35);
          this.fadedWalls.push(w);
        }
      }
    }
  }

  private updateHud(): void {
    const c = this.world.getChunk(this.currentChunk.cx, this.currentChunk.cy);
    this.hud.setText(
      [
        `THE ENDLESS  ·  prototype étape 1`,
        `graine ${this.world.seed}   chunk ${c.cx},${c.cy} (${c.kind === 'clearing' ? 'clairière' : 'couloirs'})`,
        `ZQSD / WASD / flèches : bouger   R : nouveau labyrinthe`,
      ].join('\n'),
    );
  }
}

function randomSeed(): number {
  return Math.floor(Math.random() * 1e9);
}

/** ?seed=123 dans l'URL permet de rejouer exactement le même labyrinthe. */
function initialSeed(): number {
  const s = Number(new URLSearchParams(location.search).get('seed'));
  return Number.isFinite(s) && s > 0 ? Math.floor(s) : randomSeed();
}
