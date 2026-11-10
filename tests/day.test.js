import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayStart, nextDayStart, dayKey } from '../js/day.js';

const at = (y, mo, d, h, mi = 0) => new Date(y, mo - 1, d, h, mi);

test('day starts at 04:00 local time', () => {
  assert.deepEqual(dayStart(at(2026, 11, 10, 9)), at(2026, 11, 10, 4));
  assert.deepEqual(dayStart(at(2026, 11, 10, 4, 0)), at(2026, 11, 10, 4));
});

test('before 04:00 still counts as the previous day', () => {
  assert.deepEqual(dayStart(at(2026, 11, 10, 3, 59)), at(2026, 11, 9, 4));
  assert.equal(dayKey(at(2026, 11, 10, 1)), '2026-11-09');
  assert.equal(dayKey(at(2026, 11, 10, 4)), '2026-11-10');
});

test('rollover across month and year boundaries', () => {
  assert.deepEqual(dayStart(at(2027, 1, 1, 2)), at(2026, 12, 31, 4));
  assert.deepEqual(nextDayStart(at(2026, 12, 31, 23)), at(2027, 1, 1, 4));
});

test('next day start is 04:00 tomorrow', () => {
  assert.deepEqual(nextDayStart(at(2026, 11, 10, 9)), at(2026, 11, 11, 4));
  assert.deepEqual(nextDayStart(at(2026, 11, 10, 2)), at(2026, 11, 10, 4));
});
