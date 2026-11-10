import { state } from '../app.js';
import { settings } from '../settings.js';
import { countCards, newRemaining, isUnlocked } from '../scheduler.js';
import { render, esc, plural, speakerIcon, onAction } from '../ui.js';
import { lessonHtml, lessonHandlers } from '../lesson.js';
import { markLessonSeen } from './study.js';
import { OWN_TOPIC } from '../own.js';
import { ownTopicView } from './phrases.js';
import { resolveLine, roleLabel } from '../variants.js';
import * as tts from '../tts.js';

/** First topic (in suggested order) that still has unstudied cards. */
export function nextSuggestedTopic(mod, records) {
  return mod.topics.find((t) => t.cards.some((d) => !records.has(d.id) && isUnlocked(d, records))) ?? null;
}

export function moduleView(m) {
  const mod = state.content[m];
  if (!mod) { location.replace('#/'); return; }
  const { records } = state;
  const c = countCards(mod.defs, records);
  const next = nextSuggestedTopic(mod, records);
  const newLeft = newRemaining(settings().newPerDay, state.todayLogs);

  const list = mod.topics.map((t, i) => {
    const tc = countCards(t.cards, records);
    const isNext = next && t.id === next.id;
    return `
      <li><a class="topic ${isNext ? 'next' : ''}" href="#/topic/${m}/${t.id}">
        <span class="topic-num">${i + 1}</span>
        <span class="topic-body">
          <span class="topic-title">${esc(t.title)}</span>
          <span class="muted small">${t.cards.length
            ? `${tc.learned}/${tc.total} learned${tc.due ? ` · ${tc.due} due` : ''}`
            : esc(t.emptyNote ? 'Your own phrases' : 'Coming soon')}${isNext ? ' · <strong>Up next</strong>' : ''}</span>
        </span>
      </a></li>`;
  }).join('');

  const canStudy = c.due > 0 || (c.newAvailable > 0 && newLeft > 0);
  render({
    title: mod.title,
    back: '#/',
    body: `
      ${mod.status ? `<p class="notice">${esc(mod.status)}</p>` : ''}
      <p class="muted">${plural(c.due, 'review')} due · ${c.newAvailable} new available · ${newLeft} new left today</p>
      <ol class="topics">${list}</ol>`,
    actions: canStudy
      ? `<a class="btn primary" href="#/study/${m}">Continue</a>`
      : `<button class="btn primary" disabled>${c.total ? 'All done for now' : 'Nothing to study yet'}</button>`,
  });
}

export function topicView(m, topicId) {
  const mod = state.content[m];
  const topic = mod?.topics.find((t) => t.id === topicId);
  if (!topic) { location.replace(`#/module/${m}`); return; }
  if (topic.id === OWN_TOPIC) return ownTopicView(topic);
  if (m === 'dialogues' && topic.items.length) return dialogueTopicView(mod, topic);
  const c = countCards(topic.cards, state.records);

  const items = m === 'grammar' ? '' : topic.items.map((it) => `
    <li class="word">
      <button class="icon-btn small" data-action="say" data-text="${esc(it.pl)}" aria-label="Play ${esc(it.pl)}">${speakerIcon}</button>
      <span><span class="pl" lang="pl">${esc(it.pl)}</span> <span class="muted">${esc(it.en)}</span></span>
    </li>`).join('');

  render({
    title: topic.title,
    back: `#/module/${m}`,
    body: topic.items.length
      ? `${lessonHtml(topic.lesson)}
         ${m === 'grammar'
           ? `<h2 class="section-title">Drills</h2>
              <p class="muted small">${c.total} drills · ${c.learned} learned · ${c.due} due · ${c.newAvailable} new</p>`
           : `<h2 class="section-title">Words in this topic</h2>
              <p class="muted small">${c.learned}/${c.total} cards learned · ${c.due} due · ${c.newAvailable} new</p>
              <ul class="words">${items}</ul>`}`
      : `<p class="notice">${esc(topic.emptyNote || mod.status || 'This topic is coming soon.')}</p>`,
    actions: topic.cards.length && (c.due || c.newAvailable)
      ? `<a class="btn primary" href="#/study/${m}/${topic.id}">Study this topic</a>`
      : '',
  });
  onAction({ ...lessonHandlers });
  // Reading the lesson here counts: Continue won't show it again before the first new card.
  if (topic.lesson) markLessonSeen(topic.id);
}

/** A dialogue's page: scene, the whole script (playable line by line or all), study button. */
function dialogueTopicView(mod, topic) {
  const c = countCards(topic.cards, state.records);
  const g = { learnerGender: settings().learnerGender, partnerGender: settings().partnerGender };
  const lines = topic.items.map((l) => resolveLine(l, topic.cast, g));
  render({
    title: topic.title,
    back: '#/module/dialogues',
    body: `${lessonHtml(topic.lesson)}
      <h2 class="section-title">The conversation</h2>
      <button class="btn" data-action="play-all">${speakerIcon}<span>Play all</span></button>
      <ol class="script">${lines.map((l, i) => `
        <li class="${l.who === 'learner' ? 'mine' : ''}">
          <button class="icon-btn small" data-action="say-line" data-i="${i}" aria-label="Play line">${speakerIcon}</button>
          <div><span class="who small">${esc(roleLabel(l.who, topic.cast))}</span>
            <p class="pl" lang="pl">${esc(l.pl)}</p><p class="muted small">${esc(l.en)}</p></div>
        </li>`).join('')}</ol>
      <p class="muted small">${c.learned}/${c.total} cards learned · ${c.due} due · ${c.newAvailable} new</p>`,
    actions: c.due || c.newAvailable ? `<a class="btn primary" href="#/study/dialogues/${topic.id}">Study this conversation</a>` : '',
  });
  let playing = 0;
  onAction({
    ...lessonHandlers,
    'say-line': (el) => { playing++; const l = lines[Number(el.dataset.i)]; tts.speak(l.pl, { gender: l.gender }); },
    'play-all': async () => {
      const run = ++playing;
      for (const l of lines) {
        if (run !== playing || !document.querySelector('.script')) return;
        await tts.speak(l.pl, { gender: l.gender });
        await new Promise((r) => setTimeout(r, 500));
      }
    },
  });
  if (topic.lesson) markLessonSeen(topic.id);
}
