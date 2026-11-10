// Guards that catch deploy mistakes: stale service worker, invalid content.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeAssets, renderSw } from '../tools/update-sw.js';
import { validate } from '../tools/validate-content.js';
import { MODULES } from '../js/content.js';

test('sw.js lists every app file and has the current version (run tools/update-sw.js)', () => {
  const src = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.equal(src, renderSw(src, computeAssets()));
});

test('content validates', () => {
  const contents = Object.fromEntries(MODULES.map((m) =>
    [m, JSON.parse(readFileSync(new URL(`../content/${m}.json`, import.meta.url), 'utf8'))]));
  const { errors } = validate(contents);
  assert.deepEqual(errors, []);
});

test('validator rejects non-Polish letters and duplicate ids', () => {
  const vocab = { module: 'vocabulary', title: 'V', topics: [{ id: 'v-x', title: 'X', items: [
    { id: 'v-0001', pl: 'café', en: 'cafe', pos: 'noun', gender: 'f', rank: 1, examples: [{ pl: 'Kawa.', en: 'Coffee.' }] },
    { id: 'v-0001', pl: 'kawa', en: 'coffee', pos: 'noun', gender: 'f', rank: 2, examples: [{ pl: 'Kawa.', en: 'Coffee.' }] },
  ] }] };
  const empty = (m) => ({ module: m, title: m, topics: [] });
  const { errors } = validate({ pronunciation: empty('pronunciation'), grammar: empty('grammar'), vocabulary: vocab });
  assert.ok(errors.some((e) => e.includes('non-Polish letter "é"')));
  assert.ok(errors.some((e) => e.includes('duplicate item id')));
});

import { phoneticKey, syllableCount } from '../tools/validate-content.js';

test('phoneticKey treats same-sounding spellings as equal', () => {
  for (const [a, b] of [['może', 'morze'], ['siano', 'śano'], ['chleb', 'chlep'], ['kąt', 'kont'], ['trzy', 'tszy'], ['góra', 'gura'], ['ham', 'cham']]) {
    assert.equal(phoneticKey(a), phoneticKey(b), `${a} / ${b}`);
  }
  for (const [a, b] of [['kasza', 'kasa'], ['czy', 'ci'], ['być', 'bić'], ['ręka', 'rąka'], ['łapa', 'lapa']]) {
    assert.notEqual(phoneticKey(a), phoneticKey(b), `${a} / ${b}`);
  }
});

test('syllableCount ignores softening i before a vowel', () => {
  const cases = { siostra: 2, nie: 1, szczęście: 2, matematyka: 5, byliśmy: 3, ciocia: 2, pianino: 3, muzeum: 3 };
  for (const [w, n] of Object.entries(cases)) assert.equal(syllableCount(w), n, w);
});

test('validator catches pronunciation mistakes', () => {
  const empty = (m) => ({ module: m, title: m, topics: [] });
  const pron = { module: 'pronunciation', title: 'P', topics: [{ id: 'pr-01', title: 'T',
    lesson: { summary: 'S', body: ['B {{kot}}'], letters: [] },
    items: [
      { id: 'pr-01-001', pl: 'może', en: 'maybe', cards: ['listen'], listen: { options: ['może', 'morze', 'może'] } },
      { id: 'pr-01-002', pl: 'muzyka', en: 'music', cards: ['stress'], syll: ['mu', 'zy', 'ka'], stress: 0 },
      { id: 'pr-01-003', pl: 'szafa', en: 'wardrobe', cards: ['stress'], syll: ['sza', 'ffa'], stress: 0 },
    ] }] };
  const { errors } = validate({ pronunciation: pron, vocabulary: empty('vocabulary'), grammar: empty('grammar') });
  assert.ok(errors.some((e) => e.includes('sound the same')), 'homophone options');
  assert.ok(errors.some((e) => e.includes('pr-01-002') && e.includes('stressNote')), 'unexplained exception');
  assert.ok(errors.some((e) => e.includes('pr-01-003') && e.includes('do not spell')), 'bad syllables');
});
