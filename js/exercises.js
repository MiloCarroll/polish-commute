// Exercise renderers. Each takes a context and calls ctx.done(rating) when the card is finished.
//   ctx = { def, item, topic, head, title, back, done(rating) }
// `head` is the small counts line shown above every card.
// Lookup: EXERCISES[`${module}/${kind}`] first, then EXERCISES[kind].
import { Rating, previewIntervals } from './scheduler.js';
import { grade, diffExpected, normalise, MESSAGES } from './grading.js';
import { render, esc, speakerIcon, onAction, $ } from './ui.js';
import { attachAccentBar, hideAccentBar } from './accentbar.js';
import { resolveExample, resolveDrill, gapExample, splitGap } from './variants.js';
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

const noVoiceNote = (text) => (tts.canSpeak(text ?? '') ? '' :
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

const genders = () => ({ learnerGender: settings().learnerGender, partnerGender: settings().partnerGender });

/**
 * Gender of whoever says a gender-dependent sentence (for choosing a matching recorded
 * voice): the learner's or the partner's. Null for sentences that don't depend on gender.
 */
function speakerGender(original) {
  if (!original?.v) return null;
  const g = genders();
  return original.speaker === 'partner' ? g.partnerGender : g.learnerGender;
}

/** Play the text on a tap-to-hear button, in the speaker's voice when it carries one. */
const sayEl = (el) => tts.speak(el.dataset.text, { gender: el.dataset.gender || null });

// ---- Vocabulary item details (shown on reveal / after answering) ------------

const GENDER_NAMES = { m: 'masculine', f: 'feminine', n: 'neuter', mpl: 'plural (masculine-personal)', npl: 'plural' };
const PERSONS = [['ja', 'I'], ['ty', 'you'], ['on', 'he/she/it'], ['my', 'we'], ['wy', 'you all'], ['oni', 'they']];

function registerPill(item) {
  if (item.register === 'formal') return '<span class="pill reg">formal</span>';
  if (item.register === 'colloquial') return '<span class="pill reg">colloquial</span>';
  return '';
}

export function metaLine(item) {
  const bits = [];
  if (item.pos === 'noun' && item.gender) bits.push(`${GENDER_NAMES[item.gender] ?? item.gender} noun`);
  else if (item.pos) bits.push(item.pos);
  if (item.pos === 'verb' && item.aspect) {
    const a = item.aspect === 'pf' ? 'perfective' : 'imperfective';
    bits.push(item.aspectPair ? `${a}; pair: <span class="pl" lang="pl">${esc(item.aspectPair)}</span>` : a);
  }
  return `<p class="meta muted small">${bits.join(' · ')} ${registerPill(item)}</p>`;
}

function exampleHtml(ex, highlight, gender = null) {
  let pl = esc(ex.pl);
  if (highlight && ex.gap) {
    const parts = splitGap(ex.pl, ex.gap);
    if (parts) pl = `${esc(parts.before)}<strong>${esc(ex.gap)}</strong>${esc(parts.after)}`;
  }
  return `<div class="example">
    <button class="icon-btn small" data-action="say" data-text="${esc(ex.pl)}" ${gender ? `data-gender="${gender}"` : ''} aria-label="Play example">${speakerIcon}</button>
    <div><p class="pl" lang="pl">${pl}</p><p class="muted">${esc(ex.en)}${ex.speaker === 'partner' ? ' <span class="small">(your partner says)</span>' : ''}</p></div>
  </div>`;
}

function formsTable(item) {
  if (!item.forms) return '';
  return `<details class="forms"><summary>Present tense</summary>
    <table>${PERSONS.map(([p, en]) => `<tr><td class="muted">${p} <span class="small">(${en})</span></td>
      <td class="pl" lang="pl"><button class="say-word" data-action="say" data-text="${esc(item.forms[p])}">${esc(item.forms[p])}</button></td></tr>`).join('')}</table>
  </details>`;
}

/** Full details: word, meaning, meta, note, forms, examples (resolved for gender settings). */
export function itemDetails(item, { showWord = true } = {}) {
  const exs = (item.examples ?? []).map((e) => ({ r: resolveExample(e, genders()), g: speakerGender(e) }));
  return `
    ${showWord ? `<p class="answer-word pl" lang="pl">${esc(item.pl)}
      <button class="icon-btn small inline" data-action="say" data-text="${esc(item.pl)}" aria-label="Play word">${speakerIcon}</button></p>` : ''}
    <p class="answer">${esc(item.en)}</p>
    ${metaLine(item)}
    ${item.note ? `<p class="note">${esc(item.note)}</p>` : ''}
    ${formsTable(item)}
    ${exs.map(({ r, g }) => exampleHtml(r, true, g)).join('')}`;
}

// ---- Shared typed-answer flow ---------------------------------------------

/**
 * Renders a card with a text input and the accent bar, grades with the brief's table,
 * then shows the outcome.
 *   body:      HTML above the input
 *   answers:   accepted answers (first is the main one)
 *   homophones: accept same-sounding spellings as Hard (dictation)
 *   afterHtml(g): extra HTML shown after grading
 *   speak:     text to speak after grading, or a function (g) → text, or one that plays it
 */
function typedCard(ctx, { body, answers, homophones = false, afterHtml = () => '', speak, autoplayText, handlers = {} }) {
  let attempt = 1;
  render({
    title: ctx.title, back: ctx.back,
    body: `${ctx.head}
      <div class="card study">
        ${body}
        <form id="typed-form" class="answer-form" autocomplete="off">
          <input id="typed-input" class="answer-input" type="text" lang="pl" enterkeyhint="go"
            autocorrect="off" autocapitalize="off" spellcheck="false" autocomplete="off"
            aria-label="Your answer">
        </form>
        <div id="feedback" hidden></div>
      </div>`,
    actions: `<button class="btn primary" data-action="check">Check</button>`,
  });
  if (autoplayText && settings().autoplay) tts.autoSpeak(autoplayText);

  const input = $('#typed-input');
  const detach = attachAccentBar(input, () => check());
  $('#typed-form').addEventListener('submit', (e) => { e.preventDefault(); check(); });

  function check() {
    if (input.disabled) return;
    if (!input.value.trim()) { input.focus(); return; }
    const g = grade(input.value, answers, { homophones, attempt });
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
    const shown = correct ? esc(g.expected)
      : diffExpected(input.value, g.expected).map((s) => (s.type === 'diff' ? `<mark>${esc(s.text)}</mark>` : esc(s.text))).join('');
    fb.innerHTML = `
      <p class="verdict ${correct ? 'ok' : g.result === 'wrong' ? 'bad' : 'warn'}">${MESSAGES[g.result]}</p>
      <p class="answer-word pl" lang="pl">${shown}</p>
      ${g.result === 'homophone' ? `<p class="small muted">Both spellings sound the same; this word is written with the letters highlighted.</p>` : ''}
      ${afterHtml(g)}`;
    document.getElementById('actions').innerHTML = outcomeActions(g.rating, correct);
    if (speak) {
      // `speak` is text to say, or a function returning text (or playing it itself).
      const t = typeof speak === 'function' ? speak(g) : speak;
      if (typeof t === 'string') tts.speak(t);
    }
    fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    onAction({
      ...handlers,
      say: sayEl,
      finish: guard((b) => ctx.done(Number(b.dataset.rating))),
    });
  }

  onAction({ ...handlers, say: sayEl, check: () => check() });
}

// ---- Vocabulary: recognition (Polish → English, self-graded) --------------

function rec(ctx) {
  const { item } = ctx;
  const ex = resolveExample(item.examples?.[0], genders());
  const exG = speakerGender(item.examples?.[0]);
  render({
    title: ctx.title, back: ctx.back,
    body: `${ctx.head}
      <div class="card study">
        <p class="prompt pl" lang="pl">${esc(item.pl)}</p>
        ${registerPill(item)}
        ${audioRow()}
        <div id="answer" hidden class="details">${itemDetails(item, { showWord: false })}</div>
      </div>`,
    actions: `<button class="btn primary" data-action="reveal">Show answer</button>`,
  });
  if (settings().autoplay) tts.autoSpeak(item.pl);
  onAction({
    play: () => tts.speak(item.pl),
    slow: () => tts.speak(item.pl, { slow: true }),
    say: sayEl,
    reveal: () => {
      $('#answer').hidden = false;
      document.getElementById('actions').innerHTML = gradeButtons(ctx);
      if (settings().autoplay && ex) tts.autoSpeak(ex.pl, { gender: exG });
    },
    grade: guard((el) => ctx.done(Number(el.dataset.rating))),
  });
}

// ---- Vocabulary: production (English → Polish, typed) ----------------------

function prod(ctx) {
  const { item } = ctx;
  typedCard(ctx, {
    body: `
      <p class="question">How do you say…</p>
      <p class="prompt">${esc(item.en)}</p>
      <p class="muted small">${esc(item.pos ?? '')}${item.prodHint ? ` · ${esc(item.prodHint)}` : ''} ${registerPill(item)}</p>`,
    answers: [item.pl, ...(item.alts ?? [])],
    speak: (g) => g.expected,
    afterHtml: () => `<div class="details">${itemDetails(item, { showWord: false })}</div>`,
  });
}

// ---- Vocabulary: sentence gap (typed) -------------------------------------

function gap(ctx) {
  const { item } = ctx;
  const ex = gapExample(item, genders());
  if (!ex) return rec(ctx); // content guarantees a gap; fall back gracefully
  const exG = speakerGender((item.examples ?? []).find((e) => (e.v ? e.v.mf?.gap : e.gap)));
  const parts = splitGap(ex.pl, ex.gap);
  const hint = normalise(ex.gap) !== normalise(item.pl) ? ` <span class="muted">(${esc(item.pl)})</span>` : '';
  typedCard(ctx, {
    body: `
      <p class="question">Fill the gap${hint}</p>
      <p class="sentence pl" lang="pl">${esc(parts.before)}<span class="blank">&nbsp;?&nbsp;</span>${esc(parts.after)}</p>
      <p class="muted">${esc(ex.en)}${ex.speaker === 'partner' ? ' <span class="small">(your partner says)</span>' : ''}</p>`,
    answers: [ex.gap, ...(ex.gapAlts ?? [])],
    speak: () => tts.speak(ex.pl, { gender: exG }),
    afterHtml: () => `
      <p class="pl" lang="pl">${esc(parts.before)}<strong>${esc(ex.gap)}</strong>${esc(parts.after)}</p>
      <details class="more"><summary>About ${esc(item.pl)}</summary>${itemDetails(item)}</details>`,
  });
}

// ---- Vocabulary: listening (hear a sentence, then self-grade) --------------

function vlisten(ctx) {
  const { item } = ctx;
  const ex = resolveExample(item.examples?.[0], genders()) ?? { pl: item.pl, en: item.en };
  // A random recorded voice (of the speaker's gender, if the sentence has one) trains the ear.
  const voice = { gender: speakerGender(item.examples?.[0]), variety: true };
  render({
    title: ctx.title, back: ctx.back,
    body: `${ctx.head}
      <div class="card study">
        <p class="question">Listen. What does it mean?</p>
        ${audioRow()}
        ${noVoiceNote(item.pl)}
        <div id="answer" hidden class="details">
          <p class="sentence pl" lang="pl">${esc(ex.pl)}</p>
          <p class="answer">${esc(ex.en)}</p>
          <details class="more"><summary>About ${esc(item.pl)}</summary>${itemDetails(item)}</details>
        </div>
      </div>`,
    actions: `<button class="btn primary" data-action="reveal">Show text</button>`,
  });
  if (settings().autoplay) tts.autoSpeak(ex.pl, voice);
  onAction({
    play: () => tts.speak(ex.pl, voice),
    slow: () => tts.speak(ex.pl, { ...voice, slow: true }),
    say: sayEl,
    reveal: () => {
      $('#answer').hidden = false;
      document.getElementById('actions').innerHTML = gradeButtons(ctx);
    },
    grade: guard((el) => ctx.done(Number(el.dataset.rating))),
  });
}

// ---- Pronunciation: listen and choose --------------------------------------

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
        ${noVoiceNote(item.pl)}
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

// ---- Pronunciation: dictation ---------------------------------------------

function dict(ctx) {
  const { item } = ctx;
  typedCard(ctx, {
    body: `
      <p class="question">Type what you hear</p>
      ${audioRow()}
      ${noVoiceNote(item.pl)}
      <p class="muted hint">Meaning: ${esc(item.en)}</p>`,
    answers: [item.pl, ...(item.alts ?? [])],
    homophones: true,
    autoplayText: item.pl,
    speak: (g) => g.expected,
    afterHtml: (g) => (g.result === 'wrong' ? `<p class="small">${lessonLink(ctx)}</p>` : ''),
    handlers: {
      play: () => tts.speak(item.pl),
      slow: () => tts.speak(item.pl, { slow: true }),
    },
  });
}

// ---- Pronunciation: stress spotting ---------------------------------------

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

// ---- Grammar drills ---------------------------------------------------------

/** Shared prompt: sentence with a blank, base-form hint and translation. */
function drillPrompt(d, ctx, gender = null) {
  const parts = splitGap(d.pl, d.gap);
  return {
    parts,
    html: `
      <p class="question">${esc(d.prompt ?? (d.type === 'choose' ? 'Choose the right form' : 'Fill the gap'))}</p>
      <p class="sentence pl" lang="pl">${esc(parts.before)}<span class="blank">&nbsp;?&nbsp;</span>${esc(parts.after)}${d.hint ? ` <span class="hint-word">(${esc(d.hint)})</span>` : ''}</p>
      <p class="muted">${esc(d.en)}${d.speaker === 'partner' ? ' <span class="small">(your partner says)</span>' : ''}</p>`,
    full: `<p class="sentence pl" lang="pl">${esc(parts.before)}<strong>${esc(d.gap)}</strong>${esc(parts.after)}
      <button class="icon-btn small inline" data-action="say" data-text="${esc(d.pl)}" ${gender ? `data-gender="${gender}"` : ''} aria-label="Play sentence">${speakerIcon}</button></p>`,
    why: (correct) => (correct ? '' : `<p class="reason">${esc(d.reason ?? '')}</p><p class="small">${lessonLink(ctx)}</p>`),
  };
}

function gchoose(ctx) {
  const d = resolveDrill(ctx.item, genders());
  const dG = speakerGender(ctx.item);
  const p = drillPrompt(d, ctx, dG);
  const options = shuffle(d.options);
  render({
    title: ctx.title, back: ctx.back,
    body: `${ctx.head}<div class="card study drill">${p.html}<div id="feedback" hidden></div></div>`,
    actions: `<div class="options">${options.map((o) =>
      `<button class="btn option pl" lang="pl" data-action="choose" data-value="${esc(o)}">${esc(o)}</button>`).join('')}</div>`,
  });
  onAction({
    choose: guard((el) => {
      const correct = el.dataset.value === d.gap;
      const fb = $('#feedback');
      fb.hidden = false;
      fb.innerHTML = `
        <p class="verdict ${correct ? 'ok' : 'bad'}">${correct ? 'Correct' : 'Not quite'}</p>
        ${p.full}
        ${!correct ? `<p class="small">You chose <span class="pl" lang="pl">${esc(el.dataset.value)}</span>.</p>` : ''}
        ${p.why(correct)}`;
      document.getElementById('actions').innerHTML = outcomeActions(correct ? Rating.Good : Rating.Again, correct);
      tts.speak(d.pl, { gender: dG });
      onAction({
        say: sayEl,
        finish: guard((b) => ctx.done(Number(b.dataset.rating))),
      });
    }),
  });
}

function gtype(ctx) {
  const d = resolveDrill(ctx.item, genders());
  const dG = speakerGender(ctx.item);
  const p = drillPrompt(d, ctx, dG);
  typedCard(ctx, {
    body: p.html,
    answers: [d.gap, ...(d.alts ?? [])],
    speak: () => tts.speak(d.pl, { gender: dG }),
    afterHtml: (g) => `${p.full}${p.why(g.result === 'correct')}`,
  });
}

export const EXERCISES = {
  'grammar/choose': gchoose,
  'grammar/type': gtype,
  'vocabulary/rec': rec,
  'vocabulary/prod': prod,
  'vocabulary/gap': gap,
  'vocabulary/listen': vlisten,
  'pronunciation/listen': listen,
  'pronunciation/dict': dict,
  'pronunciation/stress': stress,
};

export function exerciseFor(def) {
  return EXERCISES[`${def.module}/${def.kind}`] ?? EXERCISES[`vocabulary/${def.kind}`];
}
