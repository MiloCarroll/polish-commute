// Export / import format. Pure, unit-tested; db.js does the reading and writing.
//
// {
//   "app": "polski", "format": 1, "exported": "<ISO date>",
//   "stores": {
//     "cards":    [ record, ... ],
//     "reviews":  [ { "key": 1, "value": log }, ... ],   // keys kept so the log restores exactly
//     "settings": [ { key, value }, ... ],
//     "flags":    [ ... ],
//     "own":      [ ... ]
//   }
// }

export const FORMAT = 1;
export const STORES = ['cards', 'reviews', 'settings', 'flags', 'own'];

export function makeBackup(stores, now = new Date()) {
  const out = { app: 'polski', format: FORMAT, exported: now.toISOString(), stores: {} };
  for (const s of STORES) out.stores[s] = stores[s] ?? [];
  return out;
}

export function backupFilename(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `polski-progress-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

/** Parse and check an exported file. Throws an Error with a plain-English message. */
export function parseBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('This file is not a Polski export (it is not valid JSON).'); }
  if (!data || data.app !== 'polski' || !data.stores) throw new Error('This file is not a Polski export.');
  if (data.format > FORMAT) throw new Error('This export comes from a newer version of Polski. Update the app first.');
  for (const s of STORES) {
    if (!Array.isArray(data.stores[s] ?? [])) throw new Error(`The export is damaged (${s} is not a list).`);
  }
  for (const c of data.stores.cards ?? []) {
    if (typeof c.id !== 'string' || typeof c.due !== 'number') throw new Error('The export is damaged (a card has no id or due date).');
  }
  for (const r of data.stores.reviews ?? []) {
    if (r == null || r.value == null || typeof r.value.cardId !== 'string') throw new Error('The export is damaged (a review entry is incomplete).');
  }
  return data;
}

/** Short human summary, shown before confirming an import. */
export function describeBackup(data) {
  const s = data.stores;
  return `${(s.cards ?? []).length} studied cards, ${(s.reviews ?? []).length} reviews, ` +
    `${(s.own ?? []).length} own phrases, ${(s.flags ?? []).length} flags (exported ${new Date(data.exported).toLocaleString()})`;
}

const DAY = 86400000;
export const REMIND_AFTER_DAYS = 14;   // since the last export
export const FIRST_REMIND_DAYS = 7;    // since the first review, if never exported

/**
 * Should Home nudge you to export? Returns { daysSince, never } or null.
 *   lastBackup / firstStudy / snoozeUntil: epoch ms or null
 */
export function backupReminder({ lastBackup, firstStudy, snoozeUntil }, now = Date.now()) {
  if (snoozeUntil && now < snoozeUntil) return null;
  if (lastBackup) {
    const days = Math.floor((now - lastBackup) / DAY);
    return days >= REMIND_AFTER_DAYS ? { daysSince: days, never: false } : null;
  }
  if (firstStudy && now - firstStudy >= FIRST_REMIND_DAYS * DAY) return { daysSince: null, never: true };
  return null;
}

export function lastBackupText(lastBackup, now = Date.now()) {
  if (!lastBackup) return 'Never exported.';
  const days = Math.floor((now - lastBackup) / DAY);
  return `Last export: ${days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`}.`;
}
