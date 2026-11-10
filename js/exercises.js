// Exercise renderers. Each takes a context and calls ctx.done(rating) when the card is finished.
//   ctx = { def, item, topic, head, title, back, done(rating), retention }
// `head` is the small counts line shown above every card.
import { Rating, previewIntervals } from './scheduler.js';
import { grade, diffExpected, MESSAGES } from './grading.js';
import { render, esc, speakerIcon, onAction, $ } from './ui.js';
import { attachAccentBar, hideAccentBar } from './accentbar.js';
import { settings } from './settings.js';
import { state } from './app.js';
import * as tts from './tts.js';

const GRADES = [
  [Rating.Again, 'Again', 'again'],
  [Rating.Hard, 'Hard', 'hard'],
  [Rating.Good, 'Good', 'good'],
  [Rating.Easy, 'Easy', 'easy'],
];

const audioRow = (label = 'Play') => `
  <div class="audio-row">
    <button class="icon-btn big" data-action="play" aria-label="${label}">${speakerIcon}</button>
    <button class="text-btn" data-action="slow">Slow</button>
  </div>`;

const noVoiceNote = () => (tts.bestVoice() ? '' :
  `<p class="warn small">No Polish voice available, so this card can't play audio.</p>`);

function lessonLink(ctx) {
  return `<a class="small" href="#/topic/${ctx.def.module}/${ctx.topic.id}">Review the lesson: ${esc(ctx.topic.title)}</a>`;
}

/** Four self-grade buttons with interval previews. */
function gradeButtons(ctx) {
  const iv = previewIntervals(state.records.get(ctx.def.id), new Date(), settings().retention);
  return `<div class="grades">${GRADES.map(([r, label, cls]) =>
    `<button class="btn grade ${cls}" data-action="grade" data-rating="${r}">
       <span>${label}</span><span class="small">${iv[r]}</span></button>`).join('')}</div>`;
}

/**
 * After an objectively marked answer: show the outcome and the buttons to move on.
 * correct → [Easy] [Next]; otherwise [I was right] [Next].
 */
function outcomeActions(rating, correct) {
  return `<div class="row2">
    ${correct
      ? `<button class="btn" data-action="finish" data-rating="${Rating.Easy}">Easy</button>`
      : `<button class="btn" data-action="finish" data-rating="${Rating.Good}">I was right</button>`}
    <button class="btn primary" data-action="finish" data-rating="${rating}">Next</button>
  </div>`;
}

function guard(fn) {
  let busy = false;
  return (...args) => { if (busy) return; busy = true; fn(...args); };
}

// ---- Vocabulary recognition (self-graded) ---------------------------------

function rec(ctx) {
  const { item } = ctx;
  const ex = item.examples?.[0];
  render({
    title: ctx.title, back: ctx.back,
    body: `${ctx.head}
      <div class="card study">
        <p class="prompt pl" lang="pl">${esc(item.pl)}</p>
        ${audioRow()}
        <div id="answer" hidden>
          <p class="answer">${esc(item.en)}</p>
          ${item.note ? `<p class="note">${esc(item.note)}</p>` : ''}
          ${ex ? `<div class="example">
              <button class="icon-btn small" data-action="say" data-text="${esc(ex.pl)}" aria-label="Play example">${speakerIcon}</button>
              <div><p class="pl" lang="pl">${esc(ex.pl)}</p><p class="muted">${esc(ex.en)}</p></div>
            </div>` : ''}
        </div>
      </div>`,
    actions: `<button class="btn primary" data-action="reveal">Show answer</button>`,
  });
  if (settings().autoplay) tts.autoSpeak(item.pl);
  onAction({
    play: () => tts.speak(item.pl),
    slow: () => tts.speak(item.pl, { slow: true }),
    say: (el) => tts.speak(el.dataset.text),
    reveal: () => {
      $('#answer').hidden = false;
      document.getElementById('actions').innerHTML = gradeButtons(ctx);
      if (settings().autoplay && ex) tts.autoSpeak(ex.pl);
    },
    grade: guard((el) => ctx.done(Number(el.dataset.rating))),
  });
}

// ---- Listen and choose -----------------------------------------------------

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function listen(ctx) {
  const { item } = ctx;
  const spec = item.listen;
  const answer = spec.answer ?? item.pl;
  const options = shuffle(spec.options);
  render({
    title: ctx.title, back: ctx.back,
    body: `${ctx.head}
      <div class="card study">
        <p class="question">${esc(spec.q ?? 'Which word did you hear?')}</p>
        ${audioRow()}
        ${noVoiceNote()}
        <div id="feedback" hidden></div>
      </div>`,
    actions: `<div class="options">${options.map((o) =>
      `<button class="btn option pl" lang="pl" data-action="choose" data-value="${esc(o)}">${esc(o)}</button>`).join('')}</div>`,
  });
  if (settings().autoplay) tts.autoSpeak(item.pl);

  onAction({
    play: () => tts.speak(item.pl),
    slow: () => tts.speak(item.pl, { slow: true }),
    choose: guard((el) => {
      const correct = el.dataset.value === answer;
      const fb = $('#feedback');
      fb.hidden = false;
      fb.innerHTML = `
        <p class="verdict ${correct ? 'ok' : 'bad'}">${correct ? 'Correct' : 'Not quite'}</p>
        <p class="answer-word pl" lang="pl">${esc(item.pl)}</p>
        <p class="muted">${esc(item.en)}</p>
        ${!correct ? `<p class="small">You chose <span class="pl" lang="pl">${esc(el.dataset.value)}</span>. ${lessonLink(ctx)}</p>` : ''}`;
      document.getElementById('actions').innerHTML = outcomeActions(correct ? Rating.Good : Rating.Again, correct);
      if (!correct) tts.speak(item.pl);
      onAction({
        play: () => tts.speak(item.pl),
        slow: () => tts.speak(item.pl, { slow: true }),
        finish: guard((b) => ctx.done(Number(b.dataset.rating))),
      });
    }),
  });
}

// ---- Dictation -------------------------------------------------------------

function dict(ctx) {
  const { item } = ctx;
  const answers = [item.pl, ...(item.alts ?? [])];
  let attempt = 1;
  render({
    title: ctx.title, back: ctx.back,
    body: `${ctx.head}
      <div class="card study">
        <p class="question">Type what you hear</p>
        ${audioRow()}
        ${noVoiceNote()}
        <p class="muted hint">Meaning: ${esc(item.en)}</p>
        <form id="dict-form" class="answer-form" autocomplete="off">
          <input id="dict-input" class="answer-input" type="text" lang="pl" enterkeyhint="go"
            autocorrect="off" autocapitalize="off" spellcheck="false" autocomplete="off"
            aria-label="Your answer">
        </form>
        <div id="feedback" hidden></div>
      </div>`,
    actions: `<button class="btn primary" data-action="check">Check</button>`,
  });
  if (settings().autoplay) tts.autoSpeak(item.pl);

  const input = $('#dict-input');
  const detach = attachAccentBar(input, () => check());
  $('#dict-form').addEventListener('submit', (e) => { e.preventDefault(); check(); });

  function check() {
    if (!input.value.trim()) { input.focus(); return; }
    const g = grade(input.value, answers, { homophones: true, attempt });
    const fb = $('#feedback');
    fb.hidden = false;
    if (g.retry) {
      attempt = 2;
      fb.innerHTML = `<p class="verdict warn">${MESSAGES.typo}</p>`;
      input.focus();
      input.select();
      return;
    }
    detach();
    input.blur();
    hideAccentBar();
    input.disabled = true;
    const correct = g.result === 'correct';
    const segs = diffExpected(input.value, g.expected);
    const shown = correct ? esc(g.expected)
      : segs.map((s) => (s.type === 'diff' ? `<mark>${esc(s.text)}</mark>` : esc(s.text))).join('');
    fb.innerHTML = `
      <p class="verdict ${correct ? 'ok' : g.result === 'wrong' ? 'bad' : 'warn'}">${MESSAGES[g.result]}</p>
      <p class="answer-word pl" lang="pl">${shown}</p>
      ${g.result === 'homophone' ? `<p class="small muted">Both spellings sound the same; this word is written with the letters highlighted.</p>` : ''}
      ${g.result === 'wrong' ? `<p class="small">${lessonLink(ctx)}</p>` : ''}`;
    document.getElementById('actions').innerHTML = outcomeActions(g.rating, correct);
    tts.speak(g.expected);
    onAction({
      play: () => tts.speak(item.pl),
      slow: () => tts.speak(item.pl, { slow: true }),
      finish: guard((b) => ctx.done(Number(b.dataset.rating))),
    });
  }

  onAction({
    play: () => tts.speak(item.pl),
    slow: () => tts.speak(item.pl, { slow: true }),
    check: () => check(),
  });
}

// ---- Stress spotting -------------------------------------------------------

function stress(ctx) {
  const { item } = ctx;
  render({
    title: ctx.title, back: ctx.back,
    body: `${ctx.head}
      <div class="card study">
        <p class="question">Tap the stressed syllable</p>
        <p class="muted">${esc(item.en)}</p>
        <div id="feedback" hidden></div>
      </div>`,
    actions: `<div class="syllables">${item.syll.map((s, i) =>
      `<button class="btn syll pl" lang="pl" data-action="pick" data-i="${i}">${esc(s)}</button>`).join('')}</div>`,
  });

  onAction({
    pick: guard((el) => {
      const i = Number(el.dataset.i);
      const correct = i === item.stress;
      const word = item.syll.map((s, k) => (k === item.stress ? `<strong class="stressed">${esc(s.toUpperCase())}</strong>` : esc(s))).join('·');
      const fb = $('#feedback');
      fb.hidden = false;
      fb.innerHTML = `
        <p class="verdict ${correct ? 'ok' : 'bad'}">${correct ? 'Correct' : 'Not quite'}</p>
        <p class="answer-word pl" lang="pl">${word}</p>
        ${item.stressNote ? `<p class="note">${esc(item.stressNote)}</p>` : ''}
        ${audioRow()}
        ${!correct ? `<p class="small">${lessonLink(ctx)}</p>` : ''}`;
      document.getElementById('actions').innerHTML = outcomeActions(correct ? Rating.Good : Rating.Again, correct);
      tts.speak(item.pl);
      onAction({
        play: () => tts.speak(item.pl),
        slow: () => tts.speak(item.pl, { slow: true }),
        finish: guard((b) => ctx.done(Number(b.dataset.rating))),
      });
    }),
  });
}

export const EXERCISES = { rec, listen, dict, stress };
