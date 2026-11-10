// App settings with defaults, persisted in the IndexedDB "settings" store.
import * as db from './db.js';

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
