// Typed-answer grading. Pure functions, unit-tested with `node --test`.
//
// Result      Shown to learner                       FSRS rating
// correct     "Correct"                              Good (Easy offered)
// accents     "Nearly: watch the accents"            Hard
// homophone   "Same sound, different spelling"       Hard   (pronunciation dictation only)
// typo        "Typo? Try once more"                  retry; then correct → Hard
// wrong       the correct answer, highlighted        Again

import { Rating } from './scheduler.js';

const FINAL_PUNCT = /[\s.,!?;:…"'“”„»«)(-]+$/u;
const ACCENTS = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' };

/** Trim, lower-case, collapse spaces, drop final punctuation, unify typographic quotes. */
export function normalise(s) {
  return String(s ?? '')
    .normalize('NFC')
    .replace(/[’‘]/g, "'")
    .toLocaleLowerCase('pl')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(FINAL_PUNCT, '')
    .trim();
}

export function stripAccents(s) {
  return s.replace(/[ąćęłńóśźż]/g, (c) => ACCENTS[c]);
}

/** Spellings that sound identical: ó/u, rz/ż, ch/h. */
export function soundKey(s) {
  return s.replace(/ó/g, 'u').replace(/rz/g, 'ż').replace(/ch/g, 'h');
}

/** Edit distance with adjacent transpositions counted as one edit (optimal string alignment). */
export function editDistance(a, b) {
  const A = [...a], B = [...b];
  const d = Array.from({ length: A.length + 1 }, (_, i) => [i, ...Array(B.length).fill(0)]);
  for (let j = 1; j <= B.length; j++) d[0][j] = j;
  for (let i = 1; i <= A.length; i++) {
    for (let j = 1; j <= B.length; j++) {
      const cost = A[i - 1] === B[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && A[i - 1] === B[j - 2] && A[i - 2] === B[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[A.length][B.length];
}

/**
 * Grade a typed answer.
 *   answers: [main answer, ...accepted alternatives]
 *   opts.homophones: treat same-sounding spellings as "homophone" (dictation)
 *   opts.attempt: 1 for the first try, 2 after a "typo" retry
 * Returns { result, expected, rating, retry }.
 */
export function grade(input, answers, { homophones = false, attempt = 1 } = {}) {
  const given = normalise(input);
  const targets = answers.map((a) => ({ raw: a, n: normalise(a) }));
  const main = targets[0];

  const exact = targets.find((t) => t.n === given);
  if (exact && given) {
    return { result: 'correct', expected: exact.raw, rating: attempt === 1 ? Rating.Good : Rating.Hard, retry: false };
  }
  const acc = targets.find((t) => stripAccents(t.n) === stripAccents(given));
  if (acc && given) return { result: 'accents', expected: acc.raw, rating: Rating.Hard, retry: false };

  if (homophones) {
    const h = targets.find((t) => soundKey(t.n) === soundKey(given));
    if (h && given) return { result: 'homophone', expected: h.raw, rating: Rating.Hard, retry: false };
  }

  if (attempt === 1 && given) {
    const typo = targets.find((t) => [...t.n].length > 4 && editDistance(t.n, given) === 1);
    if (typo) return { result: 'typo', expected: typo.raw, rating: null, retry: true };
  }

  // Show the closest accepted answer.
  const closest = targets.reduce((best, t) =>
    editDistance(t.n, given) < editDistance(best.n, given) ? t : best, main);
  return { result: 'wrong', expected: closest.raw, rating: Rating.Again, retry: false };
}

/**
 * Character diff for highlighting: segments of the expected answer marked
 * "same" or "diff" relative to what was typed (LCS alignment, case-insensitive).
 */
export function diffExpected(input, expected) {
  const a = [...normalise(input)];
  const b = [...expected];
  const bl = [...expected.toLocaleLowerCase('pl')];
  const m = a.length, n = b.length;
  const L = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      L[i][j] = a[i] === bl[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    }
  }
  const marks = Array(n).fill(false);
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (a[i] === bl[j]) { marks[j] = true; i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  }
  const segs = [];
  b.forEach((ch, k) => {
    const type = marks[k] || ch === ' ' ? 'same' : 'diff';
    const last = segs[segs.length - 1];
    if (last && last.type === type) last.text += ch; else segs.push({ text: ch, type });
  });
  return segs;
}

export const MESSAGES = {
  correct: 'Correct',
  accents: 'Nearly: watch the accents',
  homophone: 'Same sound, different spelling',
  typo: 'Typo? Try once more',
  wrong: 'Not quite',
};
