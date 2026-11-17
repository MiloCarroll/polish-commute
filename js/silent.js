// Silent mode: for when you can't play sound (no headphones on the train). No audio
// plays, play buttons are hidden, and cards that can't be done without hearing
// (dictation, listening) wait until silent mode is off. They stay due; nothing is lost.
import { settings, setSetting } from './settings.js';
import { needsSound } from './content.js';
import { isDueToday } from './scheduler.js';
import * as tts from './tts.js';

export const isSilent = () => !!settings().silent;

/** The cards you can do right now: all of them, or without the listening ones when silent. */
export function audible(defs) {
  return isSilent() ? defs.filter((d) => !needsSound(d)) : defs;
}

/** Listening cards due today that silent mode is holding back. */
export function heldBack(defs, records, now = new Date()) {
  if (!isSilent()) return 0;
  return defs.filter((d) => needsSound(d) && isDueToday(records.get(d.id), now)).length;
}

/** Apply the setting: mute speech and hide play buttons (via a class on <body>). */
export function applySilent() {
  tts.setSilent(isSilent());
  document.body.classList.toggle('silent', isSilent());
}

export async function setSilent(on) {
  await setSetting('silent', !!on);
  applySilent();
}

/** A small on/off switch for Home and the end of a session; `compact` (icon only) for the card header. */
export function silentToggle({ compact = false } = {}) {
  const on = isSilent();
  const label = on ? 'Silent mode is on. Tap to turn the sound back on.' : 'Sound is on. Tap for silent mode.';
  return `<button type="button" class="silent-toggle ${on ? 'on' : ''} ${compact ? 'compact' : ''}" data-silent
    aria-pressed="${on}" aria-label="${label}">${on ? '🔇' : '🔈'}${compact ? '' : `<span>${on ? 'Silent' : 'Sound on'}</span>`}</button>`;
}
