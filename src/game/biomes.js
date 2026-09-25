/**
 * Biomes cycle along the road's travel direction. Each one is a palette plus
 * a table of what grows there; neighbouring biomes blend over BLEND metres.
 */
import { smoothstep } from './noise';

export const BIOME_LENGTH = 1500;
const BLEND = 260;

/** sRGB hex → linear [r, g, b], the space three.js expects for vertex colours. */
export const rgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map(v => (v / 255) ** 2.2);

export const BIOMES = [
  {
    id: 'meadow',
    name: 'green meadows',
    grass: rgb(0x7fb45a),
    grass2: rgb(0xa6cc6c),
    soil: rgb(0x9a8a5c),
    mountain: rgb(0x5d7c8f),
    density: 0.34,
    // [kind, weight]
    flora: [['roundTree', 5], ['pine', 1.5], ['bush', 3], ['rock', 1], ['flower', 3]],
    treeColors: [rgb(0x4f9a3f), rgb(0x5fae45), rgb(0x3e8a3a), rgb(0x78b84a)],
  },
  {
    id: 'autumn',
    name: 'autumn forest',
    grass: rgb(0xb59a4f),
    grass2: rgb(0xcfa54f),
    soil: rgb(0x8a6a44),
    mountain: rgb(0x7a6f86),
    density: 0.46,
    flora: [['roundTree', 7], ['pine', 2], ['bush', 2], ['rock', 1]],
    treeColors: [rgb(0xe8742c), rgb(0xd9452e), rgb(0xf2b134), rgb(0xc9562a), rgb(0x9c3b2a)],
  },
  {
    id: 'desert',
    name: 'desert dunes',
    grass: rgb(0xe2b77a),
    grass2: rgb(0xd89b62),
    soil: rgb(0xc4834f),
    mountain: rgb(0xb0735a),
    density: 0.1,
    flora: [['cactus', 4], ['rock', 5], ['bush', 1]],
    treeColors: [rgb(0x5c8a4a), rgb(0x6b9a52)],
  },
  {
    id: 'snow',
    name: 'snowy pines',
    grass: rgb(0xeef3f7),
    grass2: rgb(0xdbe6ef),
    soil: rgb(0xaab6c4),
    mountain: rgb(0x8b9bb4),
    density: 0.4,
    flora: [['snowPine', 7], ['rock', 1.5]],
    treeColors: [rgb(0x2f5d4e), rgb(0x3a6b58), rgb(0x285446)],
  },
];

/**
 * Which biome(s) apply at a distance `p` along the travel direction.
 * Returns the current biome, the next one and how far we've blended into it.
 */
export function biomeAt(p) {
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
