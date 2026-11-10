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
