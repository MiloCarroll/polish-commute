// Statistics. Pure functions over card records and the review log; unit-tested.
import { dayKey, dayStart } from './day.js';
import { Rating, applyReview } from './scheduler.js';

const DAY = 86400000;

/** Distinct study days (04:00 to 04:00) with at least one review. */
export function daysStudied(reviews) {
  return new Set(reviews.map((r) => dayKey(new Date(r.review)))).size;
}

/** Cards with at least one successful review (anything but Again). */
export function cardsLearned(records) {
  let n = 0;
  for (const r of records) if ((r.successes ?? 0) > 0) n++;
  return n;
}

/**
 * Cards due on each of the next `days` study days. Day 0 (today) also includes
 * anything overdue. Returns [{ key, start, count }].
 */
export function dueByDay(records, now = new Date(), days = 7) {
  const start0 = dayStart(now).getTime();
  const out = [];
  for (let i = 0; i < days; i++) {
    // Re-derive each day's start from a midday timestamp so DST changes don't shift it.
    const start = dayStart(new Date(start0 + i * DAY + 12 * 3600000)).getTime();
    out.push({ key: dayKey(new Date(start)), start, count: 0 });
  }
  const ends = out.map((d, i) => (i + 1 < out.length ? out[i + 1].start : dayStart(new Date(d.start + DAY + 12 * 3600000)).getTime()));
  for (const r of records) {
    if (r.due < ends[0]) { out[0].count++; continue; }
    for (let i = 1; i < out.length; i++) {
      if (r.due >= out[i].start && r.due < ends[i]) { out[i].count++; break; }
    }
  }
  return out;
}

/** Share of reviews not rated Again, per module: { module: { correct, total } }. */
export function accuracyByModule(reviews, modules) {
  const acc = Object.fromEntries(modules.map((m) => [m, { correct: 0, total: 0 }]));
  for (const r of reviews) {
    const a = acc[r.module];
    if (!a) continue;
    a.total++;
    if (r.rating !== Rating.Again) a.correct++;
  }
  return acc;
}


// ---- Workload forecast -------------------------------------------------------

/** Small seeded random generator, so a forecast comes out the same each time. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * How often you pass cards, from your own history: first sight of a new card, and
 * everything after. Falls back to typical values with little history.
 */
export function passRates(reviews) {
  const rate = (rs, fallback) => (rs.length >= 30 ? rs.filter((r) => r.rating !== Rating.Again).length / rs.length : fallback);
  return {
    newPass: rate(reviews.filter((r) => r.state === 0), 0.75),
    pass: rate(reviews.filter((r) => r.state !== 0), 0.9),
  };
}

/** Average seconds per card over recent answers (pauses over 2 minutes count as 2 minutes). */
export function secondsPerCard(reviews) {
  const d = reviews.slice(-500).map((r) => r.duration).filter((x) => x > 0).map((x) => Math.min(x, 120000));
  return d.length >= 20 ? Math.round(d.reduce((a, b) => a + b, 0) / d.length / 1000) : 25;
}

/**
 * Simulate the coming `days` study days from tomorrow: every due card is reviewed (passed
 * at your usual rate, otherwise Again), and `newPerDay` new cards are started each day.
 * Returns per day { reviews, newShown }: reviews of cards already started before that day,
 * and every showing of that day's new cards (first sight plus same-day repeats).
 */
export function forecast(records, { newPerDay, days = 28, now = new Date(), retention = 0.9, newPass = 0.75, pass = 0.9, seed = 1 }) {
  const rand = seeded(seed);
  const cards = records.map((r) => ({ ...r }));
  const out = [];
  let next = dayStart(new Date(dayStart(now).getTime() + DAY + 12 * 3600000)).getTime();
  let made = 0;
  for (let d = 0; d < days; d++) {
    const start = next;
    next = dayStart(new Date(start + DAY + 12 * 3600000)).getTime();
    const day = { reviews: 0, newShown: 0 };
    const fresh = new Set();
    for (let i = 0; i < newPerDay; i++) {
      const c = { id: `new-${made++}`, due: start + 9 * 3600000, isNew: true };
      cards.push(c);
      fresh.add(c);
    }
    // Review in time order until nothing else falls due before the day ends.
    let queue = cards.filter((c) => c.due < next);
    while (queue.length) {
      const later = [];
      for (const c of queue) {
        const at = new Date(Math.max(c.due, start + 8 * 3600000));
        const rating = rand() < (c.isNew ? newPass : pass) ? Rating.Good : Rating.Again;
        const { record } = applyReview({ id: c.id, module: '' }, c.isNew ? undefined : c, rating, at, retention);
        if (fresh.has(c)) day.newShown++; else day.reviews++;
        Object.assign(c, record, { isNew: false });
        if (c.due < next) later.push(c);
      }
      queue = later;
    }
    out.push(day);
  }
  return out;
}

/** Average of a forecast over days [from, to). */
export function forecastAverage(days, from, to) {
  const part = days.slice(from, to);
  const sum = (k) => part.reduce((n, d) => n + d[k], 0) / Math.max(1, part.length);
  return { reviews: Math.round(sum('reviews')), newShown: Math.round(sum('newShown')) };
}
