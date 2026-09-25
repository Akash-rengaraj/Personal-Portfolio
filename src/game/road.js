/**
 * The endless road: a centreline sampled every SEG metres, generated ahead of
 * the car on demand. Its heading always stays within ~66° of one base
 * direction, so it winds forever but can never loop back into itself.
 */
import { mulberry32, hashInts } from './rng';
import { clamp } from './noise';
import { GeoBuilder, makePart } from './geo';
import { rgb } from './biomes';
import * as THREE from 'three';

export const ROAD = {
  SEG: 8,
  HALF_WIDTH: 4.1,     // asphalt edge
  SHOULDER: 6.2,       // gravel edge
  LANE_OFFSET: 1.95,   // lane centre from the middle (we drive on the left, like India)
  START_S: -480,       // road exists this far behind the start line
  CHUNK_SAMPLES: 25,   // 200 m of road per mesh
  LAMP_EVERY: 6,       // samples between street lamps
};

const MAX_TURN = ROAD.SEG / 115;        // tightest bend ≈ 115 m radius
const MAX_RISE = 0.065 * ROAD.SEG;      // steepest grade ≈ 6.5 %
const MAX_DEVIATION = 1.15;             // rad from the base direction
const CELL = 24;
const cellKey = (cx, cz) => (cx + 100000) * 200000 + (cz + 100000);

export class Road {
  constructor({ seed, noise, rawHeight }) {
    this.noise = noise;
    this.rawHeight = rawHeight;
    this.baseDir = mulberry32(hashInts(seed, 77))() * Math.PI * 2;
    this.baseX = Math.sin(this.baseDir);
    this.baseZ = Math.cos(this.baseDir);
    this.x = [];
    this.z = [];
    this.y = [];
    this.h = [];
    this.cells = new Map();
    this.turn = 0;

    const back = -ROAD.START_S;
    const x0 = -this.baseX * back;
    const z0 = -this.baseZ * back;
    this.push(x0, z0, this.lookaheadHeight(x0, z0, this.baseDir), this.baseDir);
    this.ensureAhead(this.indexAtS(0));
  }

  get length() {
    return this.x.length;
  }

  sAt(index) {
    return ROAD.START_S + index * ROAD.SEG;
  }

  indexAtS(s) {
    return (s - ROAD.START_S) / ROAD.SEG;
  }

  /** Distance along the base direction — drives biome changes. */
  along(x, z) {
    return x * this.baseX + z * this.baseZ;
  }

  /** Average raw terrain height over the next 64 m, so the road anticipates hills. */
  lookaheadHeight(x, z, heading) {
    const sx = Math.sin(heading);
    const sz = Math.cos(heading);
    let sum = 0;
    for (let d = 0; d <= 64; d += 16) sum += this.rawHeight(x + sx * d, z + sz * d);
    return sum / 5;
  }

  push(x, z, y, h) {
    const index = this.x.length;
    this.x.push(x);
    this.z.push(z);
    this.y.push(y);
    this.h.push(h);
    const key = cellKey(Math.floor(x / CELL), Math.floor(z / CELL));
    const bucket = this.cells.get(key);
    if (bucket) bucket.push(index);
    else this.cells.set(key, [index]);
  }

  /** Makes sure the road reaches at least 1.8 km past sample `index`. */
  ensureAhead(index) {
    const target = Math.ceil(index + 1800 / ROAD.SEG);
    const n = this.noise;
    while (this.x.length < target) {
      const i = this.x.length - 1;
      const s = this.sAt(i + 1);
      const wander = 1.05 * n(s * 0.0011, 3.7) + 0.4 * n(s * 0.0046, 9.1);
      const targetHeading = this.baseDir + clamp(wander, -MAX_DEVIATION, MAX_DEVIATION);
      const want = clamp((targetHeading - this.h[i]) * 0.09, -MAX_TURN, MAX_TURN);
      this.turn += (want - this.turn) * 0.3;
      const h = this.h[i] + this.turn;
      const x = this.x[i] + Math.sin(h) * ROAD.SEG;
      const z = this.z[i] + Math.cos(h) * ROAD.SEG;
      const ahead = this.lookaheadHeight(x, z, h);
      const y = this.y[i] + clamp((ahead - this.y[i]) * 0.14, -MAX_RISE, MAX_RISE);
      this.push(x, z, y, h);
    }
  }

  /**
   * Closest point on the road to (x, z) within `maxDist`, written into `out`
   * ({ dist, lateral (+ = right of travel), x, y, z, heading, s, index }), or null.
   */
  nearest(x, z, maxDist, out) {
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    const r = Math.ceil(maxDist / CELL);
    let best = -1;
    let bestD2 = maxDist * maxDist;
    for (let gx = cx - r; gx <= cx + r; gx++) {
      for (let gz = cz - r; gz <= cz + r; gz++) {
        const bucket = this.cells.get(cellKey(gx, gz));
        if (!bucket) continue;
        for (let k = 0; k < bucket.length; k++) {
          const i = bucket[k];
          const dx = this.x[i] - x;
          const dz = this.z[i] - z;
          const d2 = dx * dx + dz * dz;
          if (d2 < bestD2) {
            bestD2 = d2;
            best = i;
          }
        }
      }
    }
    if (best < 0) return null;

    // refine on the two segments around the closest sample
    let segA = best;
    let segT = 0;
    let segD2 = Infinity;
    for (let a = Math.max(0, best - 1); a <= Math.min(best, this.x.length - 2); a++) {
      const ax = this.x[a];
      const az = this.z[a];
      const bx = this.x[a + 1] - ax;
      const bz = this.z[a + 1] - az;
      const t = clamp(((x - ax) * bx + (z - az) * bz) / (bx * bx + bz * bz), 0, 1);
      const px = ax + bx * t - x;
      const pz = az + bz * t - z;
      const d2 = px * px + pz * pz;
      if (d2 < segD2) {
        segD2 = d2;
        segA = a;
        segT = t;
      }
    }
    return this.fill(out, segA, segT, x, z);
  }

  /** Road point at arc length `s` (clamped to the generated range). */
  pointAt(s, out) {
    const f = clamp(this.indexAtS(s), 0, this.x.length - 1.0001);
    const i = Math.floor(f);
    return this.fill(out, i, f - i);
  }

  fill(out, i, t, qx, qz) {
    const j = Math.min(i + 1, this.x.length - 1);
    const px = this.x[i] + (this.x[j] - this.x[i]) * t;
    const pz = this.z[i] + (this.z[j] - this.z[i]) * t;
    const heading = this.h[i] + (this.h[j] - this.h[i]) * t;
    out.x = px;
    out.z = pz;
    out.y = this.y[i] + (this.y[j] - this.y[i]) * t;
    out.heading = heading;
    out.index = i + t;
    out.s = this.sAt(i + t);
    if (qx !== undefined) {
      const dx = qx - px;
      const dz = qz - pz;
      out.dist = Math.hypot(dx, dz);
      // right of travel = (-cos h, sin h)
      out.lateral = dx * -Math.cos(heading) + dz * Math.sin(heading);
    } else {
      out.dist = 0;
      out.lateral = 0;
    }
    return out;
  }
}

/* ─── road meshes ──────────────────────────────────────── */

const ASPHALT = rgb(0x44474e);
const ASPHALT_DARK = rgb(0x3a3d43);
const GRAVEL = rgb(0x857a66);
const PAINT = rgb(0xf3efe2);
const PAINT_YELLOW = rgb(0xf2c94c);
const POLE = rgb(0x5b6068);

const POLE_PART = [
  makePart(new THREE.BoxGeometry(0.16, 6, 0.16), POLE, { y: 3 }),
  makePart(new THREE.BoxGeometry(0.12, 0.12, 1.9), POLE, { y: 5.95, z: 0.9 }),
];
export const BULB_PART = [makePart(new THREE.BoxGeometry(0.34, 0.1, 0.55), [1, 1, 1], { y: 5.86, z: 1.75 })];

/**
 * Builds road chunk `c`: asphalt, shoulders, lane paint and street lamps.
 * Returns the geometries plus lamp obstacles for collisions.
 */
export function buildRoadChunk(road, c) {
  const i0 = c * ROAD.CHUNK_SAMPLES;
  const i1 = Math.min(i0 + ROAD.CHUNK_SAMPLES, road.length - 1);
  const surface = new GeoBuilder();
  const bulbs = new GeoBuilder();
  const obstacles = [];

  const edge = (i, lateral, lift) => {
    const h = road.h[i];
    return [road.x[i] - Math.cos(h) * lateral, road.y[i] + lift, road.z[i] + Math.sin(h) * lateral];
  };
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const strip = (i, l0, l1, lift0, lift1, color, t0 = 0, t1 = 1) => {
    const a = lerp3(edge(i, l0, lift0), edge(i + 1, l0, lift0), t0);
    const b = lerp3(edge(i, l1, lift1), edge(i + 1, l1, lift1), t0);
    const cc = lerp3(edge(i, l1, lift1), edge(i + 1, l1, lift1), t1);
    const d = lerp3(edge(i, l0, lift0), edge(i + 1, l0, lift0), t1);
    surface.quad(a, b, cc, d, color);
  };

  const W = ROAD.HALF_WIDTH;
  const S = ROAD.SHOULDER;
  for (let i = i0; i < i1; i++) {
    strip(i, -S, -W, -0.12, 0.03, GRAVEL);
    strip(i, -W, W, 0.04, 0.04, i % 2 ? ASPHALT : ASPHALT_DARK);
    strip(i, W, S, 0.03, -0.12, GRAVEL);
    // edge lines + dashed centre line
    strip(i, -W + 0.2, -W + 0.34, 0.055, 0.055, PAINT);
    strip(i, W - 0.34, W - 0.2, 0.055, 0.055, PAINT);
    strip(i, -0.08, 0.08, 0.055, 0.055, PAINT_YELLOW, 0, 0.45);

    if (i % ROAD.LAMP_EVERY === 0 && i > 0) {
      const side = (i / ROAD.LAMP_EVERY) % 2 ? 1 : -1;
      const [px, py, pz] = edge(i, side * (S + 0.9), 0);
      // the lamp's arm (local +z) points back over the road
      const rot = road.h[i] + side * (Math.PI / 2);
      surface.add(POLE_PART, px, py - 0.2, pz, rot);
      bulbs.add(BULB_PART, px, py - 0.2, pz, rot);
      obstacles.push({ x: px, z: pz, r: 0.3 });
    }
  }
  return { surface: surface.build(), bulbs: bulbs.build(), obstacles };
}
