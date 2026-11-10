// "Today's session": one button that runs all due reviews (every module), then new cards
// shared out across the modules. Pure, unit-tested.
import { pickNext } from './scheduler.js';
import { dayStart } from './day.js';
import { State } from './scheduler.js';

export const MODULE_ORDER = ['pronunciation', 'vocabulary', 'grammar'];

/** New cards introduced today per module (first-ever review today). */
export function newTodayByModule(todayLogs, now = new Date()) {
  const start = dayStart(now).getTime();
  const out = Object.fromEntries(MODULE_ORDER.map((m) => [m, 0]));
  const seen = new Set();
  for (const l of todayLogs) {
    if (l.state !== State.New || l.review < start || seen.has(l.cardId)) continue;
    seen.add(l.cardId);
    if (l.module in out) out[l.module]++;
  }
  return out;
}

/**
 * Next card for today's session.
 *   defsByModule: { pronunciation: [...], vocabulary: [...], grammar: [...] } in suggested order
 * 1. Any due card from any module (same priority rules as pickNext).
 * 2. Otherwise a new card from the module that has introduced the fewest new cards today
 *    (ties in the order pronunciation, vocabulary, grammar), so the day's allowance is
 *    spread across all three and no module is neglected.
 * Returns the same shape as pickNext.
 */
export function pickToday(defsByModule, records, newLeft, todayLogs, now = new Date(), skip = new Set()) {
  const all = MODULE_ORDER.flatMap((m) => defsByModule[m] ?? []);
  const due = pickNext(all, records, 0, now, skip);
  // pickNext may offer a learning card a little early when nothing is strictly due;
  // in today's session new cards come first, and such cards only fill the gaps.
  const early = due.def && records.get(due.def.id).due > now.getTime() && records.get(due.def.id).state !== State.Review;
  if (due.def && !early) return due;
  if (newLeft > 0) {
    const counts = newTodayByModule(todayLogs, now);
    const order = MODULE_ORDER.slice().sort((a, b) => counts[a] - counts[b] || MODULE_ORDER.indexOf(a) - MODULE_ORDER.indexOf(b));
    for (const m of order) {
      const p = pickNext(defsByModule[m] ?? [], records, newLeft, now, skip);
      if (p.def && p.isNew) return p;
    }
  }
  return due; // nothing new: may carry waitUntil for a learning card
}

