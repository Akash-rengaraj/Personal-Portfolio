/**
 * Zen Drive engine: owns the renderer, scene and fixed-step loop.
 * React only mounts it and draws the HUD from the stats it emits (~10 Hz);
 * all per-frame work stays here, outside React.
 */
import * as THREE from 'three';
import { World } from './world';
import { Sky, DAY_LENGTH, timeLabel } from './sky';
import { Birds } from './birds';
import { Effects } from './effects';
import { Vehicle, ASSISTS } from './vehicle';
import { createCar, CAR_DIMENSIONS } from './carModel';
import { SkidMarks, TyreSmoke } from './tyres';
import { ExhaustFx } from './exhaust';
import { CameraRig } from './camera';
import { DriveInput } from './input';
import { DriveAudio } from './audio';
import { ROAD } from './road';
import { detectQuality } from './device';
import { RemoteCars } from './net/remoteCars';
import { packState, packHit, unpackHit, FLAG, SEND_HZ } from './net/protocol';
import { clamp, wrapAngle } from './noise';

const STEP = 1 / 120;
const MAX_STEPS = 12;
const START_PHASE = 0.6; // late afternoon, drifting into golden hour
const INTRO_SPEED = 14;  // m/s the car idles along behind the intro screen
const CRUISE_MAX = 200 / 3.6;

/**
 * Graphics tiers — each trades looks for CPU / GPU / memory:
 *  • maxFps: frame cap. Frames are drawn on every n-th screen refresh, so a 144–165 Hz laptop
 *    screen doesn't make the game draw (and burn CPU on) 165 frames a second.
 *  • chunkRadius: terrain chunks kept around the car (view distance and memory)
 *  • sceneryDensity / terrainGrid: how many trees and rocks, how fine the ground mesh is
 *  • nearLod: [in, out] metres for full-detail scenery tiles; null keeps the light version only
 *  • groundCover, birds, clouds, shadows: extras
 *  • weather / fx / debrisBodies: ambient particles, crash particles, tumbling debris kept
 *  • statsMs: HUD refresh interval · streamMs: per-frame budget for building the world
 */
export const QUALITY_PRESETS = {
  low: {
    level: 0, maxFps: 30, pixelRatio: 0.75, antialias: false, shadows: false,
    chunkRadius: 1, sceneryDensity: 0.5, terrainGrid: 24, nearLod: null,
    groundCover: false, birds: false, clouds: false, weather: 0.35, fx: 0.4, debrisBodies: 8, statsMs: 200, streamMs: 3,
  },
  medium: {
    level: 1, maxFps: 60, pixelRatio: 1, antialias: true, shadows: false,
    chunkRadius: 2, sceneryDensity: 0.8, terrainGrid: 36, nearLod: [40, 90],
    groundCover: false, birds: false, clouds: true, weather: 0.7, fx: 0.7, debrisBodies: 16, statsMs: 150, streamMs: 4,
  },
  high: {
    level: 2, maxFps: 60, pixelRatio: 1.5, antialias: true, shadows: true,
    chunkRadius: 3, sceneryDensity: 1, terrainGrid: 48, nearLod: [64, 120],
    groundCover: true, birds: true, clouds: true, weather: 1, fx: 1, debrisBodies: 30, statsMs: 100, streamMs: 5,
  },
};
/** Frame-rate setting → cap (null = every screen refresh; 'auto' = the tier's cap). */
export const FPS_OPTIONS = ['auto', '30', '60', 'max'];
const QUALITY_ORDER = ['low', 'medium', 'high'];

let webglSupport;

/** True when the browser can create a WebGL context (probed once; the probe context is released). */
export function hasWebGL() {
  if (webglSupport !== undefined) return webglSupport;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    webglSupport = Boolean(gl);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

export class DriveEngine {
  /**
   * @param {object} options
   * @param {HTMLCanvasElement} options.canvas
   * @param {number} options.seed
   * @param {number} options.paint      car colour (hex)
   * @param {'auto'|'low'|'medium'|'high'} options.quality
   * @param {'auto'|'30'|'60'|'max'} options.fps  frame-rate cap ('auto' = the tier's)
   * @param {boolean} options.touch     coarse-pointer device (auto throttle, cruise on)
   * @param {boolean} options.reducedMotion
   * @param {boolean} options.muted
   * @param {boolean} options.music
   * @param {'mixed'|'normal'|'spring'|'summer'|'autumn'|'desert'|'snow'} options.terrain
   * @param {'auto'|'manual'} options.transmission
   * @param {'full'|'sport'|'off'} options.assists
   * @param {boolean} options.pops     crackle mode: pops & bangs on every lift-off
   * @param {(stats: object) => void} options.onStats
   * @param {(action: string) => void} options.onAction  UI actions (pause, help, photo…)
   */
  constructor(options) {
    this.options = options;
    this.seed = options.seed;
    this.onStats = options.onStats;
    this.onAction = options.onAction;
    this.touch = options.touch;
    this.reducedMotion = options.reducedMotion;
    this.qualitySetting = options.quality;
    this.detected = detectQuality({ touch: options.touch });
    this.qualityName = options.quality === 'auto' ? this.detected.tier : options.quality;
    this.quality = { ...QUALITY_PRESETS[this.qualityName] };
    this.fpsSetting = options.fps ?? 'auto';
    this.refresh = 1000 / 60; // measured screen refresh interval (ms)
    this.lastVsync = 0;
    this.lastStatsKey = '';
    this.room = null;     // multiplayer RoomSession while in a room
    this.remotes = null;  // friends' cars
    this.roomSubs = [];
    this.lastSend = 0;
    this.pendingRegroup = 0;
    this.tmpFriend = {};

    this.mode = 'intro'; // intro → drive ⇄ paused / photo
    this.cruise = options.touch || options.reducedMotion;
    this.cruiseSpeed = 19; // m/s ≈ 70 km/h
    this.phase = START_PHASE;
    this.acc = 0;
    this.last = performance.now();
    this.lastStats = 0;
    this.frameTimes = [];
    this.qualityCheckAt = performance.now() + 5000;
    this.lastPlan = { x: Infinity, z: Infinity, t: 0 };
    this.prev = { x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0 };
    this.tmpRoad = {};
    this.tmpAhead = {};
    this.carPos = new THREE.Vector3();
    this.debug = new URLSearchParams(window.location.search).has('debug');

    this.renderer = new THREE.WebGLRenderer({
      canvas: options.canvas,
      // MSAA can't be switched later: it follows the tier the drive starts on
      antialias: !options.touch && this.quality.antialias,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor(0x0b0f14);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.3, 2600);

    this.world = new World({ scene: this.scene, seed: this.seed, quality: this.quality, terrain: options.terrain });
    this.sky = new Sky(this.scene, this.seed);
    this.effects = new Effects(this.scene, { reducedMotion: this.reducedMotion });
    this.birds = new Birds(this.scene, this.seed);
    this.skids = new SkidMarks(this.scene);
    this.smoke = new TyreSmoke(this.scene);
    this.car = createCar(options.paint, this.renderer);
    this.exhaustFx = new ExhaustFx();
    this.crackle = Boolean(options.pops);
    this.scene.add(this.car.group);
    this.wheelPoint = new THREE.Vector3();

    // ?debug&phase=0.8&start=3000 jumps the clock / spawn point (handy for checking biomes and night)
    const params = new URLSearchParams(window.location.search);
    if (this.debug && params.has('phase')) this.phase = (Number(params.get('phase')) || 0) % 1;
    const startS = this.debug ? Math.max(0, Number(params.get('start')) || 0) : 0;
    if (startS) this.world.road.ensureAhead(this.world.road.indexAtS(startS));
    const start = this.world.road.pointAt(startS, {});
    this.vehicle = new Vehicle(this.world, this.laneSpawn(start));
    this.vehicle.distance = 0;
    this.vehicle.transmission = options.transmission ?? 'auto';
    this.assistMode = options.assists ?? 'full';
    this.vehicle.assists = ASSISTS[this.assistMode];
    this.savePrev();

    this.rig = new CameraRig(this.camera, this.world, { reducedMotion: this.reducedMotion });
    this.input = new DriveInput({ onAction: (a) => this.handleAction(a) });
    this.input.autoThrottle = options.touch && !this.cruise;
    this.audio = new DriveAudio({ muted: options.muted, music: options.music });

    this.applyQuality();
    this.world.warmup(this.vehicle.x, this.vehicle.z);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(options.canvas.parentElement ?? options.canvas);
    this.resize();

    this.handleVisibility = () => {
      if (document.hidden) {
        this.audio.ctx?.suspend().catch(() => {});
        if (this.mode === 'drive') this.onAction('pause');
      } else if (this.mode === 'drive') {
        this.audio.resume();
      }
    };
    document.addEventListener('visibilitychange', this.handleVisibility);

    this.tick = this.tick.bind(this);
    this.raf = requestAnimationFrame(this.tick);
    if (this.debug) window.__zenDrive = this; // console / test access in ?debug mode only
  }

  /** Spawn point in the left lane at a road point. */
  laneSpawn(p) {
    return {
      x: p.x + Math.cos(p.heading) * ROAD.LANE_OFFSET,
      z: p.z - Math.sin(p.heading) * ROAD.LANE_OFFSET,
      heading: p.heading,
    };
  }

  /* ─── lifecycle ───────────────────────────────────────── */

  /** Leaves the intro: player takes the wheel (call from a user gesture for audio). */
  start() {
    this.audio.resume();
    this.mode = 'drive';
    this.input.setDriving(true);
    this.rig.initialized = false;
    this.emitStats(true);
  }

  pause() {
    if (this.mode === 'drive' || this.mode === 'photo') this.mode = 'paused';
    this.input.setDriving(false);
    this.emitStats(true);
  }

  resume() {
    this.mode = 'drive';
    this.input.setDriving(true);
    this.last = performance.now();
    this.audio.resume();
    this.emitStats(true);
  }

  setPhoto(on) {
    this.mode = on ? 'photo' : 'drive';
    this.input.setDriving(!on);
    this.last = performance.now();
    this.emitStats(true);
  }

  handleAction(action) {
    if (action === 'camera') {
      this.rig.cycle();
      this.emitStats(true);
    } else if (action === 'cruise') {
      if (this.mode === 'drive') this.setCruise(!this.cruise);
    } else if (action === 'pops') {
      this.setPops(!this.crackle);
      this.onAction('pops-changed');
    } else if (action === 'mute') {
      this.setMuted(!this.audio.muted);
      this.onAction('mute-changed'); // the page saves it and keeps the menu checkbox in step
    } else if (action === 'reset') {
      if (this.mode === 'drive') this.resetToRoad();
    } else if (action === 'shiftUp' || action === 'shiftDown') {
      if (this.mode !== 'drive') return;
      // tapping a paddle in automatic takes over manually, like a real dual-clutch box
      if (this.vehicle.transmission === 'auto') {
        this.setTransmission('manual');
        this.onAction('transmission-changed');
      }
      if (action === 'shiftUp') this.vehicle.shiftUp();
      else if (!this.vehicle.shiftDown() && this.vehicle.refused) {
        this.onAction(this.vehicle.refused);
        this.vehicle.refused = null;
      }
      this.emitStats(true);
    } else if (action === 'transmission') {
      this.setTransmission(this.vehicle.transmission === 'auto' ? 'manual' : 'auto');
      this.onAction('transmission-changed');
    } else {
      this.onAction(action);
    }
  }

  setCruise(on) {
    this.cruise = on;
    this.input.autoThrottle = this.touch && !on;
    if (on) this.cruiseSpeed = clamp(Math.max(this.vehicle.forwardSpeed, 16), 8, CRUISE_MAX);
    this.emitStats(true);
  }

  setTransmission(mode) {
    this.vehicle.transmission = mode;
    this.emitStats(true);
  }

  setAssists(mode) {
    this.assistMode = mode;
    this.vehicle.assists = ASSISTS[mode] ?? ASSISTS.full;
    this.emitStats(true);
  }

  setMuted(muted) {
    this.audio.setMuted(muted);
    this.emitStats(true);
  }

  /** Crackle mode: the full pops & bangs show on every lift (downshift bangs are always on). */
  setPops(on) {
    this.crackle = on;
    this.emitStats(true);
  }

  setMusic(on) {
    this.audio.setMusic(on);
    this.emitStats(true);
  }

  setPaint(hex) {
    this.car.setPaint(hex);
  }

  setTouch(state) {
    this.input.setTouch(state);
  }

  async setTilt(on) {
    if (!on) {
      this.input.disableTilt();
      return false;
    }
    return this.input.enableTilt();
  }

  setQuality(setting) {
    this.qualitySetting = setting;
    const name = setting === 'auto' ? this.detected.tier : setting;
    this.switchQuality(name);
    this.qualityCheckAt = performance.now() + 4000;
    this.frameTimes = [];
  }

  switchQuality(name) {
    const next = QUALITY_PRESETS[name];
    const was = this.quality;
    const sceneryChanged = next.sceneryDensity !== was.sceneryDensity || next.groundCover !== was.groundCover;
    const terrainChanged = next.terrainGrid !== was.terrainGrid;
    const shadowsChanged = next.shadows !== was.shadows;
    this.qualityName = name;
    Object.assign(this.quality, next);
    this.applyQuality(shadowsChanged);
    // rebuilt in place, nearest first — nothing blinks out while the new versions stream in
    if (terrainChanged) this.world.rebuildTerrain();
    if (sceneryChanged) this.world.rebuildScenery();
    this.lastPlan.t = 0;
    this.emitStats(true);
  }

  /** Frame-rate cap: 'auto' (the tier's), '30', '60' or 'max' (every screen refresh). */
  setFps(setting) {
    this.fpsSetting = setting;
    this.frameTimes = [];
    this.qualityCheckAt = performance.now() + 4000;
    this.emitStats(true);
  }

  /** Frames per second the game aims for (null: as many as the screen refreshes). */
  get maxFps() {
    if (this.fpsSetting === 'max') return null;
    if (this.fpsSetting === 'auto') return this.quality.maxFps;
    return Number(this.fpsSetting) || this.quality.maxFps;
  }

  /**
   * Time between drawn frames (ms): the cap rounded to a whole number of screen refreshes, so
   * frames stay evenly paced (a 165 Hz screen capped at 60 draws every 3rd refresh: 55 fps).
   */
  get frameInterval() {
    const cap = this.maxFps;
    if (!cap) return this.refresh;
    return Math.max(1, Math.ceil(1000 / cap / this.refresh - 0.6)) * this.refresh;
  }

  applyQuality(recompile = false) {
    const q = this.quality;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
    this.renderer.shadowMap.enabled = q.shadows;
    this.sky.setShadows(q.shadows);
    this.world.debris.maxBodies = q.debrisBodies;
    this.car.group.traverse(o => {
      if (o.isSpotLight || o.isPointLight) o.visible = q.level > 0;
    });
    if (recompile) this.scene.traverse(o => {
      if (o.material) o.material.needsUpdate = true;
    });
    this.resize();
  }

  resize() {
    const el = this.renderer.domElement;
    const w = el.clientWidth || window.innerWidth;
    const h = el.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Puts the car back in its lane on the nearest stretch of road. */
  resetToRoad() {
    const v = this.vehicle;
    const q = this.world.road.nearest(v.x, v.z, 3000, this.tmpRoad) ?? this.world.road.pointAt(0, this.tmpRoad);
    v.reset(this.laneSpawn(q));
    this.exhaustFx.reset(v);
    this.skids.last.clear();
    this.savePrev();
    this.rig.initialized = false;
    this.onAction('reset-flash');
  }

  /* ─── frame ───────────────────────────────────────────── */

  savePrev() {
    const v = this.vehicle;
    const p = this.prev;
    p.x = v.x;
    p.y = v.y;
    p.z = v.z;
    p.heading = v.heading;
    p.pitch = v.pitch;
    p.roll = v.roll;
  }

  /** Cruise / intro autopilot: follow the left lane and hold a speed. */
  autopilot(input, targetSpeed) {
    const v = this.vehicle;
    const q = this.world.road.nearest(v.x, v.z, 40, this.tmpRoad);
    if (!q) {
      if (this.cruise && this.mode === 'drive') this.setCruise(false);
      return input;
    }
    const ahead = this.world.road.pointAt(q.s + Math.max(10, v.speed * 1.1), this.tmpAhead);
    const tx = ahead.x + Math.cos(ahead.heading) * ROAD.LANE_OFFSET;
    const tz = ahead.z - Math.sin(ahead.heading) * ROAD.LANE_OFFSET;
    const diff = wrapAngle(Math.atan2(tx - v.x, tz - v.z) - v.heading);
    const err = targetSpeed - v.forwardSpeed;
    return {
      steer: input.manualSteer ? input.steer : clamp(-diff * 2.2, -1, 1),
      throttle: clamp(err * 0.25, 0, 1),
      brake: err < -2.5 ? clamp(-err * 0.1, 0, 1) : 0,
      handbrake: input.handbrake,
      autoShift: true,
    };
  }

  tick(now) {
    this.raf = requestAnimationFrame(this.tick);
    // Frame cap. The screen's refresh interval is learnt from the callback rhythm (following
    // short gaps quickly and long ones — slow frames — only very slowly); a frame is drawn once
    // the cap's interval, less part of a refresh, has passed. Skipped callbacks cost nothing.
    const gap = now - this.lastVsync;
    this.lastVsync = now;
    if (gap > 1 && gap < 50) this.refresh += (gap - this.refresh) * (gap < this.refresh ? 0.25 : 0.01);
    const cap = this.maxFps;
    if (cap && now - this.last < 1000 / cap - this.refresh * 0.6) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.lastDt = this.lastDt === undefined ? dt : this.lastDt * 0.9 + dt * 0.1;
    if (this.room) this.netTick(now);
    if (this.mode === 'paused') return;

    const simulate = this.mode === 'drive' || this.mode === 'intro';
    if (simulate) {
      const raw = this.input.read();
      if (this.mode === 'drive' && this.cruise) {
        // W nudges the cruise speed up; the brake really brakes, and cruise then holds
        // whatever speed you slowed to
        if (raw.throttle && !this.touch) this.cruiseSpeed = Math.min(CRUISE_MAX, this.cruiseSpeed + 8 * dt);
        if (raw.brake) this.cruiseSpeed = Math.max(6, Math.min(this.cruiseSpeed, this.vehicle.forwardSpeed));
      }
      let drive = raw;
      if (this.mode === 'intro') drive = this.autopilot({ steer: 0, handbrake: false }, INTRO_SPEED);
      else if (this.cruise) {
        drive = this.autopilot(raw, this.cruiseSpeed);
        if (raw.brake) {
          drive.brake = raw.brake;
          drive.throttle = 0;
        }
      }

      // friends' cars push back only when the room has collisions on
      this.vehicle.otherCars = this.room?.meta.collisions && this.mode === 'drive' ? this.remotes.bodies(this.room.id) : null;
      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP && steps < MAX_STEPS) {
        this.savePrev();
        this.vehicle.step(STEP, drive);
        this.acc -= STEP;
        steps++;
      }
      if (steps === MAX_STEPS) this.acc = 0;
      // in a room the time of day is the room's clock, so slow frames can't make anyone drift
      this.phase = this.room ? this.room.phaseNow(DAY_LENGTH) : (this.phase + dt / DAY_LENGTH) % 1;
    }

    this.renderFrame(dt, now, simulate);
    this.monitorQuality(dt, now);
    if (now - this.lastStats > this.quality.statsMs) this.emitStats();
  }

  renderFrame(dt, now, simulate) {
    const v = this.vehicle;
    const p = this.prev;
    const a = simulate ? this.acc / STEP : 1;
    const x = p.x + (v.x - p.x) * a;
    const y = p.y + (v.y - p.y) * a;
    const z = p.z + (v.z - p.z) * a;
    const heading = p.heading + (v.heading - p.heading) * a;

    const group = this.car.group;
    group.position.set(x, y, z);
    group.rotation.set(p.pitch + (v.pitch - p.pitch) * a, heading, p.roll + (v.roll - p.roll) * a, 'YXZ');
    group.updateMatrixWorld();
    this.carPos.set(x, y, z);

    // stream the world around the car (planning is cheap but not free)
    const moved = Math.hypot(x - this.lastPlan.x, z - this.lastPlan.z);
    if (moved > 24 || now - this.lastPlan.t > 1000) {
      this.world.plan(x, z);
      this.lastPlan = { x, z, t: now };
    }
    this.world.process(this.mode === 'intro' ? 8 : this.quality.streamMs);
    // knocked-down scenery tumbles; breaking and landing things make themselves heard
    this.world.update(simulate ? dt : 0, v);
    for (const e of this.world.events) {
      this.audio.crash(e.material, e.strength, e.kind);
      if (e.kind === 'break' && !e.remote) this.room?.sendBroken(e.id);
    }
    this.world.events.length = 0;

    const biome = this.world.biomeAt(x, z);
    this.biome = biome;
    const mountain = [0, 1, 2].map(i => biome.a.mountain[i] + (biome.b.mountain[i] - biome.a.mountain[i]) * biome.t);
    const clouds = this.quality.clouds ? biome.a.clouds + (biome.b.clouds - biome.a.clouds) * biome.t : 0;
    const { night } = this.sky.update(this.phase, this.carPos, mountain, this.world.viewDistance, clouds, dt);
    this.night = night;
    this.world.setNight(night);
    this.remotes?.update(dt, this.room.serverNow(), night);

    const weight = (id) => (biome.a.id === id ? 1 - biome.t : 0) + (biome.b.id === id ? biome.t : 0);
    // turbo, blow-off and backfires (only while the car is actually being simulated)
    const fx = this.exhaustFx.update(simulate ? dt : 0, v, this.crackle && this.mode === 'drive');
    if (simulate) {
      for (const strength of fx.pops) this.audio.pop(strength);
      if (fx.blowOff) this.audio.blowOff(fx.blowOff);
    }
    this.car.update(dt, {
      flame: simulate ? fx.flame : 0,
      airbrake: v.airbrake,
      steerAngle: v.steerAngle,
      speed: v.forwardSpeed,
      rearSpeed: v.rearSurfaceSpeed,
      brake: v.braking,
      night,
      reversing: v.gear < 0,
    });
    this.rig.update(dt, { x, y, z, heading, speed: v.speed, bump: v.bump }, this.car.body, { idleOrbit: this.mode === 'intro' });
    this.effects.update(dt, this.camera.position, this.carPos, this.weather(biome),
      night * (weight('normal') + weight('summer') + weight('spring')), this.quality.weather);
    this.birds.update(dt, this.carPos, heading, this.quality.birds ? 1 - night : 0);
    if (simulate) this.tyreEffects(dt, heading, biome);
    this.smoke.update(dt);

    this.audio.update({
      rpm: v.rpm,
      load: v.throttle,
      speed: v.speed,
      slip: v.slip,
      bump: v.bump,
      surface: v.surface,
      limiter: v.limiter && (v.throttle > 0.05 || v.overRev),
      overRev: v.overRev,
      boost: this.exhaustFx.boost,
      shifting: v.shiftTimer > 0,
      paused: !simulate,
    });

    this.renderer.render(this.scene, this.camera);
  }

  /** Blended ambient particles (snow / petals / leaves) for the current biome mix. */
  weather(biome) {
    const pa = biome.a.particles;
    const pb = biome.b.particles;
    const wa = pa ? pa.amount * (1 - biome.t) : 0;
    const wb = pb ? pb.amount * biome.t : 0;
    if (wa + wb <= 0) return null;
    return { ...(wa >= wb ? pa : pb), amount: wa + wb };
  }

  /** Skid marks and smoke from sliding, spinning or locked tyres; dust off-road. */
  tyreEffects(dt, heading, biome) {
    const v = this.vehicle;
    const D = CAR_DIMENSIONS;
    const offroad = v.surface === 'grass';
    const sx = -Math.cos(heading);
    const sz = Math.sin(heading);
    const matrix = this.car.group.matrixWorld;
    const rearActive = !offroad && !v.airborne && v.speed > 1.5 && v.slip > 0.32;
    const frontActive = !offroad && !v.airborne && v.speed > 1.5 && v.frontLocked;
    const soil = biome.t > 0.5 ? biome.b.soil : biome.a.soil;
    this.smoke.setColor(soil, offroad);

    const wheels = [
      ['rl', D.rearTrack, D.rearAxleZ, rearActive, 0.16],
      ['rr', -D.rearTrack, D.rearAxleZ, rearActive, 0.16],
      ['fl', D.frontTrack, D.frontAxleZ, frontActive, 0.13],
      ['fr', -D.frontTrack, D.frontAxleZ, frontActive, 0.13],
    ];
    for (const [id, wx, wz, active, half] of wheels) {
      const p = this.wheelPoint.set(wx, 0, wz).applyMatrix4(matrix);
      this.skids.track(id, active, p.x, p.y, p.z, sx, sz, half);
      const rear = id[0] === 'r';
      const smoking = rear ? (active && v.slip > 0.45) : active;
      const dusting = offroad && v.speed > 6 && rear;
      const rate = smoking ? 38 * v.slip : dusting ? Math.min(30, v.speed * 0.8) * (0.3 + v.slip) : 0;
      if (rate > 0 && Math.random() < rate * dt) this.smoke.emit(p.x, p.y, p.z, v.vx, v.vz, v.slip);
    }
  }

  /**
   * Auto quality: steps down when frames keep missing their slot — taking clearly longer than
   * the capped frame interval (never while building the first chunks).
   */
  monitorQuality(dt, now) {
    if (this.qualitySetting !== 'auto' || this.mode !== 'drive') return;
    this.frameTimes.push(dt);
    if (now < this.qualityCheckAt) return;
    const avg = this.frameTimes.reduce((s, t) => s + t, 0) / Math.max(1, this.frameTimes.length);
    this.frameTimes = [];
    this.qualityCheckAt = now + 3000;
    const target = Math.max(1 / 60, this.frameInterval / 1000);
    const index = QUALITY_ORDER.indexOf(this.qualityName);
    if (avg > target * 1.35 && index > 0) this.switchQuality(QUALITY_ORDER[index - 1]);
  }

  /**
   * Sends the HUD its numbers (every `statsMs`, or at once when forced). Values are rounded to
   * what the HUD shows and nothing is sent when they haven't changed, so React only re-renders
   * when something on screen actually moves.
   */
  emitStats(force = false) {
    const now = performance.now();
    if (!force && now - this.lastStats < this.quality.statsMs) return;
    this.lastStats = now;
    const v = this.vehicle;
    const q = this.world.road.nearest(v.x, v.z, 120, this.tmpRoad);
    const info = this.renderer.info.render;
    const stats = {
      mode: this.mode,
      speed: Math.round(v.speed * 3.6),
      reversing: v.gear < 0,
      gear: v.gearLabel,
      rpm: Math.round(v.rpm / 10) * 10,
      rpmNorm: Math.round(v.rpmNorm * 100) / 100,
      shiftLight: v.rpm > 8400 && v.gear > 0 && v.gear < 6,
      transmission: v.transmission,
      assists: this.assistMode,
      drifting: v.rearSlide > 0.35 && v.speed > 8,
      distance: Math.round(v.distance / 10) / 100,
      biome: this.biome ? (this.biome.t > 0.5 ? this.biome.b.name : this.biome.a.name) : '',
      time: timeLabel(this.phase),
      night: Math.round((this.night ?? 0) * 20) / 20,
      heading: Math.round(((-v.heading * 180) / Math.PI % 360 + 360) % 360),
      cruise: this.cruise,
      cruiseSpeed: Math.round(this.cruiseSpeed * 3.6),
      camera: this.rig.mode,
      offRoad: !q,
      surface: v.surface,
      muted: this.audio.muted,
      pops: this.crackle,
      boost: Math.round(this.exhaustFx.boost * 10) / 10,
      music: this.audio.musicOn,
      quality: this.qualityName,
      qualitySetting: this.qualitySetting,
      detected: this.detected,
      fps: this.fpsSetting,
      fpsCap: Math.round(1000 / this.frameInterval),
      refreshHz: Math.round(1000 / this.refresh),
      seed: this.seed,
      room: this.roomStats(q),
      debug: this.debug ? {
        fps: Math.round(1 / Math.max(0.001, this.lastDt ?? 0.016)),
        calls: info.calls,
        triangles: info.triangles,
        chunks: this.world.terrain.size,
        queue: this.world.queue.length,
        broken: this.world.broken.size,
        debris: this.world.debris.bodies.length,
      } : null,
    };
    const key = JSON.stringify(stats);
    if (!force && key === this.lastStatsKey) return;
    this.lastStatsKey = key;
    this.onStats(stats);
  }

  /* ─── multiplayer ─────────────────────────────────────── */

  /**
   * Joins the drive to a room session: friends' cars appear and follow the network, this car
   * is published, broken scenery is shared and the time of day follows the room's clock.
   * A player who joined (rather than created) the room is taken to their friends once the
   * first update arrives.
   */
  attachRoom(session) {
    this.detachRoom(true);
    this.room = session;
    this.remotes = new RemoteCars(this.scene, this.renderer, this.car.envMap, (x, z) => this.world.groundHeight(x, z));
    this.remotes.setPlayers(session.players, session.id);
    this.roomSubs = [
      session.on('players', (players) => {
        this.remotes?.setPlayers(players, session.id);
        this.emitStats(true);
      }),
      session.on('state', (id, text) => this.remotes?.receive(id, text)),
      session.on('hit', (text) => {
        const hit = unpackHit(text);
        // our half of a bump another game refereed (stale ones — e.g. from before we joined — are dropped)
        if (hit && this.mode === 'drive' && session.serverNow() - hit.t < 1500) this.vehicle.applyPush(hit);
      }),
      session.on('broken', (id) => this.applyRemoteBreak(id)),
      session.on('meta', () => this.emitStats(true)),
      session.on('connection', () => this.emitStats(true)),
    ];
    this.phase = session.phaseNow(DAY_LENGTH);
    this.pendingRegroup = session.isHost ? 0 : performance.now() + 12000;
    this.emitStats(true);
  }

  /** Back to driving alone (the session itself is left or closed by the caller). */
  detachRoom(silent = false) {
    this.roomSubs.forEach(off => off());
    this.roomSubs = [];
    this.remotes?.dispose();
    this.remotes = null;
    this.room = null;
    this.vehicle.otherCars = null;
    this.pendingRegroup = 0;
    if (!silent) this.emitStats(true);
  }

  /** Publishes this car ~10 times a second (once a second while paused) and keeps the clock shared. */
  netTick(now) {
    const room = this.room;
    if (room.closed) return;
    const paused = this.mode === 'paused' || this.mode === 'photo';
    if (now - this.lastSend >= (paused ? 1000 : 1000 / SEND_HZ)) {
      this.lastSend = now;
      const v = this.vehicle;
      const flags = (v.braking > 0.1 ? FLAG.BRAKE : 0) | (v.gear < 0 ? FLAG.REVERSE : 0)
        | (paused ? FLAG.PAUSED : 0) | (v.airborne ? FLAG.AIRBORNE : 0);
      room.sendState(packState(room.serverNow(), v, flags));
    }
    // shoves our car gave friends' cars (we referee those pairs): sent a few times a second
    const pushes = this.vehicle.pushes;
    if (pushes.size && now - (this.lastHitSend ?? 0) > 50) {
      this.lastHitSend = now;
      for (const [seat, push] of pushes) room.sendHit(seat, packHit(room.serverNow(), push));
      pushes.clear();
    }
    if (this.pendingRegroup && (now > this.pendingRegroup || this.regroup())) this.pendingRegroup = 0;
  }

  /**
   * Another player knocked something down: it falls here too (thrown the way their car was
   * going), or — if it isn't streamed in on this machine — it simply loads already down.
   */
  applyRemoteBreak(id) {
    const w = this.world;
    if (w.broken.has(id)) return;
    const o = w.byId.get(id);
    if (!o || o.broken) {
      w.broken.add(id);
      return;
    }
    const friend = (this.remotes?.list() ?? [])
      .filter(f => Math.hypot(f.x - o.x, f.z - o.z) < 30)
      .sort((a, b) => Math.hypot(a.x - o.x, a.z - o.z) - Math.hypot(b.x - o.x, b.z - o.z))[0];
    let vx = friend?.vx ?? 0;
    let vz = friend?.vz ?? 0;
    let speed = Math.hypot(vx, vz);
    if (speed < 0.5) {
      const a = Math.random() * Math.PI * 2;
      speed = o.breakSpeed * 1.2;
      vx = Math.sin(a) * speed;
      vz = Math.cos(a) * speed;
    }
    w.breakObstacle(o, {
      x: o.x, y: w.groundHeight(o.x, o.z) + 0.45, z: o.z, vx, vz, nx: -vx / speed, nz: -vz / speed,
      impact: Math.max(speed, o.breakSpeed), carInverseMass: 1 / 1450,
    }, true);
  }

  /**
   * Puts this car just behind the nearest friend, in the other lane, rolling at their speed.
   * Friends can be far down the endless road, so it's generated up to them first. Returns
   * false when there's nobody to go to.
   */
  regroup() {
    const friends = (this.remotes?.list() ?? []).filter(f => !f.away);
    if (!friends.length) return false;
    const v = this.vehicle;
    const dist = (f) => Math.hypot(f.x - v.x, f.z - v.z);
    const f = friends.reduce((a, b) => (dist(a) <= dist(b) ? a : b));
    const road = this.world.road;
    let q = road.nearest(f.x, f.z, 60, this.tmpFriend);
    for (let k = 0; !q && k < 300; k++) {
      road.ensureAhead(road.length - 1);
      q = road.nearest(f.x, f.z, 60, this.tmpFriend);
    }
    let spot;
    if (q) {
      // the lane they're not in, 10 m back
      const side = (f.x - q.x) * Math.cos(q.heading) - (f.z - q.z) * Math.sin(q.heading) > 0 ? -1 : 1;
      const p = road.pointAt(Math.max(0, q.s - 10), this.tmpAhead);
      const off = ROAD.LANE_OFFSET * side;
      spot = { x: p.x + Math.cos(p.heading) * off, z: p.z - Math.sin(p.heading) * off, heading: p.heading };
    } else {
      spot = { x: f.x - Math.sin(f.heading) * 10 + Math.cos(f.heading) * 3.5, z: f.z - Math.cos(f.heading) * 10 - Math.sin(f.heading) * 3.5, heading: f.heading };
    }
    v.reset(spot);
    v.launch(Math.hypot(f.vx, f.vz));
    this.world.warmup(v.x, v.z);
    this.lastPlan = { x: v.x, z: v.z, t: performance.now() };
    this.savePrev();
    this.rig.initialized = false;
    this.onAction?.('reset-flash');
    this.emitStats(true);
    return true;
  }

  /** Room summary for the HUD and menus (distances along the road, rounded to 10 m). */
  roomStats(myRoad) {
    const room = this.room;
    if (!room) return null;
    const players = [...room.players].map(([seat, p]) => {
      const you = seat === room.id;
      let dist = null;
      const car = this.remotes?.cars.get(seat);
      if (!you && car?.pose) {
        const q = this.world.road.nearest(car.pose.x, car.pose.z, 120, this.tmpFriend);
        dist = q && myRoad ? q.s - myRoad.s : Math.hypot(car.pose.x - this.vehicle.x, car.pose.z - this.vehicle.z);
        dist = Math.round(dist / 10) * 10;
      }
      return { seat, name: p.name, paint: p.paint, you, host: p.pid === room.meta.host, dist, away: Boolean(car?.away) };
    }).sort((a, b) => Number(a.seat) - Number(b.seat));
    return { code: room.code, isHost: room.isHost, collisions: Boolean(room.meta.collisions), online: room.online, players };
  }

  /** Renders a frame and returns it as a PNG blob (photo mode). */
  capture() {
    this.renderer.render(this.scene, this.camera);
    return new Promise(resolve => this.renderer.domElement.toBlob(resolve, 'image/png'));
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.detachRoom(true);
    if (window.__zenDrive === this) delete window.__zenDrive;
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.resizeObserver.disconnect();
    this.input.dispose();
    this.audio.dispose();
    this.world.dispose();
    this.sky.dispose();
    this.effects.dispose();
    this.birds.dispose();
    this.skids.dispose();
    this.smoke.dispose();
    this.scene.remove(this.car.group);
    this.car.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
