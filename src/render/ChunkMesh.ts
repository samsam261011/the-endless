import * as THREE from 'three';
import { CHUNK_SIZE, ChunkData, Tile } from '../world/chunk';

// Affichage 3D d'un chunk. 1 case du monde = 1 unité 3D (x -> x, y du monde -> z).
// Les murs sont des "instances" d'un même bloc : très peu coûteux pour la carte graphique.

export const WALL_H = 3; // murs géants : environ 4 fois la taille du personnage

export interface ChunkAssets {
  wallGeo: THREE.BoxGeometry;
  tileGeo: THREE.PlaneGeometry;
  wallMat: THREE.Material;
  floorMat: THREE.Material;
  grassMat: THREE.Material;
}

export function makeChunkAssets(tex: { wall: THREE.Texture; floor: THREE.Texture; grass: THREE.Texture }): ChunkAssets {
  const wallGeo = new THREE.BoxGeometry(1, WALL_H, 1);
  // Répète la texture sur la hauteur des faces latérales (sinon elle serait étirée).
  const uv = wallGeo.getAttribute('uv') as THREE.BufferAttribute;
  for (let face = 0; face < 6; face++) {
    if (face === 2 || face === 3) continue; // dessus et dessous
    for (let v = face * 4; v < face * 4 + 4; v++) uv.setY(v, uv.getY(v) * WALL_H);
  }
  wallGeo.translate(0.5, WALL_H / 2, 0.5);

  const tileGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0.5);

  return {
    wallGeo,
    tileGeo,
    wallMat: new THREE.MeshLambertMaterial({ map: tex.wall }),
    floorMat: new THREE.MeshLambertMaterial({ map: tex.floor }),
    grassMat: new THREE.MeshLambertMaterial({ map: tex.grass }),
  };
}

export function buildChunkMesh(chunk: ChunkData, a: ChunkAssets): THREE.Group {
  const walls: number[] = [], floors: number[] = [], grass: number[] = [];
  chunk.tiles.forEach((t, i) => {
    (t === Tile.Wall ? walls : t === Tile.Grass ? grass : floors).push(i);
  });

  const group = new THREE.Group();
  group.position.set(chunk.cx * CHUNK_SIZE, 0, chunk.cy * CHUNK_SIZE);
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
  return group;
}

export function disposeChunkMesh(group: THREE.Group): void {
  // Les géométries et matériaux sont partagés : on ne libère que les instances.
  group.children.forEach((c) => (c as THREE.InstancedMesh).dispose());
  group.removeFromParent();
}
