import type { Lang } from './words';

const EN = {
  start: 'Press ENTER to start',
  how: 'Type the word on a zombie to cure it · ESC to pause',
  choose: '← → language · ↑ ↓ level',
  paused: 'PAUSED',
  resume: 'Press ENTER to continue',
  over: 'GAME OVER!',
  wpm: 'Words per minute',
  accuracy: 'Accuracy',
  cured: 'Zombies cured',
  waves: 'Waves survived',
  practise: 'Practise these words',
  again: 'ENTER play again · ESC menu',
  keyboard: 'This game needs a keyboard. Open it on a computer.',
  hudWave: 'WAVE',
  hudCured: 'CURED',
  hudWpm: 'WPM',
  waveStart: 'WAVE {n}!',
  waveClear: 'WAVE CLEARED!',
  lowGfx: 'Low graphics',
  splash: 'SPLASH!',
};

export type Key = keyof typeof EN;

const BM: Record<Key, string> = {
  start: 'Tekan ENTER untuk mula',
  how: 'Taip perkataan pada zombi untuk memulihkannya · ESC untuk berhenti',
  choose: '← → bahasa · ↑ ↓ tahap',
  paused: 'BERHENTI',
  resume: 'Tekan ENTER untuk sambung',
  over: 'TAMAT!',
  wpm: 'Perkataan seminit',
  accuracy: 'Ketepatan',
  cured: 'Zombi dipulihkan',
  waves: 'Gelombang ditempuh',
  practise: 'Latih perkataan ini',
  again: 'ENTER main lagi · ESC menu',
  keyboard: 'Permainan ini perlukan papan kekunci. Buka di komputer.',
  hudWave: 'GELOMBANG',
  hudCured: 'PULIH',
  hudWpm: 'PPM',
  waveStart: 'GELOMBANG {n}!',
  waveClear: 'GELOMBANG SELESAI!',
  lowGfx: 'Grafik rendah',
  splash: 'PERCIK!',
};

export const STRINGS: Record<Lang, Record<Key, string>> = { en: EN, bm: BM };

export const LEVEL_NAMES: Record<Lang, string[]> = {
  en: ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6',
    'Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5'],
  bm: ['Darjah 1', 'Darjah 2', 'Darjah 3', 'Darjah 4', 'Darjah 5', 'Darjah 6',
    'Tingkatan 1', 'Tingkatan 2', 'Tingkatan 3', 'Tingkatan 4', 'Tingkatan 5'],
};

/** Looks up interface text; replaces every `{n}` with `n` when given. */
export const t = (lang: Lang, key: Key, n?: number): string =>
  n === undefined ? STRINGS[lang][key] : STRINGS[lang][key].replace(/\{n\}/g, String(n));
