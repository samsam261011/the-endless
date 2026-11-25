import { CHUNK_SIZE, ChunkData, Tile, generateChunk, isRefuge } from './chunk';
import { hash } from './rng';

// Le monde : une graine + le temps. Aucune dépendance au rendu.
//
// LOI DU LABYRINTHE (à découvrir par les joueurs, jamais expliquée en jeu) :
// le monde autour du refuge est divisé en 8 secteurs (comme les parts d'un gâteau).
// Chaque secteur se réorganise selon son propre rythme : toutes les 1, 2 ou 3 nuits,
// avec un décalage. Le rythme de chaque secteur dépend de la graine du monde.

export const SECTORS = 8;

export class World {
  private chunks = new Map<string, ChunkData>();
  /** Nombre de réorganisations survenues depuis le début (vient du cycle). */
  shifts = 0;
  /** 0 = portes du refuge fermées, 1 = ouvertes. */
  gateOpenness = 1;

  constructor(public readonly seed: number) {}

  static key(cx: number, cy: number): string {
    return `${cx},${cy}`;
  }

  /** Secteur 0..7 d'un chunk, selon son angle autour du refuge. */
  static sectorOf(cx: number, cy: number): number {
    const a = Math.atan2(cy, cx); // -PI..PI
    return ((Math.floor(((a + Math.PI) / (2 * Math.PI)) * SECTORS) % SECTORS) + SECTORS) % SECTORS;
  }

  sectorRhythm(sector: number): { period: number; offset: number } {
    const h = hash(this.seed, sector, 777);
    const period = 1 + (h % 3);
    return { period, offset: (h >>> 8) % period };
  }

  /** Version du plan d'un chunk après `shifts` réorganisations. */
  chunkVersion(cx: number, cy: number, shifts = this.shifts): number {
    if (isRefuge(cx, cy)) return 0;
    const { period, offset } = this.sectorRhythm(World.sectorOf(cx, cy));
    return Math.floor((shifts + offset) / period);
  }

  getChunk(cx: number, cy: number): ChunkData {
    const k = World.key(cx, cy);
    const version = this.chunkVersion(cx, cy);
    let c = this.chunks.get(k);
    if (!c || c.version !== version) {
      c = generateChunk(this.seed, cx, cy, version);
      this.chunks.set(k, c);
    }
    return c;
  }

  /** Oublie les chunks loin du joueur (ils seront régénérés à l'identique si besoin). */
  forgetFarChunks(cx: number, cy: number, keepRadius: number): void {
    for (const [k, c] of this.chunks) {
      if (Math.abs(c.cx - cx) > keepRadius || Math.abs(c.cy - cy) > keepRadius) this.chunks.delete(k);
    }
  }

  tileAt(x: number, y: number): Tile {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cy = Math.floor(y / CHUNK_SIZE);
    const c = this.getChunk(cx, cy);
    return c.tiles[(y - cy * CHUNK_SIZE) * CHUNK_SIZE + (x - cx * CHUNK_SIZE)] as Tile;
  }

  isSolid(x: number, y: number): boolean {
    const t = this.tileAt(x, y);
    if (t === Tile.Gate) return this.gateOpenness < 0.7;
    return t === Tile.Wall;
  }

  /** Case libre la plus proche (utile si un mur ou une porte se referme sur le joueur). */
  nearestFree(x: number, y: number, preferRefuge: boolean): [number, number] {
    for (let r = 1; r < 6; r++) {
      const candidates: [number, number][] = [];
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const tx = Math.floor(x) + dx, ty = Math.floor(y) + dy;
          if (!this.isSolid(tx, ty)) candidates.push([tx + 0.5, ty + 0.5]);
        }
      if (candidates.length) {
        const score = ([cx, cy]: [number, number]) =>
          (preferRefuge && isRefuge(Math.floor(cx / CHUNK_SIZE), Math.floor(cy / CHUNK_SIZE)) ? -100 : 0) +
          Math.hypot(cx - x, cy - y);
        candidates.sort((a, b) => score(a) - score(b));
        return candidates[0];
      }
    }
    return [x, y];
  }
}
