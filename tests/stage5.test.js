import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBackup, parseBackup, describeBackup, backupFilename } from '../js/backup.js';
import { daysStudied, cardsLearned, dueByDay, accuracyByModule } from '../js/stats.js';
import { newOwnId, cleanPhrase, ownToItem, withOwnPhrases } from '../js/own.js';
import { buildModule } from '../js/content.js';
import { applyReview, Rating } from '../js/scheduler.js';

const at = (y, mo, d, h, mi = 0) => new Date(y, mo - 1, d, h, mi);
const def = (id, module = 'vocabulary') => ({ id, module, topic: 't', item: id, kind: 'rec' });

/** A realistic store dump built from actual reviews. */
function sampleStores() {
  const records = new Map();
  const reviews = [];
  let key = 1;
  const review = (d, rating, when) => {
    const { record, log } = applyReview(d, records.get(d.id), rating, when);
    records.set(d.id, record);
    reviews.push({ key: key++, value: log });
  };
  review(def('v-0001-rec'), Rating.Good, at(2026, 11, 10, 8));
  review(def('v-0001-rec'), Rating.Good, at(2026, 11, 10, 8, 12));
  review(def('pr-01-001-listen', 'pronunciation'), Rating.Again, at(2026, 11, 11, 7));
  review(def('g-01-001', 'grammar'), Rating.Hard, at(2026, 11, 12, 2)); // counts as 11 Nov (before 04:00)
  return {
    records,
    stores: {
      cards: [...records.values()],
      reviews,
      settings: [{ key: 'newPerDay', value: 20 }, { key: 'learnerGender', value: 'm' }, { key: 'lessonsSeen', value: ['pr-01'] }],
      flags: [{ cardId: 'v-0001-rec', note: 'Is this right?', created: 1, text: 'cześć' }],
      own: [{ id: 'u-abc', pl: 'Smacznej kawusi!', en: 'Enjoy your coffee!', note: null, created: 2 }],
    },
  };
}

test('export → JSON text → import restores every store exactly', () => {
  const { stores } = sampleStores();
  const text = JSON.stringify(makeBackup(stores, at(2026, 11, 12, 9)));
  const back = parseBackup(text);
  assert.deepEqual(back.stores, JSON.parse(JSON.stringify(stores)));
  assert.equal(back.stores.reviews[2].key, 3, 'review-log keys are preserved');
  assert.match(describeBackup(back), /^3 studied cards, 4 reviews, 1 own phrases, 1 flags/);
});

test('import rejects files that are not Polski exports', () => {
  assert.throws(() => parseBackup('not json'), /not valid JSON/);
  assert.throws(() => parseBackup('{"app":"other"}'), /not a Polski export/);
  assert.throws(() => parseBackup(JSON.stringify({ app: 'polski', format: 99, stores: {} })), /newer version/);
  assert.throws(() => parseBackup(JSON.stringify({ app: 'polski', format: 1, stores: { cards: [{ id: 'x' }] } })), /damaged/);
});

test('backup filename uses the local date', () => {
  assert.equal(backupFilename(at(2026, 1, 5, 9)), 'polski-progress-2026-01-05.json');
});

test('stats: days studied (04:00 rollover), cards learned, accuracy per module', () => {
  const { stores } = sampleStores();
  const logs = stores.reviews.map((r) => r.value);
  assert.equal(daysStudied(logs), 2, '10 Nov and 11 Nov (the 02:00 review belongs to 11 Nov)');
  assert.equal(cardsLearned(stores.cards), 2, 'v-0001-rec and g-01-001; the Again card is not learned');
  assert.deepEqual(accuracyByModule(logs, ['pronunciation', 'vocabulary', 'grammar']), {
    pronunciation: { correct: 0, total: 1 },
    vocabulary: { correct: 2, total: 2 },
    grammar: { correct: 1, total: 1 },
  });
});

test('stats: cards due over the next 7 days, overdue counted today', () => {
  const now = at(2026, 11, 10, 9);
  const records = [
    { due: at(2026, 11, 8, 9).getTime() },  // overdue → today
    { due: at(2026, 11, 10, 23).getTime() }, // today
    { due: at(2026, 11, 11, 3).getTime() },  // still today (before 04:00)
    { due: at(2026, 11, 11, 5).getTime() },  // tomorrow
    { due: at(2026, 11, 16, 12).getTime() }, // day 6
    { due: at(2026, 11, 20, 12).getTime() }, // beyond the window
  ];
  const d = dueByDay(records, now);
  assert.equal(d.length, 7);
  assert.deepEqual(d.map((x) => x.count), [3, 1, 0, 0, 0, 0, 1]);
  assert.equal(d[0].key, '2026-11-10');
  assert.equal(d[6].key, '2026-11-16');
});

test('own phrases: ids, cleaning, and cards in My phrases', () => {
  assert.match(newOwnId(1700000000000, () => 0.5), /^u-[0-9a-z]+$/);
  assert.notEqual(newOwnId(1, () => 0.1), newOwnId(1, () => 0.9));
  assert.deepEqual(cleanPhrase({ pl: '  Dzień   dobry ', en: 'Hello', note: ' ' }), { pl: 'Dzień dobry', en: 'Hello', note: null });
  assert.throws(() => cleanPhrase({ pl: '', en: 'x' }), /Polish/);
  assert.deepEqual(ownToItem({ id: 'u-1', pl: 'a', en: 'b', created: 1 }).cards, ['rec', 'prod']);

  const vocab = buildModule({ module: 'vocabulary', title: 'V', topics: [
    { id: 'v-x', title: 'X', items: [{ id: 'v-0001', pl: 'kot', en: 'cat', cards: ['rec'] }] },
    { id: 'v-mine', title: 'My phrases', items: [] },
  ] });
  const mod = withOwnPhrases(vocab, [
    { id: 'u-b', pl: 'Na zdrowie', en: 'Cheers', created: 2 },
    { id: 'u-a', pl: 'Smacznej kawusi', en: 'Enjoy your coffee', created: 1 },
  ]);
  assert.deepEqual(mod.defs.map((d) => d.id), ['v-0001-rec', 'u-a-rec', 'u-b-rec', 'u-a-prod', 'u-b-prod']);
  assert.equal(mod.defs.find((d) => d.id === 'u-a-prod').requires, 'u-a-rec');
  assert.equal(mod.items.get('u-b').pl, 'Na zdrowie');
  assert.equal(vocab.defs.length, 1, 'the original module is not changed');
});

test('flags export as plain text, sorted by card id', async () => {
  const { flagsAsText } = await import('../js/flags.js');
  const text = flagsAsText([
    { cardId: 'v-0002-rec', text: 'dzień dobry', note: null },
    { cardId: 'g-08-004', text: 'Wczoraj byłem w domu.', note: 'Should this be byłam?' },
  ]);
  assert.equal(text, 'Polski flagged cards (2)\ncard id | card text | note\ng-08-004 | Wczoraj byłem w domu. | Should this be byłam?\nv-0002-rec | dzień dobry\n');
});

test('backup reminder: after 14 days since the last export, or 7 days of study without one', async () => {
  const { backupReminder, lastBackupText } = await import('../js/backup.js');
  const DAY = 86400000, now = Date.UTC(2026, 10, 30);
  assert.equal(backupReminder({ lastBackup: now - 13 * DAY }, now), null);
  assert.deepEqual(backupReminder({ lastBackup: now - 15 * DAY }, now), { daysSince: 15, never: false });
  assert.equal(backupReminder({ firstStudy: now - 6 * DAY }, now), null);
  assert.deepEqual(backupReminder({ firstStudy: now - 8 * DAY }, now), { daysSince: null, never: true });
  assert.equal(backupReminder({ firstStudy: now - 30 * DAY, snoozeUntil: now + DAY }, now), null, 'snoozed');
  assert.equal(backupReminder({}, now), null, 'nothing studied yet');
  assert.equal(lastBackupText(null, now), 'Never exported.');
  assert.equal(lastBackupText(now - 2 * DAY, now), 'Last export: 2 days ago.');
});
