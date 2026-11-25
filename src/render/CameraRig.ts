import * as THREE from 'three';
import { World } from '../world/world';
import { WALL_H } from './ChunkMesh';

// Deux vues, on passe de l'une à l'autre avec P :
// - "third" : derrière et au-dessus du personnage, toujours alignée sur lui.
// - "first" : à travers les yeux du personnage (les mains sont dessinées à part).
// Le personnage et la caméra partagent la même orientation (yaw) : tourner la souris
// fait tourner le personnage, et la caméra reste derrière lui.

export type ViewMode = 'third' | 'first';

const EYE_HEIGHT = 0.72;
const PIVOT_HEIGHT = 0.7;

export class CameraRig {
  mode: ViewMode = 'third';
  yaw = 0; // orientation du personnage (et de la caméra)
  elevation = 0.45; // vue 3e personne : hauteur de la caméra (angle)
  lookPitch = -0.1; // vue 1re personne : regarder en haut / en bas
  distance = 3.2;
  private current = 3.2;
  private currentElevation = 0.45;
  /** Distance réelle caméra-personnage (le jeu cache le corps si elle est trop petite). */
  get actualDistance(): number {
    return this.current;
  }

  constructor(public readonly camera: THREE.PerspectiveCamera) {}

  toggle(): void {
    this.mode = this.mode === 'third' ? 'first' : 'third';
  }

  /** Déplacement de souris : horizontal = tourner, vertical = lever/baisser la vue. */
  look(dx: number, dy: number): void {
    this.yaw -= dx * 0.004;
    if (this.mode === 'third') {
      this.elevation = THREE.MathUtils.clamp(this.elevation + dy * 0.004, 0.05, 1.3);
    } else {
      this.lookPitch = THREE.MathUtils.clamp(this.lookPitch - dy * 0.004, -1.4, 1.4);
    }
  }

  turn(amount: number): void {
    this.yaw += amount;
  }

  zoom(delta: number): void {
    this.distance = THREE.MathUtils.clamp(this.distance + delta * 0.003, 1.2, 7);
  }

  /** Direction "avant" du personnage au sol. */
  forward(): { x: number; z: number } {
    return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
  }

  private direction(elev: number): THREE.Vector3 {
    return new THREE.Vector3(Math.sin(this.yaw) * Math.cos(elev), Math.sin(elev), Math.cos(this.yaw) * Math.cos(elev));
  }

  /** Jusqu'où la caméra peut reculer dans cette direction sans entrer dans un mur. */
  private freeDistance(world: World, target: THREE.Vector3, elev: number): number {
    const dir = this.direction(elev);
    const p = new THREE.Vector3();
    for (let d = 0.15; d <= this.distance; d += 0.05) {
      p.copy(target).addScaledVector(dir, d);
      if (p.y < WALL_H + 0.15 && blocked(world, p.x, p.z, 0.12)) return Math.max(0.3, d - 0.12);
    }
    return this.distance;
  }

  update(world: World, px: number, pz: number, dt: number, bob: number): void {
    if (this.mode === 'first') {
      const f = this.forward();
      const c = Math.cos(this.lookPitch);
      this.camera.position.set(px, EYE_HEIGHT + bob, pz);
      this.camera.lookAt(px + f.x * c, EYE_HEIGHT + bob + Math.sin(this.lookPitch), pz + f.z * c);
      return;
    }

    const target = new THREE.Vector3(px, PIVOT_HEIGHT, pz);
    // Dans un couloir étroit, si un mur bloque la vue, la caméra monte d'elle-même
    // (comme une grue) au lieu de se coller au dos du personnage.
    const wanted = Math.min(this.distance, 2);
    let bestElev = this.elevation, bestFree = this.freeDistance(world, target, this.elevation);
    for (let e = this.elevation + 0.15; bestFree < wanted && e <= 1.4; e += 0.15) {
      const free = this.freeDistance(world, target, e);
      if (free > bestFree + 0.2) {
        bestFree = free;
        bestElev = e;
      }
    }
    this.currentElevation += (bestElev - this.currentElevation) * Math.min(1, dt * 5);
    const free = this.freeDistance(world, target, this.currentElevation);
    this.current = free < this.current ? free : this.current + (free - this.current) * Math.min(1, dt * 4);
    this.camera.position.copy(target).addScaledVector(this.direction(this.currentElevation), this.current);
    this.camera.lookAt(target);
  }
}

function blocked(world: World, x: number, z: number, r: number): boolean {
  return (
    world.isSolid(Math.floor(x - r), Math.floor(z - r)) ||
    world.isSolid(Math.floor(x + r), Math.floor(z - r)) ||
    world.isSolid(Math.floor(x - r), Math.floor(z + r)) ||
    world.isSolid(Math.floor(x + r), Math.floor(z + r))
  );
}
