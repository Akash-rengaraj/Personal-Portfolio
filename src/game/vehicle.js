/**
 * Vehicle dynamics — a real-time "bicycle model" with proper tyre physics:
 *
 *  • Tyres: lateral force from slip angle via a simplified Pacejka "magic
 *    formula" (grip builds, peaks around 9°, then falls to ~75 % as the tyre
 *    slides). Longitudinal and lateral forces share one friction circle, so
 *    a spinning or locked tyre loses its sideways grip — that is how power
 *    oversteer and handbrake drifts happen.
 *  • Load transfer: braking loads the front, acceleration the rear, and
 *    aerodynamic downforce adds grip with speed.
 *  • Drivetrain: rear-wheel drive through a 6-speed gearbox (automatic or
 *    manual), a torque curve with a 9,000 rpm redline and rev limiter,
 *    clutch slip at launch, torque cut during shifts and engine braking.
 *  • Brakes with front bias; ABS, traction control and stability control are
 *    optional assists.
 *  • Rigid-body integration of forward/lateral velocity and yaw rate.
 *
 * Tuned hypercar-style so 6th gear tops out near 600 km/h.
 */
import { clamp } from './noise';

const G = 9.81;
const KMH = 1 / 3.6;
const RPM_PER_RADS = 60 / (2 * Math.PI);

export const TUNING = {
  mass: 1450,
  yawInertia: 1850,     // a touch under m·a·b: turns in eagerly, like a mid-engined hypercar
  cgToFront: 1.4,
  cgToRear: 1.06,
  cgHeight: 0.4,
  track: 1.6,
  wheelRadius: 0.36,
  engine: {
    idle: 1000,
    redline: 9000,
    limiter: 9150,
    peakTorque: 1850, // N·m — a heavily tuned flat-six
    // [rpm, fraction of peak torque]
    curve: [[0, 0.5], [1000, 0.55], [2500, 0.74], [4500, 0.9], [6300, 1], [8000, 0.96], [9150, 0.86], [10000, 0.6]],
    brakeTorque: [40, 0.045], // engine braking: a + b·rpm (N·m) — clearly felt in the low gears
  },
  gearTopSpeeds: [100, 165, 240, 330, 450, 600], // km/h at redline
  reverseTopSpeed: 42,
  efficiency: 0.92,
  shiftTime: 0.14,
  auto: { upFull: 8650, upMid: 6800, upLight: 4200, down: 1900, kickdown: 4800, downBraking: 4200 },
  dragCoeff: 0.28,       // ½ρCdA
  // Big aero: +50 % grip at 200 km/h, +110 % at 300, +200 % at 400 (capped at 2.8 × weight)
  downforceCoeff: 2.3,   // N per (m/s)²
  downforceMax: 2.8,     // × weight
  downforceFront: 0.36,  // rear-biased, so the tail always has grip in hand at high speed
  // air brake: under hard braking at speed the rear flap stands up — drag to slow down,
  // rear downforce to keep the tail planted
  airbrake: { minSpeed: 20, drag: 0.65, downforce: 0.9 },
  rolling: 0.012,
  offroadRolling: 0.06,
  brakeForce: 3.2,       // × weight — carbon-ceramics: the tyres are always the limit
  brakeBias: 0.65,       // front-biased: the rear never locks first, so braking stays straight
  // wide rear tyres (like 275 front / 335 rear): stiffer and grippier at the back → stable understeer
  // sticky race slicks; the much wider rears (the engine sits behind them and the rear axle
  // carries ~1.3× the front's cornering load) keep a margin, so the car never snaps round
  tyre: { C: 1.45, front: { B: 10, mu: 1.75 }, rear: { B: 13.5, mu: 2.05 } },
  maxSteer: 0.62,
  steerRate: 4.2,
  steerReturn: 6,
  // collision body: two circles along the car (nose / tail) covering its 4.6 × 1.95 m footprint
  bodyRadius: 0.98,
  bodyCircles: [1.3, -1.3],
  suspension: {
    heaveFollow: 14, heaveRate: 45,
    pitchK: 80, pitchC: 11, accelPitch: 0.008,
    rollK: 70, rollC: 10, latRoll: 0.0075,
  },
};

/** Overall drive ratio (gearbox × final drive) for each gear, from its top speed. */
const redlineRads = TUNING.engine.redline / RPM_PER_RADS;
const RATIOS = TUNING.gearTopSpeeds.map(kmh => (redlineRads * TUNING.wheelRadius) / (kmh * KMH));
const REVERSE_RATIO = (redlineRads * TUNING.wheelRadius) / (TUNING.reverseTopSpeed * KMH);

export const MAX_GEAR = RATIOS.length;

/** Front slip angle where the tyre grips hardest (peak of the magic formula). */
const FRONT_PEAK_SLIP = Math.tan(Math.PI / (2 * TUNING.tyre.C)) / TUNING.tyre.front.B;
/** Stability control lets the rear slide a little past its own peak before stepping in. */
const REAR_ESC_SLIP = (Math.tan(Math.PI / (2 * TUNING.tyre.C)) / TUNING.tyre.rear.B) * 1.15;
const SUSPENSION_TRAVEL = 0.3; // droop before the wheels leave the ground (long-travel, rally-style)
/** A manual downshift is taken even past the limiter — up to this multiple of it (beyond, the engine would burst). */
const OVERREV_MAX = 1.7;
/** Engine speed the tachometer / sound can be dragged to during an over-rev downshift. */
const OVERREV_SHOW = 11500;
/** Most upward speed the ground can hand the body (m/s): banks and kerbs lift the car, never launch it. */
const MAX_LIFT_SPEED = 2.2;
/** Gravity multiplier while airborne: a game-feel touch so jumps stay short and controllable. */
const AIR_GRAVITY = 1.85;

function engineTorque(rpm) {
  const curve = TUNING.engine.curve;
  let i = 0;
  while (i < curve.length - 2 && rpm > curve[i + 1][0]) i++;
  const [r0, t0] = curve[i];
  const [r1, t1] = curve[i + 1];
  const t = clamp((rpm - r0) / (r1 - r0), 0, 1);
  return TUNING.engine.peakTorque * (t0 + (t1 - t0) * t);
}

/** Simplified Pacejka magic formula: normalised lateral force for slip angle α (rad). */
const pacejka = (alpha, B) => Math.sin(TUNING.tyre.C * Math.atan(B * alpha));

/** esc is a strength: 1 full, 0.35 a light safety net that still lets the rear slide, 0 off. */
export const ASSISTS = {
  full: { tc: true, abs: true, esc: 1 },
  sport: { tc: false, abs: true, esc: 0.35 },
  off: { tc: false, abs: false, esc: 0 },
};

export class Vehicle {
  constructor(world, spawn) {
    this.world = world;
    this.transmission = 'auto';
    this.assists = ASSISTS.full;
    this.distance = 0;
    this.reset(spawn);
  }

  /** Places the car at rest at { x, z, heading } in 1st gear. */
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
    this.pendingGear = 1;
    this.shiftTimer = 0;
    this.reverseHold = 0;
    this.demand = 0;       // smoothed throttle the automatic box reads (driver intent)
    this.sinceShift = 10;  // seconds since the automatic box last changed gear
    this.rpm = TUNING.engine.idle;
    this.limiter = false;
    this.ax = 0;
    this.ay = 0;
    this.slip = 0;
    this.rearSlide = 0;
    this.wheelspin = 0;
    this.frontLocked = false;
    this.rearLocked = false;
    this.speed = 0;
    this.forwardSpeed = 0;
    this.lateralSpeed = 0;
    this.rearSurfaceSpeed = 0;
    this.surface = 'road';
    this.airborne = false;
    this.bump = 0;
    this.braking = 0;
    this.pushes = new Map(); // multiplayer: shoves our car gave others, waiting to be sent
    this.throttle = 0;
    this.shifted = 0;
    this.lastGround = undefined;
    this.escActive = false;
    this.airbrake = 0;
    this.aeroLoad = 0;
    this.refused = null;
    this.overRev = false;
    this.downshifts = 0;
  }

  get ratio() {
    return this.gear < 0 ? REVERSE_RATIO : RATIOS[this.gear - 1];
  }

  /** Engine rpm that `gear` would give at forward speed `u`. */
  rpmInGear(gear, u) {
    const ratio = gear < 0 ? REVERSE_RATIO : RATIOS[gear - 1];
    return (Math.abs(u) / TUNING.wheelRadius) * ratio * RPM_PER_RADS;
  }

  /* ─── gearbox ─────────────────────────────────────────── */

  startShift(gear) {
    if (gear === this.gear || this.shiftTimer > 0) return false;
    this.pendingGear = gear;
    this.shiftTimer = TUNING.shiftTime;
    this.shifted = gear > this.gear ? 1 : -1;
    if (gear < this.gear && gear > 0) this.downshifts++; // counted for exhaust pops / flames
    this.sinceShift = 0;
    return true;
  }

  /** Manual upshift (also R → 1). */
  shiftUp() {
    if (this.gear === -1) {
      if (Math.abs(this.forwardSpeed) < 2) this.gear = this.pendingGear = 1;
      return true;
    }
    return this.gear < MAX_GEAR ? this.startShift(this.gear + 1) : false;
  }

  /** Manual downshift (refused if it would over-rev; 1 → R only when nearly stopped). */
  shiftDown() {
    if (this.gear === 1) {
      if (Math.abs(this.forwardSpeed) < 2) {
        this.gear = this.pendingGear = -1;
        return true;
      }
      return false;
    }
    if (this.gear <= 1) return false;
    // Like a real manual: a downshift past the redline is taken — the clutch then drags the
    // engine up and the car slows hard (a "money shift"). Only a truly impossible one is refused.
    if (this.rpmInGear(this.gear - 1, this.forwardSpeed) > TUNING.engine.limiter * OVERREV_MAX) {
      this.refused = 'over-rev';
      return false;
    }
    return this.startShift(this.gear - 1);
  }

  /** Automatic gearbox logic, including sliding into reverse when holding the brake at a stop. */
  autoShift(dt, input) {
    const u = this.forwardSpeed;
    const A = TUNING.auto;
    // Driver intent: rises quickly, fades over about a second. Keyboard throttle is on/off,
    // so reading the raw pedal made the box short-shift on every lift and kick down on
    // every press — hunting between two gears all the way down a road.
    const t = input.throttle;
    this.demand += (t - this.demand) * Math.min(1, dt * (t > this.demand ? 2.5 : 1.2));
    this.sinceShift += dt;
    if (this.gear > 0) {
      if (Math.abs(u) < 0.8 && input.brake > 0.5 && input.throttle === 0) {
        this.reverseHold += dt;
        if (this.reverseHold > 0.35) {
          this.gear = this.pendingGear = -1;
          this.reverseHold = 0;
        }
        return;
      }
      this.reverseHold = 0;
      if (this.shiftTimer > 0) return;
      const rpm = this.rpmInGear(this.gear, u);
      const d = this.demand;
      const braking = input.brake > 0.3;
      // relaxed driving short-shifts; flat out holds the gear to the redline
      const upAt = d > 0.8 ? A.upFull : d > 0.4 ? A.upMid : A.upLight;
      const kickdown = t > 0.7 && d > 0.7;
      const downAt = braking ? A.downBraking : kickdown ? A.kickdown : A.down;
      const lower = this.rpmInGear(this.gear - 1, u);
      if (this.sinceShift > 0.8 && this.gear < MAX_GEAR && rpm > upAt && !braking
        && this.rpmInGear(this.gear + 1, u) > 1900 && !this.wheelspin) {
        this.startShift(this.gear + 1);
      } else if (this.sinceShift > (braking ? 0.3 : 0.8) && this.gear > 1 && rpm < downAt
        && lower < Math.min(A.upFull - 300, upAt - 600)) {
        // the lower gear must sit well under the upshift point, or it would shift straight back
        this.startShift(this.gear - 1);
      }
    } else if (Math.abs(u) < 0.8 && input.throttle > 0.3 && input.brake === 0) {
      this.gear = this.pendingGear = 1;
    }
  }

  /* ─── simulation ──────────────────────────────────────── */

  /**
   * Advances by `dt` with input { throttle, brake, steer (-1…1, + = right), handbrake }.
   * In automatic mode reverse is selected by holding the brake at a stop, and
   * the pedals swap while reversing (S drives backwards, W brakes).
   */
  step(dt, input) {
    if (this.shiftTimer > 0) {
      this.shiftTimer -= dt;
      if (this.shiftTimer <= 0) {
        this.shiftTimer = 0;
        this.gear = this.pendingGear;
      }
    }
    if (this.transmission === 'auto' || input.autoShift) this.autoShift(dt, input);

    let throttle = input.throttle;
    let brake = input.brake;
    if (this.gear < 0 && (this.transmission === 'auto' || input.autoShift)) {
      throttle = input.brake;
      brake = input.throttle;
    }
    this.throttle = throttle;
    this.braking = brake; // brake lights (in reverse the auto box swaps the pedals, so not input.brake)

    const sub = dt / 2;
    for (let k = 0; k < 2; k++) this.integrate(sub, throttle, brake, input);

    this.collide();
    if (this.otherCars?.length) this.collideCars(this.otherCars);
    this.suspend(dt);
    this.speed = Math.hypot(this.vx, this.vz);
    this.distance += this.speed * dt;
    this.bump = Math.max(0, this.bump - dt * 3);
    this.shifted = 0;
  }

  integrate(dt, throttle, brake, input) {
    const T = TUNING;
    const m = T.mass;
    const a = T.cgToFront;
    const b = T.cgToRear;
    const L = a + b;
    const sinH = Math.sin(this.heading);
    const cosH = Math.cos(this.heading);
    // body frame: u forward, v left (left = (cos h, −sin h))
    let u = this.vx * sinH + this.vz * cosH;
    let v = this.vx * cosH - this.vz * sinH;
    let r = this.yawRate;
    const speed = Math.hypot(u, v);

    this.world.groundHeight(this.x, this.z);
    const surface = this.world.surfaceAt();
    this.surface = surface;
    const surfaceGrip = this.world.gripAt(this.x, this.z, surface);
    const mu = T.tyre.front.mu * surfaceGrip;
    const muR = T.tyre.rear.mu * surfaceGrip;
    const assists = this.assists;

    // steering assist: full input asks the front tyres for their peak slip angle plus the
    // geometry of a limit-grip turn — so full lock is always the fastest way round, never a plough.
    // Without assists there's extra lock to catch slides with counter-steer.
    // (the extra lock fades out from ~90 to ~200 km/h: drifts need it, a 300 km/h flick doesn't)
    const uAbs = Math.max(Math.abs(u), 1);
    const extraLock = (assists.esc >= 1 ? 0 : assists.esc > 0 ? 0.3 : 0.7) * clamp(1 - (uAbs - 25) / 30, 0, 1);
    const lockBoost = 1 + extraLock;
    const aeroGrip = 1 + Math.min(T.downforceMax, (T.downforceCoeff * uAbs * uAbs) / (m * G)); // downforce adds grip
    const limitGeometry = (a + b) * (mu * G * aeroGrip * 1.1) / (uAbs * uAbs);
    const steerLimit = Math.min(T.maxSteer, (FRONT_PEAK_SLIP + limitGeometry) * lockBoost);
    // in the air the wheels ease back towards straight, so the car lands pointing where it's going
    const target = input.steer * steerLimit * (this.airborne ? 0.3 : 1);
    // Keyboard-friendly steering: turning in is smooth (calmer the faster you go, so a tap never
    // jerks the car), while straightening up and counter-steering are quick — whenever the wheels
    // head back towards the centre they move at the faster return rate.
    const returning = input.steer === 0 || Math.sign(target - this.steerAngle) !== Math.sign(this.steerAngle || target);
    const rate = returning ? T.steerReturn / (1 + Math.abs(u) / 70) : T.steerRate / (1 + Math.abs(u) / 32);
    this.steerAngle += clamp(target - this.steerAngle, -rate * dt, rate * dt);
    const delta = -this.steerAngle; // + = left

    // air brake flap: up when braking hard at speed, folds away as you come off the brake
    const flapUp = brake > 0.4 && u > T.airbrake.minSpeed ? 1 : 0;
    this.airbrake += (flapUp - this.airbrake) * Math.min(1, dt * (flapUp ? 9 : 4));
    // axle loads: static split + longitudinal transfer + downforce (+ the flap's, all on the rear)
    const u2 = Math.max(0, u) * u;
    const downforce = Math.min(T.downforceMax * m * G, T.downforceCoeff * u2);
    const flapDownforce = T.airbrake.downforce * this.airbrake * u2;
    this.aeroLoad = downforce + flapDownforce; // also pulls the body down onto the road (suspend)
    let Nf = (m * G * b - m * this.ax * T.cgHeight) / L + downforce * T.downforceFront;
    let Nr = (m * G * a + m * this.ax * T.cgHeight) / L + downforce * (1 - T.downforceFront) + flapDownforce;
    Nf = Math.max(Nf, 0.12 * m * G);
    Nr = Math.max(Nr, 0.12 * m * G);
    if (this.airborne) {
      Nf *= 0.05;
      Nr *= 0.05;
    }
    const maxF = mu * Nf;
    const maxR = muR * Nr;

    // engine & drivetrain
    const E = T.engine;
    const shifting = this.shiftTimer > 0;
    const wheelRpm = this.rpmInGear(this.gear, u);
    const launching = wheelRpm < 2200 && throttle > 0;
    let engineRpm = launching ? Math.max(wheelRpm, E.idle + throttle * 3600) : Math.max(wheelRpm, E.idle);
    let torque = 0;
    // over-rev: the wheels are driving the engine past its limiter (after a hard downshift);
    // the clutch drags hard until the revs come back down, whatever the throttle says
    this.overRev = !shifting && this.gear > 0 && wheelRpm > E.limiter + 150;
    if (this.overRev) {
      const excess = Math.min(1, (wheelRpm - E.limiter) / 1800);
      torque = -(E.brakeTorque[0] + E.brakeTorque[1] * E.limiter) - 1100 * (0.35 + 0.65 * excess);
      this.limiter = true;
      engineRpm = Math.min(wheelRpm, OVERREV_SHOW);
    } else if (!shifting) {
      if (throttle > 0.02) {
        this.limiter = engineRpm >= E.limiter;
        torque = this.limiter ? 0 : throttle * engineTorque(engineRpm);
      } else if (wheelRpm > E.idle * 1.3) {
        torque = -(E.brakeTorque[0] + E.brakeTorque[1] * engineRpm);
        this.limiter = false;
      }
    }
    const dir = this.gear < 0 ? -1 : 1;
    const driveForce = (torque * this.ratio * T.efficiency) / T.wheelRadius * dir;

    // lateral: slip angle of each axle, measured in the wheel's own frame
    const cosD = Math.cos(delta);
    const sinD = Math.sin(delta);
    const vyFront = v + a * r;
    const longF = u * cosD + vyFront * sinD;
    const latF = -u * sinD + vyFront * cosD;
    const alphaF = -Math.atan2(latF, Math.max(Math.abs(longF), 3));
    const alphaR = -Math.atan2(v - b * r, Math.max(Math.abs(u), 3));
    let Fyf = pacejka(alphaF, T.tyre.front.B) * maxF;
    let Fyr = pacejka(alphaR, T.tyre.rear.B) * maxR;

    // brakes
    const motion = Math.abs(u) > 0.3 ? Math.sign(u) : 0;
    const brakeTotal = brake * T.brakeForce * m * G;
    let Fxf = -motion * brakeTotal * T.brakeBias;
    let Fxr = driveForce - motion * brakeTotal * (1 - T.brakeBias);

    // rear longitudinal: handbrake lock, wheelspin, lock-up — or the assists preventing them
    let rearSliding = 0;
    this.wheelspin = 0;
    this.rearLocked = false;
    this.frontLocked = false;
    if (assists.tc && !input.handbrake && Math.sign(driveForce) === Math.sign(Fxr) && driveForce !== 0) {
      const room = Math.sqrt(Math.max(0, maxR * maxR - Fyr * Fyr)) * 0.95;
      const cap = Math.max(room, maxR * 0.2);
      if (Math.abs(Fxr) > cap) Fxr = Math.sign(Fxr) * cap;
    }
    if (assists.abs && !input.handbrake && brakeTotal > 0 && Math.sign(Fxr) === -motion) {
      // same on the rear: braking never takes the grip that keeps the tail in line
      const rearCap = Math.max(maxR * 0.2, Math.sqrt(Math.max(0, maxR * maxR - Fyr * Fyr)) * 0.98);
      if (Math.abs(Fxr) > rearCap) Fxr = Math.sign(Fxr) * rearCap;
    }
    const engineDrag = driveForce * motion < 0 && this.overRev; // hard downshift pulling the rear back
    if (engineDrag && !input.handbrake) {
      // Slipper-clutch style: the over-rev drag uses the rear grip that isn't holding the car
      // in line. With assists it stays tidy; without, it chirps the tyres and nudges the tail
      // out (a catchable twitch, not a spin).
      const keep = assists.tc || assists.abs ? 0.98 : 1.15;
      const floor = assists.tc || assists.abs ? 0.45 : 0.7;
      const dragCap = Math.min(maxR, Math.max(maxR * floor, Math.sqrt(Math.max(0, maxR * maxR - Fyr * Fyr)) * keep));
      if (Math.abs(Fxr) > dragCap) {
        if (!(assists.tc || assists.abs)) rearSliding = Math.min(0.45, (Math.abs(Fxr) / dragCap - 1) * 0.5 + 0.2);
        Fxr = Math.sign(Fxr) * dragCap;
      }
    }
    if (input.handbrake && Math.abs(u) > 0.5) {
      Fxr = -Math.sign(u) * maxR * 0.9;
      this.rearLocked = true;
      rearSliding = 1;
    } else if (Math.abs(Fxr) > maxR) {
      const pulling = driveForce * motion < 0; // engine braking pulling the rear back
      const driving = !pulling && Math.sign(Fxr) === Math.sign(driveForce) && Math.abs(driveForce) > Math.abs(Fxr - driveForce);
      const assisted = driving ? assists.tc : assists.abs || (pulling && assists.tc);
      if (assisted) {
        Fxr = Math.sign(Fxr) * maxR * 0.97;
      } else {
        const excess = Math.abs(Fxr) / maxR;
        Fxr = Math.sign(Fxr) * maxR * 0.85;
        rearSliding = Math.min(1, excess - 1 + 0.45);
        if (driving) this.wheelspin = rearSliding;
        else this.rearLocked = true;
      }
    }
    // ABS also keeps back the cornering grip the driver is asking for, so you can brake
    // and steer at the same time (trail braking) instead of ploughing straight on
    const braked = brakeTotal > 0 && Math.sign(Fxf) === -motion;
    if (assists.abs && braked) {
      const frontCap = Math.max(maxF * 0.45, Math.sqrt(Math.max(0, maxF * maxF - Fyf * Fyf)) * 0.98);
      if (Math.abs(Fxf) > frontCap) Fxf = Math.sign(Fxf) * frontCap;
    }
    if (Math.abs(Fxf) > maxF) {
      if (assists.abs) Fxf = Math.sign(Fxf) * maxF * 0.97;
      else {
        Fxf = Math.sign(Fxf) * maxF * 0.85;
        this.frontLocked = true;
      }
    }

    // friction circle: whatever grip is used along the tyre is gone sideways
    let limitF = Math.sqrt(Math.max(0, maxF * maxF - Fxf * Fxf));
    let limitR = Math.sqrt(Math.max(0, maxR * maxR - Fxr * Fxr));
    if (this.frontLocked) limitF *= 0.3;
    if (rearSliding) limitR *= 1 - 0.6 * rearSliding; // a spinning or locked tyre has little sideways grip left
    Fyf = clamp(Fyf, -limitF, limitF);
    Fyr = clamp(Fyr, -limitR, limitR);

    // body forces (x forward, y left) and yaw moment
    let Fx = Fxr + Fxf * cosD - Fyf * sinD;
    const Fy = Fyr + Fxf * sinD + Fyf * cosD;
    let Mz = a * (Fxf * sinD + Fyf * cosD) - b * Fyr;

    const rolling = surface === 'grass' ? T.offroadRolling : T.rolling;
    Fx -= (T.dragCoeff + T.airbrake.drag * this.airbrake) * u * Math.abs(u) + rolling * m * G * clamp(u, -1, 1);
    const hf = this.world.groundHeight(this.x + sinH * a, this.z + cosH * a);
    const hr = this.world.groundHeight(this.x - sinH * b, this.z - cosH * b);
    Fx -= m * G * ((hf - hr) / L);

    // the yaw rate the grip can really hold (downforce included — or it would fight perfectly
    // good high-speed corners as if they were slides), and the one the steering asks for
    const rMax = ((mu * G * aeroGrip) / Math.max(Math.abs(u), 3)) * 1.08;
    // how fast the car's path is actually turning (lateral force / momentum): if the nose
    // rotates much faster than that, the car is sliding out rather than cornering
    const rPath = (Fy / (m * Math.max(Math.abs(u), 3))) * (u < 0 ? -1 : 1);
    const rLimit = Math.min(rMax, Math.abs(rPath) * 1.2 + 0.04);
    const rKin = clamp((u * Math.tan(delta)) / L, -rLimit, rLimit);

    // in the air there's no tyre grip to steer with, but the body and wing still weathervane
    // into the airflow: the spin dies away and the nose swings back in line with the flight path
    if (this.airborne && Math.abs(u) > 3) {
      const slip = Math.atan2(v, Math.abs(u));
      Mz -= T.yawInertia * (3.2 * r - 5 * slip * Math.sign(u));
    }

    // aero stability (every mode): at speed the big rear wing acts like a weathervane,
    // resisting the tail swinging out faster than the car's path is turning. Nothing below
    // ~100 km/h (drifts are untouched), full effect from ~300 km/h
    const aeroYaw = clamp((Math.abs(u) - 28) / 55, 0, 1.6);
    if (aeroYaw > 0) Mz -= 14000 * aeroYaw * aeroGrip * (r - rPath);

    // stability control (like brake-based ESC). It only steps in for OVERSTEER:
    //  • the car rotating faster than the steering (and grip) allow — which also damps the
    //    dart of a sharp turn-in at high speed, or
    //  • the rear axle sliding past the tyre's peak slip angle.
    // Normal cornering — even at the limit — is left alone. Gains grow with the aero grip,
    // because the tyre forces it has to balance do.
    this.escActive = false;
    if (assists.esc && Math.abs(u) > 3) {
      const excess = r - rKin;
      const rearSlip = Math.atan2(v - b * r, Math.max(Math.abs(u), 3));
      let correction = 0;
      if (Math.abs(r) > Math.abs(rKin) + 0.02 && Math.sign(excess) === Math.sign(r)) correction -= excess * 24000 * aeroGrip;
      if (Math.abs(rearSlip) > REAR_ESC_SLIP) correction += (rearSlip - Math.sign(rearSlip) * REAR_ESC_SLIP) * 45000 * aeroGrip;
      if (correction !== 0) {
        this.escActive = true;
        Mz += correction * assists.esc;
        Fx -= Math.sign(u) * Math.min(Math.abs(correction) * 0.05, 0.15 * m * G) * assists.esc;
      }
    }
    // brake stability (every mode; gentler with assists off): under braking the car is held
    // to the line the steering asks for — no twitch or snap — and it still turns in when you
    // steer while braking
    if (brake > 0.2 && Math.abs(u) > 5) {
      const hold = assists.esc > 0 ? 1 : 0.5;
      // while braking the nose may only lead the path a little, so the car can't pivot into a slide
      const rBrake = Math.min(rMax, Math.abs(rPath) * 1.04 + 0.015);
      const rTarget = clamp(rKin, -rBrake, rBrake);
      Mz += clamp((rTarget - r) * 11000 * aeroGrip, -30000 * aeroGrip, 30000 * aeroGrip) * brake * hold;
    }

    // no r·v / −r·u terms: velocity is stored in world space and re-projected onto the
    // turned body every substep, which already accounts for the rotating frame
    const du = Fx / m;
    const dv = Fy / m;
    u += du * dt;
    v += dv * dt;
    r += (Mz / T.yawInertia) * dt;

    // settle to a stop instead of creeping
    const wantsMotion = throttle > 0.02;
    if (Math.abs(u) < 0.35 && !wantsMotion) {
      u *= 0.85;
      v *= 0.7;
      r *= 0.7;
    }
    if (speed < 1.5) r *= 0.96;

    this.ax += (Fx / m - this.ax) * Math.min(1, dt * 10);
    this.ay += (Fy / m - this.ay) * Math.min(1, dt * 10);

    // back to world space with the pre-turn basis, then turn
    this.vx = sinH * u + cosH * v;
    this.vz = cosH * u - sinH * v;
    this.heading += r * dt;
    this.yawRate = r;
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    // tachometer: wheel speed, clutch slip at launch, flare while spinning
    if (shifting) {
      const next = this.rpmInGear(this.pendingGear, u);
      engineRpm = clamp(next, E.idle, OVERREV_SHOW);
    } else if (this.wheelspin > 0) {
      engineRpm = Math.min(E.limiter, engineRpm + 3000 * this.wheelspin * throttle);
    }
    this.rpm += (engineRpm - this.rpm) * Math.min(1, dt * (shifting ? 25 : 14));
    this.forwardSpeed = u;
    this.lateralSpeed = v;
    this.rearSlide = Math.min(1, Math.abs(v - b * r) / 7);
    this.slip = Math.min(1, Math.max(this.rearSlide, this.wheelspin, this.rearLocked ? 0.8 : 0, this.frontLocked ? 0.6 : 0));
    this.rearSurfaceSpeed = this.rearLocked ? 0 : u + this.wheelspin * 25 * Math.sign(driveForce || 1);
    this.braking = brake > 0 && Math.abs(u) > 0.4 ? brake : 0;
  }

  /**
   * Soft contact with trees, rocks, lamps and guardrails (rails are wall segments).
   * The body is two circles (nose and tail) so the car's ends meet obstacles where you see
   * them. Each contact is a rigid-body impulse at the touching point: the approach speed is
   * absorbed (only a gentle ≤ 0.8 m/s push back), friction scrubs speed along the surface in
   * proportion to how hard it hit, and an off-centre knock swings the nose away — so a
   * glancing touch keeps its speed, a head-on stop is a stop, and nothing throws the car.
   * Breakable things (posts, signs, lamps, poles, trees…) hit faster than their break speed
   * give way instead and go flying as debris (see World#breakObstacle).
   */
  /**
   * Contact with friends' cars in multiplayer. Each entry is { seat, x, z, heading, vx, vz,
   * authority } — two circles like ours. Every game moves only its own car, so each pair of
   * cars has one referee: the game with `authority` over the pair (the lower seat) detects the
   * contact against its view of the other car, takes its half of a slightly springy
   * equal-mass impulse and half the overlap, and records the other half in `pushes` (seat →
   * { dvx, dvz, dx, dz }) to be sent to that car. The other game doesn't resolve the pair
   * itself; it takes what it's sent (applyPush). A shunt from behind pushes the car in front,
   * a side-swipe nudges both apart, and nobody gets thrown.
   */
  collideCars(cars) {
    const T = TUNING;
    const m = T.mass;
    const I = T.yawInertia * 3;
    const R = T.bodyRadius;
    for (const other of cars) {
      if (!other.authority) continue;
      const ofx = Math.sin(other.heading);
      const ofz = Math.cos(other.heading);
      for (const along of T.bodyCircles) {
        const px = Math.sin(this.heading) * along;
        const pz = Math.cos(this.heading) * along;
        for (const otherAlong of T.bodyCircles) {
          const dx = this.x + px - (other.x + ofx * otherAlong);
          const dz = this.z + pz - (other.z + ofz * otherAlong);
          const d = Math.hypot(dx, dz);
          if (d >= 2 * R || d < 1e-4) continue;
          const nx = dx / d;
          const nz = dz / d;
          const half = (2 * R - d) * 0.5;
          this.x += nx * half;
          this.z += nz * half;
          const push = this.pushes.get(other.seat) ?? { dvx: 0, dvz: 0, dx: 0, dz: 0 };
          push.dx -= nx * half;
          push.dz -= nz * half;
          other.x -= nx * half; // our view of them moves too, so the overlap isn't counted twice
          other.z -= nz * half;
          const rx = px - nx * R;
          const rz = pz - nz * R;
          const vn = (this.vx + this.yawRate * rz - other.vx) * nx + (this.vz - this.yawRate * rx - other.vz) * nz;
          if (vn < 0) {
            const kn = nx * rz - nz * rx;
            const jn = (-1.25 * vn) / (2 / m + (kn * kn) / I);
            this.vx += (jn * nx) / m;
            this.vz += (jn * nz) / m;
            this.yawRate += (0.6 * jn * kn) / I;
            this.bump = Math.min(1, this.bump - vn / 12);
            push.dvx -= (jn * nx) / m;
            push.dvz -= (jn * nz) / m;
            other.vx -= (jn * nx) / m;
            other.vz -= (jn * nz) / m;
          }
          this.pushes.set(other.seat, push);
        }
      }
    }
  }

  /** A shove sent by another player's game (their half of a car-to-car contact). */
  applyPush({ dvx, dvz, dx, dz }) {
    this.vx += dvx;
    this.vz += dvz;
    this.x += dx;
    this.z += dz;
    this.bump = Math.min(1, this.bump + Math.hypot(dvx, dvz) / 12);
  }

  /** Rolls the car along its heading at `speed` m/s in a fitting gear (placing it into a moving pack). */
  launch(speed) {
    this.vx = Math.sin(this.heading) * speed;
    this.vz = Math.cos(this.heading) * speed;
    this.forwardSpeed = speed;
    const kmh = speed * 3.6;
    const index = TUNING.gearTopSpeeds.findIndex(top => top > kmh * 1.3);
    this.gear = this.pendingGear = index < 0 ? TUNING.gearTopSpeeds.length : index + 1;
  }

  collide() {
    const T = TUNING;
    const m = T.mass;
    const I = T.yawInertia * 3; // heavier than real: knocks ease the car round instead of snapping it
    const R = T.bodyRadius;
    for (const along of T.bodyCircles) {
      this.world.forEachObstacleNear(this.x, this.z, (o) => {
        const px = Math.sin(this.heading) * along; // circle centre, relative to the car
        const pz = Math.cos(this.heading) * along;
        const ccx = this.x + px;
        const ccz = this.z + pz;
        let cx = o.x;
        let cz = o.z;
        if (o.seg) {
          const [x0, z0, x1, z1] = o.seg;
          const sx = x1 - x0;
          const sz = z1 - z0;
          const t = clamp(((ccx - x0) * sx + (ccz - z0) * sz) / (sx * sx + sz * sz || 1), 0, 1);
          cx = x0 + sx * t;
          cz = z0 + sz * t;
        }
        const dx = ccx - cx;
        const dz = ccz - cz;
        const d = Math.hypot(dx, dz);
        const min = R + o.r;
        if (d >= min || d < 1e-4) return;
        const nx = dx / d;
        const nz = dz / d;

        // contact point relative to the centre, and its velocity (v + ω × r in this frame)
        const rx = px - nx * R;
        const rz = pz - nz * R;
        const w = this.yawRate;
        const vpx = this.vx + w * rz;
        const vpz = this.vz - w * rx;
        const vn = vpx * nx + vpz * nz;
        const kn = nx * rz - nz * rx; // lever arm of the normal impulse about the centre

        // Hit hard enough, breakables give way: the world turns the object into tumbling debris
        // and works out the impulse of the hit from both bodies (a plastic post costs nothing,
        // a lamp post a little, a tree a real chunk of speed); the car takes it and drives on.
        if (o.breakSpeed !== undefined && vn < 0 && -vn >= o.breakSpeed && this.world.breakObstacle) {
          const impact = -vn;
          const jn = this.world.breakObstacle(o, {
            x: this.x + rx, y: this.y + 0.45, z: this.z + rz, vx: vpx, vz: vpz, nx, nz, impact,
            carInverseMass: 1 / m + (kn * kn) / I,
          });
          this.vx += (jn * nx) / m;
          this.vz += (jn * nz) / m;
          this.yawRate += (0.5 * jn * kn) / I;
          this.bump = Math.min(1, this.bump + jn / m / 8);
          return;
        }

        this.x += nx * (min - d);
        this.z += nz * (min - d);
        if (vn >= 0) return;
        const impact = -vn;
        this.bump = Math.min(1, this.bump + impact / 12);

        const jn = (impact + Math.min(0.8, impact * 0.1)) / (1 / m + (kn * kn) / I);
        this.vx += (jn * nx) / m;
        this.vz += (jn * nz) / m;
        this.yawRate += (jn * kn) / I;

        // Pinned nose-first (or tail-first in reverse) and steering: the tyres can't make
        // cornering force at a standstill, so without this the car would sit pushing into a
        // post forever. Pivot it around the contact like the turned wheels crabbing sideways.
        const pushing = along > 0 ? this.gear > 0 : this.gear < 0;
        if (pushing && this.throttle > 0.1 && this.speed < 3 && Math.abs(this.steerAngle) > 0.05) {
          const dir = along > 0 ? 1 : -1;
          const pivot = (dir * 1.4 * Math.tan(-this.steerAngle)) / (T.cgToFront + T.cgToRear);
          if (Math.abs(this.yawRate) < Math.abs(pivot) || Math.sign(this.yawRate) !== Math.sign(pivot)) this.yawRate = pivot;
        }

        // Coulomb friction along the surface (never reverses the sliding direction)
        const tx0 = vpx - vn * nx;
        const tz0 = vpz - vn * nz;
        const vt = Math.hypot(tx0, tz0);
        if (vt > 1e-3) {
          const tx = tx0 / vt;
          const tz = tz0 / vt;
          const kt = tx * rz - tz * rx;
          const jt = Math.min(vt / (1 / m + (kt * kt) / I), 0.35 * jn);
          this.vx -= (jt * tx) / m;
          this.vz -= (jt * tz) / m;
          this.yawRate -= (jt * kt) / I;
        }
      });
    }
  }

  /** Heave follows the ground (with air time over crests); pitch/roll are springs. */
  suspend(dt) {
    const S = TUNING.suspension;
    const sinH = Math.sin(this.heading);
    const cosH = Math.cos(this.heading);
    const w = this.world;
    const fx = sinH * 1.25;
    const fz = cosH * 1.25;
    const lx = cosH * (TUNING.track / 2); // left = (cos h, −sin h)
    const lz = -sinH * (TUNING.track / 2);
    const hFL = w.groundHeight(this.x + fx + lx, this.z + fz + lz);
    const hFR = w.groundHeight(this.x + fx - lx, this.z + fz - lz);
    const hRL = w.groundHeight(this.x - fx + lx, this.z - fz + lz);
    const hRR = w.groundHeight(this.x - fx - lx, this.z - fz - lz);
    const ground = (hFL + hFR + hRL + hRR) / 4;

    // wheels stay planted while the ground is within suspension travel: the body follows
    // the road's own vertical speed, but can never fall faster than gravity — so the car
    // only leaves the ground over genuine crests, not on every undulation at speed
    const groundVel = this.lastGround === undefined ? 0 : (ground - this.lastGround) / dt;
    this.lastGround = ground;
    const wasAirborne = this.airborne;
    // downforce pulls the body onto the road like extra weight — at 300 km/h it roughly doubles
    // the pull — and airborne the car falls a little faster than real (AIR_GRAVITY), so crests
    // give short hops instead of long, uncontrollable flights
    const pull = G + (this.aeroLoad ?? 0) / TUNING.mass;
    if (this.y - ground > SUSPENSION_TRAVEL) {
      this.vy -= pull * AIR_GRAVITY * dt;
      this.airborne = true;
    } else {
      // touching down: the suspension soaks it up here, so this is where the thud belongs
      if (wasAirborne) {
        const impact = Math.min(MAX_LIFT_SPEED, groundVel) - this.vy;
        if (impact > 3) this.bump = Math.min(1, this.bump + impact / 10);
      }
      const follow = Math.min(MAX_LIFT_SPEED, groundVel) + (ground - this.y) * S.heaveFollow;
      const next = this.vy + (follow - this.vy) * Math.min(1, dt * S.heaveRate);
      this.vy = Math.min(Math.max(next, this.vy - pull * dt), MAX_LIFT_SPEED);
      this.airborne = false;
    }
    this.y += this.vy * dt;
    if (this.y < ground - 0.03) {
      const impact = groundVel - this.vy;
      if (wasAirborne && impact > 3) this.bump = Math.min(1, this.bump + impact / 10);
      this.y = ground - 0.03;
      this.vy = Math.max(this.vy, Math.min(groundVel, MAX_LIFT_SPEED));
    }

    const groundPitch = Math.atan2((hRL + hRR) / 2 - (hFL + hFR) / 2, 2.5);
    const groundRoll = Math.atan2((hFL + hRL) / 2 - (hFR + hRR) / 2, TUNING.track);
    const pitchTarget = groundPitch + clamp(-this.ax * S.accelPitch, -0.06, 0.06);
    const rollTarget = groundRoll + clamp(this.ay * S.latRoll, -0.08, 0.08);
    this.pitchVel += (S.pitchK * (pitchTarget - this.pitch) - S.pitchC * this.pitchVel) * dt;
    this.pitch += this.pitchVel * dt;
    this.rollVel += (S.rollK * (rollTarget - this.roll) - S.rollC * this.rollVel) * dt;
    this.roll += this.rollVel * dt;
  }

  /** Normalised rpm (0 idle … 1 redline) for sound and gauges. */
  get rpmNorm() {
    const E = TUNING.engine;
    return clamp((this.rpm - E.idle) / (E.redline - E.idle), 0, 1.02);
  }

  get gearLabel() {
    if (this.shiftTimer > 0) return '·';
    return this.gear < 0 ? 'R' : String(this.gear);
  }
}
