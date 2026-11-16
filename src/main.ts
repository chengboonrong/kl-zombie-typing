import * as THREE from 'three';
import { scene, buildLevel, solids } from './level';
import { camera, player, game, resetPlayer, updatePlayer, STALL } from './player';
import { zombies, spawnZombie, updateZombies, clearZombies, setTyped, flinch, cure, shakeLabel, MAX_ZOMBIES } from './zombies';
import { gunScene, gunCam, updatePistol, squirt } from './pistol';
import { feel, updateFx, pop, hitStop, shake } from './fx';
import { initAudio, sfx } from './audio';
import { keyChar, typeKey, newStats, wpm, accuracy, type Stats } from './typing';
import { LEVELS, pickWord, type Lang } from './words';
import { wordList } from './wordlists';
import { waveSize, spawnInterval, runnerShare, walkTime } from './pace';
import { t, LEVEL_NAMES } from './strings';

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
const waveEl = $('wave'), curedEl = $('cured'), wpmEl = $('wpm'), hpEl = $('hp'), hpBar = $('hp-bar');
const waveLabel = $('wave-label'), curedLabel = $('cured-label'), wpmLabel = $('wpm-label');
const hurtEl = $('hurt'), bannerEl = $('banner'), hpPanel = $('p-hp');
dbg.hidden = !DEBUG;
if (DEBUG) {
  (window as unknown as { dbg: object }).dbg = {
    player, game, zombies, solids, camera,
    get lock() { return lock; },
    get stats() { return stats; },
    get lang() { return lang; },
    get levelIndex() { return levelIndex; },
  };
}

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

// --- language and level (remembered between visits) ---
function load<T>(key: string, ok: (v: string) => T | null, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    const r = v === null ? null : ok(v);
    return r === null ? fallback : r;
  } catch { return fallback; }
}
function save(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* storage blocked: choice just isn't remembered */ }
}
let lang: Lang = load<Lang>('lang', v => (v === 'en' || v === 'bm' ? v : null), 'en');
let levelIndex = load('level', v => (/^\d+$/.test(v) && +v < LEVELS.length ? +v : null), 0);

function applyLang() {
  document.documentElement.lang = lang === 'bm' ? 'ms' : 'en';
  put(waveLabel, t(lang, 'hudWave'));
  put(curedLabel, t(lang, 'hudCured'));
  put(wpmLabel, t(lang, 'hudWpm'));
}
function setLang(l: Lang) {
  lang = l;
  save('lang', l);
  applyLang();
  showScreen();
}
function setLevel(i: number) {
  levelIndex = Math.max(0, Math.min(LEVELS.length - 1, i));
  save('level', String(levelIndex));
  showScreen();
}

const esc = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

function showScreen() {
  const s = game.state;
  overlay.style.display = s === 'play' ? 'none' : 'flex';
  overlay.style.cursor = s === 'nokeyboard' ? 'default' : 'pointer';
  logo.hidden = s !== 'title' && s !== 'nokeyboard';
  title.hidden = s === 'title' || s === 'nokeyboard';
  if (s === 'nokeyboard') {
    body.innerHTML = `${t('bm', 'keyboard')}<br>${t('en', 'keyboard')}`;
  } else if (s === 'title') {
    body.innerHTML = `<span class="badge">TAIP!</span><br>
      <span class="arrow" data-act="lang-prev">&#9664;</span>
      <span class="pill${lang === 'en' ? ' on' : ''}" data-act="en">English</span>
      <span class="pill${lang === 'bm' ? ' on' : ''}" data-act="bm">Bahasa Melayu</span>
      <span class="arrow" data-act="lang-next">&#9654;</span><br>
      <span class="arrow" data-act="level-up">&#9650;</span>${LEVEL_NAMES[lang][levelIndex]}<span class="arrow" data-act="level-down">&#9660;</span><br>
      ${t(lang, 'choose')}<br>${t(lang, 'how')}<br>${t(lang, 'start')}`;
  } else if (s === 'pause') {
    title.textContent = t(lang, 'paused');
    body.textContent = t(lang, 'resume');
  } else if (s === 'over') {
    title.textContent = t(lang, 'over');
    const missed = [...stats.missed].slice(0, 12).map(esc).join(', ');
    body.innerHTML = `${t(lang, 'wpm')}: ${wpm(stats)}<br>${t(lang, 'accuracy')}: ${accuracy(stats)}%<br>
      ${t(lang, 'cured')}: ${stats.cured}<br>${t(lang, 'waves')}: ${Math.max(0, game.wave - 1)}<br>
      ${missed ? `${t(lang, 'practise')}:<div class="missed">${missed}</div>` : ''}${t(lang, 'again')}`;
  }
}

// --- waves and typing ---
let list: string[] = [];
let avgLen = 0;
let lock: number | null = null;
let stats: Stats = newStats();
let used = new Set<string>();
let toSpawn = 0, spawnT = 0, breakT = 0;

function newGame() {
  resetPlayer();
  clearZombies();
  game.wave = 0;
  feel.stop = feel.shake = 0;
  toSpawn = 0;
  breakT = 2;
  list = wordList(lang, LEVELS[levelIndex]);
  avgLen = list.reduce((n, w) => n + w.length, 0) / list.length;
  lock = null;
  stats = newStats();
  used = new Set();
}

function spawnOne(runner: boolean) {
  const word = pickWord(list, used, new Set(zombies.map(z => z.word[0])), runner);
  spawnZombie(word, runner, walkTime(word.length, levelIndex, game.wave, runner));
}

function updateWaves(dt: number) {
  if (breakT > 0) {
    breakT -= dt;
    if (breakT <= 0) {
      game.wave++;
      toSpawn = waveSize(game.wave);
      spawnT = 0;
      banner(t(lang, 'waveStart', game.wave));
      sfx.wave();
    }
  } else if (toSpawn > 0) {
    spawnT -= dt;
    if (spawnT <= 0 && zombies.length < MAX_ZOMBIES) {
      spawnOne(Math.random() < runnerShare(game.wave));
      toSpawn--;
      spawnT = spawnInterval(avgLen, levelIndex, game.wave);
    }
  } else if (zombies.length === 0) {
    breakT = 8;
    player.hp = Math.min(100, player.hp + 25);
    banner(t(lang, 'waveClear'));
  }
}

const head = new THREE.Vector3();
const headOf = (z: { g: THREE.Group }) => head.set(z.g.position.x, 1.75, z.g.position.z);

function onKey(e: KeyboardEvent) {
  // swallow ' and / (Firefox quick-find), Tab and Backspace too, not just letters
  if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key.length === 1 || e.key === 'Tab' || e.key === 'Backspace')) e.preventDefault();
  const ch = keyChar(e);
  if (!ch) return;
  if (zombies.length === 0) return;
  const targets = zombies.map(z => ({
    id: z.id, word: z.word, typed: z.typed,
    dist: Math.hypot(z.g.position.x - STALL.x, z.g.position.z - STALL.z),
  }));
  const r = typeKey(targets, lock, ch);
  lock = r.lock;
  stats.keys++;
  const k = r.result;
  if (k.kind === 'miss') {
    sfx.miss();
    const z = zombies.find(z => z.id === k.id);
    if (z) { shakeLabel(z); stats.missed.add(z.word); } else shake(0.01);
    return;
  }
  const z = zombies.find(z => z.id === k.id)!;
  stats.correct++;
  z.typed++;
  setTyped(z, z.typed, lock === z.id);
  squirt(headOf(z));
  flinch(z);
  sfx.squirt();
  if (k.kind === 'done') {
    cure(z);
    stats.cured++;
    pop(t(lang, 'splash'), '#4cc9f0', headOf(z), 1.6);
    sfx.cure();
    hitStop(0.05);
  }
}

// --- start and pause ---
let clickGuard = 0;
function start() {
  if (game.state === 'play' || game.state === 'nokeyboard' || performance.now() < clickGuard) return;
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
const ACTIONS: Record<string, () => void> = {
  en: () => setLang('en'),
  bm: () => setLang('bm'),
  'lang-prev': () => setLang('en'),
  'lang-next': () => setLang('bm'),
  'level-up': () => setLevel(levelIndex - 1),
  'level-down': () => setLevel(levelIndex + 1),
};
overlay.addEventListener('click', e => {
  const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
  if (act && game.state === 'title') ACTIONS[act]();
  else start();
});
addEventListener('keydown', e => {
  if (game.state === 'nokeyboard') return;
  if (game.state === 'title') {
    const act = ({ ArrowLeft: 'lang-prev', ArrowRight: 'lang-next', ArrowUp: 'level-up', ArrowDown: 'level-down' } as Record<string, string>)[e.code];
    if (act) { e.preventDefault(); ACTIONS[act](); return; }
  }
  if (e.key === 'Enter') start();
  if (e.code === 'Escape') {
    if (game.state === 'over' && performance.now() >= clickGuard) { game.state = 'title'; showScreen(); }
    else pause();
  } else if (game.state === 'play') onKey(e);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
addEventListener('blur', pause);

if (DEBUG) addEventListener('keydown', e => {
  if (e.code === 'Backquote') dbg.hidden = !dbg.hidden;
  if (e.code === 'Digit0' && game.state === 'play') for (let i = 0; zombies.length < MAX_ZOMBIES; i++) spawnOne(i % 3 === 0); // fills to the cap
});

resetPlayer();
updatePlayer(0, null);
if (matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches) game.state = 'nokeyboard';
applyLang();
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
      const locked = zombies.find(z => z.id === lock);
      updatePlayer(dt, locked ? headOf(locked) : null);
      updatePistol(dt);
      if (zombies.length > 0) stats.activeMs += dt * 1000;
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
  put(curedEl, String(stats.cured));
  put(wpmEl, String(wpm(stats)));
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
