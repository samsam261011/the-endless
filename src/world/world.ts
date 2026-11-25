import { CHUNK_SIZE, ChunkData, Tile, generateChunk } from './chunk';

/** Le monde : une graine + un cache de chunks générés à la demande. Aucune dépendance au rendu. */
export class World {
  private chunks = new Map<string, ChunkData>();

  constructor(public readonly seed: number) {}

  static key(cx: number, cy: number): string {
    return `${cx},${cy}`;
  }

  getChunk(cx: number, cy: number): ChunkData {
    const k = World.key(cx, cy);
    let c = this.chunks.get(k);
    if (!c) {
      c = generateChunk(this.seed, cx, cy);
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
    const lx = x - cx * CHUNK_SIZE;
    const ly = y - cy * CHUNK_SIZE;
    return c.tiles[ly * CHUNK_SIZE + lx] as Tile;
  }

  isSolid(x: number, y: number): boolean {
    return this.tileAt(x, y) === Tile.Wall;
  }
}
