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
  yaw = Math.PI / 4; // orientation du personnage (et de la caméra)
  elevation = 0.45; // vue 3e personne : hauteur de la caméra (angle)
  lookPitch = -0.1; // vue 1re personne : regarder en haut / en bas
  distance = 3.2;
  private current = 3.2;

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

  update(world: World, px: number, pz: number, dt: number, bob: number): void {
    if (this.mode === 'first') {
      const f = this.forward();
      const c = Math.cos(this.lookPitch);
      this.camera.position.set(px, EYE_HEIGHT + bob, pz);
      this.camera.lookAt(px + f.x * c, EYE_HEIGHT + bob + Math.sin(this.lookPitch), pz + f.z * c);
      return;
    }

    const target = new THREE.Vector3(px, PIVOT_HEIGHT, pz);
    const dir = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.elevation),
      Math.sin(this.elevation),
      Math.cos(this.yaw) * Math.cos(this.elevation),
    );
    // Si un mur s'interpose, la caméra se rapproche : le personnage reste toujours visible.
    let free = this.distance;
    const p = new THREE.Vector3();
    for (let d = 0.15; d <= this.distance; d += 0.05) {
      p.copy(target).addScaledVector(dir, d);
      if (p.y < WALL_H + 0.15 && blocked(world, p.x, p.z, 0.12)) {
        free = Math.max(0.3, d - 0.12);
        break;
      }
    }
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
