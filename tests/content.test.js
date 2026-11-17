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

test('contrast cards need all their words seen and come after the last word\'s batch', async () => {
  const { readFileSync } = await import('node:fs');
  const { buildModule: build } = await import('../js/content.js');
  const mod = build(JSON.parse(readFileSync(new URL('../content/vocabulary.json', import.meta.url), 'utf8')));
  const c = mod.defs.find((d) => d.id === 'vc-02');
  assert.equal(c.kind, 'contrast');
  assert.deepEqual(c.requires, ['v-0106-rec', 'v-0006-rec', 'v-0104-rec', 'v-0117-rec', 'v-0107-rec']);
  const ids = mod.defs.map((d) => d.id);
  assert.ok(ids.indexOf('vc-02') > ids.indexOf('v-0117-say') || ids.indexOf('vc-02') > ids.indexOf('v-0117-prod'));
  for (const t of mod.topics) for (const k of t.contrasts ?? []) for (const s of k.scenarios) {
    const pls = k.options.map((o) => o.pl);
    for (const w of k.words) assert.ok(mod.items.has(w), `${k.id}: unknown word ${w}`);
    assert.ok(pls.includes(s.answer), `${k.id}: ${s.answer}`);
    for (const a of s.also ?? []) assert.ok(pls.includes(a), `${k.id}: ${a}`);
  }
});

test('silent mode holds back only the cards that need sound', async () => {
  const { needsSound } = await import('../js/content.js');
  const k = (module, kind) => needsSound({ module, kind });
  assert.deepEqual(['dict', 'sdict', 'listen', 'rec', 'prod', 'gap', 'say', 'contrast'].map((x) => k('vocabulary', x)),
    [true, true, true, false, false, false, false, false]);
  assert.deepEqual(['listen', 'dict', 'stress'].map((x) => k('pronunciation', x)), [true, true, false]);
  assert.deepEqual(['listen', 'say'].map((x) => k('dialogues', x)), [true, false]);
  assert.equal(k('grammar', 'type'), false);
});

test('vocabulary order: most common first, same-topic words spaced out, situations kept together', async () => {
  const { vocabularyOrder, VOCAB_SPACING } = await import('../js/content.js');
  const items = (p, n, rank0, step = 1) => Array.from({ length: n }, (_, i) => ({ id: `${p}${i}`, rank: rank0 + i * step }));
  const topics = [
    { id: 'family', items: items('f', 6, 10) },               // very common, but a similar-meaning set
    ...'abcdeghijk'.split('').map((p, k) => ({ id: p, items: items(p, 6, 100 + k * 10) })),
    { id: 'table', keepTogether: true, items: items('t', 4, 50) },
  ];
  const order = vocabularyOrder(topics).map((it) => it.id);
  assert.equal(order[0], 'f0', 'the most common word first');
  const fam = order.map((id, i) => (id.startsWith('f') ? i : -1)).filter((i) => i >= 0);
  for (let i = 1; i < fam.length; i++) assert.ok(fam[i] - fam[i - 1] >= VOCAB_SPACING, `family words ${fam[i - 1]} and ${fam[i]} too close`);
  const tab = order.map((id, i) => (id.startsWith('t') ? i : -1)).filter((i) => i >= 0);
  assert.deepEqual(tab, [tab[0], tab[0] + 1, tab[0] + 2, tab[0] + 3], 'a situation topic stays together');
  assert.equal(new Set(order).size, order.length);
});

test('words started on an earlier day get their next card before new words start', async () => {
  const { pickNext, applyReview, Rating } = await import('../js/scheduler.js');
  const defs = [
    { id: 'a-rec', module: 'vocabulary', kind: 'rec' },
    { id: 'b-rec', module: 'vocabulary', kind: 'rec' },
    { id: 'z-rec', module: 'vocabulary', kind: 'rec' },
    { id: 'z-dict', module: 'vocabulary', kind: 'dict', requires: 'z-rec' },
  ];
  const yesterday = new Date(2026, 10, 16, 10), today = new Date(2026, 10, 17, 10);
  const records = new Map([['z-rec', { ...applyReview(defs[2], undefined, Rating.Good, yesterday).record, due: today.getTime() + 864e5 }]]);
  assert.equal(pickNext(defs, records, 5, today).def.id, 'z-dict');
  // Started today: the usual order (a new word first, the follow-up later in its batch).
  const fresh = new Map([['z-rec', { ...applyReview(defs[2], undefined, Rating.Good, today).record, due: today.getTime() + 864e5 }]]);
  assert.equal(pickNext(defs, fresh, 5, today).def.id, 'a-rec');
});
