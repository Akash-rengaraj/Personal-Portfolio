/**
 * Zen Drive engine: owns the renderer, scene and fixed-step loop.
 * React only mounts it and draws the HUD from the stats it emits (~10 Hz);
 * all per-frame work stays here, outside React.
 */
import * as THREE from 'three';
import { World } from './world';
import { Sky, DAY_LENGTH, timeLabel } from './sky';
import { Effects } from './effects';
import { Vehicle } from './vehicle';
import { createCar } from './carModel';
import { CameraRig } from './camera';
import { DriveInput } from './input';
import { DriveAudio } from './audio';
import { ROAD } from './road';
import { clamp, wrapAngle } from './noise';

const STEP = 1 / 120;
const MAX_STEPS = 12;
const STATS_INTERVAL = 100;
const START_PHASE = 0.6; // late afternoon, drifting into golden hour
const INTRO_SPEED = 12;  // m/s the car idles along behind the intro screen

export const QUALITY_PRESETS = {
  low: { level: 0, pixelRatio: 0.85, shadows: false, chunkRadius: 1, sceneryDensity: 0.55 },
  medium: { level: 1, pixelRatio: 1.25, shadows: false, chunkRadius: 2, sceneryDensity: 0.8 },
  high: { level: 2, pixelRatio: 1.5, shadows: true, chunkRadius: 2, sceneryDensity: 1 },
};
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
   * @param {boolean} options.touch     coarse-pointer device (auto throttle, cruise on)
   * @param {boolean} options.reducedMotion
   * @param {boolean} options.muted
   * @param {boolean} options.music
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
    this.qualityName = options.quality === 'auto' ? (options.touch ? 'medium' : 'high') : options.quality;
    this.quality = { ...QUALITY_PRESETS[this.qualityName] };

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
      antialias: !options.touch,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor(0x0b0f14);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.3, 2600);

    this.world = new World({ scene: this.scene, seed: this.seed, quality: this.quality });
    this.sky = new Sky(this.scene, this.seed);
    this.effects = new Effects(this.scene, { reducedMotion: this.reducedMotion });
    this.car = createCar(options.paint);
    this.scene.add(this.car.group);

    // ?debug&phase=0.8&start=3000 jumps the clock / spawn point (handy for checking biomes and night)
    const params = new URLSearchParams(window.location.search);
    if (this.debug && params.has('phase')) this.phase = (Number(params.get('phase')) || 0) % 1;
    const startS = this.debug ? Math.max(0, Number(params.get('start')) || 0) : 0;
    if (startS) this.world.road.ensureAhead(this.world.road.indexAtS(startS));
    const start = this.world.road.pointAt(startS, {});
    this.vehicle = new Vehicle(this.world, this.laneSpawn(start));
    this.vehicle.distance = 0;
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
    this.rig.initialized = false;
    this.emitStats(true);
  }

  pause() {
    if (this.mode === 'drive' || this.mode === 'photo') this.mode = 'paused';
    this.emitStats(true);
  }

  resume() {
    this.mode = 'drive';
    this.last = performance.now();
    this.audio.resume();
    this.emitStats(true);
  }

  setPhoto(on) {
    this.mode = on ? 'photo' : 'drive';
    this.last = performance.now();
    this.emitStats(true);
  }

  handleAction(action) {
    if (action === 'camera') {
      this.rig.cycle();
      this.emitStats(true);
    } else if (action === 'cruise') {
      this.setCruise(!this.cruise);
    } else if (action === 'mute') {
      this.setMuted(!this.audio.muted);
    } else if (action === 'reset') {
      if (this.mode === 'drive') this.resetToRoad();
    } else {
      this.onAction(action);
    }
  }

  setCruise(on) {
    this.cruise = on;
    this.input.autoThrottle = this.touch && !on;
    if (on) this.cruiseSpeed = clamp(Math.max(this.vehicle.forwardSpeed, 14), 8, 36);
    this.emitStats(true);
  }

  setMuted(muted) {
    this.audio.setMuted(muted);
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
    const name = setting === 'auto' ? (this.touch ? 'medium' : 'high') : setting;
    this.switchQuality(name);
    this.qualityCheckAt = performance.now() + 4000;
    this.frameTimes = [];
  }

  switchQuality(name) {
    const densityChanged = QUALITY_PRESETS[name].sceneryDensity !== this.quality.sceneryDensity;
    const shadowsChanged = QUALITY_PRESETS[name].shadows !== this.quality.shadows;
    this.qualityName = name;
    Object.assign(this.quality, QUALITY_PRESETS[name]);
    this.applyQuality(shadowsChanged);
    if (densityChanged) this.world.rebuildScenery();
    this.lastPlan.t = 0;
    this.emitStats(true);
  }

  applyQuality(recompile = false) {
    const q = this.quality;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
    this.renderer.shadowMap.enabled = q.shadows;
    this.sky.setShadows(q.shadows);
    this.car.group.traverse(o => {
      if (o.isSpotLight) o.visible = q.level > 0;
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
      steer: input.manualSteer ? input.steer : clamp(-diff * 2.4, -1, 1),
      throttle: clamp(err * 0.3, 0, 1),
      brake: err < -2.5 ? clamp(-err * 0.15, 0, 0.6) : 0,
      handbrake: input.handbrake,
    };
  }

  tick(now) {
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.lastDt = this.lastDt === undefined ? dt : this.lastDt * 0.9 + dt * 0.1;
    if (this.mode === 'paused') return;

    const simulate = this.mode === 'drive' || this.mode === 'intro';
    if (simulate) {
      const raw = this.input.read();
      if (this.mode === 'drive' && this.cruise) {
        // W / S nudge the cruise speed instead of fighting the autopilot
        if (raw.throttle && !this.touch) this.cruiseSpeed = Math.min(40, this.cruiseSpeed + 6 * dt);
        if (raw.brake) this.cruiseSpeed = Math.max(6, this.cruiseSpeed - 9 * dt);
      }
      let drive = raw;
      if (this.mode === 'intro') drive = this.autopilot({ steer: 0, handbrake: false }, INTRO_SPEED);
      else if (this.cruise) drive = this.autopilot(raw, this.cruiseSpeed);

      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP && steps < MAX_STEPS) {
        this.savePrev();
        this.vehicle.step(STEP, drive);
        this.acc -= STEP;
        steps++;
      }
      if (steps === MAX_STEPS) this.acc = 0;
      this.phase = (this.phase + dt / DAY_LENGTH) % 1;
    }

    this.renderFrame(dt, now, simulate);
    this.monitorQuality(dt, now);
    if (now - this.lastStats > STATS_INTERVAL) this.emitStats();
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
    this.world.process(this.mode === 'intro' ? 8 : 4);

    const biome = this.world.biomeAt(x, z);
    this.biome = biome;
    const mountain = [0, 1, 2].map(i => biome.a.mountain[i] + (biome.b.mountain[i] - biome.a.mountain[i]) * biome.t);
    const { night } = this.sky.update(this.phase, this.carPos, mountain, this.world.viewDistance);
    this.night = night;
    this.world.setNight(night);

    const weight = (id) => (biome.a.id === id ? 1 - biome.t : 0) + (biome.b.id === id ? biome.t : 0);
    this.car.update(dt, { steerAngle: v.steerAngle, speed: v.forwardSpeed, brake: v.braking, night });
    this.rig.update(dt, { x, y, z, heading, speed: v.speed, bump: v.bump }, this.car.body, { idleOrbit: this.mode === 'intro' });
    this.effects.update(dt, this.camera.position, this.carPos, weight('snow'),
      night * (weight('meadow') + weight('autumn')));

    this.audio.update({
      rpm: v.rpm,
      throttle: this.mode === 'drive' ? Math.max(this.input.state.throttle, this.cruise ? 0.4 : 0) : 0.3,
      speed: v.speed,
      slip: v.slip,
      bump: v.bump,
      onGrass: v.surface === 'grass',
      paused: !simulate,
    });

    this.renderer.render(this.scene, this.camera);
  }

  /** Auto quality: steps down when frames run long (never while building the first chunks). */
  monitorQuality(dt, now) {
    if (this.qualitySetting !== 'auto' || this.mode !== 'drive') return;
    this.frameTimes.push(dt);
    if (now < this.qualityCheckAt) return;
    const avg = this.frameTimes.reduce((s, t) => s + t, 0) / Math.max(1, this.frameTimes.length);
    this.frameTimes = [];
    this.qualityCheckAt = now + 3000;
    const index = QUALITY_ORDER.indexOf(this.qualityName);
    if (avg > 1 / 45 && index > 0) this.switchQuality(QUALITY_ORDER[index - 1]);
  }

  emitStats(force = false) {
    const now = performance.now();
    if (!force && now - this.lastStats < STATS_INTERVAL) return;
    this.lastStats = now;
    const v = this.vehicle;
    const q = this.world.road.nearest(v.x, v.z, 120, this.tmpRoad);
    const info = this.renderer.info.render;
    this.onStats({
      mode: this.mode,
      speed: Math.round(v.speed * 3.6),
      reversing: v.forwardSpeed < -0.5,
      gear: v.forwardSpeed < -0.5 ? 'R' : v.speed < 0.5 ? 'N' : String(v.gear),
      distance: v.distance / 1000,
      biome: this.biome ? (this.biome.t > 0.5 ? this.biome.b.name : this.biome.a.name) : '',
      time: timeLabel(this.phase),
      night: this.night ?? 0,
      heading: ((-v.heading * 180) / Math.PI % 360 + 360) % 360,
      cruise: this.cruise,
      cruiseSpeed: Math.round(this.cruiseSpeed * 3.6),
      camera: this.rig.mode,
      offRoad: !q,
      surface: v.surface,
      muted: this.audio.muted,
      music: this.audio.musicOn,
      quality: this.qualityName,
      qualitySetting: this.qualitySetting,
      seed: this.seed,
      debug: this.debug ? {
        fps: Math.round(1 / Math.max(0.001, this.lastDt ?? 0.016)),
        calls: info.calls,
        triangles: info.triangles,
        chunks: this.world.terrain.size,
        queue: this.world.queue.length,
      } : null,
    });
  }

  /** Renders a frame and returns it as a PNG blob (photo mode). */
  capture() {
    this.renderer.render(this.scene, this.camera);
    return new Promise(resolve => this.renderer.domElement.toBlob(resolve, 'image/png'));
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.resizeObserver.disconnect();
    this.input.dispose();
    this.audio.dispose();
    this.world.dispose();
    this.sky.dispose();
    this.effects.dispose();
    this.scene.remove(this.car.group);
    this.car.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
