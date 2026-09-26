/**
 * Farmhouses, barns, log cabins and adobe houses scattered back from the road,
 * plus wind turbines on the hilltops. Each building is a few merged prototype
 * parts; its windows go into a separate "glow" set that lights up warm at night.
 * Placement is seeded per terrain chunk, on flat-enough ground, facing the road.
 */
import * as THREE from 'three';
import { makePart } from './geo';
import { rgb } from './biomes';
import { mulberry32, hashInts } from './rng';
import { CHUNK } from './terrain';

const STONE = rgb(0x8c8a84);
const CREAM = rgb(0xece3cf);
const WHITE_WALL = rgb(0xf1eee6);
const TERRACOTTA = rgb(0xb5563a);
const SLATE = rgb(0x4d535c);
const BARN_RED = rgb(0x9b2d24);
const TRIM = rgb(0xf4f1ea);
const DOOR = rgb(0x5a3b25);
const LOG = rgb(0x7a5234);
const LOG_DARK = rgb(0x5c3c24);
const SNOW = rgb(0xf6f9fc);
const ADOBE = rgb(0xd29a67);
const ADOBE_DARK = rgb(0xb97f4f);
const BLUE_DOOR = rgb(0x2f6d9a);
const WINDOW = [1, 1, 1];
const TOWER = rgb(0xeef1f3);

/** Gable roof prism along x (ridge at height h above y0), overhanging the walls by `eave`. */
function gableRoof(w, d, h, eave = 0.4) {
  const x0 = -w / 2 - eave;
  const x1 = w / 2 + eave;
  const z0 = -d / 2 - eave;
  const z1 = d / 2 + eave;
  const v = [
    // front slope (faces +z and up)
    x0, 0, z1, x1, 0, z1, x1, h, 0, x0, 0, z1, x1, h, 0, x0, h, 0,
    // back slope
    x1, 0, z0, x0, 0, z0, x0, h, 0, x1, 0, z0, x0, h, 0, x1, h, 0,
    // gable ends
    x1, 0, z1, x1, 0, z0, x1, h, 0,
    x0, 0, z0, x0, 0, z1, x0, h, 0,
    // underside (so the eaves aren't see-through from below)
    x0, 0, z0, x1, 0, z0, x1, 0, z1, x0, 0, z0, x1, 0, z1, x0, 0, z1,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  return g;
}

/** Gambrel (barn) roof along x: steep lower slopes, shallow upper ones. */
function gambrelRoof(w, d, h, eave = 0.35) {
  const x0 = -w / 2 - eave;
  const x1 = w / 2 + eave;
  const zo = d / 2 + eave;
  const zm = d * 0.3;
  const ym = h * 0.62;
  // profile (z, y) from front eave over the ridge to the back eave
  const profile = [[zo, 0], [zm, ym], [0, h], [-zm, ym], [-zo, 0]];
  const v = [];
  for (let k = 0; k < profile.length - 1; k++) {
    const [za, ya] = profile[k];
    const [zb, yb] = profile[k + 1];
    v.push(x0, ya, za, x1, ya, za, x1, yb, zb, x0, ya, za, x1, yb, zb, x0, yb, zb);
  }
  // gable ends as fans from the ridge's middle
  for (const [x, flip] of [[x1, true], [x0, false]]) {
    for (let k = 0; k < profile.length - 1; k++) {
      const [za, ya] = profile[k];
      const [zb, yb] = profile[k + 1];
      if (flip) v.push(x, 0, 0, x, yb, zb, x, ya, za);
      else v.push(x, 0, 0, x, ya, za, x, yb, zb);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  return g;
}

const box = (w, h, d, color, x, y, z, opts = {}) => makePart(new THREE.BoxGeometry(w, h, d), color, { x, y, z, shade: [0.82, 1.03], ...opts });
const glowBox = (w, h, d, x, y, z) => makePart(new THREE.BoxGeometry(w, h, d), WINDOW, { x, y, z });

/**
 * Building prototypes. Local frame: front faces +z (turned toward the road), origin at the
 * footprint centre, ground at y = 0. `w`/`d` is the footprint; `parts` are drawn lit,
 * `glow` are windows (warm at night). Roof colours marked tint pick per-house variety.
 */
const BUILDINGS = {
  farmhouse: (() => {
    const w = 9;
    const d = 7;
    const h = 3.2;
    const parts = [
      box(w + 0.3, 1.6, d + 0.3, STONE, 0, -0.5, 0, { mottle: 0.08 }),
      box(w, h, d, CREAM, 0, h / 2, 0, { tint: 'alt' }),
      makePart(gableRoof(w, d, 2.4), null, { tint: true, y: h, shade: [0.85, 1.05] }),
      box(0.65, 1.9, 0.65, STONE, 2.4, h + 1.6, -1.1, { mottle: 0.1 }),
      box(1.15, 2.15, 0.1, DOOR, -1.4, 1.07, d / 2 + 0.04),
      box(1.8, 0.25, 1.1, STONE, -1.4, 0.12, d / 2 + 0.55),
      // window frames / sills
      ...[1.4, 3.3].map(x => box(1.25, 1.25, 0.08, TRIM, x, 1.75, d / 2 + 0.02)),
      box(1.25, 1.25, 0.08, TRIM, -3.4, 1.75, d / 2 + 0.02),
      ...[-2, 2].map(z => box(0.08, 1.25, 1.25, TRIM, w / 2 + 0.02, 1.75, z)),
    ];
    const glow = [
      ...[1.4, 3.3, -3.4].map(x => glowBox(0.95, 0.95, 0.08, x, 1.75, d / 2 + 0.05)),
      ...[-2, 2].map(z => glowBox(0.08, 0.95, 0.95, w / 2 + 0.05, 1.75, z)),
      glowBox(0.35, 0.35, 0.12, -1.4, 2.5, d / 2 + 0.08), // porch light
    ];
    return { parts, glow, w: w + 1, d: d + 1 };
  })(),

  barn: (() => {
    const w = 11;
    const d = 8;
    const h = 4.2;
    const parts = [
      box(w + 0.3, 1.2, d + 0.3, STONE, 0, -0.3, 0),
      box(w, h, d, BARN_RED, 0, h / 2, 0, { mottle: 0.05 }),
      makePart(gambrelRoof(w, d, 4.2), SLATE, { y: h, shade: [0.8, 1.05] }),
      // big doors with white trim and the classic X brace
      box(4.2, 3.6, 0.1, BARN_RED, 0, 1.8, d / 2 + 0.05, { shade: [0.7, 0.9] }),
      box(4.4, 0.2, 0.14, TRIM, 0, 3.65, d / 2 + 0.07),
      box(0.2, 3.7, 0.14, TRIM, -2.1, 1.85, d / 2 + 0.07),
      box(0.2, 3.7, 0.14, TRIM, 2.1, 1.85, d / 2 + 0.07),
      box(0.2, 3.7, 0.14, TRIM, 0, 1.85, d / 2 + 0.07),
      box(0.16, 4.6, 0.12, TRIM, -1.05, 1.8, d / 2 + 0.09, { rz: 0.72 }),
      box(0.16, 4.6, 0.12, TRIM, 1.05, 1.8, d / 2 + 0.09, { rz: -0.72 }),
      box(1.6, 1.6, 0.08, TRIM, 0, 5.4, d / 2 - 0.28),
    ];
    const glow = [glowBox(1.3, 1.3, 0.08, 0, 5.4, d / 2 - 0.22)];
    return { parts, glow, w: w + 1, d: d + 1 };
  })(),

  cabin: (() => {
    const w = 7.5;
    const d = 6;
    const h = 2.9;
    const parts = [
      box(w + 0.3, 1.4, d + 0.3, STONE, 0, -0.45, 0),
      // stacked logs (alternating shades) for a log-cabin look
      ...[0, 1, 2, 3, 4, 5].map(k => box(w, h / 6, d, k % 2 ? LOG : LOG_DARK, 0, (k + 0.5) * (h / 6), 0, { shade: [0.8, 1] })),
      ...[-1, 1].flatMap(sx => [-1, 1].map(sz => box(0.35, h + 0.2, 0.35, LOG_DARK, sx * (w / 2), h / 2, sz * (d / 2)))),
      makePart(gableRoof(w, d, 3.1, 0.55), SLATE, { y: h }),
      makePart(gableRoof(w, d, 3.1, 0.55), SNOW, { y: h + 0.18, sx: 0.98, sz: 0.97, shade: [0.9, 1.05] }),
      box(0.9, 2.6, 0.9, STONE, -2.4, h + 1.4, -0.9, { mottle: 0.12 }),
      box(0.4, 0.3, 0.4, SNOW, -2.4, h + 2.8, -0.9),
      box(1.1, 2.0, 0.1, DOOR, 1.6, 1.0, d / 2 + 0.05),
    ];
    const glow = [
      glowBox(1.0, 0.9, 0.08, -1.6, 1.6, d / 2 + 0.05),
      glowBox(0.08, 0.9, 1.0, w / 2 + 0.05, 1.6, 0),
      glowBox(0.3, 0.3, 0.12, 1.6, 2.3, d / 2 + 0.08),
    ];
    return { parts, glow, w: w + 1.2, d: d + 1.2 };
  })(),

  adobe: (() => {
    const w = 8;
    const d = 7;
    const h = 3.4;
    const parts = [
      // walls run 1.3 m below ground so the house sits right on sloping ground
      box(w, h + 1.3, d, ADOBE, 0, (h - 1.3) / 2, 0, { mottle: 0.06, shade: [0.8, 1.02] }),
      // parapet round the flat roof
      box(w + 0.1, 0.45, 0.3, ADOBE_DARK, 0, h - 0.05, d / 2 - 0.1),
      box(w + 0.1, 0.45, 0.3, ADOBE_DARK, 0, h - 0.05, -d / 2 + 0.1),
      box(0.3, 0.45, d, ADOBE_DARK, w / 2 - 0.1, h - 0.05, 0),
      box(0.3, 0.45, d, ADOBE_DARK, -w / 2 + 0.1, h - 0.05, 0),
      // vigas: roof beams poking through the front wall
      ...[-3, -1.5, 0, 1.5, 3].map(x => makePart(new THREE.CylinderGeometry(0.12, 0.12, 0.8, 6), LOG, { x, y: h - 0.7, z: d / 2 + 0.2, rx: Math.PI / 2 })),
      box(1.1, 2.1, 0.1, BLUE_DOOR, 1.5, 0.75, d / 2 + 0.03),
      makePart(new THREE.CylinderGeometry(0.35, 0.25, 0.7, 10), ADOBE_DARK, { x: -3.2, y: 0.05, z: d / 2 + 0.9, smooth: true, shade: [0.7, 1] }),
    ];
    const glow = [
      glowBox(0.8, 0.8, 0.08, -1.6, 1.4, d / 2 + 0.03),
      glowBox(0.08, 0.8, 0.8, w / 2 + 0.03, 1.4, 1),
      glowBox(0.3, 0.3, 0.12, 1.5, 2.1, d / 2 + 0.08),
    ];
    return { parts, glow, w: w + 0.8, d: d + 0.8 };
  })(),
};

export const TURBINE_HEIGHT = 46;
/** Wind-turbine tower + nacelle (the rotor is animated separately). */
export const TURBINE_PARTS = [
  makePart(new THREE.CylinderGeometry(2.7, 3, 0.9, 14), STONE, { y: 0.1 }),
  makePart(new THREE.CylinderGeometry(1.05, 1.85, TURBINE_HEIGHT, 14, 1, true), TOWER, { y: TURBINE_HEIGHT / 2, smooth: true, shade: [0.78, 1.04] }),
  makePart(new THREE.BoxGeometry(2.3, 2.5, 6.4), TOWER, { y: TURBINE_HEIGHT + 0.9, z: -1.4, shade: [0.85, 1.05] }),
];

/** One rotor: hub + three tapered blades, spinning about +z. */
export function rotorGeometry() {
  const hub = new THREE.ConeGeometry(1.3, 2.4, 12).rotateX(Math.PI / 2).translate(0, 0, 1.6);
  const parts = [hub];
  for (let k = 0; k < 3; k++) {
    const blade = new THREE.BoxGeometry(1.5, 21, 0.28);
    const pos = blade.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const taper = 1 - ((y + 10.5) / 21) * 0.72; // wide at the root, slim at the tip
      pos.setX(i, pos.getX(i) * taper);
    }
    blade.translate(0, 10.5 + 0.9, 0.9).rotateZ((k * Math.PI * 2) / 3);
    parts.push(blade);
  }
  const merged = new THREE.BufferGeometry();
  const positions = [];
  for (const p of parts) {
    const flat = p.index ? p.toNonIndexed() : p;
    positions.push(...flat.getAttribute('position').array);
    if (flat !== p) flat.dispose();
    p.dispose();
  }
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.computeVertexNormals();
  return merged;
}

/** Which building styles each biome gets, and how likely a chunk has any. */
const STYLE = {
  normal: { kinds: [['farmhouse', 3], ['barn', 2]], chance: 0.55, roofs: [TERRACOTTA, SLATE, rgb(0x6b3f2e)], walls: [CREAM, WHITE_WALL, rgb(0xe6d2a8)] },
  spring: { kinds: [['farmhouse', 3], ['barn', 1]], chance: 0.45, roofs: [TERRACOTTA, rgb(0x8f5a8a), SLATE], walls: [WHITE_WALL, rgb(0xf3dfe6), CREAM] },
  summer: { kinds: [['farmhouse', 2], ['barn', 3]], chance: 0.6, roofs: [TERRACOTTA, SLATE], walls: [CREAM, rgb(0xf0e0b0)] },
  autumn: { kinds: [['farmhouse', 2], ['barn', 2], ['cabin', 1]], chance: 0.45, roofs: [SLATE, TERRACOTTA, rgb(0x5a4a3a)], walls: [CREAM, rgb(0xe8d0b0)] },
  desert: { kinds: [['adobe', 1]], chance: 0.3, roofs: [ADOBE_DARK], walls: [ADOBE] },
  snow: { kinds: [['cabin', 1]], chance: 0.35, roofs: [SLATE], walls: [LOG] },
};
const TURBINE_BIOMES = new Set(['normal', 'summer', 'spring', 'autumn', 'snow']);

export function buildingSpec(kind) {
  return BUILDINGS[kind];
}

const roadProbe = {};

/**
 * Buildings and turbines for terrain chunk (cx, cz) — deterministic per seed.
 * Returns { buildings: [{ kind, x, y, z, rot, w, d, roof, wall }], turbines: [{ x, y, z, yaw }] }.
 */
export function chunkFeatures(world, cx, cz) {
  const rand = mulberry32(hashInts(world.seed, cx, cz, 1203));
  const buildings = [];
  const turbines = [];
  const x0 = cx * CHUNK;
  const z0 = cz * CHUNK;

  const centre = world.biomeAt(x0 + CHUNK / 2, z0 + CHUNK / 2);
  const biome = centre.t > 0.5 ? centre.b : centre.a;
  const style = STYLE[biome.id] ?? STYLE.normal;
  const wanted = rand() < style.chance ? (rand() < 0.35 ? 2 : 1) : 0;
  for (let n = 0, tries = 0; n < wanted && tries < 10; tries++) {
    const x = x0 + 12 + rand() * (CHUNK - 24);
    const z = z0 + 12 + rand() * (CHUNK - 24);
    const kindRoll = rand();
    const roofRoll = rand();
    const wallRoll = rand();
    const q = world.road.nearest(x, z, 130, roadProbe);
    if (!q || q.dist < 30) continue; // back from the road, but in sight of it
    const total = style.kinds.reduce((s, [, w]) => s + w, 0);
    let pick = kindRoll * total;
    let kind = style.kinds[0][0];
    for (const [k, w] of style.kinds) {
      pick -= w;
      if (pick <= 0) {
        kind = k;
        break;
      }
    }
    const spec = BUILDINGS[kind];
    const rot = Math.atan2(q.x - x, q.z - z); // front (+z) turned toward the road
    // flat enough? sample the footprint corners
    let lo = Infinity;
    let hi = -Infinity;
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    for (const [lx, lz] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]]) {
      const px = x + (lx * spec.w / 2) * c + (lz * spec.d / 2) * s;
      const pz = z - (lx * spec.w / 2) * s + (lz * spec.d / 2) * c;
      const h = world.visualHeight(px, pz);
      lo = Math.min(lo, h);
      hi = Math.max(hi, h);
    }
    if (hi - lo > 2.2) continue;
    if (buildings.some(b => Math.hypot(b.x - x, b.z - z) < 22)) continue;
    buildings.push({
      kind, x, y: (lo + hi) / 2, z, rot, w: spec.w, d: spec.d,
      roof: style.roofs[Math.floor(roofRoll * style.roofs.length)],
      wall: style.walls[Math.floor(wallRoll * style.walls.length)],
    });
    n++;
  }

  // a turbine on the highest of a few spots, if it's properly up on a hill
  if (TURBINE_BIOMES.has(biome.id) && rand() < 0.3) {
    let best = null;
    for (let k = 0; k < 10; k++) {
      const x = x0 + 20 + rand() * (CHUNK - 40);
      const z = z0 + 20 + rand() * (CHUNK - 40);
      const h = world.visualHeight(x, z);
      if (world.lastRoadDist < 60) continue;
      if (!best || h > best.y) best = { x, y: h, z };
    }
    if (best && best.y > 12) turbines.push({ ...best, y: best.y - 0.3, yaw: world.windYaw });
  }
  return { buildings, turbines };
}
