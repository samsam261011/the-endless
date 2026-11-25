import * as THREE from 'three';
import { World } from '../world/world';
import { CHUNK_SIZE } from '../world/chunk';
import { Player } from '../player/Player';
import { makeTextures } from '../render/textures';
import { ChunkAssets, buildChunkMesh, disposeChunkMesh, makeChunkAssets } from '../render/ChunkMesh';
import { Avatar } from '../render/Avatar';
import { ThirdPersonCamera } from '../render/ThirdPersonCamera';
import { Input } from './Input';

const VIEW_RADIUS = 2; // chunks affichés autour du joueur (5 x 5)
const SKY = 0x8fa3ad; // brume du jour

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam: ThirdPersonCamera;
  private assets: ChunkAssets;
  private sun: THREE.DirectionalLight;
  private avatar = new Avatar();
  private input: Input;
  private timer = new THREE.Timer();

  private world!: World;
  private player!: Player;
  private chunkMeshes = new Map<string, THREE.Group>();
  private currentChunk = { cx: NaN, cy: NaN };

  constructor(private container: HTMLElement, private hud: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(SKY);
    this.scene.fog = new THREE.Fog(SKY, 6, 30); // le brouillard cache la limite du monde chargé

    this.scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x4a4030, 1.6));
    this.sun = new THREE.DirectionalLight(0xfff1d6, 1.8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const s = this.sun.shadow.camera;
    s.left = s.bottom = -18;
    s.right = s.top = 18;
    s.near = 1;
    s.far = 60;
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun, this.sun.target);

    this.cam = new ThirdPersonCamera(new THREE.PerspectiveCamera(60, 1, 0.05, 100));
    this.assets = makeChunkAssets(makeTextures());
    this.scene.add(this.avatar.root);

    this.input = new Input(this.renderer.domElement);
    this.input.onDrag = (dx, dy) => this.cam.rotate(dx, dy);
    this.input.onWheel = (d) => this.cam.zoom(d);
    this.input.onKey('KeyR', () => this.newWorld(randomSeed()));

    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.newWorld(initialSeed());
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private newWorld(seed: number): void {
    this.chunkMeshes.forEach(disposeChunkMesh);
    this.chunkMeshes.clear();
    this.currentChunk = { cx: NaN, cy: NaN };
    this.world = new World(seed);
    this.player = new Player(7.5, 7.5); // centre de la clairière d'entrée
  }

  private frame(): void {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.05);

    // Déplacement relatif à la caméra : "avancer" = s'éloigner de la caméra.
    const { forward, right } = this.input.axes();
    const f = this.cam.forward();
    let mx = f.x * forward + -f.z * right;
    let mz = f.z * forward + f.x * right;
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len;
      mz /= len;
      this.player.move(this.world, mx, mz, dt);
    }

    this.refreshChunks();
    this.avatar.update(this.player.x, this.player.y, mx, mz, dt);
    this.cam.update(this.world, this.player.x, this.player.y, dt);

    // Le soleil suit le joueur pour que les ombres restent nettes autour de lui.
    this.sun.position.set(this.player.x + 8, 20, this.player.y + 5);
    this.sun.target.position.set(this.player.x, 0, this.player.y);

    this.renderer.render(this.scene, this.cam.camera);
    this.updateHud();
  }

  private refreshChunks(): void {
    const cx = Math.floor(this.player.x / CHUNK_SIZE);
    const cy = Math.floor(this.player.y / CHUNK_SIZE);
    if (cx === this.currentChunk.cx && cy === this.currentChunk.cy) return;
    this.currentChunk = { cx, cy };

    for (const [key, mesh] of this.chunkMeshes) {
      const [x, y] = key.split(',').map(Number);
      if (Math.abs(x - cx) > VIEW_RADIUS || Math.abs(y - cy) > VIEW_RADIUS) {
        disposeChunkMesh(mesh);
        this.chunkMeshes.delete(key);
      }
    }
    for (let y = cy - VIEW_RADIUS; y <= cy + VIEW_RADIUS; y++) {
      for (let x = cx - VIEW_RADIUS; x <= cx + VIEW_RADIUS; x++) {
        const key = World.key(x, y);
        if (this.chunkMeshes.has(key)) continue;
        const mesh = buildChunkMesh(this.world.getChunk(x, y), this.assets);
        this.scene.add(mesh);
        this.chunkMeshes.set(key, mesh);
      }
    }
    this.world.forgetFarChunks(cx, cy, VIEW_RADIUS + 1);
  }

  private resize(): void {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.cam.camera.aspect = w / h;
    this.cam.camera.updateProjectionMatrix();
  }

  private lastHud = '';
  private updateHud(): void {
    const c = this.world.getChunk(this.currentChunk.cx, this.currentChunk.cy);
    const text =
      `THE ENDLESS · prototype étape 1 (3D)\n` +
      `graine ${this.world.seed} · chunk ${c.cx},${c.cy} · ${c.kind === 'clearing' ? 'clairière' : 'couloirs'}\n` +
      `ZQSD / WASD / flèches : bouger · glisser la souris : tourner la caméra · molette : zoom · R : nouveau labyrinthe`;
    if (text !== this.lastHud) this.hud.textContent = this.lastHud = text;
  }
}

function randomSeed(): number {
  return Math.floor(Math.random() * 1e9);
}

/** ?seed=123 dans l'URL permet de rejouer exactement le même labyrinthe. */
function initialSeed(): number {
  const s = Number(new URLSearchParams(location.search).get('seed'));
  return Number.isFinite(s) && s > 0 ? Math.floor(s) : randomSeed();
}
