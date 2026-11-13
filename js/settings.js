// App settings with defaults, persisted in the IndexedDB "settings" store.
import * as db from './db.js';
import { dayKey } from './day.js';

export const DEFAULTS = Object.freeze({
  learnerGender: 'm',   // 'm' | 'f' — chooses sentence variants spoken by the learner
  partnerGender: 'f',   // 'm' | 'f' — chooses forms used when addressing the partner
  newPerDay: 15,        // shared new-card allowance across all modules
  retention: 0.9,       // FSRS target retention
  voiceURI: null,       // chosen Polish voice; null = best available
  rate: 'normal',       // 'normal' | 'slow'
  autoplay: true,       // speak the Polish when a card appears
  timerMinutes: 40,     // session timer (stage 5); 0 = off
  firstRunDone: false,  // first-run audio screen completed
  lessonsSeen: [],      // topic ids whose lesson has been shown before their first new card
  firstStudy: null,     // epoch ms of the first review ever (for the backup reminder)
  lastBackup: null,     // epoch ms of the last export
  backupSnoozeUntil: null, // "Remind me later" on the Home backup notice
  extraNew: null,       // { day: dayKey, n } extra new cards added for one day ("+5 new cards")
});

let cache = null;

export async function loadSettings() {
  const rows = await db.getAll('settings');
  cache = { ...DEFAULTS };
  for (const { key, value } of rows) if (key in DEFAULTS) cache[key] = value;
  return cache;
}

export function settings() {
  if (!cache) throw new Error('Settings not loaded');
  return cache;
}

export async function setSetting(key, value) {
  if (!(key in DEFAULTS)) throw new Error(`Unknown setting: ${key}`);
  cache[key] = value;
  await db.put('settings', { key, value });
}

/** Extra new cards a single tap adds for today. */
export const EXTRA_STEP = 5;

/** Today's new-card allowance: the daily setting plus any extra added today. */
export function newAllowance(now = new Date()) {
  const s = settings();
  const extra = s.extraNew && s.extraNew.day === dayKey(now) ? s.extraNew.n : 0;
  return s.newPerDay + extra;
}

/** Add EXTRA_STEP new cards to today's allowance (resets at the start of the next day). */
export async function addExtraNew(now = new Date()) {
  const s = settings();
  const day = dayKey(now);
  const n = (s.extraNew && s.extraNew.day === day ? s.extraNew.n : 0) + EXTRA_STEP;
  await setSetting('extraNew', { day, n });
}
