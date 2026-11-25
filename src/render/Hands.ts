import * as THREE from 'three';

// Mains et avant-bras en vue à la première personne.
// Ils vivent dans leur propre petite scène, dessinée par-dessus le monde :
// ainsi ils ne rentrent jamais dans les murs quand on s'en approche.

export class Hands {
  readonly scene = new THREE.Scene();
  private left: THREE.Group;
  private right: THREE.Group;

  constructor() {
    this.scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x4a4030, 1.6));
    const light = new THREE.DirectionalLight(0xfff1d6, 1.2);
    light.position.set(0.5, 1, 0.3);
    this.scene.add(light);
    this.left = this.arm(-1);
    this.right = this.arm(1);
    this.scene.add(this.left, this.right);
  }

  private arm(side: -1 | 1): THREE.Group {
    const g = new THREE.Group();
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.32), new THREE.MeshLambertMaterial({ color: 0x7a5a2e }));
    sleeve.position.z = 0.06;
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.085, 0.11), new THREE.MeshLambertMaterial({ color: 0xd9b58c }));
    hand.position.z = -0.15;
    g.add(sleeve, hand);
    g.userData.side = side;
    return g;
  }

  /** Place les bras devant la caméra, avec un léger balancement pendant la marche. */
  update(camera: THREE.Camera, walkPhase: number, moving: number): void {
    for (const g of [this.left, this.right]) {
      const side = g.userData.side as number;
      const swing = Math.sin(walkPhase + (side > 0 ? 0 : Math.PI)) * 0.025 * moving;
      g.position.set(side * 0.24, -0.24 + Math.abs(swing), -0.4 + swing);
      g.rotation.set(0.15, -side * 0.12, 0);
      g.position.applyMatrix4(camera.matrixWorld);
      g.quaternion.premultiply(camera.quaternion);
    }
  }
}
