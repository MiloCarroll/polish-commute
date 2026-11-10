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
