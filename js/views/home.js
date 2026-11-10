import { state } from '../app.js';
import { settings } from '../settings.js';
import { MODULES, allDefs } from '../content.js';
import { countCards, newRemaining } from '../scheduler.js';
import { render, esc, plural } from '../ui.js';

export function homeView() {
  const { content, records, todayLogs } = state;
  const newLeft = newRemaining(settings().newPerDay, todayLogs);
  const totalDue = countCards(allDefs(content), records).due;

  const tiles = MODULES.map((m) => {
    const mod = content[m];
    const c = countCards(mod.defs, records);
    const pct = c.total ? Math.round((c.learned / c.total) * 100) : 0;
    const empty = c.total === 0;
    return `
      <a class="tile tile-${m}" href="#/module/${m}">
        <div class="tile-head">
          <h2>${esc(mod.title)}</h2>
          ${c.due ? `<span class="badge">${c.due} due</span>` : ''}
        </div>
        ${empty
          ? `<p class="muted">${esc(mod.status || 'Coming soon')}</p>`
          : `<p class="tile-stats"><span>${plural(c.due, 'review')} due</span><span>${c.newAvailable} new</span></p>
             <div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"
               aria-label="${esc(mod.title)} progress"><span style="width:${pct}%"></span></div>
             <p class="muted small">${c.learned} of ${c.total} cards learned</p>`}
      </a>`;
  }).join('');

  render({
    title: 'Polski',
    body: `
      <p class="allowance">${newLeft
        ? `<strong>${newLeft}</strong> of ${settings().newPerDay} new cards left today`
        : `No new cards left today. Reviews are unlimited.`}</p>
      <div class="tiles">${tiles}</div>
      <nav class="links">
        <a href="#/stats">Stats</a>
        <a href="#/phrase/new">Add phrase</a>
        <a href="#/settings">Settings</a>
      </nav>`,
    actions: totalDue
      ? `<a class="btn primary" href="#/study/all">Review all due (${totalDue})</a>`
      : `<button class="btn primary" disabled>Nothing due right now</button>`,
  });
}
