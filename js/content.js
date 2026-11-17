// Loads course content and turns items into card definitions.
// Card IDs are permanent: `<item id>-<kind>`, e.g. "v-0001-rec". Never renumber released items.

export const MODULES = ['pronunciation', 'vocabulary', 'grammar', 'dialogues'];

/** Order in which card kinds are introduced within a topic (pronunciation, dialogues). */
export const KIND_ORDER = ['rec', 'listen', 'stress', 'dict', 'gap', 'prod', 'say'];

/**
 * Vocabulary: graded (typed) cards come before the self-graded ones, and words are
 * introduced in small batches, so spelling and production tests start on day one:
 * recognition for 5 words, then those 5 words' dictation, gaps, English → Polish and
 * sentence dictation, then their listening and "say it" cards, then the next 5 words.
 */
export const VOCAB_KIND_ORDER = ['rec', 'dict', 'gap', 'prod', 'sdict', 'listen', 'say'];
export const VOCAB_BATCH = 5;

/**
 * Words from the same topic (goodbyes, family, numbers…) are kept at least this many
 * words apart in the study order, about a day at the usual pace: similar words learnt
 * together interfere with each other. A topic can set its own `spacing`, and topics marked
 * `keepTogether` (one situation, e.g. at the table) aren't spread out at all.
 */
export const VOCAB_SPACING = 8;

/**
 * The order new vocabulary is studied in (topic pages keep their own order): most common
 * words first (your own phrases before everything), with words from the same topic spaced
 * out. A keep-together topic, once started, carries on for a batch of words. If no word
 * fits the spacing, the topic that has waited longest goes next.
 */
export function vocabularyOrder(topics) {
  const pending = topics.flatMap((t, ti) => t.items.map((it, i) => ({
    it, t, key: [it.own ? -1 : (it.rank ?? 1e9), ti, i],
  })));
  pending.sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2]);
  const topicOf = new Map(pending.map((p) => [p.it, p.t]));
  const gap = (t) => (t.keepTogether || t.items[0]?.own ? 0 : t.spacing ?? VOCAB_SPACING);
  const last = new Map(); // topic id → position of its latest word
  const out = [];
  let run = 0; // words in a row from the current keep-together topic
  while (pending.length) {
    const pos = out.length;
    const prev = pos ? out[pos - 1] : null;
    const prevTopic = prev ? topicOf.get(prev) : null;
    // A situation topic carries on for up to a batch once it has started.
    let k = prevTopic?.keepTogether && run < VOCAB_BATCH ? pending.findIndex((p) => p.t === prevTopic) : -1;
    if (k < 0) k = pending.findIndex((p) => !last.has(p.t.id) || pos - last.get(p.t.id) >= gap(p.t));
    if (k < 0) {
      k = 0;
      for (let i = 1; i < pending.length; i++) if (last.get(pending[i].t.id) < last.get(pending[k].t.id)) k = i;
    }
    const [p] = pending.splice(k, 1);
    run = prevTopic === p.t ? run + 1 : 1;
    out.push(p.it);
    last.set(p.t.id, pos);
  }
  return out;
}

/** Card kinds generated for each module's items. Later stages add kinds here. */
export function cardsForItem(module, topic, item) {
  switch (module) {
    case 'vocabulary': {
      // Recognition first; the other cards unlock once it has been seen (answered once).
      const rec = `${item.id}-rec`;
      const kinds = [...(item.cards ?? ['rec'])];
      // Word dictation (hear it, spell it) for every word.
      if (!kinds.includes('dict')) kinds.push('dict');
      const ex = item.examples?.[0];
      // Sentence dictation and whole-sentence production for every item with a listening
      // card (its first example). "Say it" is not for lines the partner says.
      if (kinds.includes('listen') && ex) kinds.push('sdict');
      if (kinds.includes('listen') && ex && ex.speaker !== 'partner') kinds.push('say');
      return kinds.map((kind) => ({
        id: `${item.id}-${kind}`, module, topic: topic.id, item: item.id, kind,
        ...(kind === 'rec' ? {} : { requires: rec }),
      }));
    }
    case 'pronunciation':
      // One card per listed exercise: listen (listen and choose), dict (dictation), stress.
      return (item.cards ?? []).map((kind) => ({ id: `${item.id}-${kind}`, module, topic: topic.id, item: item.id, kind }));
    case 'dialogues': {
      // Every line: a listening card. The learner's own lines: also a "your turn" card,
      // unlocked once its listening card has been answered correctly.
      const listen = { id: `${item.id}-listen`, module, topic: topic.id, item: item.id, kind: 'listen' };
      if (item.who !== 'learner') return [listen];
      // "Your turn" waits until the line was first heard on an earlier day.
      return [listen, { id: `${item.id}-say`, module, topic: topic.id, item: item.id, kind: 'say', requires: listen.id, requiresEarlierDay: true }];
    }
    case 'grammar':
      // One card per drill; the drill ID is the card ID (e.g. "g-03-017").
      return [{ id: item.id, module, topic: topic.id, item: item.id, kind: item.type }];
    default:
      return [];
  }
}

export function buildModule(json) {
  const defs = [];
  const items = new Map();
  for (const topic of json.topics) {
    topic.cards = [];
    for (const item of topic.items) {
      items.set(item.id, item);
      topic.cards.push(...cardsForItem(json.module, topic, item));
    }
    // Vocabulary contrast cards ("which fits?") for look-alike words, once all are seen.
    for (const c of topic.contrasts ?? []) {
      c.pl = c.options.map((o) => o.pl).join(' / ');
      items.set(c.id, c);
      topic.cards.push({ id: c.id, module: json.module, topic: topic.id, item: c.id, kind: 'contrast', requires: c.words.map((w) => `${w}-rec`) });
    }
    // New cards are introduced in this order. Within a topic, all listening cards come
    // before dictation, so a word's spelling isn't shown just before you have to type it.
    if (json.module === 'vocabulary') {
      const batch = new Map(topic.items.map((it, i) => [it.id, Math.floor(i / VOCAB_BATCH)]));
      // A contrast card comes after the batch of the last of its words.
      for (const c of topic.contrasts ?? []) batch.set(c.id, Math.max(...c.words.map((w) => batch.get(w) ?? 0)));
      const rank = (d) => (d.kind === 'contrast' ? VOCAB_KIND_ORDER.length : VOCAB_KIND_ORDER.indexOf(d.kind));
      topic.cards.sort((a, b) => batch.get(a.item) - batch.get(b.item) || rank(a) - rank(b));
    } else {
      const rank = (d) => KIND_ORDER.indexOf(d.kind);
      topic.cards.sort((a, b) => rank(a) - rank(b)); // stable: item order kept within a kind
    }
    defs.push(...topic.cards);
  }
  // Vocabulary as a whole (Today's session, a module's Continue) follows the interleaved
  // order, still in batches of 5 words: recognition for 5, then their typed cards, etc.
  if (json.module === 'vocabulary') {
    const order = vocabularyOrder(json.topics);
    const batch = new Map(order.map((it, i) => [it.id, Math.floor(i / VOCAB_BATCH)]));
    const place = new Map(order.map((it, i) => [it.id, i]));
    for (const t of json.topics) {
      for (const c of t.contrasts ?? []) {
        batch.set(c.id, Math.max(...c.words.map((w) => batch.get(w) ?? 0)));
        place.set(c.id, Math.max(...c.words.map((w) => place.get(w) ?? 0)));
      }
    }
    const rank = (d) => (d.kind === 'contrast' ? VOCAB_KIND_ORDER.length : VOCAB_KIND_ORDER.indexOf(d.kind));
    defs.sort((a, b) => batch.get(a.item) - batch.get(b.item) || rank(a) - rank(b) || place.get(a.item) - place.get(b.item));
  }
  return { ...json, defs, items };
}

let loaded = null;

/** Fetches all content once (the service worker serves it offline). */
export async function loadContent() {
  if (loaded) return loaded;
  const entries = await Promise.all(MODULES.map(async (m) => {
    const res = await fetch(`content/${m}.json`);
    if (!res.ok) throw new Error(`Could not load ${m} content`);
    return [m, buildModule(await res.json())];
  }));
  loaded = Object.fromEntries(entries);
  return loaded;
}

/** Cards that can't be done without hearing audio: dictation and listening. */
const SOUND_KINDS = {
  vocabulary: new Set(['dict', 'sdict', 'listen']),
  pronunciation: new Set(['listen', 'dict']),
  dialogues: new Set(['listen']),
};
export function needsSound(def) {
  return SOUND_KINDS[def.module]?.has(def.kind) ?? false;
}

export function allDefs(content) {
  return MODULES.flatMap((m) => content[m].defs);
}
