// Loads course content and turns items into card definitions.
// Card IDs are permanent: `<item id>-<kind>`, e.g. "v-0001-rec". Never renumber released items.

export const MODULES = ['pronunciation', 'vocabulary', 'grammar'];

/** Card kinds generated for each module's items. Later stages add kinds here. */
export function cardsForItem(module, topic, item) {
  switch (module) {
    case 'vocabulary':
      return [{ id: `${item.id}-rec`, module, topic: topic.id, item: item.id, kind: 'rec' }];
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
      for (const def of cardsForItem(json.module, topic, item)) {
        topic.cards.push(def);
        defs.push(def);
      }
    }
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
