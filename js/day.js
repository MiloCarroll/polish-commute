// Study-day arithmetic. A study day runs from 04:00 local time to 04:00 the next day,
// so a late-night session still counts towards the previous day.
// Pure functions: no DOM, no storage, so they run under `node --test`.

export const ROLLOVER_HOUR = 4;

/** Start (as a Date) of the study day containing `now`. */
export function dayStart(now = new Date()) {
  const d = new Date(now);
  if (d.getHours() < ROLLOVER_HOUR) d.setDate(d.getDate() - 1);
  d.setHours(ROLLOVER_HOUR, 0, 0, 0);
  return d;
}

/** Start of the next study day (the moment today's allowance resets). */
export function nextDayStart(now = new Date()) {
  const d = dayStart(now);
  d.setDate(d.getDate() + 1); // setDate keeps 04:00 across DST changes
  return d;
}

/** Stable key for the study day containing `now`, e.g. "2026-11-10". */
export function dayKey(now = new Date()) {
  const d = dayStart(now);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
