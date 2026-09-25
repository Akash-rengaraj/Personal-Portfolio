/**
 * The world: height function shared by rendering and physics, plus chunk
 * streaming. Terrain/scenery chunks live on a grid around the car; road
 * chunks follow the road. New meshes are built from a queue under a per-frame
 * time budget so driving never stutters, and far chunks are disposed.
 */
import * as THREE from 'three';
import { createNoise2D, smoothstep } from './noise';
import { mulberry32, hashInts } from './rng';
import { Road, ROAD, buildRoadChunk } from './road';
import { buildTerrainGeometry, CHUNK } from './terrain';
import { buildSceneryGeometry } from './scenery';
import { biomeAt } from './biomes';

const OBSTACLE_CELL = 16;
const obstacleKey = (cx, cz) => (cx + 100000) * 200000 + (cz + 100000);

export class World {
  constructor({ scene, seed, quality }) {
    this.scene = scene;
    this.seed = seed;
    this.quality = quality;
    this.heightNoise = createNoise2D(mulberry32(hashInts(seed, 1)));
    this.detailNoise = createNoise2D(mulberry32(hashInts(seed, 2)));
    const roadNoise = createNoise2D(mulberry32(hashInts(seed, 3)));
    this.road = new Road({ seed, noise: roadNoise, rawHeight: (x, z) => this.rawHeight(x, z) });

    this.materials = {
      ground: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
      scenery: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
      road: new THREE.MeshLambertMaterial({ vertexColors: true }),
      bulb: new THREE.MeshBasicMaterial({ color: 0x4a4a4a }),
    };

    this.terrain = new Map();   // "cx,cz" → { terrain, scenery, obstacleKeys }
    this.roads = new Map();     // chunk index → { surface, bulbs, obstacleKeys }
    this.obstacles = new Map(); // obstacle cell → [{ x, z, r, owner }]
    this.queue = [];
    this.queued = new Set();
    this.lastRoadDist = Infinity;
    this.query = {};
    this.carRoad = {};
    this.carRoadValid = false;
  }

  /* ─── heights ─────────────────────────────────────────── */

  /** Natural rolling hills, before the road carves its way through. */
  rawHeight(x, z) {
    const n = this.heightNoise;
    return 30 * n(x * 0.0019, z * 0.0019)
      + 9 * n(x * 0.0085 + 13, z * 0.0085)
      + 1.8 * n(x * 0.04, z * 0.04 + 7);
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
    if (physics && d < ROAD.SHOULDER) return q.y;
    const h = q.y + (raw - q.y) * smoothstep(11, 46, d);
    // tuck the ground just under the road ribbon so they never z-fight
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
    return biomeAt(this.road.along(x, z));
  }

  /* ─── obstacles ───────────────────────────────────────── */

  addObstacles(list, owner) {
    const keys = new Set();
    for (const o of list) {
      const key = obstacleKey(Math.floor(o.x / OBSTACLE_CELL), Math.floor(o.z / OBSTACLE_CELL));
      o.owner = owner;
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
      const kept = bucket.filter(o => o.owner !== owner);
      if (kept.length) this.obstacles.set(key, kept);
      else this.obstacles.delete(key);
    }
  }

  /** Calls `visit(obstacle)` for every obstacle within ~16 m of (x, z). */
  forEachObstacleNear(x, z, visit) {
    const cx = Math.floor(x / OBSTACLE_CELL);
    const cz = Math.floor(z / OBSTACLE_CELL);
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gz = cz - 1; gz <= cz + 1; gz++) {
        const bucket = this.obstacles.get(obstacleKey(gx, gz));
        if (bucket) for (const o of bucket) visit(o);
      }
    }
  }

  /* ─── streaming ───────────────────────────────────────── */

  get radius() {
    return this.quality.chunkRadius;
  }

  /** How far the world is drawn — drives fog and camera far plane. */
  get viewDistance() {
    return (this.radius + 0.5) * CHUNK;
  }

  /** Adds a build task, keeping the queue ordered nearest-first. */
  enqueue(task) {
    if (this.queued.has(task.id)) return;
    this.queued.add(task.id);
    const at = this.queue.findIndex(t => t.dist > task.dist);
    if (at < 0) this.queue.push(task);
    else this.queue.splice(at, 0, task);
  }

  /** Decides which chunks should exist around (x, z) and queues/disposes accordingly. */
  plan(x, z) {
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
      if (t.kind === 'road') return wanted.has(t.c) || (this.queued.delete(t.id) && false);
      t.dist = Math.hypot(t.cx - ccx, t.cz - ccz) + (t.kind === 'scenery' ? 0.5 : 0);
      return t.dist <= r + 1.5 || (this.queued.delete(t.id) && false);
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
      else if (task.kind === 'scenery') this.buildScenery(task);
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

  buildTerrain({ key, cx, cz, dist }) {
    if (this.terrain.has(key)) return;
    const mesh = new THREE.Mesh(buildTerrainGeometry(this, cx, cz), this.materials.ground);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    this.scene.add(mesh);
    this.terrain.set(key, { cx, cz, terrain: mesh, scenery: null, obstacleKeys: new Set() });
    this.enqueue({ id: `s${key}`, kind: 'scenery', key, cx, cz, dist: dist + 0.5 });
  }

  buildScenery({ key, cx, cz }) {
    const chunk = this.terrain.get(key);
    if (!chunk || chunk.scenery) return;
    const { geometry, obstacles } = buildSceneryGeometry(this, cx, cz, this.quality.sceneryDensity);
    if (geometry) {
      const mesh = new THREE.Mesh(geometry, this.materials.scenery);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      this.scene.add(mesh);
      chunk.scenery = mesh;
    } else {
      chunk.scenery = true;
    }
    chunk.obstacleKeys = this.addObstacles(obstacles, key);
  }

  buildRoad(c) {
    if (this.roads.has(c)) return;
    const { surface, bulbs, obstacles } = buildRoadChunk(this.road, c);
    const surfaceMesh = new THREE.Mesh(surface, this.materials.road);
    surfaceMesh.receiveShadow = true;
    surfaceMesh.castShadow = true;
    surfaceMesh.matrixAutoUpdate = false;
    const bulbMesh = new THREE.Mesh(bulbs, this.materials.bulb);
    bulbMesh.matrixAutoUpdate = false;
    this.scene.add(surfaceMesh, bulbMesh);
    const owner = `road${c}`;
    this.roads.set(c, { surface: surfaceMesh, bulbs: bulbMesh, obstacleKeys: this.addObstacles(obstacles, owner), owner });
  }

  disposeMesh(mesh) {
    if (!mesh || mesh === true) return;
    this.scene.remove(mesh);
    mesh.geometry.dispose();
  }

  disposeTerrain(key) {
    const chunk = this.terrain.get(key);
    this.disposeMesh(chunk.terrain);
    this.disposeMesh(chunk.scenery);
    this.removeObstacles(chunk.obstacleKeys, key);
    this.terrain.delete(key);
  }

  disposeRoad(c) {
    const chunk = this.roads.get(c);
    this.disposeMesh(chunk.surface);
    this.disposeMesh(chunk.bulbs);
    this.removeObstacles(chunk.obstacleKeys, chunk.owner);
    this.roads.delete(c);
  }

  /** Drops scenery so it is rebuilt at the current density (after a quality change). */
  rebuildScenery() {
    for (const [key, chunk] of this.terrain) {
      this.disposeMesh(chunk.scenery);
      this.removeObstacles(chunk.obstacleKeys, key);
      chunk.scenery = null;
      chunk.obstacleKeys = new Set();
      this.enqueue({ id: `s${key}`, kind: 'scenery', key, cx: chunk.cx, cz: chunk.cz, dist: 1 });
    }
  }

  /** Night lighting for street lamps. */
  setNight(night) {
    this.materials.bulb.color.setRGB(0.3 + night * 1.7, 0.3 + night * 1.45, 0.28 + night * 0.9);
  }

  dispose() {
    for (const key of [...this.terrain.keys()]) this.disposeTerrain(key);
    for (const c of [...this.roads.keys()]) this.disposeRoad(c);
    Object.values(this.materials).forEach(m => m.dispose());
    this.queue = [];
    this.queued.clear();
  }
}
