/**
 * Scenery: low-poly trees, rocks, bushes, cacti and flowers, merged into one
 * mesh per terrain chunk. Placement is seeded per chunk (same seed → same
 * forest) and keeps a clear strip either side of the road.
 */
import * as THREE from 'three';
import { GeoBuilder, makePart } from './geo';
import { biomeAt, pickWeighted, rgb } from './biomes';
import { mulberry32, hashInts } from './rng';
import { CHUNK } from './terrain';

const TRUNK = rgb(0x6b4a2f);
const WHITE = rgb(0xf4f8fb);
const CACTUS = rgb(0x4f8a45);
const ROCK = rgb(0x8d8a86);
const FLOWERS = [rgb(0xfff4e6), rgb(0xffd23f), rgb(0xff8fab), rgb(0xb8a1ff)];

const trunk = (height, radius = 0.22) =>
  makePart(new THREE.CylinderGeometry(radius * 0.75, radius, height, 5), TRUNK, { y: height / 2 });
const cone = (radius, height, y, colorOrTint) =>
  typeof colorOrTint === 'boolean'
    ? makePart(new THREE.ConeGeometry(radius, height, 7), null, { tint: true, y })
    : makePart(new THREE.ConeGeometry(radius, height, 7), colorOrTint, { y });

/** Each kind: prototype parts + collision radius (0 = drive-through). */
const KINDS = {
  roundTree: {
    parts: [trunk(1.8), makePart(new THREE.IcosahedronGeometry(1.7, 0), null, { tint: true, y: 3.1, sy: 1.1 })],
    radius: 0.5,
  },
  pine: {
    parts: [trunk(1.2, 0.2), cone(1.7, 2.8, 2.3, true), cone(1.3, 2.4, 3.7, true), cone(0.85, 2, 5, true)],
    radius: 0.5,
  },
  snowPine: {
    parts: [
      trunk(1.2, 0.2),
      cone(1.7, 2.8, 2.3, true), cone(1.05, 1.2, 3.05, WHITE),
      cone(1.3, 2.4, 3.7, true), cone(0.8, 1.05, 4.35, WHITE),
      cone(0.85, 2, 5, true), cone(0.55, 0.9, 5.6, WHITE),
    ],
    radius: 0.5,
  },
  bush: {
    parts: [makePart(new THREE.IcosahedronGeometry(0.95, 0), null, { tint: true, y: 0.45, sy: 0.7 })],
    radius: 0,
  },
  rock: {
    parts: [makePart(new THREE.DodecahedronGeometry(1, 0), ROCK, { y: 0.3, sy: 0.7 })],
    radius: 0.85,
  },
  cactus: {
    parts: [
      makePart(new THREE.CylinderGeometry(0.28, 0.32, 3.2, 6), CACTUS, { y: 1.6 }),
      makePart(new THREE.CylinderGeometry(0.18, 0.18, 1.1, 6), CACTUS, { x: 0.62, y: 2.1 }),
      makePart(new THREE.CylinderGeometry(0.16, 0.16, 0.6, 6), CACTUS, { x: 0.36, y: 1.6, sy: 1 }),
      makePart(new THREE.CylinderGeometry(0.18, 0.18, 0.9, 6), CACTUS, { x: -0.55, y: 2.5 }),
    ],
    radius: 0.45,
  },
  flower: {
    parts: [
      makePart(new THREE.OctahedronGeometry(0.16, 0), null, { tint: true, x: 0, y: 0.25 }),
      makePart(new THREE.OctahedronGeometry(0.14, 0), null, { tint: true, x: 0.5, y: 0.2, z: 0.3 }),
      makePart(new THREE.OctahedronGeometry(0.15, 0), null, { tint: true, x: -0.35, y: 0.22, z: 0.45 }),
      makePart(new THREE.OctahedronGeometry(0.12, 0), null, { tint: true, x: 0.2, y: 0.2, z: -0.45 }),
    ],
    radius: 0,
  },
};

const SPACING = 7;
const ROAD_CLEARANCE = 12;
const roadQuery = {};

/**
 * Builds scenery for chunk (cx, cz). `density` (0–1.2) scales how much grows,
 * from the adaptive-quality setting. Returns { geometry, obstacles }.
 */
export function buildSceneryGeometry(world, cx, cz, density) {
  const rand = mulberry32(hashInts(world.seed, cx, cz, 911));
  const builder = new GeoBuilder();
  const obstacles = [];
  const cells = CHUNK / SPACING;

  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      const x = cx * CHUNK + (i + rand()) * SPACING;
      const z = cz * CHUNK + (j + rand()) * SPACING;
      const roll = rand();
      const kindRoll = rand();
      const variety = rand();
      const spin = rand() * Math.PI * 2;

      const { a, b, t } = biomeAt(world.road.along(x, z));
      const biome = variety < t ? b : a;
      const clump = 0.35 + 0.65 * (0.5 + 0.5 * world.detailNoise(x * 0.012 + 7, z * 0.012));
      if (roll > biome.density * clump * density) continue;
      if (world.road.nearest(x, z, ROAD_CLEARANCE, roadQuery)) continue;

      const kind = pickWeighted(biome.flora, kindRoll);
      const spec = KINDS[kind];
      const scale = 0.75 + rand() * 0.6;
      const tint = kind === 'flower'
        ? FLOWERS[Math.floor(rand() * FLOWERS.length)]
        : biome.treeColors[Math.floor(rand() * biome.treeColors.length)];
      const y = world.visualHeight(x, z) - 0.15;
      const jitter = (rand() - 0.5) * 0.18;

      if (kind === 'rock') {
        const sx = scale * (0.8 + rand() * 1.1);
        builder.add(spec.parts, x, y, z, spin, sx, scale * (0.6 + rand() * 0.8), scale * (0.8 + rand()), null, jitter);
        obstacles.push({ x, z, r: spec.radius * sx });
      } else {
        builder.add(spec.parts, x, y, z, spin, scale, scale, scale, tint, jitter);
        if (spec.radius) obstacles.push({ x, z, r: spec.radius * scale });
      }
    }
  }
  return { geometry: builder.vertexCount ? builder.build() : null, obstacles };
}
