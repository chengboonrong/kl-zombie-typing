import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyChar, typeKey, newStats, wpm, accuracy } from '../src/typing.ts';

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
