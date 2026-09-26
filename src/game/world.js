/**
 * The world: height function shared by rendering and physics, plus chunk
 * streaming. Terrain chunks live on a grid around the car, each with four
 * scenery tiles built at a near (detailed) or far (lighter) level of detail;
 * road chunks follow the road. New meshes are built from a queue under a
 * per-frame time budget so driving never stutters, and far chunks are disposed.
 *
 * Breakable objects (trees, lamps, posts, poles…) are cut out of the merged
 * chunk meshes when the car knocks them down and handed to the debris
 * simulation; their ids go into `broken` so they stay down when rebuilt.
 */
import * as THREE from 'three';
import { createNoise2D, smoothstep } from './noise';
import { mulberry32, hashInts } from './rng';
import { Road, ROAD, buildRoadChunk } from './road';
import { buildTerrainGeometry, CHUNK } from './terrain';
import { buildSceneryGeometry, TILE } from './scenery';
import { chunkFeatures, rotorGeometry } from './buildings';
import { biomeAt, blendValue } from './biomes';
import { noiseTexture, glowTexture } from './geo';
import { Debris } from './debris';

const OBSTACLE_CELL = 16;
const obstacleKey = (cx, cz) => (cx + 100000) * 200000 + (cz + 100000);
const MAX_ROTORS = 48;
const ROTOR_SPEED = 1.5; // rad/s

const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const tmpPos = new THREE.Vector3();
const ONE = new THREE.Vector3(1, 1, 1);

/** Distance from (x, z) to the nearest point of scenery tile q of chunk (cx, cz). */
function tileDistance(cx, cz, q, x, z) {
  const x0 = cx * CHUNK + (q % 2) * TILE;
  const z0 = cz * CHUNK + Math.floor(q / 2) * TILE;
  const dx = Math.max(x0 - x, 0, x - (x0 + TILE));
  const dz = Math.max(z0 - z, 0, z - (z0 + TILE));
  return Math.hypot(dx, dz);
}

/** Copies vertex range [start, end) of a mesh into standalone arrays (for debris). */
function extractRange(mesh, [start, end]) {
  const geometry = mesh.geometry;
  const slice = (name, size) => geometry.getAttribute(name).array.slice(start * size, end * size);
  return { positions: slice('position', 3), normals: slice('normal', 3), colors: slice('color', 3), material: mesh.material };
}

/** Collapses vertex range [start, end) of a mesh to a point, so it no longer draws. */
function collapseRange(mesh, [start, end]) {
  if (end <= start) return;
  const attribute = mesh.geometry.getAttribute('position');
  const a = attribute.array;
  const x = a[start * 3];
  const y = a[start * 3 + 1];
  const z = a[start * 3 + 2];
  for (let i = start + 1; i < end; i++) {
    a[i * 3] = x;
    a[i * 3 + 1] = y;
    a[i * 3 + 2] = z;
  }
  attribute.addUpdateRange(start * 3, (end - start) * 3);
  attribute.needsUpdate = true;
}

export class World {
  constructor({ scene, seed, quality, terrain = 'mixed' }) {
    this.scene = scene;
    this.seed = seed;
    this.quality = quality;
    this.biomeLock = terrain;
    this.heightNoise = createNoise2D(mulberry32(hashInts(seed, 1)));
    this.detailNoise = createNoise2D(mulberry32(hashInts(seed, 2)));
    const roadNoise = createNoise2D(mulberry32(hashInts(seed, 3)));
    this.road = new Road({ seed, noise: roadNoise, rawHeight: (x, z) => this.rawHeight(x, z) });
    this.windYaw = mulberry32(hashInts(seed, 77))() * Math.PI * 2;

    this.textures = {
      ground: noiseTexture({ size: 128, base: 232, spread: 46, blobs: 18, seed: seed + 5 }),
      asphalt: noiseTexture({ size: 256, base: 222, spread: 70, blobs: 40, seed: seed + 9 }),
      glow: glowTexture(128, 0.3),
    };
    this.materials = {
      ground: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, map: this.textures.ground }),
      scenery: new THREE.MeshLambertMaterial({ vertexColors: true }),
      road: new THREE.MeshLambertMaterial({ vertexColors: true, map: this.textures.asphalt }),
      props: new THREE.MeshLambertMaterial({ vertexColors: true }),
      bulb: new THREE.MeshBasicMaterial({ color: 0x4a4a4a }),
      windows: new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x2a3440 }),
      studs: new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x8c8c8c }),
      pools: new THREE.MeshBasicMaterial({
        map: this.textures.glow,
        color: 0xffc98a,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
      rotor: new THREE.MeshLambertMaterial({ color: 0xf1f3f5 }),
    };
    this.materials.pools.visible = false;

    this.terrain = new Map();   // "cx,cz" → { cx, cz, terrain, tiles: [tile ×4] }
    this.roads = new Map();     // chunk index → { surface, props, bulbs, pools, studs, meshes, obstacleKeys, owner }
    this.obstacles = new Map(); // obstacle cell → [{ x, z, r, owner, home, … }]
    this.byId = new Map();      // breakable id → obstacle (to find a pole's neighbour, etc.)
    this.features = new Map();  // "cx,cz" → buildings / turbines (memoised: neighbours need them too)
    this.broken = new Set();    // ids of objects knocked down this drive
    this.events = [];           // crash events for sound / camera ({ material, strength, kind })
    this.queue = [];
    this.queued = new Map();    // task id → task
    this.lastRoadDist = Infinity;
    this.query = {};
    this.carRoad = {};
    this.carRoadValid = false;
    this.carX = 0;
    this.carZ = 0;

    this.rotors = new THREE.InstancedMesh(rotorGeometry(), this.materials.rotor, MAX_ROTORS);
    this.rotors.count = 0;
    this.rotors.frustumCulled = false;
    this.rotors.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rotorList = [];
    this.rotorsDirty = false;
    this.rotorAngle = 0;
    scene.add(this.rotors);

    this.debris = new Debris(scene, this);
  }

  /* ─── heights ─────────────────────────────────────────── */

  /**
   * Rolling hills with ridgelines, before the road carves its way through. The ridge uses a
   * smooth |x| so ridge tops are rounded crests rather than knife edges (which acted as launch
   * ramps), and the small-scale bumps are long and low enough to drive over at speed.
   */
  rawHeight(x, z) {
    const n = this.heightNoise;
    const r = n(x * 0.0011 + 31, z * 0.0011 - 17);
    const ridge = 1 - Math.sqrt(r * r + 0.012);
    return 28 * n(x * 0.0019, z * 0.0019)
      + 26 * ridge * ridge * ridge
      + 6.5 * n(x * 0.0062 + 13, z * 0.0062)
      + 0.9 * n(x * 0.028, z * 0.028 + 7)
      - 10;
  }

  /** Height blended toward the road: flat under it, easing back to hills over ~45 m. */
  blendedHeight(x, z, physics) {
    const raw = this.rawHeight(x, z);
    const q = this.road.nearest(x, z, 48, this.query);
    if (!q) {
      this.lastRoadDist = Infinity;
      return raw;
    }
    const d = q.dist;
    this.lastRoadDist = d;
    const h = q.y + (raw - q.y) * smoothstep(11, 46, d);
    // physics gets the smooth surface: no step where the shoulder meets the grass
    if (physics) return h;
    // tuck the visible ground just under the road ribbon so they never z-fight
    return h - 0.35 * (1 - smoothstep(6.2, 8.5, d));
  }

  /** Ground height for the physics (road surface exactly on the road). */
  groundHeight(x, z) {
    return this.blendedHeight(x, z, true);
  }

  /** Ground height for terrain meshes and scenery placement. */
  visualHeight(x, z) {
    return this.blendedHeight(x, z, false);
  }

  /** Surface type at the last `groundHeight` query. */
  surfaceAt() {
    const d = this.lastRoadDist;
    if (d < ROAD.HALF_WIDTH) return 'road';
    if (d < ROAD.SHOULDER) return 'gravel';
    return 'grass';
  }

  biomeAt(x, z) {
    return biomeAt(this.road.along(x, z), this.biomeLock);
  }

  /** Tyre grip multiplier for a surface at (x, z): snow roads are slippery, sand is loose. */
  gripAt(x, z, surface) {
    const blend = this.biomeAt(x, z);
    if (surface === 'road') return blendValue(blend, 'roadGrip');
    if (surface === 'gravel') return 0.82 * blendValue(blend, 'roadGrip');
    return blendValue(blend, 'offroadGrip');
  }

  /** Buildings and wind turbines of terrain chunk (cx, cz), computed once per drive. */
  featuresFor(cx, cz) {
    const key = `${cx},${cz}`;
    let f = this.features.get(key);
    if (!f) {
      f = chunkFeatures(this, cx, cz);
      this.features.set(key, f);
    }
    return f;
  }

  /* ─── obstacles ───────────────────────────────────────── */

  /** Registers obstacles under `owner`; `home` holds the meshes their vertex ranges point into. */
  addObstacles(list, owner, home) {
    const keys = new Set();
    for (const o of list) {
      const key = obstacleKey(Math.floor(o.x / OBSTACLE_CELL), Math.floor(o.z / OBSTACLE_CELL));
      o.owner = owner;
      o.home = home;
      if (o.id) this.byId.set(o.id, o);
      const bucket = this.obstacles.get(key);
      if (bucket) bucket.push(o);
      else this.obstacles.set(key, [o]);
      keys.add(key);
    }
    return keys;
  }

  removeObstacles(keys, owner) {
    for (const key of keys) {
      const bucket = this.obstacles.get(key);
      if (!bucket) continue;
      const kept = [];
      for (const o of bucket) {
        if (o.owner !== owner) kept.push(o);
        else if (o.id && this.byId.get(o.id) === o) this.byId.delete(o.id);
      }
      if (kept.length) this.obstacles.set(key, kept);
      else this.obstacles.delete(key);
    }
  }

  /** Calls `visit(obstacle)` for every standing obstacle within ~16 m of (x, z). */
  forEachObstacleNear(x, z, visit) {
    const cx = Math.floor(x / OBSTACLE_CELL);
    const cz = Math.floor(z / OBSTACLE_CELL);
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gz = cz - 1; gz <= cz + 1; gz++) {
        const bucket = this.obstacles.get(obstacleKey(gx, gz));
        if (!bucket) continue;
        for (const o of bucket) if (!o.broken) visit(o);
      }
    }
  }

  /**
   * Knocks a breakable obstacle down: its triangles are cut out of the chunk meshes into a
   * debris body (lamp heads and pools of light go with it), wires to a felled pole drop,
   * and the id is remembered so rebuilt chunks leave it out. `hit` describes the impact:
   * { x, y, z, vx, vz, nx, nz, impact, carInverseMass }, with n pointing from the object to
   * the car. `remote` marks a break reported by another player (not sent back to the room).
   * Returns the impulse (N·s) the car takes along n.
   */
  breakObstacle(o, hit, remote = false) {
    const fallback = hit.impact / (hit.carInverseMass + 1 / Math.min(o.mass * (o.rooted ? 1.3 : 1), 600));
    if (o.broken || !o.pieces) return 0;
    o.broken = true;
    this.broken.add(o.id);
    const parts = [];
    for (const piece of o.pieces) {
      const mesh = o.home?.meshes[piece.target];
      if (!mesh || mesh === true) continue;
      if (!piece.hideOnly) parts.push(extractRange(mesh, piece.range));
      collapseRange(mesh, piece.range);
    }
    // power lines: the span leaving this pole and the one arriving from the previous pole
    const spans = [o];
    if (o.prevPole) {
      const prev = this.byId.get(o.prevPole);
      if (prev) spans.push(prev);
    }
    for (const pole of spans) {
      const mesh = pole.spanOut && pole.home?.meshes[pole.spanOut.target];
      if (mesh && mesh !== true) collapseRange(mesh, pole.spanOut.range);
      pole.spanOut = null;
    }
    const impulse = parts.length ? this.debris.spawn(parts, o, hit) : fallback;
    this.events.push({
      kind: 'break', id: o.id, remote, material: o.material, strength: Math.min(1, hit.impact / 25 + Math.min(o.mass, 900) / 1500),
    });
    return impulse;
  }

  /* ─── streaming ───────────────────────────────────────── */

  get radius() {
    return this.quality.chunkRadius;
  }

  /** How far the world is drawn — drives fog and camera far plane. */
  get viewDistance() {
    return (this.radius + 0.5) * CHUNK;
  }

  /** Adds a build task (or updates the pending one), keeping the queue ordered nearest-first. */
  enqueue(task) {
    const pending = this.queued.get(task.id);
    if (pending) {
      Object.assign(pending, task);
      return;
    }
    this.queued.set(task.id, task);
    const at = this.queue.findIndex(t => t.dist > task.dist);
    if (at < 0) this.queue.push(task);
    else this.queue.splice(at, 0, task);
  }

  /**
   * Level of detail scenery tile q of a chunk should have: full detail inside the tier's
   * `nearLod` [in, out] distances (with hysteresis around `current`); low keeps the light one.
   */
  tileLod(cx, cz, q, current) {
    const range = this.quality.nearLod;
    if (!range) return 'far';
    const d = tileDistance(cx, cz, q, this.carX, this.carZ);
    return d < (current === 'near' ? range[1] : range[0]) ? 'near' : 'far';
  }

  /** Queues scenery tile builds for a chunk whose tiles are missing or at the wrong detail. */
  planTiles(key, chunk) {
    for (let q = 0; q < 4; q++) {
      const tile = chunk.tiles[q];
      const lod = this.tileLod(chunk.cx, chunk.cz, q, tile?.lod);
      if (tile && tile.lod === lod) {
        const stale = this.queued.get(`s${key}:${q}`);
        if (stale && !stale.force) this.dropTask(stale);
        continue;
      }
      const d = tileDistance(chunk.cx, chunk.cz, q, this.carX, this.carZ) / CHUNK;
      this.enqueue({ id: `s${key}:${q}`, kind: 'scenery', key, cx: chunk.cx, cz: chunk.cz, q, lod, dist: d + 0.5 });
    }
  }

  dropTask(task) {
    this.queued.delete(task.id);
    const at = this.queue.indexOf(task);
    if (at >= 0) this.queue.splice(at, 1);
  }

  /** Decides which chunks should exist around (x, z) and queues/disposes accordingly. */
  plan(x, z) {
    this.carX = x;
    this.carZ = z;
    const q = this.road.nearest(x, z, 900, this.carRoad);
    this.carRoadValid = Boolean(q);
    if (q) this.road.ensureAhead(q.index);

    const ccx = Math.floor(x / CHUNK);
    const ccz = Math.floor(z / CHUNK);
    const r = this.radius;

    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const cx = ccx + dx;
        const cz = ccz + dz;
        const key = `${cx},${cz}`;
        if (!this.terrain.has(key)) this.enqueue({ id: `t${key}`, kind: 'terrain', key, cx, cz, dist: Math.hypot(dx, dz) });
      }
    }
    for (const [key, chunk] of this.terrain) {
      if (Math.abs(chunk.cx - ccx) > r + 1 || Math.abs(chunk.cz - ccz) > r + 1) this.disposeTerrain(key);
      else this.planTiles(key, chunk);
    }
    for (const key of this.features.keys()) {
      const [fx, fz] = key.split(',').map(Number);
      if (Math.abs(fx - ccx) > r + 3 || Math.abs(fz - ccz) > r + 3) this.features.delete(key);
    }

    const reach = this.viewDistance + 120;
    const wanted = new Set();
    if (q) {
      const center = Math.floor(q.index / ROAD.CHUNK_SAMPLES);
      const span = Math.ceil(reach / (ROAD.SEG * ROAD.CHUNK_SAMPLES)) + 1;
      for (let c = Math.max(0, center - span); c <= center + span; c++) {
        const mid = Math.min(c * ROAD.CHUNK_SAMPLES + Math.floor(ROAD.CHUNK_SAMPLES / 2), this.road.length - 1);
        if (Math.hypot(this.road.x[mid] - x, this.road.z[mid] - z) < reach) wanted.add(c);
      }
    }
    for (const c of wanted) {
      if (!this.roads.has(c)) this.enqueue({ id: `r${c}`, kind: 'road', c, dist: 0 });
    }
    for (const c of this.roads.keys()) if (!wanted.has(c)) this.disposeRoad(c);

    // re-rank pending work around the car's new position and drop what fell out of range
    this.queue = this.queue.filter(t => {
      let keep;
      if (t.kind === 'road') keep = wanted.has(t.c);
      else if (t.kind === 'terrain') {
        t.dist = Math.hypot(t.cx - ccx, t.cz - ccz);
        keep = t.dist <= r + 1.5;
      } else {
        t.dist = tileDistance(t.cx, t.cz, t.q, x, z) / CHUNK + 0.5;
        keep = this.terrain.has(t.key);
      }
      if (!keep) this.queued.delete(t.id);
      return keep;
    });
    this.queue.sort((a, b) => a.dist - b.dist);
  }

  /** Runs queued builds until `budgetMs` is used (at least one per call). */
  process(budgetMs) {
    const start = performance.now();
    do {
      const task = this.queue.shift();
      if (!task) return;
      this.queued.delete(task.id);
      if (task.kind === 'terrain') this.buildTerrain(task);
      else if (task.kind === 'scenery') this.buildTile(task);
      else this.buildRoad(task.c);
    } while (performance.now() - start < budgetMs);
  }

  /**
   * Builds just the car's own chunk, its direct neighbours and the road before
   * the first frame; everything further out streams in behind the intro screen.
   */
  warmup(x, z) {
    this.plan(x, z);
    while (this.queue.length && this.queue[0].dist <= 1) this.process(0);
  }

  buildTerrain({ key, cx, cz, rebuild }) {
    const existing = this.terrain.get(key);
    if (existing && !rebuild) return;
    const geometry = buildTerrainGeometry(this, cx, cz, this.quality.terrainGrid);
    if (existing) {
      // new mesh resolution: swap the geometry in place, so the ground never disappears
      existing.terrain.geometry.dispose();
      existing.terrain.geometry = geometry;
      return;
    }
    const mesh = new THREE.Mesh(geometry, this.materials.ground);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    this.scene.add(mesh);
    const chunk = { cx, cz, terrain: mesh, tiles: [null, null, null, null] };
    this.terrain.set(key, chunk);
    this.planTiles(key, chunk);
  }

  /**
   * Builds one scenery tile (or rebuilds it at a new level of detail or density — `force`),
   * swapping it in whole: the old one stays up until the new one is ready.
   */
  buildTile({ key, cx, cz, q, lod, force }) {
    const chunk = this.terrain.get(key);
    if (!chunk) return;
    const old = chunk.tiles[q];
    if (old && old.lod === lod && !force) return;
    const { geometry, glow, obstacles, rotors } = buildSceneryGeometry(this, cx, cz, q, this.quality.sceneryDensity, lod);
    const owner = `${key}:${q}`;
    if (old) this.disposeTile(old);
    const tile = { lod, owner, mesh: null, glow: null, rotors, meshes: {}, obstacleKeys: null };
    if (geometry) {
      tile.mesh = this.addMesh(geometry, this.materials.scenery, true);
      tile.meshes.main = tile.mesh;
    }
    if (glow) tile.glow = this.addMesh(glow, this.materials.windows, false);
    tile.obstacleKeys = this.addObstacles(obstacles, owner, tile);
    chunk.tiles[q] = tile;
    if (rotors.length || old?.rotors.length) this.rotorsDirty = true;
  }

  addMesh(geometry, material, shadows) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    mesh.matrixAutoUpdate = false;
    this.scene.add(mesh);
    return mesh;
  }

  buildRoad(c) {
    if (this.roads.has(c)) return;
    const built = buildRoadChunk(this.road, c, this.broken);
    const chunk = { surface: this.addMesh(built.surface, this.materials.road, false), meshes: {}, owner: `road${c}` };
    chunk.surface.receiveShadow = true;
    chunk.props = built.props && this.addMesh(built.props, this.materials.props, true);
    chunk.bulbs = built.bulbs && this.addMesh(built.bulbs, this.materials.bulb, false);
    chunk.pools = built.pools && this.addMesh(built.pools, this.materials.pools, false);
    chunk.studs = built.studs && this.addMesh(built.studs, this.materials.studs, false);
    Object.assign(chunk.meshes, { props: chunk.props, bulbs: chunk.bulbs, pools: chunk.pools });
    chunk.obstacleKeys = this.addObstacles(built.obstacles, chunk.owner, chunk);
    this.roads.set(c, chunk);
  }

  disposeMesh(mesh) {
    if (!mesh || mesh === true) return;
    this.scene.remove(mesh);
    mesh.geometry.dispose();
  }

  disposeTile(tile) {
    this.disposeMesh(tile.mesh);
    this.disposeMesh(tile.glow);
    this.removeObstacles(tile.obstacleKeys, tile.owner);
    if (tile.rotors.length) this.rotorsDirty = true;
  }

  disposeTerrain(key) {
    const chunk = this.terrain.get(key);
    this.disposeMesh(chunk.terrain);
    for (const tile of chunk.tiles) if (tile) this.disposeTile(tile);
    this.terrain.delete(key);
  }

  disposeRoad(c) {
    const chunk = this.roads.get(c);
    for (const mesh of [chunk.surface, chunk.props, chunk.bulbs, chunk.pools, chunk.studs]) this.disposeMesh(mesh);
    this.removeObstacles(chunk.obstacleKeys, chunk.owner);
    this.roads.delete(c);
  }

  /** Rebuilds every terrain chunk at the current mesh resolution, nearest first, in place. */
  rebuildTerrain() {
    const ccx = Math.floor(this.carX / CHUNK);
    const ccz = Math.floor(this.carZ / CHUNK);
    for (const [key, chunk] of this.terrain) {
      this.enqueue({ id: `t${key}`, kind: 'terrain', key, cx: chunk.cx, cz: chunk.cz, dist: Math.hypot(chunk.cx - ccx, chunk.cz - ccz), rebuild: true });
    }
  }

  /** Rebuilds all scenery at the current density / detail (after a quality change), in place. */
  rebuildScenery() {
    for (const [key, chunk] of this.terrain) {
      chunk.tiles.forEach((tile, q) => {
        const lod = this.tileLod(chunk.cx, chunk.cz, q, tile?.lod);
        const dist = tileDistance(chunk.cx, chunk.cz, q, this.carX, this.carZ) / CHUNK + 0.5;
        this.enqueue({ id: `s${key}:${q}`, kind: 'scenery', key, cx: chunk.cx, cz: chunk.cz, q, lod, dist, force: true });
      });
    }
  }

  /** Collects the turbine rotors of all built tiles into the instanced mesh. */
  gatherRotors() {
    this.rotorsDirty = false;
    this.rotorList = [];
    for (const chunk of this.terrain.values()) {
      for (const tile of chunk.tiles) {
        if (!tile) continue;
        for (const r of tile.rotors) if (this.rotorList.length < MAX_ROTORS) this.rotorList.push(r);
      }
    }
    this.rotors.count = this.rotorList.length;
  }

  /**
   * Per-frame world animation: turbine rotors, and the debris simulation (knocked-down
   * objects tumbling, the car shoving them). Crash sounds are queued in `events`.
   */
  update(dt, vehicle) {
    if (this.rotorsDirty) this.gatherRotors();
    this.rotorAngle = (this.rotorAngle + dt * ROTOR_SPEED) % (Math.PI * 2);
    this.rotorList.forEach((r, k) => {
      tmpEuler.set(0, r.yaw, this.rotorAngle + k * 0.7);
      tmpQuat.setFromEuler(tmpEuler);
      tmpMatrix.compose(tmpPos.set(r.x, r.y, r.z), tmpQuat, ONE);
      this.rotors.setMatrixAt(k, tmpMatrix);
    });
    if (this.rotorList.length) this.rotors.instanceMatrix.needsUpdate = true;
    this.debris.update(dt, vehicle);
  }

  /** Night lighting: street lamps and their pools of light, lit windows, glowing road studs. */
  setNight(night) {
    this.materials.bulb.color.setRGB(0.3 + night * 1.7, 0.3 + night * 1.45, 0.28 + night * 0.9);
    this.materials.windows.color.setRGB(0.17 + night * 1.35, 0.2 + night * 0.8, 0.25 + night * 0.15);
    this.materials.studs.color.setScalar(0.55 + night * 1.6);
    this.materials.pools.opacity = Math.min(1, night * 1.2) * 0.62;
    this.materials.pools.visible = night > 0.04;
  }

  dispose() {
    for (const key of [...this.terrain.keys()]) this.disposeTerrain(key);
    for (const c of [...this.roads.keys()]) this.disposeRoad(c);
    this.debris.dispose();
    this.scene.remove(this.rotors);
    this.rotors.geometry.dispose();
    this.rotors.dispose();
    Object.values(this.materials).forEach(m => m.dispose());
    Object.values(this.textures).forEach(t => t.dispose());
    this.queue = [];
    this.queued.clear();
  }
}
