import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { CycleState } from '../world/cycle';

// Ciel, soleil/lune, lumière d'ambiance et brouillard, pilotés par l'heure.
// Le jour : brume légère et lumière chaude. La nuit : brouillard épais et bleuté,
// on ne voit presque plus rien sans feu.

const DAY_FOG = new THREE.Color(0x7f8a8f);
const DUSK_FOG = new THREE.Color(0x8a6a5a);
const NIGHT_FOG = new THREE.Color(0x05070d);

export class Lighting {
  readonly sky = new Sky();
  readonly celestial = new THREE.DirectionalLight(0xffffff, 1); // soleil le jour, lune la nuit
  readonly ambient = new THREE.HemisphereLight(0xcfe3ff, 0x3b3226, 1);
  readonly fog = new THREE.FogExp2(0x000000, 0.03);
  /** 0 = plein jour, 1 = nuit noire. */
  darkness = 0;

  constructor(scene: THREE.Scene) {
    this.sky.scale.setScalar(150);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 4;
    u.rayleigh.value = 1.6;
    u.mieCoefficient.value = 0.003;
    u.mieDirectionalG.value = 0.85;

    const c = this.celestial;
    c.castShadow = true;
    c.shadow.mapSize.set(2048, 2048);
    const s = c.shadow.camera;
    s.left = s.bottom = -16;
    s.right = s.top = 16;
    s.near = 1;
    s.far = 70;
    c.shadow.bias = -0.0004;
    c.shadow.normalBias = 0.02;

    scene.fog = this.fog;
    scene.add(this.sky, c, c.target, this.ambient);
  }

  update(cycle: CycleState, px: number, pz: number, camera: THREE.Camera): void {
    const sun = cycle.sun; // -1..1
    const day = THREE.MathUtils.smoothstep(sun, -0.08, 0.25); // 0 nuit, 1 jour
    const lowSun = 1 - THREE.MathUtils.smoothstep(Math.abs(sun), 0.0, 0.35); // aube / crépuscule
    this.darkness = 1 - day;

    // Course du soleil (ou de la lune, de l'autre côté du ciel).
    const angle = cycle.phase * Math.PI * 2 * (0.5 / 0.66);
    const dir = new THREE.Vector3(Math.cos(angle) * 0.8, Math.max(0.05, Math.abs(sun)), 0.45).normalize();
    this.sky.material.uniforms.sunPosition.value.set(dir.x, sun, dir.z).normalize();
    this.sky.position.copy(camera.position);
    this.sky.visible = sun > -0.25;

    // Lumière principale : soleil chaud et doré, ou lune froide et faible.
    const c = this.celestial;
    c.position.set(px + dir.x * 30, dir.y * 30, pz + dir.z * 30);
    c.target.position.set(px, 0, pz);
    if (sun >= 0) {
      c.color.setRGB(1, 0.92 - 0.3 * lowSun, 0.8 - 0.45 * lowSun);
      c.intensity = 2.6 * THREE.MathUtils.smoothstep(sun, 0, 0.15);
    } else {
      c.color.setRGB(0.55, 0.65, 1);
      c.intensity = 0.25 * THREE.MathUtils.smoothstep(-sun, 0.1, 0.5);
    }

    this.ambient.intensity = 0.06 + 0.9 * day;
    this.ambient.color.setRGB(0.6 + 0.2 * day, 0.7 + 0.2 * day, 1);

    // Brouillard : léger le jour, rougeoyant au crépuscule, épais et noir la nuit.
    const fog = this.fog.color;
    fog.copy(NIGHT_FOG).lerp(DAY_FOG, day);
    fog.lerp(DUSK_FOG, lowSun * day * 0.6);
    this.fog.density = THREE.MathUtils.lerp(0.11, 0.016, day);
  }
}
