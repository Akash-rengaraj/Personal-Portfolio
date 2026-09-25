/**
 * Arcade vehicle physics, tuned for "feel good" rather than realism:
 * kinematic steering with grip-limited yaw, lateral slip that bleeds off by
 * surface grip (the handbrake lowers it for gentle drifts), an automatic
 * gearbox for the engine sound, slope gravity, and spring-damped heave,
 * pitch and roll sampled from the ground under each wheel.
 * The car can't flip and can't be damaged — obstacles just nudge it aside.
 */
import { clamp } from './noise';

export const TUNING = {
  wheelbase: 2.62,
  track: 1.72,
  maxSteer: 0.56,          // rad at walking pace
  minSteer: 0.11,          // rad at top speed
  steerFalloff: 34,        // m/s where steering has mostly narrowed
  steerRate: 3.4,          // how fast the wheel turns toward the input
  steerReturn: 5.5,        // self-centring when you let go
  engineAccel: 7.2,        // m/s² from standstill
  topSpeed: 44,            // m/s ≈ 158 km/h
  offroadTopSpeed: 22,
  reverseAccel: 4,
  reverseSpeed: 9,
  brakeDecel: 13,
  handbrakeDecel: 3.5,
  drag: 0.0016,
  rolling: 0.18,
  grip: { road: 9, gravel: 6.5, grass: 4.2, handbrake: 1.05 },
  yawResponse: { road: 9, gravel: 7, grass: 5 },
  maxLateralAccel: { road: 10.5, gravel: 8, grass: 6.5 },
  gears: [0, 11, 19, 27, 35, 46],
  shiftTime: 0.2,
  suspension: {
    heaveK: 90, heaveC: 13,
    pitchK: 70, pitchC: 10, accelPitch: 0.011,
    rollK: 60, rollC: 9, cornerRoll: 0.0075,
  },
  carRadius: 1.15,
};

const G = 9.81;

export class Vehicle {
  constructor(world, spawn) {
    this.world = world;
    this.reset(spawn);
  }

  /** Places the car at rest at { x, z, heading }. */
  reset({ x, z, heading }) {
    this.x = x;
    this.z = z;
    this.y = this.world.groundHeight(x, z);
    this.vy = 0;
    this.heading = heading;
    this.vx = 0;
    this.vz = 0;
    this.yawRate = 0;
    this.steerAngle = 0;
    this.pitch = 0;
    this.pitchVel = 0;
    this.roll = 0;
    this.rollVel = 0;
    this.gear = 1;
    this.shiftTimer = 0;
    this.rpm = 0.2;
    this.slip = 0;
    this.speed = 0;
    this.forwardSpeed = 0;
    this.accel = 0;
    this.distance = this.distance ?? 0;
    this.surface = 'road';
    this.airborne = false;
    this.bump = 0;
    this.braking = 0;
  }

  /** Advances the simulation by `dt` with input { throttle, brake, steer, handbrake }. */
  step(dt, input) {
    const T = TUNING;
    const sinH = Math.sin(this.heading);
    const cosH = Math.cos(this.heading);
    // forward = (sin h, cos h), right = (-cos h, sin h)
    let vLong = this.vx * sinH + this.vz * cosH;
    let vLat = -this.vx * cosH + this.vz * sinH;
    const speed = Math.abs(vLong);

    this.world.groundHeight(this.x, this.z);
    const surface = this.world.surfaceAt();
    this.surface = surface;

    // steering narrows with speed; the wheel eases toward the input
    const steerLimit = T.minSteer + (T.maxSteer - T.minSteer) / (1 + (speed / T.steerFalloff) ** 2 * 3);
    const targetSteer = input.steer * steerLimit;
    const rate = input.steer === 0 ? T.steerReturn : T.steerRate;
    this.steerAngle += clamp(targetSteer - this.steerAngle, -rate * dt, rate * dt);

    // longitudinal: engine / brakes / reverse
    let a = 0;
    this.shiftTimer = Math.max(0, this.shiftTimer - dt);
    const top = surface === 'grass' ? T.offroadTopSpeed : T.topSpeed;
    if (input.throttle > 0 && vLong > -0.5) {
      const headroom = Math.max(0, 1 - (vLong / top) ** 2);
      a += T.engineAccel * input.throttle * headroom * (this.shiftTimer > 0 ? 0.35 : 1);
    }
    if (input.brake > 0) {
      if (vLong > 0.4) a -= T.brakeDecel * input.brake;
      else if (vLong > -T.reverseSpeed) a -= T.reverseAccel * input.brake;
    }
    if (input.throttle > 0 && vLong < -0.4) a += T.brakeDecel * input.throttle;
    if (input.handbrake) a -= Math.sign(vLong) * Math.min(T.handbrakeDecel, speed / dt);
    a -= T.drag * vLong * Math.abs(vLong) + T.rolling * Math.sign(vLong) * Math.min(1, speed);
    if (surface === 'grass' && speed > top) a -= (speed - top) * 0.8 * Math.sign(vLong);

    // gravity along the slope, from front/rear ground heights
    const hf = this.world.groundHeight(this.x + sinH * 1.3, this.z + cosH * 1.3);
    const hr = this.world.groundHeight(this.x - sinH * 1.3, this.z - cosH * 1.3);
    a -= G * ((hf - hr) / T.wheelbase) * 0.9;

    const idle = input.throttle === 0 && input.brake === 0 && speed < 0.25;
    vLong = idle ? vLong * 0.9 : vLong + a * dt;
    this.accel = a;
    this.braking = input.brake > 0 && vLong > 0.4 ? input.brake : 0;

    // yaw: kinematic turn rate, limited by grip, reached with some lag
    let yawTarget = -(vLong * Math.tan(this.steerAngle)) / T.wheelbase;
    const maxYaw = T.maxLateralAccel[surface] / Math.max(speed, 1);
    yawTarget = clamp(yawTarget, -maxYaw, maxYaw);
    if (input.handbrake && speed > 4) yawTarget *= 1.45;
    this.yawRate += (yawTarget - this.yawRate) * (1 - Math.exp(-T.yawResponse[surface] * dt));
    if (speed < 0.3) this.yawRate *= 0.8;

    // lateral slip bleeds away at the surface's grip
    const grip = input.handbrake ? T.grip.handbrake : T.grip[surface];
    vLat *= Math.exp(-grip * dt);
    this.slip = Math.min(1, Math.abs(vLat) / 6);

    // back to world velocity using the pre-turn basis, then turn
    this.vx = sinH * vLong - cosH * vLat;
    this.vz = cosH * vLong + sinH * vLat;
    this.heading += this.yawRate * dt;
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    this.collide();
    this.updateGearbox(Math.abs(vLong));
    this.suspend(dt, a);

    this.forwardSpeed = vLong;
    this.speed = Math.hypot(this.vx, this.vz);
    this.distance += this.speed * dt;
    this.bump = Math.max(0, this.bump - dt * 3);
  }

  /** Soft push out of trees, rocks and lamp posts — no damage, just a nudge. */
  collide() {
    const R = TUNING.carRadius;
    this.world.forEachObstacleNear(this.x, this.z, (o) => {
      const dx = this.x - o.x;
      const dz = this.z - o.z;
      const d = Math.hypot(dx, dz);
      const min = R + o.r;
      if (d >= min || d < 1e-4) return;
      const nx = dx / d;
      const nz = dz / d;
      this.x += nx * (min - d);
      this.z += nz * (min - d);
      const vn = this.vx * nx + this.vz * nz;
      if (vn < 0) {
        this.bump = Math.min(1, this.bump + Math.abs(vn) / 12);
        this.vx -= nx * vn * 1.25;
        this.vz -= nz * vn * 1.25;
        this.vx *= 0.8;
        this.vz *= 0.8;
      }
    });
  }

  updateGearbox(speed) {
    const gears = TUNING.gears;
    let gear = 1;
    while (gear < gears.length - 1 && speed > gears[gear]) gear++;
    if (gear > this.gear) this.shiftTimer = TUNING.shiftTime;
    this.gear = gear;
    const lo = gears[gear - 1];
    const hi = gears[gear];
    this.rpm = clamp(0.22 + 0.78 * ((speed - lo) / (hi - lo)), 0.2, 1);
  }

  /** Heave follows the ground (with a little air time); pitch/roll are springs. */
  suspend(dt, accel) {
    const S = TUNING.suspension;
    const sinH = Math.sin(this.heading);
    const cosH = Math.cos(this.heading);
    const w = this.world;
    const fx = sinH * 1.3;
    const fz = cosH * 1.3;
    const lx = cosH * (TUNING.track / 2); // left = (cos h, -sin h)
    const lz = -sinH * (TUNING.track / 2);
    const hFL = w.groundHeight(this.x + fx + lx, this.z + fz + lz);
    const hFR = w.groundHeight(this.x + fx - lx, this.z + fz - lz);
    const hRL = w.groundHeight(this.x - fx + lx, this.z - fz + lz);
    const hRR = w.groundHeight(this.x - fx - lx, this.z - fz - lz);
    const ground = (hFL + hFR + hRL + hRR) / 4;

    if (this.y > ground + 0.05) {
      this.vy -= G * dt;
      this.airborne = true;
    } else {
      this.vy += (S.heaveK * (ground - this.y) - S.heaveC * this.vy) * dt;
      this.airborne = false;
    }
    this.y += this.vy * dt;
    if (this.y < ground - 0.2) {
      if (this.vy < -3) this.bump = Math.min(1, this.bump + -this.vy / 10);
      this.y = ground - 0.2;
      this.vy = Math.max(this.vy, 0);
    }

    const groundPitch = Math.atan2((hRL + hRR) / 2 - (hFL + hFR) / 2, TUNING.wheelbase);
    const groundRoll = Math.atan2((hFL + hRL) / 2 - (hFR + hRR) / 2, TUNING.track);
    const pitchTarget = groundPitch - accel * S.accelPitch;
    const vLong = this.vx * sinH + this.vz * cosH;
    const rollTarget = groundRoll + clamp(this.yawRate * vLong * S.cornerRoll, -0.09, 0.09);
    this.pitchVel += (S.pitchK * (pitchTarget - this.pitch) - S.pitchC * this.pitchVel) * dt;
    this.pitch += this.pitchVel * dt;
    this.rollVel += (S.rollK * (rollTarget - this.roll) - S.rollC * this.rollVel) * dt;
    this.roll += this.rollVel * dt;
  }
}
