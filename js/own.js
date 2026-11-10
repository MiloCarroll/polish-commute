// "My phrases": the owner's own cards, stored in IndexedDB ("own" store) and merged into
// the vocabulary module's "My phrases" topic at load. IDs start with "u-" and never change.
import { buildModule } from './content.js';

export const OWN_TOPIC = 'v-mine';

/** A new permanent ID, e.g. "u-lq3k9x2a". Unique enough for one person's phrases. */
export function newOwnId(now = Date.now(), rand = Math.random) {
  return `u-${now.toString(36)}${Math.floor(rand() * 1296).toString(36).padStart(2, '0')}`;
}

/** Clean up the add/edit form input. Returns { pl, en, note } or throws with a message. */
export function cleanPhrase({ pl, en, note }) {
  const tidy = (s) => String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  const out = { pl: tidy(pl), en: tidy(en), note: tidy(note) || null };
  if (!out.pl) throw new Error('Enter the Polish.');
  if (!out.en) throw new Error('Enter the English.');
  return out;
}

/** Turn a stored phrase into a vocabulary item with recognition and production cards. */
export function ownToItem(p) {
  return { id: p.id, pl: p.pl, en: p.en, note: p.note ?? null, pos: null, own: true, cards: ['rec', 'prod'], examples: [] };
}

/** Rebuild the vocabulary module with the owner's phrases in the My phrases topic. */
export function withOwnPhrases(vocabModule, phrases) {
  const sorted = phrases.slice().sort((a, b) => a.created - b.created);
  const topics = vocabModule.topics.map((t) => (t.id === OWN_TOPIC ? { ...t, items: sorted.map(ownToItem) } : t));
  return buildModule({ ...vocabModule, topics });
}
