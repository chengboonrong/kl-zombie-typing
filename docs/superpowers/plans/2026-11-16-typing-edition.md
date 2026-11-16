# Pasar Malam Zombi! Taip! — Typing Edition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A copy of the KL zombie shooter where students cure zombies by typing the English or BM word above each one, picked by school level.

**Architecture:** Copy the repo, strip movement/aiming/weapons/touch/pickups, keep the 3D market, zombie AI, waves, effects and audio. New pure modules (`typing.ts`, `words.ts`, `pace.ts`, `strings.ts`) hold all testable logic with no Three.js or DOM imports; `main.ts`, `zombies.ts`, `pistol.ts` wire them into the scene.

**Tech Stack:** TypeScript 5.6, Three.js 0.170, Vite 5, `node --test` on Node 26 (native TS type stripping).

**Spec:** `docs/superpowers/specs/2026-11-16-typing-edition-design.md`

## Global Constraints

- New repo at `~/orca/workspaces/kl-zombie-typing`. The original `~/orca/workspaces/kl-zombie-shooter` must end with no changes except the two untracked doc files being moved out.
- Page title and name: **Pasar Malam Zombi! Taip!**
- Desktop keyboard only; never needs the mouse after page load. Touch-only devices get the "needs a keyboard" screen.
- No gun, no gore, no death animation. Zombies are cured, not killed.
- Words: lowercase `a–z` only, single words, one JSON array per file in `words/<lang>/<level>.json`, `lang` ∈ `en | bm`, 11 levels `darjah-1…darjah-6, tingkatan-1…tingkatan-5`.
- The interface language follows the chosen word language (`en` or `bm`) on every screen.
- Word labels use `700 …px Verdana, Arial, sans-serif`, not Impact.
- Pure modules (`typing.ts`, `words.ts`, `pace.ts`, `strings.ts`) import nothing at runtime (only `import type`), so `node --test` can load them directly.
- `npm run build` and `npm test` pass at the end of every task.
- Commit messages follow the repo style (plain sentence, imperative, no prefix) and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Nothing is pushed to GitHub or deployed without the owner's go-ahead.

## Review Focus

1. **Holding a key down** sends auto-repeat keydowns; one held key must count once, not as many misses. → `keyChar` returns `null` when `repeat` is true (Task 2 test).
2. **Caps Lock or Shift on** must still count letters as correct. → `keyChar` lowercases (Task 2 test).
3. **The locked zombie vanishes** (new game, cleared) while half-typed; the next letter must start fresh, not throw or stay stuck. → `typeKey` treats a lock missing from targets as no lock (Task 2 test).
4. **Two zombies share a first letter or the same word**; the nearest one gets the lock and only that one advances. → Task 2 test.
5. **Keys pressed outside active play** (title screen, paused, wave break, empty screen, Ctrl/Cmd shortcuts) must not count toward accuracy or move a word. → `keyChar` rejects modifier combos (Task 2 test); `main.ts` only calls `typeKey` when `game.state === 'play'` and a zombie is live (Task 6 browser check).

---

### Task 1: Copy the repo and strip it to a stationary scene (milestone 1)

**Files:**
- Create: `~/orca/workspaces/kl-zombie-typing` (clone of the original)
- Move: both untracked docs from the original into `docs/superpowers/specs/` and `docs/superpowers/plans/` of the copy
- Delete: `src/touch.ts`, `src/pickups.ts`, `src/hud.ts`, `tests/hud.test.ts`
- Rename + rewrite: `src/weapons.ts` → `src/pistol.ts`
- Modify: `src/player.ts`, `src/zombies.ts`, `src/main.ts`, `index.html`, `package.json`, `src/audio.ts`, `src/fx.ts`

**Interfaces:**
- Produces:
  - `player.ts`: `STALL: THREE.Vector3` (fixed player position), `BASE_YAW: number`, `camera`, `player` (`{ pos, yaw, pitch, hp, hurtT }`), `game` (`{ state: 'title' | 'play' | 'pause' | 'over' | 'nokeyboard', wave: number }`), `resetPlayer()`, `hurt(dmg: number)`, `updatePlayer(dt: number, look: THREE.Vector3 | null)` — eases camera yaw/pitch toward `look`, or back to `BASE_YAW` when `null`.
  - `pistol.ts`: `gunScene`, `gunCam`, `squirt(at: THREE.Vector3)`, `updatePistol(dt: number)`.
  - `zombies.ts`: `MAX_ZOMBIES = 12`; spawn points limited to a front fan (see step 4).

- [ ] **Step 1: Clone, detach, install**

```bash
git clone ~/orca/workspaces/kl-zombie-shooter ~/orca/workspaces/kl-zombie-typing
cd ~/orca/workspaces/kl-zombie-typing && git remote remove origin && npm install
mkdir -p docs/superpowers/specs docs/superpowers/plans
mv ~/orca/workspaces/kl-zombie-shooter/docs/superpowers/specs/2026-11-16-typing-edition-design.md docs/superpowers/specs/
mv ~/orca/workspaces/kl-zombie-shooter/docs/superpowers/plans/2026-11-16-typing-edition.md docs/superpowers/plans/
```
Expected: `git -C ~/orca/workspaces/kl-zombie-shooter status --short` prints nothing (only `docs/superpowers/` was untracked, now empty and removable with `rmdir -p`).

- [ ] **Step 2: Delete what typing doesn't need**

Delete `touch.ts`, `pickups.ts`, `hud.ts`, `tests/hud.test.ts`; in `index.html` delete `#touch-controls`, `#rotate`, `#crosshair`, `#p-gun`, the SVG icon symbols and all `.touch`/touch-HUD CSS; set `<title>Pasar Malam Zombi! Taip!</title>`. In `package.json` set `"name": "kl-zombie-typing"`. In `audio.ts` delete `shotgun, smg, rifle, mercun, empty, reload, pickup`.

- [ ] **Step 3: Stationary player**

`player.ts`: no WASD, jump, sprint, mouse look or `keys` set. `STALL` is a fixed point on the lane near the middle of the market (pick it in the browser: a spot by a stall, clear of solids, with the lane ahead). `updatePlayer` sets the camera at `STALL + eye height`, eases `yaw` toward `atan2` of `look` at rate `1 - exp(-8·dt)`, pitch toward a slight look-down at the target's head (`y = 1.7`), and decays `hurtT`.

- [ ] **Step 4: Front-fan spawning**

`zombies.ts`: replace the four spawn `ends` with points that are all within ±40° of `BASE_YAW` as seen from `STALL` and at least 25 m away, so every zombie walking in is on screen. Zombies path to `STALL` via the existing `navTarget`/`steer`. Delete `rayZombies`. Keep `hitZombie` for now (Task 6 replaces it).

- [ ] **Step 5: Water pistol viewmodel**

`pistol.ts`: one viewmodel from the old pistol boxes, recoloured bright plastic (barrel `0x4cc9f0`, grip `0xffd60a`, plus a small `0xe63946` tank box on top). No muzzle-flash star, no point light. `squirt(at)` kicks the recoil and calls `burst(muzzleWorldPos, dirToAt, 0x4cc9f0, 6, 14)` and `burst(at, dirToAt, 0xa0e7ff, 8, 5)`. Delete damage numbers from `fx.ts` (`damageNumber`) and `blast`.

- [ ] **Step 6: Strip `main.ts`**

No pointer lock, no touch, no weapons, no pickups. Click or Enter on the overlay starts; Esc or blur pauses. Keep the halftone pass, the wave loop (`spawnZombie(runner, speedMul)` as today) and game over at HP 0. HUD keeps only WAVE and HP panels. Zombies walk in and hurt the player; there is no way to stop them yet — that's expected for this milestone.

- [ ] **Step 7: Build, test, look**

Run: `npm run build && npm test` → both pass (nav + steer tests only).
Run `npm run dev`, open `http://localhost:5173/?debug`: title overlay appears; Enter starts; camera is fixed at the stall; zombies appear ahead and walk in; FPS shows in the debug readout; HP falls; game over appears.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "Strip the shooter to a stationary scene for the typing edition"
```

- [ ] **Step 9: OWNER CHECKPOINT — performance on a cheap laptop**

Run `npm run build && npx vite preview --host`, give the owner the LAN URL with `?debug`. Owner plays to wave 3 on their cheapest laptop/Chromebook and reports the FPS. **Stop here until they report.** If FPS < 30 steady, do Task 1b before Task 2; otherwise skip Task 1b.

### Task 1b (only if Task 1 FPS < 30): Low graphics mode

**Files:** Modify `src/main.ts`, `index.html`.

- [ ] **Step 1:** Add `const LOW = new URLSearchParams(location.search).has('low') || localStorage 'lowgfx' === '1'` (localStorage read in try/catch). When `LOW`: render target `samples: 0`, pixel budget 540 rows instead of 1080, skip the halftone pass (render straight to screen), `MAX_ZOMBIES` 8.
- [ ] **Step 2:** Owner re-tests with `?low`. Commit: `"Add a low graphics mode for school laptops"`. The title-screen toggle for it is added in Task 7.

---

### Task 2: Typing logic

**Files:**
- Create: `src/typing.ts`
- Test: `tests/typing.test.ts`

**Interfaces:**
- Produces:
```ts
export interface Target { id: number; word: string; typed: number; dist: number }
export type KeyResult =
  | { kind: 'hit'; id: number }    // correct letter, word not finished
  | { kind: 'done'; id: number }   // correct letter that finished the word
  | { kind: 'miss'; id: number | null }; // id = the locked target, if any
export function keyChar(e: { key: string; repeat: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean }): string | null;
export function typeKey(targets: Target[], lock: number | null, ch: string): { lock: number | null; result: KeyResult };
export interface Stats { correct: number; keys: number; activeMs: number; cured: number; missed: Set<string> }
export function newStats(): Stats;
export function wpm(s: Stats): number;       // Math.round((correct / 5) / (activeMs / 60000)); 0 when activeMs < 1000
export function accuracy(s: Stats): number;  // Math.round(100 * correct / keys); 100 when keys === 0
```
`typeKey` never mutates `targets`; the caller increments `typed` on `hit`/`done`.

- [ ] **Step 1: Write the failing tests** (`tests/typing.test.ts`, same style as `tests/steer.test.ts`, import from `'../src/typing.ts'`)

```ts
const t = (id: number, word: string, typed = 0, dist = 10) => ({ id, word, typed, dist });
test('keyChar accepts letters, lowercases them, rejects repeats, modifiers and non-letters', () => {
  const k = (key: string, o = {}) => keyChar({ key, repeat: false, ctrlKey: false, metaKey: false, altKey: false, ...o });
  assert.equal(k('a'), 'a');
  assert.equal(k('Q'), 'q');                       // Caps Lock / Shift
  assert.equal(k('a', { repeat: true }), null);    // held key
  assert.equal(k('c', { ctrlKey: true }), null);
  assert.equal(k('v', { metaKey: true }), null);
  for (const key of ['Enter', 'Escape', ' ', '1', "'", 'é', 'Backspace']) assert.equal(k(key), null);
});
test('first letter locks the matching target and counts as a hit', () => {
  assert.deepEqual(typeKey([t(1, 'nasi'), t(2, 'roti')], null, 'r'), { lock: 2, result: { kind: 'hit', id: 2 } });
});
test('nearest target wins when first letters collide, including identical words', () => {
  assert.deepEqual(typeKey([t(1, 'kuih', 0, 20), t(2, 'kuih', 0, 8)], null, 'k').lock, 2);
});
test('while locked, only the locked word advances', () => {
  const ts = [t(1, 'roti', 1), t(2, 'otak')];
  assert.deepEqual(typeKey(ts, 1, 'o'), { lock: 1, result: { kind: 'hit', id: 1 } });
});
test('wrong letter while locked is a miss and keeps the lock', () => {
  assert.deepEqual(typeKey([t(1, 'roti', 1)], 1, 'x'), { lock: 1, result: { kind: 'miss', id: 1 } });
});
test('last letter finishes the word and releases the lock', () => {
  assert.deepEqual(typeKey([t(1, 'roti', 3)], 1, 'i'), { lock: null, result: { kind: 'done', id: 1 } });
});
test('a one-letter word is done on its first letter', () => {
  assert.deepEqual(typeKey([t(1, 'a')], null, 'a'), { lock: null, result: { kind: 'done', id: 1 } });
});
test('a letter matching no word is a miss with no target', () => {
  assert.deepEqual(typeKey([t(1, 'roti')], null, 'z'), { lock: null, result: { kind: 'miss', id: null } });
});
test('a lock whose target is gone is treated as no lock', () => {
  assert.deepEqual(typeKey([t(2, 'nasi')], 1, 'n'), { lock: 2, result: { kind: 'hit', id: 2 } });
});
test('half-typed unlocked targets are not picked by a fresh first letter', () => {
  assert.deepEqual(typeKey([t(1, 'roti', 2)], null, 'r').result, { kind: 'miss', id: null });
});
test('wpm and accuracy', () => {
  const s = newStats();
  assert.equal(wpm(s), 0);
  assert.equal(accuracy(s), 100);
  Object.assign(s, { correct: 100, keys: 125, activeMs: 60000 });
  assert.equal(wpm(s), 20);
  assert.equal(accuracy(s), 80);
  assert.equal(wpm({ ...s, activeMs: 500 }), 0);
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test tests/typing.test.ts` → FAIL, cannot find module `../src/typing.ts`.

- [ ] **Step 3: Implement `src/typing.ts`** with the interfaces above. `keyChar`: `null` if `repeat || ctrlKey || metaKey || altKey`; else `key.toLowerCase()` if it matches `/^[a-z]$/i`, else `null`.

- [ ] **Step 4: Run tests** — `npm test` → all pass.

- [ ] **Step 5: Commit** — `"Add typing logic: target lock, hits, misses, WPM and accuracy"`

---

### Task 3: Word lists and word picking

**Files:**
- Create: `src/words.ts`, `src/wordlists.ts`, `words/en/*.json` (11), `words/bm/*.json` (11)
- Test: `tests/words.test.ts`

**Interfaces:**
- Produces:
```ts
// words.ts (pure)
export type Lang = 'en' | 'bm';
export const LEVELS = ['darjah-1','darjah-2','darjah-3','darjah-4','darjah-5','darjah-6',
  'tingkatan-1','tingkatan-2','tingkatan-3','tingkatan-4','tingkatan-5'] as const;
export type Level = (typeof LEVELS)[number];
export const LENGTHS: Record<Level, [min: number, max: number]>;
export function pickWord(list: string[], used: Set<string>, onScreenFirsts: Set<string>, short: boolean, rand?: () => number): string;
// wordlists.ts (Vite only)
export function wordList(lang: Lang, level: Level): string[];
```
- `LENGTHS`: darjah-1/2 `[3,5]`, darjah-3/4 `[4,7]`, darjah-5/6 `[5,9]`, tingkatan-1/2/3 `[6,11]`, tingkatan-4/5 `[8,14]`.
- `pickWord` rules, in order: (1) if fewer than 20% of `list` are unused, clear `used`; (2) pool = unused words, restricted to length ≤ the list's median length when `short`; (3) prefer pool words whose first letter is not in `onScreenFirsts`, fall back to the whole pool; (4) pick with `rand`, add it to `used`, return it.
- `wordlists.ts`: `import.meta.glob('../words/*/*.json', { eager: true, import: 'default' })`, keyed by `${lang}/${level}`.

- [ ] **Step 1: Write the failing tests** (`tests/words.test.ts`; read the JSON files with `node:fs`)

```ts
test('every list exists, is 70–100 unique lowercase a–z words within its level lengths', () => {
  for (const lang of ['en', 'bm']) for (const level of LEVELS) {
    const list = JSON.parse(readFileSync(`words/${lang}/${level}.json`, 'utf8'));
    assert.ok(list.length >= 70 && list.length <= 100, `${lang}/${level} has ${list.length}`);
    assert.equal(new Set(list).size, list.length, `${lang}/${level} has duplicates`);
    const [min, max] = LENGTHS[level];
    for (const w of list) {
      assert.match(w, /^[a-z]+$/, `${lang}/${level}: ${w}`);
      assert.ok(w.length >= min && w.length <= max, `${lang}/${level}: ${w} length`);
    }
  }
});
test('pickWord avoids first letters already on screen', () => {
  const w = pickWord(['apple', 'banana'], new Set(), new Set(['a']), false, () => 0);
  assert.equal(w, 'banana');
});
test('pickWord falls back when every first letter is taken', () => {
  assert.equal(pickWord(['apple'], new Set(), new Set(['a']), false, () => 0), 'apple');
});
test('pickWord does not repeat until most of the list is used, then resets', () => {
  const list = ['aa', 'bb', 'cc', 'dd', 'ee'], used = new Set<string>();
  const seen = new Set(Array.from({ length: 4 }, () => pickWord(list, used, new Set(), false)));
  assert.equal(seen.size, 4);
  pickWord(list, used, new Set(), false);        // 5th: the last unused word
  assert.equal(used.size, 5);
  pickWord(list, used, new Set(), false);        // <20% unused -> reset first
  assert.equal(used.size, 1);
});
test('short picks only words no longer than the median', () => {
  const list = ['ab', 'abc', 'abcd', 'abcdefgh', 'abcdefghij'];
  for (let i = 0; i < 20; i++) assert.ok(pickWord(list, new Set(), new Set(), true).length <= 4);
});
```

- [ ] **Step 2: Run to see it fail** — `node --test tests/words.test.ts` → FAIL (module/files missing).

- [ ] **Step 3: Implement `words.ts` and `wordlists.ts`.**

- [ ] **Step 4: Draft the 22 word lists** (~80 words each). Everyday school and Malaysian-life vocabulary for the level: food, family, school, home, animals, nature, the pasar malam; science, geography and civics words at secondary. Standard Malaysian BM spelling (DBP); British English spelling (`colour`, `centre`). Nothing violent, scary, rude, or brand names. Within the length band, lower levels lean short and common.

- [ ] **Step 5: Run tests** — `npm test` → all pass.

- [ ] **Step 6: Commit** — `"Add English and BM word lists for Darjah 1 to Tingkatan 5"`

- [ ] **Step 7: Owner review (non-blocking for later tasks)** — tell the owner the lists are in `words/` and need their review before release.

---

### Task 4: Pace

**Files:**
- Create: `src/pace.ts`
- Test: `tests/pace.test.ts`

**Interfaces:**
- Produces (all pure; `levelIndex` is the index into `LEVELS`, 0–10):
```ts
export const typingSpeed = (levelIndex: number) => 0.4 + 0.2 * levelIndex;   // letters/s a typical student manages
export const paceMul = (wave: number) => Math.min(1.6, 1 + 0.08 * (wave - 1));
export function walkTime(wordLen: number, levelIndex: number, wave: number, runner: boolean): number;
export function spawnInterval(avgLen: number, levelIndex: number, wave: number): number;
export const waveSize = (wave: number) => 3 + 2 * wave;
export const runnerShare = (wave: number) => wave < 4 ? 0 : Math.min(0.3, 0.1 * (wave - 3));
```
- `walkTime` = `(3 + 2 * wordLen / typingSpeed(levelIndex)) / paceMul(wave)`, × 0.6 when `runner`.
- `spawnInterval` = `Math.max(0.8, avgLen / typingSpeed(levelIndex)) / paceMul(wave)`.
- These are starting values; the owner tunes them by playing (target: a typical student reaches wave 4–6).

- [ ] **Step 1: Write the failing tests**

```ts
test('longer words and lower levels get more time', () => {
  assert.ok(walkTime(12, 10, 1, false) > walkTime(4, 10, 1, false));
  assert.ok(walkTime(4, 0, 1, false) > walkTime(4, 10, 1, false));
  assert.equal(walkTime(4, 0, 1, false), 23);               // 3 + 2*4/0.4
});
test('pace rises per wave and caps at 1.6', () => {
  assert.equal(paceMul(1), 1);
  assert.ok(Math.abs(paceMul(4) - 1.24) < 1e-9);
  assert.equal(paceMul(50), 1.6);
});
test('runners are faster and only from wave 4, capped at 30%', () => {
  assert.ok(walkTime(5, 3, 5, true) < walkTime(5, 3, 5, false));
  assert.equal(runnerShare(3), 0);
  assert.ok(Math.abs(runnerShare(4) - 0.1) < 1e-9);
  assert.equal(runnerShare(20), 0.3);
});
test('spawn interval follows typing speed, never below 0.8 s at wave 1', () => {
  assert.equal(spawnInterval(4, 0, 1), 10);                 // 4 / 0.4
  assert.equal(spawnInterval(1, 10, 1), 0.8);
  assert.equal(waveSize(1), 5);
});
```

- [ ] **Step 2:** `node --test tests/pace.test.ts` → FAIL. **Step 3:** implement. **Step 4:** `npm test` → pass.
- [ ] **Step 5: Commit** — `"Add typing-based pace for zombies and waves"`

---

### Task 5: Interface strings in English and BM

**Files:**
- Create: `src/strings.ts`

**Interfaces:**
- Produces: `export const STRINGS: Record<Lang, Record<Key, string>>`, `export const LEVEL_NAMES: Record<Lang, string[]>` (11 entries, `LEVELS` order), `export const t = (lang: Lang, key: Key, n?: number) => string` (replaces `{n}`). `Key` is the union of the keys below; TypeScript's `Record` enforces both languages have every key, so no separate test.

Exact copy:

| Key | en | bm |
|---|---|---|
| start | Press ENTER to start | Tekan ENTER untuk mula |
| how | Type the word on a zombie to cure it · ESC to pause | Taip perkataan pada zombi untuk memulihkannya · ESC untuk berhenti |
| choose | ← → language · ↑ ↓ level | ← → bahasa · ↑ ↓ tahap |
| paused | PAUSED | BERHENTI |
| resume | Press ENTER to continue | Tekan ENTER untuk sambung |
| over | GAME OVER! | TAMAT! |
| wpm | Words per minute | Perkataan seminit |
| accuracy | Accuracy | Ketepatan |
| cured | Zombies cured | Zombi dipulihkan |
| waves | Waves survived | Gelombang ditempuh |
| practise | Practise these words | Latih perkataan ini |
| again | ENTER play again · ESC menu | ENTER main lagi · ESC menu |
| keyboard | This game needs a keyboard. Open it on a computer. | Permainan ini perlukan papan kekunci. Buka di komputer. |
| hudWave | WAVE | GELOMBANG |
| hudCured | CURED | PULIH |
| hudWpm | WPM | PPM |
| waveStart | WAVE {n}! | GELOMBANG {n}! |
| waveClear | WAVE CLEARED! | GELOMBANG SELESAI! |
| lowGfx | Low graphics | Grafik rendah |

`LEVEL_NAMES.en`: `Year 1`…`Year 6`, `Form 1`…`Form 5`. `LEVEL_NAMES.bm`: `Darjah 1`…`Darjah 6`, `Tingkatan 1`…`Tingkatan 5`.

- [ ] **Step 1:** Implement. **Step 2:** `npm run build` → passes (type check proves both tables are complete).
- [ ] **Step 3: Commit** — `"Add interface text in English and BM"`

---

### Task 6: Words on zombies, typing in play, curing

**Files:**
- Modify: `src/zombies.ts`, `src/main.ts`, `src/pistol.ts`, `src/audio.ts`, `src/fx.ts`

**Interfaces:**
- Consumes: Task 2 (`keyChar`, `typeKey`, `Stats`, `newStats`), Task 3 (`pickWord`, `wordList`, `LEVELS`), Task 4 (all), Task 1 (`updatePlayer(dt, look)`, `squirt`).
- Produces (`zombies.ts`):
  - `Zombie` gains `id: number`, `word: string`, `typed: number`, `label: THREE.Sprite`; loses `hp`.
  - `spawnZombie(word: string, runner: boolean, walkTime: number)` — speed = straight-line distance from spawn to `STALL` × 1.3 ÷ `walkTime`.
  - `setTyped(z: Zombie, typed: number, locked: boolean)` — redraws the label.
  - `flinch(z: Zombie)` — the old `hitZombie` reaction (white flash, squash, small knockback away from the player) with no damage.
  - `cure(z: Zombie)` — removes it from `zombies`, recolours to a human look (skin `0xe0ac69`, a random bright shirt), turns it to face away, walks it off for 0.8 s while shrinking out, then removes it.
  - `shakeLabel(z: Zombie)` — 0.2 s horizontal shake of the label.
- `main.ts` state: `lang: Lang`, `levelIndex: number`, `lock: number | null`, `stats: Stats`, `used: Set<string>`.

- [ ] **Step 1: Labels.** One `THREE.Sprite` per zombie at head height + 0.6, `sizeAttenuation: false`, `depthTest: false`, so the word stays the same readable size on screen at any distance. Canvas text `700 …px Verdana, Arial, sans-serif`: typed letters `#2a9d8f`, untyped `#ffffff`, on a black rounded pill; locked label gets a 4 px `#ffd60a` border and draws above others (`renderOrder`). Redraw only on `setTyped`.

- [ ] **Step 2: Spawning.** The wave loop uses `waveSize`, `spawnInterval(avgLen of the list, levelIndex, wave)`, `runnerShare`; each spawn calls `pickWord(list, used, firstLettersOnScreen, runner)` and `spawnZombie(word, runner, walkTime(word.length, levelIndex, wave, runner))`. Wave clear: `player.hp = Math.min(100, player.hp + 25)`, banner `t(lang,'waveClear')`.

- [ ] **Step 3: Keys.** One `keydown` listener in `main.ts`: when `game.state === 'play'`, `ch = keyChar(e)`; if `ch`, `e.preventDefault()`; if no live zombie, ignore. Otherwise `typeKey(targets, lock, ch)` where targets come from `zombies` (`dist` = distance to `STALL`), `stats.keys++`, then:
  - `hit`: `stats.correct++`, `z.typed++`, `setTyped`, `squirt(head pos)`, `flinch`, `sfx.squirt()`.
  - `done`: as `hit`, plus `cure(z)`, `stats.cured++`, `pop('SPLASH!', '#4cc9f0', head, 1.6)`, `sfx.cure()`, `hitStop(0.05)`.
  - `miss`: `sfx.miss()`; if `id`, `shakeLabel` and `stats.missed.add(word)`.
  - Esc → pause. Each frame while playing and `zombies.length > 0`: `stats.activeMs += dt * 1000`. `updatePlayer(dt, lockedZombieHead ?? null)`.

- [ ] **Step 4: Sounds** in `audio.ts`: `squirt` (short bandpass hiss ~2.5 kHz, 0.06 s), `cure` (rising two-note triangle chime), `miss` (low square buzz 0.08 s). Delete `pistol`, `hit`, `splat`.

- [ ] **Step 5: Build and play**

Run: `npm run build && npm test` → pass.
`npm run dev` (temporarily hard-code `lang='en'`, `levelIndex=1` until Task 7): zombies arrive with words; typing a first letter turns the camera and highlights that word; each correct letter squirts and greens a letter; a wrong key buzzes and shakes the locked word; finishing cures the zombie (no falling over); holding a key down does not repeat; Caps Lock still works; Ctrl+R still reloads the page normally; keys during the wave break do nothing.

- [ ] **Step 6: Commit** — `"Put words on zombies and cure them by typing"`

---

### Task 7: Title, HUD, pause, results and the keyboard check

**Files:**
- Modify: `src/main.ts`, `index.html`

**Interfaces:**
- Consumes: Task 5 (`t`, `LEVEL_NAMES`), Task 2 (`wpm`, `accuracy`), Task 3 (`LEVELS`).

- [ ] **Step 1: Title screen** (`game.state = 'title'`): logo, a **TAIP!** badge, language pills `English | Bahasa Melayu`, the level name (`LEVEL_NAMES[lang][levelIndex]`) with ▲▼, `t('choose')`, `t('how')`, `t('start')`. ←/→ switch language, ↑/↓ change level, Enter starts; all are also clickable. The whole screen re-renders in the chosen language immediately. Last `lang` and `levelIndex` saved to `localStorage` (try/catch on read and write). If Task 1b was done, a `t('lowGfx')` checkbox saved as `lowgfx` (applies on reload).
- [ ] **Step 2: HUD:** `t('hudWave')`, HP bar, `t('hudCured')` count, live `t('hudWpm')` from `wpm(stats)`.
- [ ] **Step 3: Pause:** `t('paused')`, `t('resume')`; Enter resumes.
- [ ] **Step 4: Results** (`'over'`): `t('over')`, then `wpm`, `accuracy` %, `cured`, waves survived (`wave - 1`), and under `t('practise')` the `missed` words (max 12, in the order missed). `t('again')`: Enter starts a new game with the same language and level, Esc returns to title. Ignore Enter for 800 ms after game over (existing `clickGuard` idea).
- [ ] **Step 5: Keyboard check:** if `matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches`, set `'nokeyboard'` and show only the logo and `t('keyboard')` in both languages (BM first).
- [ ] **Step 6: Build and play**

Run: `npm run build && npm test` → pass.
In the browser: open the page and, without touching the mouse, pick Bahasa Melayu + Darjah 1 → every screen text is BM; play, lose, see PPM, Ketepatan, the missed words; Esc → title; switch to English → everything English, level shows "Year 1". Reload → last choice remembered. Chrome DevTools device mode (phone) → only the keyboard message.

- [ ] **Step 7: Commit** — `"Add title, results and pause screens in English and BM"`

---

### Task 8: README and final review

**Files:** Modify `README.md`; replace `docs/media` screenshots/GIF with typing-edition ones.

- [ ] **Step 1:** README: name, one-line pitch (a typing game for Malaysian primary and secondary students, English or BM), how to play, `npm install / dev / build / test`, where word lists live and their rules (from Global Constraints), and a note that it's based on Pasar Malam Zombi!. Remove shooter controls and the API-credit note.
- [ ] **Step 2:** Capture a title screenshot, a gameplay screenshot with a locked word, and a results screenshot into `docs/media`.
- [ ] **Step 3:** `npm run build && npm test` → pass. Check changed files for leftover `TODO`, `test.skip`, `.only`, unused exports from deleted modules (`grep -rn "touch\|pickup\|reload\|weapon" src index.html` → nothing relevant).
- [ ] **Step 4: Commit** — `"Write the typing edition README"`
- [ ] **Step 5: Owner go-ahead** before creating the GitHub repo, pushing, or setting up the Vercel project.
