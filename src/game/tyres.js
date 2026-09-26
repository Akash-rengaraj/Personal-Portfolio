/**
 * Tyre effects: skid marks laid as a ring buffer of ground quads, and
 * smoke/dust puffs drawn as one point cloud with per-particle size and fade.
 */
import * as THREE from 'three';

const MAX_SEGMENTS = 2400;
const MIN_STEP = 0.35;

export class SkidMarks {
  constructor(scene) {
    this.scene = scene;
    this.positions = new Float32Array(MAX_SEGMENTS * 6 * 3);
    this.geometry = new THREE.BufferGeometry();
    this.attribute = new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.attribute);
    this.geometry.setDrawRange(0, 0);
    this.material = new THREE.MeshBasicMaterial({
      color: 0x0b0b0c, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.next = 0;
    this.count = 0;
    this.last = new Map(); // wheel id → previous { lx, ly, lz, rx, ry, rz, x, z }
    scene.add(this.mesh);
  }

  /**
   * Continues (or ends, when `active` is false) the mark under one wheel.
   * (x, y, z) is the contact point; (sx, sz) the wheel's sideways unit vector.
   */
  track(id, active, x, y, z, sx, sz, halfWidth) {
    if (!active) {
      this.last.delete(id);
      return;
    }
    const lift = 0.07;
    const cur = {
      x, z,
      lx: x - sx * halfWidth, ly: y + lift, lz: z - sz * halfWidth,
      rx: x + sx * halfWidth, ry: y + lift, rz: z + sz * halfWidth,
    };
    const prev = this.last.get(id);
    if (!prev) {
      this.last.set(id, cur);
      return;
    }
    if (Math.hypot(cur.x - prev.x, cur.z - prev.z) < MIN_STEP) return;
    const p = this.positions;
    let o = this.next * 18;
    const put = (vx, vy, vz) => {
      p[o++] = vx;
      p[o++] = vy;
      p[o++] = vz;
    };
    // two triangles (double-sided material, so winding doesn't matter)
    put(prev.lx, prev.ly, prev.lz); put(prev.rx, prev.ry, prev.rz); put(cur.rx, cur.ry, cur.rz);
    put(prev.lx, prev.ly, prev.lz); put(cur.rx, cur.ry, cur.rz); put(cur.lx, cur.ly, cur.lz);
    this.attribute.addUpdateRange(this.next * 18, 18);
    this.attribute.needsUpdate = true;
    this.next = (this.next + 1) % MAX_SEGMENTS;
    this.count = Math.min(MAX_SEGMENTS, this.count + 1);
    this.geometry.setDrawRange(0, this.count * 6);
    this.last.set(id, cur);
  }

  clear() {
    this.count = 0;
    this.next = 0;
    this.last.clear();
    this.geometry.setDrawRange(0, 0);
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }
}

const SMOKE_VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (320.0 / max(1.0, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`;
const SMOKE_FRAGMENT = /* glsl */ `
  uniform vec3 color;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.1, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(color, a);
    #include <colorspace_fragment>
  }
`;

const MAX_PUFFS = 220;

export class TyreSmoke {
  constructor(scene) {
    this.scene = scene;
    this.pos = new Float32Array(MAX_PUFFS * 3);
    this.size = new Float32Array(MAX_PUFFS);
    this.alpha = new Float32Array(MAX_PUFFS);
    this.vel = new Float32Array(MAX_PUFFS * 3);
    this.age = new Float32Array(MAX_PUFFS).fill(1);
    this.life = new Float32Array(MAX_PUFFS).fill(1);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color(0xdedede) } },
      vertexShader: SMOKE_VERTEX,
      fragmentShader: SMOKE_FRAGMENT,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.next = 0;
    this.active = 0;
    scene.add(this.points);
  }

  /** Smoke on tarmac, dust off it (dust takes the ground colour). */
  setColor(linearRgb, dust) {
    if (dust) this.material.uniforms.color.value.setRGB(linearRgb[0] * 1.1, linearRgb[1] * 1.05, linearRgb[2]);
    else this.material.uniforms.color.value.setRGB(0.78, 0.78, 0.8);
  }

  emit(x, y, z, vx, vz, strength) {
    const i = this.next;
    this.next = (this.next + 1) % MAX_PUFFS;
    this.pos[i * 3] = x + (Math.random() - 0.5) * 0.3;
    this.pos[i * 3 + 1] = y + 0.25;
    this.pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.3;
    this.vel[i * 3] = vx * 0.25 + (Math.random() - 0.5) * 1.2;
    this.vel[i * 3 + 1] = 0.6 + Math.random() * 0.8;
    this.vel[i * 3 + 2] = vz * 0.25 + (Math.random() - 0.5) * 1.2;
    this.age[i] = 0;
    this.life[i] = 1.4 + Math.random() * 1.2 * strength;
    this.size[i] = 0.8;
    this.alpha[i] = 0;
  }

  update(dt) {
    let live = 0;
    for (let i = 0; i < MAX_PUFFS; i++) {
      if (this.age[i] >= this.life[i]) {
        this.alpha[i] = 0;
        continue;
      }
      live++;
      this.age[i] += dt;
      const t = this.age[i] / this.life[i];
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.vel[i * 3] *= 1 - dt * 1.5;
      this.vel[i * 3 + 2] *= 1 - dt * 1.5;
      this.size[i] = 0.8 + t * 4.5;
      this.alpha[i] = Math.min(1, t * 6) * (1 - t) * 0.5;
    }
    this.active = live;
    this.points.visible = live > 0;
    if (live > 0) {
      this.geometry.attributes.position.needsUpdate = true;
      this.geometry.attributes.aSize.needsUpdate = true;
      this.geometry.attributes.aAlpha.needsUpdate = true;
    }
  }

  dispose() {
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
  }
}
