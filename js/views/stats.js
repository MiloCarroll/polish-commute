// Stats: days studied, cards learned, cards due in the next 7 days (with a small inline
// SVG bar chart), and accuracy per module. Simple numbers; no streaks.
import { state } from '../app.js';
import * as db from '../db.js';
import { MODULES } from '../content.js';
import { daysStudied, cardsLearned, dueByDay, accuracyByModule } from '../stats.js';
import { render, esc } from '../ui.js';

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
        <h2>Accuracy</h2>
        <p class="muted small">Share of reviews you didn't mark "Again" (or got right).</p>
        <table class="acc">${accRows}</table>
      </section>
      <p class="muted small">"Cards learned" counts cards with at least one successful review.</p>`,
  });
}
