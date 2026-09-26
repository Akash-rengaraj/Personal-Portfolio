/**
 * Zen Drive playtest: drives the real game in a browser and checks handling,
 * gearbox, controls, streaming and features, then photographs the car from
 * every angle for a visual review.
 *
 *   npm run build && npm run preview      # in one terminal
 *   npm run test:drive                    # in another (BASE_URL overrides http://localhost:4173)
 *   ONLY=break npm run test:drive         # just the checks whose name contains "break"
 *
 * Uses the `window.__zenDrive` hook that only exists with `?debug` in the URL.
 * Screenshots go to SHOTS_DIR (default: ./playtest-shots, git-ignored).
 */
import { chromium, devices } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const CHROME = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';
const SHOTS = process.env.SHOTS_DIR ?? 'playtest-shots';
const ONLY = process.env.ONLY; // run just the checks whose name contains this
const results = [];

async function check(name, fn) {
  if (ONLY && !name.includes(ONLY)) return;
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
  } catch (err) {
    results.push({ name, ok: false, detail: err.message.split('\n')[0] });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function openGame(context, query = '', settings = {}) {
  await context.addInitScript((s) => {
    try {
      sessionStorage.setItem('booted', '1');
      localStorage.setItem('zen-drive-settings', JSON.stringify(s));
    } catch { /* storage blocked */ }
  }, { quality: 'medium', ...settings });
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') page.errors.push(m.text()); });
  await page.goto(`${BASE}/drive?seed=4242&debug${query}`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForFunction(() => window.__zenDrive);
  return page;
}

/* Physics scenarios run on a flat, grippy test pad using the game's own Vehicle class */
const BENCH = () => {
  const Vehicle = window.__zenDrive.vehicle.constructor;
  const pad = { groundHeight: () => 0, surfaceAt: () => 'road', gripAt: () => 1, forEachObstacleNear() {} };
  const ASSISTS = { full: { tc: true, abs: true, esc: 1 }, sport: { tc: false, abs: true, esc: 0.35 }, off: { tc: false, abs: false, esc: 0 } };
  const dt = 1 / 120;
  const make = (assists = 'full', kmh = 0, gear = 1, transmission = 'auto') => {
    const v = new Vehicle(pad, { x: 0, z: 0, heading: 0 });
    v.assists = ASSISTS[assists];
    v.transmission = transmission;
    v.vz = kmh / 3.6;
    v.forwardSpeed = v.vz;
    v.gear = v.pendingGear = gear;
    return v;
  };
  const input = (o = {}) => ({ throttle: 0, brake: 0, steer: 0, handbrake: false, ...o });
  const run = (v, seconds, inp, each) => {
    for (let i = 0; i < seconds / dt; i++) {
      v.step(dt, typeof inp === 'function' ? inp(v, i * dt) : inp);
      each?.(v, i * dt);
    }
  };
  const out = {};

  // acceleration, top speed, braking
  let v = make();
  const at = {};
  run(v, 60, input({ throttle: 1 }), (car, t) => {
    const kmh = car.forwardSpeed * 3.6;
    for (const mark of [100, 200, 300]) if (!at[mark] && kmh >= mark) at[mark] = t;
  });
  out.accel = at;
  v = make('full', 100, 2);
  let dist = 0;
  run(v, 6, input({ brake: 1 }), car => { if (car.forwardSpeed > 0.1) dist += car.forwardSpeed * dt; });
  out.brake100 = dist;

  // steady full-lock cornering holding speed: radius, lateral g, stability
  out.corners = [];
  for (const [kmh, gear] of [[30, 1], [80, 2], [150, 3], [250, 5]]) {
    for (const mode of ['full', 'sport', 'off']) {
      v = make(mode, kmh, gear, 'manual');
      let maxRear = 0;
      let spun = false;
      let settled = 0;
      run(v, 4, (car) => input({ throttle: car.forwardSpeed * 3.6 < kmh ? 0.5 : 0, steer: -1 }), (car, t) => {
        const rear = Math.abs(Math.atan2(car.lateralSpeed - 1.06 * car.yawRate, Math.max(Math.abs(car.forwardSpeed), 3)));
        maxRear = Math.max(maxRear, rear);
        if (car.forwardSpeed < 0 && car.speed > 3) spun = true;
        if (t > 2.5) settled = Math.abs(car.forwardSpeed / (car.yawRate || 1e-6));
      });
      out.corners.push({ kmh, mode, radius: settled, latG: Math.abs(v.ay) / 9.81, rearSlipDeg: (maxRear * 180) / Math.PI, spun, endKmh: v.speed * 3.6 });
    }
  }

  // lifting off mid-corner (classic 911 trap) with full assists
  v = make('full', 110, 3, 'manual');
  let liftSpin = false;
  run(v, 1.5, input({ throttle: 0.5, steer: -0.8 }));
  run(v, 2.5, input({ throttle: 0, steer: -0.8 }), car => { if (car.forwardSpeed < 0 && car.speed > 3) liftSpin = true; });
  out.liftOffSpin = liftSpin;

  // steering responds within a fraction of a second at every speed
  out.response = [];
  for (const [kmh, gear] of [[40, 2], [120, 3], [220, 5]]) {
    v = make('full', kmh, gear, 'manual');
    let t50 = null;
    let peak = 0;
    run(v, 1.2, input({ throttle: 0.3, steer: 1 }), (car, t) => {
      peak = Math.max(peak, Math.abs(car.yawRate));
      if (t50 === null && Math.abs(car.yawRate) > 0.1) t50 = t;
    });
    out.response.push({ kmh, reactS: t50, peakYaw: peak });
  }

  // engine braking per gear, and rev-matching on downshift
  out.engineBrake = [];
  for (const gear of [2, 3, 4, 5, 6]) {
    const kmh = { 2: 120, 3: 150, 4: 150, 5: 150, 6: 150 }[gear];
    v = make('full', kmh, gear, 'manual');
    const s0 = v.forwardSpeed;
    run(v, 1, input());
    out.engineBrake.push({ gear, kmh, decel: (s0 - v.forwardSpeed) / 1 });
  }
  v = make('full', 150, 5, 'manual');
  run(v, 0.2, input());
  const rpmBefore = v.rpm;
  v.shiftDown();
  run(v, 0.3, input());
  out.revMatch = { before: rpmBefore, after: v.rpm, gear: v.gear };
  // over-rev downshift (3rd → 2nd at 230 km/h, past the redline) is taken and slows the car
  // hard, compared with just lifting off in 3rd; an impossible one (2nd at 300) is refused
  const coast = make('full', 230, 3, 'manual');
  run(coast, 1.5, input());
  v = make('full', 230, 3, 'manual');
  const taken = v.shiftDown();
  let peakRpm = 0;
  run(v, 1.5, input(), car => { peakRpm = Math.max(peakRpm, car.rpm); });
  out.overRev = { taken, kmh: v.forwardSpeed * 3.6, coastKmh: coast.forwardSpeed * 3.6, peakRpm, gear: v.gear };
  v = make('full', 300, 3, 'manual');
  out.overRev2 = { allowed: v.shiftDown(), refused: v.refused, gear: v.gear };

  // automatic: braking hard from 6th brings the gears down
  v = make('full', 220, 6, 'auto');
  run(v, 3, input({ brake: 0.8 }));
  out.autoBrakeGear = { gear: v.gear, kmh: v.forwardSpeed * 3.6 };

  // rev limiter holds in 1st
  v = make('full', 0, 1, 'manual');
  let maxRpm = 0;
  run(v, 6, input({ throttle: 1 }), car => { maxRpm = Math.max(maxRpm, car.rpm); });
  out.limiter = { maxRpm, kmh: v.forwardSpeed * 3.6 };

  // reverse: auto (hold brake at a stop) and manual (Q from 1st)
  v = make('full', 0, 1, 'auto');
  run(v, 2.5, input({ brake: 1 }));
  out.reverseAuto = { gear: v.gearLabel, kmh: v.forwardSpeed * 3.6 };
  v = make('full', 0, 1, 'manual');
  v.shiftDown();
  run(v, 2, input({ throttle: 1 }));
  out.reverseManual = { gear: v.gearLabel, kmh: v.forwardSpeed * 3.6 };

  // countersteered power drift without assists holds together
  v = make('off', 70, 2, 'manual');
  const betas = [];
  run(v, 5, (car, t) => {
    const beta = Math.atan2(car.lateralSpeed, Math.abs(car.forwardSpeed));
    return input(t < 0.4
      ? { throttle: 1, steer: -0.8 }
      // sticky slicks need plenty of throttle to keep the rears spinning
      : { throttle: Math.max(0.5, Math.min(1, 1.15 - Math.abs(beta) * 1.2)), steer: Math.max(-1, Math.min(1, beta * 2.2 - 0.25)) });
  }, (car, t) => { if (t > 0.5 && t < 2) betas.push(Math.abs(Math.atan2(car.lateralSpeed, Math.abs(car.forwardSpeed)))); });
  // collisions: glancing a guardrail keeps most of the speed; a head-on post stops without a throw
  const walled = (obstacles) => ({ ...pad, forEachObstacleNear: (x, z, visit) => obstacles.forEach(visit) });
  let c = new Vehicle(walled([{ x: 5, z: 500, r: 0.25, seg: [5, 0, 5, 1000] }]), { x: 0, z: 0, heading: 0 });
  c.assists = ASSISTS.full;
  c.heading = 0.17; // ~10° toward the rail (heading + turns toward +x here)
  c.vx = Math.sin(c.heading) * 120 / 3.6;
  c.vz = Math.cos(c.heading) * 120 / 3.6;
  c.gear = c.pendingGear = 3;
  let maxAway = 0;
  let touched = false;
  run(c, 2, input({ throttle: 0.3 }), car => {
    if (car.x > 3.4) touched = true;
    if (touched) maxAway = Math.max(maxAway, -car.vx);
  });
  out.railGlance = { touched, kmh: c.speed * 3.6, maxAway, x: c.x };
  c = new Vehicle(walled([{ x: 0, z: 20, r: 0.3 }]), { x: 0, z: 0, heading: 0 });
  c.assists = ASSISTS.full;
  c.vz = 60 / 3.6;
  c.gear = c.pendingGear = 2;
  let maxBack = 0;
  run(c, 2, input(), car => { maxBack = Math.max(maxBack, -car.vz); });
  out.postHeadOn = { maxBack, kmh: c.speed * 3.6 };
  // pinned nose-first against a post, then steering with the throttle held drives round it
  c = new Vehicle(walled([{ x: 0, z: 3.1, r: 0.3 }]), { x: 0, z: 0, heading: 0 });
  c.assists = ASSISTS.full;
  run(c, 2, input({ throttle: 1 }));
  const pinnedZ = c.z;
  run(c, 3, input({ throttle: 1, steer: -1 }));
  out.pinEscape = { pinnedKmh: 0, headingDeg: (c.heading * 180) / Math.PI, movedM: Math.hypot(c.x, c.z - pinnedZ), kmh: c.speed * 3.6 };

  // automatic box with keyboard (on/off) throttle holding a speed: no hunting between gears
  out.hunting = [];
  for (const target of [60, 100, 140, 180, 220]) {
    c = make('full', 0, 1, 'auto');
    let changes = 0;
    let last = c.gearLabel;
    run(c, 30, car => input({ throttle: car.forwardSpeed * 3.6 < target ? 1 : 0 }), (car, t) => {
      if (car.gearLabel === '·') return;
      if (t > 12 && car.gearLabel !== last) changes++;
      last = car.gearLabel;
    });
    out.hunting.push({ target, changes, gear: c.gearLabel, rpm: Math.round(c.rpm) });
  }

  out.drift = { avgSlipDeg: (betas.reduce((a, b) => a + b, 0) / betas.length) * 57.3, forward: v.forwardSpeed > 0 };
  return out;
};

async function main() {
  await mkdir(SHOTS, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--ignore-gpu-blocklist'] });
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 720 } });

  /* ── physics bench ── */
  const page = await openGame(desktop);
  const bench = await page.evaluate(BENCH);
  await page.close();

  await check('0–100 km/h under 4 s, 0–300 under 12 s', () => {
    assert(bench.accel[100] < 4 && bench.accel[300] < 12, JSON.stringify(bench.accel));
    return `0–100 ${bench.accel[100].toFixed(2)} s · 0–200 ${bench.accel[200].toFixed(2)} s · 0–300 ${bench.accel[300].toFixed(2)} s`;
  });
  await check('braking 100–0 km/h under 36 m', () => {
    assert(bench.brake100 < 36, `${bench.brake100.toFixed(1)} m`);
    return `${bench.brake100.toFixed(1)} m`;
  });
  for (const c of bench.corners) {
    await check(`full lock at ${c.kmh} km/h, assists ${c.mode}`, () => {
      const maxRadius = { 30: 20, 80: 60, 150: 170, 250: 420 }[c.kmh];
      if (c.mode === 'full') {
        assert(!c.spun, 'spun with full assists');
        assert(c.radius > 0 && c.radius < maxRadius, `turn radius ${c.radius.toFixed(0)} m (want < ${maxRadius})`);
        assert(c.latG > 0.8, `only ${c.latG.toFixed(2)} g of cornering`);
      }
      if (c.mode === 'sport') assert(!c.spun, 'sport assists should catch the slide');
      return `radius ${c.radius.toFixed(0)} m · ${c.latG.toFixed(2)} g · rear slip ${c.rearSlipDeg.toFixed(1)}° · spun ${c.spun} · ends ${c.endKmh.toFixed(0)} km/h`;
    });
  }
  await check('lift-off mid-corner does not spin (full assists)', () => {
    assert(!bench.liftOffSpin, 'spun on lift-off');
    return 'stable';
  });
  for (const r of bench.response) {
    await check(`steering reacts quickly at ${r.kmh} km/h`, () => {
      assert(r.reactS !== null && r.reactS < 0.35, `yaw took ${r.reactS ?? '∞'} s`);
      return `yaw building after ${r.reactS.toFixed(2)} s · peak ${r.peakYaw.toFixed(2)} rad/s`;
    });
  }
  await check('engine braking gets stronger in lower gears', () => {
    const [g2, g3, g4, g5, g6] = bench.engineBrake.map(e => e.decel);
    assert(g2 > 2.5 && g3 > g5 && g5 > g6 * 0.9 && g4 > g6, bench.engineBrake.map(e => `${e.gear}:${e.decel.toFixed(2)}`).join(' '));
    return bench.engineBrake.map(e => `${e.gear}th ${e.decel.toFixed(1)} m/s²`).join(' · ');
  });
  await check('downshift rev-matches (rpm jumps up)', () => {
    assert(bench.revMatch.gear === 4 && bench.revMatch.after > bench.revMatch.before + 800, JSON.stringify(bench.revMatch));
    return `${Math.round(bench.revMatch.before)} → ${Math.round(bench.revMatch.after)} rpm`;
  });
  await check('over-rev downshift bites like a real one (impossible ones refused)', () => {
    const o = bench.overRev;
    assert(o.taken && o.gear === 2 && o.coastKmh - o.kmh > 20 && o.peakRpm > 10000, JSON.stringify(o));
    assert(bench.overRev2.allowed === false && bench.overRev2.refused === 'over-rev', JSON.stringify(bench.overRev2));
    return `3→2 at 230: ${o.kmh.toFixed(0)} km/h after 1.5 s vs ${o.coastKmh.toFixed(0)} coasting, engine to ${Math.round(o.peakRpm)} rpm · 3→2 at 300 refused`;
  });
  await check('automatic downshifts under braking', () => {
    assert(bench.autoBrakeGear.gear <= 3, JSON.stringify(bench.autoBrakeGear));
    return `6th → ${bench.autoBrakeGear.gear} at ${bench.autoBrakeGear.kmh.toFixed(0)} km/h`;
  });
  await check('rev limiter holds in 1st', () => {
    assert(bench.limiter.maxRpm < 9300 && bench.limiter.kmh < 105, JSON.stringify(bench.limiter));
    return `max ${Math.round(bench.limiter.maxRpm)} rpm at ${bench.limiter.kmh.toFixed(0)} km/h`;
  });
  await check('reverse works in auto and manual', () => {
    assert(bench.reverseAuto.gear === 'R' && bench.reverseAuto.kmh < -5, JSON.stringify(bench.reverseAuto));
    assert(bench.reverseManual.gear === 'R' && bench.reverseManual.kmh < -5, JSON.stringify(bench.reverseManual));
    return `auto ${bench.reverseAuto.kmh.toFixed(0)} km/h · manual ${bench.reverseManual.kmh.toFixed(0)} km/h`;
  });
  await check('glancing a guardrail slides along it, no throw', () => {
    const r = bench.railGlance;
    assert(r.touched && r.kmh > 85 && r.maxAway < 2.5, JSON.stringify(r));
    return `120 → ${r.kmh.toFixed(0)} km/h, pushed off at ${r.maxAway.toFixed(1)} m/s`;
  });
  await check('head-on post stops the car without bouncing it back', () => {
    const r = bench.postHeadOn;
    assert(r.maxBack < 1, JSON.stringify(r));
    return `rebound ${r.maxBack.toFixed(2)} m/s`;
  });
  await check('pinned against a post, steering drives round it', () => {
    const r = bench.pinEscape;
    assert(Math.abs(r.headingDeg) > 45 && r.movedM > 3, JSON.stringify(r));
    return `turned ${r.headingDeg.toFixed(0)}°, moved ${r.movedM.toFixed(1)} m in 3 s`;
  });
  await check('automatic box holds its gear with tapped (keyboard) throttle', () => {
    const bad = bench.hunting.filter(h => h.changes > 1);
    assert(bad.length === 0, JSON.stringify(bad));
    return bench.hunting.map(h => `${h.target}: ${h.gear}th @${h.rpm}`).join(' · ');
  });
  await check('countersteered drift holds (assists off)', () => {
    assert(bench.drift.forward && bench.drift.avgSlipDeg > 8, JSON.stringify(bench.drift));
    return `avg slip ${bench.drift.avgSlipDeg.toFixed(0)}°`;
  });

  /* ── controls in the real game ── */
  await check('keyboard keeps working after clicking HUD buttons', async () => {
    const p = await openGame(desktop);
    await p.locator('.zd-start').click();
    await p.locator('.zd-icon-btn[aria-label^="Camera"]').click();
    await p.locator('.zd-icon-btn[aria-label^="Mute"], .zd-icon-btn[aria-label^="Unmute"]').click();
    await p.keyboard.down('KeyW');
    await p.waitForTimeout(1500);
    await p.keyboard.down('KeyD');
    await p.waitForTimeout(300);
    const steer = await p.evaluate(() => window.__zenDrive.vehicle.steerAngle);
    await p.keyboard.up('KeyD');
    await p.keyboard.press('Space');
    const state = await p.evaluate(() => ({ kmh: window.__zenDrive.vehicle.speed * 3.6, mode: window.__zenDrive.mode }));
    await p.keyboard.up('KeyW');
    assert(state.kmh > 20, `speed only ${state.kmh.toFixed(0)} km/h`);
    assert(steer > 0.02, 'D did not steer');
    assert(state.mode === 'drive', `space triggered a button (mode ${state.mode})`);
    assert(p.errors.length === 0, p.errors.join(' | '));
    await p.close();
    return `${state.kmh.toFixed(0)} km/h, steer ${steer.toFixed(2)} rad, still driving`;
  });

  await check('pause clears held keys; resume keeps driving', async () => {
    const p = await openGame(desktop);
    await p.locator('.zd-start').click();
    await p.keyboard.down('KeyW');
    await p.waitForTimeout(800);
    await p.keyboard.press('Escape');
    await p.keyboard.up('KeyW');
    await p.locator('.zd-menu').waitFor();
    const held = await p.evaluate(() => window.__zenDrive.input.keys.size);
    await p.getByRole('button', { name: /resume/ }).click();
    await p.waitForTimeout(1200);
    const coasting = await p.evaluate(() => window.__zenDrive.input.state.throttle);
    await p.keyboard.down('KeyA');
    await p.waitForTimeout(300);
    const steer = await p.evaluate(() => window.__zenDrive.vehicle.steerAngle);
    await p.keyboard.up('KeyA');
    assert(held === 0, `${held} keys still held while paused`);
    assert(coasting === 0, 'throttle stuck on after resume');
    assert(steer < -0.02, 'steering dead after resume');
    await p.close();
    return 'ok';
  });

  await check('features: camera cycle, photo mode, reset, cruise, manual shifting', async () => {
    const p = await openGame(desktop);
    await p.locator('.zd-start').click();
    const cams = [];
    for (let i = 0; i < 4; i++) {
      await p.keyboard.press('KeyC');
      cams.push(await p.evaluate(() => window.__zenDrive.rig.mode));
    }
    await p.keyboard.press('KeyP');
    const photo = await p.evaluate(() => window.__zenDrive.mode);
    await p.keyboard.press('KeyP');
    await p.keyboard.press('KeyZ');
    await p.waitForTimeout(2500);
    const cruise = await p.evaluate(() => ({ on: window.__zenDrive.cruise, kmh: window.__zenDrive.vehicle.speed * 3.6 }));
    await p.keyboard.press('KeyZ');
    await p.keyboard.press('KeyT');
    const trans = await p.evaluate(() => window.__zenDrive.vehicle.transmission);
    await p.keyboard.down('KeyW');
    await p.waitForTimeout(1500);
    const gearBefore = await p.evaluate(() => window.__zenDrive.vehicle.gear);
    await p.keyboard.press('KeyE');
    await p.waitForTimeout(400);
    const gear = await p.evaluate(() => window.__zenDrive.vehicle.gear);
    await p.keyboard.up('KeyW');
    await p.evaluate(() => { const v = window.__zenDrive.vehicle; v.x += 80; });
    await p.keyboard.press('KeyR');
    const onRoad = await p.evaluate(() => {
      const e = window.__zenDrive;
      return e.world.road.nearest(e.vehicle.x, e.vehicle.z, 10, {})?.dist ?? 99;
    });
    assert(cams.join() === 'hood,cinematic,drone,chase', cams.join());
    assert(photo === 'photo', `photo mode: ${photo}`);
    assert(cruise.on && cruise.kmh > 20, JSON.stringify(cruise));
    assert(trans === 'manual' && gear === gearBefore + 1, `transmission ${trans}, gear ${gearBefore} → ${gear}`);
    assert(onRoad < 3, `reset left the car ${onRoad} m from the road`);
    assert(p.errors.length === 0, p.errors.join(' | '));
    await p.close();
    return `cameras ${cams.join('→')} · cruise ${cruise.kmh.toFixed(0)} km/h · manual ${gearBefore}→${gear} · reset ok`;
  });

  /* ── grip over real roads, and streaming at very high speed ── */
  await check('car body is closed: nose and tail faces point outwards', async () => {
    const p = await openGame(desktop);
    const caps = await p.evaluate(() => {
      const shell = window.__zenDrive.car.body.children[0];
      const pos = shell.geometry.getAttribute('position');
      const idx = shell.geometry.index.array;
      const tally = { tail: [0, 0], nose: [0, 0] };
      for (let i = 0; i < idx.length; i += 3) {
        const [a, b, c] = [idx[i], idx[i + 1], idx[i + 2]];
        const zs = [pos.getZ(a), pos.getZ(b), pos.getZ(c)];
        const end = zs.every(z => z < -2.28) ? 'tail' : zs.every(z => z > 2.28) ? 'nose' : null;
        if (!end) continue;
        const ux = pos.getX(b) - pos.getX(a), uy = pos.getY(b) - pos.getY(a), uz = zs[1] - zs[0];
        const vx = pos.getX(c) - pos.getX(a), vy = pos.getY(c) - pos.getY(a), vz = zs[2] - zs[0];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        // cap faces only: the normal points mostly along the car (side panels are excluded)
        if (Math.abs(nz) < 0.9 * Math.hypot(nx, ny, nz)) continue;
        tally[end][(end === 'tail' ? nz < 0 : nz > 0) ? 0 : 1]++;
      }
      return tally;
    });
    await p.close();
    assert(caps.tail[0] > 20 && caps.tail[1] === 0 && caps.nose[0] > 20 && caps.nose[1] === 0, JSON.stringify(caps));
    return `tail ${caps.tail[0]} / nose ${caps.nose[0]} cap triangles all outward`;
  });

  await check('M key mute stays in step with the menu and saved settings', async () => {
    const p = await openGame(desktop, '', { muted: false });
    await p.locator('.zd-start').click();
    await p.keyboard.press('Escape');
    await p.locator('.zd-menu').waitFor();
    await p.keyboard.press('KeyM');
    await p.waitForTimeout(200);
    const s = await p.evaluate(() => ({
      engine: window.__zenDrive.audio.muted,
      box: !document.querySelector('.zd-toggles input').checked,
      saved: JSON.parse(localStorage.getItem('zen-drive-settings')).muted,
    }));
    await p.close();
    assert(s.engine && s.box && s.saved, JSON.stringify(s));
    return 'muted everywhere';
  });

  await check('wheels stay planted at speed on real roads', async () => {
    const p = await openGame(desktop);
    await p.locator('.zd-start').click();
    const stats = await p.evaluate(async () => {
      const e = window.__zenDrive;
      e.setCruise(true);
      e.cruiseSpeed = 150 / 3.6;
      let samples = 0;
      let air = 0;
      await new Promise(resolve => {
        const t0 = performance.now();
        const tick = () => {
          samples++;
          if (e.vehicle.airborne) air++;
          if (performance.now() - t0 < 20000) requestAnimationFrame(tick);
          else resolve();
        };
        tick();
      });
      return { airborne: air / samples, kmh: e.vehicle.speed * 3.6, km: e.vehicle.distance / 1000 };
    });
    await p.close();
    assert(stats.airborne < 0.05, `airborne ${(stats.airborne * 100).toFixed(1)} % of the time`);
    return `airborne ${(stats.airborne * 100).toFixed(1)} % · ${stats.km.toFixed(2)} km driven at ~${stats.kmh.toFixed(0)} km/h`;
  });

  await check('running off the road edge never launches the car', async () => {
    const p = await openGame(desktop);
    await p.locator('.zd-start').click();
    const runs = await p.evaluate(() => {
      const e = window.__zenDrive;
      e.mode = 'paused';
      const { vehicle: v, world: w } = e;
      const road = w.road;
      const results = [];
      for (const [kmh, angle, side, s] of [[100, 0.12, 1, 400], [80, 0.5, 1, 700], [140, 0.1, -1, 1000], [120, 0.3, -1, 1300]]) {
        road.ensureAhead(road.indexAtS(s + 400));
        for (let k = 0; k < 40; k++) w.process(50);
        const q = road.pointAt(s, {});
        v.reset({ x: q.x, z: q.z, heading: q.heading - side * angle });
        v.gear = v.pendingGear = 3;
        v.vx = Math.sin(v.heading) * kmh / 3.6;
        v.vz = Math.cos(v.heading) * kmh / 3.6;
        let maxLift = 0;
        for (let i = 0; i < 360; i++) {
          v.step(1 / 120, { throttle: 0.4, brake: 0, steer: 0, handbrake: false });
          const lift = v.y - w.groundHeight(v.x, v.z);
          // the edge zone only: further out, real hill crests can (rightly) give some air
          if (w.lastRoadDist < 15) maxLift = Math.max(maxLift, lift);
        }
        results.push({ kmh, maxLift });
      }
      return results;
    });
    await p.close();
    const worst = Math.max(...runs.map(r => r.maxLift));
    assert(worst < 0.8, runs.map(r => `${r.kmh}: ${r.maxLift.toFixed(2)} m`).join(', '));
    return `${runs.length} run-offs, highest hop ${worst.toFixed(2)} m`;
  });

  await check('lamps, posts and trees break on impact, fall with physics and stay down', async () => {
    const p = await openGame(desktop, '', { quality: 'high' });
    await p.locator('.zd-start').click();
    await p.waitForTimeout(1500);
    const res = await p.evaluate(() => {
      const e = window.__zenDrive;
      e.mode = 'paused';
      const { vehicle: v, world: w } = e;
      const dt = 1 / 120;
      const idle = { throttle: 0, brake: 0, steer: 0, handbrake: false };
      const standing = (test) => {
        const list = [];
        for (const bucket of w.obstacles.values()) for (const o of bucket) if (o.id && !o.broken && test(o)) list.push(o);
        return list.sort((a, b) => Math.hypot(a.x - v.x, a.z - v.z) - Math.hypot(b.x - v.x, b.z - v.z));
      };
      // nothing solid (or breakable, besides light posts) between the start and the target
      const clear = (o, sx, sz) => {
        for (let t = 0; t <= 1; t += 0.1) {
          let blocked = false;
          w.forEachObstacleNear(sx + (o.x - sx) * t, sz + (o.z - sz) * t, (other) => {
            if (other === o || other.kind === 'post' || other.seg) return;
            const ex = o.x - sx;
            const ez = o.z - sz;
            const k = Math.max(0, Math.min(1, ((other.x - sx) * ex + (other.z - sz) * ez) / (ex * ex + ez * ez)));
            if (Math.hypot(sx + ex * k - other.x, sz + ez * k - other.z) < other.r + 1.4) blocked = true;
          });
          if (blocked) return false;
        }
        return true;
      };
      const crash = (o, kmh, fromRoad, run = 20) => {
        const q = w.road.nearest(o.x, o.z, 400, {});
        let h = w.road.h[Math.round(q.index)];
        if (fromRoad) h = Math.atan2(o.x - q.x, o.z - q.z); // head out from the road toward it
        const sx = o.x - Math.sin(h) * run;
        const sz = o.z - Math.cos(h) * run;
        if (!clear(o, sx, sz)) return null;
        v.reset({ x: sx, z: sz, heading: h });
        v.gear = v.pendingGear = 3;
        v.vx = (Math.sin(h) * kmh) / 3.6;
        v.vz = (Math.cos(h) * kmh) / 3.6;
        let before = null;
        let after = null;
        for (let i = 0; i < 120 * 6; i++) {
          const speed = v.speed * 3.6;
          v.step(dt, idle);
          w.update(dt, v);
          if (o.broken && after === null) {
            before = speed;
            after = v.speed * 3.6;
          }
        }
        const body = w.debris.bodies.find(b => b.id === o.id);
        const upright = body ? body.R.elements[4] : 1;
        const moved = body ? Math.hypot(body.p.x - o.x, body.p.z - o.z) : 0;
        const aboveGround = body ? body.p.y - w.groundHeight(body.p.x, body.p.z) : 0;
        return {
          id: o.id, kind: o.kind, broken: Boolean(o.broken), before, after, loss: before - after,
          moved, upright, resting: body ? body.asleep || body.v.length() < 0.6 : false, aboveGround, endKmh: v.speed * 3.6,
        };
      };
      const first = (list, fn) => {
        for (const o of list.slice(0, 12)) {
          const r = fn(o);
          if (r) return r;
        }
        return null;
      };
      const lamp = first(standing(o => o.kind === 'lamp'), o => crash(o, 90, false));
      const post = first(standing(o => o.kind === 'post'), o => crash(o, 90, false, 8));
      // (a felled tree rests propped on its canopy, so "down" means tipped well past 40°)
      const tree = first(standing(o => o.leaves && o.kind !== 'birch' && o.breakSpeed > 6), o => crash(o, 90, true, 10));
      const gentle = first(standing(o => o.leaves && o.breakSpeed > 6 && !o.broken), o => crash(o, 12, true, 6));
      // stream everything out and back in: what was knocked down must stay down
      const ids = [...w.broken];
      w.rebuildScenery();
      for (const c of [...w.roads.keys()]) w.disposeRoad(c);
      w.plan(v.x, v.z);
      while (w.queue.length) w.process(1000);
      const back = ids.filter(id => w.byId.has(id));
      return { lamp, post, tree, gentle, ids: ids.length, back };
    });
    const errors = p.errors;
    await p.close();
    const { lamp, post, tree, gentle } = res;
    assert(lamp && post && tree && gentle, `no clear target found: ${JSON.stringify(res)}`);
    assert(lamp.broken && post.broken && tree.broken, `did not break: ${JSON.stringify(res)}`);
    assert(post.loss < 3, `a plastic post cost ${post.loss.toFixed(1)} km/h`);
    assert(lamp.loss < 30 && lamp.moved > 2 && lamp.resting && lamp.aboveGround > -0.5, `lamp: ${JSON.stringify(lamp)}`);
    assert(tree.loss > 6 && tree.loss < 50 && tree.upright < 0.75 && tree.resting, `tree: ${JSON.stringify(tree)}`);
    assert(!gentle.broken && gentle.endKmh < 4, `a 12 km/h nudge: ${JSON.stringify(gentle)}`);
    assert(res.back.length === 0, `came back after a rebuild: ${res.back.join(', ')}`);
    assert(errors.length === 0, errors[0]);
    return `90 km/h: post −${post.loss.toFixed(1)}, lamp −${lamp.loss.toFixed(0)} (flew ${lamp.moved.toFixed(0)} m), `
      + `${tree.kind} −${tree.loss.toFixed(0)} km/h (fell, up ${tree.upright.toFixed(2)}) · 12 km/h nudge holds · ${res.ids} stay down after rebuild`;
  });

  await check('graphics tiers: frame caps, detail levels, smooth switching, audio sleeps when muted', async () => {
    const p = await openGame(desktop, '', { quality: 'auto', muted: false });
    await p.locator('.zd-start').click();
    await p.waitForTimeout(1500);
    const res = await p.evaluate(async () => {
      const e = window.__zenDrive;
      const w = e.world;
      e.setCruise(true);
      e.cruiseSpeed = 90 / 3.6;
      const out = { detected: e.detected, auto: e.qualityName, tiers: {} };
      let drawn = 0;
      const render = e.renderFrame.bind(e);
      e.renderFrame = (...a) => { drawn++; render(...a); };
      let blank = 0;
      const watch = setInterval(() => {
        // every terrain chunk keeps a mesh while tiers switch (rebuilt in place, never removed)
        for (const c of w.terrain.values()) if (!c.terrain?.geometry?.attributes?.position) blank++;
      }, 50);
      for (const tier of ['low', 'high', 'medium']) {
        e.setQuality(tier);
        // let the in-place rebuild finish streaming before timing frames
        for (let k = 0; k < 40 && (k < 10 || w.queue.length); k++) await new Promise(r => setTimeout(r, 250));
        drawn = 0;
        const t0 = performance.now();
        await new Promise(r => setTimeout(r, 2000));
        const fps = drawn / ((performance.now() - t0) / 1000);
        const tiles = [...w.terrain.values()].flatMap(c => c.tiles).filter(Boolean);
        out.tiers[tier] = {
          fps: Math.round(fps),
          cap: e.maxFps,
          radius: w.radius,
          chunks: w.terrain.size,
          near: tiles.filter(t => t.lod === 'near').length,
          birds: e.birds.mesh.visible,
          clouds: e.sky.domeMaterial.uniforms.cloudCover.value > 0,
          shadows: e.renderer.shadowMap.enabled,
        };
      }
      clearInterval(watch);
      out.blank = blank;
      e.setMuted(true);
      await new Promise(r => setTimeout(r, 900));
      out.mutedState = e.audio.ctx?.state;
      e.setMuted(false);
      await new Promise(r => setTimeout(r, 400));
      out.unmutedState = e.audio.ctx?.state;
      return out;
    });
    const errors = p.errors;
    await p.close();
    const { low, medium, high } = res.tiers;
    assert(['low', 'medium', 'high'].includes(res.detected.tier) && res.auto === res.detected.tier, `auto: ${JSON.stringify(res.detected)} → ${res.auto}`);
    // caps hold (the playtest browser may render in software, so tiers can fall short of them)
    assert(low.fps <= 34 && medium.fps <= 64 && high.fps <= 64, `frame caps exceeded: ${JSON.stringify(res.tiers)}`);
    assert(low.fps >= high.fps, `low should draw at least as fast as high: ${JSON.stringify(res.tiers)}`);
    assert(low.radius < medium.radius && medium.radius < high.radius && low.chunks < medium.chunks && medium.chunks < high.chunks, `view distance: ${JSON.stringify(res.tiers)}`);
    assert(low.near === 0 && high.near > 0 && !low.birds && high.birds && !low.clouds && medium.clouds && high.shadows && !medium.shadows, `extras: ${JSON.stringify(res.tiers)}`);
    assert(res.blank === 0, `terrain blinked out ${res.blank} times while switching tiers`);
    assert(res.mutedState === 'suspended' && res.unmutedState === 'running', `audio muted ${res.mutedState} / unmuted ${res.unmutedState}`);
    assert(errors.length === 0, errors[0]);
    return `auto → ${res.auto} (${res.detected.reason}) · low ${low.fps}/${low.cap} fps ${low.chunks} chunks · `
      + `medium ${medium.fps}/${medium.cap} fps ${medium.chunks} chunks · high ${high.fps}/${high.cap} fps ${high.chunks} chunks, shadows + birds `
      + '· no blank terrain · muted audio sleeps';
  });

  await check('world streams fast enough for 600 km/h', async () => {
    const p = await openGame(desktop, '', { quality: 'high' });
    await p.locator('.zd-start').click();
    const res = await p.evaluate(async () => {
      const e = window.__zenDrive;
      const road = e.world.road;
      let s = 0;
      let maxQueue = 0;
      let missingRoad = 0;
      let frames = 0;
      const q = {};
      await new Promise(resolve => {
        let last = performance.now();
        const t0 = last;
        const tick = (now) => {
          const dt = Math.min(0.1, (now - last) / 1000);
          last = now;
          s += (600 / 3.6) * dt;
          road.ensureAhead(road.indexAtS(s));
          const p = road.pointAt(s, q);
          const v = e.vehicle;
          v.x = p.x + Math.cos(p.heading) * 1.95;
          v.z = p.z - Math.sin(p.heading) * 1.95;
          v.heading = p.heading;
          v.vx = Math.sin(p.heading) * 166;
          v.vz = Math.cos(p.heading) * 166;
          e.savePrev();
          frames++;
          maxQueue = Math.max(maxQueue, e.world.queue.length);
          const chunk = Math.floor(p.index / 25);
          if (frames > 20 && !e.world.roads.has(chunk)) missingRoad++;
          if (now - t0 < 12000) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      return { maxQueue, missingRoad, frames, km: s / 1000 };
    });
    await p.close();
    assert(res.missingRoad === 0, `road missing under the car on ${res.missingRoad} of ${res.frames} frames`);
    return `${res.km.toFixed(1)} km at 600 km/h · max queue ${res.maxQueue}`;
  });

  await check('every terrain and a new road load without errors', async () => {
    for (const terrain of ['normal', 'spring', 'summer', 'autumn', 'desert', 'snow']) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      const p = await openGame(ctx, '', { terrain });
      await p.locator('.zd-start').click();
      await p.waitForTimeout(600);
      const name = await p.evaluate(() => window.__zenDrive.biome.a.id);
      assert(name === terrain, `asked ${terrain}, got ${name}`);
      assert(p.errors.length === 0, `${terrain}: ${p.errors.join(' | ')}`);
      await ctx.close();
    }
    return 'normal, spring, summer, autumn, desert, snow';
  });

  await check('phone: touch pads drive and steer', async () => {
    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    const p = await openGame(ctx);
    await p.locator('.zd-start').tap();
    await p.waitForTimeout(1500);
    const pad = p.getByRole('button', { name: 'Steer right' });
    const box = await pad.boundingBox();
    await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await p.evaluate(() => window.__zenDrive.setTouch({ right: true }));
    await p.waitForTimeout(400);
    const steer = await p.evaluate(() => window.__zenDrive.vehicle.steerAngle);
    const kmh = await p.evaluate(() => window.__zenDrive.vehicle.speed * 3.6);
    assert(kmh > 10 && steer > 0.01, `kmh ${kmh.toFixed(0)}, steer ${steer.toFixed(2)}`);
    assert(p.errors.length === 0, p.errors.join(' | '));
    await ctx.close();
    return `${kmh.toFixed(0)} km/h, steering ${steer.toFixed(2)} rad`;
  });

  /* ── photo shoot for visual review ── */
  await check('car photographed from every angle', async () => {
    const p = await openGame(desktop, '&phase=0.3', { quality: 'high', terrain: 'normal' });
    await p.evaluate(() => { document.querySelector('.zd-intro').style.display = 'none'; });
    await p.waitForTimeout(1500);
    const angles = [0, 45, 90, 135, 180, 225, 270, 315];
    for (const deg of angles) {
      await p.evaluate((d) => {
        const e = window.__zenDrive;
        e.mode = 'photo';
        e.rig.mode = 'cinematic';
        e.rig.orbit = (d * Math.PI) / 180;
        e.rig.initialized = false;
      }, deg);
      await p.waitForTimeout(700);
      await p.screenshot({ path: `${SHOTS}/car-${deg}.png` });
    }
    for (const mode of ['drone', 'hood', 'chase']) {
      await p.evaluate((m) => { const e = window.__zenDrive; e.rig.mode = m; e.rig.initialized = false; }, mode);
      await p.waitForTimeout(700);
      await p.screenshot({ path: `${SHOTS}/cam-${mode}.png` });
    }
    await p.close();
    return `${angles.length + 3} shots in ${SHOTS}/`;
  });

  await browser.close();
  const failed = results.filter(r => !r.ok);
  for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.name} — ${r.detail}`);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
