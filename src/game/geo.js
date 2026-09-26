/**
 * Geometry merging helpers. The world is drawn as a handful of big merged
 * meshes (one per chunk) with baked vertex colours, which keeps draw calls low.
 *
 * Prototype parts carry their own normals — smooth for organic shapes (tree
 * canopies, cacti), flat for built things — and a per-vertex shade that fakes
 * sky light and ambient occlusion (darker undersides, lighter tops, a little
 * mottling), so objects read as rounded and lit rather than flat polygons.
 * The builder also reports vertex ranges, which lets a single object be cut
 * back out of a merged chunk later (when it gets knocked down).
 */
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const NEUTRAL = [0.8, 0.8, 0.8];

/** Small deterministic hash → [0, 1) for a 3D point (stable mottling and lumps). */
function hash3(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Smooth-ish 3D value noise from the hash (for lumpy canopies and rocks). */
function lumpNoise(x, y, z) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const sz = fz * fz * (3 - 2 * fz);
  let v = 0;
  for (let dz = 0; dz <= 1; dz++) {
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        const w = (dx ? sx : 1 - sx) * (dy ? sy : 1 - sy) * (dz ? sz : 1 - sz);
        v += w * hash3(ix + dx, iy + dy, iz + dz);
      }
    }
  }
  return v;
}

/** Accumulates non-indexed triangles with normals, per-vertex colours (and optional UVs). */
export class GeoBuilder {
  constructor({ uv = false } = {}) {
    this.positions = [];
    this.normals = [];
    this.colors = [];
    this.uvs = uv ? [] : null;
  }

  get vertexCount() {
    return this.positions.length / 3;
  }

  vertex(x, y, z, c, u = 0, v = 0, nx = 0, ny = 1, nz = 0) {
    this.positions.push(x, y, z);
    this.normals.push(nx, ny, nz);
    this.colors.push(c[0], c[1], c[2]);
    if (this.uvs) this.uvs.push(u, v);
  }

  /**
   * Quad a-b-c-d (counter-clockwise seen from the front) as two triangles with a flat normal.
   * `uv` is optional [[u,v] ×4] for the four corners.
   */
  quad(a, b, c, d, color, uv) {
    const [ua, ub, uc, ud] = uv ?? [[0, 0], [0, 0], [0, 0], [0, 0]];
    const e1x = b[0] - a[0];
    const e1y = b[1] - a[1];
    const e1z = b[2] - a[2];
    const e2x = c[0] - a[0];
    const e2y = c[1] - a[1];
    const e2z = c[2] - a[2];
    let nx = e1y * e2z - e1z * e2y;
    let ny = e1z * e2x - e1x * e2z;
    let nz = e1x * e2y - e1y * e2x;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    this.vertex(a[0], a[1], a[2], color, ua[0], ua[1], nx, ny, nz);
    this.vertex(b[0], b[1], b[2], color, ub[0], ub[1], nx, ny, nz);
    this.vertex(c[0], c[1], c[2], color, uc[0], uc[1], nx, ny, nz);
    this.vertex(a[0], a[1], a[2], color, ua[0], ua[1], nx, ny, nz);
    this.vertex(c[0], c[1], c[2], color, uc[0], uc[1], nx, ny, nz);
    this.vertex(d[0], d[1], d[2], color, ud[0], ud[1], nx, ny, nz);
  }

  /**
   * Appends a prototype (see `makePart`) transformed by position / y-rotation / scale.
   * `tint` replaces the colour of parts marked `tint: true` (or `tint: 'alt'` → `alt`);
   * `jitter` varies brightness. Returns the vertex range [start, end) it wrote.
   */
  add(proto, x, y, z, rotY = 0, sx = 1, sy = sx, sz = sx, tint = null, jitter = 0, alt = null) {
    const start = this.vertexCount;
    tmpQuat.setFromAxisAngle(Y_AXIS, rotY);
    tmpMatrix.compose(tmpPos.set(x, y, z), tmpQuat, tmpScale.set(sx, sy, sz));
    const e = tmpMatrix.elements;
    const k = 1 + jitter;
    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    for (const part of proto) {
      const src = part.positions;
      const nrm = part.normals;
      const shade = part.shades;
      const base = (part.tint === 'alt' && alt) || (part.tint === true && tint) || part.color || NEUTRAL;
      for (let i = 0, v = 0; i < src.length; i += 3, v++) {
        const px = src[i];
        const py = src[i + 1];
        const pz = src[i + 2];
        this.positions.push(
          e[0] * px + e[4] * py + e[8] * pz + e[12],
          e[1] * px + e[5] * py + e[9] * pz + e[13],
          e[2] * px + e[6] * py + e[10] * pz + e[14]
        );
        // normals: inverse-transpose of rotate·scale = rotate·(1/scale)
        const nx = nrm[i] / sx;
        const ny = nrm[i + 1] / sy;
        const nz = nrm[i + 2] / sz;
        const rx = cos * nx + sin * nz;
        const rz = -sin * nx + cos * nz;
        const len = Math.hypot(rx, ny, rz) || 1;
        this.normals.push(rx / len, ny / len, rz / len);
        const m = k * shade[v];
        this.colors.push(base[0] * m, base[1] * m, base[2] * m);
        if (this.uvs) this.uvs.push(0, 0);
      }
    }
    return [start, this.vertexCount];
  }

  /** Builds the BufferGeometry from the accumulated vertices. */
  build() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    if (this.uvs) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geometry.computeBoundingSphere();
    return geometry;
  }
}

/**
 * Turns a three.js geometry into a reusable prototype part with one colour.
 * Options:
 *  • tint (true | 'alt'), offsets x/y/z, scales sx/sy/sz, rotations rx/ry/rz (radians)
 *  • smooth — rounded shading (normals averaged across the surface) instead of facets
 *  • lumps — organic displacement along the surface normal (fraction of size), for canopies/rocks
 *  • shade — [bottom, top] brightness across the part's height (fake sky light / occlusion)
 *  • mottle — random per-vertex brightness variation (0–0.3)
 *  • seed — varies the lumps/mottle pattern between otherwise identical parts
 */
export function makePart(geometry, color, {
  tint = false, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0, ry = 0,
  smooth = false, lumps = 0, shade = null, mottle = 0, seed = 0,
} = {}) {
  let g = geometry;
  if (smooth || lumps) {
    // weld the surface so normals (and lumps) are shared across faces
    g.deleteAttribute('normal');
    g.deleteAttribute('uv');
    const welded = mergeVertices(g, 1e-4);
    if (welded !== g) {
      g.dispose();
      g = welded;
    }
    if (lumps) {
      g.computeBoundingSphere();
      const r = g.boundingSphere.radius || 1;
      g.computeVertexNormals();
      const pos = g.getAttribute('position');
      const nor = g.getAttribute('normal');
      const f = 2.2 / r;
      for (let i = 0; i < pos.count; i++) {
        const px = pos.getX(i);
        const py = pos.getY(i);
        const pz = pos.getZ(i);
        const d = (lumpNoise(px * f + seed * 7.1, py * f + seed * 3.3, pz * f) - 0.5) * 2 * lumps * r;
        pos.setXYZ(i, px + nor.getX(i) * d, py + nor.getY(i) * d, pz + nor.getZ(i) * d);
      }
    }
  }
  g.scale(sx, sy, sz);
  if (rx) g.rotateX(rx);
  if (rz) g.rotateZ(rz);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  if (smooth) g.computeVertexNormals();
  const flat = g.index ? g.toNonIndexed() : g;
  if (!smooth) flat.computeVertexNormals(); // non-indexed → one normal per face
  const positions = Array.from(flat.getAttribute('position').array);
  const normals = Array.from(flat.getAttribute('normal').array);

  // per-vertex shade: vertical gradient × mottling
  const count = positions.length / 3;
  const shades = new Float32Array(count).fill(1);
  if (shade || mottle) {
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 1; i < positions.length; i += 3) {
      minY = Math.min(minY, positions[i]);
      maxY = Math.max(maxY, positions[i]);
    }
    const span = maxY - minY || 1;
    for (let v = 0; v < count; v++) {
      const px = positions[v * 3];
      const py = positions[v * 3 + 1];
      const pz = positions[v * 3 + 2];
      let s = 1;
      if (shade) {
        const t = (py - minY) / span;
        s *= shade[0] + (shade[1] - shade[0]) * t;
      }
      if (mottle) s *= 1 + (hash3(px * 3.1 + seed, py * 3.1, pz * 3.1) - 0.5) * 2 * mottle;
      shades[v] = s;
    }
  }
  if (flat !== g) flat.dispose();
  g.dispose();
  if (g !== geometry) geometry.dispose();
  return { positions, normals, shades, color, tint };
}

/** Deterministic value-noise canvas texture (grain for asphalt / ground detail). */
export function noiseTexture({ size = 256, base = 128, spread = 40, blobs = 0, seed = 1, repeat = true }) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < size * size; i++) {
    const v = base + (rand() - 0.5) * spread;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // soft blotches (patched asphalt, ground variation)
  for (let i = 0; i < blobs; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 10 + rand() * size * 0.18;
    const light = rand() > 0.5;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, light ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.12)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Soft radial glow sprite (white centre fading out) used for light pools and glows. */
export function glowTexture(size = 128, inner = 0.25) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(inner, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
