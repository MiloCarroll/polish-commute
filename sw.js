// Service worker: versioned, cache-first cache of every app file.
// VERSION and ASSETS are rewritten by `node tools/update-sw.js` — run it before each deploy.
// A new version installs in the background and waits; the app shows an "Update available"
// banner, and tapping it sends SKIP_WAITING.

const VERSION = 'fbae8dcd24d8';
const ASSETS = [
  './',
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
  'js/content.js',
  'js/day.js',
  'js/db.js',
  'js/exercises.js',
  'js/grading.js',
  'js/lesson.js',
  'js/scheduler.js',
  'js/settings.js',
  'js/tts.js',
  'js/ui.js',
  'js/views/home.js',
  'js/views/module.js',
  'js/views/settings.js',
  'js/views/study.js',
  'js/views/welcome.js',
  'manifest.webmanifest',
  'vendor/ts-fsrs-5.4.2.js',
];

const CACHE = `polski-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((a) => new Request(a, { cache: 'reload' })))));
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
    return hit || fetch(req);
  })());
});
