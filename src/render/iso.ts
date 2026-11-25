// Conversion grille (monde) -> écran isométrique.
// Le monde raisonne en cases ; seul l'affichage connaît l'isométrie.

export const TILE_W = 64; // largeur d'un losange de sol
export const TILE_H = 32; // hauteur d'un losange de sol
export const WALL_H = 44; // hauteur visuelle d'un mur

export function toScreen(x: number, y: number): { sx: number; sy: number } {
  return { sx: (x - y) * (TILE_W / 2), sy: (x + y) * (TILE_H / 2) };
}

/** Profondeur d'affichage : plus on est "devant" (bas de l'écran), plus on est dessiné tard. */
export function depthOf(x: number, y: number): number {
  return x + y;
}
