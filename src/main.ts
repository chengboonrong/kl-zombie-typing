import * as THREE from 'three';
import { scene, buildLevel, solids } from './level';
import { camera, player, game, resetPlayer, updatePlayer } from './player';
import { zombies, spawnZombie, updateZombies, clearZombies, MAX_ZOMBIES } from './zombies';
import { gunScene, gunCam, updatePistol } from './pistol';
import { feel, updateFx } from './fx';
import { initAudio, sfx } from './audio';

const DEBUG = new URLSearchParams(location.search).has('debug');

const renderer = new THREE.WebGLRenderer();
renderer.autoClear = false;
const canvas = renderer.domElement;
document.body.prepend(canvas);

scene.add(camera);
buildLevel();

// --- halftone post-process: scene -> render target -> full-screen quad ---
const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: { tDiffuse: { value: rt.texture } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec3 c = pow(clamp(texture2D(tDiffuse, vUv).rgb, 0.0, 1.0), vec3(0.4545)); // linear -> display
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      vec2 p = mat2(0.7071, -0.7071, 0.7071, 0.7071) * gl_FragCoord.xy / 7.0;    // 45-degree dot grid
      float d = length(fract(p) - 0.5);
      float r = 0.48 * (1.0 - l);                                                // darker tone, bigger dot
      c *= 1.0 - 0.3 * (1.0 - smoothstep(r - 0.12, r, d));
      gl_FragColor = vec4(c, 1.0);
    }`,
  depthTest: false,
  depthWrite: false,
}));
quad.frustumCulled = false;
const postScene = new THREE.Scene();
postScene.add(quad);
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

function resize() {
  // Cap rows regardless of display density.
  const pr = Math.min(devicePixelRatio, 1080 / innerHeight);
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight);
  rt.setSize(Math.round(innerWidth * pr), Math.round(innerHeight * pr));
  camera.aspect = gunCam.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  gunCam.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// --- HUD and screens ---
const $ = (id: string) => document.getElementById(id)!;
const overlay = $('overlay'), logo = $('logo'), title = $('title'), body = $('body'), dbg = $('debug');
const waveEl = $('wave'), hpEl = $('hp'), hpBar = $('hp-bar');
const hurtEl = $('hurt'), bannerEl = $('banner'), hpPanel = $('p-hp');
dbg.hidden = !DEBUG;
if (DEBUG) (window as unknown as { dbg: object }).dbg = { player, game, zombies, solids, camera };

const shown = new Map<HTMLElement, string>();
function put(el: HTMLElement, text: string) {
  if (shown.get(el) !== text) { shown.set(el, text); el.textContent = text; }
}

// HUD classes and styles are written only when they change.
let hpScale = '';
function updateHud() {
  hpPanel.classList.toggle('low', player.hp <= 30);
  const sx = `scaleX(${player.hp / 100})`;
  if (sx !== hpScale) { hpScale = sx; hpBar.style.transform = sx; }
}

function banner(text: string) {
  bannerEl.textContent = text;
  bannerEl.classList.remove('show');
  void bannerEl.offsetWidth; // restart the CSS animation
  bannerEl.classList.add('show');
}

function showScreen() {
  const s = game.state;
  overlay.style.display = s === 'play' ? 'none' : 'flex';
  logo.hidden = s !== 'title';
  title.hidden = s === 'title';
  if (s === 'title') body.innerHTML = 'ENTER OR CLICK TO START';
  if (s === 'pause') { title.innerHTML = 'PAUSED'; body.innerHTML = 'ENTER OR CLICK TO RESUME'; }
  if (s === 'over') {
    title.innerHTML = 'GAME OVER!';
    body.innerHTML = `WAVES SURVIVED: ${Math.max(0, game.wave - 1)}<br>ENTER OR CLICK TO PLAY AGAIN`;
  }
}

// --- waves ---
let toSpawn = 0, spawnT = 0, breakT = 0;

function newGame() {
  resetPlayer();
  clearZombies();
  game.wave = 0;
  feel.stop = feel.shake = 0;
  toSpawn = 0;
  breakT = 2;
}

function updateWaves(dt: number) {
  if (breakT > 0) {
    breakT -= dt;
    if (breakT <= 0) {
      game.wave++;
      toSpawn = 4 + game.wave * 3;                                    // wave size
      spawnT = 0;
      banner(`WAVE ${game.wave}!`);
      sfx.wave();
    }
  } else if (toSpawn > 0) {
    spawnT -= dt;
    if (spawnT <= 0 && zombies.length < MAX_ZOMBIES) {
      spawnZombie(
        Math.random() < Math.min(0.6, (game.wave - 1) * 0.1),         // runner share
        1 + (game.wave - 1) * 0.07,                                   // speed multiplier
      );
      toSpawn--;
      spawnT = Math.max(0.4, 1.6 - game.wave * 0.15);                 // spawn interval
    }
  } else if (zombies.length === 0) {
    breakT = 8;
    banner('WAVE CLEARED!');
  }
}

// --- start and pause ---
let clickGuard = 0;
function start() {
  if (game.state === 'play' || performance.now() < clickGuard) return;
  initAudio();
  if (game.state !== 'pause') newGame();
  game.state = 'play';
  showScreen();
}
function pause() {
  if (game.state !== 'play') return;
  game.state = 'pause';
  showScreen();
}
overlay.addEventListener('click', start);
addEventListener('keydown', e => {
  if (e.code === 'Enter') start();
  if (e.code === 'Escape') pause();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
addEventListener('blur', pause);

if (DEBUG) addEventListener('keydown', e => {
  if (e.code === 'Backquote') dbg.hidden = !dbg.hidden;
  if (e.code === 'KeyZ') for (let i = 0; i < 30; i++) spawnZombie(i % 3 === 0); // fills to the cap of 30
});

resetPlayer();
updatePlayer(0, null);
showScreen();

let last = performance.now(), frames = 0, fpsT = 0, fps = 0;

function frame(now: number) {
  requestAnimationFrame(frame);
  const raw = (now - last) / 1000;
  last = now;
  const dt = Math.min(raw, 0.05);

  if (game.state === 'play') {
    if (feel.stop > 0) {
      feel.stop -= raw; // hit stop: hold the world on the impact frame
    } else {
      updatePlayer(dt, null);
      updatePistol(dt);
      updateZombies(dt);
      updateWaves(dt);
      updateFx(dt); // last: applies shake on top of the camera pose
      if (player.hp <= 0) {
        game.state = 'over';
        clickGuard = performance.now() + 800; // don't restart on a panicked click
        sfx.over();
        showScreen();
      }
    }
  }

  put(waveEl, String(game.wave));
  put(hpEl, String(player.hp));
  updateHud();
  const hurtO = (player.hurtT / 0.3).toFixed(2);
  if (hurtEl.style.opacity !== hurtO) hurtEl.style.opacity = hurtO;

  if (DEBUG) {
    frames++;
    fpsT += raw;
    if (fpsT >= 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
    put(dbg, `fps ${fps} | zombies ${zombies.length} | wave ${game.wave}`);
  }

  renderer.setRenderTarget(rt);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.clearDepth();
  renderer.render(gunScene, gunCam);
  renderer.setRenderTarget(null);
  renderer.render(postScene, postCam);
}
requestAnimationFrame(frame);
