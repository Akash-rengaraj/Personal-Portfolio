/**
 * Friends' cars in a multiplayer room. Each is the same car model as the player's (sharing its
 * reflection map, with the headlight and flame lights left off, so a friend joining never
 * changes the scene's light count), steered from the network:
 *
 *  • the latest state is projected forward to "now" from its velocity and yaw rate (dead
 *    reckoning, at most half a second), so a friend alongside is drawn where they really are
 *  • the drawn car eases toward that estimate, so late or bunched-up updates don't jerk it
 *  • a name tag floats above it (constant size on screen, visible through hills)
 *
 * `bodies()` gives collisions the same poses you see.
 */
import * as THREE from 'three';
import { createCar, PAINTS } from '../carModel';
import { unpackState, FLAG } from './protocol';

const EXTRAPOLATE_S = 0.5;  // dead-reckon at most this far past the last update
const AWAY_S = 4;           // no update for this long: the friend is "away" (dimmed, no collisions)
const SMOOTH = 10;          // 1/s — how quickly the drawn car closes the gap to the estimate
const SNAP_M = 25;          // further off than this (a reset or regroup): jump instead of gliding
const TAG_HEIGHT = 2.2;

const paintHex = (id) => (PAINTS.find(p => p.id === id) ?? PAINTS[0]).hex;

/** Shortest signed difference between two angles. */
function angleDelta(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Name plate texture: the name in the site's monospace on a dark pill, with a paint dot. */
function nameTexture(name, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.font = '600 52px "Fira Code", ui-monospace, monospace';
  const textWidth = Math.min(400, ctx.measureText(name).width);
  const w = textWidth + 120;
  const x0 = (512 - w) / 2;
  ctx.fillStyle = 'rgba(8, 12, 14, 0.72)';
  ctx.beginPath();
  ctx.roundRect(x0, 20, w, 88, 44);
  ctx.fill();
  ctx.fillStyle = `#${paintHex(paint).toString(16).padStart(6, '0')}`;
  ctx.beginPath();
  ctx.arc(x0 + 48, 64, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2f5f3';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, x0 + 80, 66, 400);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

class RemoteCar {
  constructor(scene, renderer, envMap, id, player) {
    this.id = id;
    this.scene = scene;
    this.car = createCar(paintHex(player.paint), renderer, { envMap });
    this.car.group.traverse(o => {
      if (o.isLight) o.visible = false;
    });
    this.car.group.visible = false; // until the first state arrives
    scene.add(this.car.group);
    this.tagMaterial = new THREE.SpriteMaterial({ depthTest: false, depthWrite: false, transparent: true, sizeAttenuation: false });
    this.tag = new THREE.Sprite(this.tagMaterial);
    this.tag.scale.set(0.2, 0.05, 1);
    this.tag.renderOrder = 10;
    this.tag.visible = false;
    scene.add(this.tag);
    this.state = null;
    this.receivedAt = 0;
    this.pose = null; // drawn { x, y, z, heading, pitch, roll }
    this.setPlayer(player);
  }

  setPlayer(player) {
    if (this.player?.name === player.name && this.player?.paint === player.paint) return;
    this.player = player;
    this.car.setPaint(paintHex(player.paint));
    this.tagMaterial.map?.dispose();
    this.tagMaterial.map = nameTexture(player.name, player.paint);
    this.tagMaterial.needsUpdate = true;
  }

  /** Where the friend is now, by the latest update projected forward (null before any update). */
  estimate(serverNow, ground) {
    const s = this.state;
    if (!s) return null;
    const age = Math.min(EXTRAPOLATE_S, Math.max(0, (serverNow - s.t) / 1000));
    // travel along an arc: the average velocity direction turns by half the heading change
    const turn = s.yawRate * age;
    const c = Math.cos(turn / 2);
    const sn = Math.sin(turn / 2);
    const x = s.x + (s.vx * c + s.vz * sn) * age;
    const z = s.z + (-s.vx * sn + s.vz * c) * age;
    const airborne = s.flags & FLAG.AIRBORNE;
    return {
      x, z,
      y: airborne ? s.y : ground(x, z),
      heading: s.heading + turn,
      pitch: s.pitch,
      roll: s.roll,
      vx: s.vx * Math.cos(turn) + s.vz * Math.sin(turn),
      vz: -s.vx * Math.sin(turn) + s.vz * Math.cos(turn),
    };
  }

  update(dt, serverNow, ground, night, localNow) {
    const target = this.estimate(serverNow, ground);
    if (!target) return;
    const away = (localNow - this.receivedAt) / 1000 > AWAY_S;
    this.away = away;
    const p = this.pose;
    if (!p || Math.hypot(target.x - p.x, target.z - p.z) > SNAP_M) {
      this.pose = { ...target };
    } else {
      const k = 1 - Math.exp(-SMOOTH * dt);
      p.x += (target.x - p.x) * k;
      p.y += (target.y - p.y) * k;
      p.z += (target.z - p.z) * k;
      p.heading += angleDelta(target.heading, p.heading) * k;
      p.pitch += (target.pitch - p.pitch) * k;
      p.roll += (target.roll - p.roll) * k;
      p.vx = target.vx;
      p.vz = target.vz;
    }
    const q = this.pose;
    const group = this.car.group;
    group.visible = true;
    group.position.set(q.x, q.y, q.z);
    group.rotation.set(q.pitch, q.heading, q.roll, 'YXZ');
    const s = this.state;
    this.car.update(dt, {
      steerAngle: s.steer,
      speed: s.speed,
      brake: s.flags & FLAG.BRAKE ? 1 : 0,
      night,
      reversing: Boolean(s.flags & FLAG.REVERSE),
    });
    this.tag.visible = true;
    this.tag.position.set(q.x, q.y + TAG_HEIGHT, q.z);
    this.tagMaterial.opacity = away ? 0.4 : 1;
  }

  dispose() {
    this.scene.remove(this.car.group, this.tag);
    this.car.dispose();
    this.tagMaterial.map?.dispose();
    this.tagMaterial.dispose();
  }
}

export class RemoteCars {
  /** `ground(x, z)` is the world's physics height, used to seat projected cars on the road. */
  constructor(scene, renderer, envMap, ground) {
    this.scene = scene;
    this.renderer = renderer;
    this.envMap = envMap;
    this.ground = ground;
    this.cars = new Map();
  }

  /**
   * Adds, renames, repaints and removes cars to match the room's players (keyed by seat, minus
   * your own). A seat taken over by someone new gets a fresh car.
   */
  setPlayers(players, selfId) {
    for (const [id, car] of this.cars) {
      if (!players.has(id) || players.get(id).pid !== car.player.pid) {
        car.dispose();
        this.cars.delete(id);
      }
    }
    for (const [id, player] of players) {
      if (id === selfId) continue;
      const car = this.cars.get(id);
      if (car) car.setPlayer(player);
      else this.cars.set(id, new RemoteCar(this.scene, this.renderer, this.envMap, id, player));
    }
  }

  /** A state update for player `id` (packed text from the room). */
  receive(id, text) {
    const car = this.cars.get(id);
    const state = unpackState(text);
    if (!car || !state) return;
    if (car.state && state.t < car.state.t) return; // out of order
    car.state = state;
    car.receivedAt = performance.now();
  }

  update(dt, serverNow, night) {
    const now = performance.now();
    for (const car of this.cars.values()) car.update(dt, serverNow, this.ground, night, now);
  }

  /**
   * Friends' cars for collisions: drawn pose and velocity (away or paused ones are left out).
   * `authority` marks the pairs this game referees: those with a higher seat than `selfSeat`.
   */
  bodies(selfSeat) {
    const out = [];
    for (const car of this.cars.values()) {
      if (!car.pose || car.away || car.state.flags & FLAG.PAUSED) continue;
      const p = car.pose;
      out.push({
        seat: car.id, authority: Number(selfSeat) < Number(car.id),
        x: p.x, z: p.z, heading: p.heading, vx: p.vx ?? car.state.vx, vz: p.vz ?? car.state.vz,
      });
    }
    return out;
  }

  /** Friends for the HUD and regrouping: [{ id, name, paint, x, z, heading, vx, vz, away }]. */
  list() {
    return [...this.cars.values()].filter(c => c.pose).map(c => ({
      id: c.id, name: c.player.name, paint: c.player.paint, away: c.away,
      x: c.pose.x, z: c.pose.z, heading: c.pose.heading, vx: c.pose.vx ?? c.state.vx, vz: c.pose.vz ?? c.state.vz,
    }));
  }

  dispose() {
    this.cars.forEach(car => car.dispose());
    this.cars.clear();
  }
}
