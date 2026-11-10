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

export function collectTexts() {
  const out = new Set();
  const add = (t) => { if (t && /\p{L}/u.test(t)) out.add(clipKey(t)); };
  const braces = (s) => [...String(s ?? '').matchAll(/\{\{(.+?)\}\}/g)].forEach((m) => add(m[1]));
  const lesson = (L) => {
    if (!L) return;
    [L.summary, ...(L.body ?? []), ...(L.more ?? []), ...(L.letters ?? []).map((l) => l.sound),
      ...(L.table?.rows?.flat() ?? []), ...(L.table?.head ?? [])].forEach(braces);
    (L.letters ?? []).forEach((l) => (l.examples ?? []).forEach(add));
  };
  const variants = (x) => (x?.v ? Object.values(x.v) : [x]);

  for (const t of load('pronunciation').topics) { lesson(t.lesson); t.items.forEach((i) => add(i.pl)); }
  for (const t of load('vocabulary').topics) {
    for (const i of t.items) {
      add(i.pl);
      if (i.forms) Object.values(i.forms).forEach(add);
      (i.examples ?? []).forEach((e) => variants(e).forEach((v) => add(v.pl)));
    }
  }
  for (const t of load('grammar').topics) { lesson(t.lesson); t.items.forEach((i) => variants(i).forEach((v) => add(v.pl))); }
  return [...out].sort();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const texts = collectTexts();
  if (process.argv.includes('--list')) console.log(texts.join('\n'));
  else {
    const chars = texts.reduce((n, t) => n + t.length, 0);
    console.log(`${texts.length} texts, ${chars} characters`);
  }
}
