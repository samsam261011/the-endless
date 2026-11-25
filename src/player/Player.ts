import { World } from '../world/world';

// Déplacement libre (pas case par case) avec collisions contre les murs.
// Position exprimée en cases du monde (nombres à virgule).

const RADIUS = 0.22; // demi-largeur du joueur, en cases
export const SPEED = 3.6; // cases par seconde

export class Player {
  constructor(public x: number, public y: number) {}

  /** dx, dy : direction dans la grille du monde (déjà normalisée). */
  move(world: World, dx: number, dy: number, dt: number): void {
    const step = SPEED * dt;
    // Axes séparés : on glisse le long des murs au lieu de s'y coller.
    const nx = this.x + dx * step;
    if (!this.collides(world, nx, this.y)) this.x = nx;
    const ny = this.y + dy * step;
    if (!this.collides(world, this.x, ny)) this.y = ny;
  }

  private collides(world: World, x: number, y: number): boolean {
    const x0 = Math.floor(x - RADIUS), x1 = Math.floor(x + RADIUS);
    const y0 = Math.floor(y - RADIUS), y1 = Math.floor(y + RADIUS);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (world.isSolid(tx, ty)) return true;
      }
    }
    return false;
  }
}
