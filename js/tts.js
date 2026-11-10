// Text-to-speech using the Web Speech API, Polish voices only.
//
// iOS notes:
//  - Voices often load late; we wait for `voiceschanged` (with a timeout).
//  - Speech must be started from a user gesture once per page load. The first tap anywhere
//    calls unlock(), which speaks a silent utterance; after that auto-play works.
//  - Speech is muted when the phone is on silent (tested Nov 2026; asking for a "playback"
//    audio session did not help), so headphones or silent off are needed.
//  - Safari only offers web pages the built-in compact voices (e.g. "Zosia"); Enhanced and
//    Premium voices downloaded in iPhone Settings are not exposed. We still prefer them if a
//    future iOS lists them.
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

// ---- Bundled audio clips --------------------------------------------------------
// content/audio/manifest.json maps exact Polish text → an audio file. When a clip exists
// it is played through an <audio> element (better voice; also plays with the phone on
// silent on most iOS versions); otherwise speech synthesis is used.

const clips = new Map();
let audioEl = null;

const clipKey = (text) => String(text).normalize('NFC').replace(/\s+/g, ' ').trim();

export async function loadClips() {
  try {
    const res = await fetch('content/audio/manifest.json');
    if (!res.ok) return 0;
    const m = await res.json();
    for (const [text, file] of Object.entries(m.clips ?? {})) clips.set(clipKey(text), `content/audio/${file}`);
  } catch { /* no clips: speech synthesis only */ }
  return clips.size;
}

export const clipCount = () => clips.size;
export const hasClip = (text) => clips.has(clipKey(text));
export const canSpeak = (text) => hasClip(text) || !!bestVoice();

function audio() {
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.setAttribute('playsinline', '');
    audioEl.preload = 'auto';
  }
  return audioEl;
}

/** Play an audio file. Resolves true when it finishes, false on error. */
export function playFile(src, { slow = false } = {}) {
  const a = audio();
  if (supported) speechSynthesis.cancel();
  a.pause();
  a.src = src;
  a.preservesPitch = true;
  a.playbackRate = slow ? 0.75 : (rateName === 'slow' ? 0.85 : 1);
  return new Promise((resolve) => {
    a.onended = () => resolve(true);
    a.onerror = () => resolve(false);
    const p = a.play();
    if (p) p.catch(() => resolve(false));
  });
}

/** A tiny silent WAV built in memory, used to unlock the <audio> element on iOS. */
function silentWavUrl() {
  const n = 800;
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const str = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  str(36, 'data'); v.setUint32(40, n, true);
  new Uint8Array(buf, 44).fill(128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

/** Call from inside a user gesture handler: unlocks both speech and the audio element. */
export function unlock() {
  if (unlocked) return;
  unlocked = true;
  try {
    const a = audio();
    a.src = silentWavUrl();
    a.play()?.catch(() => {});
  } catch { /* ignore */ }
  if (supported) {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  }
}

/**
 * Speak Polish text: a bundled clip if there is one, otherwise the Polish voice.
 * Resolves when playback ends; false if nothing could be played.
 */
export function speak(text, { slow = false } = {}) {
  const clip = clips.get(clipKey(text));
  if (clip) return playFile(clip, { slow }).then((ok) => ok || speakVoice(text, { slow }));
  return speakVoice(text, { slow });
}

function speakVoice(text, { slow = false } = {}) {
  if (!supported) return Promise.resolve(false);
  const voice = bestVoice();
  if (!voice) return Promise.resolve(false);
  audioEl?.pause();
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

export function stop() {
  audioEl?.pause();
  if (supported) speechSynthesis.cancel();
}
