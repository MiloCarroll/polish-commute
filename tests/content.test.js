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

test('vocabulary cards: in batches of 5 words, typed cards before self-graded ones, unlocked once recognition is seen', async () => {
  const { isUnlocked, applyReview, Rating } = await import('../js/scheduler.js');
  const ex = [{ pl: 'Mam kota.', en: 'I have a cat.' }];
  const items = [
    { id: 'v-0001', pl: 'kot', en: 'cat', cards: ['rec', 'prod', 'gap', 'listen'], examples: ex },
    { id: 'v-0002', pl: 'dom', en: 'house', cards: ['rec', 'prod'] },
    { id: 'v-0003', pl: 'tak', en: 'yes' },
    { id: 'v-0004', pl: 'nie', en: 'no' },
    { id: 'v-0005', pl: 'pies', en: 'dog' },
    { id: 'v-0006', pl: 'mama', en: 'mum' },
  ];
  const mod = buildModule({ module: 'vocabulary', title: 'V', topics: [{ id: 'v-x', title: 'X', items }] });
  assert.deepEqual(mod.defs.map((d) => d.id), [
    'v-0001-rec', 'v-0002-rec', 'v-0003-rec', 'v-0004-rec', 'v-0005-rec',
    'v-0001-dict', 'v-0002-dict', 'v-0003-dict', 'v-0004-dict', 'v-0005-dict',
    'v-0001-gap', 'v-0001-prod', 'v-0002-prod', 'v-0001-sdict', 'v-0001-listen', 'v-0001-say',
    'v-0006-rec', 'v-0006-dict',
  ]);
  const records = new Map();
  const prod = mod.defs.find((d) => d.id === 'v-0001-prod');
  assert.equal(isUnlocked(prod, records), false);
  const rec = mod.defs[0];
  records.set(rec.id, applyReview(rec, undefined, Rating.Again, new Date()).record);
  assert.equal(isUnlocked(prod, records), true);
});

test('vocabulary: sentence dictation also for lines the partner says', () => {
  const mod = buildModule({ module: 'vocabulary', title: 'V', topics: [{ id: 'v-x', title: 'X', items: [
    { id: 'v-0002', pl: 'pies', en: 'dog', cards: ['rec', 'listen'], examples: [{ speaker: 'partner', v: {} }] },
  ] }] });
  assert.ok(mod.defs.some((d) => d.id === 'v-0002-sdict' && d.requires === 'v-0002-rec'));
});

test('grammar: one card per drill, the drill id is the card id, order kept', () => {
  const mod = buildModule({ module: 'grammar', title: 'G', topics: [{ id: 'g-01', title: 'T', items: [
    { id: 'g-01-001', type: 'choose' }, { id: 'g-01-002', type: 'choose' }, { id: 'g-01-003', type: 'type' },
  ] }] });
  assert.deepEqual(mod.defs.map((d) => [d.id, d.kind]), [['g-01-001', 'choose'], ['g-01-002', 'choose'], ['g-01-003', 'type']]);
});

test('dialogues: a listening card per line, plus a "your turn" card for the learner\'s lines', () => {
  const mod = buildModule({ module: 'dialogues', title: 'C', topics: [{ id: 'd-01', title: 'T', cast: {}, items: [
    { id: 'd-01-001', who: 'partner', to: 'learner' }, { id: 'd-01-002', who: 'learner', to: 'partner' },
  ] }] });
  assert.deepEqual(mod.defs.map((d) => d.id), ['d-01-001-listen', 'd-01-002-listen', 'd-01-002-say']);
  assert.equal(mod.defs[2].requires, 'd-01-002-listen');
});

test('vocabulary: items with a listening card also get a whole-sentence "say" card', () => {
  const mod = buildModule({ module: 'vocabulary', title: 'V', topics: [{ id: 'v-x', title: 'X', items: [
    { id: 'v-0001', pl: 'kot', en: 'cat', cards: ['rec', 'listen'], examples: [{ pl: 'Mam kota.', en: 'I have a cat.' }] },
    { id: 'v-0002', pl: 'pies', en: 'dog', cards: ['rec', 'listen'], examples: [{ speaker: 'partner', v: {} }] },
  ] }] });
  assert.ok(mod.defs.some((d) => d.id === 'v-0001-say' && d.requires === 'v-0001-rec'));
  assert.ok(!mod.defs.some((d) => d.id === 'v-0002-say'), "no say card for the partner's lines");
});
