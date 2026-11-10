// First-run screen: explains how audio works on iPhone and tests playback.
import { settings, setSetting } from '../settings.js';
import { render, esc, onAction, speakerIcon, $ } from '../ui.js';
import * as tts from '../tts.js';

const TEST_WORD = 'Dzień dobry';

function voiceStatus() {
  if (!tts.supported) {
    return `<p class="warn">This browser has no speech support. The app still works, but without audio.</p>`;
  }
  const v = tts.bestVoice();
  if (!v) {
    return `<p class="warn"><strong>No Polish voice found.</strong> On iPhone, open Settings → Accessibility →
      Read &amp; Speak → Voices → Polish and download a voice, then fully close and reopen Polski.
      Everything works without audio, but listening exercises will be hard.</p>`;
  }
  const q = tts.voiceQuality(v);
  const all = tts.rankedVoices();
  return `${q >= 2
      ? `<p class="ok">Using <strong>${esc(tts.voiceLabel(v))}</strong>, a high-quality voice. You're all set.</p>`
      : `<p class="ok">Using <strong>${esc(tts.voiceLabel(v))}</strong>.</p>`}
    <details class="voices">
      <summary>Polish voices this app can see (${all.length})</summary>
      <ul>${all.map((x) => `<li>${esc(tts.voiceLabel(x))}${x === v ? ' · <strong>in use</strong>' : ''}
        <br><span class="muted small">${esc(x.voiceURI)}</span></li>`).join('')}</ul>
    </details>`;
}

export function welcomeView() {
  const first = !settings().firstRunDone;
  render({
    title: first ? 'Welcome' : 'Polish voice',
    back: first ? null : '#/settings',
    body: `
      ${first ? `<p class="lead">Polski is a quiet, offline trainer for your commute. No microphone, no accounts, no streaks.
        Everything stays on this phone.</p>` : ''}
      <section class="card">
        <h2>About the voice</h2>
        <p>Polski speaks using your iPhone's built-in Polish voice. There's nothing to set up.</p>
        <ul class="steps">
          <li><strong>Use headphones.</strong> Audio does not play out loud while the phone is on silent.</li>
          <li>Voices downloaded in iPhone Settings (Enhanced or Premium) aren't available to web apps,
            so changing the voice there won't change it here.</li>
        </ul>
      </section>
      <section class="card">
        <h2>Test playback</h2>
        <div id="voice-status">${voiceStatus()}</div>
        <div class="audio-row">
          <button class="btn" data-action="test">${speakerIcon}<span>Test: “<span lang="pl">${TEST_WORD}</span>”</span></button>
        </div>
        <p class="muted small">Hear nothing? Plug in headphones, or turn silent off, and check the volume.</p>
      </section>`,
    actions: first ? `<button class="btn primary" data-action="done">Start learning</button>` : '',
  });

  onAction({
    test: () => tts.speak(TEST_WORD),
    done: async () => { await setSetting('firstRunDone', true); location.hash = '#/'; },
  });

  tts.ready().then(() => { const el = $('#voice-status'); if (el) el.innerHTML = voiceStatus(); });
  const off = tts.onVoicesChanged(() => {
    const el = $('#voice-status');
    if (el) el.innerHTML = voiceStatus(); else off();
  });
}
