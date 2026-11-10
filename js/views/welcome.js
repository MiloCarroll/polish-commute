// First-run screen: explains how to get a good Polish voice and tests playback.
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
    return `<p class="warn"><strong>No Polish voice found.</strong> Download one using the steps above,
      then reopen the app. Everything works without audio, but listening exercises will be hard.</p>`;
  }
  const q = tts.voiceQuality(v);
  return q >= 2
    ? `<p class="ok">Using <strong>${esc(v.name)}</strong>, a high-quality voice. You're all set.</p>`
    : `<p>Using <strong>${esc(v.name)}</strong>, the basic voice. An Enhanced or Premium voice sounds much more natural.</p>`;
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
        <h2>Get a better Polish voice</h2>
        <p>Audio comes from your iPhone's own voices. The best ones are a free download:</p>
        <ol class="steps">
          <li>Open <strong>Settings</strong> → <strong>Accessibility</strong> → <strong>Spoken Content</strong> → <strong>Voices</strong>.</li>
          <li>Choose <strong>Polish</strong>.</li>
          <li>Download a voice marked <strong>Enhanced</strong> or <strong>Premium</strong> (Wi-Fi recommended).</li>
          <li>Come back here and tap <em>Test</em>.</li>
        </ol>
      </section>
      <section class="card">
        <h2>Test playback</h2>
        <div id="voice-status">${voiceStatus()}</div>
        <div class="audio-row">
          <button class="btn" data-action="test">${speakerIcon}<span>Test: “<span lang="pl">${TEST_WORD}</span>”</span></button>
        </div>
        <p class="muted small">Audio is best through headphones. If you hear nothing, check the volume
          and try with the silent switch off.</p>
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
