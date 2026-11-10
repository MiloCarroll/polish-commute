// Gender variants for example sentences. Pure, unit-tested.
//
// A gender-dependent example stores four versions keyed by speaker gender + listener gender:
//   { speaker: 'learner' | 'partner', v: { mf: {...}, mm: {...}, ff: {...}, fm: {...} } }
// For a learner line the speaker is the learner and the listener the partner; for a
// partner line it's the other way round. Settings supply both genders.

export const VARIANT_KEYS = ['mf', 'mm', 'ff', 'fm'];

export function variantKey(example, { learnerGender = 'm', partnerGender = 'f' } = {}) {
  const partnerSpeaks = example.speaker === 'partner';
  const speaker = partnerSpeaks ? partnerGender : learnerGender;
  const listener = partnerSpeaks ? learnerGender : partnerGender;
  return `${speaker}${listener}`;
}

/** The concrete { pl, en, gap?, gapAlts? } for the current settings. */
export function resolveExample(example, genders) {
  if (!example?.v) return example;
  return { speaker: example.speaker ?? 'learner', ...example.v[variantKey(example, genders)] };
}

/** First example that has a gap, resolved for the current settings. */
export function gapExample(item, genders) {
  for (const ex of item.examples ?? []) {
    const r = resolveExample(ex, genders);
    if (r?.gap) return r;
  }
  return null;
}

/** Sentence with the gap replaced by a blank marker, split for rendering. */
export function splitGap(sentence, gap) {
  const i = findWhole(sentence, gap);
  if (i < 0) return null;
  return { before: sentence.slice(0, i), after: sentence.slice(i + gap.length) };
}

const LETTER = /[\p{L}\p{N}]/u;

/** Index of `needle` in `hay` as a whole word (not inside another word), or -1. */
export function findWhole(hay, needle) {
  let from = 0;
  while (true) {
    const i = hay.indexOf(needle, from);
    if (i < 0) return -1;
    const before = hay[i - 1], after = hay[i + needle.length];
    if ((!before || !LETTER.test(before)) && (!after || !LETTER.test(after))) return i;
    from = i + 1;
  }
}

/** How many times `needle` occurs as a whole word in `hay`. */
export function countWhole(hay, needle) {
  let n = 0, from = 0;
  while (true) {
    const i = findWhole(hay.slice(from), needle);
    if (i < 0) return n;
    n++;
    from += i + needle.length;
  }
}

/**
 * A grammar drill with its gender variant applied: top-level fields (type, options,
 * reason, ...) overlaid by the variant's own fields.
 */
export function resolveDrill(item, genders) {
  if (!item.v) return item;
  const { v, ...base } = item;
  return { ...base, ...v[variantKey(item, genders)] };
}

// ---- Dialogue lines -----------------------------------------------------------
// A line has `who` (speaker) and `to` (person addressed): "learner", "partner", a key of
// the dialogue's `cast` (fixed gender), or "all" (to = a group). Gender-dependent lines
// carry `v` keyed by speaker gender + listener gender ("-" for a group).

export function roleGender(role, cast, { learnerGender = 'm', partnerGender = 'f' } = {}) {
  if (role === 'learner') return learnerGender;
  if (role === 'partner') return partnerGender;
  if (role === 'all' || role == null) return '-';
  return cast?.[role]?.gender ?? '-';
}

/** Every variant key a line can need, given which roles have changeable genders. */
export function reachableKeys(line, cast) {
  const opts = (role) => (role === 'learner' || role === 'partner' ? ['m', 'f'] : [roleGender(role, cast)]);
  const keys = [];
  for (const a of opts(line.who)) for (const b of opts(line.to)) keys.push(`${a}${b}`);
  return [...new Set(keys)];
}

/** The concrete line for the current settings: { pl, en, note, who, to, gender }. */
export function resolveLine(line, cast, genders) {
  const speaker = roleGender(line.who, cast, genders);
  const listener = roleGender(line.to, cast, genders);
  const v = line.v ? line.v[`${speaker}${listener}`] : null;
  return {
    who: line.who, to: line.to, note: line.note ?? null,
    pl: v?.pl ?? line.pl, en: v?.en ?? line.en,
    gender: speaker === '-' ? null : speaker,
  };
}

export function roleLabel(role, cast) {
  if (role === 'learner') return 'You';
  if (role === 'partner') return 'Your partner';
  return cast?.[role]?.name ?? role;
}
