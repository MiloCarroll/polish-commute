// Service worker: versioned, cache-first cache of every app file.
// VERSION and ASSETS are rewritten by `node tools/update-sw.js` — run it before each deploy.
// A new version installs in the background and waits; the app shows an "Update available"
// banner, and tapping it sends SKIP_WAITING.

const VERSION = '960ab6127fcc';
const ASSETS = [
  './',
  'content/audio/test.m4a',
  'content/dialogues.json',
  'content/grammar.json',
  'content/pronunciation.json',
  'content/vocabulary.json',
  'css/app.css',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon.svg',
  'index.html',
  'js/accentbar.js',
  'js/app.js',
  'js/backup.js',
  'js/content.js',
  'js/day.js',
  'js/db.js',
  'js/exercises.js',
  'js/flags.js',
  'js/grading.js',
  'js/lesson.js',
  'js/own.js',
  'js/scheduler.js',
  'js/session.js',
  'js/settings.js',
  'js/stats.js',
  'js/timer.js',
  'js/tts.js',
  'js/ui.js',
  'js/variants.js',
  'js/views/home.js',
  'js/views/module.js',
  'js/views/phrases.js',
  'js/views/settings.js',
  'js/views/stats.js',
  'js/views/study.js',
  'js/views/welcome.js',
  'manifest.webmanifest',
  'vendor/ts-fsrs-5.4.2.js',
];

// Recorded audio clips (content/audio/**.mp3). Cached one by one after the app files, so a
// single failed download can't block an update; anything missed is cached when first played.
const AUDIO = [];

const CACHE = `polski-${VERSION}`;

async function cacheAudio(cache) {
  const old = await caches.keys();
  const batch = 8;
  for (let i = 0; i < AUDIO.length; i += batch) {
    await Promise.all(AUDIO.slice(i, i + batch).map(async (url) => {
      // Reuse a clip already cached by an earlier version instead of downloading it again.
      for (const k of old) {
        if (k === CACHE) continue;
        const hit = await (await caches.open(k)).match(url);
        if (hit) { await cache.put(url, hit); return; }
      }
      try { await cache.add(url); } catch { /* fetched later, on first play */ }
    }));
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(async (c) => {
    await c.addAll(ASSETS.map((a) => new Request(a, { cache: 'reload' })));
    await cacheAudio(c);
  }));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('polski-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Navigations (including "./" from the home-screen icon) are served the app shell.
    const hit = req.mode === 'navigate'
      ? await cache.match('./', { ignoreSearch: true })
      : await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const res = await fetch(req);
    // Cache audio clips the first time they're played (if the install-time download missed them).
    if (res.ok && new URL(req.url).pathname.includes('/content/audio/')) cache.put(req, res.clone());
    return res;
  })());
});
