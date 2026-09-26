/**
 * Terrains (biomes). In "mixed" mode they cycle along the road's travel
 * direction and blend over BLEND metres; a terrain can also be locked.
 * Each biome is a palette, a table of what grows there, surface grip, cloud
 * cover and the ambient particles that drift through the air.
 */
import { smoothstep } from './noise';

export const BIOME_LENGTH = 1500;
const BLEND = 260;

/** sRGB hex → linear [r, g, b], the space three.js expects for vertex colours. */
export const rgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map(v => (v / 255) ** 2.2);

export const BIOMES = [
  {
    id: 'normal',
    name: 'green hills',
    grass: rgb(0x7fb45a),
    grass2: rgb(0xa6cc6c),
    soil: rgb(0x9a8a5c),
    rock: rgb(0x8a8d86),
    peak: rgb(0xe9eef2),
    mountain: rgb(0x5d7c8f),
    density: 0.36,
    flora: [['oak', 4], ['roundTree', 2], ['pine', 2], ['poplar', 1.5], ['bush', 3], ['rock', 1], ['tuft', 6], ['flowers', 1.5]],
    treeColors: [rgb(0x4f9a3f), rgb(0x5fae45), rgb(0x3e8a3a), rgb(0x78b84a)],
    flowerColors: [rgb(0xfff4e6), rgb(0xffd23f)],
    roadGrip: 1,
    offroadGrip: 0.72,
    clouds: 0.46,
    particles: null,
  },
  {
    id: 'spring',
    name: 'spring blossom',
    grass: rgb(0x8fcf6a),
    grass2: rgb(0xb8e07e),
    soil: rgb(0x9c8a60),
    rock: rgb(0x9a9a92),
    peak: rgb(0xf2f4f6),
    mountain: rgb(0x6f8fa8),
    density: 0.4,
    flora: [['blossom', 5], ['birch', 2], ['roundTree', 1.5], ['bush', 2], ['tulips', 4], ['tuft', 5], ['rock', 0.6]],
    treeColors: [rgb(0xffb7cf), rgb(0xffc8dd), rgb(0xf8e1ea), rgb(0xff9fc0)],
    birchColors: [rgb(0x9fd46a), rgb(0xb5dc72)],
    flowerColors: [rgb(0xff5e7e), rgb(0xffd23f), rgb(0xfff4e6), rgb(0xb8a1ff), rgb(0xff8c42)],
    roadGrip: 1,
    offroadGrip: 0.72,
    clouds: 0.38,
    particles: { color: 0xffc0d6, size: 0.2, fall: 0.9, sway: 1.2, amount: 0.8 },
  },
  {
    id: 'summer',
    name: 'summer fields',
    grass: rgb(0x5f9e3a),
    grass2: rgb(0xc2b04a),
    soil: rgb(0xa08650),
    rock: rgb(0x8f8a80),
    peak: rgb(0xdfe6ea),
    mountain: rgb(0x557a7e),
    density: 0.34,
    flora: [['oak', 5], ['poplar', 3], ['sunflowers', 3], ['hay', 1], ['bush', 2], ['tuft', 6], ['rock', 0.6]],
    treeColors: [rgb(0x2f7a2c), rgb(0x3d8a33), rgb(0x2a6b2a), rgb(0x4a9a3a)],
    flowerColors: [rgb(0xffcf1f)],
    roadGrip: 1,
    offroadGrip: 0.75,
    clouds: 0.3,
    particles: { color: 0xfff6dc, size: 0.1, fall: 0.12, sway: 0.9, amount: 0.35 },
  },
  {
    id: 'autumn',
    name: 'autumn forest',
    grass: rgb(0xb59a4f),
    grass2: rgb(0xcfa54f),
    soil: rgb(0x8a6a44),
    rock: rgb(0x8d857c),
    peak: rgb(0xe8e4de),
    mountain: rgb(0x7a6f86),
    density: 0.46,
    flora: [['oak', 4], ['roundTree', 3], ['birch', 2], ['pine', 1.5], ['bush', 2], ['rock', 1], ['tuft', 3]],
    treeColors: [rgb(0xe8742c), rgb(0xd9452e), rgb(0xf2b134), rgb(0xc9562a), rgb(0x9c3b2a)],
    birchColors: [rgb(0xf2c230), rgb(0xe8a92a)],
    flowerColors: [rgb(0xd9452e)],
    roadGrip: 0.95,
    offroadGrip: 0.68,
    clouds: 0.55,
    particles: { color: 0xe07a2c, size: 0.24, fall: 1.1, sway: 1.6, amount: 0.7 },
  },
  {
    id: 'desert',
    name: 'desert dunes',
    grass: rgb(0xe2b77a),
    grass2: rgb(0xd89b62),
    soil: rgb(0xc4834f),
    rock: rgb(0xb8704a),
    peak: rgb(0xd9a070),
    mountain: rgb(0xb0735a),
    density: 0.12,
    flora: [['cactus', 4], ['barrel', 2], ['deadBush', 3], ['rock', 3], ['mesa', 0.35]],
    treeColors: [rgb(0x5c8a4a), rgb(0x6b9a52)],
    flowerColors: [rgb(0xff6f91)],
    roadGrip: 0.97,
    offroadGrip: 0.56,
    clouds: 0.14,
    particles: { color: 0xe6c79c, size: 0.08, fall: -0.15, sway: 3.2, amount: 0.6 },
  },
  {
    id: 'snow',
    name: 'snowy pines',
    grass: rgb(0xeef3f7),
    grass2: rgb(0xdbe6ef),
    soil: rgb(0xaab6c4),
    rock: rgb(0x7d8796),
    peak: rgb(0xffffff),
    mountain: rgb(0x8b9bb4),
    density: 0.42,
    flora: [['snowPine', 7], ['snowRock', 1.5], ['birch', 0.8]],
    treeColors: [rgb(0x2f5d4e), rgb(0x3a6b58), rgb(0x285446)],
    birchColors: [rgb(0xd8dfd0), rgb(0xc9d4c2)],
    flowerColors: [rgb(0xffffff)],
    roadGrip: 0.8,
    offroadGrip: 0.5,
    clouds: 0.62,
    particles: { color: 0xffffff, size: 0.15, fall: 2.2, sway: 0.3, amount: 1 },
  },
];

export const TERRAIN_OPTIONS = [
  { id: 'mixed', label: 'mixed' },
  ...BIOMES.map(b => ({ id: b.id, label: b.id })),
];

const LOCKED = new Map(BIOMES.map(b => [b.id, { a: b, b, t: 0 }]));

/**
 * Which biome(s) apply at a distance `p` along the travel direction.
 * Returns the current biome, the next one and how far we've blended into it.
 * `lock` pins one biome everywhere.
 */
export function biomeAt(p, lock = 'mixed') {
  if (lock !== 'mixed' && LOCKED.has(lock)) return LOCKED.get(lock);
  const n = BIOMES.length;
  const raw = p / BIOME_LENGTH;
  const index = Math.floor(raw);
  const within = (raw - index) * BIOME_LENGTH;
  const a = BIOMES[((index % n) + n) % n];
  const b = BIOMES[(((index + 1) % n) + n) % n];
  const t = smoothstep(BIOME_LENGTH - BLEND, BIOME_LENGTH, within);
  return { a, b, t };
}

/** Linear blend of two [r,g,b] colours into `out`. */
export function mixRgb(out, c1, c2, t) {
  out[0] = c1[0] + (c2[0] - c1[0]) * t;
  out[1] = c1[1] + (c2[1] - c1[1]) * t;
  out[2] = c1[2] + (c2[2] - c1[2]) * t;
  return out;
}

/** Weighted pick from a [[value, weight], …] table. */
export function pickWeighted(table, r) {
  const total = table.reduce((sum, [, w]) => sum + w, 0);
  let x = r * total;
  for (const [value, weight] of table) {
    x -= weight;
    if (x <= 0) return value;
  }
  return table[table.length - 1][0];
}

/** Blends a numeric biome property. */
export const blendValue = (blend, key) => blend.a[key] + (blend.b[key] - blend.a[key]) * blend.t;
