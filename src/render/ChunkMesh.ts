import * as THREE from 'three';
import { CHUNK_SIZE, ChunkData, Tile } from '../world/chunk';
import { Textures } from './textures';

// Affichage 3D d'un chunk. 1 case du monde = 1 unité 3D (x -> x, y du monde -> z).
// Les murs sont des "instances" d'un même bloc : très peu coûteux pour la carte graphique.

export const WALL_H = 3; // murs géants : environ 4 fois la taille du personnage

export interface ChunkAssets {
  wallGeo: THREE.BufferGeometry;
  tileGeo: THREE.PlaneGeometry;
  wallMat: THREE.Material;
  floorMat: THREE.Material;
  grassMat: THREE.Material;
  gateMat: THREE.Material;
}

export function makeChunkAssets(tex: Textures): ChunkAssets {
  const wallGeo = new THREE.BoxGeometry(1, WALL_H, 1, 1, 6, 1).translate(0.5, WALL_H / 2, 0.5);
  const pos = wallGeo.getAttribute('position') as THREE.BufferAttribute;
  const nor = wallGeo.getAttribute('normal') as THREE.BufferAttribute;
  const uv = wallGeo.getAttribute('uv') as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    // Faces latérales : la texture se répète tous les mètres (pas d'étirement).
    if (Math.abs(nor.getY(i)) < 0.5) uv.setY(i, y);
    // Occlusion ambiante "peinte" : le pied des murs est plus sombre, comme dans la réalité.
    const ao = 0.35 + 0.65 * Math.min(1, Math.pow(y / 1.6, 0.7));
    colors.set([ao, ao, ao], i * 3);
  }
  wallGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const tileGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0.5);
  const std = (t: { map: THREE.Texture; normalMap: THREE.Texture }, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughness: 0.92, metalness: 0, ...extra });

  return {
    wallGeo,
    tileGeo,
    wallMat: std(tex.wall, { vertexColors: true }),
    floorMat: std(tex.floor),
    grassMat: std(tex.grass, { roughness: 1 }),
    gateMat: std(tex.gate, { roughness: 0.8, metalness: 0.15 }),
  };
}

export interface ChunkView {
  group: THREE.Group;
  version: number;
  gates: THREE.Mesh[]; // portes animées (refuge uniquement)
}

export function buildChunkView(chunk: ChunkData, a: ChunkAssets): ChunkView {
  const walls: number[] = [], floors: number[] = [], grass: number[] = [];
  const gates: THREE.Mesh[] = [];
  const group = new THREE.Group();
  group.position.set(chunk.cx * CHUNK_SIZE, 0, chunk.cy * CHUNK_SIZE);

  chunk.tiles.forEach((t, i) => {
    if (t === Tile.Wall) walls.push(i);
    else if (t === Tile.Grass) grass.push(i);
    else floors.push(i); // sol, et sol sous les portes
    if (t === Tile.Gate) {
      const gate = new THREE.Mesh(a.wallGeo, a.gateMat);
      gate.position.set(i % CHUNK_SIZE, 0, Math.floor(i / CHUNK_SIZE));
      gate.castShadow = gate.receiveShadow = true;
      gates.push(gate);
      group.add(gate);
    }
  });

  const m = new THREE.Matrix4();
  const add = (indices: number[], geo: THREE.BufferGeometry, mat: THREE.Material, shadows: boolean) => {
    if (indices.length === 0) return;
    const mesh = new THREE.InstancedMesh(geo, mat, indices.length);
    indices.forEach((i, k) => {
      m.makeTranslation(i % CHUNK_SIZE, 0, Math.floor(i / CHUNK_SIZE));
      mesh.setMatrixAt(k, m);
    });
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  };
  add(walls, a.wallGeo, a.wallMat, true);
  add(floors, a.tileGeo, a.floorMat, false);
  add(grass, a.tileGeo, a.grassMat, false);
  return { group, version: chunk.version, gates };
}

/** Portes : enfoncées dans le sol quand elles sont ouvertes, dressées quand elles sont fermées. */
export function setGateOpenness(view: ChunkView, openness: number): void {
  for (const g of view.gates) g.position.y = -WALL_H * 0.995 * openness;
}

export function disposeChunkView(view: ChunkView): void {
  // Géométries et matériaux partagés : on ne libère que les instances.
  view.group.children.forEach((c) => (c as THREE.InstancedMesh).isInstancedMesh && (c as THREE.InstancedMesh).dispose());
  view.group.removeFromParent();
}
