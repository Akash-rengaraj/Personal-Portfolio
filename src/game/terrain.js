/**
 * Terrain chunks: a height-field grid per CHUNK×CHUNK metres. Heights come
 * from the same function the physics uses (World#visualHeight), so what you
 * see is what you drive on. Colours blend by biome, slope, altitude and road
 * distance; a tiling detail texture (UVs in metres) adds ground grain.
 */
import * as THREE from 'three';
import { mixRgb } from './biomes';
import { smoothstep } from './noise';

export const CHUNK = 192;
export const DETAIL_TILE = 9; // metres per repeat of the ground detail texture

const grassA = [0, 0, 0];
const grassB = [0, 0, 0];
const soil = [0, 0, 0];
const rock = [0, 0, 0];
const peak = [0, 0, 0];
const color = [0, 0, 0];

/** Builds the terrain geometry for chunk (cx, cz) with `grid` cells per side. */
export function buildTerrainGeometry(world, cx, cz, grid) {
  const n = grid + 1;
  const step = CHUNK / grid;
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
  const uvs = new Float32Array(n * n * 2);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      const x = x0 + i * step;
      const z = z0 + j * step;
      const h = heights[k];
      positions[k * 3] = x;
      positions[k * 3 + 1] = h;
      positions[k * 3 + 2] = z;
      uvs[k * 2] = x / DETAIL_TILE;
      uvs[k * 2 + 1] = z / DETAIL_TILE;

      const { a, b, t } = world.biomeAt(x, z);
      mixRgb(grassA, a.grass, b.grass, t);
      mixRgb(grassB, a.grass2, b.grass2, t);
      mixRgb(soil, a.soil, b.soil, t);
      mixRgb(rock, a.rock, b.rock, t);
      mixRgb(peak, a.peak, b.peak, t);

      const patch = 0.5 + 0.5 * world.detailNoise(x * 0.018, z * 0.018);
      mixRgb(color, grassA, grassB, patch);

      // slope from neighbouring heights → soil, then bare rock on cliffs
      const hx = heights[j * n + Math.min(i + 1, n - 1)] - heights[j * n + Math.max(i - 1, 0)];
      const hz = heights[Math.min(j + 1, n - 1) * n + i] - heights[Math.max(j - 1, 0) * n + i];
      const slope = Math.hypot(hx, hz) / (2 * step);
      mixRgb(color, color, soil, smoothstep(0.3, 0.6, slope) * 0.8);
      mixRgb(color, color, rock, smoothstep(0.55, 0.95, slope) * 0.9);
      // high ground turns to rock, the very tops to snow / light peaks
      const alt = h + world.detailNoise(x * 0.01, z * 0.01 + 50) * 6;
      mixRgb(color, color, rock, smoothstep(34, 46, alt) * 0.6);
      mixRgb(color, color, peak, smoothstep(48, 58, alt) * (1 - smoothstep(0.9, 1.3, slope)));
      // worn verge next to the road
      mixRgb(color, color, soil, (1 - smoothstep(6.5, 10, roadDist[k])) * 0.55);

      const shade = 0.93 + 0.14 * world.detailNoise(x * 0.11 + 40, z * 0.11);
      colors[k * 3] = color[0] * shade;
      colors[k * 3 + 1] = color[1] * shade;
      colors[k * 3 + 2] = color[2] * shade;
    }
  }

  const indices = [];
  for (let j = 0; j < grid; j++) {
    for (let i = 0; i < grid; i++) {
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
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
