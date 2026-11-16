import { test } from 'node:test';
import assert from 'node:assert/strict';
import { walkTime, paceMul, runnerShare, spawnInterval, waveSize } from '../src/pace.ts';

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
