import * as THREE from 'three';
import { scene, collide, solids } from './level';
import { player, hurt, STALL, BASE_YAW } from './player';
import { toon, inked, canvasTex } from './toon';
import { shake } from './fx';
import { sfx } from './audio';
import { navTarget, clearLine } from './nav';
import { steer } from './steer';

export interface Zombie {
  g: THREE.Group;
  parts: THREE.Mesh[];                         // torso, head, leg L, leg R, arm L, arm R
  mats: (THREE.Material | THREE.Material[])[]; // their real materials, restored after a hit flash
  runner: boolean;
  base: number;   // resting x/z scale
  id: number;
  word: string;
  typed: number;
  label: THREE.Sprite;
  shakeT: number; // seconds of label shake left
  speed: number;
  dmg: number;
  cd: number;     // attack cooldown
  t: number;      // walk-cycle phase
  flash: number;  // seconds of white left
  squash: number; // 1 = fully squashed, decays to 0
  kx: number;     // knockback velocity
  kz: number;
  navT: number;
  target: number[];
  lastX: number;
  lastZ: number;
  step: number;
  stuckT: number;
  sideT: number;
  side: number;
  sideX: number;
  sideZ: number;
}

export const zombies: Zombie[] = [];
const curing: { z: Zombie; t: number }[] = [];
let nextId = 1;
export const MAX_ZOMBIES = 12;

const WHITE = new THREE.MeshBasicMaterial({ color: 0xffffff });

const face = (skin: string) => toon(0xffffff, canvasTex(64, 64, c => {
  c.fillStyle = skin;
  c.fillRect(0, 0, 64, 64);
  c.fillStyle = '#fff';
  c.lineWidth = 4;
  for (const x of [20, 44]) { c.beginPath(); c.arc(x, 24, 9, 0, 7); c.fill(); c.stroke(); }
  c.fillStyle = '#000';
  c.fillRect(18, 22, 5, 5);
  c.fillRect(44, 23, 5, 5);
  c.beginPath(); // jagged mouth
  c.moveTo(14, 46);
  for (let i = 1; i <= 6; i++) c.lineTo(14 + i * 6, i % 2 ? 54 : 46);
  c.stroke();
}));

const look = (skin: number, skinCss: string, shirt: number, pants: number) => {
  const s = toon(skin);
  return { skin: s, shirt: toon(shirt), pants: toon(pants), head: [s, s, s, s, face(skinCss), s] };
};
const LOOKS = [
  look(0x8bd450, '#8bd450', 0x3a6ea5, 0x4b3f72), // walker
  look(0xc9a0ff, '#c9a0ff', 0xe63946, 0x222233), // runner
];

// Spawn points on the lane ahead of STALL: all within 40 degrees of BASE_YAW and 25 m or more away.
const FRONT = [[0, 64], [-3, 56], [3, 56], [0, 34], [-26, 40], [26, 40], [-14, 40], [14, 40]].filter(([x, z]) => {
  const dx = x - STALL.x, dz = z - STALL.z;
  const a = Math.atan2(-dx, -dz) - BASE_YAW, off = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
  return Math.hypot(dx, dz) >= 25 && off <= 0.7;
});

export function spawnZombie(word: string, runner: boolean, walkTime: number) {
  const L = LOOKS[runner ? 1 : 0];
  const g = new THREE.Group();
  g.rotation.order = 'YXZ'; // so rotation.x tips it over relative to its facing
  const add = (m: THREE.Mesh, x: number, y: number) => {
    m.position.set(x, y, 0);
    g.add(m);
    return m;
  };
  const parts = [
    add(inked(0.6, 0.7, 0.35, L.shirt), 0, 1.15),
    add(inked(0.42, 0.42, 0.42, L.head), 0, 1.72),
    add(inked(0.24, 0.8, 0.26, L.pants, -0.4), -0.16, 0.8),
    add(inked(0.24, 0.8, 0.26, L.pants, -0.4), 0.16, 0.8),
    add(inked(0.18, 0.7, 0.18, L.skin, -0.35), -0.4, 1.45),
    add(inked(0.18, 0.7, 0.18, L.skin, -0.35), 0.4, 1.45),
  ];
  const base = runner ? 0.85 : 1;
  g.scale.set(base, 1, base);

  const [x, z] = FRONT[Math.floor(Math.random() * FRONT.length)];
  g.position.set(x + (Math.random() - 0.5) * 3, 0, z + (Math.random() - 0.5) * 3);
  const dist = Math.hypot(g.position.x - STALL.x, g.position.z - STALL.z);

  scene.add(g);
  const label = makeLabel(word);
  label.position.set(g.position.x, LABEL_TOP, g.position.z);
  scene.add(label);
  zombies.push({
    g, parts, mats: parts.map(m => m.material), runner, base,
    id: nextId++, word, typed: 0, label, shakeT: 0,
    speed: dist * 1.3 / walkTime,
    dmg: runner ? 8 : 10,
    cd: 0, t: Math.random() * 6,
    flash: 0, squash: 0, kx: 0, kz: 0, navT: Math.random() * 0.25, target: [g.position.x, g.position.z],
    lastX: g.position.x, lastZ: g.position.z, step: 0, stuckT: 0, sideT: 0, side: Math.random() < 0.5 ? -1 : 1, sideX: 0, sideZ: 0,
  });
}

export function clearZombies() {
  for (const z of zombies) { scene.remove(z.g); dropLabel(z); }
  for (const c of curing) scene.remove(c.z.g);
  zombies.length = 0;
  curing.length = 0;
}

// --- word labels: a canvas pill per zombie, redrawn only when its typed count or lock changes ---
const LABEL_H = 64;
function makeLabel(word: string) {
  const cv = document.createElement('canvas');
  const c = cv.getContext('2d')!;
  c.font = `700 40px ${LABEL_FONT}`;
  cv.width = Math.ceil(c.measureText(word).width) + 40;
  cv.height = LABEL_H;
  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, sizeAttenuation: false, depthTest: false, transparent: true }));
  s.scale.set(0.085 * cv.width / LABEL_H, 0.085, 1); // screen-relative: same readable size at any distance
  s.renderOrder = 1;
  drawLabel(s, word, 0, false);
  return s;
}

const LABEL_FONT = 'Verdana, Arial, sans-serif';
function drawLabel(s: THREE.Sprite, word: string, typed: number, locked: boolean) {
  const map = s.material.map!;
  const cv = map.image as HTMLCanvasElement;
  const c = cv.getContext('2d')!;
  c.clearRect(0, 0, cv.width, cv.height);
  c.fillStyle = '#000';
  c.beginPath();
  c.roundRect(0, 0, cv.width, cv.height, 24);
  c.fill();
  if (locked) {
    c.strokeStyle = '#ffd60a';
    c.lineWidth = 4;
    c.beginPath();
    c.roundRect(2, 2, cv.width - 4, cv.height - 4, 22);
    c.stroke();
  }
  c.font = `700 40px ${LABEL_FONT}`;
  c.textBaseline = 'middle';
  c.textAlign = 'left';
  const x = (cv.width - c.measureText(word).width) / 2, done = word.slice(0, typed);
  c.fillStyle = '#2a9d8f';
  c.fillText(done, x, LABEL_H / 2 + 2);
  c.fillStyle = '#fff';
  c.fillText(word.slice(typed), x + c.measureText(done).width, LABEL_H / 2 + 2);
  s.renderOrder = locked ? 2 : 1;
  map.needsUpdate = true;
}

function dropLabel(z: Zombie) {
  scene.remove(z.label);
  z.label.material.map!.dispose();
  z.label.material.dispose();
}

export function setTyped(z: Zombie, typed: number, locked: boolean) {
  drawLabel(z.label, z.word, typed, locked);
}

export function shakeLabel(z: Zombie) { z.shakeT = 0.2; }

// A correct letter: white flash, squash and a small knockback away from the player. No damage.
export function flinch(z: Zombie) {
  z.flash = 0.05;
  z.squash = 1;
  for (const m of z.parts) m.material = WHITE;
  const p = z.g.position;
  const dx = p.x - player.pos.x, dz = p.z - player.pos.z, d = Math.hypot(dx, dz) || 1;
  z.kx += dx / d * 2;
  z.kz += dz / d * 2;
}

// Cured: back to a human look, turns away and walks off while shrinking out.
const HUMAN_SKIN = 0xe0ac69;
const HUMAN_HEAD = (() => { const s = toon(HUMAN_SKIN); return [s, s, s, s, face('#e0ac69'), s]; })();
export function cure(z: Zombie) {
  zombies.splice(zombies.indexOf(z), 1);
  dropLabel(z);
  const skin = HUMAN_HEAD[0], shirt = toon(new THREE.Color().setHSL(Math.random(), 0.8, 0.55).getHex());
  const pants = toon(0x333344);
  z.mats = [shirt, HUMAN_HEAD, pants, pants, skin, skin];
  z.parts.forEach((m, i) => { m.material = z.mats[i]; });
  z.flash = 0;
  z.parts[4].rotation.x = z.parts[5].rotation.x = 0; // arms down
  const p = z.g.position;
  z.g.rotation.y = Math.atan2(p.x - player.pos.x, p.z - player.pos.z);
  curing.push({ z, t: 0 });
}

// Per-frame hit reaction, shared by the living and the cured.
function react(z: Zombie, dt: number) {
  const p = z.g.position;
  p.x += z.kx * dt;
  p.z += z.kz * dt;
  const k = Math.exp(-10 * dt);
  z.kx *= k;
  z.kz *= k;
  if (z.flash > 0) {
    z.flash -= dt;
    if (z.flash <= 0) z.parts.forEach((m, i) => { m.material = z.mats[i]; });
  }
  z.squash *= Math.exp(-14 * dt);
  const wide = z.base * (1 + 0.3 * z.squash);
  z.g.scale.set(wide, 1 - 0.2 * z.squash, wide);
}

const LABEL_TOP = 2.32; // label height over a distant zombie; lowered when close so it stays on screen

export function updateZombies(dt: number) {
  for (const z of zombies) {
    react(z, dt);
    const p = z.g.position;
    const dx = player.pos.x - p.x, dz = player.pos.z - p.z;
    const d = Math.hypot(dx, dz) || 1;

    z.navT -= dt;
    if (z.navT <= 0) { z.target = navTarget(p.x, p.z, player.pos.x, player.pos.z); z.navT += 0.25; }
    const nx = z.target[0] - p.x, nz = z.target[1] - p.z, nd = Math.hypot(nx, nz) || 1;
    z.g.rotation.y = d < 1.3 || clearLine(p.x, p.z, player.pos.x, player.pos.z) ? Math.atan2(dx, dz) : Math.atan2(nx, nz);
    z.step = 0;
    if (d > 0.9) {
      z.step = Math.min(nd, z.speed * dt);
      const sx = z.sideT > 0 && d >= 1.3 ? z.sideX : nx / nd;
      const sz = z.sideT > 0 && d >= 1.3 ? z.sideZ : nz / nd;
      p.x += sx * z.step;
      p.z += sz * z.step;
      z.t += dt * (3 + z.speed * 2);
    } else if (d < 0.7) {
      // player walked into us: get shoved back
      p.x -= (dx / d) * (0.7 - d);
      p.z -= (dz / d) * (0.7 - d);
    }

    const sw = Math.sin(z.t) * 0.6;
    z.parts[2].rotation.x = sw;
    z.parts[3].rotation.x = -sw;
    // walkers reach forward, runners pump their arms
    z.parts[4].rotation.x = z.runner ? -sw * 1.5 : -1.4 + sw * 0.2;
    z.parts[5].rotation.x = z.runner ? sw * 1.5 : -1.4 - sw * 0.2;

    z.cd -= dt;
    if (d < 1.3 && z.cd <= 0) { hurt(z.dmg); shake(0.035); z.cd = 1; }

    z.label.position.set(p.x, Math.min(LABEL_TOP, 1.65 + 0.5 * d), p.z); // eye height 1.65 in player.ts
    if (z.shakeT > 0) {
      z.shakeT = Math.max(0, z.shakeT - dt);
      z.label.center.x = 0.5 + Math.sin(z.shakeT * 70) * 0.06 * (z.shakeT / 0.2);
    }
  }

  // keep zombies from stacking
  for (let i = 0; i < zombies.length; i++) {
    for (let j = i + 1; j < zombies.length; j++) {
      const a = zombies[i].g.position, b = zombies[j].g.position;
      const dx = b.x - a.x, dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.8 && d > 1e-4) {
        const k = (0.8 - d) / 2 / d;
        a.x -= dx * k; a.z -= dz * k;
        b.x += dx * k; b.z += dz * k;
      }
    }
  }

  for (const z of zombies) {
    const p = z.g.position;
    collide(p, 0.4);
    const moved = Math.hypot(p.x - z.lastX, p.z - z.lastZ);
    const sideT = z.sideT;
    [z.stuckT, z.sideT] = steer(z.stuckT, z.sideT, moved, z.step, Math.hypot(p.x - player.pos.x, p.z - player.pos.z), dt);
    // Hold the escape direction so steering cannot curve back into the prop.
    if (z.sideT > 0 && sideT === 0) {
      const dx = z.target[0] - p.x, dz = z.target[1] - p.z, d = Math.hypot(dx, dz) || 1;
      z.sideX = -dz / d * z.side;
      z.sideZ = dx / d * z.side;
      const x = p.x + z.sideX * 1.2, zz = p.z + z.sideZ * 1.2;
      if (solids.some(b => Math.hypot(x - Math.max(b.min.x, Math.min(x, b.max.x)), zz - Math.max(b.min.z, Math.min(zz, b.max.z))) < 0.4 - 1e-6)) {
        z.sideX = -z.sideX; z.sideZ = -z.sideZ;
      }
    }
    z.lastX = p.x;
    z.lastZ = p.z;
  }

  // the cured: walk off facing away, shrinking out
  for (let i = curing.length - 1; i >= 0; i--) {
    const c = curing[i], p = c.z.g.position;
    c.t += dt;
    react(c.z, dt);
    p.x += Math.sin(c.z.g.rotation.y) * 1.6 * dt;
    p.z += Math.cos(c.z.g.rotation.y) * 1.6 * dt;
    collide(p, 0.4);
    c.z.t += dt * 6;
    c.z.parts[2].rotation.x = Math.sin(c.z.t) * 0.6;
    c.z.parts[3].rotation.x = -Math.sin(c.z.t) * 0.6;
    c.z.g.scale.multiplyScalar(Math.max(0.01, 1 - c.t / 0.8));
    if (c.t >= 0.8) {
      scene.remove(c.z.g);
      curing.splice(i, 1);
    }
  }

  if (zombies.length && Math.random() < dt * 0.4) sfx.groan();
}
