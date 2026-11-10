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
  const all = tts.rankedVoices();
  return `${q >= 2
      ? `<p class="ok">Using <strong>${esc(tts.voiceLabel(v))}</strong>, a high-quality voice. You're all set.</p>`
      : `<p>Using <strong>${esc(tts.voiceLabel(v))}</strong>, the basic voice. An Enhanced or Premium voice sounds much more natural.</p>`}
    <details class="voices">
      <summary>Polish voices this app can see (${all.length})</summary>
      <ul>${all.map((x) => `<li>${esc(tts.voiceLabel(x))}${x === v ? ' · <strong>in use</strong>' : ''}
        <br><span class="muted small">${esc(x.voiceURI)}</span></li>`).join('')}</ul>
      <p class="muted small">If a voice you downloaded is missing here, fully close Polski (swipe it away) and reopen it.</p>
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
        <h2>Get a better Polish voice</h2>
        <p>Audio comes from your iPhone's own voices. The best ones are a free download:</p>
        <ol class="steps">
          <li>Open <strong>Settings</strong> → <strong>Accessibility</strong> → <strong>Read &amp; Speak</strong>
            (called <strong>Spoken Content</strong> on older iOS) → <strong>Voices</strong>.</li>
          <li>Choose <strong>Polish</strong>.</li>
          <li>Download a voice marked <strong>Enhanced</strong> or <strong>Premium</strong> (Wi-Fi recommended).</li>
          <li>Fully close Polski (swipe it away in the app switcher) and reopen it, then tap <em>Test</em>.</li>
        </ol>
        <p class="muted small">Choosing a voice in iPhone Settings doesn't change the voice here: the app picks the
          best Polish voice it can see. To choose one yourself, use <strong>Voice</strong> in Polski's Settings.</p>
      </section>
      <section class="card">
        <h2>Test playback</h2>
        <div id="voice-status">${voiceStatus()}</div>
        <div class="audio-row">
          <button class="btn" data-action="test">${speakerIcon}<span>Test: “<span lang="pl">${TEST_WORD}</span>”</span></button>
        </div>
        <p class="muted small">Audio is best through headphones. If you hear nothing without headphones,
          check the volume and whether the phone is on silent.</p>
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
