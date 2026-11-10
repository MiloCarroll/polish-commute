import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildModule } from '../js/content.js';

test('pronunciation cards: one per exercise, listening before dictation within a topic', () => {
  const mod = buildModule({ module: 'pronunciation', title: 'P', topics: [{ id: 'pr-01', title: 'T', items: [
    { id: 'pr-01-001', pl: 'kot', en: 'cat', cards: ['listen', 'dict'] },
    { id: 'pr-01-002', pl: 'dom', en: 'house', cards: ['dict', 'listen'] },
    { id: 'pr-01-003', pl: 'mama', en: 'mum', cards: ['stress'] },
  ] }] });
  assert.deepEqual(mod.defs.map((d) => d.id), [
    'pr-01-001-listen', 'pr-01-002-listen', 'pr-01-003-stress', 'pr-01-001-dict', 'pr-01-002-dict',
  ]);
  assert.equal(mod.items.get('pr-01-002').pl, 'dom');
});

test('vocabulary cards: recognition first, other directions locked until it succeeds', async () => {
  const { isUnlocked, applyReview, Rating } = await import('../js/scheduler.js');
  const mod = buildModule({ module: 'vocabulary', title: 'V', topics: [{ id: 'v-x', title: 'X', items: [
    { id: 'v-0001', pl: 'kot', en: 'cat', cards: ['rec', 'prod', 'gap', 'listen'] },
    { id: 'v-0002', pl: 'dom', en: 'house', cards: ['rec', 'prod'] },
    { id: 'v-0003', pl: 'tak', en: 'yes' },
  ] }] });
  assert.deepEqual(mod.defs.map((d) => d.id), [
    'v-0001-rec', 'v-0002-rec', 'v-0003-rec', 'v-0001-listen', 'v-0001-gap', 'v-0001-prod', 'v-0002-prod',
  ]);
  const records = new Map();
  const prod = mod.defs.find((d) => d.id === 'v-0001-prod');
  assert.equal(isUnlocked(prod, records), false);
  const rec = mod.defs[0];
  records.set(rec.id, applyReview(rec, undefined, Rating.Good, new Date()).record);
  assert.equal(isUnlocked(prod, records), true);
});

test('grammar: one card per drill, the drill id is the card id, order kept', () => {
  const mod = buildModule({ module: 'grammar', title: 'G', topics: [{ id: 'g-01', title: 'T', items: [
    { id: 'g-01-001', type: 'choose' }, { id: 'g-01-002', type: 'choose' }, { id: 'g-01-003', type: 'type' },
  ] }] });
  assert.deepEqual(mod.defs.map((d) => [d.id, d.kind]), [['g-01-001', 'choose'], ['g-01-002', 'choose'], ['g-01-003', 'type']]);
});
