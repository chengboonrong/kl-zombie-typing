import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEVELS, LENGTHS, pickWord } from '../src/words.ts';

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
