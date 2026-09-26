/**
 * A few flocks of birds wheeling over the countryside by day. Each bird is three
 * triangles (a body and two wings that beat, then glide) and all of them share one
 * mesh, rebuilt on the CPU every frame. Flocks loosely follow the car and, once left
 * far behind, are sent on ahead of it again.
 */
import * as THREE from 'three';
import { mulberry32, hashInts } from './rng';

const FLOCKS = 3;
const PER_FLOCK = 8;
const COUNT = FLOCKS * PER_FLOCK;
const FLOATS_PER_BIRD = 3 * 3 * 3; // 3 triangles × 3 vertices × xyz
const RESPAWN = 420;

export class Birds {
  constructor(scene, seed) {
    this.scene = scene;
    this.rand = mulberry32(hashInts(seed, 61));
    this.positions = new Float32Array(COUNT * FLOATS_PER_BIRD);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.MeshBasicMaterial({ color: 0x2a2c31, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.time = 0;
    this.flocks = [];
    for (let f = 0; f < FLOCKS; f++) {
      const birds = [];
      for (let k = 0; k < PER_FLOCK; k++) {
        birds.push({
          lag: k * 0.06 + this.rand() * 0.05,          // radians behind the leader on the circle
          out: (this.rand() - 0.5) * 9,                // metres off the flock's circle
          up: (this.rand() - 0.5) * 5,
          phase: this.rand() * Math.PI * 2,
          beat: 7 + this.rand() * 3,
          span: 1.1 + this.rand() * 0.4,
        });
      }
      this.flocks.push({ birds, x: 0, z: 0, placed: false, angle: this.rand() * 6.28, radius: 40, height: 30, speed: 12, dir: 1 });
    }
    scene.add(this.mesh);
  }

  /** Puts a flock somewhere ahead of the car, circling at its own height and pace. */
  place(flock, x, z, heading, ahead) {
    const r = this.rand;
    const side = (r() - 0.5) * 2;
    const dist = ahead ? 160 + r() * 200 : r() * 200;
    flock.x = x + Math.sin(heading) * dist + Math.cos(heading) * side * 140;
    flock.z = z + Math.cos(heading) * dist - Math.sin(heading) * side * 140;
    flock.radius = 25 + r() * 45;
    flock.height = 22 + r() * 34;
    flock.speed = 9 + r() * 6;
    flock.dir = r() < 0.5 ? 1 : -1;
    flock.placed = true;
  }

  /**
   * `center` is the car (x, y, z), `heading` its direction; `daylight` 0–1 fades the
   * birds out at dusk.
   */
  update(dt, center, heading, daylight) {
    this.mesh.visible = daylight > 0.15;
    if (!this.mesh.visible) {
      this.flocks.forEach(f => { f.placed = false; });
      return;
    }
    this.time += dt;
    const out = this.positions;
    let o = 0;
    for (const flock of this.flocks) {
      if (!flock.placed) this.place(flock, center.x, center.z, heading, false);
      else if (Math.hypot(flock.x - center.x, flock.z - center.z) > RESPAWN) this.place(flock, center.x, center.z, heading, true);
      flock.angle += (flock.dir * flock.speed * dt) / flock.radius;
      for (const b of flock.birds) {
        const a = flock.angle - flock.dir * b.lag;
        const radius = flock.radius + b.out;
        const x = flock.x + Math.cos(a) * radius;
        const z = flock.z + Math.sin(a) * radius;
        const y = center.y + flock.height + b.up + Math.sin(this.time * 0.7 + b.phase) * 1.5;
        // flying along the circle's tangent
        const fx = -Math.sin(a) * flock.dir;
        const fz = Math.cos(a) * flock.dir;
        const sx = fz;
        const sz = -fx;
        // beat for a while, then glide with the wings held slightly up
        const flapping = Math.sin(this.time * 0.45 + b.phase) > -0.2;
        const lift = flapping ? Math.sin(this.time * b.beat + b.phase) * 0.55 : 0.12;
        const s = b.span;
        const nose = [x + fx * 0.45 * s, y, z + fz * 0.45 * s];
        const tail = [x - fx * 0.4 * s, y, z - fz * 0.4 * s];
        const root = [x + fx * 0.12 * s, y, z + fz * 0.12 * s];
        const back = [x - fx * 0.12 * s, y, z - fz * 0.12 * s];
        const tipL = [x + sx * s - fx * 0.15 * s, y + lift * s, z + sz * s - fz * 0.15 * s];
        const tipR = [x - sx * s - fx * 0.15 * s, y + lift * s, z - sz * s - fz * 0.15 * s];
        const bodyL = [x + sx * 0.07 * s, y, z + sz * 0.07 * s];
        for (const v of [nose, tail, bodyL, root, back, tipL, root, tipR, back]) {
          out[o++] = v[0];
          out[o++] = v[1];
          out[o++] = v[2];
        }
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }
}
