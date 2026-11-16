// Practice mode: extra rounds on cards already studied, marked as usual but never
// rescheduled (reviewing early through FSRS would push cards too far out). Pure, unit-tested.

/** Card kinds the app marks itself. Self-graded kinds (show answer, then grade) are left out. */
export const MARKED_KINDS = new Set([
  'dict', 'sdict', 'gap', 'prod', 'contrast', // vocabulary
  'listen', 'stress',                        // pronunciation (listen = listen and choose)
  'choose', 'type',                          // grammar
  'say',                                     // conversations: typed "your turn"
]);

/** True when practice can use this card: marked automatically and not self-graded. */
export function isMarked(def) {
  if (def.module === 'vocabulary') return MARKED_KINDS.has(def.kind) && def.kind !== 'listen' && def.kind !== 'say';
  if (def.module === 'dialogues') return def.kind === 'say';
  return MARKED_KINDS.has(def.kind);
}

/** Higher = weaker: forgotten often, low stability, or still being learned. */
export function weakness(record) {
  const stability = Math.max(0.1, record.stability ?? 0.1);
  return (record.lapses ?? 0) * 2 + 3 / (1 + stability) + (record.state === 2 ? 0 : 1);
}

/**
 * Pick a practice round: studied, marked cards that are not due now (due cards belong in
 * a real review), weakest first with some shuffling so rounds vary.
 */
export function pickRound(defs, records, { size = 20, now = Date.now(), rand = Math.random } = {}) {
  const pool = [];
  for (const def of defs) {
    const rec = records.get(def.id);
    if (!rec || rec.due <= now || !isMarked(def)) continue;
    pool.push({ def, score: weakness(rec) + rand() * 1.5 });
  }
  pool.sort((a, b) => b.score - a.score);
  const round = pool.slice(0, size).map((p) => p.def);
  // Shuffle so the weakest cards are not all at the start.
  for (let i = round.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [round[i], round[j]] = [round[j], round[i]];
  }
  return round;
}
