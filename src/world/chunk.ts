import { Rng, hash01 } from './rng';

// Un chunk = carré de CHUNK_SIZE x CHUNK_SIZE cases.
// Les cases aux coordonnées locales impaires (x ET y impairs) sont des "salles" de couloir :
// elles sont TOUJOURS du sol, quelle que soit la nuit. Les autres cases forment la trame des murs.
// Chaque chunk possède sa ligne de murs Ouest (x local = 0) et Nord (y local = 0).
//
// "version" : le labyrinthe se réorganise certaines nuits. Une même graine + un même chunk
// + une même version donnent toujours exactement le même plan.

export const CHUNK_SIZE = 16;
const ROOMS = CHUNK_SIZE / 2; // 8 x 8 salles par chunk

export enum Tile {
  Floor = 0,
  Wall = 1,
  Grass = 2, // sol de clairière
  Gate = 3, // porte géante du refuge (solide quand elle est fermée)
}

export type ChunkKind = 'corridors' | 'clearing' | 'refuge';

export interface ChunkData {
  cx: number;
  cy: number;
  version: number;
  kind: ChunkKind;
  tiles: Uint8Array; // index = y * CHUNK_SIZE + x
}

/** Les 4 portes du refuge (chunk 0,0), en coordonnées locales = monde. */
export const REFUGE_GATES: [number, number][] = [
  [0, 7],
  [7, 0],
  [CHUNK_SIZE - 1, 7],
  [7, CHUNK_SIZE - 1],
];
const GATE_ROOM = 3; // salle n°3 => coordonnée 7

// "Sels" pour séparer les différentes décisions tirées de la même graine.
const SALT_WEST = 1;
const SALT_NORTH = 2;
const SALT_MAZE = 3;
const SALT_KIND = 4;
const SALT_LOOPS = 5;

export const isRefuge = (cx: number, cy: number) => cx === 0 && cy === 0;

function borderOpenings(seed: number, cx: number, cy: number, version: number, salt: number): number[] {
  // 1 à 3 ouvertures par bordure, positions déterministes.
  const count = 1 + Math.floor(hash01(seed, cx, cy, version, salt, 0) * 3);
  const result = new Set<number>();
  for (let i = 0; i < count; i++) {
    result.add(Math.floor(hash01(seed, cx, cy, version, salt, i + 1) * ROOMS));
  }
  // Les chunks à l'Est et au Sud du refuge s'ouvrent toujours face à ses portes.
  if (salt === SALT_WEST && cx === 1 && cy === 0) result.add(GATE_ROOM);
  if (salt === SALT_NORTH && cx === 0 && cy === 1) result.add(GATE_ROOM);
  return [...result];
}

export function chunkKind(seed: number, cx: number, cy: number): ChunkKind {
  if (isRefuge(cx, cy)) return 'refuge';
  return hash01(seed, cx, cy, SALT_KIND) < 0.1 ? 'clearing' : 'corridors';
}

export function generateChunk(seed: number, cx: number, cy: number, version: number): ChunkData {
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(Tile.Wall);
  const set = (x: number, y: number, t: Tile) => {
    tiles[y * CHUNK_SIZE + x] = t;
  };
  const kind = chunkKind(seed, cx, cy);

  if (kind === 'refuge') {
    // Une grande clairière fermée par une enceinte, avec une porte sur chaque côté.
    for (let y = 1; y < CHUNK_SIZE - 1; y++) for (let x = 1; x < CHUNK_SIZE - 1; x++) set(x, y, Tile.Grass);
    for (const [x, y] of REFUGE_GATES) set(x, y, Tile.Gate);
    return { cx, cy, version: 0, kind, tiles };
  }

  const roomX = (rx: number) => rx * 2 + 1;

  // 1. Labyrinthe parfait (backtracker récursif) sur les 8x8 salles.
  const rng = new Rng(Math.floor(hash01(seed, cx, cy, version, SALT_MAZE) * 4294967296));
  const visited = new Uint8Array(ROOMS * ROOMS);
  const stack: [number, number][] = [[rng.int(ROOMS), rng.int(ROOMS)]];
  visited[stack[0][1] * ROOMS + stack[0][0]] = 1;
  set(roomX(stack[0][0]), roomX(stack[0][1]), Tile.Floor);
  const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (stack.length > 0) {
    const [rx, ry] = stack[stack.length - 1];
    const options = rng.shuffle([...dirs]).filter(([dx, dy]) => {
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
    if ((x + y) % 2 === 1 && hash01(seed, cx, cy, version, SALT_LOOPS, i) < 0.8) set(x, y, Tile.Floor);
  }

  // 3. Ouvertures sur les bordures Ouest et Nord (les bordures Est/Sud appartiennent aux voisins).
  for (const r of borderOpenings(seed, cx, cy, version, SALT_WEST)) set(0, roomX(r), Tile.Floor);
  for (const r of borderOpenings(seed, cx, cy, version, SALT_NORTH)) set(roomX(r), 0, Tile.Floor);

  // 4. Clairière : un grand espace ouvert au centre du chunk (ne bouge pas : c'est un repère).
  if (kind === 'clearing') {
    for (let y = 2; y < CHUNK_SIZE - 1; y++) {
      for (let x = 2; x < CHUNK_SIZE - 1; x++) {
        // Rochers uniquement aux "piliers" (x et y pairs) : ils ne coupent jamais un passage.
        const edge = x === 2 || y === 2 || x === CHUNK_SIZE - 2 || y === CHUNK_SIZE - 2;
        const pillar = x % 2 === 0 && y % 2 === 0;
        const rock = pillar && hash01(seed, cx, cy, x, y, 99) < (edge ? 0.5 : 0.08);
        set(x, y, rock ? Tile.Wall : Tile.Grass);
      }
    }
  }

  return { cx, cy, version, kind, tiles };
}
