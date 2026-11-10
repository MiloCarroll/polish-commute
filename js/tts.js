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

/** Display name, adding the quality iOS encodes in the voice URI but not always in the name. */
export function voiceLabel(v) {
  const s = `${v.name} ${v.voiceURI}`.toLowerCase();
  const tier = s.includes('premium') ? 'Premium' : s.includes('enhanced') ? 'Enhanced' : '';
  return tier && !v.name.toLowerCase().includes(tier.toLowerCase()) ? `${v.name} (${tier})` : v.name;
}

/** Polish voices, best first. Ties go to the voice the system marks as default. */
export function rankedVoices() {
  return voices.slice().sort((a, b) =>
    voiceQuality(b) - voiceQuality(a) || Number(b.default) - Number(a.default));
}

export function bestVoice() {
  if (!voices.length) return null;
  const chosen = preferredURI && voices.find((v) => v.voiceURI === preferredURI);
  return chosen || rankedVoices()[0];
}

export function configure({ voiceURI, rate }) {
  if (voiceURI !== undefined) preferredURI = voiceURI;
  if (rate !== undefined) rateName = rate;
}

export function isUnlocked() { return unlocked; }

// ---- Silent switch -----------------------------------------------------------
// By default iOS treats web audio as "ambient", which the silent switch mutes.
// Two measures ask for "playback" instead, like a music app:
//  1. The Audio Session API (Safari 16.4+), where available.
//  2. Playing a short silent clip through an <audio> element from the unlocking tap,
//     which on many iOS versions moves the page's audio session to playback.
// Whether speech synthesis follows the page's session varies by iOS version; this is
// checked on the device (see docs/iphone-checklist.md).

function requestPlaybackSession() {
  try {
    if (typeof navigator !== 'undefined' && navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch { /* not supported */ }
}
requestPlaybackSession();

/** A tiny silent WAV built in memory, so no file or network request is needed. */
function silentWavUrl(seconds = 0.5, rate = 8000) {
  const n = Math.round(seconds * rate);
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const str = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  str(36, 'data'); v.setUint32(40, n, true);
  new Uint8Array(buf, 44).fill(128); // 8-bit unsigned silence
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

let silentAudio = null;
function playSilentClip() {
  try {
    silentAudio ??= Object.assign(new Audio(silentWavUrl()), { playsInline: true });
    silentAudio.setAttribute('playsinline', '');
    silentAudio.play()?.catch(() => {});
  } catch { /* ignore */ }
}

/** Call from inside a user gesture handler. */
export function unlock() {
  if (!supported || unlocked) return;
  unlocked = true;
  requestPlaybackSession();
  playSilentClip();
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
  playSilentClip(); // keeps the playback session active (only takes effect inside a tap)
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
