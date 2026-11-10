// Loads course content and turns items into card definitions.
// Card IDs are permanent: `<item id>-<kind>`, e.g. "v-0001-rec". Never renumber released items.

export const MODULES = ['pronunciation', 'vocabulary', 'grammar', 'dialogues'];

/** Order in which card kinds are introduced within a topic. */
export const KIND_ORDER = ['rec', 'listen', 'stress', 'dict', 'gap', 'prod', 'say'];

/** Card kinds generated for each module's items. Later stages add kinds here. */
export function cardsForItem(module, topic, item) {
  switch (module) {
    case 'vocabulary': {
      // Recognition first; the other directions unlock after its first successful review.
      const rec = `${item.id}-rec`;
      const kinds = [...(item.cards ?? ['rec'])];
      // Whole-sentence production: every item with a listening card also gets a "say it"
      // card for the same sentence (not for lines the partner says).
      const ex = item.examples?.[0];
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
    const rank = (d) => KIND_ORDER.indexOf(d.kind);
    topic.cards.sort((a, b) => rank(a) - rank(b)); // stable: item order kept within a kind
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
