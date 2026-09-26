/**
 * All sound is synthesised with WebAudio — no audio files to download.
 *
 *  • Engine: a twin-turbo flat-six built from crank orders. The base wave runs at
 *    rpm / 120 Hz (one four-stroke cycle), so harmonic 6 is the firing frequency
 *    (rpm / 20: 50 Hz at idle, 450 Hz at the 9,000 rpm redline) and the half orders
 *    in between give the uneven flat-six growl. An exhaust layer (low-passed, opened
 *    up by the throttle) and an intake layer (band-passed rasp) run through a soft
 *    clipper. The limiter chops the gain; shifts dip it.
 *  • Turbo: a whistle that spools up with boost plus intake hiss, and a fluttering
 *    blow-off valve when you lift after building boost.
 *  • Pops and bangs: a sharp crack plus a low boom per backfire (the engine decides
 *    when — on downshifts, over-revs, the limiter and, in crackle mode, on overrun).
 *  • Tyres: a narrow band of noise that screeches with slip on tarmac, and a low
 *    rumble off-road. Wind grows with speed, a thud marks bumps and landings, and a
 *    slow ambient pad drifts through four chords.
 */
const CHORDS = [
  [130.81, 196.0, 246.94, 329.63], // Cmaj7
  [110.0, 164.81, 261.63, 329.63], // Am7
  [87.31, 174.61, 220.0, 329.63],  // Fmaj7
  [98.0, 146.83, 246.94, 293.66],  // G6
];
const CHORD_SECONDS = 9;
const HARMONICS = 48;

function noiseBuffer(ctx, seconds = 2) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function softClipCurve(amount = 2.5) {
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
  }
  return curve;
}

/**
 * Engine waveform from crank-order amplitudes: { harmonic index → amplitude }, where the
 * base frequency is one engine cycle (two revolutions) and index 6 is the firing order.
 * Unlisted harmonics get a little seeded "roughness" so it never sounds like a pure synth.
 */
function engineWave(ctx, orders, roughness, seed) {
  const real = new Float32Array(HARMONICS + 1);
  const imag = new Float32Array(HARMONICS + 1);
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (let n = 1; n <= HARMONICS; n++) {
    const amp = orders[n] ?? roughness * rand() / Math.sqrt(n);
    const phase = rand() * Math.PI * 2;
    real[n] = amp * Math.cos(phase);
    imag[n] = amp * Math.sin(phase);
  }
  return ctx.createPeriodicWave(real, imag);
}

export class DriveAudio {
  constructor({ muted, music }) {
    this.ctx = null;
    this.muted = muted;
    this.musicOn = music;
    this.chordIndex = 0;
    this.nextChordAt = 0;
    this.lastPop = 0;
  }

  /** Builds the audio graph. Browsers only allow this after a user gesture. */
  init() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    const ctx = this.ctx;

    // master → gentle compressor, so stacked bangs never clip
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 8;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.15;
    limiter.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.85;
    this.master.connect(limiter);
    this.noise = noiseBuffer(ctx);

    // ── engine: exhaust + intake layers through a soft clipper ──
    const shaper = ctx.createWaveShaper();
    shaper.curve = softClipCurve(2.2);
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    shaper.connect(this.engineGain).connect(this.master);

    // exhaust: firing order + half orders (the flat-six "boxer" beat), low-passed by load
    this.exhaustFilter = ctx.createBiquadFilter();
    this.exhaustFilter.type = 'lowpass';
    this.exhaustFilter.Q.value = 1.4;
    this.exhaustLevel = ctx.createGain();
    this.exhaustLevel.gain.value = 0.55;
    this.exhaustFilter.connect(this.exhaustLevel).connect(shaper);
    this.exhaust = ctx.createOscillator();
    this.exhaust.setPeriodicWave(engineWave(ctx, {
      1: 0.05, 2: 0.14, 3: 0.42, 4: 0.1, 6: 1, 9: 0.34, 12: 0.52, 15: 0.16, 18: 0.28, 24: 0.14, 30: 0.07, 36: 0.05,
    }, 0.09, 1234));
    this.exhaust.connect(this.exhaustFilter);
    // a detuned twin (the second bank) for width and beating
    this.exhaust2 = ctx.createOscillator();
    this.exhaust2.setPeriodicWave(engineWave(ctx, { 3: 0.3, 6: 0.8, 9: 0.2, 12: 0.4, 18: 0.2 }, 0.07, 987));
    this.exhaust2.detune.value = 9;
    const bank2 = ctx.createGain();
    bank2.gain.value = 0.45;
    this.exhaust2.connect(bank2).connect(this.exhaustFilter);

    // intake: the higher orders through a band-pass that climbs with rpm — the rasp at the top end
    this.intakeFilter = ctx.createBiquadFilter();
    this.intakeFilter.type = 'bandpass';
    this.intakeFilter.Q.value = 1.1;
    this.intakeLevel = ctx.createGain();
    this.intakeLevel.gain.value = 0;
    this.intakeFilter.connect(this.intakeLevel).connect(shaper);
    this.intake = ctx.createOscillator();
    this.intake.setPeriodicWave(engineWave(ctx, { 6: 0.4, 12: 1, 18: 0.8, 24: 0.6, 30: 0.4, 36: 0.3, 42: 0.2 }, 0.12, 4321));
    this.intake.connect(this.intakeFilter);

    // exhaust breath: noise shaped by the same filter so it follows the load
    this.breath = ctx.createBufferSource();
    this.breath.buffer = this.noise;
    this.breath.loop = true;
    this.breathLevel = ctx.createGain();
    this.breathLevel.gain.value = 0;
    this.breath.connect(this.breathLevel).connect(this.exhaustFilter);

    // ── turbo: whistle + hiss ──
    this.turbo = ctx.createOscillator();
    this.turbo.type = 'sine';
    this.turbo.frequency.value = 2000;
    this.turboLevel = ctx.createGain();
    this.turboLevel.gain.value = 0;
    this.turbo.connect(this.turboLevel).connect(this.master);
    const hiss = ctx.createBufferSource();
    hiss.buffer = this.noise;
    hiss.loop = true;
    const hissFilter = ctx.createBiquadFilter();
    hissFilter.type = 'bandpass';
    hissFilter.frequency.value = 5200;
    hissFilter.Q.value = 1.6;
    this.hissLevel = ctx.createGain();
    this.hissLevel.gain.value = 0;
    hiss.connect(hissFilter).connect(this.hissLevel).connect(this.master);

    // ── wind + tyres ──
    const band = (type, freq, q) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(f).connect(g).connect(this.master);
      return { src, filter: f, gain: g };
    };
    this.wind = band('bandpass', 500, 0.5);
    this.screech = band('bandpass', 1250, 6);
    this.rumble = band('lowpass', 180, 0.7);

    // ── ambient pad: four gliding voices → low-pass → feedback delay ──
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = this.musicOn ? 0.05 : 0;
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 1100;
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.42;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.38;
    padFilter.connect(this.musicGain);
    padFilter.connect(delay);
    delay.connect(feedback).connect(delay);
    delay.connect(this.musicGain);
    this.musicGain.connect(this.master);
    this.voices = CHORDS[0].map((freq, i) => {
      const o = ctx.createOscillator();
      o.type = i % 2 ? 'sine' : 'triangle';
      o.frequency.value = freq;
      o.detune.value = (i - 1.5) * 4;
      const gain = ctx.createGain();
      gain.gain.value = 0.25;
      o.connect(gain).connect(padFilter);
      return { osc: o, gain };
    });

    this.sources = [
      this.exhaust, this.exhaust2, this.intake, this.breath, this.turbo, hiss,
      this.wind.src, this.screech.src, this.rumble.src, ...this.voices.map(v => v.osc),
    ];
    this.sources.forEach(s => s.start());
  }

  /** Starts (or restarts) sound — call from a user gesture. Muted, the context stays asleep. */
  async resume() {
    this.init();
    if (this.muted) {
      this.sleepSoon();
      return;
    }
    if (this.ctx?.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        /* the next gesture will try again */
      }
    }
  }

  /**
   * Mute fades out, then suspends the whole audio graph: a running graph costs a steady slice
   * of CPU on the audio thread even when silent. Unmuting wakes it and fades back in.
   */
  setMuted(muted) {
    this.muted = muted;
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(muted ? 0 : 0.85, this.ctx.currentTime, 0.08);
    if (muted) this.sleepSoon();
    else {
      window.clearTimeout(this.sleepTimer);
      this.resume();
    }
  }

  /** Suspends the context once the mute fade has finished (unless unmuted meanwhile). */
  sleepSoon() {
    window.clearTimeout(this.sleepTimer);
    this.sleepTimer = window.setTimeout(() => {
      if (this.muted && this.ctx?.state === 'running') this.ctx.suspend().catch(() => {});
    }, 450);
  }

  setMusic(on) {
    this.musicOn = on;
    if (this.ctx) this.musicGain.gain.setTargetAtTime(on ? 0.05 : 0, this.ctx.currentTime, 0.6);
  }

  get running() {
    return Boolean(this.ctx) && this.ctx.state === 'running';
  }

  /**
   * Called every frame. `rpm` real revs per minute; `load` 0–1 (throttle); `boost` 0–1;
   * `slip` 0–1; `surface` 'road' | 'gravel' | 'grass'; `limiter` / `shifting` / `overRev` flags.
   */
  update({ rpm, load, boost = 0, speed, slip, bump, surface, paused, limiter, shifting, overRev }) {
    if (!this.running) return;
    const t = this.ctx.currentTime;
    const cycle = Math.max(4, rpm / 120);
    this.exhaust.frequency.setTargetAtTime(cycle, t, 0.018);
    this.exhaust2.frequency.setTargetAtTime(cycle, t, 0.022);
    this.intake.frequency.setTargetAtTime(cycle, t, 0.018);
    const rev = Math.min(1.25, rpm / 9000);
    const on = Math.max(load, overRev ? 0.6 : 0);

    // on throttle the exhaust opens up and the intake rasps; off throttle it's a muffled burble
    this.exhaustFilter.frequency.setTargetAtTime(260 + on * 1500 + rev * 1400, t, 0.05);
    this.intakeFilter.frequency.setTargetAtTime(700 + rev * 2600, t, 0.05);
    this.intakeLevel.gain.setTargetAtTime(on * (0.12 + rev * 0.22), t, 0.05);
    this.breathLevel.gain.setTargetAtTime(0.05 + on * 0.12, t, 0.05);
    let gain = 0.05 + on * 0.07 + rev * 0.06;
    if (limiter && (load > 0.05 || overRev)) gain *= Math.sin(t * 2 * Math.PI * 17) > 0 ? 1 : 0.3; // limiter chop
    if (shifting) gain *= 0.4;
    this.engineGain.gain.setTargetAtTime(paused ? 0 : gain, t, limiter ? 0.004 : 0.03);

    // turbo whistle rises with boost (and a little with rpm); hiss sits underneath
    this.turbo.frequency.setTargetAtTime(1700 + boost * 5600 + rpm * 0.12, t, 0.08);
    this.turboLevel.gain.setTargetAtTime(paused ? 0 : boost * boost * 0.03, t, 0.06);
    this.hissLevel.gain.setTargetAtTime(paused ? 0 : boost * 0.03, t, 0.08);

    const air = Math.min(1, speed / 90);
    this.wind.gain.gain.setTargetAtTime(paused ? 0 : air * air * 0.2, t, 0.2);
    this.wind.filter.frequency.setTargetAtTime(350 + air * 1400, t, 0.2);
    const onRoad = surface !== 'grass';
    const grip = Math.min(1, speed / 6) * slip;
    this.screech.gain.gain.setTargetAtTime(paused || !onRoad ? 0 : Math.min(0.16, grip * 0.2), t, 0.05);
    this.screech.filter.frequency.setTargetAtTime(1100 + slip * 500, t, 0.1);
    this.rumble.gain.gain.setTargetAtTime(paused || onRoad ? 0 : Math.min(0.35, (speed / 25) * 0.3), t, 0.1);

    if (bump > 0.35) this.thud(bump);

    if (t >= this.nextChordAt) {
      const chord = CHORDS[this.chordIndex % CHORDS.length];
      this.voices.forEach((v, i) => v.osc.frequency.setTargetAtTime(chord[i], t, 1.2));
      this.chordIndex++;
      this.nextChordAt = t + CHORD_SECONDS;
    }
  }

  /** A short burst of the shared noise buffer through a filter and a fast envelope. */
  burst(when, { type, freq, q = 0.8, peak, decay, offset = Math.random() }) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0005, when + decay);
    src.connect(f).connect(g).connect(this.master);
    src.start(when, offset * (this.noise.duration - decay - 0.05), decay + 0.05);
  }

  /** One exhaust backfire: a sharp crack plus a low boom. `strength` 0–1. */
  pop(strength = 0.7, delay = 0) {
    if (!this.running) return;
    const when = this.ctx.currentTime + delay;
    if (when - this.lastPop < 0.03) return;
    this.lastPop = when;
    const s = Math.min(1, Math.max(0.15, strength));
    this.burst(when, { type: 'highpass', freq: 1100 + Math.random() * 900, q: 0.7, peak: 0.28 * s, decay: 0.035 + s * 0.03 });
    this.burst(when, { type: 'lowpass', freq: 520, q: 1.2, peak: 0.45 * s, decay: 0.08 + s * 0.08 });
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(90 + Math.random() * 40, when);
    o.frequency.exponentialRampToValueAtTime(38, when + 0.12);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.32 * s, when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0005, when + 0.14);
    o.connect(g).connect(this.master);
    o.start(when);
    o.stop(when + 0.16);
  }

  /** Blow-off valve: a hissing "pssh" that flutters as it dies away. `amount` 0–1 (boost dumped). */
  blowOff(amount) {
    if (!this.running || amount < 0.2) return;
    const t = this.ctx.currentTime;
    this.burst(t, { type: 'bandpass', freq: 2300, q: 0.9, peak: 0.16 * amount, decay: 0.32 });
    for (let k = 1; k <= 5; k++) {
      this.burst(t + 0.05 + k * 0.042, { type: 'bandpass', freq: 1500 - k * 90, q: 1.4, peak: 0.07 * amount * (1 - k / 6), decay: 0.035 });
    }
  }

  /** A decaying oscillator (optionally gliding to `endFreq`) — the tonal part of impacts. */
  tone(when, { freq, endFreq = freq, peak, decay, type = 'sine' }) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, when);
    if (endFreq !== freq) o.frequency.exponentialRampToValueAtTime(endFreq, when + decay);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0003, when + decay);
    o.connect(g).connect(this.master);
    o.start(when);
    o.stop(when + decay + 0.02);
  }

  /**
   * Something breaking or landing. `material`: wood | metal | plastic | stone | hay | plant;
   * `kind`: 'break' (the car snapping it) or 'fall' (debris hitting the ground); `strength` 0–1.
   */
  crash(material, strength, kind = 'break') {
    if (!this.running) return;
    const t = this.ctx.currentTime;
    const key = `${kind}:${material}`;
    this.lastCrash ??= {};
    if (t - (this.lastCrash[key] ?? 0) < (kind === 'fall' ? 0.12 : 0.05)) return;
    this.lastCrash[key] = t;
    const s = Math.min(1, Math.max(0.12, strength));
    const fall = kind === 'fall';
    const rnd = () => Math.random();
    switch (material) {
      case 'wood':
        if (!fall) {
          // the trunk cracks, then splinters crackle as it tears
          this.burst(t, { type: 'highpass', freq: 1400, q: 0.6, peak: 0.5 * s, decay: 0.06 });
          this.burst(t, { type: 'lowpass', freq: 380, q: 1, peak: 0.6 * s, decay: 0.22 });
          for (let k = 0; k < 7; k++) {
            this.burst(t + 0.02 + rnd() * 0.35, { type: 'bandpass', freq: 900 + rnd() * 2200, q: 2.5, peak: 0.16 * s, decay: 0.02 + rnd() * 0.03 });
          }
        }
        this.tone(t, { freq: fall ? 70 : 110, endFreq: 38, peak: (fall ? 0.5 : 0.35) * s, decay: fall ? 0.35 : 0.25 });
        if (fall) this.burst(t, { type: 'highpass', freq: 2600, q: 0.4, peak: 0.1 * s, decay: 0.6 }); // leaves rustle
        break;
      case 'metal': {
        // a struck pole rings: inharmonic partials that die away, over a hard knock
        const f0 = (fall ? 150 : 210) + rnd() * 60;
        [1, 2.76, 5.4, 8.93].forEach((ratio, k) => {
          this.tone(t, { freq: f0 * ratio, peak: (0.2 / (k + 1)) * s, decay: (fall ? 0.5 : 0.9) / (1 + k * 0.4), type: k ? 'sine' : 'triangle' });
        });
        this.burst(t, { type: 'bandpass', freq: 2400, q: 1.2, peak: 0.35 * s, decay: 0.07 });
        this.burst(t, { type: 'lowpass', freq: 500, q: 1, peak: 0.4 * s, decay: 0.12 });
        break;
      }
      case 'plastic':
        this.burst(t, { type: 'bandpass', freq: 1700 + rnd() * 600, q: 1.5, peak: 0.28 * s, decay: 0.05 });
        this.tone(t, { freq: 320, endFreq: 180, peak: 0.12 * s, decay: 0.08 });
        break;
      case 'stone':
        this.tone(t, { freq: 85, endFreq: 40, peak: 0.55 * s, decay: 0.3 });
        this.burst(t, { type: 'lowpass', freq: 900, q: 0.8, peak: 0.45 * s, decay: 0.18 });
        this.burst(t + 0.01, { type: 'highpass', freq: 3000, q: 0.7, peak: 0.12 * s, decay: 0.12 });
        break;
      case 'hay':
        this.burst(t, { type: 'lowpass', freq: 420, q: 0.7, peak: 0.45 * s, decay: 0.25 });
        this.burst(t, { type: 'highpass', freq: 2200, q: 0.5, peak: 0.12 * s, decay: 0.4 });
        break;
      default: // plant
        this.burst(t, { type: 'lowpass', freq: 650, q: 1, peak: 0.4 * s, decay: 0.16 });
        this.tone(t, { freq: 130, endFreq: 60, peak: 0.25 * s, decay: 0.16 });
    }
  }

  /** A soft low thump for bumps and landings (rate-limited). */
  thud(strength) {
    const t = this.ctx.currentTime;
    if (t - (this.lastThud ?? 0) < 0.25) return;
    this.lastThud = t;
    const o = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.25);
    gain.gain.setValueAtTime(0.18 * strength, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(gain).connect(this.master);
    o.start(t);
    o.stop(t + 0.32);
  }

  dispose() {
    window.clearTimeout(this.sleepTimer);
    if (!this.ctx) return;
    this.sources.forEach(s => {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    });
    this.ctx.close().catch(() => {});
    this.ctx = null;
  }
}
