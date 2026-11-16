import * as THREE from 'three';
import { sfx } from './audio';

export const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 200);
camera.rotation.order = 'YXZ';

// Fixed spot mid-lane, clear of stalls and viaduct pillars, with the long lane ahead (+z).
export const STALL = new THREE.Vector3(0, 0, 0);
export const BASE_YAW = Math.PI; // yaw 0 faces -z, so PI faces down the lane
export const player = { pos: STALL.clone(), yaw: BASE_YAW, pitch: 0, hp: 100, hurtT: 0 };
export const game = { state: 'title' as 'title' | 'play' | 'pause' | 'over' | 'nokeyboard', wave: 0 };

const EYE = 1.65;

export function resetPlayer() {
  player.pos.copy(STALL);
  player.yaw = BASE_YAW;
  player.pitch = player.hurtT = 0;
  player.hp = 100;
}

export function hurt(dmg: number) {
  player.hp = Math.max(0, player.hp - dmg);
  player.hurtT = 0.3;
  sfx.hurt();
}

// Eases the view toward the world point `look`, or back to the lane when null.
export function updatePlayer(dt: number, look: THREE.Vector3 | null) {
  let yaw = BASE_YAW, pitch = 0;
  if (look) {
    const dx = look.x - player.pos.x, dz = look.z - player.pos.z;
    yaw = Math.atan2(-dx, -dz);
    pitch = Math.atan2(1.7 - EYE, Math.hypot(dx, dz)) - 0.05; // slight look-down at the head
  }
  const k = 1 - Math.exp(-8 * dt);
  const diff = Math.atan2(Math.sin(yaw - player.yaw), Math.cos(yaw - player.yaw)); // shortest way round
  player.yaw += diff * k;
  player.pitch += (pitch - player.pitch) * k;
  player.hurtT = Math.max(0, player.hurtT - dt);
  camera.position.set(player.pos.x, player.pos.y + EYE, player.pos.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
}
