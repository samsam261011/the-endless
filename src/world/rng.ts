// Aléatoire déterministe : mêmes entrées => même résultat, sur toutes les machines.
// C'est la base des "lois" du labyrinthe : rien n'est tiré au hasard à l'exécution.

/** Mélange des entiers en un hash 32 bits (variante de murmur3 fmix). */
export function hash(...values: number[]): number {
  let h = 0x9e3779b9;
  for (const v of values) {
    h ^= Math.imul(v | 0, 0x85ebca6b);
    h = Math.imul((h << 13) | (h >>> 19), 0xc2b2ae35);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Nombre dans [0, 1) dérivé des entrées. */
export function hash01(...values: number[]): number {
  return hash(...values) / 4294967296;
}

/** Générateur pseudo-aléatoire à graine (mulberry32). */
export class Rng {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0;
  }
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
