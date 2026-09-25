/**
 * Geometry merging helpers. The world is drawn as a handful of big merged
 * meshes (one per chunk) with baked vertex colours, which keeps draw calls low.
 */
import * as THREE from 'three';

const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const NEUTRAL = [0.8, 0.8, 0.8];

/** Accumulates non-indexed triangles with per-vertex colours. */
export class GeoBuilder {
  constructor() {
    this.positions = [];
    this.colors = [];
  }

  get vertexCount() {
    return this.positions.length / 3;
  }

  vertex(x, y, z, c) {
    this.positions.push(x, y, z);
    this.colors.push(c[0], c[1], c[2]);
  }

  /** Quad a-b-c-d (counter-clockwise seen from the front) as two triangles. */
  quad(a, b, c, d, color) {
    this.vertex(a[0], a[1], a[2], color);
    this.vertex(b[0], b[1], b[2], color);
    this.vertex(c[0], c[1], c[2], color);
    this.vertex(a[0], a[1], a[2], color);
    this.vertex(c[0], c[1], c[2], color);
    this.vertex(d[0], d[1], d[2], color);
  }

  /**
   * Appends a prototype (see `makePart`) transformed by position / y-rotation / scale.
   * `tint` replaces the colour of parts marked `tint: true`; `jitter` varies brightness.
   */
  add(proto, x, y, z, rotY = 0, sx = 1, sy = sx, sz = sx, tint = null, jitter = 0) {
    tmpQuat.setFromAxisAngle(Y_AXIS, rotY);
    tmpMatrix.compose(tmpPos.set(x, y, z), tmpQuat, tmpScale.set(sx, sy, sz));
    const e = tmpMatrix.elements;
    for (const part of proto) {
      const src = part.positions;
      const base = (part.tint && tint) || part.color || NEUTRAL;
      const k = 1 + jitter;
      const r = base[0] * k;
      const g = base[1] * k;
      const b = base[2] * k;
      for (let i = 0; i < src.length; i += 3) {
        const px = src[i];
        const py = src[i + 1];
        const pz = src[i + 2];
        this.positions.push(
          e[0] * px + e[4] * py + e[8] * pz + e[12],
          e[1] * px + e[5] * py + e[9] * pz + e[13],
          e[2] * px + e[6] * py + e[10] * pz + e[14]
        );
        this.colors.push(r, g, b);
      }
    }
  }

  /** Builds the BufferGeometry (flat normals, since every triangle owns its vertices). */
  build() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }
}

/** Turns a three.js geometry into a reusable prototype part with one colour. */
export function makePart(geometry, color, { tint = false, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.scale(sx, sy, sz);
  g.translate(x, y, z);
  const positions = Array.from(g.getAttribute('position').array);
  g.dispose();
  if (g !== geometry) geometry.dispose();
  return { positions, color, tint };
}
