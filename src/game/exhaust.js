/**
 * Turbo boost and exhaust theatre: decides when the turbo spools and dumps (blow-off),
 * and when the exhaust pops, bangs and spits flame.
 *
 *  • Boost builds with throttle and revs, with a little lag, and collapses on lift;
 *    lifting with real boost fires the blow-off valve.
 *  • Every downshift at speed barks a short burst of bangs with a flame.
 *  • An over-rev (a downshift past the redline) and bouncing off the limiter crackle.
 *  • Crackle mode (the "pops & bangs" button) adds the full overrun show: every lift
 *    from high revs rattles off a string of pops and flames as the revs fall.
 *
 * `update` returns what happened this frame; the engine hands it to the sound and the
 * car model (flames), so both always agree.
 */
const SPOOL_UP = 1.6;      // boost gained per second at full demand (turbo lag)
const SPOOL_DOWN = 7;      // lost per second off throttle (the wastegate/BOV dumps it)
const MIN_POP_RPM = 3200;

export class ExhaustFx {
  constructor() {
    this.boost = 0;
    this.lastThrottle = 0;
    this.lastDownshifts = 0;
    this.overrun = 0;       // seconds of crackle left after a lift
    this.queue = [];        // scheduled pops: { at, strength }
    this.time = 0;
    this.flame = 0;
    this.events = { pops: [], blowOff: 0, flame: 0 };
  }

  reset(vehicle) {
    this.boost = 0;
    this.queue.length = 0;
    this.overrun = 0;
    this.lastDownshifts = vehicle.downshifts;
  }

  schedule(delay, strength) {
    this.queue.push({ at: this.time + delay, strength });
  }

  /** Advances by dt. `crackle`: the pops & bangs mode is on. */
  update(dt, vehicle, crackle) {
    this.time += dt;
    const ev = this.events;
    ev.pops.length = 0;
    ev.blowOff = 0;
    const throttle = vehicle.throttle;
    const rpm = vehicle.rpm;
    const moving = vehicle.speed > 3 && vehicle.gear > 0;

    // turbo: target boost from throttle and revs (little below 2,500 rpm), with spool lag
    const target = throttle * Math.min(1, Math.max(0, (rpm - 2500) / 3500));
    const rate = target > this.boost ? SPOOL_UP : SPOOL_DOWN;
    const before = this.boost;
    this.boost += Math.max(-rate * dt, Math.min(rate * dt, target - this.boost));
    if (this.lastThrottle > 0.5 && throttle < 0.15 && before > 0.35) ev.blowOff = before;

    // downshift: a short volley of bangs, bigger the higher the revs land
    if (vehicle.downshifts !== this.lastDownshifts) {
      this.lastDownshifts = vehicle.downshifts;
      if (moving) {
        const heat = Math.min(1, rpm / 8000);
        const shots = 2 + Math.round(heat * 3 + Math.random() * 2);
        for (let k = 0; k < shots; k++) this.schedule(0.06 + k * (0.05 + Math.random() * 0.05), 0.55 + heat * 0.45 * Math.random());
      }
    }

    // lift-off from high revs starts the overrun crackle window (crackle mode)
    if (crackle && this.lastThrottle > 0.4 && throttle < 0.1 && rpm > 4500 && moving) {
      this.overrun = 0.8 + Math.min(1.8, (rpm - 4500) / 2500);
    }
    this.lastThrottle = throttle;

    // continuous sources: over-rev, limiter bounce, overrun crackle
    let rateHz = 0;
    let strength = 0.5;
    if (vehicle.overRev) {
      rateHz = 11;
      strength = 0.9;
    } else if (vehicle.limiter && throttle > 0.05) {
      rateHz = crackle ? 9 : 3;
      strength = 0.6;
    } else if (crackle && moving && throttle < 0.1 && rpm > MIN_POP_RPM) {
      if (this.overrun > 0) {
        this.overrun -= dt;
        rateHz = 7 + Math.min(9, (rpm - MIN_POP_RPM) / 450);
        strength = 0.45 + Math.min(0.5, (rpm - MIN_POP_RPM) / 9000);
      } else {
        rateHz = 2.2; // a lazy burble while coasting
        strength = 0.3;
      }
    } else {
      this.overrun = Math.max(0, this.overrun - dt);
    }
    if (rateHz > 0 && Math.random() < rateHz * dt) ev.pops.push(strength * (0.6 + Math.random() * 0.4));

    // release scheduled pops that are due
    for (let i = this.queue.length - 1; i >= 0; i--) {
      if (this.queue[i].at <= this.time) {
        ev.pops.push(this.queue[i].strength);
        this.queue.splice(i, 1);
      }
    }

    // flames: each pop lights the tailpipes, fading quickly
    this.flame = Math.max(0, this.flame - dt * 9);
    for (const s of ev.pops) this.flame = Math.max(this.flame, 0.35 + s * 0.65);
    ev.flame = this.flame;
    return ev;
  }
}
