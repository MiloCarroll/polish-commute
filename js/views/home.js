import { state } from '../app.js';
import { settings, setSetting } from '../settings.js';
import { backupReminder } from '../backup.js';
import { MODULES, allDefs } from '../content.js';
import { countCards, newRemaining } from '../scheduler.js';
import { render, esc, plural, onAction } from '../ui.js';

export function homeView() {
  const { content, records, todayLogs } = state;
  const newLeft = newRemaining(settings().newPerDay, todayLogs);
  const all = countCards(allDefs(content), records);
  const totalDue = all.due;
  const newToday = Math.min(all.newAvailable, newLeft);
  const s = settings();
  const reminder = backupReminder({ lastBackup: s.lastBackup, firstStudy: s.firstStudy, snoozeUntil: s.backupSnoozeUntil });

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
      ${reminder ? `<div class="notice backup-note" id="backup-note">
          <p>${reminder.never ? "You haven't backed up your progress yet." : `Your last backup was ${reminder.daysSince} days ago.`}
            Progress is stored only on this phone.</p>
          <div class="row2 even"><button class="btn" data-action="backup-later">Later</button>
            <a class="btn primary" href="#/settings">Back up now</a></div>
        </div>` : ''}
      <div class="tiles">${tiles}</div>
      <nav class="links">
        <a href="#/stats">Stats</a>
        <a href="#/phrase/new">Add phrase</a>
        <a href="#/settings">Settings</a>
      </nav>`,
    actions: `
      ${totalDue || newToday
        ? `<a class="btn primary today" href="#/study/today"><span>Today's session</span>
             <span class="small">${totalDue} due · ${newToday} new</span></a>`
        : `<button class="btn primary" disabled>All done for today</button>`}
      ${totalDue ? `<a class="btn secondary" href="#/study/all">Review all due only (${totalDue})</a>` : ''}`,
  });
  onAction({
    'backup-later': async () => {
      await setSetting('backupSnoozeUntil', Date.now() + 3 * 86400000);
      document.getElementById('backup-note')?.remove();
    },
  });
}
