import * as THREE from 'three';

// Personnage provisoire en blocs : jambes, corps, tête, capuche.

export class Avatar {
  readonly root = new THREE.Group();
  private legL: THREE.Mesh;
  private legR: THREE.Mesh;
  private walkPhase = 0;
  private facing = 0;

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
  }

  update(x: number, z: number, moveX: number, moveZ: number, dt: number): void {
    this.root.position.set(x, 0, z);
    const moving = moveX !== 0 || moveZ !== 0;
    if (moving) {
      // Tourne doucement vers la direction de marche.
      const target = Math.atan2(moveX, moveZ);
      let diff = target - this.facing;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.facing += diff * Math.min(1, dt * 12);
      this.walkPhase += dt * 11;
    } else {
      this.walkPhase *= 0.8;
    }
    this.root.rotation.y = this.facing;
    const swing = Math.sin(this.walkPhase) * (moving ? 0.6 : 0);
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
  }
}
