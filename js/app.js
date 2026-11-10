// App entry: loads data, routes between views, registers the service worker.
import * as db from './db.js';
import * as tts from './tts.js';
import { loadSettings, settings, setSetting } from './settings.js';
import { loadContent } from './content.js';
import { dayStart } from './day.js';
import { esc } from './ui.js';
import { hideAccentBar } from './accentbar.js';
import { homeView } from './views/home.js';
import { moduleView, topicView } from './views/module.js';
import { studyView } from './views/study.js';
import { settingsView } from './views/settings.js';
import { welcomeView } from './views/welcome.js';
import { statsView } from './views/stats.js';
import { phraseFormView } from './views/phrases.js';
import { withOwnPhrases } from './own.js';
import { initFlags } from './flags.js';
import { initTimer, timerOnRoute } from './timer.js';

/** Shared in-memory state. Views read from it; study writes reviews through `recordReview`. */
export const state = {
  content: null,
  own: [],            // the owner's phrases (IndexedDB "own" store)
  records: new Map(), // card id → FSRS record
  todayLogs: [],      // review-log entries since the start of the current study day
  todayStart: 0,
};

export async function refreshToday() {
  const start = dayStart().getTime();
  if (start !== state.todayStart) {
    state.todayStart = start;
    state.todayLogs = await db.reviewsSince(start);
    return true; // reloaded from the database
  }
  return false;
}

/** Re-read the owner's phrases and rebuild the vocabulary module's My phrases topic. */
export async function reloadOwnPhrases() {
  state.own = await db.getAll('own');
  state.content.vocabulary = withOwnPhrases(state.content.vocabulary, state.own);
}

/**
 * Save a review. Returns an undo handle { cardId, previous, logKey, log } that
 * undoLastReview() can use to put everything back.
 */
export async function recordReview(record, log) {
  const previous = state.records.get(record.id) ?? null;
  const logKey = await db.saveReview(record, log);
  if (!settings().firstStudy) setSetting('firstStudy', log.review);
  state.records.set(record.id, record);
  const reloaded = await refreshToday();
  if (!reloaded && log.review >= state.todayStart) state.todayLogs.push(log);
  return { cardId: record.id, previous, logKey, log };
}

export async function undoLastReview(handle) {
  await db.undoReview(handle.cardId, handle.previous, handle.logKey);
  if (handle.previous) state.records.set(handle.cardId, handle.previous);
  else state.records.delete(handle.cardId);
  const i = state.todayLogs.lastIndexOf(handle.log);
  if (i >= 0) state.todayLogs.splice(i, 1);
}

// ---- Routing ---------------------------------------------------------------

const routes = [
  [/^#?\/?$/, () => homeView()],
  [/^#\/module\/(\w+)$/, (m) => moduleView(m[1])],
  [/^#\/topic\/(\w+)\/([\w-]+)$/, (m) => topicView(m[1], m[2])],
  [/^#\/study\/(\w+)(?:\/([\w-]+))?$/, (m) => studyView(m[1], m[2])],
  [/^#\/settings$/, () => settingsView()],
  [/^#\/welcome$/, () => welcomeView()],
  [/^#\/stats$/, () => statsView()],
  [/^#\/phrase\/(new|u-[\w]+)$/, (m) => phraseFormView(m[1])],
];

async function route() {
  tts.stop();
  hideAccentBar();
  await refreshToday();
  const hash = location.hash || '#/';
  timerOnRoute(hash);
  if (!settings().firstRunDone && hash !== '#/welcome' && hash !== '#/settings') {
    location.replace('#/welcome');
    return;
  }
  for (const [re, fn] of routes) {
    const m = hash.match(re);
    if (m) return fn(m);
  }
  location.replace('#/');
}

export function go(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

// ---- Service worker and update banner -------------------------------------

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const offer = (worker) => showUpdateBanner(() => worker.postMessage({ type: 'SKIP_WAITING' }));
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
      });
    });
    // Check for a new version whenever the app comes back to the foreground.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch((err) => console.warn('Service worker registration failed', err));
}

function showUpdateBanner(onTap) {
  const b = document.getElementById('update');
  b.hidden = false;
  b.onclick = () => { b.textContent = 'Updating…'; onTap(); };
}

// ---- Start -----------------------------------------------------------------

async function start() {
  // The first tap of each session unlocks speech on iOS.
  const unlock = () => tts.unlock();
  document.addEventListener('pointerdown', unlock, { once: true, capture: true });
  document.addEventListener('touchend', unlock, { once: true, capture: true });

  try {
    await db.openDB();
    const [s, records, content] = await Promise.all([loadSettings(), db.getAll('cards'), loadContent()]);
    tts.configure({ voiceURI: s.voiceURI, rate: s.rate });
    tts.ready();
    tts.loadClips();
    state.content = content;
    state.records = new Map(records.map((r) => [r.id, r]));
    await reloadOwnPhrases();
    if (!s.firstStudy && records.length) {
      // Progress from before the backup reminder existed: take the first review's date.
      const first = (await db.getAll('reviews')).reduce((m, r) => Math.min(m, r.review), Infinity);
      if (Number.isFinite(first)) await setSetting('firstStudy', first);
    }
    db.requestPersistence();
  } catch (err) {
    document.getElementById('view').innerHTML =
      `<div class="card"><h2>Could not start</h2><p>${esc(err.message)}</p></div>`;
    throw err;
  }
  initFlags();
  initTimer();
  window.addEventListener('hashchange', route);
  await route();
  registerServiceWorker();
}

start();
