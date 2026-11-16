export type Lang = 'en' | 'bm';

export const LEVELS = ['darjah-1', 'darjah-2', 'darjah-3', 'darjah-4', 'darjah-5', 'darjah-6',
  'tingkatan-1', 'tingkatan-2', 'tingkatan-3', 'tingkatan-4', 'tingkatan-5'] as const;
export type Level = (typeof LEVELS)[number];

/** Allowed word length [min, max] per level. */
export const LENGTHS: Record<Level, [min: number, max: number]> = {
  'darjah-1': [3, 5], 'darjah-2': [3, 5],
  'darjah-3': [4, 7], 'darjah-4': [4, 7],
  'darjah-5': [5, 9], 'darjah-6': [5, 9],
  'tingkatan-1': [6, 11], 'tingkatan-2': [6, 11], 'tingkatan-3': [6, 11],
  'tingkatan-4': [8, 14], 'tingkatan-5': [8, 14],
};

/** Picks a word, avoiding repeats and (when possible) first letters already on screen. */
export function pickWord(list: string[], used: Set<string>, onScreenFirsts: Set<string>,
  short: boolean, rand: () => number = Math.random): string {
  if (list.filter(w => !used.has(w)).length < list.length * 0.2) used.clear();
  let pool = list.filter(w => !used.has(w));
  if (short) {
    const median = list.map(w => w.length).sort((a, b) => a - b)[Math.floor(list.length / 2)];
    const shortPool = pool.filter(w => w.length <= median);
    if (shortPool.length) pool = shortPool;
  }
  const fresh = pool.filter(w => !onScreenFirsts.has(w[0]));
  if (fresh.length) pool = fresh;
  const word = pool[Math.floor(rand() * pool.length)];
  used.add(word);
  return word;
}
