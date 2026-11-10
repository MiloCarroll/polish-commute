import { test } from 'node:test';
import assert from 'node:assert/strict';
import { variantKey, resolveExample, gapExample, splitGap, findWhole, countWhole } from '../js/variants.js';

const tired = {
  v: {
    mf: { pl: 'Byłem zmęczony.', en: 'I was tired.', gap: 'zmęczony' },
    mm: { pl: 'Byłem zmęczony.', en: 'I was tired.', gap: 'zmęczony' },
    ff: { pl: 'Byłam zmęczona.', en: 'I was tired.', gap: 'zmęczona' },
    fm: { pl: 'Byłam zmęczona.', en: 'I was tired.', gap: 'zmęczona' },
  },
};
const partnerLine = { speaker: 'partner', v: {
  mf: { pl: 'Byłeś głodna?', en: '' }, mm: { pl: 'Byłeś głodny?', en: '' },
  ff: { pl: 'Byłaś głodna?', en: '' }, fm: { pl: 'Byłaś głodny?', en: '' },
} };

test('learner line: speaker is the learner, listener the partner', () => {
  assert.equal(variantKey(tired, { learnerGender: 'm', partnerGender: 'f' }), 'mf');
  assert.equal(resolveExample(tired, { learnerGender: 'm', partnerGender: 'f' }).pl, 'Byłem zmęczony.');
  assert.equal(resolveExample(tired, { learnerGender: 'f', partnerGender: 'm' }).pl, 'Byłam zmęczona.');
});

test('partner line: speaker is the partner, listener the learner', () => {
  assert.equal(variantKey(partnerLine, { learnerGender: 'm', partnerGender: 'f' }), 'fm');
  assert.equal(variantKey(partnerLine, { learnerGender: 'f', partnerGender: 'f' }), 'ff');
  assert.equal(resolveExample(partnerLine, { learnerGender: 'm', partnerGender: 'f' }).speaker, 'partner');
});

test('plain examples pass through unchanged', () => {
  const ex = { pl: 'Mama jest w domu.', en: 'Mum is at home.' };
  assert.equal(resolveExample(ex, {}), ex);
});

test('gapExample picks the first example with a gap, for current genders', () => {
  const item = { examples: [{ pl: 'Tak.', en: 'Yes.' }, tired] };
  assert.equal(gapExample(item, { learnerGender: 'f', partnerGender: 'm' }).gap, 'zmęczona');
});

test('whole-word matching ignores matches inside other words', () => {
  assert.equal(findWhole('Nie mam czasu.', 'mam'), 4);
  assert.equal(findWhole('Mama ma kota.', 'ma'), 5);
  assert.equal(countWhole('Ma ma ma.', 'ma'), 2); // case-sensitive: "Ma" differs
  assert.deepEqual(splitGap('Mam kota.', 'kota'), { before: 'Mam ', after: '.' });
  assert.equal(splitGap('Mam kota.', 'kot'), null);
});

test('resolveDrill overlays the variant for the current genders', async () => {
  const { resolveDrill } = await import('../js/variants.js');
  const item = { id: 'g-08-001', type: 'type', speaker: 'partner', v: {
    mf: { pl: 'x', gap: 'x', en: '' }, mm: { pl: 'x', gap: 'x', en: '' },
    ff: { pl: 'Byłam u mamy.', gap: 'Byłam', en: 'I was at mum’s.' }, fm: { pl: 'Byłam u mamy.', gap: 'Byłam', en: 'I was at mum’s.', reason: 'She says byłam.' },
  } };
  const d = resolveDrill(item, { learnerGender: 'm', partnerGender: 'f' });
  assert.equal(d.gap, 'Byłam');
  assert.equal(d.type, 'type');
  assert.equal(d.reason, 'She says byłam.');
  assert.equal(d.v, undefined);
});

test('dialogue lines: genders from settings or the cast, reachable variant keys', async () => {
  const { resolveLine, reachableKeys, roleLabel } = await import('../js/variants.js');
  const cast = { mama: { name: 'Her mum', gender: 'f' }, tata: { name: 'Her dad', gender: 'm' } };
  const line = { id: 'd-01-004', who: 'mama', to: 'learner', v: {
    fm: { pl: 'Jesteś głodny?', en: 'Are you hungry?' }, ff: { pl: 'Jesteś głodna?', en: 'Are you hungry?' } } };
  assert.deepEqual(reachableKeys(line, cast).sort(), ['ff', 'fm']);
  assert.deepEqual(reachableKeys({ who: 'learner', to: 'partner' }, cast).sort(), ['ff', 'fm', 'mf', 'mm']);
  assert.deepEqual(reachableKeys({ who: 'learner', to: 'all' }, cast).sort(), ['f-', 'm-']);
  assert.equal(resolveLine(line, cast, { learnerGender: 'm', partnerGender: 'f' }).pl, 'Jesteś głodny?');
  assert.equal(resolveLine(line, cast, { learnerGender: 'f', partnerGender: 'm' }).pl, 'Jesteś głodna?');
  assert.equal(resolveLine(line, cast, {}).gender, 'f', "mum's voice is female");
  assert.equal(resolveLine({ who: 'tata', to: 'all', pl: 'Na zdrowie!', en: 'Cheers!' }, cast, {}).gender, 'm');
  assert.equal(roleLabel('partner', cast), 'Your partner');
  assert.equal(roleLabel('tata', cast), 'Her dad');
});
