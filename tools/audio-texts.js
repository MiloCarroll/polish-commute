#!/usr/bin/env node
// Lists every Polish text the app can speak (words, phrases, example sentences in every
// gender variant, grammar sentences, lesson words). Used to generate bundled audio clips.
//   node tools/audio-texts.js          → prints a summary
//   node tools/audio-texts.js --list   → prints one text per line
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (m) => JSON.parse(readFileSync(join(ROOT, 'content', `${m}.json`), 'utf8'));

/** The key a clip is stored under: the exact text, Unicode-normalised and trimmed. */
export const clipKey = (text) => String(text).normalize('NFC').replace(/\s+/g, ' ').trim();

/**
 * Every speakable text with the gender of its speaker where the sentence depends on it:
 * Map text → Set of 'm' / 'f' (empty set = no particular speaker).
 */
export function collectSpeech() {
  const out = new Map();
  const add = (t, gender = null) => {
    if (!t || !/\p{L}/u.test(t)) return;
    const k = clipKey(t);
    if (!out.has(k)) out.set(k, new Set());
    if (gender) out.get(k).add(gender);
  };
  const braces = (s) => [...String(s ?? '').matchAll(/\{\{(.+?)\}\}/g)].forEach((m) => add(m[1]));
  const lesson = (L) => {
    if (!L) return;
    [L.summary, ...(L.body ?? []), ...(L.more ?? []), ...(L.letters ?? []).map((l) => l.sound),
      ...(L.table?.rows?.flat() ?? []), ...(L.table?.head ?? [])].forEach(braces);
    (L.letters ?? []).forEach((l) => (l.examples ?? []).forEach(add));
  };
  // Variant keys are speaker gender + listener gender, so the first letter is the speaker's.
  const variants = (x) => (x?.v ? Object.entries(x.v).map(([k, v]) => [v, k[0]]) : [[x, null]]);

  for (const t of load('pronunciation').topics) { lesson(t.lesson); t.items.forEach((i) => add(i.pl)); }
  for (const t of load('vocabulary').topics) {
    for (const i of t.items) {
      add(i.pl);
      if (i.forms) Object.values(i.forms).forEach(add);
      (i.examples ?? []).forEach((e) => variants(e).forEach(([v, g]) => add(v.pl, g)));
    }
  }
  for (const t of load('grammar').topics) { lesson(t.lesson); t.items.forEach((i) => variants(i).forEach(([v, g]) => add(v.pl, g))); }
  // Dialogues: each line in its speaker's voice. Lines by the learner or partner without
  // variants may be heard with either gender setting, so they get both voices.
  for (const t of load('dialogues').topics) {
    lesson(t.lesson);
    for (const l of t.items) {
      const fixed = t.cast?.[l.who]?.gender;
      if (l.v) Object.entries(l.v).forEach(([k, v]) => add(v.pl, k[0]));
      else if (fixed) add(l.pl, fixed);
      else { add(l.pl, 'm'); add(l.pl, 'f'); }
    }
  }
  return out;
}

export function collectTexts() {
  return [...collectSpeech().keys()].sort();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const texts = collectTexts();
  if (process.argv.includes('--list')) console.log(texts.join('\n'));
  else {
    const chars = texts.reduce((n, t) => n + t.length, 0);
    console.log(`${texts.length} texts, ${chars} characters`);
  }
}
