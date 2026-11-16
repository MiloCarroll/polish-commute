// Stats: days studied, cards learned, cards due in the next 7 days (with a small inline
// SVG bar chart), and accuracy per module. Simple numbers; no streaks.
import { state } from '../app.js';
import * as db from '../db.js';
import { MODULES } from '../content.js';
import { daysStudied, cardsLearned, dueByDay, accuracyByModule, forecast, forecastAverage, passRates, secondsPerCard } from '../stats.js';
import { dayKey } from '../day.js';
import { settings } from '../settings.js';
import { render, esc } from '../ui.js';

/** Minutes a day you've actually studied, averaged over your last 7 study days. */
function recentMinutes(reviews) {
  const byDay = new Map();
  for (const r of reviews) {
    const k = dayKey(new Date(r.review));
    byDay.set(k, (byDay.get(k) ?? 0) + Math.min(r.duration ?? 0, 120000));
  }
  const last = [...byDay.keys()].sort().slice(-7);
  if (!last.length) return null;
  return Math.round(last.reduce((n, k) => n + byDay.get(k), 0) / last.length / 60000);
}

/** The forecast section: for a few new-cards-per-day settings, the reviews and minutes ahead. */
function forecastHtml(records, reviews) {
  const current = settings().newPerDay;
  const rates = passRates(reviews);
  const spc = secondsPerCard(reviews);
  const options = [...new Set([20, 30, 40, 50, current])].filter((n) => n > 0).sort((a, b) => a - b);
  const rows = options.map((n) => {
    const f = forecast(records, { newPerDay: n, retention: settings().retention, ...rates });
    const w1 = forecastAverage(f, 0, 7), w4 = forecastAverage(f, 21, 28);
    const min = Math.round(((w4.reviews + w4.newShown) * spc) / 60);
    return `<tr class="${n === current ? 'current' : ''}">
      <td class="num">${n}${n === current ? '<span class="small muted"> now</span>' : ''}</td>
      <td class="num">${w1.reviews} → ${w4.reviews}</td>
      <td class="num">${min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}` : `${min} min`}</td></tr>`;
  }).join('');
  const recent = recentMinutes(reviews);
  return `
    <p class="small">Each new card keeps coming back as reviews, so the daily load keeps growing for weeks after you raise the number.</p>
    <table class="acc forecast">
      <tr><th class="num">New a day</th><th class="num">Reviews a day,<br>week 1 → week 4</th><th class="num">Time a day<br>by week 4</th></tr>
      ${rows}
    </table>
    <p class="muted small">Based on your answers so far: you pass about ${Math.round(rates.pass * 100)}% of reviews and spend about ${spc} s a card.
      Time includes new cards and their repeats; "Learn 10 more" extras aren't counted.
      ${recent != null ? `Lately you've studied about <strong>${recent} min a day</strong>.` : ''}
      Change it in <a href="#/settings">Settings → New cards per day</a>.</p>`;
}

function dayLabel(start, i) {
  if (i === 0) return 'Today';
  return new Date(start).toLocaleDateString('en-GB', { weekday: 'short' });
}

/** Bar chart of cards due per day. Colours come from CSS variables so it follows the theme. */
function dueChart(days) {
  const W = 320, H = 150, top = 22, bottom = 26, gap = 10;
  const max = Math.max(1, ...days.map((d) => d.count));
  const bw = (W - gap * (days.length - 1)) / days.length;
  const bars = days.map((d, i) => {
    const h = Math.round(((H - top - bottom) * d.count) / max);
    const x = i * (bw + gap);
    const y = H - bottom - h;
    return `
      <rect x="${x}" y="${d.count ? y : H - bottom - 2}" width="${bw}" height="${d.count ? h : 2}" rx="4" class="${i === 0 ? 'bar today' : 'bar'}"/>
      <text x="${x + bw / 2}" y="${(d.count ? y : H - bottom - 2) - 6}" text-anchor="middle" class="bar-value">${d.count}</text>
      <text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle" class="bar-label">${esc(dayLabel(d.start, i))}</text>`;
  }).join('');
  const desc = days.map((d, i) => `${dayLabel(d.start, i)}: ${d.count}`).join(', ');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Cards due over the next 7 days. ${esc(desc)}">${bars}</svg>`;
}

export async function statsView() {
  render({ title: 'Stats', back: '#/', body: '<p class="muted">Loading…</p>' });
  const reviews = await db.getAll('reviews');
  if (location.hash !== '#/stats') return;
  const records = [...state.records.values()];
  const days = dueByDay(records);
  const due7 = days.reduce((n, d) => n + d.count, 0);
  const acc = accuracyByModule(reviews, MODULES);

  const tile = (n, label) => `<div class="stat"><span class="stat-n">${n}</span><span class="stat-l">${label(n)}</span></div>`;
  const accRows = MODULES.map((m) => {
    const a = acc[m];
    const pct = a.total ? Math.round((100 * a.correct) / a.total) : null;
    return `<tr><td>${esc(state.content[m].title)}</td>
      <td class="num">${pct === null ? '–' : `${pct}%`}</td>
      <td class="num muted small">${a.total ? `${a.correct} of ${a.total}` : 'no reviews yet'}</td></tr>`;
  }).join('');

  render({
    title: 'Stats', back: '#/',
    body: `
      <div class="stats-grid">
        ${tile(daysStudied(reviews), (n) => (n === 1 ? 'day studied' : 'days studied'))}
        ${tile(cardsLearned(records), (n) => (n === 1 ? 'card learned' : 'cards learned'))}
        ${tile(due7, () => 'due in the next 7 days')}
        ${tile(reviews.length, (n) => (n === 1 ? 'review in total' : 'reviews in total'))}
      </div>
      <section class="card">
        <h2>Due over the next 7 days</h2>
        ${dueChart(days)}
      </section>
      <section class="card">
        <h2>Workload forecast</h2>
        <div id="forecast"><p class="muted small">Working it out…</p></div>
      </section>
      <section class="card">
        <h2>Accuracy</h2>
        <p class="muted small">Share of reviews you didn't mark "Again" (or got right).</p>
        <table class="acc">${accRows}</table>
      </section>
      <p class="muted small">"Cards learned" counts cards with at least one successful review.</p>`,
  });
  // The simulation takes a moment on a phone: let the page paint first.
  setTimeout(() => {
    const el = document.getElementById('forecast');
    if (el) el.innerHTML = forecastHtml(records, reviews);
  }, 30);
}
