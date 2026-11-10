import { settings, setSetting } from '../settings.js';
import { render, esc, onAction, $ } from '../ui.js';
import * as tts from '../tts.js';
import * as db from '../db.js';
import { DEFAULTS } from '../settings.js';
import { makeBackup, parseBackup, describeBackup, backupFilename } from '../backup.js';
import { loadFlags, flagsAsText } from '../flags.js';
import { timerSettingsChanged } from '../timer.js';

const TEST_PHRASE = 'Dzień dobry! Miło mi.';

function voiceOptions(current) {
  const voices = tts.rankedVoices();
  if (!voices.length) return '<option value="">No Polish voice found</option>';
  return `<option value="">Best available (${esc(tts.voiceLabel(voices[0]))})</option>` +
    voices.map((v) => `<option value="${esc(v.voiceURI)}" ${v.voiceURI === current ? 'selected' : ''}>${esc(tts.voiceLabel(v))}</option>`).join('');
}

const seg = (name, value, options) => `
  <div class="seg" role="radiogroup">
    ${options.map(([v, label]) => `
      <label><input type="radio" name="${name}" value="${v}" ${String(value) === String(v) ? 'checked' : ''}><span>${label}</span></label>`).join('')}
  </div>`;

export function settingsView() {
  const s = settings();
  render({
    title: 'Settings',
    back: '#/',
    body: `
      <form id="settings" class="settings" onsubmit="return false">
        <section>
          <h2>You and your partner</h2>
          <p class="muted small">Chooses the right word forms, e.g. <span lang="pl">byłem</span> (I was, said by a man)
            or <span lang="pl">byłaś</span> (you were, said to a woman).</p>
          <div class="field"><span>I am</span>${seg('learnerGender', s.learnerGender, [['m', 'Male'], ['f', 'Female']])}</div>
          <div class="field"><span>My partner is</span>${seg('partnerGender', s.partnerGender, [['f', 'Female'], ['m', 'Male']])}</div>
        </section>

        <section>
          <h2>Daily study</h2>
          <label class="field"><span>New cards per day</span>
            <input type="number" name="newPerDay" min="0" max="100" step="1" inputmode="numeric" value="${s.newPerDay}"></label>
          <p class="muted small">Shared across all modules. The day resets at 04:00.</p>
          <label class="field"><span>Target retention</span>
            <select name="retention">
              ${[0.8, 0.85, 0.9, 0.95].map((r) => `<option value="${r}" ${r === s.retention ? 'selected' : ''}>${Math.round(r * 100)}%</option>`).join('')}
            </select></label>
          <p class="muted small">Higher means more reviews but fewer forgotten words. 90% is a good default.</p>
        </section>

        <section>
          <h2>Audio</h2>
          <label class="field"><span>Voice</span><select name="voiceURI">${voiceOptions(s.voiceURI)}</select></label>
          <div class="field"><span>Speed</span>${seg('rate', s.rate, [['normal', 'Normal'], ['slow', 'Slow']])}</div>
          <label class="field check"><span>Play audio when a card appears</span>
            <input type="checkbox" name="autoplay" ${s.autoplay ? 'checked' : ''}></label>
          <button type="button" class="btn" data-action="test">Test voice</button>
          <p class="muted small"><a href="#/welcome">About the Polish voice</a></p>
        </section>

        <section>
          <h2>Session</h2>
          <label class="field"><span>Session timer</span>
            <select name="timerMinutes">
              ${[0, 20, 30, 40, 50, 60].map((m) => `<option value="${m}" ${m === Number(s.timerMinutes) ? 'selected' : ''}>${m ? `${m} minutes` : 'Off'}</option>`).join('')}
            </select></label>
          <p class="muted small">A thin bar at the top fills up while you study; it tells you gently when the time is up.</p>
        </section>

        <section>
          <h2>Flagged cards</h2>
          <div id="flag-list"><p class="muted small">Loading…</p></div>
        </section>

        <section>
          <h2>Back up your progress</h2>
          <p class="muted small">Progress lives only on this phone. Export a file now and then (e.g. to Files or iCloud Drive) so you can restore it.</p>
          <button type="button" class="btn" data-action="export">Export progress</button>
          <label class="btn file-btn">Import from file…<input type="file" id="import-file" accept="application/json,.json" hidden></label>
          <p id="backup-msg" class="small" hidden></p>
        </section>

        <section>
          <h2>Start again</h2>
          <button type="button" class="btn danger" data-action="reset">Reset all progress</button>
          <p class="muted small">Forgets every card's progress and your review history. Settings, your own phrases and flags are kept.</p>
        </section>
      </form>`,
  });
  renderFlags();

  const form = $('#settings');
  form.addEventListener('change', async (e) => {
    const { name } = e.target;
    if (!(name in DEFAULTS)) return;
    let value;
    if (name === 'newPerDay') {
      value = Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0)));
      e.target.value = value;
    } else if (name === 'retention') value = Number(e.target.value);
    else if (name === 'autoplay') value = e.target.checked;
    else if (name === 'voiceURI') value = e.target.value || null;
    else if (name === 'timerMinutes') value = Number(e.target.value);
    else value = e.target.value;
    await setSetting(name, value);
    if (name === 'voiceURI' || name === 'rate') tts.configure({ [name]: value });
    if (name === 'timerMinutes') timerSettingsChanged();
  });

  $('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let data;
    try { data = parseBackup(await file.text()); } catch (err) { message(err.message, true); return; }
    if (!confirm(`Replace everything on this phone with this export?\n\n${describeBackup(data)}\n\nYour current progress will be overwritten.`)) return;
    try {
      await db.restoreAll(data.stores);
    } catch (err) { message(`Import failed, nothing was changed: ${err.message}`, true); return; }
    message('Imported. Reloading…');
    setTimeout(() => location.reload(), 600);
  });

  onAction({
    test: () => tts.speak(TEST_PHRASE),
    export: async () => {
      const data = makeBackup(await db.dumpAll());
      download(backupFilename(), JSON.stringify(data), 'application/json');
      message(`Exported ${describeBackup(data)}.`);
    },
    reset: async () => {
      if (!confirm('Reset all progress? Every card goes back to new and your review history is deleted.')) return;
      if (!confirm('Are you sure? This cannot be undone. (Export first if you might want it back.)')) return;
      await db.resetProgress();
      location.hash = '#/';
      location.reload();
    },
    'flags-text': async () => {
      const text = flagsAsText(await db.getAll('flags'));
      download('polski-flags.txt', text, 'text/plain');
    },
    'flags-copy': async () => {
      const text = flagsAsText(await db.getAll('flags'));
      try { await navigator.clipboard.writeText(text); message('Flags copied.'); }
      catch { message('Could not copy; use "Export as text" instead.', true); }
    },
    unflag: async (el) => { await db.del('flags', el.dataset.id); await loadFlags(); renderFlags(); },
  });

  // Voices may arrive after the page renders (common on iOS).
  const off = tts.onVoicesChanged(() => {
    const sel = form.querySelector('select[name=voiceURI]');
    if (sel && document.body.contains(sel)) sel.innerHTML = voiceOptions(settings().voiceURI);
    else off();
  });
}

function message(text, isError = false) {
  const el = document.getElementById('backup-msg');
  if (!el) return;
  el.hidden = false;
  el.className = `small ${isError ? 'warn' : 'ok'}`;
  el.textContent = text;
}

/** Save a file from memory (no network). iOS shows its download / share sheet. */
export function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function renderFlags() {
  const el = document.getElementById('flag-list');
  if (!el) return;
  const flags = (await db.getAll('flags')).sort((a, b) => a.cardId.localeCompare(b.cardId));
  if (!document.body.contains(el)) return;
  el.innerHTML = flags.length
    ? `<ul class="flags">${flags.map((f) => `
        <li><div><span class="pl" lang="pl">${esc(f.text ?? '')}</span> <span class="muted small">${esc(f.cardId)}</span>
          ${f.note ? `<br><span class="small">${esc(f.note)}</span>` : ''}</div>
          <button type="button" class="text-btn" data-action="unflag" data-id="${esc(f.cardId)}">Remove</button></li>`).join('')}</ul>
       <div class="row2 even"><button type="button" class="btn" data-action="flags-copy">Copy</button>
         <button type="button" class="btn" data-action="flags-text">Export as text</button></div>`
    : '<p class="muted small">None yet. Tap ⚑ Flag on any card whose content looks wrong.</p>';
}
