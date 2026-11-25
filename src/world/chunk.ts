import { Rng, hash01 } from './rng';

// Un chunk = carré de CHUNK_SIZE x CHUNK_SIZE cases.
// Les cases aux coordonnées locales impaires sont des "salles" de couloir ;
// les cases paires forment la trame des murs.
// Chaque chunk possède sa ligne de murs Ouest (x local = 0) et Nord (y local = 0).
// Son mur Est est la ligne Ouest du chunk voisin, etc. Les ouvertures sur ces
// bordures sont décidées par un hash partagé : les deux voisins sont toujours d'accord.

export const CHUNK_SIZE = 16;
const ROOMS = CHUNK_SIZE / 2; // 8 x 8 salles par chunk

export enum Tile {
  Floor = 0,
  Wall = 1,
  Grass = 2, // sol de clairière
}

export type ChunkKind = 'corridors' | 'clearing';

export interface ChunkData {
  cx: number;
  cy: number;
  kind: ChunkKind;
  tiles: Uint8Array; // index = y * CHUNK_SIZE + x
}

// "Sels" pour séparer les différentes décisions tirées de la même graine.
const SALT_WEST = 1;
const SALT_NORTH = 2;
const SALT_MAZE = 3;
const SALT_KIND = 4;
const SALT_LOOPS = 5;

/** Salles ouvertes sur la bordure Ouest du chunk (cx, cy). Partagé avec le voisin Ouest. */
function westOpenings(seed: number, cx: number, cy: number): number[] {
  return borderOpenings(seed, cx, cy, SALT_WEST);
}
function northOpenings(seed: number, cx: number, cy: number): number[] {
  return borderOpenings(seed, cx, cy, SALT_NORTH);
}
function borderOpenings(seed: number, cx: number, cy: number, salt: number): number[] {
  // 1 à 3 ouvertures par bordure, positions déterministes.
  const count = 1 + Math.floor(hash01(seed, cx, cy, salt, 0) * 3);
  const result = new Set<number>();
  for (let i = 0; i < count; i++) {
    result.add(Math.floor(hash01(seed, cx, cy, salt, i + 1) * ROOMS));
  }
  return [...result];
}

export function chunkKind(seed: number, cx: number, cy: number): ChunkKind {
  if (cx === 0 && cy === 0) return 'clearing'; // le point d'entrée est toujours une clairière
  return hash01(seed, cx, cy, SALT_KIND) < 0.12 ? 'clearing' : 'corridors';
}

export function generateChunk(seed: number, cx: number, cy: number): ChunkData {
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(Tile.Wall);
  const set = (x: number, y: number, t: Tile) => {
    tiles[y * CHUNK_SIZE + x] = t;
  };
  const roomX = (rx: number) => rx * 2 + 1;

  // 1. Labyrinthe parfait (backtracker récursif) sur les 8x8 salles.
  const rng = new Rng(Math.floor(hash01(seed, cx, cy, SALT_MAZE) * 4294967296));
  const visited = new Uint8Array(ROOMS * ROOMS);
  const stack: [number, number][] = [[rng.int(ROOMS), rng.int(ROOMS)]];
  visited[stack[0][1] * ROOMS + stack[0][0]] = 1;
  set(roomX(stack[0][0]), roomX(stack[0][1]), Tile.Floor);
  const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (stack.length > 0) {
    const [rx, ry] = stack[stack.length - 1];
    const options = rng
      .shuffle([...dirs])
      .filter(([dx, dy]) => {
        const nx = rx + dx, ny = ry + dy;
        return nx >= 0 && ny >= 0 && nx < ROOMS && ny < ROOMS && !visited[ny * ROOMS + nx];
      });
    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const [dx, dy] = options[0];
    const nx = rx + dx, ny = ry + dy;
    visited[ny * ROOMS + nx] = 1;
    set(roomX(rx) + dx, roomX(ry) + dy, Tile.Floor); // casse le mur entre les deux salles
    set(roomX(nx), roomX(ny), Tile.Floor);
    stack.push([nx, ny]);
  }

  // 2. Quelques boucles, pour que ce ne soit pas un arbre (sinon trop de culs-de-sac).
  for (let i = 0; i < 6; i++) {
    const x = 1 + rng.int(CHUNK_SIZE - 2);
    const y = 1 + rng.int(CHUNK_SIZE - 2);
    // Seulement les murs "entre deux salles" (une coordonnée paire, l'autre impaire).
    if ((x + y) % 2 === 1 && hash01(seed, cx, cy, SALT_LOOPS, i) < 0.8) set(x, y, Tile.Floor);
  }

  // 3. Ouvertures sur les bordures Ouest et Nord (les bordures Est/Sud appartiennent aux voisins).
  for (const r of westOpenings(seed, cx, cy)) set(0, roomX(r), Tile.Floor);
  for (const r of northOpenings(seed, cx, cy)) set(roomX(r), 0, Tile.Floor);

  // 4. Clairière : un grand espace ouvert au centre du chunk.
  const kind = chunkKind(seed, cx, cy);
  if (kind === 'clearing') {
    for (let y = 2; y < CHUNK_SIZE - 1; y++) {
      for (let x = 2; x < CHUNK_SIZE - 1; x++) {
        // Quelques rochers, uniquement aux "piliers" (x et y pairs) : ils ne coupent
        // jamais un passage, donc la clairière reste connectée au reste du labyrinthe.
        const edge = x === 2 || y === 2 || x === CHUNK_SIZE - 2 || y === CHUNK_SIZE - 2;
        const pillar = x % 2 === 0 && y % 2 === 0;
        const rock = pillar && hash01(seed, cx, cy, x, y, 99) < (edge ? 0.5 : 0.08);
        set(x, y, rock ? Tile.Wall : Tile.Grass);
      }
    }
  }

  return { cx, cy, kind, tiles };
}
