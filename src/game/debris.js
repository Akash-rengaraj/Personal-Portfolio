/**
 * Knocked-down scenery. A broken object's triangles become a rigid body that tumbles
 * under gravity, bounces and slides on the terrain through impulse contacts at its hull
 * points (with friction, so a snapped tree pivots on its base and topples), settles and
 * falls asleep. The car shoves bodies it drives into (one-way: the car already paid for
 * the hit when it broke them). Particle bursts add leaves, splinters, sparks, shards,
 * chips, straw and dust. Ground impacts are reported to `world.events` for sound.
 */
import * as THREE from 'three';

const G = 9.81;
const SUBSTEP = 1 / 120;
const MAX_BODIES = 30;
const FAR = 260;          // bodies this far from the car are cleared away
const CAR_HALF = 1.3;     // the car's body: a capsule of radius 0.98 over ±1.3 m along its heading
const CAR_RADIUS = 0.98;
const CAR_HEIGHT = 1.25;

/** 26 directions; the most extreme vertex along each makes up a body's contact hull. */
const HULL_DIRS = [];
for (let dx = -1; dx <= 1; dx++) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dy && !dz) continue;
      const l = Math.hypot(dx, dy, dz);
      HULL_DIRS.push([dx / l, dy / l, dz / l]);
    }
  }
}

/** Contact behaviour and break particles per material. */
const MATERIALS = {
  wood: { friction: 0.75, bounce: 0.15, chips: [[0.42, 0.29, 0.18], [0.62, 0.47, 0.3]] },
  metal: { friction: 0.45, bounce: 0.25, chips: [[0.45, 0.47, 0.5], [0.3, 0.32, 0.35]], sparks: true },
  plastic: { friction: 0.5, bounce: 0.35, chips: [[0.94, 0.94, 0.9], [1, 0.55, 0.12]] },
  stone: { friction: 0.85, bounce: 0.1, chips: [[0.9, 0.89, 0.85], [0.62, 0.6, 0.57]], dust: true },
  hay: { friction: 0.9, bounce: 0.05, chips: [[0.85, 0.7, 0.36], [0.76, 0.6, 0.3]], straw: true },
  plant: { friction: 0.8, bounce: 0.1, chips: [[0.31, 0.54, 0.27], [0.25, 0.45, 0.22]] },
};

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpM4 = new THREE.Matrix4();
const tmpM3 = new THREE.Matrix3();

/* ─── particles ─────────────────────────────────────────── */

const PARTICLE_VERTEX = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aAlpha;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = max(1.5, aSize * (320.0 / max(1.0, -mv.z)));
    gl_Position = projectionMatrix * mv;
  }
`;
const PARTICLE_FRAGMENT = /* glsl */ `
  uniform float hard;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, mix(0.1, 0.38, hard), d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
    #include <colorspace_fragment>
  }
`;

/** A pool of point particles (leaves, chips, sparks, dust) in one draw call. */
class Particles {
  constructor(scene, count, { additive = false, hard = 1 } = {}) {
    this.count = count;
    this.pos = new Float32Array(count * 3);
    this.col = new Float32Array(count * 3);
    this.size = new Float32Array(count);
    this.alpha = new Float32Array(count);
    this.vel = new Float32Array(count * 3);
    this.age = new Float32Array(count).fill(1);
    this.life = new Float32Array(count).fill(1);
    this.drag = new Float32Array(count);
    this.grav = new Float32Array(count);
    this.floor = new Float32Array(count);
    this.flutter = new Float32Array(count);
    this.grow = new Float32Array(count);
    this.base = new Float32Array(count);
    this.peak = new Float32Array(count);
    this.next = 0;
    this.live = 0;
    const geometry = new THREE.BufferGeometry();
    const dyn = (array, size) => new THREE.BufferAttribute(array, size).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', dyn(this.pos, 3));
    geometry.setAttribute('aColor', dyn(this.col, 3));
    geometry.setAttribute('aSize', dyn(this.size, 1));
    geometry.setAttribute('aAlpha', dyn(this.alpha, 1));
    this.geometry = geometry;
    this.material = new THREE.ShaderMaterial({
      uniforms: { hard: { value: hard } },
      vertexShader: PARTICLE_VERTEX,
      fragmentShader: PARTICLE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.visible = false;
    this.scene = scene;
    scene.add(this.points);
  }

  /**
   * One particle. `o`: { x, y, z, vx, vy, vz, color, size, life, drag, gravity, floor,
   * flutter, grow, alpha }.
   */
  emit(o) {
    const i = this.next;
    this.next = (this.next + 1) % this.count;
    this.pos.set([o.x, o.y, o.z], i * 3);
    this.vel.set([o.vx, o.vy, o.vz], i * 3);
    this.col.set(o.color, i * 3);
    this.base[i] = o.size;
    this.size[i] = o.size;
    this.age[i] = 0;
    this.life[i] = o.life;
    this.drag[i] = o.drag ?? 0.3;
    this.grav[i] = o.gravity ?? G;
    this.floor[i] = o.floor;
    this.flutter[i] = o.flutter ?? 0;
    this.grow[i] = o.grow ?? 0;
    this.peak[i] = o.alpha ?? 1;
    this.alpha[i] = 0;
  }

  update(dt) {
    let live = 0;
    for (let i = 0; i < this.count; i++) {
      if (this.age[i] >= this.life[i]) {
        this.alpha[i] = 0;
        continue;
      }
      live++;
      this.age[i] += dt;
      const t = this.age[i] / this.life[i];
      const k = i * 3;
      const drag = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[k] *= drag;
      this.vel[k + 1] = this.vel[k + 1] * drag - this.grav[i] * dt;
      this.vel[k + 2] *= drag;
      if (this.flutter[i]) {
        // leaves see-saw as they drift down
        const f = this.flutter[i];
        this.vel[k] += Math.sin(this.age[i] * 6.3 + i) * f * dt;
        this.vel[k + 2] += Math.cos(this.age[i] * 5.1 + i * 1.7) * f * dt;
      }
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      if (this.pos[k + 1] < this.floor[i]) {
        this.pos[k + 1] = this.floor[i];
        this.vel[k + 1] *= -0.25;
        this.vel[k] *= 0.4;
        this.vel[k + 2] *= 0.4;
        this.flutter[i] = 0;
      }
      this.size[i] = this.base[i] * (1 + this.grow[i] * t);
      this.alpha[i] = this.peak[i] * Math.min(1, t * 20) * Math.min(1, (1 - t) * 4);
    }
    this.live = live;
    this.points.visible = live > 0;
    if (live > 0) {
      const a = this.geometry.attributes;
      a.position.needsUpdate = true;
      a.aColor.needsUpdate = true;
      a.aSize.needsUpdate = true;
      a.aAlpha.needsUpdate = true;
    }
  }

  dispose() {
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
  }
}

/* ─── rigid bodies ──────────────────────────────────────── */

/** v += J / m; ω += I⁻¹ (r × J) — impulse J applied at offset r from the centre of mass. */
function applyImpulse(body, rx, ry, rz, jx, jy, jz) {
  body.v.x += jx * body.invMass;
  body.v.y += jy * body.invMass;
  body.v.z += jz * body.invMass;
  tmpA.set(ry * jz - rz * jy, rz * jx - rx * jz, rx * jy - ry * jx).applyMatrix3(body.invInertia);
  body.w.add(tmpA);
}

/** Inverse effective mass of the body along unit direction n at offset r. */
function inverseMassAlong(body, rx, ry, rz, nx, ny, nz) {
  tmpA.set(ry * nz - rz * ny, rz * nx - rx * nz, rx * ny - ry * nx).applyMatrix3(body.invInertia);
  // (I⁻¹(r × n) × r) · n
  const cx = tmpA.y * rz - tmpA.z * ry;
  const cy = tmpA.z * rx - tmpA.x * rz;
  const cz = tmpA.x * ry - tmpA.y * rx;
  return body.invMass + cx * nx + cy * ny + cz * nz;
}

class Body {
  constructor({ group, mass, inertiaBody, hull, radius, material, leaves, rooted }) {
    this.group = group;
    this.p = group.position;
    this.q = group.quaternion;
    this.v = new THREE.Vector3();
    this.w = new THREE.Vector3();
    this.mass = mass;
    this.invMass = 1 / mass;
    this.invInertiaBody = inertiaBody.clone().invert();
    this.invInertia = new THREE.Matrix3();
    this.R = new THREE.Matrix3();
    this.hull = hull;                 // local hull points (x, y, z …)
    this.world = new Float32Array(hull.length);
    this.groundX = new Float32Array(hull.length / 3).fill(Infinity);
    this.groundZ = new Float32Array(hull.length / 3);
    this.groundY = new Float32Array(hull.length / 3);
    this.contacts = [];
    this.radius = radius;
    this.material = MATERIALS[material] ?? MATERIALS.wood;
    this.materialName = material;
    this.leaves = leaves;
    this.rooted = rooted;
    this.age = 0;
    this.still = 0;
    this.asleep = false;
    this.lastThud = -1;
    this.drag = 0.004 + 0.05 / mass; // light things (plastic posts) slow down in the air
    this.pushDelay = rooted ? 0.9 : 0.12;
    this.updateFrame();
  }

  /** Rotation matrix, world-space inverse inertia and world hull points from p / q. */
  updateFrame() {
    this.R.setFromMatrix4(tmpM4.makeRotationFromQuaternion(this.q));
    tmpM3.copy(this.R).transpose();
    this.invInertia.multiplyMatrices(this.R, this.invInertiaBody).multiply(tmpM3);
    const e = this.R.elements;
    const h = this.hull;
    const out = this.world;
    for (let i = 0; i < h.length; i += 3) {
      const x = h[i];
      const y = h[i + 1];
      const z = h[i + 2];
      out[i] = e[0] * x + e[3] * y + e[6] * z;
      out[i + 1] = e[1] * x + e[4] * y + e[7] * z;
      out[i + 2] = e[2] * x + e[5] * y + e[8] * z;
    }
  }

  wake() {
    this.asleep = false;
    this.still = 0;
  }
}

export class Debris {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.bodies = [];
    this.maxBodies = MAX_BODIES; // the graphics tier lowers it
    this.particles = new Particles(scene, 900, { hard: 0.8 });
    this.sparks = new Particles(scene, 260, { additive: true, hard: 0.3 });
    this.dust = new Particles(scene, 120, { hard: 0 });
    this.time = 0;
  }

  /** Terrain height under hull point k of a body (cached while the point barely moves). */
  ground(body, k, x, z) {
    if (Math.abs(body.groundX[k] - x) + Math.abs(body.groundZ[k] - z) > 0.3) {
      body.groundX[k] = x;
      body.groundZ[k] = z;
      body.groundY[k] = this.world.groundHeight(x, z);
    }
    return body.groundY[k];
  }

  /**
   * Creates a rigid body from mesh pieces cut out of the world (`parts`: [{ positions,
   * normals, colors, material }], world space), for obstacle `o` knocked down by `hit`.
   * Returns the impulse of the hit (what the car takes, back along the contact normal).
   */
  spawn(parts, o, hit) {
    while (this.bodies.length >= this.maxBodies) {
      const oldest = this.bodies.find(b => b.asleep) ?? this.bodies[0];
      this.remove(oldest);
    }
    // Mass spread over the surface (each triangle weighted by its area): a lamp's pole
    // outweighs its head, a tree's trunk and canopy share it sensibly. Centre of mass first.
    const weights = parts.map((part) => {
      const p = part.positions;
      const w = new Float32Array(p.length / 9);
      for (let t = 0, i = 0; i < p.length; t++, i += 9) {
        const ax = p[i + 3] - p[i], ay = p[i + 4] - p[i + 1], az = p[i + 5] - p[i + 2];
        const bx = p[i + 6] - p[i], by = p[i + 7] - p[i + 1], bz = p[i + 8] - p[i + 2];
        w[t] = 0.5 * Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx);
      }
      return w;
    });
    let area = 0;
    let cx = 0;
    let cy = 0;
    let cz = 0;
    parts.forEach((part, k) => {
      const p = part.positions;
      weights[k].forEach((w, t) => {
        const i = t * 9;
        area += w;
        cx += (w * (p[i] + p[i + 3] + p[i + 6])) / 3;
        cy += (w * (p[i + 1] + p[i + 4] + p[i + 7])) / 3;
        cz += (w * (p[i + 2] + p[i + 5] + p[i + 8])) / 3;
      });
    });
    const fallback = hit.impact / (hit.carInverseMass + 1 / Math.min(o.mass * (o.rooted ? 1.3 : 1), 600));
    if (area <= 0) return fallback;
    cx /= area;
    cy /= area;
    cz /= area;
    const mass = o.mass;
    let ixx = 0, iyy = 0, izz = 0, ixy = 0, ixz = 0, iyz = 0, radius = 0;
    const hullBest = HULL_DIRS.map(() => -Infinity);
    const hullPoint = HULL_DIRS.map(() => null);
    parts.forEach((part, k) => {
      const p = part.positions;
      const w = weights[k];
      for (let i = 0; i < p.length; i += 3) {
        const mi = (mass * w[Math.floor(i / 9)]) / (3 * area);
        const x = p[i] - cx;
        const y = p[i + 1] - cy;
        const z = p[i + 2] - cz;
        p[i] = x;
        p[i + 1] = y;
        p[i + 2] = z;
        ixx += mi * (y * y + z * z);
        iyy += mi * (x * x + z * z);
        izz += mi * (x * x + y * y);
        ixy -= mi * x * y;
        ixz -= mi * x * z;
        iyz -= mi * y * z;
        radius = Math.max(radius, Math.hypot(x, y, z));
        HULL_DIRS.forEach(([dx, dy, dz], h) => {
          const s = x * dx + y * dy + z * dz;
          if (s > hullBest[h]) {
            hullBest[h] = s;
            hullPoint[h] = [x, y, z];
          }
        });
      }
    });
    const pad = mass * (0.02 + radius * radius * 0.01); // keeps thin objects from spinning wildly
    const inertiaBody = new THREE.Matrix3().set(
      ixx + pad, ixy, ixz,
      ixy, iyy + pad, iyz,
      ixz, iyz, izz + pad,
    );
    const hull = [];
    const seen = new Set();
    for (const p of hullPoint) {
      const key = p.map(v => v.toFixed(2)).join();
      if (seen.has(key)) continue;
      seen.add(key);
      hull.push(...p);
    }

    const group = new THREE.Group();
    group.position.set(cx, cy, cz);
    for (const part of parts) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(part.positions, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(part.normals, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(part.colors, 3));
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, part.material);
      mesh.castShadow = part.material.type !== 'MeshBasicMaterial';
      mesh.receiveShadow = mesh.castShadow;
      group.add(mesh);
    }
    this.scene.add(group);
    const body = new Body({
      group, mass, inertiaBody, hull: new Float32Array(hull), radius,
      material: o.material, leaves: o.leaves, rooted: o.rooted,
    });
    body.id = o.id;

    // where the car sends it: along the contact normal, leaning toward the car's travel
    const speed = Math.hypot(hit.vx, hit.vz) || 1;
    let dx = -hit.nx + (0.6 * hit.vx) / speed;
    let dz = -hit.nz + (0.6 * hit.vz) / speed;
    const dl = Math.hypot(dx, dz) || 1;
    dx /= dl;
    dz /= dl;
    const [bx, by, bz] = o.base;
    let impulse = fallback;
    if (o.rooted) {
      // Snapped at the base: most of the hit goes into breaking it (the roots hold), and the
      // trunk topples about its base toward dir, the base dragged along a little.
      const spin = Math.min(2.4, Math.max(0.7, 0.45 + hit.impact / 22));
      body.w.set(dz * spin, (Math.random() - 0.5) * 0.5, -dx * spin);
      tmpB.set(cx - bx, cy - by, cz - bz);
      body.v.copy(body.w).cross(tmpB);
      const drag = Math.min(hit.impact * 0.1, 2.5);
      body.v.x += dx * drag;
      body.v.z += dz * drag;
    } else {
      // Free things take the impulse where the bumper struck them. The impulse comes from both
      // bodies' effective mass at the contact: a tall lamp post struck at its foot is light
      // there (it swings up about its middle), so it costs the car little and cartwheels.
      const rx = hit.x - cx;
      const ry = by + 0.55 - cy;
      const rz = hit.z - cz;
      const nx = -hit.nx;
      const nz = -hit.nz;
      const restitution = 1 + body.material.bounce;
      impulse = (hit.impact * restitution) / (hit.carInverseMass + inverseMassAlong(body, rx, ry, rz, nx, 0, nz));
      applyImpulse(body, rx, ry, rz, nx * impulse, impulse * 0.2, nz * impulse);
      const vmax = hit.impact * 1.4 + 3;
      if (body.v.length() > vmax) body.v.setLength(vmax);
      if (body.w.length() > 14) body.w.setLength(14);
    }
    this.bodies.push(body);
    this.burst(o, hit, body);
    return impulse;
  }

  /** Break-time particles: splinters, sparks, shards, chips, straw — and a cloud of leaves. */
  burst(o, hit, body) {
    const mat = MATERIALS[o.material] ?? MATERIALS.wood;
    const floor = this.world.groundHeight(hit.x, hit.z) + 0.03;
    const s = Math.min(1.5, 0.35 + hit.impact / 20);
    const many = s * (this.world.quality?.fx ?? 1); // fewer particles on lower graphics tiers
    const vx = hit.vx * 0.55;
    const vz = hit.vz * 0.55;
    const y = hit.y;
    const chipCount = o.material === 'hay' ? 80 : o.material === 'plastic' ? 12 : 22;
    for (let k = 0; k < chipCount * many; k++) {
      const straw = mat.straw;
      this.particles.emit({
        x: hit.x, y: y + Math.random() * 0.6, z: hit.z,
        vx: vx * Math.random() + (Math.random() - 0.5) * 6 * s,
        vy: 1.5 + Math.random() * 5 * s,
        vz: vz * Math.random() + (Math.random() - 0.5) * 6 * s,
        color: mat.chips[k % mat.chips.length],
        size: straw ? 0.07 + Math.random() * 0.05 : 0.05 + Math.random() * 0.09,
        life: straw ? 2.5 + Math.random() * 2 : 1.2 + Math.random() * 1.2,
        drag: straw ? 1.6 : 0.4,
        gravity: straw ? 4 : G,
        flutter: straw ? 3 : 0,
        floor,
      });
    }
    if (mat.sparks) {
      for (let k = 0; k < 40 * many; k++) {
        this.sparks.emit({
          x: hit.x, y: y + 0.3, z: hit.z,
          vx: vx * 0.6 + (Math.random() - 0.5) * 10, vy: 1 + Math.random() * 6, vz: vz * 0.6 + (Math.random() - 0.5) * 10,
          color: [2.4, 1.3 + Math.random() * 0.5, 0.45], size: 0.05 + Math.random() * 0.05,
          life: 0.25 + Math.random() * 0.45, drag: 1.2, floor,
        });
      }
    }
    if (mat.dust || o.rooted) this.puff(hit.x, floor, hit.z, 5 + 4 * s, [0.6, 0.55, 0.48]);
    if (o.leaves) this.leafBurst(body.p.x, body.p.y, body.p.z, body.radius * 0.55, o.leaves, Math.round(70 * s), vx * 0.3, vz * 0.3);
  }

  leafBurst(x, y, z, spread, tint, count, vx = 0, vz = 0) {
    const floor = this.world.groundHeight(x, z) + 0.03;
    const n = Math.round(count * (this.world.quality?.fx ?? 1));
    for (let k = 0; k < n; k++) {
      const shade = 0.75 + Math.random() * 0.45;
      this.particles.emit({
        x: x + (Math.random() - 0.5) * spread * 2,
        y: y + (Math.random() - 0.3) * spread,
        z: z + (Math.random() - 0.5) * spread * 2,
        vx: vx + (Math.random() - 0.5) * 4, vy: Math.random() * 3, vz: vz + (Math.random() - 0.5) * 4,
        color: [tint[0] * shade, tint[1] * shade, tint[2] * shade],
        size: 0.13 + Math.random() * 0.1,
        life: 3 + Math.random() * 3,
        drag: 2.2, gravity: 2.6, flutter: 5, floor,
      });
    }
  }

  puff(x, y, z, count, color) {
    const n = Math.round(count * (this.world.quality?.fx ?? 1));
    for (let k = 0; k < n; k++) {
      this.dust.emit({
        x: x + (Math.random() - 0.5) * 1.5, y: y + 0.2, z: z + (Math.random() - 0.5) * 1.5,
        vx: (Math.random() - 0.5) * 2.5, vy: 0.4 + Math.random() * 0.9, vz: (Math.random() - 0.5) * 2.5,
        color, size: 0.9 + Math.random() * 0.6, life: 1.6 + Math.random() * 1.4,
        drag: 1.4, gravity: -0.15, grow: 2.5, alpha: 0.32, floor: y,
      });
    }
  }

  /** One contact-solver substep for a body. */
  step(body, h) {
    body.v.y -= G * h;
    const air = Math.max(0, 1 - h * body.drag * body.v.length());
    body.v.multiplyScalar(air);
    body.w.multiplyScalar(1 - h * 0.05);
    body.updateFrame();

    const contacts = body.contacts;
    contacts.length = 0;
    const pts = body.world;
    let maxPen = 0;
    let hardest = 0;
    let hardestK = -1;
    for (let i = 0, k = 0; i < pts.length; i += 3, k++) {
      const rx = pts[i];
      const ry = pts[i + 1];
      const rz = pts[i + 2];
      const x = body.p.x + rx;
      const z = body.p.z + rz;
      const pen = this.ground(body, k, x, z) - (body.p.y + ry);
      if (pen < -0.01) continue;
      // approach speed of this point (v + ω × r)
      const vn = body.v.y + body.w.z * rx - body.w.x * rz;
      contacts.push({ rx, ry, rz, vn0: vn, jn: 0, fx: 0, fz: 0, kn: inverseMassAlong(body, rx, ry, rz, 0, 1, 0) });
      maxPen = Math.max(maxPen, pen);
      if (vn < hardest) {
        hardest = vn;
        hardestK = i;
      }
    }
    if (contacts.length) {
      const { friction, bounce } = body.material;
      for (let iter = 0; iter < 4; iter++) {
        for (const c of contacts) {
          const { rx, ry, rz } = c;
          const w = body.w;
          // normal (ground up) — restitution only for real impacts, so resting bodies don't buzz
          const vn = body.v.y + w.z * rx - w.x * rz;
          const target = c.vn0 < -1.5 ? -bounce * c.vn0 : 0;
          let dj = (target - vn) / c.kn;
          const jn = Math.max(0, c.jn + dj);
          dj = jn - c.jn;
          c.jn = jn;
          if (dj) applyImpulse(body, rx, ry, rz, 0, dj, 0);
          // Coulomb friction in the ground plane
          const vtx = body.v.x + w.y * rz - w.z * ry;
          const vtz = body.v.z + w.x * ry - w.y * rx;
          const vt = Math.hypot(vtx, vtz);
          if (vt < 1e-5) continue;
          const tx = vtx / vt;
          const tz = vtz / vt;
          const kt = inverseMassAlong(body, rx, ry, rz, tx, 0, tz);
          let fx = c.fx - (tx * vt) / kt;
          let fz = c.fz - (tz * vt) / kt;
          const f = Math.hypot(fx, fz);
          const limit = friction * c.jn;
          if (f > limit) {
            fx *= limit / f;
            fz *= limit / f;
          }
          applyImpulse(body, rx, ry, rz, fx - c.fx, 0, fz - c.fz);
          c.fx = fx;
          c.fz = fz;
        }
      }
      // ease out of the ground, and a little rolling resistance so things come to rest
      body.p.y += Math.min(maxPen, 0.3) * 0.2;
      body.w.multiplyScalar(1 - h * 1.5);
      if (hardest < -2.2 && this.time - body.lastThud > 0.3) {
        body.lastThud = this.time;
        const strength = Math.min(1, (-hardest / 9) * Math.min(1, body.mass / 300 + 0.15));
        this.world.events.push({ kind: 'fall', material: body.materialName, strength });
        const x = body.p.x + pts[hardestK];
        const y = body.p.y + pts[hardestK + 1];
        const z = body.p.z + pts[hardestK + 2];
        if (body.leaves && pts[hardestK + 1] > -body.radius * 0.2) this.leafBurst(x, y, z, 1.2, body.leaves, Math.round(25 * strength) + 6);
        if (body.mass > 150 && -hardest > 3.5) this.puff(x, y, z, 3 + Math.round(4 * strength), [0.58, 0.53, 0.46]);
      }
    }
    // integrate
    body.p.addScaledVector(body.v, h);
    const q = body.q;
    const { x: wx, y: wy, z: wz } = body.w;
    const hh = h * 0.5;
    const qx = q.x;
    const qy = q.y;
    const qz = q.z;
    const qw = q.w;
    q.set(
      qx + hh * (wx * qw + wy * qz - wz * qy),
      qy + hh * (wy * qw + wz * qx - wx * qz),
      qz + hh * (wz * qw + wx * qy - wy * qx),
      qw + hh * (-wx * qx - wy * qy - wz * qz),
    ).normalize();

    // settle: asleep after resting still for a moment
    if (contacts.length && body.v.lengthSq() < 0.03 && body.w.lengthSq() < 0.04) {
      body.still += h;
      if (body.still > 0.7) {
        body.asleep = true;
        body.v.set(0, 0, 0);
        body.w.set(0, 0, 0);
      }
    } else {
      body.still = 0;
    }
  }

  /** The car ploughs into a body: shove the hull points it overlaps out of its way. */
  push(body, car) {
    if (body.age < body.pushDelay) return;
    const reach = body.radius + CAR_HALF + CAR_RADIUS;
    const ox = body.p.x - car.x;
    const oz = body.p.z - car.z;
    if (ox * ox + oz * oz > reach * reach) return;
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    body.updateFrame();
    const pts = body.world;
    let pushed = false;
    for (let i = 0; i < pts.length; i += 3) {
      const rx = pts[i];
      const ry = pts[i + 1];
      const rz = pts[i + 2];
      const py = body.p.y + ry;
      if (py < car.y - 0.3 || py > car.y + CAR_HEIGHT) continue;
      const px = body.p.x + rx - car.x;
      const pz = body.p.z + rz - car.z;
      const along = Math.max(-CAR_HALF, Math.min(CAR_HALF, px * fx + pz * fz));
      const dx = px - fx * along;
      const dz = pz - fz * along;
      const d = Math.hypot(dx, dz);
      if (d >= CAR_RADIUS + 0.05 || d < 1e-4) continue;
      const nx = dx / d;
      const nz = dz / d;
      // relative approach speed along n (point velocity minus the car's)
      const w = body.w;
      const vpx = body.v.x + w.y * rz - w.z * ry;
      const vpz = body.v.z + w.x * ry - w.y * rx;
      const rel = (vpx - car.vx) * nx + (vpz - car.vz) * nz;
      const want = 0.6;
      if (rel < want) {
        const j = (want - rel) / inverseMassAlong(body, rx, ry, rz, nx, 0, nz);
        applyImpulse(body, rx, ry, rz, nx * j, j * 0.12, nz * j);
        car.bump = Math.min(1, car.bump + Math.min(0.4, (j * body.invMass * body.mass) / 30000));
        pushed = true;
      }
      body.p.x += nx * (CAR_RADIUS + 0.05 - d) * 0.5;
      body.p.z += nz * (CAR_RADIUS + 0.05 - d) * 0.5;
    }
    if (pushed) body.wake();
  }

  update(dt, car) {
    this.time += dt;
    for (let b = this.bodies.length - 1; b >= 0; b--) {
      const body = this.bodies[b];
      body.age += dt;
      if (car) {
        const dx = body.p.x - car.x;
        const dz = body.p.z - car.z;
        if (dx * dx + dz * dz > FAR * FAR) {
          this.remove(body);
          continue;
        }
        this.push(body, car);
      }
      if (body.asleep) continue;
      const steps = Math.min(4, Math.ceil(dt / SUBSTEP));
      const h = dt / steps;
      for (let s = 0; s < steps; s++) this.step(body, h);
      // fell through the world somehow (off a cliff edge of loaded terrain): clear it away
      if (body.p.y < -400) this.remove(body);
    }
    this.particles.update(dt);
    this.sparks.update(dt);
    this.dust.update(dt);
  }

  remove(body) {
    const at = this.bodies.indexOf(body);
    if (at >= 0) this.bodies.splice(at, 1);
    this.scene.remove(body.group);
    body.group.children.forEach(m => m.geometry.dispose());
  }

  dispose() {
    for (const body of [...this.bodies]) this.remove(body);
    this.particles.dispose();
    this.sparks.dispose();
    this.dust.dispose();
  }
}
