// Hands-free listening: sentences you have studied, read out with pauses, as one
// continuous track that keeps playing with the screen off. Nothing is graded or scheduled.
import { state } from '../app.js';
import { settings, setSetting } from '../settings.js';
import { resolveExample, resolveLine } from '../variants.js';
import { audioFrames, silence, stepsFor, shuffled } from '../handsfree.js';
import { render, onAction, esc } from '../ui.js';
import * as tts from '../tts.js';

const seg = (name, value, options) => `
  <div class="seg" role="radiogroup">
    ${options.map(([v, label]) => `
      <label><input type="radio" name="${name}" value="${v}" ${String(value) === String(v) ? 'checked' : ''}><span>${label}</span></label>`).join('')}
  </div>`;

/** Sentences from cards you've seen: vocabulary examples and conversation lines with a recorded clip. */
function sentencePool() {
  const g = { learnerGender: settings().learnerGender, partnerGender: settings().partnerGender };
  const { content, records } = state;
  const out = [];
  const seen = new Set();
  const add = (pl, en, gender) => {
    if (!pl || seen.has(pl)) return;
    const plUrl = tts.clipUrl(pl, gender ? { gender } : { variety: true });
    if (!plUrl) return;
    seen.add(pl);
    out.push({ pl, en, plUrl, enUrl: tts.englishClipUrl(en) });
  };
  for (const t of content.vocabulary.topics) {
    for (const item of t.items) {
      if (!records.has(`${item.id}-rec`)) continue;
      for (const e of item.examples ?? []) {
        const r = resolveExample(e, g);
        const gender = e.v ? (e.speaker === 'partner' ? g.partnerGender : g.learnerGender) : null;
        if (r) add(r.pl, r.en, gender);
      }
    }
  }
  for (const t of content.dialogues.topics) {
    for (const line of t.items) {
      if (!records.has(`${line.id}-listen`)) continue;
      const r = resolveLine(line, t.cast, g);
      add(r.pl, r.en, r.gender);
    }
  }
  return out;
}

let player = null; // { audio, url } while a track exists

function stopPlayer() {
  if (!player) return;
  player.audio.pause();
  URL.revokeObjectURL(player.url);
  player = null;
  if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;
}

export function listenView() {
  stopPlayer();
  const pool = sentencePool();
  const withEnglish = pool.filter((s) => s.enUrl).length;
  const hf = settings().handsFree;
  const speakOk = withEnglish > 0;
  const mode = hf.mode === 'speak' && !speakOk ? 'understand' : hf.mode;

  render({
    title: 'Hands-free', back: '#/',
    body: `
      <p>Sentences you've studied, read out with a pause to answer in your head. It plays as one track, so you can lock the phone and use the headphone controls.</p>
      <form id="hf" class="settings" onsubmit="return false">
        <div class="field"><span>Mode</span>${seg('mode', mode, [['understand', 'Polish first'], ['speak', 'English first']])}</div>
        <p class="muted small" id="mode-note"></p>
        <div class="field"><span>Length</span>${seg('minutes', hf.minutes, [[10, '10 min'], [20, '20'], [30, '30']])}</div>
        <div class="field"><span>Pause</span>${seg('pause', hf.pause, [[3, '3 s'], [4, '4'], [6, '6']])}</div>
      </form>
      <p class="muted small">${pool.length} sentences available${pool.length ? `, ${withEnglish} with recorded English` : ''}.
        ${pool.length < 15 ? 'Study more vocabulary or conversations to add more.' : ''}</p>
      ${speakOk ? '' : `<p class="muted small">English recordings aren't on this phone yet, so <em>Polish first</em> shows the English on screen instead of saying it, and <em>English first</em> isn't available.</p>`}`,
    actions: pool.length
      ? `<button class="btn primary" data-action="start">Start</button>`
      : `<button class="btn primary" disabled>Nothing to play yet</button>`,
  });

  const form = document.getElementById('hf');
  const note = () => {
    const m = form.mode.value;
    document.getElementById('mode-note').textContent = m === 'speak'
      ? 'English, a pause to say it in Polish, then the Polish twice.'
      : `Polish, a pause to work out the meaning, the Polish again${withEnglish ? ', then the English' : ''}.`;
  };
  if (!speakOk) form.querySelector('input[value="speak"]').disabled = true;
  note();
  form.addEventListener('change', async () => {
    note();
    await setSetting('handsFree', { mode: form.mode.value, minutes: Number(form.minutes.value), pause: Number(form.pause.value) });
  });

  onAction({
    start: async (btn) => {
      tts.unlock();
      btn.disabled = true;
      btn.textContent = 'Preparing…';
      const choice = { mode: form.mode.value, minutes: Number(form.minutes.value), pause: Number(form.pause.value) };
      try {
        await buildAndPlay(pool, choice);
      } catch (e) {
        btn.disabled = false;
        btn.textContent = 'Start';
        alert(`Couldn't prepare the audio: ${e.message}`);
      }
    },
  });
}

async function fetchFrames(url, cache) {
  if (!cache.has(url)) {
    cache.set(url, fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => (b ? audioFrames(b) : null)).catch(() => null));
  }
  return cache.get(url);
}

async function buildAndPlay(pool, { mode, minutes, pause }) {
  const target = minutes * 60;
  const parts = [];
  const marks = []; // { start, s } per sentence, in seconds
  const cache = new Map();
  const gaps = new Map();
  let t = 0;
  const lead = silence(0.5);
  parts.push(lead.bytes);
  t += lead.seconds;
  const usable = pool.filter((s) => mode !== 'speak' || s.enUrl);
  // Go through the sentences in random order, again if needed, until the time is filled.
  for (let round = 0; t < target && round < 20; round++) {
    for (const s of shuffled(usable)) {
      if (t >= target) break;
      const steps = stepsFor({ pl: s.plUrl, en: s.enUrl }, mode, pause);
      if (!steps) continue;
      const chunk = [];
      let dt = 0;
      let ok = true;
      for (const step of steps) {
        if (step.gap) {
          if (!gaps.has(step.gap)) gaps.set(step.gap, silence(step.gap));
          chunk.push(gaps.get(step.gap).bytes); dt += gaps.get(step.gap).seconds;
        } else {
          const f = await fetchFrames(step.clip, cache);
          if (!f) { ok = false; break; }
          chunk.push(f.bytes); dt += f.seconds;
        }
      }
      if (!ok) continue;
      marks.push({ start: t, s });
      parts.push(...chunk);
      t += dt;
    }
    if (!marks.length) throw new Error('none of the recordings could be loaded (are you offline before they were downloaded?)');
  }
  const blob = new Blob(parts, { type: 'audio/mpeg' });
  showPlayer(blob, marks, t, mode);
}

function showPlayer(blob, marks, total, mode) {
  stopPlayer();
  const audio = new Audio();
  audio.setAttribute('playsinline', '');
  const url = URL.createObjectURL(blob);
  audio.src = url;
  player = { audio, url };
  const route = location.hash;

  render({
    title: 'Hands-free', back: '#/listen',
    body: `
      <div class="card study hf-player">
        <p class="muted small" id="hf-count"></p>
        <p class="sentence pl" lang="pl" id="hf-pl"></p>
        <p class="answer" id="hf-en"></p>
        <div class="hf-progress progress"><span id="hf-bar" style="width:0%"></span></div>
        <p class="muted small" id="hf-time"></p>
      </div>
      <p class="muted small center">Lock the phone if you like: it keeps playing. Headphone and lock-screen controls pause and skip.</p>`,
    actions: `<div class="row3">
      <button class="btn" data-action="prev" aria-label="Previous sentence">⏮</button>
      <button class="btn primary" data-action="toggle" id="hf-toggle">Pause</button>
      <button class="btn" data-action="next" aria-label="Next sentence">⏭</button></div>`,
  });

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const indexAt = (time) => {
    let i = 0;
    while (i + 1 < marks.length && marks[i + 1].start <= time + 0.05) i++;
    return i;
  };
  let shown = -1;
  const update = () => {
    if (location.hash !== route) return;
    const i = indexAt(audio.currentTime);
    const el = (id) => document.getElementById(id);
    el('hf-bar').style.width = `${Math.min(100, (audio.currentTime / total) * 100)}%`;
    el('hf-time').textContent = `${fmt(audio.currentTime)} / ${fmt(total)}`;
    if (i === shown) return;
    shown = i;
    const { s } = marks[i];
    el('hf-count').textContent = `Sentence ${i + 1} of ${marks.length}`;
    // Show the prompt side straight away; the answer side stays hidden until it's spoken.
    el('hf-pl').textContent = mode === 'speak' ? '' : s.pl;
    el('hf-en').textContent = mode === 'speak' ? s.en : '';
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: mode === 'speak' ? s.en : s.pl, artist: 'Polski · hands-free' });
    }
  };
  // Reveal the answer side once the pause has passed (about two-thirds through the sentence).
  const reveal = () => {
    if (shown < 0 || location.hash !== route) return;
    const start = marks[shown].start;
    const end = marks[shown + 1]?.start ?? total;
    if (audio.currentTime - start > (end - start) * 0.55) {
      const { s } = marks[shown];
      document.getElementById('hf-pl').textContent = s.pl;
      document.getElementById('hf-en').textContent = s.en;
    }
  };
  audio.addEventListener('timeupdate', () => { update(); reveal(); });
  const btn = () => document.getElementById('hf-toggle');
  audio.addEventListener('play', () => { if (btn()) btn().textContent = 'Pause'; });
  audio.addEventListener('pause', () => { if (btn()) btn().textContent = 'Play'; });
  audio.addEventListener('ended', () => {
    if (location.hash !== route) return;
    document.getElementById('hf-count').textContent = 'Finished';
    btn().textContent = 'Play again';
  });

  const seekTo = (i) => { audio.currentTime = marks[Math.max(0, Math.min(marks.length - 1, i))].start; update(); };
  const toggle = () => (audio.paused ? audio.play() : audio.pause());
  const next = () => seekTo(indexAt(audio.currentTime) + 1);
  const prev = () => {
    const i = indexAt(audio.currentTime);
    seekTo(audio.currentTime - marks[i].start > 2 ? i : i - 1);
  };
  if ('mediaSession' in navigator) {
    const ms = navigator.mediaSession;
    ms.setActionHandler('play', () => audio.play());
    ms.setActionHandler('pause', () => audio.pause());
    ms.setActionHandler('nexttrack', next);
    ms.setActionHandler('previoustrack', prev);
  }
  onAction({ toggle, next, prev });
  window.addEventListener('hashchange', stopPlayer, { once: true });
  update();
  audio.play().catch(() => { if (btn()) btn().textContent = 'Play'; });
}
