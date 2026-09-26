/**
 * Procedural model of a 911 GT3 RS-style sports car (no badges or logos).
 *
 * The body is lofted: a smooth shell through ~70 cross-sections interpolated
 * (Catmull-Rom) from a hand-measured table of the car's silhouette — low
 * nose, raised front fenders, bubble cabin, fastback roofline and wide rear
 * hips. Wheel arches are cut as round openings, and every quad is classified
 * as paint, glass or black trim. Details (round headlights, hood nostrils,
 * fender louvres, swan-neck rear wing, light bar, diffuser, centre-lock
 * wheels with yellow calipers) are merged per material to keep draw calls low.
 *
 * The model faces +z, wheels touching y = 0; its right side is −x.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export const PAINTS = [
  { id: 'racing-red', label: 'racing red', hex: 0xc8161d },
  { id: 'acid-green', label: 'acid green', hex: 0x8dcc2a },
  { id: 'electric-blue', label: 'electric blue', hex: 0x1c6fd1 },
  { id: 'lava-orange', label: 'lava orange', hex: 0xff5a14 },
  { id: 'arctic-silver', label: 'arctic silver', hex: 0xb8bdc3 },
  { id: 'chalk', label: 'chalk white', hex: 0xe7e4dc },
  { id: 'jet-black', label: 'jet black', hex: 0x15171a },
];

export const CAR_DIMENSIONS = {
  frontAxleZ: 1.19,
  rearAxleZ: -1.27,
  frontRadius: 0.345,
  rearRadius: 0.365,
  frontTrack: 0.8,
  rearTrack: 0.79,
};

/*
 * Silhouette table, nose → tail. Columns:
 * z, yb (underside), wL (lower half-width), yc (widest line), w (half-width at yc),
 * yBelt (shoulder line), wBelt, wCab (cabin/hood half-width), yTop (centre top), nCab (cabin roundness), bump (front fender crown)
 */
const PROFILE = [
  [2.29, 0.30, 0.55, 0.40, 0.60, 0.47, 0.58, 0.50, 0.52, 3.0, 0.0],
  [2.22, 0.18, 0.78, 0.44, 0.84, 0.56, 0.82, 0.74, 0.62, 3.0, 0.02],
  [2.05, 0.15, 0.86, 0.48, 0.90, 0.64, 0.88, 0.80, 0.69, 3.0, 0.08],
  [1.75, 0.15, 0.88, 0.50, 0.92, 0.70, 0.90, 0.82, 0.73, 3.0, 0.12],
  [1.40, 0.15, 0.88, 0.52, 0.93, 0.76, 0.91, 0.83, 0.77, 3.0, 0.12],
  [1.05, 0.15, 0.88, 0.54, 0.93, 0.77, 0.91, 0.83, 0.80, 3.0, 0.11],
  [0.78, 0.15, 0.88, 0.56, 0.91, 0.78, 0.89, 0.80, 0.84, 2.8, 0.05],
  [0.50, 0.15, 0.88, 0.57, 0.90, 0.83, 0.87, 0.70, 1.06, 2.3, 0.0],
  [0.20, 0.15, 0.88, 0.57, 0.90, 0.86, 0.87, 0.66, 1.25, 2.1, 0.0],
  [-0.10, 0.15, 0.89, 0.58, 0.91, 0.87, 0.88, 0.65, 1.31, 2.0, 0.0],
  [-0.45, 0.15, 0.91, 0.60, 0.93, 0.88, 0.90, 0.64, 1.30, 2.0, 0.0],
  [-0.80, 0.15, 0.93, 0.62, 0.97, 0.90, 0.93, 0.62, 1.22, 2.1, 0.0],
  [-1.10, 0.15, 0.94, 0.63, 0.99, 0.91, 0.95, 0.62, 1.12, 2.3, 0.0],
  [-1.40, 0.16, 0.94, 0.64, 0.99, 0.92, 0.95, 0.62, 1.03, 2.5, 0.0],
  [-1.70, 0.17, 0.92, 0.64, 0.97, 0.91, 0.93, 0.66, 0.97, 2.8, 0.0],
  [-1.95, 0.18, 0.88, 0.63, 0.94, 0.88, 0.90, 0.70, 0.93, 3.0, 0.0],
  [-2.15, 0.19, 0.86, 0.61, 0.9, 0.83, 0.86, 0.72, 0.86, 3.0, 0.0],
  [-2.29, 0.22, 0.8, 0.58, 0.82, 0.72, 0.78, 0.68, 0.77, 3.0, 0.0],
];
const STEPS_PER_ROW = 4;

const catmullRom = (p0, p1, p2, p3, t) => {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
};

/** Interpolated profile row at fractional row index u. */
function profileAt(u) {
  const i = Math.min(Math.floor(u), PROFILE.length - 2);
  const t = u - i;
  const row = (k) => PROFILE[Math.max(0, Math.min(PROFILE.length - 1, k))];
  const p0 = row(i - 1);
  const p1 = row(i);
  const p2 = row(i + 1);
  const p3 = row(i + 2);
  const v = p1.map((_, c) => catmullRom(p0[c], p1[c], p2[c], p3[c], t));
  const [z, yb, wL, yc, w, yBelt, wBelt, wCab, yTop, nCab, bump] = v;
  return { z, yb, wL, yc, w, yBelt, wBelt, wCab, yTop, nCab, bump: Math.max(0, bump) };
}

/** Round wheel-arch openings: raise the lip line and pull the lower body in over each wheel. */
function applyArches(p) {
  const D = CAR_DIMENSIONS;
  for (const [axle, radius] of [[D.frontAxleZ, D.frontRadius], [D.rearAxleZ, D.rearRadius]]) {
    const reach = radius + 0.09;
    const dz = p.z - axle;
    if (Math.abs(dz) >= reach) continue;
    const lip = Math.min(radius + Math.sqrt(reach * reach - dz * dz), p.yBelt - 0.035);
    if (lip > p.yc) {
      p.yc = lip;
      p.wL = Math.min(p.wL, 0.6);
    }
  }
  return p;
}

/** Merges parts after dropping indices, so indexed primitives and extrusions can mix. */
function merge(geometries) {
  const flat = geometries.map(g => {
    if (!g.index) return g;
    const n = g.toNonIndexed();
    g.dispose();
    return n;
  });
  const merged = mergeGeometries(flat, false);
  flat.forEach(g => g.dispose());
  return merged;
}

const superX = (c, n) => Math.sign(c) * Math.abs(c) ** (2 / n);

/**
 * Right-side cross-section, bottom centre → top centre.
 * Returns [x, y, part] with x ≤ 0 (the car's right is −x); part: 0 lower, 1 shoulder, 2 cabin/hood.
 */
function sectionPoints(p) {
  const pts = [];
  const hL = p.yc - p.yb;
  for (let k = 0; k <= 8; k++) {
    const a = -Math.PI / 2 + (k / 8) * (Math.PI / 2);
    pts.push([-p.wL * superX(Math.cos(a), 4), p.yc + hL * superX(Math.sin(a), 4), 0]);
  }
  for (let k = 0; k <= 3; k++) {
    const t = k / 3;
    pts.push([-(p.w - (p.w - p.wBelt) * t * t), p.yc + (p.yBelt - p.yc) * t, 1]);
  }
  const hC = p.yTop - p.yBelt;
  for (let k = 0; k <= 10; k++) {
    const a = (k / 10) * (Math.PI / 2);
    const x = -p.wCab * superX(Math.cos(a), p.nCab);
    // raised front fenders either side of the bonnet
    const crown = p.bump * Math.exp(-(((Math.abs(x) - 0.66) / 0.17) ** 2));
    pts.push([x, p.yBelt + hC * superX(Math.sin(a), p.nCab) + crown, 2]);
  }
  return pts;
}

const PAINT = 0;
const GLASS = 1;
const TRIM = 2;

/** Which material a body quad gets, from its centre point and section. */
function classify(x, y, z, part, p) {
  const ax = Math.abs(x);
  if (part === 0 && y < p.yb + 0.09) return TRIM;
  if (z > 2.16 && y < 0.3) return TRIM;
  if (part !== 2 || z > 0.76 || z < -1.5) return PAINT;
  if (z > 0.3) return ax < p.wCab - 0.08 && y > p.yBelt + 0.03 ? GLASS : PAINT;       // windscreen
  if (z > -0.75 && z < 0.28 && ax < 0.47) return PAINT;                                // roof
  if (z > -0.95 && y > p.yBelt + 0.035 && y < p.yTop - 0.05) return GLASS;             // side windows
  if (z <= -0.75 && ax < 0.44 && y > p.yBelt + 0.07) return GLASS;                     // small rear window
  return PAINT;
}

/** Lofts the body shell. Returns a geometry with material groups [paint, glass, trim]. */
function buildBody() {
  const rows = (PROFILE.length - 1) * STEPS_PER_ROW + 1;
  const sections = [];
  for (let r = 0; r < rows; r++) sections.push(applyArches(profileAt(r / STEPS_PER_ROW)));

  const positions = [];
  const ringParts = [];
  let ringSize = 0;
  for (const p of sections) {
    const right = sectionPoints(p);
    // full loop: right side bottom→top, then the mirrored left side top→bottom (no duplicate centres)
    const left = right.slice(1, -1).reverse().map(([x, y, part]) => [-x, y, part]);
    const ring = [...right, ...left];
    ringSize = ring.length;
    for (const [x, y, part] of ring) {
      positions.push(x, y, p.z);
      ringParts.push(part);
    }
  }

  const byKind = [[], [], []];
  const vertex = (r, k) => r * ringSize + (k % ringSize);
  for (let r = 0; r < sections.length - 1; r++) {
    for (let k = 0; k < ringSize; k++) {
      const a = vertex(r, k);
      const b = vertex(r, k + 1);
      const c = vertex(r + 1, k + 1);
      const d = vertex(r + 1, k);
      const cx = (positions[a * 3] + positions[c * 3]) / 2;
      const cy = (positions[a * 3 + 1] + positions[c * 3 + 1]) / 2;
      const cz = (positions[a * 3 + 2] + positions[c * 3 + 2]) / 2;
      const kind = classify(cx, cy, cz, ringParts[a], sections[r]);
      byKind[kind].push(a, b, c, a, c, d);
    }
  }

  // End caps (nose tip and tail face) as fans to the section centre. The ring runs clockwise
  // seen from the front, so the nose fan is reversed to face +z and the tail fan faces −z.
  // Each cap gets its own copy of the ring so its normals stay flat instead of smearing the
  // edge shading (and a wrong winding here gets back-face culled: the car looks hollow).
  const cap = (r, facesForward) => {
    const p = sections[r];
    const start = positions.length / 3;
    for (let k = 0; k < ringSize; k++) {
      const v = vertex(r, k);
      positions.push(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
    }
    const center = positions.length / 3;
    positions.push(0, (p.yb + p.yTop) / 2, p.z);
    const cy = (p.yb + p.yTop) / 2;
    for (let k = 0; k < ringSize; k++) {
      const a = start + k;
      const b = start + ((k + 1) % ringSize);
      // the ring isn't perfectly star-shaped round the centre (e.g. the step where the lower
      // body meets the wider shoulder line), so orient every triangle by its own winding
      const cross = (positions[a * 3] * (positions[b * 3 + 1] - cy)) - ((positions[a * 3 + 1] - cy) * positions[b * 3]);
      byKind[PAINT].push(...((cross > 0) === facesForward ? [center, a, b] : [center, b, a]));
    }
  };
  cap(0, true);
  cap(sections.length - 1, false);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const index = [];
  byKind.forEach((list, kind) => {
    geometry.addGroup(index.length, list.length, kind);
    index.push(...list);
  });
  geometry.setIndex(index);
  geometry.computeVertexNormals();

  // make sure faces point outwards (flip winding if the first side quad faces in)
  const normal = geometry.getAttribute('normal');
  const probe = vertex(Math.floor(sections.length / 2), 10);
  if (normal.getX(probe) > 0) {
    const idx = geometry.index.array;
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    geometry.computeVertexNormals();
  }
  return geometry;
}

/** Soft round glow (white centre fading out) for the exhaust-flame sprite. */
function glowTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,220,160,0.7)');
  g.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Small helper: geometry transformed in place. */
function place(geometry, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  geometry.scale(sx, sy, sz);
  if (rx) geometry.rotateX(rx);
  if (ry) geometry.rotateY(ry);
  if (rz) geometry.rotateZ(rz);
  geometry.translate(x, y, z);
  return geometry;
}

const box = (w, h, d, opts) => place(new THREE.BoxGeometry(w, h, d), opts);

/** Airfoil-section wing element spanning x, chord along z. */
function wingElement(span, chord, thickness, opts) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(chord * 0.15, thickness, chord * 0.55, thickness * 1.1, chord, thickness * 0.2);
  shape.lineTo(chord, 0);
  shape.bezierCurveTo(chord * 0.6, -thickness * 0.25, chord * 0.2, -thickness * 0.3, 0, 0);
  const g = new THREE.ExtrudeGeometry(shape, { depth: span, bevelEnabled: false, curveSegments: 6 });
  // shape x → −z (leading edge at the front, trailing edge behind), extrusion → x (span)
  g.rotateY(Math.PI / 2);
  g.translate(-span / 2, 0, 0);
  return place(g, opts);
}

/** Black details: intakes, nostrils, louvres, splitter, skirts, diffuser, wing, mirrors' arms. */
function buildTrimDetails() {
  const parts = [
    box(1.66, 0.035, 0.22, { y: 0.13, z: 2.2 }),                   // front splitter
    box(0.62, 0.13, 0.08, { y: 0.3, z: 2.24 }),                    // centre intake
    box(0.34, 0.15, 0.08, { x: 0.58, y: 0.31, z: 2.17 }),          // side intakes
    box(0.34, 0.15, 0.08, { x: -0.58, y: 0.31, z: 2.17 }),
    box(0.3, 0.02, 0.34, { x: 0.3, y: 0.795, z: 1.5, rx: -0.1 }),  // bonnet nostrils
    box(0.3, 0.02, 0.34, { x: -0.3, y: 0.795, z: 1.5, rx: -0.1 }),
    box(1.3, 0.05, 0.42, { y: 0.2, z: -2.08 }),                    // diffuser floor
    ...[-0.46, -0.23, 0.23, 0.46].map(x => box(0.025, 0.1, 0.3, { x, y: 0.25, z: -2.16 })), // diffuser strakes
    box(0.52, 0.13, 0.03, { y: 0.48, z: -2.29 }),                  // number-plate recess
    box(1.5, 0.05, 0.05, { y: 0.29, z: -2.28 }),                   // lower valance lip
    box(1.76, 0.07, 1.6, { y: 0.19, z: -0.1 }),                    // floor / side skirts
    wingElement(1.7, 0.4, 0.055, { y: 1.3, z: -1.86 }),           // main plane
    box(0.018, 0.16, 0.4, { x: 0.86, y: 1.33, z: -2.06 }),         // end plates
    box(0.018, 0.16, 0.4, { x: -0.86, y: 1.33, z: -2.06 }),
    box(0.1, 0.03, 0.18, { x: 0.87, y: 0.92, z: 0.6 }),            // mirror arms
    box(0.1, 0.03, 0.18, { x: -0.87, y: 0.92, z: 0.6 }),
  ];
  // swan-neck struts: rise from the engine cover and hook over the top of the wing
  for (const x of [-0.32, 0.32]) {
    parts.push(box(0.04, 0.4, 0.13, { x, y: 1.13, z: -1.74, rx: 0.3 }));
    parts.push(box(0.04, 0.06, 0.24, { x, y: 1.33, z: -1.9 }));
  }
  // louvres on top of the front fenders, over the wheels
  for (const side of [-1, 1]) {
    for (let k = 0; k < 7; k++) {
      parts.push(box(0.2, 0.012, 0.035, { x: side * 0.66, y: 0.905 - Math.abs(k - 3) * 0.004, z: 0.98 + k * 0.075 }));
    }
  }
  // engine-cover grille slats
  for (let k = 0; k < 6; k++) parts.push(box(0.9, 0.012, 0.04, { y: 0.965 - k * 0.012, z: -1.55 - k * 0.07, rx: 0.3 }));
  return merge(parts);
}

function buildPaintDetails() {
  return merge([
    place(new THREE.SphereGeometry(1, 10, 6), { sx: 0.05, sy: 0.075, sz: 0.13, x: 0.93, y: 0.96, z: 0.6 }),  // mirrors
    place(new THREE.SphereGeometry(1, 10, 6), { sx: 0.05, sy: 0.075, sz: 0.13, x: -0.93, y: 0.96, z: 0.6 }),
  ]);
}

/** A wheel: tyre (lathed), 10-spoke centre-lock rim, disc and caliper. */
function buildWheel(radius, width, side, materials) {
  const group = new THREE.Group();
  const spinner = new THREE.Group();
  group.add(spinner);
  const rimR = radius * 0.72;
  const outer = side * (width / 2);

  const w2 = width / 2;
  const profile = [
    [rimR, -w2], [radius - 0.035, -w2], [radius - 0.008, -w2 + 0.03], [radius, -w2 + 0.07],
    [radius, w2 - 0.07], [radius - 0.008, w2 - 0.03], [radius - 0.035, w2], [rimR, w2],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const tyreGeo = new THREE.LatheGeometry(profile, 26).rotateZ(Math.PI / 2);
  const tyre = new THREE.Mesh(tyreGeo, materials.tyre);
  tyre.castShadow = true;

  const rimParts = [
    place(new THREE.CylinderGeometry(rimR, rimR, width * 0.85, 26, 1, true), { rz: Math.PI / 2 }),
    place(new THREE.TorusGeometry(rimR - 0.01, 0.014, 5, 26), { ry: Math.PI / 2, x: outer * 0.92 }),
    place(new THREE.CylinderGeometry(0.07, 0.08, 0.05, 10), { rz: Math.PI / 2, x: outer * 0.84 }),
  ];
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    const spoke = new THREE.BoxGeometry(0.03, rimR * 0.9, 0.034);
    spoke.translate(0, rimR * 0.45, 0);
    spoke.rotateX(a);
    spoke.translate(outer * 0.82, 0, 0);
    rimParts.push(spoke);
  }
  const rim = new THREE.Mesh(merge(rimParts), materials.rim);
  const nut = new THREE.Mesh(place(new THREE.CylinderGeometry(0.045, 0.045, 0.06, 6), { rz: Math.PI / 2, x: outer * 0.9 }), materials.nut);
  const disc = new THREE.Mesh(place(new THREE.CylinderGeometry(rimR * 0.86, rimR * 0.86, 0.035, 22), { rz: Math.PI / 2, x: outer * 0.35 }), materials.disc);
  spinner.add(tyre, rim, nut, disc);

  // the caliper doesn't spin — it sits at the back of the disc
  const caliper = new THREE.Mesh(box(0.07, rimR * 0.55, rimR * 0.5, { x: outer * 0.48, y: rimR * 0.35, z: -rimR * 0.45, rx: -0.6 }), materials.caliper);
  group.add(caliper);
  return { group, spinner, geometries: [tyreGeo, rim.geometry, nut.geometry, disc.geometry, caliper.geometry] };
}

/** Soft round contact shadow drawn under the car (works with shadows off). */
function contactShadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(0,0,0,0.6)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

/**
 * Builds the car. `renderer` is used once to bake a studio reflection map so
 * the clear-coat paint, glass and rims have something to reflect.
 */
export function createCar(paintHex, renderer) {
  const disposables = [];
  const keep = (x) => {
    disposables.push(x);
    return x;
  };

  let envMap = null;
  if (renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    envMap = keep(pmrem.fromScene(room, 0.04).texture);
    room.dispose?.();
    pmrem.dispose();
  }

  const materials = {
    paint: keep(new THREE.MeshPhysicalMaterial({
      color: paintHex, metalness: 0.25, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.12, envMap, envMapIntensity: 0.55,
    })),
    glass: keep(new THREE.MeshPhysicalMaterial({ color: 0x0c131b, metalness: 0.1, roughness: 0.04, clearcoat: 1, envMap, envMapIntensity: 1.2 })),
    trim: keep(new THREE.MeshStandardMaterial({ color: 0x131417, roughness: 0.55, metalness: 0.25, envMap, envMapIntensity: 0.5 })),
    tyre: keep(new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.92, metalness: 0 })),
    rim: keep(new THREE.MeshStandardMaterial({ color: 0x3b3e44, roughness: 0.3, metalness: 0.85, envMap, envMapIntensity: 1 })),
    nut: keep(new THREE.MeshStandardMaterial({ color: 0xc41d1d, roughness: 0.35, metalness: 0.5 })),
    disc: keep(new THREE.MeshStandardMaterial({ color: 0x7b7f86, roughness: 0.45, metalness: 0.7, envMap })),
    caliper: keep(new THREE.MeshStandardMaterial({ color: 0xf0c000, roughness: 0.4, metalness: 0.2 })),
    lens: keep(new THREE.MeshPhysicalMaterial({ color: 0xdfe7ee, metalness: 0.6, roughness: 0.05, clearcoat: 1, envMap })),
    head: keep(new THREE.MeshBasicMaterial({ color: 0xffffff })),
    tail: keep(new THREE.MeshBasicMaterial({ color: 0x7a1414 })),
    reverse: keep(new THREE.MeshBasicMaterial({ color: 0x555555 })),
  };

  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const shell = new THREE.Mesh(keep(buildBody()), [materials.paint, materials.glass, materials.trim]);
  shell.castShadow = true;
  const trim = new THREE.Mesh(keep(buildTrimDetails()), materials.trim);
  trim.castShadow = true;
  const paintDetails = new THREE.Mesh(keep(buildPaintDetails()), materials.paint);
  body.add(shell, trim, paintDetails);

  // round headlights set into the fender fronts, with a 4-point DRL inside
  const lensGeo = keep(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2));
  const drlGeo = keep(new THREE.TorusGeometry(0.075, 0.012, 4, 20));
  for (const side of [-1, 1]) {
    const lamp = new THREE.Group();
    lamp.position.set(side * 0.64, 0.66, 2.06);
    lamp.rotation.x = 1.2; // upright, looking forward and slightly up, like the 911's frog-eye lamps
    const lens = new THREE.Mesh(lensGeo, materials.lens);
    lens.scale.set(0.16, 0.07, 0.16);
    const drl = new THREE.Mesh(drlGeo, materials.head);
    drl.rotation.x = Math.PI / 2;
    drl.position.y = 0.035;
    lamp.add(lens, drl);
    body.add(lamp);
  }
  // full-width tail-light bar and reverse lights
  // all on the flat tail face (z −2.29), standing just proud of it so they're never buried
  const tailBar = new THREE.Mesh(keep(box(1.3, 0.035, 0.03, { y: 0.69, z: -2.3 })), materials.tail);
  const tailEnds = new THREE.Mesh(keep(merge([
    box(0.22, 0.08, 0.03, { x: 0.6, y: 0.67, z: -2.3 }),
    box(0.22, 0.08, 0.03, { x: -0.6, y: 0.67, z: -2.3 }),
  ])), materials.tail);
  const reverseLights = new THREE.Mesh(keep(merge([
    box(0.12, 0.04, 0.03, { x: 0.4, y: 0.36, z: -2.3 }),
    box(0.12, 0.04, 0.03, { x: -0.4, y: 0.36, z: -2.3 }),
  ])), materials.reverse);
  // twin centre exhausts
  const exhaust = new THREE.Mesh(keep(merge([
    place(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 12), { rx: Math.PI / 2, x: 0.09, y: 0.36, z: -2.3 }),
    place(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 12), { rx: Math.PI / 2, x: -0.09, y: 0.36, z: -2.3 }),
  ])), materials.disc);
  body.add(tailBar, tailEnds, reverseLights, exhaust);

  // rear-wing flap on its own hinge (leading edge): it doubles as the air brake, standing
  // up under hard braking at speed
  const flapHinge = new THREE.Group();
  flapHinge.position.set(0, 1.37, -2.17);
  flapHinge.rotation.x = -0.3;
  const flap = new THREE.Mesh(keep(wingElement(1.66, 0.17, 0.035, {})), materials.trim);
  flap.castShadow = true;
  flapHinge.add(flap);
  body.add(flapHinge);

  // exhaust flames: an orange outer cone and a blue-white core per pipe, plus a glow,
  // shown for backfires (pops, bangs, over-revs). Cones are built with the base at the
  // pipe tip and the point along −z, so scaling z stretches the flame out behind the car.
  const flameCone = (radius, length) => {
    const g = new THREE.ConeGeometry(radius, length, 10, 1, true);
    g.translate(0, length / 2, 0);
    g.rotateX(-Math.PI / 2);
    return keep(g);
  };
  const flameMat = (color) => keep(new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  }));
  const outerMat = flameMat(0xff6a1f);
  const coreMat = flameMat(0x9fc8ff);
  const glowMat = keep(new THREE.SpriteMaterial({
    map: keep(glowTexture()), color: 0xff8a3a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
  const outerGeo = flameCone(0.075, 1);
  const coreGeo = flameCone(0.04, 0.45);
  const flames = [0.09, -0.09].map((x) => {
    const holder = new THREE.Group();
    holder.position.set(x, 0.36, -2.36);
    const outer = new THREE.Mesh(outerGeo, outerMat);
    const core = new THREE.Mesh(coreGeo, coreMat);
    const glow = new THREE.Sprite(glowMat);
    glow.scale.setScalar(0.5);
    glow.position.z = -0.08;
    holder.add(outer, core, glow);
    holder.visible = false;
    body.add(holder);
    return { holder, outer, core, glow };
  });
  const flameLight = new THREE.PointLight(0xff7a2a, 0, 7, 2);
  flameLight.position.set(0, 0.45, -2.7);
  body.add(flameLight);

  const D = CAR_DIMENSIONS;
  const wheels = [];
  for (const [side, front] of [[-1, true], [1, true], [-1, false], [1, false]]) {
    const radius = front ? D.frontRadius : D.rearRadius;
    const wheel = buildWheel(radius, front ? 0.27 : 0.33, side, materials);
    wheel.geometries.forEach(keep);
    wheel.group.position.set(side * (front ? D.frontTrack : D.rearTrack), radius, front ? D.frontAxleZ : D.rearAxleZ);
    group.add(wheel.group);
    wheels.push({ ...wheel, front, radius });
  }

  const shadowTexture = keep(contactShadowTexture());
  const shadowMat = keep(new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }));
  const contactShadow = new THREE.Mesh(keep(new THREE.PlaneGeometry(2.5, 5.2).rotateX(-Math.PI / 2)), shadowMat);
  contactShadow.position.y = 0.03;
  contactShadow.renderOrder = 1;
  group.add(contactShadow);

  const beam = new THREE.SpotLight(0xfff3dc, 0, 90, 0.5, 0.6, 1.3);
  beam.position.set(0, 0.7, 2.1);
  beam.target.position.set(0, -0.5, 16);
  group.add(beam, beam.target);

  let frontSpin = 0;
  let rearSpin = 0;

  return {
    group,
    body,
    setPaint(hex) {
      materials.paint.color.setHex(hex);
    },
    /**
     * steerAngle: rad (+ = right) · speed: m/s forward (front wheels) ·
     * rearSpeed: rear wheel surface speed (differs while spinning or locked) ·
     * brake 0–1 · night 0–1 · reversing
     */
    update(dt, { steerAngle, speed, rearSpeed = speed, brake, night, reversing, flame = 0, airbrake = 0 }) {
      // flap: −0.3 rad cruising (trailing edge down), up to ~+1.0 rad as an air brake
      flapHinge.rotation.x = -0.3 + airbrake * 1.3;
      const lit = flame > 0.03;
      for (const f of flames) {
        f.holder.visible = lit;
        if (!lit) continue;
        // flicker: every frame a slightly different length and width
        const len = (0.35 + flame * 0.75) * (0.75 + Math.random() * 0.45);
        const wide = 0.8 + flame * 0.5 + Math.random() * 0.25;
        f.outer.scale.set(wide, wide, len);
        f.core.scale.set(wide * 0.9, wide * 0.9, len * (0.8 + Math.random() * 0.4));
        f.glow.scale.setScalar(0.35 + flame * 0.5);
      }
      outerMat.opacity = Math.min(1, flame * 1.1);
      coreMat.opacity = Math.min(1, flame * 0.9);
      glowMat.opacity = Math.min(1, flame * 0.9);
      flameLight.intensity = lit ? flame * (1.2 + night * 3) : 0;
      frontSpin += (speed / D.frontRadius) * dt;
      rearSpin += (rearSpeed / D.rearRadius) * dt;
      for (const w of wheels) {
        w.spinner.rotation.x = w.front ? frontSpin : rearSpin;
        if (w.front) w.group.rotation.y = -steerAngle;
      }
      beam.intensity = night * 55;
      const env = 0.25 + (1 - night) * 0.75;
      materials.paint.envMapIntensity = 0.55 * env;
      materials.glass.envMapIntensity = 1.2 * env;
      materials.rim.envMapIntensity = env;
      const tail = 0.4 + night * 0.5 + brake * 1.5;
      materials.tail.color.setRGB(tail, tail * 0.06, tail * 0.06);
      const rev = reversing ? 1.4 : 0.2;
      materials.reverse.color.setRGB(rev, rev, rev);
      const drl = 1 + night * 0.6;
      materials.head.color.setRGB(drl, drl, drl * 0.96);
    },
    dispose() {
      beam.dispose();
      disposables.forEach(d => d.dispose());
    },
  };
}
