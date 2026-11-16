export interface Target { id: number; word: string; typed: number; dist: number }
export type KeyResult =
  | { kind: 'hit'; id: number }    // correct letter, word not finished
  | { kind: 'done'; id: number }   // correct letter that finished the word
  | { kind: 'miss'; id: number | null }; // id = the locked target, if any

export function keyChar(e: { key: string; repeat: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean }): string | null {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return null;
  return /^[a-z]$/i.test(e.key) ? e.key.toLowerCase() : null;
}

export function typeKey(targets: Target[], lock: number | null, ch: string): { lock: number | null; result: KeyResult } {
  const locked = lock === null ? undefined : targets.find(t => t.id === lock);
  if (locked) {
    if (locked.word[locked.typed] !== ch) return { lock, result: { kind: 'miss', id: locked.id } };
    if (locked.typed + 1 === locked.word.length) return { lock: null, result: { kind: 'done', id: locked.id } };
    return { lock: locked.id, result: { kind: 'hit', id: locked.id } };
  }
  let best: Target | undefined;
  for (const t of targets) {
    if (t.typed === 0 && t.word[0] === ch && (!best || t.dist < best.dist)) best = t;
  }
  if (!best) return { lock: null, result: { kind: 'miss', id: null } };
  if (best.word.length === 1) return { lock: null, result: { kind: 'done', id: best.id } };
  return { lock: best.id, result: { kind: 'hit', id: best.id } };
}

export interface Stats { correct: number; keys: number; activeMs: number; cured: number; missed: Set<string> }

export function newStats(): Stats {
  return { correct: 0, keys: 0, activeMs: 0, cured: 0, missed: new Set<string>() };
}

export function wpm(s: Stats): number {
  if (s.activeMs < 1000) return 0;
  return Math.round((s.correct / 5) / (s.activeMs / 60000));
}

export function accuracy(s: Stats): number {
  return s.keys === 0 ? 100 : Math.round(100 * s.correct / s.keys);
}
