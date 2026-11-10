import { state } from '../app.js';
import { settings } from '../settings.js';
import { countCards, newRemaining, isUnlocked } from '../scheduler.js';
import { render, esc, plural, speakerIcon, onAction } from '../ui.js';
import { lessonHtml, lessonHandlers } from '../lesson.js';
import { markLessonSeen } from './study.js';

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
            : 'Coming soon'}${isNext ? ' · <strong>Up next</strong>' : ''}</span>
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
  const c = countCards(topic.cards, state.records);

  const items = topic.items.map((it) => `
    <li class="word">
      <button class="icon-btn small" data-action="say" data-text="${esc(it.pl)}" aria-label="Play ${esc(it.pl)}">${speakerIcon}</button>
      <span><span class="pl" lang="pl">${esc(it.pl)}</span> <span class="muted">${esc(it.en)}</span></span>
    </li>`).join('');

  render({
    title: topic.title,
    back: `#/module/${m}`,
    body: topic.items.length
      ? `${lessonHtml(topic.lesson)}
         <h2 class="section-title">Words in this topic</h2>
         <p class="muted small">${c.learned}/${c.total} cards learned · ${c.due} due · ${c.newAvailable} new</p>
         <ul class="words">${items}</ul>`
      : `<p class="notice">${esc(mod.status || 'This topic is coming soon.')}</p>`,
    actions: topic.cards.length && (c.due || c.newAvailable)
      ? `<a class="btn primary" href="#/study/${m}/${topic.id}">Study this topic</a>`
      : '',
  });
  onAction({ ...lessonHandlers });
  // Reading the lesson here counts: Continue won't show it again before the first new card.
  if (topic.lesson) markLessonSeen(topic.id);
}
