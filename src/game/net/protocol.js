/**
 * Multiplayer wire format: room codes, player ids and names, and the compact string each
 * car publishes about ten times a second. Kept free of Firebase and three.js so it's cheap to
 * load and easy to test.
 */

export const PROTOCOL = 1;
export const MAX_PLAYERS = 4;
export const NAME_MAX = 16;
export const SEND_HZ = 10;

/** Room-code alphabet: no 0/O or 1/I, so codes survive being read out loud or typed. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function randomString(alphabet, length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

/** A fresh room code such as "K7RW3P". */
export const makeRoomCode = () => randomString(CODE_ALPHABET, CODE_LENGTH);

/** A random 12-character player id (the database rules check its shape). */
export const makePlayerId = () => randomString(ID_ALPHABET, 12);

/** Upper-cases typed input and keeps only characters a code can contain (drops spaces, dashes…). */
export function normalizeCode(input) {
  return [...String(input ?? '').toUpperCase()].filter(c => CODE_ALPHABET.includes(c)).join('').slice(0, CODE_LENGTH);
}

export const isRoomCode = (code) => new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`).test(code);

/** A display name: printable characters only, single spaces, at most NAME_MAX long. */
export function cleanName(raw) {
  return String(raw ?? '')
    .replace(/\p{Cc}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX)
    .replace(/[\uD800-\uDBFF]$/, ''); // don't leave half an emoji at the cut
}

/** Flags packed into one number. */
export const FLAG = { BRAKE: 1, REVERSE: 2, PAUSED: 4, AIRBORNE: 8 };

const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;

/**
 * Packs a car's state as a comma-separated string (~90 characters):
 * t (server ms), x, y, z, heading, pitch, roll, vx, vz, yawRate, steer, speed (signed m/s), flags.
 */
export function packState(t, v, flags) {
  return [
    Math.round(t), r2(v.x), r2(v.y), r2(v.z), r3(v.heading), r3(v.pitch), r3(v.roll),
    r2(v.vx), r2(v.vz), r3(v.yawRate), r3(v.steerAngle), r2(v.forwardSpeed), flags,
  ].join(',');
}

/** The inverse of packState, or null for anything malformed. */
export function unpackState(text) {
  if (typeof text !== 'string') return null;
  const n = text.split(',').map(Number);
  if (n.length !== 13 || n.some(v => !Number.isFinite(v))) return null;
  const [t, x, y, z, heading, pitch, roll, vx, vz, yawRate, steer, speed, flags] = n;
  return { t, x, y, z, heading, pitch, roll, vx, vz, yawRate, steer, speed, flags };
}

/**
 * A shove from another car: the velocity change and displacement (world frame) the receiving
 * car should take, stamped with the sender's server time: "t,dvx,dvz,dx,dz".
 */
export function packHit(t, push) {
  return [Math.round(t), r2(push.dvx), r2(push.dvz), r2(push.dx), r2(push.dz)].join(',');
}

export function unpackHit(text) {
  if (typeof text !== 'string') return null;
  const n = text.split(',').map(Number);
  if (n.length !== 5 || n.some(v => !Number.isFinite(v))) return null;
  const [t, dvx, dvz, dx, dz] = n;
  // sanity limits: nothing a real bump could produce
  if (Math.hypot(dvx, dvz) > 60 || Math.hypot(dx, dz) > 3) return null;
  return { t, dvx, dvz, dx, dz };
}
