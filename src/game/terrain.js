/**
 * Terrain chunks: a height-field grid per CHUNK×CHUNK metres. Heights come
 * from the same function the physics uses (World#visualHeight), so what you
 * see is what you drive on. Colours blend by biome, slope and road distance.
 */
import * as THREE from 'three';
import { biomeAt, mixRgb } from './biomes';
import { smoothstep } from './noise';

export const CHUNK = 192;
const GRID = 36;

const grassA = [0, 0, 0];
const grassB = [0, 0, 0];
const soil = [0, 0, 0];
const color = [0, 0, 0];

/** Builds the terrain geometry for chunk (cx, cz). */
export function buildTerrainGeometry(world, cx, cz) {
  const n = GRID + 1;
  const step = CHUNK / GRID;
  const x0 = cx * CHUNK;
  const z0 = cz * CHUNK;
  const heights = new Float32Array(n * n);
  const roadDist = new Float32Array(n * n);

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      heights[k] = world.visualHeight(x0 + i * step, z0 + j * step);
      roadDist[k] = world.lastRoadDist;
    }
  }

  const positions = new Float32Array(n * n * 3);
  const colors = new Float32Array(n * n * 3);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      const x = x0 + i * step;
      const z = z0 + j * step;
      positions[k * 3] = x;
      positions[k * 3 + 1] = heights[k];
      positions[k * 3 + 2] = z;

      const { a, b, t } = biomeAt(world.road.along(x, z));
      mixRgb(grassA, a.grass, b.grass, t);
      mixRgb(grassB, a.grass2, b.grass2, t);
      mixRgb(soil, a.soil, b.soil, t);

      const patch = 0.5 + 0.5 * world.detailNoise(x * 0.018, z * 0.018);
      mixRgb(color, grassA, grassB, patch);

      // slope from neighbouring heights → bare soil on steep ground
      const hx = heights[j * n + Math.min(i + 1, n - 1)] - heights[j * n + Math.max(i - 1, 0)];
      const hz = heights[Math.min(j + 1, n - 1) * n + i] - heights[Math.max(j - 1, 0) * n + i];
      const slope = Math.hypot(hx, hz) / (2 * step);
      mixRgb(color, color, soil, smoothstep(0.35, 0.8, slope) * 0.85);
      // worn verge next to the road
      mixRgb(color, color, soil, (1 - smoothstep(6.5, 10, roadDist[k])) * 0.55);

      const shade = 0.93 + 0.14 * world.detailNoise(x * 0.11 + 40, z * 0.11);
      colors[k * 3] = color[0] * shade;
      colors[k * 3 + 1] = color[1] * shade;
      colors[k * 3 + 2] = color[2] * shade;
    }
  }

  const indices = [];
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const a = j * n + i;
      const b = a + 1;
      const c = a + n;
      const d = c + 1;
      // alternate the diagonal for a less regular low-poly look
      if ((i + j) % 2) indices.push(a, c, b, b, c, d);
      else indices.push(a, c, d, a, d, b);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
