import * as THREE from 'three';
import { camera } from './player';
import { inked, toon } from './toon';
import { burst } from './fx';

// View model lives in its own scene, drawn after a depth clear, so it never clips into walls.
export const gunScene = new THREE.Scene();
export const gunCam = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
gunScene.add(new THREE.AmbientLight(0xffffff, 1.5));
const key = new THREE.DirectionalLight(0xffffff, 2);
key.position.set(-1, 2, 1);
gunScene.add(key);

const barrel = inked(0.06, 0.08, 0.4, toon(0x4cc9f0), 0, 0.008);
const grip = inked(0.06, 0.16, 0.08, toon(0xffd60a), 0, 0.008);
grip.position.set(0, -0.1, 0.14);
const tank = inked(0.05, 0.05, 0.14, toon(0xe63946), 0, 0.008);
tank.position.set(0, 0.07, 0.02);
const gun = new THREE.Group();
gun.add(barrel, grip, tank);
gun.position.set(0.25, -0.22, -0.5);
gunScene.add(gun);

let recoil = 0;
const muzzle = new THREE.Vector3(), dir = new THREE.Vector3();

export function squirt(at: THREE.Vector3) {
  recoil = 1;
  muzzle.set(0.25, -0.2, -0.9).applyMatrix4(camera.matrixWorld);
  dir.subVectors(at, muzzle).normalize();
  burst(muzzle, dir, 0x4cc9f0, 6, 14);
  burst(at, dir, 0xa0e7ff, 8, 5);
}

export function updatePistol(dt: number) {
  recoil *= Math.exp(-14 * dt);
  gun.position.z = -0.5 + recoil * 0.08;
  gun.rotation.x = recoil * 0.25;
}
