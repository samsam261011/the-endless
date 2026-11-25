import * as THREE from 'three';
import { World } from '../world/world';
import { WALL_H } from './ChunkMesh';

// Caméra à la troisième personne : derrière et au-dessus du personnage.
// Si un mur s'interpose, la caméra se rapproche (elle ne traverse jamais les murs).

const EYE_HEIGHT = 0.7;

export class ThirdPersonCamera {
  yaw = Math.PI / 4; // rotation autour du personnage
  pitch = 0.55; // inclinaison (0 = horizontale)
  distance = 3.2; // distance voulue
  private current = 3.2; // distance réelle après collisions

  constructor(public readonly camera: THREE.PerspectiveCamera) {}

  rotate(dx: number, dy: number): void {
    this.yaw -= dx * 0.006;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.005, 0.1, 1.35);
  }

  zoom(delta: number): void {
    this.distance = THREE.MathUtils.clamp(this.distance + delta * 0.003, 1.2, 7);
  }

  /** Direction "avant" au sol (là où regarde la caméra), en coordonnées du monde. */
  forward(): { x: number; z: number } {
    return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
  }

  update(world: World, px: number, pz: number, dt: number): void {
    const target = new THREE.Vector3(px, EYE_HEIGHT, pz);
    const dir = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    // On avance pas à pas le long du rayon et on s'arrête avant le premier mur.
    let free = this.distance;
    const p = new THREE.Vector3();
    for (let d = 0.15; d <= this.distance; d += 0.05) {
      p.copy(target).addScaledVector(dir, d);
      if (p.y < WALL_H + 0.15 && blocked(world, p.x, p.z, 0.12)) {
        free = Math.max(0.3, d - 0.12);
        break;
      }
    }
    // Se rapproche immédiatement, s'éloigne en douceur (évite les à-coups).
    this.current = free < this.current ? free : this.current + (free - this.current) * Math.min(1, dt * 4);
    this.camera.position.copy(target).addScaledVector(dir, this.current);
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
