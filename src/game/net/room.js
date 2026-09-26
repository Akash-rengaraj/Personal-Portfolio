/**
 * A multiplayer room on the Firebase Realtime Database the site already uses for its view
 * counter, so there is no game server to run. A room has four seats (players/0–3): a player
 * claims a free one (the database lets only one of two racing joiners have it), publishes
 * their car ~10 times a second to state/{seat} and listens to everyone else's. Seats free
 * themselves when a player disconnects, and the room closes when its creator leaves.
 *
 * The Firebase SDK is imported only when multiplayer is actually used. With `?emulator=9000`
 * on localhost the session talks to the local Firebase emulator instead (for tests).
 */
import { PROTOCOL, MAX_PLAYERS, makeRoomCode, makePlayerId, cleanName, isRoomCode } from './protocol';

const TIMEOUT_MS = 9000;
const ROOM_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/** A failed room operation; `code` is one of: invalid, not-found, full, version, rules, network. */
export class RoomError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const MESSAGES = {
  invalid: 'room codes are 6 letters and numbers',
  'not-found': 'no room with that code — check it, or ask for a fresh one',
  full: `that room is full (${MAX_PLAYERS} drivers)`,
  version: 'that room was made by a different version of the game — reload the page',
  rules: 'the database refused the room (are the multiplayer rules published?)',
  network: 'couldn’t reach the multiplayer server — check your connection',
};
const fail = (code) => new RoomError(code, MESSAGES[code]);

let connection;

/** Loads Firebase and returns { db, api } (shared, loaded once). */
async function connect() {
  if (connection) return connection;
  const api = await import('firebase/database');
  const port = Number(new URLSearchParams(window.location.search).get('emulator'));
  const local = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  let db;
  if (port && local) {
    const [{ initializeApp }, { firebaseConfig }] = await Promise.all([import('firebase/app'), import('../../firebase/config')]);
    db = api.getDatabase(initializeApp(firebaseConfig, 'zen-drive-emulator'));
    api.connectDatabaseEmulator(db, '127.0.0.1', port);
  } else {
    ({ db } = await import('../../firebase/config'));
  }
  const clock = { offset: 0 };
  api.onValue(api.ref(db, '.info/serverTimeOffset'), (snap) => {
    clock.offset = Number(snap.val()) || 0;
  });
  connection = { db, api, clock };
  return connection;
}

/** Rejects with a network error if `promise` doesn't settle in time (Firebase waits forever offline). */
function withTimeout(promise) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(fail('network')), TIMEOUT_MS);
    }),
  ]).finally(() => clearTimeout(timer));
}

const denied = (err) => /permission/i.test(String(err?.code ?? err?.message ?? ''));

const SEATS = Array.from({ length: MAX_PLAYERS }, (_, i) => String(i));

export class RoomSession {
  constructor(conn, { code, pid, meta, name, paint }) {
    this.conn = conn;
    this.code = code;
    this.pid = pid;  // this player's random id
    this.id = null;  // their seat ('0'–'3') once in the room
    this.meta = meta;
    this.name = name;
    this.paint = paint;
    this.players = new Map(); // seat → { pid, name, paint, joinedAt }
    this.listeners = {};
    this.unsubscribe = [];
    this.closed = false;
    this.online = true;
  }

  get isHost() {
    return this.meta.host === this.pid;
  }

  /** Server clock in ms (local clock + Firebase's measured offset). */
  serverNow() {
    return Date.now() + this.conn.clock.offset;
  }

  /** Time of day shared by everyone in the room (0–1), from when it was created. */
  phaseNow(dayLengthSeconds) {
    const elapsed = (this.serverNow() - this.meta.createdAt) / 1000;
    return (((this.meta.phase0 + elapsed / dayLengthSeconds) % 1) + 1) % 1;
  }

  /**
   * Subscribes to an event: players (Map), meta (object), state (id, text), hit (text),
   * broken (id), closed (reason), connection (online). Returns an unsubscribe function.
   */
  on(event, fn) {
    (this.listeners[event] ??= new Set()).add(fn);
    return () => this.listeners[event]?.delete(fn);
  }

  emit(event, ...args) {
    this.listeners[event]?.forEach(fn => fn(...args));
  }

  path(...parts) {
    return this.conn.api.ref(this.conn.db, ['rooms', this.code, ...parts].join('/'));
  }

  /** Creates a room for this road and joins it as its host. */
  static async create({ seed, terrain, phase, collisions, name, paint }) {
    const conn = await connect();
    const { api, db } = conn;
    const pid = makePlayerId();
    for (let attempt = 0; ; attempt++) {
      const code = makeRoomCode();
      const metaRef = api.ref(db, `rooms/${code}/meta`);
      try {
        await withTimeout(api.set(metaRef, {
          v: PROTOCOL, seed: seed >>> 0, terrain, host: pid, createdAt: api.serverTimestamp(),
          phase0: ((phase % 1) + 1) % 1, collisions: Boolean(collisions),
        }));
      } catch (err) {
        // a taken code is refused too (meta is write-once): try another a few times
        if (denied(err) && attempt < 4) continue;
        throw err instanceof RoomError ? err : fail(denied(err) ? 'rules' : 'network');
      }
      const snap = await withTimeout(api.get(metaRef));
      const session = new RoomSession(conn, { code, pid, meta: snap.val(), name: cleanName(name), paint });
      // the host leaving (or losing the connection) closes the room for everyone
      await withTimeout(api.onDisconnect(api.ref(db, `rooms/${code}`)).remove());
      await session.enter({});
      return session;
    }
  }

  /** Joins an existing room by its code. */
  static async join({ code, name, paint }) {
    if (!isRoomCode(code)) throw fail('invalid');
    const conn = await connect();
    const { api, db } = conn;
    let room;
    try {
      room = (await withTimeout(api.get(api.ref(db, `rooms/${code}`)))).val();
    } catch (err) {
      throw err instanceof RoomError ? err : fail(denied(err) ? 'rules' : 'network');
    }
    if (!room?.meta) throw fail('not-found');
    if (room.meta.v !== PROTOCOL) throw fail('version');
    if (Date.now() + conn.clock.offset - room.meta.createdAt > ROOM_MAX_AGE_MS) throw fail('not-found');
    const session = new RoomSession(conn, { code, pid: makePlayerId(), meta: room.meta, name: cleanName(name), paint });
    try {
      await session.enter(room.players ?? {});
    } catch (err) {
      throw err instanceof RoomError ? err : fail(denied(err) ? 'full' : 'network');
    }
    return session;
  }

  /**
   * Takes the first free seat (another joiner may beat us to one: then the next), sets it to
   * clear itself on disconnect, and starts listening.
   */
  async enter(taken) {
    const { api } = this.conn;
    for (const seat of SEATS) {
      if (taken[seat]) continue;
      const me = this.path('players', seat);
      try {
        await withTimeout(api.set(me, {
          pid: this.pid, name: this.name || 'driver', paint: String(this.paint).slice(0, 20), joinedAt: api.serverTimestamp(),
        }));
      } catch (err) {
        if (denied(err)) continue; // taken meanwhile (or the room just closed)
        throw err;
      }
      this.id = seat;
      await withTimeout(api.onDisconnect(this.path('hits', seat)).remove());
      await withTimeout(api.onDisconnect(this.path('state', seat)).remove());
      await withTimeout(api.onDisconnect(me).remove());
      this.listen();
      return;
    }
    throw fail('full');
  }

  listen() {
    const { api, db } = this.conn;
    const players = this.path('players');
    const state = this.path('state');
    const sub = (fn) => this.unsubscribe.push(fn);
    const updatePlayer = (snap) => {
      const p = snap.val();
      if (!p) return;
      this.players.set(snap.key, { pid: String(p.pid ?? ''), name: cleanName(p.name) || 'driver', paint: String(p.paint ?? ''), joinedAt: p.joinedAt });
      this.emit('players', this.players);
    };
    sub(api.onChildAdded(players, updatePlayer));
    sub(api.onChildChanged(players, updatePlayer));
    sub(api.onChildRemoved(players, (snap) => {
      this.players.delete(snap.key);
      this.emit('players', this.players);
    }));
    const onState = (snap) => {
      if (snap.key !== this.id) this.emit('state', snap.key, snap.val());
    };
    sub(api.onChildAdded(state, onState));
    sub(api.onChildChanged(state, onState));
    sub(api.onChildAdded(this.path('broken'), (snap) => this.emit('broken', snap.key)));
    sub(api.onValue(this.path('hits', this.id), (snap) => {
      if (snap.exists()) this.emit('hit', snap.val());
    }));
    sub(api.onValue(this.path('meta'), (snap) => {
      const meta = snap.val();
      if (!meta) {
        this.close(this.isHost ? 'left' : 'host-left');
        return;
      }
      this.meta = meta;
      this.emit('meta', meta);
    }));
    sub(api.onValue(api.ref(db, '.info/connected'), (snap) => {
      this.online = Boolean(snap.val());
      this.emit('connection', this.online);
    }));
  }

  /** Publishes this car's packed state (see protocol.packState). Fire and forget. */
  sendState(text) {
    if (this.closed) return;
    this.conn.api.set(this.path('state', this.id), text).catch(() => {});
  }

  /** Sends another player's car the shove it took from ours (see protocol.packHit). */
  sendHit(seat, text) {
    if (this.closed || seat === this.id) return;
    this.conn.api.set(this.path('hits', seat), text).catch(() => {});
  }

  /** Tells the room a roadside object was knocked down (write-once; repeats are refused quietly). */
  sendBroken(id) {
    if (this.closed || !/^[a-z0-9:-]{1,24}$/.test(id)) return;
    this.conn.api.set(this.path('broken', id), true).catch(() => {});
  }

  /** Updates this player's name or paint for everyone. */
  updateMe({ name = this.name, paint = this.paint }) {
    if (this.closed || this.id === null) return;
    this.name = cleanName(name) || this.name;
    this.paint = paint;
    const me = this.players.get(this.id);
    this.conn.api.set(this.path('players', this.id), {
      pid: this.pid, name: this.name || 'driver', paint: String(paint).slice(0, 20), joinedAt: me?.joinedAt ?? this.conn.api.serverTimestamp(),
    }).catch(() => {});
  }

  /** Host only: cars push each other (true) or pass through (false). */
  setCollisions(on) {
    if (this.closed || !this.isHost) return;
    this.conn.api.set(this.path('meta', 'collisions'), Boolean(on)).catch(() => {});
  }

  close(reason) {
    if (this.closed) return;
    this.closed = true;
    this.unsubscribe.forEach(fn => fn());
    this.unsubscribe = [];
    this.emit('closed', reason);
  }

  /** Leaves the room (the host's leaving closes it for everyone). */
  async leave() {
    if (this.closed) return;
    const { api } = this.conn;
    const host = this.isHost;
    this.close('left');
    try {
      if (host) await withTimeout(api.remove(this.path()));
      else {
        await withTimeout(api.remove(this.path('state', this.id)));
        await withTimeout(api.remove(this.path('players', this.id)));
      }
      // nothing left to clean up on disconnect
      api.onDisconnect(this.path('players', this.id)).cancel().catch(() => {});
      api.onDisconnect(this.path('state', this.id)).cancel().catch(() => {});
      if (host) api.onDisconnect(this.path()).cancel().catch(() => {});
    } catch {
      /* offline: the server-side onDisconnect clean-up will do it */
    }
  }
}
