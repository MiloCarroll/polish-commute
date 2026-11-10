import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalise, stripAccents, soundKey, editDistance, grade, diffExpected } from '../js/grading.js';
import { Rating } from '../js/scheduler.js';

test('normalise: trim, case, spaces, final punctuation', () => {
  assert.equal(normalise('  Dzień   Dobry!  '), 'dzień dobry');
  assert.equal(normalise('Tak.'), 'tak');
  assert.equal(normalise('Co słychać?'), 'co słychać');
  assert.equal(normalise('ŻÓŁW'), 'żółw');
  // Decomposed input (e.g. from some keyboards) compares equal to precomposed.
  assert.equal(normalise('żółw'), 'żółw');
});

test('stripAccents and soundKey', () => {
  assert.equal(stripAccents('zażółć gęślą jaźń'), 'zazolc gesla jazn');
  assert.equal(soundKey('morze'), soundKey('może'));
  assert.equal(soundKey('góra'), 'gura');
  assert.equal(soundKey('chleb'), 'hleb');
});

test('editDistance counts a swap as one edit', () => {
  assert.equal(editDistance('kot', 'kot'), 0);
  assert.equal(editDistance('szafa', 'szfa'), 1);
  assert.equal(editDistance('szafa', 'szaaf'), 1);
  assert.equal(editDistance('dom', 'kot'), 2);
});

test('exact match is correct → Good', () => {
  const g = grade(' Szafa ', ['szafa']);
  assert.equal(g.result, 'correct');
  assert.equal(g.rating, Rating.Good);
});

test('accepted alternatives', () => {
  assert.equal(grade('morze', ['może', 'morze']).result, 'correct');
});

test('missing accents → nearly, Hard', () => {
  const g = grade('zolw', ['żółw']);
  assert.equal(g.result, 'accents');
  assert.equal(g.rating, Rating.Hard);
});

test('same-sounding spelling → homophone, Hard (dictation only)', () => {
  assert.equal(grade('gura', ['góra'], { homophones: true }).result, 'homophone');
  assert.equal(grade('rzaba', ['żaba'], { homophones: true }).result, 'homophone');
  assert.equal(grade('rzaba', ['żaba']).result, 'wrong');
});

test('one typo on a long word → retry; then correct → Hard', () => {
  const first = grade('szfa', ['szafa']);
  assert.equal(first.result, 'typo');
  assert.equal(first.retry, true);
  const second = grade('szafa', ['szafa'], { attempt: 2 });
  assert.equal(second.result, 'correct');
  assert.equal(second.rating, Rating.Hard);
  const again = grade('szfa', ['szafa'], { attempt: 2 });
  assert.equal(again.result, 'wrong');
  assert.equal(again.rating, Rating.Again);
});

test('no typo allowance on short words', () => {
  assert.equal(grade('kit', ['kot']).result, 'wrong');
  assert.equal(grade('dmo', ['domu']).result, 'wrong'); // 4 letters: not > 4
});

test('empty answer is wrong', () => {
  assert.equal(grade('', ['tak']).result, 'wrong');
});

test('diffExpected marks the differing letters', () => {
  const flat = (segs) => segs.map((s) => (s.type === 'diff' ? `[${s.text}]` : s.text)).join('');
  assert.equal(flat(diffExpected('zolw', 'żółw')), '[żół]w');
  assert.equal(flat(diffExpected('szfa', 'szafa')), 'sz[a]fa');
  assert.equal(flat(diffExpected('kot', 'kot')), 'kot');
});
