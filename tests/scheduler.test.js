import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyReview, newIntroducedToday, newRemaining, pickNext, countCards, isUnlocked,
  formatInterval, Rating, State,
} from '../js/scheduler.js';

const at = (y, mo, d, h, mi = 0) => new Date(y, mo - 1, d, h, mi);
const def = (id, extra = {}) => ({ id, module: 'vocabulary', topic: 't', item: id, kind: 'rec', ...extra });

/** Review a card and store the result; returns the log entry. */
function review(records, d, rating, now) {
  const { record, log } = applyReview(d, records.get(d.id), rating, now);
  records.set(d.id, record);
  return log;
}

test('first review of a new card is logged with state New', () => {
  const records = new Map();
  const log = review(records, def('a'), Rating.Good, at(2026, 11, 10, 8));
  assert.equal(log.state, State.New);
  assert.equal(log.cardId, 'a');
  assert.equal(records.get('a').reps, 1);
  assert.equal(records.get('a').successes, 1);
});

test('Again does not count as a success', () => {
  const records = new Map();
  review(records, def('a'), Rating.Again, at(2026, 11, 10, 8));
  assert.equal(records.get('a').successes, 0);
});

test('daily allowance counts each new card once, within the study day', () => {
  const records = new Map();
  const logs = [];
  const morning = at(2026, 11, 10, 8);
  logs.push(review(records, def('a'), Rating.Again, morning));
  logs.push(review(records, def('a'), Rating.Good, at(2026, 11, 10, 8, 2))); // relearn, not new
  logs.push(review(records, def('b'), Rating.Good, morning));
  assert.equal(newIntroducedToday(logs, morning), 2);
  assert.equal(newRemaining(15, logs, morning), 13);
  assert.equal(newRemaining(1, logs, morning), 0);
});

test('allowance resets at 04:00, not midnight', () => {
  const records = new Map();
  const logs = [review(records, def('a'), Rating.Good, at(2026, 11, 10, 23))];
  assert.equal(newIntroducedToday(logs, at(2026, 11, 11, 2)), 1, 'still the same study day at 02:00');
  assert.equal(newIntroducedToday(logs, at(2026, 11, 11, 4)), 0, 'new study day at 04:00');
  // A card first studied at 01:00 belongs to the previous day.
  const late = [review(new Map(), def('b'), Rating.Good, at(2026, 11, 11, 1))];
  assert.equal(newIntroducedToday(late, at(2026, 11, 10, 22)), 1);
  assert.equal(newIntroducedToday(late, at(2026, 11, 11, 5)), 0);
});

test('production card unlocks only after a successful recognition review', () => {
  const rec = def('v-1-rec');
  const prod = def('v-1-prod', { requires: 'v-1-rec' });
  const records = new Map();
  assert.equal(isUnlocked(prod, records), false);
  review(records, rec, Rating.Again, at(2026, 11, 10, 8));
  assert.equal(isUnlocked(prod, records), false, 'Again is not a success');
  review(records, rec, Rating.Good, at(2026, 11, 10, 8, 5));
  assert.equal(isUnlocked(prod, records), true);
});

test('pickNext: due cards before new cards, new cards in order, respects allowance', () => {
  const defs = [def('a'), def('b'), def('c')];
  const records = new Map();
  const t0 = at(2026, 11, 10, 8);
  let p = pickNext(defs, records, 15, t0);
  assert.equal(p.def.id, 'a');
  assert.equal(p.isNew, true);

  review(records, defs[0], Rating.Again, t0); // 'a' is now learning, due in ~1 minute
  p = pickNext(defs, records, 15, at(2026, 11, 10, 8, 5));
  assert.equal(p.def.id, 'a', 'due learning card comes first');

  p = pickNext(defs, records, 15, at(2026, 11, 10, 8, 0), new Set(['a']));
  assert.equal(p.def.id, 'b', 'skip the card just answered');

  p = pickNext(defs, records, 0, t0, new Set(['a']));
  assert.equal(p.def, null, 'no allowance and nothing else due');
});

test('pickNext: shows a learning card early when nothing else is left', () => {
  const defs = [def('a')];
  const records = new Map();
  const t0 = at(2026, 11, 10, 8);
  review(records, defs[0], Rating.Good, t0); // learning step: due in ~10 minutes
  const p = pickNext(defs, records, 0, at(2026, 11, 10, 8, 1));
  assert.equal(p.def?.id, 'a');
});

test('reviews reappear on schedule', () => {
  const defs = [def('a')];
  const records = new Map();
  let now = at(2026, 11, 10, 8);
  review(records, defs[0], Rating.Good, now);
  review(records, defs[0], Rating.Good, new Date(records.get('a').due));
  const due = records.get('a').due;
  assert.equal(records.get('a').state, State.Review);
  assert.ok(due > at(2026, 11, 11, 0).getTime(), 'graduated card is due on a later day');
  assert.equal(countCards(defs, records, now).due, 0);
  assert.equal(countCards(defs, records, new Date(due)).due, 1);
  assert.equal(pickNext(defs, records, 0, new Date(due)).def?.id, 'a');
});

test('countCards tallies due, new, learned', () => {
  const defs = [def('a'), def('b'), def('c', { requires: 'b' })];
  const records = new Map();
  review(records, defs[0], Rating.Again, at(2026, 11, 10, 8));
  const c = countCards(defs, records, at(2026, 11, 10, 8));
  assert.deepEqual(c, { total: 3, due: 1, newAvailable: 1, studied: 1, learned: 0 });
});

test('formatInterval', () => {
  assert.equal(formatInterval(60_000), '1m');
  assert.equal(formatInterval(10 * 60_000), '10m');
  assert.equal(formatInterval(3 * 3600_000), '3h');
  assert.equal(formatInterval(4 * 86400_000), '4d');
});
