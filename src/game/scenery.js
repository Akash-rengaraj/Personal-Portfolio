/**
 * Scenery: trees, bushes, rocks, flowers, crops, desert plants, ground cover,
 * buildings and wind turbines, merged into one mesh per scenery tile (a quarter
 * of a terrain chunk). Two levels of detail: tiles near the car get rounded,
 * lumpy canopies with shading and extra ground cover; distant tiles get light
 * versions of the same objects in exactly the same places (placement is seeded
 * per 6 m cell, so it never depends on the detail level).
 *
 * Trees, cacti and hay bales can be knocked down: each one records its vertex
 * range in the merged mesh and its mass / breaking speed, so the world can cut
 * it out and hand it to the debris physics.
 */
import * as THREE from 'three';
import { GeoBuilder, makePart } from './geo';
import { pickWeighted, rgb } from './biomes';
import { mulberry32, hashInts } from './rng';
import { CHUNK } from './terrain';
import { buildingSpec, TURBINE_PARTS, TURBINE_HEIGHT } from './buildings';

const TRUNK = rgb(0x6b4a2f);
const TRUNK_DARK = rgb(0x4e3522);
const BIRCH_BARK = rgb(0xece9e0);
const BIRCH_MARK = rgb(0x2b2b2b);
const WHITE = rgb(0xf4f8fb);
const CACTUS = rgb(0x4f8a45);
const CACTUS_DARK = rgb(0x3f7438);
const ROCK = rgb(0x8d8a86);
const SANDSTONE = [rgb(0xc9855a), rgb(0xb8704a), rgb(0xd69a6a)];
const STEM = rgb(0x4d7a2c);
const SEED = rgb(0x5a3a1a);
const HAY = rgb(0xd9b35c);
const HAY_END = rgb(0xc9a24e);
const DRY = rgb(0x8a6a44);
const PINE_UNDER = rgb(0x39573f);
const MUSHROOM_CAP = rgb(0xc0392b);
const MUSHROOM_STEM = rgb(0xf1e7d6);
const FERN = rgb(0x4a7f35);

export const TILE = CHUNK / 2; // scenery is built per quarter chunk
const SPACING = 6;
const CELLS = TILE / SPACING;
const ROAD_CLEARANCE = 12;

/* ─── prototype helpers ─────────────────────────────────── */

/** Near-detail canopy lobe: rounded, lumpy, darker underneath. */
const lobe = (r, x, y, z, { shade = [0.58, 1.12], seed = 0, tint = true, ...opts } = {}) =>
  makePart(new THREE.IcosahedronGeometry(r, 1), null, { tint, x, y, z, smooth: true, lumps: 0.17, shade, mottle: 0.09, seed, ...opts });
/** Far-detail canopy lobe: a plain faceted blob with the same shading gradient. */
const lobeFar = (r, x, y, z, { shade = [0.66, 1.08], tint = true, ...opts } = {}) =>
  makePart(new THREE.IcosahedronGeometry(r, 0), null, { tint, x, y, z, shade, ...opts });
const bark = (h, r, color = TRUNK, opts = {}) =>
  makePart(new THREE.CylinderGeometry(r * 0.6, r, h, 7, 2, true), color, { y: h / 2, smooth: true, lumps: 0.04, shade: [0.5, 1], mottle: 0.12, ...opts });
const barkFar = (h, r, color) => makePart(new THREE.CylinderGeometry(r * 0.6, r, h, 5, 1, true), color, { y: h / 2, shade: [0.55, 1] });
const limb = (len, r, x, y, z, rz, rx = 0, color = TRUNK_DARK) =>
  makePart(new THREE.CylinderGeometry(r * 0.45, r, len, 5, 1, true), color, { x, y, z, rz, rx, smooth: true, shade: [0.65, 1] });
/** Pine tier: an open cone with a lumpy (branchy) rim and a shadowed underside disc. */
const tier = (r, h, y, seed) => [
  makePart(new THREE.ConeGeometry(r, h, 11, 2, true), null, { tint: true, y, smooth: true, lumps: 0.09, seed, shade: [0.45, 1.08], mottle: 0.1 }),
  makePart(new THREE.CircleGeometry(r * 0.92, 11), PINE_UNDER, { rx: Math.PI / 2, y: y - h / 2 + 0.08 }),
];
/** Snow lying on a pine tier: a low lumpy cap (its underside is hidden inside the tier). */
const snowCap = (r, h, y, seed) =>
  [makePart(new THREE.ConeGeometry(r, h, 9, 1, true), WHITE, { y, smooth: true, lumps: 0.1, seed, shade: [0.8, 1.05] })];
const tierFar = (r, h, y, color = null) => makePart(new THREE.ConeGeometry(r, h, 7), color, { tint: !color, y, shade: [0.5, 1.05] });

/* ─── object kinds ──────────────────────────────────────── */

/**
 * Each kind: near / far prototype parts, collision radius (0 = drive-through),
 * placement flags, and `breaks` (mass kg at scale 1, breaking speed m/s, material)
 * for things that can be knocked down.
 */
const KINDS = {
  oak: {
    near: [
      bark(2.4, 0.32, TRUNK_DARK),
      limb(1.6, 0.14, 0.55, 2.5, 0.1, -0.75),
      limb(1.4, 0.12, -0.5, 2.6, -0.2, 0.7, 0.3),
      lobe(1.75, 0, 3.8, 0, { sy: 0.85, shade: [0.55, 1.1], seed: 1 }),
      lobe(1.3, 1.35, 3.3, 0.35, { sy: 0.8, shade: [0.5, 1.02], seed: 2 }),
      lobe(1.25, -1.15, 3.4, -0.45, { sy: 0.85, shade: [0.5, 1.02], seed: 3 }),
      lobe(1.1, 0.25, 4.7, -0.7, { sy: 0.8, shade: [0.7, 1.18], seed: 4 }),
    ],
    far: [barkFar(2.4, 0.32, TRUNK_DARK), lobeFar(1.9, 0, 3.8, 0, { sy: 0.85 }), lobeFar(1.3, 1.2, 3.3, 0.3, { sy: 0.8 })],
    radius: 0.55,
    breaks: { mass: 900, speed: 11, material: 'wood', leaves: true },
  },
  roundTree: {
    near: [
      bark(1.9, 0.26),
      lobe(1.6, 0, 3.2, 0, { sy: 1.05, seed: 5 }),
      lobe(1.0, 0.9, 2.8, 0.5, { shade: [0.5, 1], seed: 6 }),
      lobe(0.95, -0.7, 3.9, -0.4, { shade: [0.7, 1.15], seed: 7 }),
    ],
    far: [barkFar(1.9, 0.26, TRUNK), lobeFar(1.75, 0, 3.2, 0, { sy: 1.1 })],
    radius: 0.5,
    breaks: { mass: 600, speed: 9, material: 'wood', leaves: true },
  },
  poplar: {
    near: [
      bark(1.6, 0.2),
      lobe(1.05, 0, 2.6, 0, { sy: 1.5, shade: [0.5, 0.95], seed: 8 }),
      lobe(0.95, 0.1, 4.0, 0.1, { sy: 1.6, shade: [0.65, 1.08], seed: 9 }),
      lobe(0.7, -0.05, 5.4, 0, { sy: 1.5, shade: [0.8, 1.2], seed: 10 }),
    ],
    far: [barkFar(1.6, 0.2, TRUNK), lobeFar(1.1, 0, 3.9, 0, { sy: 2.4 })],
    radius: 0.4,
    breaks: { mass: 450, speed: 8, material: 'wood', leaves: true },
  },
  pine: {
    near: [
      bark(1.6, 0.22),
      ...tier(1.95, 2.4, 2.1, 11), ...tier(1.62, 2.2, 3.1, 12), ...tier(1.3, 2.0, 4.1, 13),
      ...tier(0.98, 1.8, 5.0, 14), ...tier(0.66, 1.5, 5.85, 15), ...tier(0.36, 1.2, 6.6, 16),
    ],
    far: [barkFar(1.4, 0.22, TRUNK), tierFar(1.9, 2.8, 2.3), tierFar(1.35, 2.4, 3.8), tierFar(0.8, 2.0, 5.2)],
    radius: 0.5,
    breaks: { mass: 650, speed: 9, material: 'wood', leaves: true },
  },
  snowPine: {
    near: [
      bark(1.6, 0.22),
      ...tier(1.95, 2.4, 2.1, 17), ...snowCap(1.24, 0.9, 2.75, 18),
      ...tier(1.62, 2.2, 3.1, 19), ...snowCap(1.0, 0.85, 3.7, 20),
      ...tier(1.3, 2.0, 4.1, 21), ...snowCap(0.8, 0.8, 4.65, 22),
      ...tier(0.98, 1.8, 5.0, 23), ...snowCap(0.58, 0.75, 5.5, 24),
      ...tier(0.66, 1.5, 5.85, 25), ...snowCap(0.4, 1.1, 6.45, 26),
    ],
    far: [
      barkFar(1.4, 0.22, TRUNK), tierFar(1.9, 2.8, 2.3), tierFar(1.15, 1.0, 3.2, WHITE),
      tierFar(1.35, 2.4, 3.8), tierFar(0.8, 0.9, 4.6, WHITE), tierFar(0.8, 2.0, 5.2), tierFar(0.5, 1.2, 6.0, WHITE),
    ],
    radius: 0.5,
    breaks: { mass: 700, speed: 9, material: 'wood', leaves: true },
  },
  birch: {
    near: [
      makePart(new THREE.CylinderGeometry(0.1, 0.16, 4.4, 7, 2, true), BIRCH_BARK, { y: 2.2, smooth: true, shade: [0.7, 1.05], mottle: 0.06 }),
      ...[0.8, 1.5, 2.3, 3.1].map((y, k) => makePart(new THREE.CylinderGeometry(0.155 - y * 0.012, 0.16 - y * 0.012, 0.07 + (k % 2) * 0.05, 7, 1, true), BIRCH_MARK, { y, smooth: true })),
      limb(1.0, 0.05, 0.35, 3.2, 0, -0.8, 0, BIRCH_BARK),
      limb(0.9, 0.05, -0.3, 3.5, 0.1, 0.8, 0, BIRCH_BARK),
      lobe(0.85, 0, 4.4, 0, { tint: 'alt', sy: 1.4, seed: 27 }),
      lobe(0.7, 0.6, 3.8, 0.1, { tint: 'alt', sy: 1.25, shade: [0.5, 1], seed: 28 }),
      lobe(0.65, -0.55, 3.6, 0.3, { tint: 'alt', sy: 1.25, shade: [0.5, 1], seed: 29 }),
      lobe(0.55, 0.1, 5.2, -0.2, { tint: 'alt', sy: 1.2, shade: [0.75, 1.2], seed: 30 }),
    ],
    far: [
      makePart(new THREE.CylinderGeometry(0.12, 0.16, 4.2, 5, 1, true), BIRCH_BARK, { y: 2.1 }),
      lobeFar(0.95, 0, 4.3, 0, { tint: 'alt', sy: 1.5 }),
      lobeFar(0.7, 0.5, 3.7, 0, { tint: 'alt', sy: 1.3 }),
    ],
    radius: 0.35,
    breaks: { mass: 300, speed: 6, material: 'wood', leaves: true },
  },
  blossom: {
    near: [
      bark(1.7, 0.24, TRUNK_DARK),
      limb(1.3, 0.1, -0.45, 2.1, 0, 0.6),
      limb(1.2, 0.09, 0.45, 2.2, 0.2, -0.65),
      lobe(1.45, 0, 3.0, 0, { sy: 0.8, seed: 31, mottle: 0.16 }),
      lobe(1.1, 1.1, 2.7, 0.4, { sy: 0.75, shade: [0.55, 1.05], seed: 32, mottle: 0.16 }),
      lobe(1.05, -1.05, 2.9, -0.3, { sy: 0.75, shade: [0.55, 1.05], seed: 33, mottle: 0.16 }),
      lobe(0.85, 0.2, 3.75, -0.7, { sy: 0.8, shade: [0.7, 1.15], seed: 34, mottle: 0.16 }),
    ],
    far: [barkFar(1.7, 0.24, TRUNK_DARK), lobeFar(1.6, 0, 3.0, 0, { sy: 0.8 }), lobeFar(1.0, -1.0, 2.8, -0.3, { sy: 0.75 })],
    radius: 0.45,
    breaks: { mass: 500, speed: 8, material: 'wood', leaves: true },
  },
  bush: {
    near: [
      lobe(0.9, 0, 0.45, 0, { sy: 0.72, shade: [0.45, 1.05], seed: 35 }),
      lobe(0.6, 0.62, 0.35, 0.3, { sy: 0.7, shade: [0.45, 1.0], seed: 36 }),
      lobe(0.55, -0.5, 0.32, -0.35, { sy: 0.7, shade: [0.45, 1.0], seed: 37 }),
    ],
    far: [lobeFar(0.95, 0, 0.45, 0, { sy: 0.7 })],
    radius: 0,
  },
  tuft: {
    near: [
      makePart(new THREE.ConeGeometry(0.09, 0.9, 3), null, { tint: 'alt', y: 0.44, shade: [0.6, 1.15] }),
      makePart(new THREE.ConeGeometry(0.08, 0.75, 3), null, { tint: 'alt', x: 0.18, y: 0.35, rz: -0.35, shade: [0.6, 1.15] }),
      makePart(new THREE.ConeGeometry(0.08, 0.7, 3), null, { tint: 'alt', x: -0.16, y: 0.33, z: 0.06, rz: 0.4, shade: [0.6, 1.15] }),
      makePart(new THREE.ConeGeometry(0.08, 0.65, 3), null, { tint: 'alt', z: 0.18, y: 0.3, rx: 0.4, shade: [0.6, 1.15] }),
      makePart(new THREE.ConeGeometry(0.07, 0.6, 3), null, { tint: 'alt', z: -0.16, y: 0.28, rx: -0.45, shade: [0.6, 1.15] }),
    ],
    radius: 0,
    small: true,
  },
  flowers: {
    near: [
      makePart(new THREE.OctahedronGeometry(0.16, 0), null, { tint: true, x: 0, y: 0.25 }),
      makePart(new THREE.OctahedronGeometry(0.14, 0), null, { tint: true, x: 0.5, y: 0.2, z: 0.3 }),
      makePart(new THREE.OctahedronGeometry(0.15, 0), null, { tint: true, x: -0.35, y: 0.22, z: 0.45 }),
      makePart(new THREE.OctahedronGeometry(0.12, 0), null, { tint: true, x: 0.2, y: 0.2, z: -0.45 }),
    ],
    radius: 0,
    small: true,
  },
  tulips: {
    near: [-0.5, -0.1, 0.3, 0.7].flatMap((x, k) => [
      makePart(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 3), STEM, { x, z: (k % 2) * 0.35, y: 0.22 }),
      makePart(new THREE.CylinderGeometry(0.09, 0.05, 0.16, 5), null, { tint: true, x, z: (k % 2) * 0.35, y: 0.5 }),
    ]),
    radius: 0,
    small: true,
  },
  sunflowers: {
    near: [-0.45, 0.1, 0.55].flatMap((x, k) => [
      makePart(new THREE.CylinderGeometry(0.035, 0.045, 1.5, 4), STEM, { x, z: k * 0.25, y: 0.75 }),
      makePart(new THREE.CylinderGeometry(0.26, 0.26, 0.05, 8), null, { tint: true, x, z: k * 0.25 + 0.05, y: 1.55, rx: 1.2 }),
      makePart(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 8), SEED, { x, z: k * 0.25 + 0.08, y: 1.56, rx: 1.2 }),
    ]),
    radius: 0,
    small: true,
  },
  hay: {
    near: [
      makePart(new THREE.CylinderGeometry(0.75, 0.75, 1.2, 14, 1, true), HAY, { y: 0.75, rz: Math.PI / 2, smooth: true, mottle: 0.1, shade: [0.65, 1.05] }),
      makePart(new THREE.CircleGeometry(0.75, 14), HAY_END, { x: 0.6, y: 0.75, ry: Math.PI / 2, mottle: 0.1 }),
      makePart(new THREE.CircleGeometry(0.75, 14), HAY_END, { x: -0.6, y: 0.75, ry: -Math.PI / 2, mottle: 0.1 }),
    ],
    far: [makePart(new THREE.CylinderGeometry(0.75, 0.75, 1.2, 8), HAY, { y: 0.75, rz: Math.PI / 2, shade: [0.7, 1.05] })],
    radius: 0.8,
    breaks: { mass: 250, speed: 2.5, material: 'hay', free: true },
  },
  rock: {
    near: [makePart(new THREE.DodecahedronGeometry(1, 1), ROCK, { y: 0.3, sy: 0.7, lumps: 0.16, mottle: 0.14, shade: [0.6, 1.08], seed: 38 })],
    far: [makePart(new THREE.DodecahedronGeometry(1, 0), ROCK, { y: 0.3, sy: 0.7, shade: [0.65, 1.05] })],
    radius: 0.85,
    rock: true,
  },
  snowRock: {
    near: [
      makePart(new THREE.DodecahedronGeometry(1, 1), ROCK, { y: 0.3, sy: 0.7, lumps: 0.16, mottle: 0.14, shade: [0.55, 1.0], seed: 39 }),
      makePart(new THREE.DodecahedronGeometry(0.85, 1), WHITE, { y: 0.62, sy: 0.35, lumps: 0.1, shade: [0.85, 1.05], seed: 40 }),
    ],
    far: [
      makePart(new THREE.DodecahedronGeometry(1, 0), ROCK, { y: 0.3, sy: 0.7 }),
      makePart(new THREE.DodecahedronGeometry(0.85, 0), WHITE, { y: 0.62, sy: 0.35 }),
    ],
    radius: 0.85,
    rock: true,
  },
  cactus: {
    near: [
      makePart(new THREE.CylinderGeometry(0.28, 0.33, 3.4, 12, 3, true), CACTUS, { y: 1.7, smooth: true, shade: [0.6, 1.05], mottle: 0.05 }),
      makePart(new THREE.SphereGeometry(0.28, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2), CACTUS, { y: 3.4, smooth: true, shade: [0.95, 1.1] }),
      makePart(new THREE.CylinderGeometry(0.17, 0.17, 0.62, 8, 1, true), CACTUS_DARK, { x: 0.42, y: 1.55, rz: Math.PI / 2, smooth: true }),
      makePart(new THREE.SphereGeometry(0.18, 8, 6), CACTUS, { x: 0.68, y: 1.55, smooth: true }),
      makePart(new THREE.CylinderGeometry(0.17, 0.18, 1.2, 8, 1, true), CACTUS, { x: 0.68, y: 2.15, smooth: true, shade: [0.7, 1.05] }),
      makePart(new THREE.SphereGeometry(0.17, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), CACTUS, { x: 0.68, y: 2.75, smooth: true }),
      makePart(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 8, 1, true), CACTUS_DARK, { x: -0.36, y: 2.2, rz: Math.PI / 2, smooth: true }),
      makePart(new THREE.SphereGeometry(0.16, 8, 6), CACTUS, { x: -0.58, y: 2.2, smooth: true }),
      makePart(new THREE.CylinderGeometry(0.16, 0.17, 0.95, 8, 1, true), CACTUS, { x: -0.58, y: 2.68, smooth: true, shade: [0.7, 1.05] }),
      makePart(new THREE.SphereGeometry(0.16, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), CACTUS, { x: -0.58, y: 3.15, smooth: true }),
    ],
    far: [
      makePart(new THREE.CylinderGeometry(0.28, 0.32, 3.4, 6), CACTUS, { y: 1.7, shade: [0.65, 1.05] }),
      makePart(new THREE.CylinderGeometry(0.18, 0.18, 1.2, 5), CACTUS, { x: 0.68, y: 2.1 }),
    ],
    radius: 0.45,
    breaks: { mass: 220, speed: 4, material: 'plant' },
  },
  barrel: {
    near: [makePart(new THREE.SphereGeometry(0.42, 10, 8), CACTUS, { y: 0.32, sy: 0.85, smooth: true, shade: [0.6, 1.08], mottle: 0.08 })],
    far: [makePart(new THREE.SphereGeometry(0.42, 6, 4), CACTUS, { y: 0.32, sy: 0.85 })],
    radius: 0,
  },
  deadBush: {
    near: [-0.6, -0.2, 0.25, 0.6].map((rz, k) =>
      makePart(new THREE.CylinderGeometry(0.02, 0.04, 0.9, 3), DRY, { x: rz * 0.3, y: 0.4, z: (k - 1.5) * 0.12, rz })),
    radius: 0,
    small: true,
  },
  mesa: {
    near: [
      makePart(new THREE.CylinderGeometry(5.5, 7, 4, 9, 2), SANDSTONE[0], { y: 1.5, lumps: 0.03, mottle: 0.08, shade: [0.7, 1] }),
      makePart(new THREE.CylinderGeometry(4.6, 5.3, 3.2, 9, 2), SANDSTONE[1], { y: 5.0, ry: 0.4, lumps: 0.03, mottle: 0.08, shade: [0.72, 1] }),
      makePart(new THREE.CylinderGeometry(3.4, 4.3, 2.6, 9, 2), SANDSTONE[2], { y: 7.8, ry: 0.9, lumps: 0.03, mottle: 0.08, shade: [0.75, 1.05] }),
    ],
    far: [
      makePart(new THREE.CylinderGeometry(5.5, 7, 4, 7), SANDSTONE[0], { y: 1.5, shade: [0.7, 1] }),
      makePart(new THREE.CylinderGeometry(4.6, 5.3, 3.2, 7), SANDSTONE[1], { y: 5.0, ry: 0.4, shade: [0.72, 1] }),
      makePart(new THREE.CylinderGeometry(3.4, 4.3, 2.6, 7), SANDSTONE[2], { y: 7.8, ry: 0.9, shade: [0.75, 1.05] }),
    ],
    radius: 6,
    clearance: 26,
  },
};

/** Ground cover that only near tiles get: small things you notice as you drive past. */
const COVER = {
  pebbles: [0, 1, 2].map(k => makePart(new THREE.DodecahedronGeometry(0.14 + k * 0.05, 0), ROCK, {
    x: [0, 0.35, -0.3][k], y: 0.02, z: [0, 0.2, 0.28][k], sy: 0.6, shade: [0.6, 1.1], mottle: 0.15, seed: 41 + k,
  })),
  fern: [0, 1, 2, 3, 4, 5].map(k => makePart(new THREE.ConeGeometry(0.12, 0.95, 3), FERN, {
    x: Math.cos(k * 1.05) * 0.2, z: Math.sin(k * 1.05) * 0.2, y: 0.32, rx: Math.sin(k * 1.05) * 0.85, rz: -Math.cos(k * 1.05) * 0.85, sz: 0.35, shade: [0.55, 1.15],
  })),
  log: [
    makePart(new THREE.CylinderGeometry(0.22, 0.26, 3.2, 8, 1, true), TRUNK_DARK, { y: 0.2, rz: Math.PI / 2, smooth: true, mottle: 0.15, shade: [0.55, 1] }),
    makePart(new THREE.CircleGeometry(0.22, 8), rgb(0xb89060), { x: 1.6, y: 0.2, ry: Math.PI / 2 }),
    makePart(new THREE.CylinderGeometry(0.05, 0.08, 0.7, 5), TRUNK_DARK, { x: -0.5, y: 0.45, rz: 0.5 }),
  ],
  mushrooms: [0, 1, 2].flatMap(k => [
    makePart(new THREE.CylinderGeometry(0.03, 0.04, 0.16, 5), MUSHROOM_STEM, { x: k * 0.18 - 0.18, z: (k % 2) * 0.15, y: 0.08 }),
    makePart(new THREE.SphereGeometry(0.09 - k * 0.012, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), MUSHROOM_CAP, { x: k * 0.18 - 0.18, z: (k % 2) * 0.15, y: 0.15, smooth: true, mottle: 0.2 }),
  ]),
  snowMound: [makePart(new THREE.SphereGeometry(0.6, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), WHITE, { sy: 0.35, smooth: true, shade: [0.85, 1.05] })],
  sandRipple: [makePart(new THREE.SphereGeometry(0.9, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), rgb(0xdcae72), { sy: 0.18, sx: 1.6, smooth: true, shade: [0.8, 1.05] })],
};
const COVER_BY_BIOME = {
  normal: [['pebbles', 3], ['fern', 2], ['log', 0.4]],
  spring: [['pebbles', 2], ['fern', 2], ['log', 0.3]],
  summer: [['pebbles', 3], ['log', 0.3]],
  autumn: [['mushrooms', 2], ['fern', 2], ['log', 0.8], ['pebbles', 2]],
  desert: [['pebbles', 4], ['sandRipple', 2]],
  snow: [['snowMound', 3], ['pebbles', 1], ['log', 0.3]],
};

const roadQuery = {};

/** Buildings from this chunk and its neighbours whose footprint could reach into the tile. */
function nearbyFootprints(world, cx, cz) {
  const list = [];
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const f = world.featuresFor(cx + dx, cz + dz);
      for (const b of f.buildings) list.push(b);
    }
  }
  return list;
}

const insideFootprint = (list, x, z, margin) =>
  list.some(b => Math.hypot(b.x - x, b.z - z) < Math.hypot(b.w, b.d) / 2 + margin);

/**
 * Builds scenery tile `q` (0–3) of terrain chunk (cx, cz) at level of detail `lod`
 * ('near' | 'far'). `density` (0–1.2) comes from the quality setting. Small plants (tufts,
 * flowers) only grow in near tiles, and ground cover (ferns, logs, pebbles…) only where the
 * tier asks for it (world.quality.groundCover). Broken objects (ids in world.broken) are
 * left out. Returns { geometry, glow, obstacles, rotors }.
 */
export function buildSceneryGeometry(world, cx, cz, q, density, lod) {
  const near = lod === 'near';
  const builder = new GeoBuilder();
  const glow = new GeoBuilder();
  const obstacles = [];
  const rotors = [];
  const cover = near && Boolean(world.quality?.groundCover);
  const qx = q % 2;
  const qz = Math.floor(q / 2);
  const tileX = cx * CHUNK + qx * TILE;
  const tileZ = cz * CHUNK + qz * TILE;
  const footprints = nearbyFootprints(world, cx, cz);

  // buildings and turbines that stand in this tile
  const features = world.featuresFor(cx, cz);
  for (const b of features.buildings) {
    if (Math.floor((b.x - cx * CHUNK) / TILE) !== qx || Math.floor((b.z - cz * CHUNK) / TILE) !== qz) continue;
    const spec = buildingSpec(b.kind);
    builder.add(spec.parts, b.x, b.y, b.z, b.rot, 1, 1, 1, b.roof, 0, b.wall);
    glow.add(spec.glow, b.x, b.y, b.z, b.rot);
    // footprint as a row of circles along its long side
    const n = Math.max(1, Math.round(spec.w / spec.d));
    const r = spec.d / 2;
    for (let k = 0; k < n; k++) {
      const off = (k - (n - 1) / 2) * (spec.w / n);
      obstacles.push({ x: b.x + Math.cos(b.rot) * off, z: b.z - Math.sin(b.rot) * off, r: Math.max(r, spec.w / (2 * n)) });
    }
  }
  for (const t of features.turbines) {
    if (Math.floor((t.x - cx * CHUNK) / TILE) !== qx || Math.floor((t.z - cz * CHUNK) / TILE) !== qz) continue;
    builder.add(TURBINE_PARTS, t.x, t.y, t.z, t.yaw);
    obstacles.push({ x: t.x, z: t.z, r: 2 });
    rotors.push({ x: t.x + Math.sin(t.yaw) * 1.9, y: t.y + TURBINE_HEIGHT + 1.1, z: t.z + Math.cos(t.yaw) * 1.9, yaw: t.yaw });
  }

  const gi0 = Math.round(tileX / SPACING);
  const gj0 = Math.round(tileZ / SPACING);
  for (let j = 0; j < CELLS; j++) {
    for (let i = 0; i < CELLS; i++) {
      const gi = gi0 + i;
      const gj = gj0 + j;
      // seeded per cell: the same tree stands in the same spot at every level of detail
      const rand = mulberry32(hashInts(world.seed, gi, gj, 911));
      const x = (gi + rand()) * SPACING;
      const z = (gj + rand()) * SPACING;
      const roll = rand();
      const kindRoll = rand();
      const variety = rand();
      const spin = rand() * Math.PI * 2;
      const pick = rand();
      const jitter = (rand() - 0.5) * 0.2;
      const scale = 0.75 + rand() * 0.6;
      const extraA = rand();
      const extraB = rand();

      const blend = world.biomeAt(x, z);
      const biome = variety < blend.t ? blend.b : blend.a;

      // near tiles: a sprinkle of ground cover (its own random stream, so trees don't move)
      if (cover) {
        const cover = COVER_BY_BIOME[biome.id];
        const crand = mulberry32(hashInts(world.seed, gi, gj, 913));
        if (cover && crand() < 0.3 * density) {
          const cxp = (gi + crand()) * SPACING;
          const czp = (gj + crand()) * SPACING;
          const kind = pickWeighted(cover, crand());
          if (!world.road.nearest(cxp, czp, 8, roadQuery) && !insideFootprint(footprints, cxp, czp, 1)) {
            const s = 0.7 + crand() * 0.7;
            builder.add(COVER[kind], cxp, world.visualHeight(cxp, czp) - 0.04, czp, crand() * Math.PI * 2, s, s, s, null, (crand() - 0.5) * 0.25);
          }
        }
      }

      const clump = 0.35 + 0.65 * (0.5 + 0.5 * world.detailNoise(x * 0.012 + 7, z * 0.012));
      if (roll > biome.density * clump * density) continue;

      const kind = pickWeighted(biome.flora, kindRoll);
      const spec = KINDS[kind];
      if (spec.small && !near) continue;
      if (world.road.nearest(x, z, spec.clearance ?? ROAD_CLEARANCE, roadQuery)) continue;
      if (insideFootprint(footprints, x, z, spec.clearance ? 8 : 2.5)) continue;
      const id = `t${gi}:${gj}`;
      if (world.broken.has(id)) continue;

      const parts = near || !spec.far ? spec.near : spec.far;
      const palette = kind === 'flowers' || kind === 'tulips' || kind === 'sunflowers' ? biome.flowerColors : biome.treeColors;
      const tint = palette[Math.floor(pick * palette.length)];
      biome.tuftColor ??= biome.grass.map(v => v * 0.7);
      const alt = kind === 'tuft'
        ? biome.tuftColor
        : (biome.birchColors ?? biome.treeColors)[Math.floor(pick * (biome.birchColors ?? biome.treeColors).length)];
      const y = world.visualHeight(x, z) - (spec.small ? 0.05 : 0.15);

      if (spec.rock) {
        const sx = scale * (0.8 + extraA * 1.1);
        builder.add(parts, x, y, z, spin, sx, scale * (0.6 + extraB * 0.8), scale * (0.8 + extraA), null, jitter);
        obstacles.push({ x, z, r: spec.radius * sx });
        continue;
      }
      const s = kind === 'mesa' ? 0.7 + extraA * 0.9 : scale;
      const range = builder.add(parts, x, y, z, spin, s, s, s, tint, jitter, alt);
      if (!spec.radius) continue;
      const obstacle = { x, z, r: spec.radius * s };
      if (spec.breaks) {
        Object.assign(obstacle, {
          id,
          kind,
          breakSpeed: spec.breaks.speed * (0.7 + 0.3 * s),
          mass: spec.breaks.mass * s * s * s,
          material: spec.breaks.material,
          rooted: !spec.breaks.free,
          leaves: spec.breaks.leaves ? (kind === 'birch' ? alt : tint) : null,
          base: [x, y, z],
          pieces: [{ target: 'main', range }],
        });
      }
      obstacles.push(obstacle);
    }
  }
  return {
    geometry: builder.vertexCount ? builder.build() : null,
    glow: glow.vertexCount ? glow.build() : null,
    obstacles,
    rotors,
  };
}
