/**
 * Procedural low-poly coupe: extruded side profile, glass cabin, spinning and
 * steering wheels, head/tail lights and a night-time headlight beam.
 * The model faces +z with its wheels touching y = 0.
 */
import * as THREE from 'three';

export const PAINTS = [
  { id: 'coral', label: 'sunset coral', hex: 0xff6b5e },
  { id: 'mint', label: 'terminal mint', hex: 0x3dd9a8 },
  { id: 'sun', label: 'sunflower', hex: 0xffc145 },
  { id: 'sky', label: 'sky blue', hex: 0x5aa9ff },
  { id: 'night', label: 'midnight', hex: 0x2f3a6b },
  { id: 'cream', label: 'cream', hex: 0xf2e8cf },
];

const WHEEL_RADIUS = 0.36;

function extrudeProfile(points, width, bevel) {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
  });
  // shape x → car length (z), extrusion → car width (x), centred
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(width / 2, 0, 0);
  geometry.computeVertexNormals();
  return geometry;
}

/** Soft round contact shadow drawn under the car (works with shadows off). */
function contactShadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(0,0,0,0.55)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

export function createCar(paintHex) {
  const disposables = [];
  const keep = (x) => {
    disposables.push(x);
    return x;
  };

  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const paint = keep(new THREE.MeshStandardMaterial({ color: paintHex, roughness: 0.42, metalness: 0.15, flatShading: true }));
  const glass = keep(new THREE.MeshStandardMaterial({ color: 0x1b2330, roughness: 0.15, metalness: 0.5, flatShading: true }));
  const trim = keep(new THREE.MeshLambertMaterial({ color: 0x2a2c31 }));
  const tyre = keep(new THREE.MeshLambertMaterial({ color: 0x1c1d20, flatShading: true }));
  const rim = keep(new THREE.MeshLambertMaterial({ color: 0xc9ced6, flatShading: true }));
  const headMat = keep(new THREE.MeshBasicMaterial({ color: 0xfff1cf }));
  const tailMat = keep(new THREE.MeshBasicMaterial({ color: 0x7a1414 }));

  const lower = new THREE.Mesh(keep(extrudeProfile(
    [[-2.1, 0.3], [2.05, 0.3], [2.15, 0.55], [2.05, 0.74], [0.8, 0.86], [-1.7, 0.9], [-2.1, 0.82], [-2.15, 0.5]],
    1.7, 0.06
  )), paint);
  const cabin = new THREE.Mesh(keep(extrudeProfile([[0.8, 0.86], [0.12, 1.3], [-1.0, 1.32], [-1.62, 0.9]], 1.44, 0.04)), glass);
  const roof = new THREE.Mesh(keep(new THREE.BoxGeometry(1.38, 0.06, 1.02)), paint);
  roof.position.set(0, 1.34, -0.44);
  const frontBumper = new THREE.Mesh(keep(new THREE.BoxGeometry(1.84, 0.16, 0.18)), trim);
  frontBumper.position.set(0, 0.36, 2.14);
  const rearBumper = frontBumper.clone();
  rearBumper.position.z = -2.16;
  for (const mesh of [lower, cabin, roof, frontBumper, rearBumper]) {
    mesh.castShadow = true;
    body.add(mesh);
  }

  const lightGeometry = keep(new THREE.BoxGeometry(0.36, 0.13, 0.08));
  for (const side of [-1, 1]) {
    const head = new THREE.Mesh(lightGeometry, headMat);
    head.position.set(side * 0.6, 0.64, 2.13);
    const tail = new THREE.Mesh(lightGeometry, tailMat);
    tail.position.set(side * 0.62, 0.7, -2.17);
    body.add(head, tail);
  }

  // wheels: pivot (steering) → spinner (rolling) → tyre + rim
  const tyreGeometry = keep(new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.26, 14).rotateZ(Math.PI / 2));
  const rimGeometry = keep(new THREE.CylinderGeometry(0.2, 0.2, 0.275, 7).rotateZ(Math.PI / 2));
  const wheels = [];
  for (const [x, z, front] of [[-0.86, 1.32, true], [0.86, 1.32, true], [-0.86, -1.3, false], [0.86, -1.3, false]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, WHEEL_RADIUS, z);
    const spinner = new THREE.Group();
    const t = new THREE.Mesh(tyreGeometry, tyre);
    t.castShadow = true;
    spinner.add(t, new THREE.Mesh(rimGeometry, rim));
    pivot.add(spinner);
    group.add(pivot);
    wheels.push({ pivot, spinner, front });
  }

  const shadowTexture = keep(contactShadowTexture());
  const shadowMat = keep(new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }));
  const contactShadow = new THREE.Mesh(keep(new THREE.PlaneGeometry(2.6, 5.2).rotateX(-Math.PI / 2)), shadowMat);
  contactShadow.position.y = 0.04;
  contactShadow.renderOrder = 1;
  group.add(contactShadow);

  const beam = new THREE.SpotLight(0xfff0d0, 0, 70, 0.55, 0.7, 1.4);
  beam.position.set(0, 0.8, 2.0);
  beam.target.position.set(0, -0.4, 14);
  group.add(beam, beam.target);

  let spin = 0;

  return {
    group,
    body,
    setPaint(hex) {
      paint.color.setHex(hex);
    },
    /** steerAngle: rad (+ = right) · speed: m/s forward · brake: 0–1 · night: 0–1 */
    update(dt, { steerAngle, speed, brake, night }) {
      spin += (speed / WHEEL_RADIUS) * dt;
      for (const w of wheels) {
        w.spinner.rotation.x = spin;
        if (w.front) w.pivot.rotation.y = -steerAngle;
      }
      beam.intensity = night * 45;
      headMat.color.setRGB(1, 0.93 + night * 0.3, 0.78 + night * 0.4);
      const tail = 0.35 + night * 0.5 + brake * 1.4;
      tailMat.color.setRGB(tail, tail * 0.08, tail * 0.08);
    },
    dispose() {
      beam.dispose();
      disposables.forEach(d => d.dispose());
    },
  };
}
