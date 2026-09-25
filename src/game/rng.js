/** Seeded pseudo-random numbers, so a seed always rebuilds the same world. */

/** mulberry32: tiny, fast 32-bit PRNG. Returns a function yielding floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit hash of integers (e.g. seed + chunk coordinates) for per-chunk RNG streams. */
export function hashInts(...values) {
  let h = 0x811c9dc5;
  for (const value of values) {
    h ^= value | 0;
    h = Math.imul(h, 0x01000193);
    h ^= h >>> 13;
  }
  return h >>> 0;
}

/** A fresh random seed that is short enough to share in a URL. */
export const randomSeed = () => 1 + Math.floor(Math.random() * 99999);

/** Parses a user-supplied seed; returns null when it isn't a positive integer. */
export function parseSeed(value) {
  const seed = Number.parseInt(value, 10);
  return Number.isFinite(seed) && seed > 0 && seed < 1e9 ? seed : null;
}
