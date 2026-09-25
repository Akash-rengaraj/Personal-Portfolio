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
    this.initialized = false;
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
        const back = 6.3 + speed * 0.045;
        this.desired.set(car.x - fx * back, car.y + 2.25 + speed * 0.012, car.z - fz * back);
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
      const floor = this.world.visualHeight(this.desired.x, this.desired.z) + 0.9;
      if (this.desired.y < floor) this.desired.y = floor;

      if (!this.initialized) {
        this.position.copy(this.desired);
        this.target.copy(this.look);
        this.initialized = true;
      } else {
        const k = 1 - Math.exp(-ease * dt);
        this.position.lerp(this.desired, k);
        this.target.lerp(this.look, Math.min(1, k * 2));
      }
    }

    this.camera.position.copy(this.position);
    if (!this.reducedMotion && car.bump > 0 && mode !== 'drone') {
      const s = car.bump * 0.09;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }
    this.camera.lookAt(this.target);

    const fov = this.reducedMotion || mode !== 'chase' ? (mode === 'hood' ? 68 : 58) : Math.min(76, 58 + speed * 0.4);
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-3 * dt));
      this.camera.updateProjectionMatrix();
    }
  }
}
