#!/usr/bin/env node
// Validates content/*.json. Run on every content change:  node tools/validate-content.js
// Checks: JSON shape, unique and well-formed IDs, card IDs not removed since the last
// release (tools/released-ids.json), and that Polish text uses only Polish letters.
// Later stages add checks for gap answers and accepted alternatives.
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildModule, MODULES } from '../js/content.js';
import { normalise } from '../js/grading.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RELEASED = join(ROOT, 'tools', 'released-ids.json');

// Polish alphabet (no q, v, x except in loanwords — those are allowed but warned about).
const POLISH_LETTERS = /^[a-ząćęłńóśźżA-ZĄĆĘŁŃÓŚŹŻqvxQVX]$/u;
const LOAN_LETTERS = /[qvxQVX]/;
const ID_PATTERNS = {
  pronunciation: /^pr-\d{2}-\d{3}$/,
  vocabulary: /^v-\d{4}$/,
  grammar: /^g-\d{2}-\d{3}$/,
};
const TOPIC_PATTERNS = {
  pronunciation: /^pr-\d{2}$/,
  vocabulary: /^v-[a-z0-9-]+$/,
  grammar: /^g-\d{2}$/,
};


// ---- Pronunciation helpers ---------------------------------------------------

const VOWELS = 'aąeęioóuy';

/** Number of spoken syllables: vowels, not counting an i that directly precedes another vowel. */
export function syllableCount(word) {
  const w = word.toLowerCase().replace(/\s+/g, '');
  let n = 0;
  for (let i = 0; i < w.length; i++) {
    if (!VOWELS.includes(w[i])) continue;
    if (w[i] === 'i' && i + 1 < w.length && VOWELS.includes(w[i + 1]) && i > 0 && !VOWELS.includes(w[i - 1])) continue;
    n++;
  }
  return n;
}

/**
 * Rough phonetic key: spellings that standard Polish pronounces the same map to the
 * same key. Used to catch listen-card options that cannot be told apart by ear.
 */
export function phoneticKey(word) {
  let w = normalise(word);
  w = w.replace(/ó/g, 'u').replace(/ch/g, 'h');
  w = w.replace(/([ptk]|h)rz/g, '$1sz').replace(/rz/g, 'ż');
  w = w.replace(/si(?=[aąeęouy])/g, 'ś').replace(/ci(?=[aąeęouy])/g, 'ć')
       .replace(/zi(?=[aąeęouy])/g, 'ź').replace(/ni(?=[aąeęouy])/g, 'ń')
       .replace(/si$/, 'śi').replace(/ci$/, 'ći').replace(/zi$/, 'źi').replace(/ni$/, 'ńi');
  w = w.replace(/ą(?=[pb])/g, 'om').replace(/ę(?=[pb])/g, 'em')
       .replace(/ą(?=[tdcćkg]|dz|dź)/g, 'on').replace(/ę(?=[tdcćkg]|dz|dź)/g, 'en')
       .replace(/ę$/, 'e');
  // Final devoicing, applied word by word.
  const FINAL = [['dż', 'cz'], ['dź', 'ć'], ['dz', 'c'], ['ż', 'sz'], ['ź', 'ś'], ['b', 'p'], ['d', 't'], ['g', 'k'], ['w', 'f'], ['z', 's']];
  w = w.split(' ').map((t) => {
    for (const [v, u] of FINAL) if (t.endsWith(v)) return t.slice(0, -v.length) + u;
    return t;
  }).join(' ');
  return w;
}

function validatePronunciation(json, err, checkPolish) {
  const KINDS = ['listen', 'dict', 'stress'];
  for (const t of json.topics) {
    const tw = `pronunciation/${t.id}`;
    if (!t.items.length) continue; // placeholder topic
    const L = t.lesson;
    if (!L || typeof L.summary !== 'string' || !Array.isArray(L.body) || !L.body.length) err(tw, 'lesson needs summary and body');
    const textWords = [L?.summary, ...(L?.body ?? []), ...(L?.more ?? []), ...(L?.letters ?? []).map((l) => l.sound)]
      .filter(Boolean).flatMap((p) => [...p.matchAll(/\{\{(.+?)\}\}/g)].map((m) => m[1]));
    textWords.forEach((w) => checkPolish(`${tw}/lesson`, w));
    for (const l of L?.letters ?? []) {
      if (!l.spelling || !l.sound) err(`${tw}/lesson`, 'letter needs spelling and sound');
      (l.examples ?? []).forEach((w) => checkPolish(`${tw}/lesson/${l.spelling}`, w));
    }
    for (const it of t.items) {
      const w = `${tw}/${it.id}`;
      checkPolish(w, it.pl);
      if (typeof it.en !== 'string' || !it.en) err(w, 'missing English');
      if (!Array.isArray(it.cards) || !it.cards.length || it.cards.some((k) => !KINDS.includes(k)) || new Set(it.cards).size !== it.cards.length) {
        err(w, `cards must be a non-empty list of ${KINDS.join('/')}`);
        continue;
      }
      (it.alts ?? []).forEach((a) => checkPolish(`${w}/alts`, a));
      if (it.cards.includes('listen')) {
        const L2 = it.listen;
        if (!L2 || !Array.isArray(L2.options) || L2.options.length < 2 || L2.options.length > 4) { err(w, 'listen needs 2–4 options'); }
        else {
          const answer = L2.answer ?? it.pl;
          if (!L2.options.includes(answer)) err(w, `listen answer "${answer}" is not among the options`);
          if (new Set(L2.options).size !== L2.options.length) err(w, 'duplicate listen options');
          L2.options.forEach((o) => checkPolish(`${w}/options`, o));
          if (L2.answer === undefined) {
            if (L2.options.length < 3) err(w, 'listen needs 3–4 word options');
            const keys = new Map();
            for (const o of L2.options) {
              const k = phoneticKey(o);
              if (keys.has(k)) err(w, `options "${keys.get(k)}" and "${o}" sound the same`);
              keys.set(k, o);
            }
          } else if (typeof L2.q !== 'string' || !L2.q) err(w, 'listen with a custom answer needs a question (q)');
        }
      }
      if (it.cards.includes('stress')) {
        if (!Array.isArray(it.syll) || it.syll.length < 2) { err(w, 'stress needs syll (2+ syllables)'); continue; }
        if (it.syll.join('') !== it.pl.replace(/\s+/g, '')) err(w, `syllables "${it.syll.join('-')}" do not spell "${it.pl}"`);
        if (syllableCount(it.pl) !== it.syll.length) err(w, `"${it.pl}" has ${syllableCount(it.pl)} syllables but syll lists ${it.syll.length}`);
        it.syll.forEach((s) => { if (syllableCount(s) !== 1) err(w, `syllable "${s}" should contain exactly one vowel sound`); });
        if (!Number.isInteger(it.stress) || it.stress < 0 || it.stress >= it.syll.length) err(w, 'stress index out of range');
        else if (it.stress !== it.syll.length - 2 && !it.stressNote) err(w, 'stress is not second-to-last: add stressNote explaining the exception');
      }
    }
  }
}

export function validate(contents) {
  const errors = [];
  const warnings = [];
  const itemIds = new Set();
  const cardIds = new Set();
  const err = (where, msg) => errors.push(`${where}: ${msg}`);

  function checkPolish(where, text) {
    if (typeof text !== 'string' || !text.trim()) return err(where, 'missing Polish text');
    for (const ch of text) {
      if (/\p{L}/u.test(ch) && !POLISH_LETTERS.test(ch)) err(where, `non-Polish letter "${ch}" in "${text}"`);
    }
    if (LOAN_LETTERS.test(text)) warnings.push(`${where}: q/v/x in "${text}" (loanword?)`);
    if (/\s{2,}/.test(text) || text !== text.trim()) err(where, `stray whitespace in "${text}"`);
  }

  for (const m of MODULES) {
    const json = contents[m];
    if (!json) { err(m, 'missing content file'); continue; }
    if (json.module !== m) err(m, `"module" should be "${m}"`);
    if (typeof json.title !== 'string') err(m, 'missing title');
    if (!Array.isArray(json.topics)) { err(m, 'topics must be an array'); continue; }
    const topicIds = new Set();
    for (const t of json.topics) {
      const tw = `${m}/${t.id}`;
      if (!TOPIC_PATTERNS[m].test(t.id ?? '')) err(tw, 'bad topic id');
      if (topicIds.has(t.id)) err(tw, 'duplicate topic id');
      topicIds.add(t.id);
      if (typeof t.title !== 'string' || !t.title) err(tw, 'missing title');
      if (!Array.isArray(t.items)) { err(tw, 'items must be an array'); continue; }
      for (const it of t.items) {
        const w = `${tw}/${it.id}`;
        if (!ID_PATTERNS[m].test(it.id ?? '')) err(w, 'bad item id');
        if (itemIds.has(it.id)) err(w, 'duplicate item id');
        itemIds.add(it.id);
        if (m === 'vocabulary') {
          checkPolish(w, it.pl);
          if (typeof it.en !== 'string' || !it.en) err(w, 'missing English');
          if (typeof it.pos !== 'string' || !it.pos) err(w, 'missing part of speech');
          if (!Number.isInteger(it.rank)) err(w, 'missing frequency rank');
          if (it.pos === 'noun' && !['m', 'f', 'n', 'mpl', 'npl'].includes(it.gender)) err(w, 'noun needs gender');
          if (it.pos === 'verb' && !('aspectPair' in it)) err(w, 'verb needs aspectPair (null if none)');
          if (!Array.isArray(it.examples) || !it.examples.length) err(w, 'needs at least one example');
          for (const [i, ex] of (it.examples ?? []).entries()) {
            checkPolish(`${w}/ex${i}`, ex.pl);
            if (typeof ex.en !== 'string' || !ex.en) err(`${w}/ex${i}`, 'missing translation');
          }
        }
      }
    }
    if (m === 'pronunciation') validatePronunciation(json, err, checkPolish);
    for (const def of buildModule(structuredClone(json)).defs) {
      if (cardIds.has(def.id)) err(def.id, 'duplicate card id');
      cardIds.add(def.id);
    }
  }
  return { errors, warnings, cardIds };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const contents = {};
  for (const m of MODULES) contents[m] = JSON.parse(readFileSync(join(ROOT, 'content', `${m}.json`), 'utf8'));
  const { errors, warnings, cardIds } = validate(contents);

  // Released card IDs must never disappear (progress is keyed by them).
  const released = existsSync(RELEASED) ? JSON.parse(readFileSync(RELEASED, 'utf8')) : [];
  for (const id of released) if (!cardIds.has(id)) errors.push(`${id}: released card id was removed or renamed`);
  if (process.argv.includes('--release')) {
    writeFileSync(RELEASED, JSON.stringify([...new Set([...released, ...cardIds])].sort(), null, 1) + '\n');
    console.log('Recorded released card ids.');
  }

  warnings.forEach((w) => console.warn(`warning  ${w}`));
  errors.forEach((e) => console.error(`error    ${e}`));
  console.log(`${cardIds.size} cards, ${errors.length} errors, ${warnings.length} warnings`);
  process.exit(errors.length ? 1 : 0);
}
