import * as THREE from 'three';
import { Fire } from './Fire';

// Personnage provisoire en blocs : jambes, corps, tête, capuche.

export class Avatar {
  readonly root = new THREE.Group();
  private legL: THREE.Mesh;
  private legR: THREE.Mesh;
  walkPhase = 0;
  moving = 0; // 0 = immobile, 1 = en marche (lissé)
  /** Torche tenue dans la main droite (allumée automatiquement quand il fait sombre). */
  readonly torch = new Fire(3.2, 10, 1);

  constructor() {
    const mat = (c: number) => new THREE.MeshLambertMaterial({ color: c });
    const box = (w: number, h: number, d: number, c: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
      mesh.castShadow = true;
      return mesh;
    };
    // Jambes : pivot en haut de la jambe pour l'animation de marche.
    const leg = (x: number) => {
      const m = box(0.11, 0.3, 0.12, 0x3b2f25);
      m.geometry.translate(0, -0.15, 0);
      m.position.set(x, 0.3, 0);
      return m;
    };
    this.legL = leg(-0.07);
    this.legR = leg(0.07);
    const body = box(0.3, 0.3, 0.18, 0x7a5a2e);
    body.position.y = 0.45;
    const head = box(0.22, 0.22, 0.22, 0xd9b58c);
    head.position.y = 0.71;
    const hood = box(0.25, 0.1, 0.25, 0x4a3620);
    hood.position.set(0, 0.8, 0.01);
    const pack = box(0.2, 0.22, 0.09, 0x5a4026); // petit sac à dos
    pack.position.set(0, 0.46, -0.13);
    this.root.add(this.legL, this.legR, body, head, hood, pack);
    const stick = box(0.04, 0.32, 0.04, 0x3a2a1a);
    stick.position.set(-0.2, 0.52, 0.12);
    stick.rotation.x = 0.35;
    this.torch.root.position.set(-0.2, 0.7, 0.18);
    this.root.add(stick, this.torch.root);
  }

  /** facing : angle du personnage (il regarde toujours dans la direction de la caméra). */
  /** En vue 1re personne, on cache le corps (mais la lumière de la torche reste). */
  setFirstPerson(first: boolean): void {
    for (const c of this.root.children) if (c !== this.torch.root) c.visible = !first;
    this.torch.showFlame = !first;
  }

  update(x: number, z: number, facing: number, isMoving: boolean, dt: number): void {
    this.root.position.set(x, 0, z);
    this.root.rotation.y = facing;
    this.moving += ((isMoving ? 1 : 0) - this.moving) * Math.min(1, dt * 10);
    if (isMoving) this.walkPhase += dt * 11;
    const swing = Math.sin(this.walkPhase) * 0.6 * this.moving;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
  }
}
