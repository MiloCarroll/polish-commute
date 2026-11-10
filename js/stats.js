// Statistics. Pure functions over card records and the review log; unit-tested.
import { dayKey, dayStart } from './day.js';
import { Rating } from './scheduler.js';

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

