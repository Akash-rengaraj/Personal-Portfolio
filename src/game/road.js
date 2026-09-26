/**
 * The endless road: a centreline sampled every SEG metres, generated ahead of
 * the car on demand. Its heading always stays within ~66° of one base
 * direction, so it winds forever but can never loop back into itself.
 * Long straights appear now and then so the car can stretch its legs.
 */
import * as THREE from 'three';
import { mulberry32, hashInts } from './rng';
import { clamp, smoothstep } from './noise';
import { GeoBuilder, makePart } from './geo';
import { rgb } from './biomes';

export const ROAD = {
  SEG: 8,
  HALF_WIDTH: 4.1,     // asphalt edge
  SHOULDER: 6.2,       // gravel edge
  LANE_OFFSET: 1.95,   // lane centre from the middle (we drive on the left, like India)
  START_S: -480,       // road exists this far behind the start line
  CHUNK_SAMPLES: 25,   // 200 m of road per mesh
  LAMP_EVERY: 8,       // samples between street lamps
  POST_EVERY: 3,       // samples between reflector posts
};

const MAX_TURN = ROAD.SEG / 150;        // tightest bend ≈ 150 m radius
const MAX_GRADE = 0.065;                // steepest grade 6.5 %
// The grade may only change gradually: crests at least ~600 m in radius and dips ~350 m,
// so there are no ramps — the car stays planted over the top even at very high speed.
const CREST_STEP = ROAD.SEG / 600;
const SAG_STEP = ROAD.SEG / 350;
const MAX_DEVIATION = 1.15;             // rad from the base direction
const CURB_TURN = ROAD.SEG / 280;       // kerbs on bends tighter than ~280 m
const RAIL_TURN = ROAD.SEG / 230;       // guardrail on the outside of bends tighter than ~230 m
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
    this.grade = 0;

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

  /** Makes sure the road reaches at least 2.4 km past sample `index` (enough at 600 km/h). */
  ensureAhead(index) {
    const target = Math.ceil(index + 2400 / ROAD.SEG);
    const n = this.noise;
    while (this.x.length < target) {
      const i = this.x.length - 1;
      const s = this.sAt(i + 1);
      // long straights: a slow noise band calms the wandering right down
      const straight = smoothstep(0.15, 0.55, n(s * 0.00045, 17.3));
      const wander = (1.05 * n(s * 0.0011, 3.7) + 0.4 * n(s * 0.0046, 9.1)) * (1 - 0.85 * straight);
      const targetHeading = this.baseDir + clamp(wander, -MAX_DEVIATION, MAX_DEVIATION);
      const want = clamp((targetHeading - this.h[i]) * 0.08, -MAX_TURN, MAX_TURN);
      this.turn += (want - this.turn) * 0.25;
      const h = this.h[i] + this.turn;
      const x = this.x[i] + Math.sin(h) * ROAD.SEG;
      const z = this.z[i] + Math.cos(h) * ROAD.SEG;
      // follow the terrain (averaged ahead) with a gently changing grade; the −grade term damps
      // the follow so it settles onto the hills instead of overshooting them
      const ahead = this.lookaheadHeight(x, z, h);
      const wantGrade = clamp(((ahead - this.y[i]) * 0.14) / ROAD.SEG - this.grade * 0.35, -MAX_GRADE, MAX_GRADE);
      this.grade += clamp(wantGrade - this.grade, -CREST_STEP, SAG_STEP);
      this.grade = clamp(this.grade, -MAX_GRADE, MAX_GRADE);
      const y = this.y[i] + this.grade * ROAD.SEG;
      this.push(x, z, y, h);
    }
  }

  /** Heading change per sample at `i` (+ = bending left). */
  turnAt(i) {
    const j = Math.min(i + 1, this.x.length - 1);
    const k = Math.max(i - 1, 0);
    return (this.h[j] - this.h[k]) / Math.max(1, j - k);
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

const ASPHALT = rgb(0x55585f);
const ASPHALT_WORN = rgb(0x46484e);
const ASPHALT_PATCH = rgb(0x4a4c52);
const GRAVEL = rgb(0x9a8f7a);
const PAINT = rgb(0xf6f2e6);
const PAINT_YELLOW = rgb(0xf2c94c);
const CURB_RED = rgb(0xd23a32);
const CURB_WHITE = rgb(0xf2f0ea);
const POLE = rgb(0x5b6068);
const CONCRETE = rgb(0xa9a79f);
const RAIL = rgb(0xaab2bc);
const POST_WHITE = rgb(0xf1f1ec);
const POST_BLACK = rgb(0x1d1f22);
const REFLECTOR = rgb(0xff9a1f);
const WOOD_POLE = rgb(0x6e5a44);
const INSULATOR = rgb(0x7fa89a);
const WIRE = rgb(0x1a1a1a);
const SIGN_BLACK = rgb(0x17181a);
const SIGN_YELLOW = rgb(0xf4c20d);
const MILESTONE = rgb(0xf4f2ec);
const MILESTONE_TOP = rgb(0xf2b705);
const STUD_AMBER = [1, 0.62, 0.18];
const STUD_WHITE = [0.95, 0.95, 0.9];

/* street lamp: concrete base, tapered pole, an arm reaching over the road (+z), lamp head */
const LAMP_PART = [
  makePart(new THREE.CylinderGeometry(0.26, 0.32, 0.55, 8), CONCRETE, { y: 0.12, shade: [0.7, 1], mottle: 0.1 }),
  makePart(new THREE.CylinderGeometry(0.065, 0.12, 6.4, 8, 1, true), POLE, { y: 3.4, smooth: true, shade: [0.65, 1.05] }),
  makePart(new THREE.CylinderGeometry(0.045, 0.06, 2.05, 6, 1, true), POLE, { y: 6.72, z: 0.95, rx: 1.38, smooth: true }),
  makePart(new THREE.BoxGeometry(0.34, 0.14, 0.72), rgb(0x3a3d42), { y: 6.9, z: 1.9, rx: -0.06 }),
];
const LAMP_LENS = [makePart(new THREE.BoxGeometry(0.28, 0.05, 0.6), [1, 1, 1], { y: 6.83, z: 1.9, rx: -0.06 })];
const LAMP_HEAD_Z = 1.9;

/* delineator post with a black band and an orange reflector (local +z faces the road) */
const POST_PART = [
  makePart(new THREE.CylinderGeometry(0.055, 0.065, 1.0, 6), POST_WHITE, { y: 0.5, shade: [0.8, 1.05] }),
  makePart(new THREE.CylinderGeometry(0.058, 0.058, 0.16, 6), POST_BLACK, { y: 0.88 }),
  makePart(new THREE.BoxGeometry(0.1, 0.1, 0.05), REFLECTOR, { y: 0.72, z: 0.055 }),
];
const RAIL_POST_PART = [makePart(new THREE.BoxGeometry(0.12, 0.8, 0.12), POLE, { y: 0.4 })];

/* utility pole: crossarm along local x (across the road), three insulators */
const POLE_TOP = 8.75;
const INSULATOR_X = [-1.0, 0, 1.0];
const UTILITY_POLE_PART = [
  makePart(new THREE.CylinderGeometry(0.12, 0.17, 9.3, 7, 2, true), WOOD_POLE, { y: 4.55, smooth: true, lumps: 0.02, mottle: 0.14, shade: [0.6, 1.05] }),
  makePart(new THREE.BoxGeometry(2.5, 0.13, 0.13), WOOD_POLE, { y: POLE_TOP, shade: [0.75, 1] }),
  makePart(new THREE.BoxGeometry(0.06, 0.9, 0.06), rgb(0x55504a), { x: 0.45, y: POLE_TOP - 0.4, rz: 0.75 }),
  makePart(new THREE.BoxGeometry(0.06, 0.9, 0.06), rgb(0x55504a), { x: -0.45, y: POLE_TOP - 0.4, rz: -0.75 }),
  ...INSULATOR_X.map(x => makePart(new THREE.CylinderGeometry(0.045, 0.07, 0.24, 7), INSULATOR, { x, y: POLE_TOP + 0.18, smooth: true })),
];

/* chevron bend sign: black board, yellow ">" on both faces pointing along local +x */
function chevronPart() {
  const parts = [
    makePart(new THREE.CylinderGeometry(0.035, 0.04, 1.3, 6), POLE, { y: 0.65 }),
    makePart(new THREE.BoxGeometry(0.85, 0.66, 0.04), SIGN_BLACK, { y: 1.55 }),
  ];
  for (const face of [-1, 1]) {
    for (const up of [-1, 1]) {
      // each arm of the chevron is a slanted bar; the pair meets at the tip (+x)
      parts.push(makePart(new THREE.BoxGeometry(0.5, 0.13, 0.01), SIGN_YELLOW, { x: 0.02, y: 1.55 + up * 0.13, z: face * 0.026, rz: -up * 0.62 }));
    }
  }
  return parts;
}
const CHEVRON_LEFT = chevronPart();
/* Indian-style milestone: white slab with a rounded yellow top */
const MILESTONE_PART = [
  makePart(new THREE.BoxGeometry(0.46, 0.72, 0.2), MILESTONE, { y: 0.26, shade: [0.75, 1.02], mottle: 0.05 }),
  makePart(new THREE.CylinderGeometry(0.23, 0.23, 0.205, 14, 1, false, -Math.PI / 2, Math.PI), MILESTONE_TOP, { y: 0.62, rx: -Math.PI / 2 }),
];
const STUD_PART = [makePart(new THREE.BoxGeometry(0.14, 0.035, 0.1), STUD_AMBER, { y: 0.07 })];
const STUD_WHITE_PART = [makePart(new THREE.BoxGeometry(0.12, 0.03, 0.09), STUD_WHITE, { y: 0.065 })];

const UTILITY_EVERY = 5;
const WIRE_SAG = 0.85;

/**
 * Builds road chunk `c`: textured asphalt with worn wheel tracks and patches, shoulders,
 * lane paint, cat's-eye studs, kerbs, reflector posts, guardrails with chevron signs,
 * street lamps (and their pools of light), utility poles with wires, and milestones.
 * Objects in `broken` (ids) are left out — once knocked down they stay down.
 *
 * Returns { surface, props, bulbs, pools, studs, obstacles }. Breakable obstacles carry
 * { id, kind, mass, breakSpeed, material, rooted, base, pieces: [{ target, range }] }.
 */
export function buildRoadChunk(road, c, broken = new Set()) {
  const i0 = c * ROAD.CHUNK_SAMPLES;
  const i1 = Math.min(i0 + ROAD.CHUNK_SAMPLES, road.length - 1);
  const surface = new GeoBuilder({ uv: true });
  const props = new GeoBuilder();
  const bulbs = new GeoBuilder();
  const pools = new GeoBuilder({ uv: true });
  const studs = new GeoBuilder();
  const obstacles = [];

  const edge = (i, lateral, lift) => {
    const h = road.h[i];
    return [road.x[i] - Math.cos(h) * lateral, road.y[i] + lift, road.z[i] + Math.sin(h) * lateral];
  };
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  /** Strip across [l0, l1] between samples i and i+1 (t0…t1 of the segment), UV-mapped in metres / 8. */
  const strip = (builder, i, l0, l1, lift0, lift1, color, t0 = 0, t1 = 1) => {
    const a = lerp3(edge(i, l0, lift0), edge(i + 1, l0, lift0), t0);
    const b = lerp3(edge(i, l1, lift1), edge(i + 1, l1, lift1), t0);
    const cc = lerp3(edge(i, l1, lift1), edge(i + 1, l1, lift1), t1);
    const d = lerp3(edge(i, l0, lift0), edge(i + 1, l0, lift0), t1);
    const v0 = (i + t0) * (ROAD.SEG / 8);
    const v1 = (i + t1) * (ROAD.SEG / 8);
    const u0 = l0 / 8;
    const u1 = l1 / 8;
    builder.quad(a, b, cc, d, color, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
  };
  const pseudo = (i, k) => {
    const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  const breakable = (obstacle) => {
    obstacles.push(obstacle);
    return obstacle;
  };

  const W = ROAD.HALF_WIDTH;
  const S = ROAD.SHOULDER;
  for (let i = i0; i < i1; i++) {
    const turn = road.turnAt(i);
    strip(surface, i, -S, -W, -0.12, 0.03, GRAVEL);
    strip(surface, i, -W, W, 0.04, 0.04, ASPHALT);
    strip(surface, i, W, S, 0.03, -0.12, GRAVEL);
    // tyre-polished wheel tracks in both lanes, and the odd patch of newer asphalt
    for (const l of [-2.73, -1.17, 1.17, 2.73]) strip(surface, i, l - 0.26, l + 0.26, 0.045, 0.045, ASPHALT_WORN);
    if (pseudo(i, 1) < 0.1) {
      const lat = (pseudo(i, 2) - 0.5) * 5;
      const len = 0.3 + pseudo(i, 3) * 0.6;
      strip(surface, i, lat - 0.6 - pseudo(i, 4), lat + 0.6, 0.047, 0.047, ASPHALT_PATCH, 0.1, 0.1 + len * 0.85);
    }
    // edge lines + dashed centre line (solid through bends: no overtaking)
    strip(surface, i, -W + 0.2, -W + 0.34, 0.055, 0.055, PAINT);
    strip(surface, i, W - 0.34, W - 0.2, 0.055, 0.055, PAINT);
    if (Math.abs(turn) > CURB_TURN) {
      strip(surface, i, -0.16, -0.04, 0.056, 0.056, PAINT_YELLOW);
      strip(surface, i, 0.04, 0.16, 0.056, 0.056, PAINT_YELLOW);
    } else {
      strip(surface, i, -0.08, 0.08, 0.055, 0.055, PAINT_YELLOW, 0, 0.45);
    }

    // cat's-eye studs: amber down the middle, white along the edges (they glow at night)
    const mid = edge(i, 0, 0);
    studs.add(STUD_PART, mid[0], mid[1], mid[2], road.h[i]);
    if (i % 2 === 0) {
      for (const side of [-1, 1]) {
        const e = edge(i, side * (W - 0.27), 0);
        studs.add(STUD_WHITE_PART, e[0], e[1], e[2], road.h[i]);
      }
    }

    // red/white kerbs on the inside of tighter bends
    if (Math.abs(turn) > CURB_TURN) {
      const inside = turn > 0 ? -1 : 1; // bending left → inside is the left edge
      for (let k = 0; k < 2; k++) {
        const color = (i * 2 + k) % 2 ? CURB_RED : CURB_WHITE;
        const [l0, l1] = inside < 0 ? [-W - 0.55, -W + 0.05] : [W - 0.05, W + 0.55];
        strip(surface, i, l0, l1, 0.075, 0.075, color, k * 0.5, k * 0.5 + 0.5);
      }
    }

    // reflector posts on both sides — light plastic: they snap off and fly
    if (i % ROAD.POST_EVERY === 0) {
      for (const side of [-1, 1]) {
        const id = `p${i}:${side}`;
        if (broken.has(id)) continue;
        const [px, py, pz] = edge(i, side * (S + 0.35), 0);
        // reflector (local +z) faces the road
        const range = props.add(POST_PART, px, py - 0.12, pz, road.h[i] + side * (Math.PI / 2));
        breakable({
          x: px, z: pz, r: 0.1, id, kind: 'post', mass: 5, breakSpeed: 0.4, material: 'plastic', rooted: false,
          base: [px, py - 0.12, pz], pieces: [{ target: 'props', range }],
        });
      }
    }

    // guardrail on the outside of tighter bends, with chevron signs beyond it
    if (Math.abs(turn) > RAIL_TURN) {
      const outside = turn > 0 ? 1 : -1;
      const l = outside * (S + 0.8);
      const a0 = edge(i, l, 0.5);
      const a1 = edge(i + 1, l, 0.5);
      const b0 = edge(i, l, 0.82);
      const b1 = edge(i + 1, l, 0.82);
      // double-sided rail blade
      props.quad(a0, a1, b1, b0, RAIL);
      props.quad(a0, b0, b1, a1, RAIL);
      const [px, py, pz] = edge(i, l, 0);
      props.add(RAIL_POST_PART, px, py - 0.1, pz, road.h[i]);
      // one smooth wall segment per rail section, so the car slides along instead of snagging
      const e0 = edge(i, l, 0);
      const e1 = edge(i + 1, l, 0);
      obstacles.push({ x: (e0[0] + e1[0]) / 2, z: (e0[2] + e1[2]) / 2, r: 0.25, seg: [e0[0], e0[2], e1[0], e1[2]] });

      const id = `c${i}`;
      if (i % 3 === 0 && !broken.has(id)) {
        const [sx, sy, sz] = edge(i, outside * (S + 1.6), 0);
        // chevrons point into the bend: a left bend (turn > 0) points to the driver's left (+x)
        const range = props.add(CHEVRON_LEFT, sx, sy - 0.1, sz, road.h[i] + (turn > 0 ? 0 : Math.PI));
        breakable({
          x: sx, z: sz, r: 0.12, id, kind: 'sign', mass: 16, breakSpeed: 0.8, material: 'metal', rooted: false,
          base: [sx, sy - 0.1, sz], pieces: [{ target: 'props', range }],
        });
      }
    }

    // street lamps, alternating sides, each with a pool of light on the road at night
    if (i % ROAD.LAMP_EVERY === 0 && i > 0 && !broken.has(`l${i}`)) {
      const side = (i / ROAD.LAMP_EVERY) % 2 ? 1 : -1;
      const [px, py, pz] = edge(i, side * (S + 1.4), 0);
      // the lamp's arm (local +z) points back over the road
      const rot = road.h[i] + side * (Math.PI / 2);
      const range = props.add(LAMP_PART, px, py - 0.2, pz, rot);
      const lens = bulbs.add(LAMP_LENS, px, py - 0.2, pz, rot);
      // pool of light: follows the road surface under the head (radial gradient via UVs)
      const headLat = side * (S + 1.4 - LAMP_HEAD_Z);
      const R = 7.5;
      const poolStart = pools.vertexCount;
      for (let k = Math.max(i - 1, 0); k < Math.min(i + 1, road.length - 1); k++) {
        const l0 = headLat - R;
        const l1 = headLat + R;
        const lo = Math.max(-S, Math.min(l0, l1));
        const hi = Math.min(S, Math.max(l0, l1));
        const a = edge(k, lo, 0.075);
        const b = edge(k, hi, 0.075);
        const cc = edge(k + 1, hi, 0.075);
        const d = edge(k + 1, lo, 0.075);
        const along0 = (k - i) * ROAD.SEG;
        const along1 = (k + 1 - i) * ROAD.SEG;
        const uv = (lat, along) => [0.5 + (lat - headLat) / (2 * R), 0.5 + along / (2 * R)];
        pools.quad(a, b, cc, d, [1, 1, 1], [uv(lo, along0), uv(hi, along0), uv(hi, along1), uv(lo, along1)]);
      }
      breakable({
        x: px, z: pz, r: 0.3, id: `l${i}`, kind: 'lamp', mass: 140, breakSpeed: 3.5, material: 'metal', rooted: false,
        base: [px, py - 0.2, pz],
        pieces: [{ target: 'props', range }, { target: 'bulbs', range: lens }, { target: 'pools', range: [poolStart, pools.vertexCount], hideOnly: true }],
      });
    }

    // wooden utility poles on the right, wires sagging to the next pole
    if (i % UTILITY_EVERY === 2) {
      const id = `u${i}`;
      const [px, py, pz] = edge(i, S + 3.4, 0);
      const rot = road.h[i];
      const pole = broken.has(id) ? null : breakable({
        x: px, z: pz, r: 0.2, id, kind: 'pole', mass: 280, breakSpeed: 5, material: 'wood', rooted: true,
        base: [px, py - 0.25, pz], pieces: [{ target: 'props', range: props.add(UTILITY_POLE_PART, px, py - 0.25, pz, rot) }],
        prevPole: `u${i - UTILITY_EVERY}`,
      });
      const j = i + UTILITY_EVERY;
      if (pole && j < road.length && !broken.has(`u${j}`)) {
        const [qx, qy, qz] = edge(j, S + 3.4, 0);
        const spanStart = props.vertexCount;
        for (const ix of INSULATOR_X) {
          const a = [px + Math.cos(rot) * ix, py - 0.25 + POLE_TOP + 0.3, pz - Math.sin(rot) * ix];
          const b = [qx + Math.cos(road.h[j]) * ix, qy - 0.25 + POLE_TOP + 0.3, qz - Math.sin(road.h[j]) * ix];
          wire(props, a, b);
        }
        pole.spanOut = { target: 'props', range: [spanStart, props.vertexCount] };
      }
    }

    // a milestone every kilometre on the left verge
    if (i % 125 === 60 && !broken.has(`m${i}`)) {
      const [mx, my, mz] = edge(i, -(S + 0.9), 0);
      const range = props.add(MILESTONE_PART, mx, my - 0.15, mz, road.h[i] - Math.PI / 2);
      breakable({
        x: mx, z: mz, r: 0.3, id: `m${i}`, kind: 'stone', mass: 180, breakSpeed: 7, material: 'stone', rooted: true,
        base: [mx, my - 0.15, mz], pieces: [{ target: 'props', range }],
      });
    }
  }
  return {
    surface: surface.build(),
    props: props.vertexCount ? props.build() : null,
    bulbs: bulbs.vertexCount ? bulbs.build() : null,
    pools: pools.vertexCount ? pools.build() : null,
    studs: studs.vertexCount ? studs.build() : null,
    obstacles,
  };
}

/** A sagging wire from a to b: two crossed thin ribbons (visible from any angle), both sides. */
function wire(builder, a, b) {
  const n = 7;
  const w = 0.028;
  let prev = a;
  for (let k = 1; k <= n; k++) {
    const t = k / n;
    const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - 4 * WIRE_SAG * t * (1 - t), a[2] + (b[2] - a[2]) * t];
    // vertical ribbon
    const p0 = [prev[0], prev[1] - w, prev[2]];
    const p1 = [p[0], p[1] - w, p[2]];
    const p2 = [p[0], p[1] + w, p[2]];
    const p3 = [prev[0], prev[1] + w, prev[2]];
    builder.quad(p0, p1, p2, p3, WIRE);
    builder.quad(p0, p3, p2, p1, WIRE);
    // horizontal ribbon (sideways offset perpendicular to the span)
    const dx = p[0] - prev[0];
    const dz = p[2] - prev[2];
    const len = Math.hypot(dx, dz) || 1;
    const ox = (-dz / len) * w;
    const oz = (dx / len) * w;
    const q0 = [prev[0] - ox, prev[1], prev[2] - oz];
    const q1 = [p[0] - ox, p[1], p[2] - oz];
    const q2 = [p[0] + ox, p[1], p[2] + oz];
    const q3 = [prev[0] + ox, prev[1], prev[2] + oz];
    builder.quad(q0, q1, q2, q3, WIRE);
    builder.quad(q0, q3, q2, q1, WIRE);
    prev = p;
  }
}
