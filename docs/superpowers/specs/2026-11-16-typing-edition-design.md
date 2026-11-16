# Pasar Malam Zombi! — Typing Edition: design

Date: 2026-11-16
Status: draft, awaiting owner approval. This file sits untracked in the
original `kl-zombie-shooter` repo until the new repo exists; it becomes the
new repo's first commit.

## Intent

Turn the KL night-market zombie shooter into a typing game for Malaysian
primary (Darjah 1–6) and secondary (Tingkatan 1–5) students. Every zombie
carries a word; typing the word exactly "cures" the zombie. The point is
typing practice — speed and accuracy — using real school-level vocabulary in
English or Bahasa Melayu, wrapped in a game kids want to play.

## Decisions made with the owner

- **Audience:** primary and secondary students, KSSR/KSSM ages 7–17.
- **Goal is typing (copy-typing), not translation.** The zombie shows the word;
  the student types that same word. No translation modes.
- **Two languages:** English and BM, picked on the title screen. Separate,
  unpaired word lists.
- **Difficulty follows school level:** the student picks Darjah 1 … Tingkatan 5;
  the level picks the word list. Not keyboard-row progression.
- **Separate copy:** a new repo and URL copied from `kl-zombie-shooter`. The
  original shooter stays untouched and live.
- **Silly, non-violent weapon:** no gun. Zombies are cured, not killed.
- **Approach 1 (below):** keep the 3D game, strip what typing doesn't need.
- **Interface follows the chosen language:** picking BM switches every screen
  (title, HUD, pause, results, "needs a keyboard") to BM, not just the words.
  All UI text lives in one small strings table with `en` and `bm` entries.
- **Target hardware: a cheap school laptop / Chromebook, tested early.** The
  first milestone is the stripped 3D scene (stationary player, zombies walking
  in, no typing yet). The owner runs it on a low-end machine before the typing
  and word-list work starts. If it's slow, add a low-quality mode (no MSAA,
  lower pixel budget, optional halftone pass, lower zombie cap) at that point.

## Goals

- A student can open the page, pick language + level, and be typing within
  three clicks/keypresses.
- Every keystroke gets immediate visible and audible feedback.
- End-of-game screen tells the student how they did: words per minute,
  accuracy, words cured, waves survived, and the words they mistyped.
- Word lists are data files; adding or fixing words never touches code.

## Non-goals

- Translation / meaning modes.
- Phones and tablets. The game needs a physical keyboard. Touch devices get a
  "this game needs a keyboard" screen instead of the game.
- Accounts, saved progress, leaderboards, teacher dashboards, custom teacher
  word lists.
- Free movement, jumping, aiming, reloading, multiple weapons, pickups.

## Anti-goals (would be a failure even if it works)

- Anything that reads as gun violence or gore aimed at people-shaped figures.
- Needing the mouse during play.
- A word list containing a misspelling, an inappropriate word, or a word far
  above/below its level.
- Word labels that are hard for a 7-year-old to read.

## Approaches considered

1. **Keep the 3D game, strip it down, add a typing layer — chosen.** Copy the
   repo, delete movement/aiming/weapons/touch/pickups, add typing on top of
   the existing zombies. Keeps the market, comic art, zombie AI, waves, game
   feel and audio. Smallest change.
2. **Rebuild as a flat 2D typing game.** Lighter on old school PCs, but throws
   away the 3D market and the art that make this worth starting from.
   Fallback only if approach 1 is too slow on school hardware.
3. **Keep free movement with a key to toggle typing.** Letters collide with
   WASD/R/1–5, students would constantly switch modes. Most work, worst play.

## How it plays

1. **Title screen:** logo, language toggle (English / BM), level picker
   (Darjah 1–6, Tingkatan 1–5), "Press ENTER to start". Keyboard-operable
   (arrow keys + Enter) and clickable. Remember the last language + level in
   `localStorage` (wrapped in try/catch) as a convenience.
2. **Play:** the player stands still at one stall. Zombies walk in, each with
   its word floating above its head.
   - Typing a letter that starts a visible zombie's word **locks onto** it
     (nearest one if several match). The camera turns smoothly to face it.
   - Each correct letter: the typed part of the word changes colour, the water
     pistol squirts, the zombie flinches (reuse the existing hit reaction:
     flash, squash, small knockback).
   - Wrong letter: counted as a miss, short "bzzt", the word shakes, no
     progress. No backspace needed; the locked word stays locked.
   - Last letter: the zombie is **cured** — a splash, it turns back into a
     human (skin/shirt recolour to normal customer colours), and walks away
     or shrinks out. Then the lock is released.
   - Letters that start no visible word count as a miss.
   - Input is case-insensitive; only a–z count. Letter keys call
     `preventDefault` so browser shortcuts (e.g. Firefox quick-find on `'`/`/`)
     don't fire.
3. **Damage:** a zombie that reaches the player hurts them as today. HP 0 =
   game over. Clearing a wave restores some HP (replaces the health pickup).
4. **Waves (Claude's call, after builder review):** keep the wave loop
   structure, but retune pace for typing. The shooter's numbers (12 m spawn,
   4 m/s runners, +7% speed per wave, no cap) were tuned for aiming and make
   long words unplayable. Instead, each zombie's walking time to the player is
   set from its word length and a target typing speed for the level, so a
   14-letter Tingkatan 5 word gets proportionally more time than a 4-letter
   Darjah 1 word. Waves grow in count and shrink the spawn interval; the pace
   multiplier rises per wave up to a cap. Runners (faster zombies) appear only
   from a later wave and carry short words. Tuning target: a typical student at
   their level reaches wave 4–6.
5. **Pause:** Esc pauses, Enter/click resumes. Window blur / tab hidden pauses
   (as today).
6. **Game over screen:** WPM, accuracy %, words cured, waves survived, and a
   "practise these" list of words that had a mistake. Enter to play again,
   another key/click to go back to the title screen.

### How WPM and accuracy are counted (Claude's call)

- **WPM** = correctly typed letters ÷ 5, per minute of *active* time. Active
  time is time during a wave while at least one zombie is on screen; wave
  breaks and empty-screen gaps don't count. This measures the student's speed,
  not the spawn rate.
- **Accuracy** = correct letters ÷ all letter keypresses during active time.
  Keys pressed during wave breaks or with no zombie on screen are ignored.

### Rules that keep typing unambiguous

- When spawning, prefer a word whose first letter is not the first letter of
  any word currently on screen. If the list can't provide one, allow a
  duplicate first letter (lock picks the nearest).
- Don't repeat a word until most of the list has been used in this game.

### Making sure the player can see every zombie

The player can't turn freely, so zombies must arrive where they can be seen.
Pick the player's stall position and restrict spawn points to a fan in front
of it, so every approaching zombie is on screen with its word readable.

## What changes in the code (copied repo)

Current modules: `main.ts`, `player.ts`, `weapons.ts`, `zombies.ts`,
`level.ts`, `nav.ts`, `steer.ts`, `fx.ts`, `audio.ts`, `toon.ts`, `hud.ts`,
`pickups.ts`, `touch.ts`.

- **Delete:** `touch.ts`, `pickups.ts`, the touch HUD in `index.html`,
  `tests/hud.test.ts` and the reload/stick helpers in `hud.ts`, the crosshair,
  pointer lock.
- **`player.ts`:** fixed position, no WASD/jump/mouse look. Camera yaw (and a
  slight pitch) eases toward the locked zombie. Keep `hurt`, `hp`, `game`.
- **`weapons.ts`:** shrink to one water pistol viewmodel (recolour the existing
  boxes: bright plastic colours, no muzzle flash star, a water squirt instead).
  One `squirt(target)` call per correct letter.
- **`zombies.ts`:** each zombie gets a `word` and `typed` count. Add the word
  label (canvas-texture sprite or HTML overlay, builder's choice) that shows
  typed letters in a different colour. Replace death (falls over) with
  cure (recolour + leave). Spawn points limited to the front fan. Nav/steer
  stay; the target is the fixed player position.
- **New `typing.ts`:** pure logic, no DOM/Three: given live words, the current
  lock and a key, return the new lock/progress and whether it was a hit, a
  miss or a completion. Also WPM and accuracy from counts and play time.
  Unit-tested in `tests/typing.test.ts` (node --test, like the existing tests).
- **New `words/` data:** one file per language × level, e.g.
  `words/en/darjah-1.json`, `words/bm/tingkatan-5.json`, each a plain array of
  lowercase a–z words. 22 files.
- **`main.ts`:** title screen with language/level, keyboard input wired to
  `typing.ts`, wave loop kept, results screen, touch-device "needs a keyboard"
  screen.
- **`audio.ts`:** add squirt, splash/cure, miss buzz; drop gun sounds.
- **`fx.ts`:** reuse pops/bursts/shake/hit stop; water-blue splash instead of
  sparks. Damage numbers go.
- **`index.html`:** HUD becomes wave, HP, words cured, live WPM; title and
  results screens. Word labels use a clear, very readable bold sans font, not
  Impact.

## Word lists

- 22 lists: {English, BM} × {Darjah 1–6, Tingkatan 1–5}, about 80 words each.
- Single words, lowercase, letters a–z only (no spaces, hyphens, apostrophes).
- Word length grows with level: roughly 3–5 letters in Darjah 1–2 up to
  8–14 in Tingkatan 4–5.
- Everyday school and Malaysian-life vocabulary for the level (food, family,
  school, nature, the pasar malam; science and civics words at secondary).
- Claude drafts the lists; the owner reviews them before release. They are
  not checked against an official KSSR/KSSM word list.

## Success criteria

- `npm run build` and `npm test` pass; `typing.test.ts` covers lock choice,
  correct/wrong letters, completion, misses on no-match letters, WPM and
  accuracy.
- In a browser: pick BM + Darjah 1, start with Enter, type words, zombies
  cure; a wrong key shows a miss; game over shows WPM, accuracy and missed
  words; Esc pauses.
- Never needs the mouse after the page loads.
- No gun, no gore, no death animation remains.
- Picking BM shows every screen in BM; picking English shows every screen in
  English.
- Milestone 1 (stripped scene) runs at a steady 30+ fps on the owner's
  low-end machine before typing work begins; the finished game still does.

## Left to the builder

- New repo name, page title and logo treatment (suggestion: "Pasar Malam
  Zombi! Taip!" or "… Typing Edition").
- Word label rendering (sprite vs DOM overlay), exact colours and fonts within
  the readability bar above.
- The stall position and the front spawn fan.
- Exact numbers: HP restored per wave, camera turn speed, label size.
- Cure animation details.
- Hosting: a new Vercel project, set up after the first playable build.
