# Zen Drive — multiplayer plan

Status: plan only, nothing built yet. Single player stays the main mode; multiplayer is an
extra option in the menu.

## Goal

1. One player creates a room and gets a short code, for example `K7RW3P`, plus an invite link.
2. A friend enters the code (or opens the link) and joins the same world: same road, same
   terrain, same time of day.
3. They see each other's cars and can cruise side by side.
4. It stays lightweight. There's no game server; it runs from the static site that's already
   hosted on Render.

## Transport: Firebase Realtime Database (already in the project)

| Option | Frontend only | Works on every network | Extra dependency | Verdict |
|---|---|---|---|---|
| **Firebase RTDB relay** | yes | yes (WebSocket, with long-poll fallback) | none, already bundled for the view counter | **use for v1** |
| WebRTC P2P (PeerJS / Trystero) | yes, but needs a public broker | no: about 10–15% of NATs need a TURN relay we don't have | yes | later upgrade only |
| Own WebSocket server | no | yes | a server; Render's free tier sleeps | rejected |

- **Where the database is:** asia-southeast1 (Singapore), so round trips from India are about
  50–100 ms. That's plenty for cruising, given the smoothing described below.
- **Only loaded when needed:** `firebase/database` is fetched only when the player opens
  multiplayer. Single player downloads and runs nothing extra.
- **Cost:** 10 updates a second at about 80 bytes each is about 0.8 KB/s per player. The free
  Spark plan (100 simultaneous connections, 10 GB/month download) covers roughly 3,000
  player-hours a month.
- **Later upgrade (phase 3):** use Firebase as signalling to open a WebRTC DataChannel for 30 Hz
  peer-to-peer state. If the peer-to-peer link fails, fall back to the relay silently.

## Data layout

```
rooms/{CODE}/
  meta:    { seed, terrain, host, createdAt, phase0, version }   // written once, by the host
  players/{uid}: { name, paint, joinedAt }                        // removed on disconnect
  state/{uid}:   "t,x,y,z,heading,pitch,roll,speed,steer,flags"    // ~10 Hz, one short string
  broken/{id}:   true                                              // phase 2: shared knocked-down objects
```

- **Room codes:** 6 characters from an unambiguous alphabet (no 0/O/1/I), about 700 million
  combinations. If a code is already taken, generate a new one.
- **Identity:** Firebase Anonymous Auth. It's a one-time switch in the Firebase console, and it
  gives each player a `uid` that the security rules check.
- **Cleanup:**
  - `onDisconnect().remove()` deletes a player's `players/` and `state/` entries when they leave.
  - The host's disconnect removes the whole room.
  - Clients ignore rooms older than 12 hours.
- **Security rules** (outline, added next to the existing `pageViews` rule):
  - Anyone signed in can read a room.
  - Only the host writes `meta`, and only when the room is created.
  - A player writes only their own `players/{uid}` and `state/{uid}`.
  - `state` must be a string under 200 characters.
  - A room holds at most 4 players.
  - `broken/{id}` is write-once and must be `true`.

## Keeping both worlds identical

- **Road and scenery:** the world is already fully determined by `seed` + `terrain`. Road,
  trees, buildings and lamps all come out identical from the same seed, so none of it needs
  syncing.
- **Time of day:** `phase = phase0 + (serverNow − createdAt) / DAY_LENGTH`. This uses Firebase's
  `serverTimeOffset`, so everyone sees the same sun.
- **Knocked-down objects (phase 2):** when a player breaks something, they write
  `broken/{id} = true`. Everyone else calls `world.breakObstacle(o, defaultHit)` for it. The
  debris physics stays local, since it's cosmetic.
- **Graphics settings:** stay per player. Each player keeps their own tier; a low-end laptop
  can join a high-end one.

## Other players' cars

- **Model:** each friend's car uses the existing `createCar(paint)`, with their chosen paint and
  a name tag above it.
- **Smooth motion:** snapshots are shown about 120 ms in the past and interpolated between.
  - If a packet is late, the car is extrapolated from its speed and yaw rate for up to 500 ms.
  - After that, it fades out until updates resume.
  - Brake lights and reversing lights come through the `flags` field.
- **No collisions in v1:** cars pass through each other ("ghost"), so two clients can never
  disagree about a crash. Phase 2 could add a soft one-sided push against the friend's
  position.
- **HUD:** a small marker per friend, e.g. "Rahul · 240 m ahead".
- **Regroup button:** puts you in the lane next to your friend. The road is endless, so
  players drift apart.
- **Sound (phase 2):** the friend's engine through a positional audio node, driven by their
  rpm and speed.

## Menu

- **Start screen:** turn the current "press enter to drive" card into a clear main menu:
  - `▶ drive` (single player, the default, still Enter)
  - `⇄ multiplayer` (secondary)
- **Multiplayer panel:**
  - `[ create room ]`: shows the code large, `copy invite link`, "waiting for a friend…", and
    you can start driving right away.
  - `[ join ]` with a code field: shows clear errors for "room not found", "room full" and
    "host left".
  - Your name (optional; defaults to a random one like `driver-4821`) and your paint.
- **Pause menu:** a "multiplayer" section with the room code, the players and their ping,
  invite link, regroup, and leave room.
- **Invite links:** `/drive?room=K7RW3P` opens the join screen directly.

## Code layout

| File | Role |
|---|---|
| `src/game/net/room.js` | anonymous sign-in, create / join / leave, presence, state publish and subscribe, server clock |
| `src/game/net/protocol.js` | room codes, packing and unpacking state strings, protocol version |
| `src/game/net/remoteCars.js` | friends' car models, snapshot buffer, interpolation and extrapolation, name tags |
| `src/game/engine.js` | `onLocalState` hook (10 Hz), remote car updates each frame, synced time of day, `regroup()` |
| `src/pages/DrivePage.jsx` | start menu, multiplayer panel, pause-menu section, `?room=` links |
| `database.rules.json` | the security rules above (paste into the console or deploy with the Firebase CLI) |

## Phases

1. **Phase 1 (MVP):**
   - rooms: create, join, leave
   - presence
   - same seed, terrain and time of day
   - friends' cars with smooth motion, names and paints
   - HUD distance markers, regroup, invite links
   - ghost cars
   - 2–4 players
2. **Phase 2:** shared knocked-down objects, friends' engine sounds, soft car contact, a horn
   and quick emotes.
3. **Phase 3:** WebRTC peer-to-peer upgrade (30 Hz, lower latency), with Firebase kept as
   signalling and fallback.

## Testing

- Add to `npm run test:drive`: two browser contexts, one host and one guest, run against the
  local Firebase emulator (`firebase emulators:start --only database,auth`), so tests never
  touch the live database.
- Checks:
  - the guest joins by code and by link
  - both get the same seed, terrain and time of day
  - the guest's car appears for the host within 1 s and moves smoothly
  - leaving cleans up the room
  - a full room refuses a 5th player
  - single player never loads `firebase/database`

## Decisions needed before building

1. Players per room: 2, or up to 4 (recommended; it costs nothing extra)?
2. Car contact between players in v1: ghost (recommended) or a soft push?
3. Player names: ask for one, or auto-generate (`driver-4821`) with an optional rename?
4. Turn on **Anonymous** sign-in in the Firebase console (Authentication → Sign-in method).
   This one step needs the project owner.
