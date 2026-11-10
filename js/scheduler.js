// FSRS integration and queue logic. Pure: no DOM or IndexedDB, so it runs under Node tests.
//
// A "card definition" (def) comes from content: { id, module, topic, kind, requires? }.
// A "card record" is what we store once a card has been studied:
//   { id, module, due, stability, difficulty, elapsed_days, scheduled_days,
//     learning_steps, reps, lapses, state, last_review, successes }
// Dates are stored as epoch milliseconds. Cards with no record are new.

import { fsrs, generatorParameters, createEmptyCard, Rating, State } from '../vendor/ts-fsrs-5.4.2.js';
import { dayStart, nextDayStart } from './day.js';

export { Rating, State };

/** How far ahead (ms) a learning card may be shown early when nothing else is left. */
export const LEARN_AHEAD_MS = 20 * 60 * 1000;

const schedulers = new Map();
export function getScheduler(retention = 0.9) {
  if (!schedulers.has(retention)) {
    schedulers.set(retention, fsrs(generatorParameters({ request_retention: retention, enable_fuzz: true })));
  }
  return schedulers.get(retention);
}

function toFsrsCard(record, now) {
  if (!record) return createEmptyCard(now);
  return {
    due: new Date(record.due),
    stability: record.stability,
    difficulty: record.difficulty,
    elapsed_days: record.elapsed_days,
    scheduled_days: record.scheduled_days,
    learning_steps: record.learning_steps ?? 0,
    reps: record.reps,
    lapses: record.lapses,
    state: record.state,
    last_review: record.last_review == null ? undefined : new Date(record.last_review),
  };
}

/**
 * Apply a rating. Returns the new record and a review-log entry (kept forever so FSRS
 * parameters can be optimised later).
 */
export function applyReview(def, record, rating, now = new Date(), retention = 0.9, durationMs = 0) {
  const { card, log } = getScheduler(retention).next(toFsrsCard(record, now), now, rating);
  const newRecord = {
    id: def.id,
    module: def.module,
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? new Date(card.last_review).getTime() : now.getTime(),
    successes: (record?.successes ?? 0) + (rating === Rating.Again ? 0 : 1),
  };
  const logEntry = {
    cardId: def.id,
    module: def.module,
    rating: log.rating,
    state: log.state, // state *before* this review; State.New marks a card's first review
    due: new Date(log.due).getTime(),
    stability: log.stability,
    difficulty: log.difficulty,
    elapsed_days: log.elapsed_days,
    last_elapsed_days: log.last_elapsed_days,
    scheduled_days: log.scheduled_days,
    learning_steps: log.learning_steps,
    review: new Date(log.review).getTime(),
    duration: durationMs,
  };
  return { record: newRecord, log: logEntry };
}

/** Preview intervals for each grade button, as human labels ("1m", "10m", "3d"). */
export function previewIntervals(record, now = new Date(), retention = 0.9) {
  const preview = getScheduler(retention).repeat(toFsrsCard(record, now), now);
  const out = {};
  for (const r of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]) {
    out[r] = formatInterval(preview[r].card.due.getTime() - now.getTime());
  }
  return out;
}

export function formatInterval(ms) {
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return `${min}m`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(ms / 86400000);
  if (d < 31) return `${d}d`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo}mo`;
  return `${(d / 365).toFixed(1)}y`;
}

// ---- Daily allowance -------------------------------------------------------

/** Number of new cards introduced (first-ever review) in the current study day. */
export function newIntroducedToday(logs, now = new Date()) {
  const start = dayStart(now).getTime();
  const end = nextDayStart(now).getTime();
  const seen = new Set();
  for (const l of logs) {
    if (l.state === State.New && l.review >= start && l.review < end) seen.add(l.cardId);
  }
  return seen.size;
}

export function newRemaining(newPerDay, logs, now = new Date()) {
  return Math.max(0, newPerDay - newIntroducedToday(logs, now));
}

// ---- Availability ----------------------------------------------------------

/** A card is unlocked when it has no prerequisite, or its prerequisite has a successful review. */
export function isUnlocked(def, records) {
  if (!def.requires) return true;
  const req = records.get(def.requires);
  return !!req && (req.successes ?? 0) > 0;
}

/** Studied card that is due at some point today (before the next 04:00). */
export function isDueToday(record, now = new Date()) {
  return !!record && record.due < nextDayStart(now).getTime();
}

/**
 * Counts for a set of card definitions.
 * `records` is a Map id → record.
 */
export function countCards(defs, records, now = new Date()) {
  let due = 0, newAvailable = 0, studied = 0, learned = 0;
  for (const def of defs) {
    const rec = records.get(def.id);
    if (rec) {
      studied++;
      if ((rec.successes ?? 0) > 0) learned++;
      if (isDueToday(rec, now)) due++;
    } else if (isUnlocked(def, records)) {
      newAvailable++;
    }
  }
  return { total: defs.length, due, newAvailable, studied, learned };
}

/**
 * Choose the next card for a session.
 *   defs:          card definitions in suggested study order (new cards are taken in this order)
 *   records:       Map id → record
 *   newLeft:       remaining new-card allowance for today
 *   skip:          Set of ids not to show again right now (e.g. the card just answered)
 * Returns { def, isNew } or { def: null, waitUntil } when only learning cards remain in the future.
 */
export function pickNext(defs, records, newLeft, now = new Date(), skip = new Set()) {
  const t = now.getTime();
  const endOfDay = nextDayStart(now).getTime();
  let dueNow = null;        // learning/relearning/review card with due <= now (earliest first)
  let dueLaterToday = null; // review-state card due later today
  let ahead = null;         // learning card due soon
  let firstNew = null;

  for (const def of defs) {
    if (skip.has(def.id)) continue;
    const rec = records.get(def.id);
    if (!rec) {
      if (!firstNew && isUnlocked(def, records)) firstNew = def;
      continue;
    }
    if (rec.due <= t) {
      if (!dueNow || rec.due < records.get(dueNow.id).due) dueNow = def;
    } else if (rec.state === State.Review && rec.due < endOfDay) {
      if (!dueLaterToday || rec.due < records.get(dueLaterToday.id).due) dueLaterToday = def;
    } else if (rec.state !== State.Review && rec.due < endOfDay) {
      if (!ahead || rec.due < records.get(ahead.id).due) ahead = def;
    }
  }

  if (dueNow) return { def: dueNow, isNew: false };
  if (dueLaterToday) return { def: dueLaterToday, isNew: false };
  if (firstNew && newLeft > 0) return { def: firstNew, isNew: true };
  if (ahead) {
    const due = records.get(ahead.id).due;
    if (due - t <= LEARN_AHEAD_MS) return { def: ahead, isNew: false };
    return { def: null, waitUntil: due };
  }
  return { def: null };
}
