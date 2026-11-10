// Session timer: a thin bar at the top that fills over the session length (default 40 min).
// It starts the first time a study screen opens, counts only while the app is visible,
// and when time is up it says so gently and lets you carry on. Off when set to 0.
import { settings } from './settings.js';

let started = false;
let elapsed = 0;        // ms counted so far
let lastTick = null;    // timestamp of the last tick while visible
let announced = false;
let bar = null;
let fill = null;
let interval = null;

function ensureBar() {
  if (bar) return;
  bar = document.createElement('div');
  bar.className = 'session-timer';
  bar.hidden = true;
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-label', 'Session time');
  bar.innerHTML = '<span></span>';
  fill = bar.firstElementChild;
  document.body.prepend(bar);
}

function minutes() { return Number(settings().timerMinutes) || 0; }

function tick() {
  if (!started || document.visibilityState !== 'visible') { lastTick = null; return; }
  const now = Date.now();
  if (lastTick !== null) elapsed += now - lastTick;
  lastTick = now;
  draw();
}

function draw() {
  const total = minutes() * 60000;
  if (!bar) return;
  bar.hidden = !started || !total;
  if (!total) return;
  const frac = Math.min(1, elapsed / total);
  fill.style.width = `${(frac * 100).toFixed(2)}%`;
  bar.setAttribute('aria-valuenow', String(Math.round(frac * 100)));
  bar.classList.toggle('done', frac >= 1);
  if (frac >= 1 && !announced) {
    announced = true;
    toast(`${minutes()} minutes done. Nice work! Carry on if you like.`);
  }
}

export function toast(text) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.innerHTML = `<span></span><button type="button" aria-label="Dismiss">✕</button>`;
  t.firstElementChild.textContent = text;
  t.querySelector('button').onclick = () => t.remove();
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 12000);
}

/** Called on every route change: the first study screen starts the timer. */
export function timerOnRoute(hash) {
  if (!started && hash.startsWith('#/study/') && minutes() > 0) {
    started = true;
    lastTick = Date.now();
    draw();
  }
}

/** Settings changed: redraw; turning it off hides the bar, and a longer time re-arms the message. */
export function timerSettingsChanged() {
  if (elapsed < minutes() * 60000) announced = false;
  draw();
}

export function initTimer() {
  ensureBar();
  clearInterval(interval);
  interval = setInterval(tick, 5000);
  document.addEventListener('visibilitychange', tick);
}

/** For tests in the browser. */
export const _timer = { get elapsed() { return elapsed; }, set elapsed(v) { elapsed = v; draw(); } };
