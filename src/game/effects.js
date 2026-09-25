/**
 * Ambient particles around the camera: drifting snow in the snowy biome and
 * fireflies after dark. Positions wrap inside a box that follows the camera,
 * so a few hundred points look endless.
 */
import * as THREE from 'three';

const BOX = 70;
const HALF = BOX / 2;
const wrap = (v, center) => center - HALF + ((((v - center + HALF) % BOX) + BOX) % BOX);

function makePoints(count, material) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i++) positions[i] = (Math.random() - 0.5) * BOX;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

/** Soft round sprite so points read as flakes and glows instead of squares. */
function roundSprite() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(canvas);
}

export class Effects {
  constructor(scene, { reducedMotion }) {
    this.scene = scene;
    this.reducedMotion = reducedMotion;
    this.sprite = roundSprite();
    this.snowMaterial = new THREE.PointsMaterial({
      color: 0xffffff, size: 0.15, map: this.sprite, transparent: true, opacity: 0, depthWrite: false,
    });
    this.fireflyMaterial = new THREE.PointsMaterial({
      color: 0xffd65c, size: 0.32, map: this.sprite, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false,
    });
    this.snow = makePoints(700, this.snowMaterial);
    this.fireflies = makePoints(160, this.fireflyMaterial);
    this.phases = Float32Array.from({ length: 160 }, () => Math.random() * Math.PI * 2);
    this.time = 0;
    scene.add(this.snow, this.fireflies);
  }

  /** `snowAmount` and `fireflyAmount` are 0–1 blends from biome and time of day. */
  update(dt, center, ground, snowAmount, fireflyAmount) {
    this.time += dt;
    this.snowMaterial.opacity = snowAmount * 0.85;
    this.fireflyMaterial.opacity = fireflyAmount * (0.75 + 0.25 * Math.sin(this.time * 3));
    this.snow.visible = snowAmount > 0.01;
    this.fireflies.visible = fireflyAmount > 0.01;
    const motion = this.reducedMotion ? 0.3 : 1;

    if (this.snow.visible) {
      const p = this.snow.geometry.attributes.position;
      const a = p.array;
      for (let i = 0; i < a.length; i += 3) {
        a[i] = wrap(a[i] + Math.sin(this.time * 0.6 + i) * 0.3 * dt * motion, center.x);
        a[i + 1] = wrap(a[i + 1] - 2.2 * dt * motion, center.y + 10);
        a[i + 2] = wrap(a[i + 2], center.z);
      }
      p.needsUpdate = true;
    }

    if (this.fireflies.visible) {
      const p = this.fireflies.geometry.attributes.position;
      const a = p.array;
      for (let i = 0, k = 0; i < a.length; i += 3, k++) {
        const ph = this.phases[k];
        a[i] = wrap(a[i] + Math.sin(this.time * 0.7 + ph) * 0.9 * dt * motion, ground.x);
        a[i + 1] = ground.y + 0.4 + (Math.sin(this.time * 0.5 + ph * 3) + 1) * 1.8;
        a[i + 2] = wrap(a[i + 2] + Math.cos(this.time * 0.6 + ph) * 0.9 * dt * motion, ground.z);
      }
      p.needsUpdate = true;
    }
  }

  dispose() {
    this.scene.remove(this.snow, this.fireflies);
    this.snow.geometry.dispose();
    this.fireflies.geometry.dispose();
    this.snowMaterial.dispose();
    this.fireflyMaterial.dispose();
    this.sprite.dispose();
  }
}
