/**
 * All sound is synthesised with WebAudio — no audio files to download:
 * an engine hum that follows RPM, wind that grows with speed, soft tyre hiss
 * when sliding, a bump thud, and a slow ambient pad drifting through chords.
 */
const CHORDS = [
  [130.81, 196.0, 246.94, 329.63], // Cmaj7
  [110.0, 164.81, 261.63, 329.63], // Am7
  [87.31, 174.61, 220.0, 329.63],  // Fmaj7
  [98.0, 146.83, 246.94, 293.66],  // G6
];
const CHORD_SECONDS = 9;

function noiseBuffer(ctx, seconds = 2) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export class DriveAudio {
  constructor({ muted, music }) {
    this.ctx = null;
    this.muted = muted;
    this.musicOn = music;
    this.chordIndex = 0;
    this.nextChordAt = 0;
  }

  /** Builds the audio graph. Browsers only allow this after a user gesture. */
  init() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    const ctx = this.ctx;
    const { muted, musicOn: music } = this;

    this.master = ctx.createGain();
    this.master.gain.value = muted ? 0 : 0.9;
    this.master.connect(ctx.destination);

    // engine: saw + sub square through a low-pass
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 400;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineFilter.connect(this.engineGain).connect(this.master);
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineSub = ctx.createOscillator();
    this.engineSub.type = 'square';
    const subGain = ctx.createGain();
    subGain.gain.value = 0.5;
    this.engineOsc.connect(this.engineFilter);
    this.engineSub.connect(subGain).connect(this.engineFilter);

    // wind + tyres share one looping noise source
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer(ctx);
    noise.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 500;
    this.windFilter.Q.value = 0.5;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    noise.connect(this.windFilter).connect(this.windGain).connect(this.master);
    this.skidFilter = ctx.createBiquadFilter();
    this.skidFilter.type = 'bandpass';
    this.skidFilter.frequency.value = 1400;
    this.skidFilter.Q.value = 2.5;
    this.skidGain = ctx.createGain();
    this.skidGain.gain.value = 0;
    noise.connect(this.skidFilter).connect(this.skidGain).connect(this.master);
    this.noise = noise;

    // ambient pad: four gliding voices → low-pass → feedback delay
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = music ? 0.05 : 0;
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
      const osc = ctx.createOscillator();
      osc.type = i % 2 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = (i - 1.5) * 4;
      const gain = ctx.createGain();
      gain.gain.value = 0.25;
      osc.connect(gain).connect(padFilter);
      return { osc, gain };
    });

    this.sources = [this.engineOsc, this.engineSub, noise, ...this.voices.map(v => v.osc)];
    this.sources.forEach(s => s.start());
  }

  /** Starts (or restarts) sound — call from a user gesture. */
  async resume() {
    this.init();
    if (this.ctx?.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        /* the next gesture will try again */
      }
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.9, this.ctx.currentTime, 0.08);
  }

  setMusic(on) {
    this.musicOn = on;
    if (this.ctx) this.musicGain.gain.setTargetAtTime(on ? 0.05 : 0, this.ctx.currentTime, 0.6);
  }

  /** Called every frame with the car's state. `paused` fades the engine out. */
  update({ rpm, throttle, speed, slip, bump, onGrass, paused }) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const base = 38 + rpm * 115;
    this.engineOsc.frequency.setTargetAtTime(base, t, 0.05);
    this.engineSub.frequency.setTargetAtTime(base / 2, t, 0.05);
    this.engineFilter.frequency.setTargetAtTime(260 + throttle * 700 + rpm * 500, t, 0.08);
    this.engineGain.gain.setTargetAtTime(paused ? 0 : 0.05 + throttle * 0.05 + rpm * 0.03, t, 0.1);

    const wind = Math.min(1, speed / 42);
    this.windGain.gain.setTargetAtTime(paused ? 0 : wind * wind * 0.22 + (onGrass ? wind * 0.06 : 0), t, 0.2);
    this.windFilter.frequency.setTargetAtTime(350 + wind * 900, t, 0.2);
    this.skidGain.gain.setTargetAtTime(paused ? 0 : Math.min(0.12, slip * 0.14 * Math.min(1, speed / 8)), t, 0.06);

    if (bump > 0.35) this.thud(bump);

    if (t >= this.nextChordAt) {
      const chord = CHORDS[this.chordIndex % CHORDS.length];
      this.voices.forEach((v, i) => v.osc.frequency.setTargetAtTime(chord[i], t, 1.2));
      this.chordIndex++;
      this.nextChordAt = t + CHORD_SECONDS;
    }
  }

  /** A soft low thump for bumps and landings (rate-limited). */
  thud(strength) {
    const t = this.ctx.currentTime;
    if (t - (this.lastThud ?? 0) < 0.25) return;
    this.lastThud = t;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.25);
    gain.gain.setValueAtTime(0.18 * strength, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  dispose() {
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
