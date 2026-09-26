# Zen Drive — multiplayer

Up to 4 drivers on the same endless road. One player creates a room and shares a 6-character
code or an invite link (`/drive?room=K7RW3P`); friends type their name and join. There's no game
server: rooms live in the Firebase Realtime Database the site already uses for its visitor
counter. Single player stays the main mode, `▶ drive solo` on the start screen.

## One-time setup: publish the database rules

The database has to be told it may store rooms. Until the rules are published, "create room"
shows *"the database refused the room (are the multiplayer rules published?)"*.

1. Open <https://console.firebase.google.com> and pick the project **akash-portfolio-eb550**.
2. In the left menu: **Build → Realtime Database**, then the **Rules** tab.
3. Look at what's there now. The site itself only uses `pageViews`; if the current rules
   mention anything else, keep that part.
4. Replace the editor's contents with the file **`database.rules.json`** from the project root,
   then press **Publish**.

The rules keep the visitor counter working (it can only go up), and they make rooms safe:

- room codes can't be listed
- a room is at most 4 seats
- only the creator's first write sets up a room (road, landscape, clock)
- names are 1–16 characters and car states are short strings
- nothing else can be written

(With the Firebase CLI logged in, `npx firebase-tools@13 deploy --only database` does the same
thing. `firebase.json` points at the rules file.)

## How it works

- **Same world:**
  - The road and everything beside it come from the seed, so only `seed` + `terrain` are shared.
  - The time of day is derived from the room's creation time on the server clock, so everyone
    sees the same sun.
- **Seats:**
  - `rooms/{CODE}/players/0–3`. Joining claims a free seat, and the database lets only one of two
    racing joiners have it.
  - Seats remove themselves when a player disconnects (`onDisconnect`).
  - The creator's disconnect closes the room.
- **Cars:**
  - Each game publishes its car to `state/{seat}` 10 times a second (once a second while
    paused), as one short string.
  - Friends' cars are projected forward from the last update (speed + yaw rate), then eased
    toward that estimate. Names float above them.
  - A HUD badge shows the room code and each friend's distance along the road.
- **Bumping** (the room creator can switch it to ghost cars at any time):
  - Each game moves only its own car.
  - For every pair of cars the lower seat referees: it resolves the contact, takes half of an
    equal-mass impulse and sends the other car its half through `hits/{seat}`.
  - So a shunt from behind shoves the car in front, and nobody gets thrown.
- **Shared scenery:** a knocked-down lamp, tree or post is written to `broken/{id}`, and it falls
  in everyone's world.
- **Drive with friends:** puts you 10 m behind the nearest friend, in the other lane, at their
  speed. The road is generated up to them if they're far ahead. Joiners are brought to their
  friends automatically.
- **Cost:** about 1 KB/s per driver. Firebase's free plan covers roughly 3,000 driver-hours a
  month. The multiplayer code is a 6 KB chunk loaded only on create or join.

## Code

| File | Role |
|---|---|
| `src/game/net/protocol.js` | room codes, names, packed car state, hit messages |
| `src/game/net/room.js` | `RoomSession`: create / join / leave, seats, presence, events, server clock |
| `src/game/net/remoteCars.js` | friends' cars: prediction, smoothing, name tags, collision bodies |
| `src/game/vehicle.js` | `collideCars` / `applyPush` (car-to-car contact), `launch` |
| `src/game/engine.js` | `attachRoom`, `netTick`, `regroup`, `applyRemoteBreak`, room stats for the HUD |
| `src/pages/DrivePage.jsx` | start menu, multiplayer panel, HUD badge, pause-menu section, `?room=` links |
| `database.rules.json`, `firebase.json` | security rules; emulator / deploy config |

## Testing (never touches the live database)

```
npx firebase-tools@13 emulators:start --only database --project demo-zen-drive
npm run build && npm run preview
ONLY=multiplayer npm run test:drive
```

firebase-tools 14+ needs Java 21; version 13 runs on Java 11+.

The check runs 5 browsers against the emulator:

- 4 drivers see each other on the same road and clock, and a 5th is refused
- a shunt from behind shoves the car in front
- the ghost toggle reaches everyone
- a shared lamp falls for a friend
- regrouping works from 190 m away
- leaving and closing clean up the database

Opening `/drive?emulator=9000` on localhost points a normal session at the emulator too.

## Later

- Friends' engine sounds (positional audio from their rpm).
- A horn / quick emotes.
- Optional WebRTC peer-to-peer upgrade for 30 Hz updates, with Firebase kept as signalling
  and fallback.
