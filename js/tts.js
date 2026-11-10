// Text-to-speech using the Web Speech API, Polish voices only.
//
// iOS notes:
//  - Voices often load late; we wait for `voiceschanged` (with a timeout).
//  - Speech must be started from a user gesture once per page load. The first tap anywhere
//    calls unlock(), which speaks a silent utterance; after that auto-play works.
//  - Keep a reference to the current utterance or Safari may garbage-collect it mid-sentence.

const RATES = { normal: 0.9, slow: 0.6 };

let voices = [];
let unlocked = false;
let current = null;
let preferredURI = null;
let rateName = 'normal';
const listeners = new Set();

export const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

function refresh() {
  voices = speechSynthesis.getVoices().filter((v) => /^pl([-_]|$)/i.test(v.lang));
  listeners.forEach((fn) => fn(voices));
}

/** Resolves with the Polish voices once the browser has loaded its list (or after a timeout). */
export function ready(timeoutMs = 2500) {
  if (!supported) return Promise.resolve([]);
  refresh();
  if (voices.length) return Promise.resolve(voices);
  return new Promise((resolve) => {
    const done = () => { refresh(); resolve(voices); };
    speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, timeoutMs);
  });
}

if (supported) speechSynthesis.addEventListener('voiceschanged', refresh);

export function onVoicesChanged(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function polishVoices() { return voices.slice(); }

/** Higher is better: Premium > Enhanced > default, local voices preferred. */
export function voiceQuality(v) {
  const s = `${v.name} ${v.voiceURI}`.toLowerCase();
  let q = 0;
  if (s.includes('premium')) q += 3;
  else if (s.includes('enhanced')) q += 2;
  if (v.localService) q += 1;
  return q;
}

export function bestVoice() {
  if (!voices.length) return null;
  const chosen = preferredURI && voices.find((v) => v.voiceURI === preferredURI);
  if (chosen) return chosen;
  return voices.slice().sort((a, b) => voiceQuality(b) - voiceQuality(a))[0];
}

export function configure({ voiceURI, rate }) {
  if (voiceURI !== undefined) preferredURI = voiceURI;
  if (rate !== undefined) rateName = rate;
}

export function isUnlocked() { return unlocked; }

/** Call from inside a user gesture handler. */
export function unlock() {
  if (!supported || unlocked) return;
  unlocked = true;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  speechSynthesis.speak(u);
}

/**
 * Speak Polish text. Returns a promise that resolves when speech ends (or fails).
 * Resolves false if there is no Polish voice.
 */
export function speak(text, { slow = false } = {}) {
  if (!supported) return Promise.resolve(false);
  const voice = bestVoice();
  if (!voice) return Promise.resolve(false);
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = slow ? RATES.slow : (RATES[rateName] ?? RATES.normal);
  current = u;
  return new Promise((resolve) => {
    u.onend = () => { if (current === u) current = null; resolve(true); };
    u.onerror = () => { if (current === u) current = null; resolve(false); };
    speechSynthesis.speak(u);
  });
}

/** Auto-play: only speaks once a tap has unlocked audio this session. */
export function autoSpeak(text) {
  if (!unlocked) return Promise.resolve(false);
  return speak(text);
}

export function stop() { if (supported) speechSynthesis.cancel(); }
