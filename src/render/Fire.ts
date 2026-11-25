import * as THREE from 'three';

// Flammes : un petit volume lumineux (qui "brille" grâce au bloom) + une vraie lumière
// qui vacille. Utilisé pour la torche du joueur et les braseros du refuge.

const flameGeo = new THREE.OctahedronGeometry(0.07, 0).scale(1, 1.8, 1);
const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.8, 0.5) }); // > 1 : alimente le bloom

export class Fire {
  readonly root = new THREE.Group();
  readonly light: THREE.PointLight;
  private flame: THREE.Mesh;
  private t = Math.random() * 100;
  showFlame = true;

  constructor(private power: number, range: number, size = 1) {
    this.flame = new THREE.Mesh(flameGeo, flameMat);
    this.flame.scale.setScalar(size);
    this.light = new THREE.PointLight(0xff9a4a, power, range, 1.9);
    this.light.position.y = 0.1;
    this.root.add(this.flame, this.light);
  }

  /** darkness : 0 en plein jour, 1 en pleine nuit (le feu compte plus quand il fait noir). */
  update(dt: number, darkness: number, lit = true): void {
    this.t += dt;
    const flicker = 0.82 + 0.1 * Math.sin(this.t * 13) + 0.08 * Math.sin(this.t * 29.7 + 1.3);
    this.light.intensity = lit ? this.power * flicker * (0.25 + 0.75 * darkness) : 0;
    this.flame.visible = lit && this.showFlame;
    this.flame.scale.y = this.flame.scale.x * (0.9 + 0.2 * Math.sin(this.t * 17));
    this.flame.rotation.y += dt * 2;
  }
}

/** Brasero de pierre avec son feu. */
export function makeBrazier(stoneMat: THREE.Material): { root: THREE.Group; fire: Fire } {
  const root = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.7, 8), stoneMat);
  base.position.y = 0.35;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.14, 0.14, 8), stoneMat);
  bowl.position.y = 0.76;
  base.castShadow = bowl.castShadow = true;
  const fire = new Fire(7, 14, 2.2);
  fire.root.position.y = 0.92;
  root.add(base, bowl, fire.root);
  return { root, fire };
}
