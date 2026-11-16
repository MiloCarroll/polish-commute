import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { pickRound, isMarked } from '../js/practice.js';
import { audioFrames, silence, stepsFor, frameAt } from '../js/handsfree.js';

const def = (id, module, kind) => ({ id, module, kind });

test('practice: only studied, marked cards that are not due; weakest first', () => {
  const now = 1_000_000;
  const defs = [
    def('a', 'vocabulary', 'prod'), def('b', 'vocabulary', 'rec'), def('c', 'vocabulary', 'dict'),
    def('d', 'grammar', 'choose'), def('e', 'dialogues', 'say'), def('f', 'dialogues', 'listen'),
    def('g', 'vocabulary', 'sdict'), def('h', 'pronunciation', 'listen'),
  ];
  const later = now + 86400000;
  const records = new Map([
    ['a', { due: later, stability: 30, lapses: 0, state: 2 }],
    ['b', { due: later, stability: 1, lapses: 3, state: 2 }],      // self-graded: never
    ['c', { due: now - 1, stability: 1, lapses: 0, state: 2 }],    // due: belongs in a review
    ['d', { due: later, stability: 0.5, lapses: 4, state: 2 }],
    ['e', { due: later, stability: 5, lapses: 0, state: 2 }],
    ['f', { due: later, stability: 5, lapses: 0, state: 2 }],      // self-graded
    ['h', { due: later, stability: 5, lapses: 0, state: 2 }],
  ]);
  const round = pickRound(defs, records, { now, rand: () => 0 });
  assert.deepEqual(round.map((d) => d.id).sort(), ['a', 'd', 'e', 'h']);
  assert.equal(pickRound(defs, records, { now, size: 1, rand: () => 0 })[0].id, 'd', 'weakest card first');
  assert.ok(isMarked(def('x', 'pronunciation', 'dict')));
  assert.ok(!isMarked(def('x', 'vocabulary', 'say')));
});

test('hands-free: clip frames joined with silence keep their length', () => {
  const dir = new URL('../content/audio/f/', import.meta.url);
  const name = readdirSync(dir).find((f) => f.endsWith('.mp3'));
  const clip = audioFrames(readFileSync(new URL(name, dir)));
  assert.ok(clip.seconds > 0.3 && clip.seconds < 20);
  assert.ok(frameAt(clip.bytes, 0), 'starts on a frame');
  const s = silence(2);
  assert.ok(Math.abs(s.seconds - 2) < 0.03);
  const f = frameAt(s.bytes, 0);
  assert.deepEqual([f.length, f.sr, f.mono], [144, 24000, true]);
  // The silent frame matches the clips' format.
  const c = frameAt(clip.bytes, 0);
  assert.deepEqual([c.sr, c.mono, c.samples], [f.sr, f.mono, f.samples]);
});

test('hands-free: steps per mode', () => {
  assert.deepEqual(stepsFor({ pl: 'p', en: 'e' }, 'understand', 4).filter((x) => x.clip).map((x) => x.clip), ['p', 'p', 'e']);
  assert.deepEqual(stepsFor({ pl: 'p', en: 'e' }, 'speak', 4).filter((x) => x.clip).map((x) => x.clip), ['e', 'p', 'p']);
  assert.equal(stepsFor({ pl: 'p', en: null }, 'speak', 4), null);
  assert.deepEqual(stepsFor({ pl: 'p', en: null }, 'understand', 4).filter((x) => x.clip).length, 2);
});

test('workload forecast: more new cards a day means more reviews later', async () => {
  const { forecast, forecastAverage } = await import('../js/stats.js');
  const now = new Date(2026, 10, 16, 12);
  const low = forecast([], { newPerDay: 10, now, days: 21 });
  const high = forecast([], { newPerDay: 40, now, days: 21 });
  assert.equal(low.length, 21);
  assert.equal(low[0].reviews, 0, 'nothing started before tomorrow, so no reviews on day one');
  assert.ok(low[0].newShown >= 10, 'each new card is shown at least once');
  const l = forecastAverage(low, 14, 21), h = forecastAverage(high, 14, 21);
  assert.ok(l.reviews > 0 && h.reviews > 2.5 * l.reviews, `${l.reviews} vs ${h.reviews}`);
  // Same inputs, same answer (seeded).
  assert.deepEqual(forecast([], { newPerDay: 10, now, days: 5 }).map((d) => d.newShown), forecast([], { newPerDay: 10, now, days: 5 }).map((d) => d.newShown));
});
