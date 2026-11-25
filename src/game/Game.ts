import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { World } from '../world/world';
import { CHUNK_SIZE, isRefuge } from '../world/chunk';
import { CycleState, DAY_SECONDS, GATES_CLOSE_START, GATES_OPEN_START, cycleAt } from '../world/cycle';
import { Player } from '../player/Player';
import { makeTextures } from '../render/textures';
import { ChunkAssets, ChunkView, buildChunkView, disposeChunkView, makeChunkAssets, setGateOpenness } from '../render/ChunkMesh';
import { Avatar } from '../render/Avatar';
import { CameraRig } from '../render/CameraRig';
import { Hands } from '../render/Hands';
import { Lighting } from '../render/Lighting';
import { Fire, makeBrazier } from '../render/Fire';
import { Input } from './Input';

const VIEW_RADIUS = 2; // chunks affichés autour du joueur (5 x 5)
const START_PHASE = 0.08; // on commence le matin
const FAST_TIME = 40; // vitesse du temps quand on maintient T

export class Game {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private handsPass: RenderPass;
  private scene = new THREE.Scene();
  private cam: CameraRig;
  private lighting: Lighting;
  private assets: ChunkAssets;
  private avatar = new Avatar();
  private hands = new Hands();
  private braziers: Fire[] = [];
  private input: Input;
  private timer = new THREE.Timer();

  private world!: World;
  private player!: Player;
  private time = 0; // secondes écoulées dans le monde
  private cycle!: CycleState;
  private views = new Map<string, ChunkView>();
  private currentChunk = { cx: NaN, cy: NaN };
  private shake = 0;
  private message = '';
  private messageUntil = 0;

  constructor(private container: HTMLElement, private hud: HTMLElement, private subtitle: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.7;
    container.appendChild(this.renderer.domElement);

    this.cam = new CameraRig(new THREE.PerspectiveCamera(65, 1, 0.05, 400));
    this.lighting = new Lighting(this.scene);
    const tex = makeTextures();
    this.assets = makeChunkAssets(tex);
    this.scene.add(this.avatar.root);

    // Rendu : le monde, puis les mains (1re personne) par-dessus, puis le "bloom"
    // qui fait rayonner les flammes, puis la conversion finale des couleurs.
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.cam.camera));
    this.handsPass = new RenderPass(this.hands.scene, this.cam.camera);
    this.handsPass.clear = false;
    this.handsPass.clearDepth = true;
    this.composer.addPass(this.handsPass);
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.45, 1.6));
    this.composer.addPass(new OutputPass());

    this.input = new Input(this.renderer.domElement);
    this.input.onLook = (dx, dy) => this.cam.look(dx, dy);
    this.input.onWheel = (d) => this.cam.zoom(d);
    this.input.onKey('KeyR', () => this.newWorld(randomSeed()));
    this.input.onKey('KeyP', () => this.cam.toggle());

    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.newWorld(initialSeed());
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private newWorld(seed: number): void {
    this.views.forEach(disposeChunkView);
    this.views.clear();
    this.currentChunk = { cx: NaN, cy: NaN };
    this.world = new World(seed);
    // ?phase=0.7 dans l'URL : démarrer à un autre moment de la journée (pratique pour tester).
    const phase = Number(new URLSearchParams(location.search).get('phase'));
    this.time = (Number.isFinite(phase) && phase > 0 ? phase : START_PHASE) * DAY_SECONDS;
    this.cycle = cycleAt(this.time);
    this.world.shifts = this.cycle.shifts;
    // ?spawn=x,y : apparaître ailleurs que dans le refuge (pratique pour tester).
    const spawn = new URLSearchParams(location.search).get('spawn')?.split(',').map(Number);
    this.player = spawn?.length === 2 ? new Player(spawn[0], spawn[1]) : new Player(7.5, 7.5); // centre du refuge
    if (this.world.isSolid(Math.floor(this.player.x), Math.floor(this.player.y))) {
      [this.player.x, this.player.y] = this.world.nearestFree(this.player.x, this.player.y, false);
    }
  }

  private frame(): void {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.05);

    this.advanceTime(dt * (this.input.is('KeyT') ? FAST_TIME : 1));

    // Le personnage et la caméra regardent dans la même direction.
    const { forward, strafe, turn } = this.input.axes();
    this.cam.turn(turn * dt * 2.4);
    const f = this.cam.forward();
    let mx = f.x * forward - f.z * strafe;
    let mz = f.z * forward + f.x * strafe;
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len;
      mz /= len;
      this.player.move(this.world, mx, mz, dt);
    }

    this.refreshChunks();
    const darkness = this.lighting.darkness;
    const first = this.cam.mode === 'first';
    this.avatar.update(this.player.x, this.player.y, this.cam.yaw + Math.PI, len > 0, dt);
    this.avatar.torch.update(dt, darkness, darkness > 0.15);
    this.braziers.forEach((b) => b.update(dt, darkness));

    const bob = first ? Math.abs(Math.sin(this.avatar.walkPhase)) * 0.025 * this.avatar.moving : 0;
    this.cam.update(this.world, this.player.x, this.player.y, dt, bob);
    // Corps caché en 1re personne, ou si la caméra est collée au personnage.
    this.avatar.setFirstPerson(first || this.cam.actualDistance < 0.75);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const k = Math.min(1, this.shake) * 0.03;
      this.cam.camera.position.x += (Math.random() - 0.5) * k;
      this.cam.camera.position.y += (Math.random() - 0.5) * k;
    }
    this.lighting.update(this.cycle, this.player.x, this.player.y, this.cam.camera);

    this.handsPass.enabled = first;
    if (first) {
      this.cam.camera.updateMatrixWorld();
      this.hands.update(this.cam.camera, this.avatar.walkPhase, this.avatar.moving, dt, darkness);
    }
    this.composer.render(dt);
    this.updateHud();
  }

  /** Fait avancer l'horloge du labyrinthe et applique ses lois. */
  private advanceTime(dt: number): void {
    const before = this.cycle;
    this.time += dt;
    this.cycle = cycleAt(this.time);
    const c = this.cycle;

    // Les portes du refuge.
    this.world.gateOpenness = c.gateOpenness;
    const refugeView = this.views.get(World.key(0, 0));
    if (refugeView) setGateOpenness(refugeView, c.gateOpenness);
    if (before.phase < GATES_CLOSE_START && c.phase >= GATES_CLOSE_START) {
      this.say('Un grincement de pierre : les portes du refuge se referment…');
      this.shake = 2.5;
    }
    if (before.day !== c.day && c.phase >= GATES_OPEN_START) this.say(`Jour ${c.day}. Les portes s'ouvrent.`);

    // Au cœur de la nuit, une partie du labyrinthe se réorganise.
    if (c.shifts !== this.world.shifts) {
      this.world.shifts = c.shifts;
      this.rebuildChangedChunks();
      this.shake = 4;
      this.say('Un grondement sourd parcourt le labyrinthe…');
    }

    // Personne ne reste coincé dans un mur ou une porte qui vient de se fermer.
    if (this.world.isSolid(Math.floor(this.player.x), Math.floor(this.player.y))) {
      [this.player.x, this.player.y] = this.world.nearestFree(this.player.x, this.player.y, true);
    }
  }

  private say(text: string): void {
    this.message = text;
    this.messageUntil = performance.now() + 5000;
  }

  private rebuildChangedChunks(): void {
    for (const [key, view] of this.views) {
      const [x, y] = key.split(',').map(Number);
      if (this.world.chunkVersion(x, y) !== view.version) {
        disposeChunkView(view);
        this.views.set(key, this.addChunkView(x, y));
      }
    }
  }

  private addChunkView(cx: number, cy: number): ChunkView {
    const view = buildChunkView(this.world.getChunk(cx, cy), this.assets);
    if (isRefuge(cx, cy)) {
      setGateOpenness(view, this.world.gateOpenness);
      // Quatre braseros éclairent le refuge la nuit.
      this.braziers = [];
      for (const [x, z] of [[2.5, 2.5], [13.5, 2.5], [2.5, 13.5], [13.5, 13.5]]) {
        const b = makeBrazier(this.assets.wallMat);
        b.root.position.set(x, 0, z);
        view.group.add(b.root);
        this.braziers.push(b.fire);
      }
    }
    this.scene.add(view.group);
    return view;
  }

  private refreshChunks(): void {
    const cx = Math.floor(this.player.x / CHUNK_SIZE);
    const cy = Math.floor(this.player.y / CHUNK_SIZE);
    if (cx === this.currentChunk.cx && cy === this.currentChunk.cy) return;
    this.currentChunk = { cx, cy };

    for (const [key, view] of this.views) {
      const [x, y] = key.split(',').map(Number);
      if (Math.abs(x - cx) > VIEW_RADIUS || Math.abs(y - cy) > VIEW_RADIUS) {
        if (isRefuge(x, y)) this.braziers = [];
        disposeChunkView(view);
        this.views.delete(key);
      }
    }
    for (let y = cy - VIEW_RADIUS; y <= cy + VIEW_RADIUS; y++) {
      for (let x = cx - VIEW_RADIUS; x <= cx + VIEW_RADIUS; x++) {
        const key = World.key(x, y);
        if (!this.views.has(key)) this.views.set(key, this.addChunkView(x, y));
      }
    }
    this.world.forgetFarChunks(cx, cy, VIEW_RADIUS + 1);
  }

  private resize(): void {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.cam.camera.aspect = w / h;
    this.cam.camera.updateProjectionMatrix();
  }

  private lastHud = '';
  private updateHud(): void {
    const c = this.cycle;
    const hh = Math.floor(c.hour), mm = Math.floor((c.hour - hh) * 60);
    const where = isRefuge(this.currentChunk.cx, this.currentChunk.cy) ? 'refuge' : this.world.getChunk(this.currentChunk.cx, this.currentChunk.cy).kind === 'clearing' ? 'clairière' : 'labyrinthe';
    const text =
      `THE ENDLESS · Jour ${c.day} · ${String(hh).padStart(2, '0')}h${String(mm).padStart(2, '0')} · ${where}\n` +
      `graine ${this.world.seed} · vue ${this.cam.mode === 'first' ? '1re' : '3e'} personne\n` +
      (this.input.locked()
        ? `Z/S avancer/reculer · Q/D pas de côté · souris : tourner · P : vue · T (maintenu) : accélérer le temps · R : nouveau monde · Échap : libérer la souris`
        : `Clique dans le jeu pour prendre la souris · Z/S · Q/D · ←/→ tourner · P : vue · T (maintenu) : accélérer le temps · R : nouveau monde`);
    if (text !== this.lastHud) this.hud.textContent = this.lastHud = text;
    const sub = performance.now() < this.messageUntil ? this.message : '';
    if (this.subtitle.textContent !== sub) this.subtitle.textContent = sub;
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
