/**
 * Sky dome, sun/moon lighting, stars, a distant mountain ring and the slow
 * day/night cycle. Everything here follows the camera so it feels infinitely far.
 */
import * as THREE from 'three';
import { createNoise2D, smoothstep } from './noise';
import { mulberry32, hashInts } from './rng';

export const DAY_LENGTH = 480; // seconds for a full day
const DAY_PORTION = 0.72;

/* Lighting keyframes by sun elevation (degrees) */
const STOPS = [
  { e: -14, top: 0x050a1a, horizon: 0x18223d, sun: 0x9fb3ff, sunI: 0.35, hemiSky: 0x3a4870, hemiGround: 0x0e1018, hemiI: 0.6 },
  { e: -4, top: 0x252a5c, horizon: 0xe07a6a, sun: 0xff8a66, sunI: 0.45, hemiSky: 0xb58aa8, hemiGround: 0x3a3040, hemiI: 0.75 },
  { e: 6, top: 0x4f78c0, horizon: 0xffbe86, sun: 0xffb070, sunI: 1.9, hemiSky: 0xffd6ae, hemiGround: 0x6a5a48, hemiI: 0.95 },
  { e: 28, top: 0x3d8ad6, horizon: 0xcfe5f2, sun: 0xfff3dc, sunI: 2.5, hemiSky: 0xc4def5, hemiGround: 0x6f7a52, hemiI: 1.05 },
].map(s => ({
  ...s,
  top: new THREE.Color(s.top),
  horizon: new THREE.Color(s.horizon),
  sun: new THREE.Color(s.sun),
  hemiSky: new THREE.Color(s.hemiSky),
  hemiGround: new THREE.Color(s.hemiGround),
}));

const SKY_VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position.z = gl_Position.w; // pin to the far plane
  }
`;

const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  uniform vec3 sunColor;
  uniform vec3 sunDir;
  uniform float sunVisible;
  varying vec3 vDir;
  void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y;
    vec3 col = mix(horizonColor, topColor, pow(clamp(h, 0.0, 1.0), 0.55));
    col = mix(col, horizonColor * 0.75, smoothstep(0.0, -0.25, h));
    float d = max(dot(dir, sunDir), 0.0);
    float disc = smoothstep(0.9992, 0.9996, d);
    float glow = pow(d, 64.0) * 0.55 + pow(d, 6.0) * 0.12;
    col += sunColor * (disc * 2.5 + glow) * sunVisible;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function lerpStops(elevation, out) {
  let i = 0;
  while (i < STOPS.length - 2 && elevation > STOPS[i + 1].e) i++;
  const a = STOPS[i];
  const b = STOPS[i + 1];
  const t = smoothstep(a.e, b.e, elevation);
  out.top.lerpColors(a.top, b.top, t);
  out.horizon.lerpColors(a.horizon, b.horizon, t);
  out.sun.lerpColors(a.sun, b.sun, t);
  out.hemiSky.lerpColors(a.hemiSky, b.hemiSky, t);
  out.hemiGround.lerpColors(a.hemiGround, b.hemiGround, t);
  out.sunI = a.sunI + (b.sunI - a.sunI) * t;
  out.hemiI = a.hemiI + (b.hemiI - a.hemiI) * t;
  return out;
}

/** Sun elevation in degrees for a day phase in [0, 1). Phase 0 = sunrise. */
export function sunElevation(phase) {
  return phase < DAY_PORTION
    ? -6 + 68 * Math.sin((Math.PI * phase) / DAY_PORTION)
    : -6 - 30 * Math.sin((Math.PI * (phase - DAY_PORTION)) / (1 - DAY_PORTION));
}

/** Human label for the HUD. */
export function timeLabel(phase) {
  const e = sunElevation(phase);
  const morning = phase < DAY_PORTION / 2 || phase > 0.97;
  if (e < -12) return 'night';
  if (e < -2) return morning ? 'dawn' : 'dusk';
  if (e < 10) return morning ? 'sunrise' : 'golden hour';
  if (e > 45) return 'midday';
  return morning ? 'morning' : 'afternoon';
}

export class Sky {
  constructor(scene, seed) {
    this.scene = scene;
    this.state = {
      top: new THREE.Color(), horizon: new THREE.Color(), sun: new THREE.Color(),
      hemiSky: new THREE.Color(), hemiGround: new THREE.Color(), sunI: 1, hemiI: 1,
    };
    this.sunDir = new THREE.Vector3();
    this.lightDir = new THREE.Vector3();
    this.night = 0;

    this.domeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color() },
        horizonColor: { value: new THREE.Color() },
        sunColor: { value: new THREE.Color() },
        sunDir: { value: new THREE.Vector3(0, 1, 0) },
        sunVisible: { value: 1 },
      },
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), this.domeMaterial);
    this.dome.renderOrder = -2;
    this.dome.frustumCulled = false;

    const rand = mulberry32(hashInts(seed, 51));
    const starPositions = [];
    for (let i = 0; i < 900; i++) {
      const theta = rand() * Math.PI * 2;
      const y = 0.08 + rand() * 0.92;
      const r = Math.sqrt(1 - y * y);
      starPositions.push(Math.cos(theta) * r * 1400, y * 1400, Math.sin(theta) * r * 1400);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    this.starMaterial = new THREE.PointsMaterial({
      color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false,
    });
    this.stars = new THREE.Points(starGeometry, this.starMaterial);
    this.stars.renderOrder = -1;
    this.stars.frustumCulled = false;

    this.mountainMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide });
    this.mountains = new THREE.Mesh(buildMountainRing(seed), this.mountainMaterial);
    this.mountains.renderOrder = -1;
    this.mountains.frustumCulled = false;

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    this.sunLight = new THREE.DirectionalLight(0xffffff, 2);
    this.sunLight.shadow.mapSize.set(2048, 2048);
    const cam = this.sunLight.shadow.camera;
    cam.left = -55;
    cam.right = 55;
    cam.top = 55;
    cam.bottom = -55;
    cam.near = 1;
    cam.far = 260;
    this.sunLight.shadow.bias = -0.0006;
    this.sunLight.shadow.normalBias = 0.04;
    this.sunLight.shadow.radius = 3;

    this.fog = new THREE.Fog(0xffffff, 60, 400);
    scene.fog = this.fog;
    scene.add(this.dome, this.stars, this.mountains, this.hemi, this.sunLight, this.sunLight.target);
    this.mountainTint = new THREE.Color();
  }

  /**
   * Updates colours and lights for `phase`, centred on the car.
   * `biomeMountain` is the linear [r,g,b] tint of the current biome's hills.
   */
  update(phase, center, biomeMountain, viewDistance) {
    const elevation = sunElevation(phase);
    const s = lerpStops(elevation, this.state);
    const azimuth = phase * Math.PI * 2 + 0.6;
    const el = THREE.MathUtils.degToRad(elevation);
    this.sunDir.set(Math.cos(el) * Math.sin(azimuth), Math.sin(el), Math.cos(el) * Math.cos(azimuth)).normalize();
    this.night = 1 - smoothstep(-9, 1, elevation);

    const u = this.domeMaterial.uniforms;
    u.topColor.value.copy(s.top);
    u.horizonColor.value.copy(s.horizon);
    u.sunColor.value.copy(s.sun);
    u.sunDir.value.copy(this.sunDir);
    u.sunVisible.value = 1 - this.night;
    this.starMaterial.opacity = smoothstep(0.35, 1, this.night) * 0.9;

    // after dark the "sun" light becomes a cool moon on the opposite side
    const lightDir = this.night > 0.5
      ? this.lightDir.set(-this.sunDir.x, 0.7, -this.sunDir.z).normalize()
      : this.lightDir.copy(this.sunDir).setY(Math.max(this.sunDir.y, 0.08)).normalize();
    this.sunLight.color.copy(s.sun);
    this.sunLight.intensity = s.sunI;
    this.sunLight.position.copy(center).addScaledVector(lightDir, 120);
    this.sunLight.target.position.copy(center);
    this.hemi.color.copy(s.hemiSky);
    this.hemi.groundColor.copy(s.hemiGround);
    this.hemi.intensity = s.hemiI;

    this.fog.color.copy(s.horizon);
    this.fog.near = viewDistance * 0.18;
    this.fog.far = viewDistance * 0.95;

    this.mountainTint.setRGB(biomeMountain[0], biomeMountain[1], biomeMountain[2]);
    this.mountainMaterial.color.copy(s.horizon).lerp(this.mountainTint, 0.5).multiplyScalar(1 - this.night * 0.55);

    this.dome.position.copy(center);
    this.stars.position.copy(center);
    this.mountains.position.set(center.x, center.y - 40, center.z);
    return { night: this.night, elevation };
  }

  setShadows(enabled) {
    this.sunLight.castShadow = enabled;
  }

  dispose() {
    this.scene.remove(this.dome, this.stars, this.mountains, this.hemi, this.sunLight, this.sunLight.target);
    this.dome.geometry.dispose();
    this.domeMaterial.dispose();
    this.stars.geometry.dispose();
    this.starMaterial.dispose();
    this.mountains.geometry.dispose();
    this.mountainMaterial.dispose();
    this.sunLight.dispose();
    this.hemi.dispose();
    this.scene.fog = null;
  }
}

/** A jagged ring of far-off peaks (vertex colours shade valleys darker). */
function buildMountainRing(seed) {
  const noise = createNoise2D(mulberry32(hashInts(seed, 52)));
  const segments = 140;
  const radius = 1200;
  const positions = [];
  const colors = [];
  const peak = (i) => {
    const a = (i / segments) * Math.PI * 2;
    const h = 70 + 150 * (0.5 + 0.5 * noise(Math.cos(a) * 2.2, Math.sin(a) * 2.2)) + 40 * noise(i * 0.7, 3);
    return [Math.cos(a) * radius, Math.max(h, 30), Math.sin(a) * radius];
  };
  for (let i = 0; i < segments; i++) {
    const p0 = peak(i);
    const p1 = peak(i + 1);
    const b0 = [p0[0], -80, p0[2]];
    const b1 = [p1[0], -80, p1[2]];
    for (const [v, shade] of [[b0, 0.55], [p1, 1], [p0, 1], [b0, 0.55], [b1, 0.55], [p1, 1]]) {
      positions.push(...v);
      colors.push(shade, shade, shade * 1.02);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}
