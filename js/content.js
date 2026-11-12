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
      return [listen, { id: `${item.id}-say`, module, topic: topic.id, item: item.id, kind: 'say', requires: listen.id }];
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
    // New cards are introduced in this order. Within a topic, all listening cards come
    // before dictation, so a word's spelling isn't shown just before you have to type it.
    if (json.module === 'vocabulary') {
      const batch = new Map(topic.items.map((it, i) => [it.id, Math.floor(i / VOCAB_BATCH)]));
      const rank = (d) => VOCAB_KIND_ORDER.indexOf(d.kind);
      topic.cards.sort((a, b) => batch.get(a.item) - batch.get(b.item) || rank(a) - rank(b));
    } else {
      const rank = (d) => KIND_ORDER.indexOf(d.kind);
      topic.cards.sort((a, b) => rank(a) - rank(b)); // stable: item order kept within a kind
    }
    defs.push(...topic.cards);
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

export function allDefs(content) {
  return MODULES.flatMap((m) => content[m].defs);
}
