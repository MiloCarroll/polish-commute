import { settings, setSetting } from '../settings.js';
import { render, esc, onAction, $ } from '../ui.js';
import * as tts from '../tts.js';

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

        <p class="muted small">Session timer, export/import, flagged cards and reset arrive in stage 5.</p>
      </form>`,
  });

  const form = $('#settings');
  form.addEventListener('change', async (e) => {
    const { name } = e.target;
    let value;
    if (name === 'newPerDay') {
      value = Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0)));
      e.target.value = value;
    } else if (name === 'retention') value = Number(e.target.value);
    else if (name === 'autoplay') value = e.target.checked;
    else if (name === 'voiceURI') value = e.target.value || null;
    else value = e.target.value;
    await setSetting(name, value);
    if (name === 'voiceURI' || name === 'rate') tts.configure({ [name]: value });
  });
  onAction({ test: () => tts.speak(TEST_PHRASE) });

  // Voices may arrive after the page renders (common on iOS).
  const off = tts.onVoicesChanged(() => {
    const sel = form.querySelector('select[name=voiceURI]');
    if (sel && document.body.contains(sel)) sel.innerHTML = voiceOptions(settings().voiceURI);
    else off();
  });
}
