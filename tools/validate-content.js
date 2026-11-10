#!/usr/bin/env node
// Validates content/*.json. Run on every content change:  node tools/validate-content.js
// Checks: JSON shape, unique and well-formed IDs, card IDs not removed since the last
// release (tools/released-ids.json), and that Polish text uses only Polish letters.
// Later stages add checks for gap answers and accepted alternatives.
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildModule, MODULES } from '../js/content.js';

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
