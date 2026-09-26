/**
 * Camera rig with four modes. Every mode eases toward its target so motion
 * stays smooth; the chase camera widens its field of view with speed and
 * shakes a little on bumps (both off under reduced motion).
 */
import * as THREE from 'three';

export const CAMERA_MODES = ['chase', 'hood', 'cinematic', 'drone'];

export class CameraRig {
  constructor(camera, world, { reducedMotion }) {
    this.camera = camera;
    this.world = world;
    this.reducedMotion = reducedMotion;
    this.mode = 'chase';
    this.orbit = 0;
    this.position = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.desired = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.offset = new THREE.Vector3();
    this.lookOffset = new THREE.Vector3();
    this.carPos = new THREE.Vector3();
    this.arm = 1; // fraction of the camera's reach currently used (shortens in front of trees)
    this.initialized = false;
  }

  /**
   * How much of the horizontal camera offset is clear of trees and rocks (0…1), so the
   * view never ends up behind a trunk and its canopy. Obstacles store trunk radii; the
   * canopy is taken as roughly twice that plus a margin.
   */
  clearReach(carPos, offset, minReach) {
    const len = Math.hypot(offset.x, offset.z);
    if (len <= minReach) return 1;
    const dx = offset.x / len;
    const dz = offset.z / len;
    let clear = len;
    this.world.forEachObstacleNear(carPos.x, carPos.z, (o) => {
      if (o.seg) return; // guardrails are low; they never hide the car
      const ox = o.x - carPos.x;
      const oz = o.z - carPos.z;
      const along = ox * dx + oz * dz;
      if (along < 1.5 || along > clear + 3) return;
      const side = Math.abs(ox * dz - oz * dx);
      const reach = o.r * 2.2 + 0.6;
      if (side < reach) clear = Math.min(clear, along - Math.sqrt(reach * reach - side * side) - 0.4);
    });
    return Math.max(minReach, clear) / len;
  }

  cycle() {
    this.mode = CAMERA_MODES[(CAMERA_MODES.indexOf(this.mode) + 1) % CAMERA_MODES.length];
    this.initialized = false;
    return this.mode;
  }

  /** `car`: { x, y, z, heading, speed, bump } · `body`: the car body Object3D (for the hood view). */
  update(dt, car, body, { idleOrbit = false } = {}) {
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    const speed = car.speed;
    const mode = idleOrbit ? 'cinematic' : this.mode;
    let ease = 4.5;

    if (mode === 'hood') {
      // right-hand drive: eye just over the windscreen, on the car's right (−x in model space)
      this.desired.set(-0.3, 1.36, 0.3).applyMatrix4(body.matrixWorld);
      this.look.set(-0.3, 0.9, 30).applyMatrix4(body.matrixWorld);
      this.position.copy(this.desired);
      this.target.copy(this.look);
    } else {
      if (mode === 'chase') {
        const s = Math.min(speed, 70);
        const back = 6.4 + s * 0.04;
        this.desired.set(car.x - fx * back, car.y + 2.1 + s * 0.01, car.z - fz * back);
        this.look.set(car.x + fx * 3.5, car.y + 1.1, car.z + fz * 3.5);
      } else if (mode === 'cinematic') {
        this.orbit += dt * (idleOrbit ? 0.16 : 0.11);
        const a = car.heading + this.orbit;
        this.desired.set(car.x + Math.sin(a) * 9.5, car.y + 2.4, car.z + Math.cos(a) * 9.5);
        this.look.set(car.x, car.y + 0.9, car.z);
        ease = 2.5;
      } else {
        this.desired.set(car.x - fx * 16, car.y + 32, car.z - fz * 16);
        this.look.set(car.x + fx * 10, car.y, car.z + fz * 10);
        ease = 2.2;
      }
      // ease the camera's offset from the car (not its absolute position),
      // so it stays glued on at any speed yet still swings smoothly round corners
      this.carPos.set(car.x, car.y, car.z);
      this.desired.sub(this.carPos);
      this.look.sub(this.carPos);
      if (!this.initialized) {
        this.offset.copy(this.desired);
        this.lookOffset.copy(this.look);
        this.initialized = true;
      } else {
        const k = 1 - Math.exp(-ease * dt);
        this.offset.lerp(this.desired, k);
        this.lookOffset.lerp(this.look, Math.min(1, k * 2));
      }
      // spring arm: snap in quickly in front of an obstacle, ease back out once it's passed
      if (mode !== 'drone') {
        const want = this.clearReach(this.carPos, this.offset, mode === 'chase' ? 3.6 : 3.2);
        this.arm += (want - this.arm) * (1 - Math.exp(-(want < this.arm ? 14 : 1.8) * dt));
      } else {
        this.arm = 1;
      }
      this.position.set(this.carPos.x + this.offset.x * this.arm, this.carPos.y + this.offset.y, this.carPos.z + this.offset.z * this.arm);
      this.target.copy(this.carPos).add(this.lookOffset);
      const floor = this.world.visualHeight(this.position.x, this.position.z) + 0.9;
      if (this.position.y < floor) this.position.y = floor;
    }

    this.camera.position.copy(this.position);
    if (!this.reducedMotion && car.bump > 0 && mode !== 'drone') {
      const s = car.bump * 0.09;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }
    this.camera.lookAt(this.target);

    const fov = this.reducedMotion || mode !== 'chase' ? (mode === 'hood' ? 68 : 58) : 58 + 24 * (1 - Math.exp(-speed / 60));
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-3 * dt));
      this.camera.updateProjectionMatrix();
    }
  }
}
