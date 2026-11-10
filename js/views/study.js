// Study session: picks the next card, shows a topic's lesson before its first new card,
// renders the exercise for the card's kind, and records the grade.
import { state, recordReview } from '../app.js';
import { settings, setSetting } from '../settings.js';
import { allDefs } from '../content.js';
import { pickNext, applyReview, newRemaining, countCards } from '../scheduler.js';
import { render, onAction, esc } from '../ui.js';
import { EXERCISES } from '../exercises.js';
import { lessonHtml, lessonHandlers } from '../lesson.js';
import { hideAccentBar } from '../accentbar.js';
import * as tts from '../tts.js';

function scopeDefs(scope, topicId) {
  if (scope === 'all') return allDefs(state.content);
  const mod = state.content[scope];
  if (!mod) return null;
  if (topicId) return mod.topics.find((t) => t.id === topicId)?.cards ?? null;
  return mod.defs;
}

export async function markLessonSeen(topicId) {
  const seen = settings().lessonsSeen ?? [];
  if (!seen.includes(topicId)) await setSetting('lessonsSeen', [...seen, topicId]);
}

export function studyView(scope, topicId) {
  const defs = scopeDefs(scope, topicId);
  if (!defs) { location.replace('#/'); return; }
  const back = scope === 'all' ? '#/' : topicId ? `#/topic/${scope}/${topicId}` : `#/module/${scope}`;
  const title = scope === 'all' ? 'Review' : state.content[scope].title;
  const route = location.hash;
  let lastId = null;
  let timer = null;
  const stillHere = () => location.hash === route;

  function next() {
    clearTimeout(timer);
    hideAccentBar();
    if (!stillHere()) return;
    const now = new Date();
    // "Review all due" shows only due cards; new cards come from a module's Continue.
    const newLeft = scope === 'all' ? 0 : newRemaining(settings().newPerDay, state.todayLogs, now);
    let pick = pickNext(defs, state.records, newLeft, now, new Set(lastId ? [lastId] : []));
    if (!pick.def && lastId) pick = pickNext(defs, state.records, newLeft, now);
    if (!pick.def) return finished(pick.waitUntil);

    const topic = state.content[pick.def.module].topics.find((t) => t.id === pick.def.topic);
    if (pick.isNew && topic.lesson && !(settings().lessonsSeen ?? []).includes(topic.id)) {
      return showLesson(topic);
    }
    showCard(pick.def, pick.isNew, topic);
  }

  function showLesson(topic) {
    render({
      title: topic.title, back,
      body: `<p><span class="pill new">New topic</span></p>${lessonHtml(topic.lesson)}`,
      actions: `<button class="btn primary" data-action="start">Start practising</button>`,
    });
    onAction({
      ...lessonHandlers,
      start: async () => { await markLessonSeen(topic.id); next(); },
    });
  }

  function finished(waitUntil) {
    const mins = waitUntil ? Math.ceil((waitUntil - Date.now()) / 60000) : 0;
    render({
      title, back,
      body: `<div class="card center">
        <h2>All done for now</h2>
        <p>${waitUntil
          ? `A card you are still learning comes back in about ${mins} minute${mins === 1 ? '' : 's'}.`
          : 'Nothing else is due in this section today.'}</p>
      </div>`,
      actions: `<a class="btn primary" href="${back}">Back</a>`,
    });
    if (waitUntil) timer = setTimeout(() => { if (stillHere()) next(); }, waitUntil - Date.now() + 500);
  }

  function showCard(def, isNew, topic) {
    const mod = state.content[def.module];
    const item = mod.items.get(def.item);
    const exercise = EXERCISES[def.kind];
    const shownAt = Date.now();
    const counts = countCards(defs, state.records);
    const head = `<p class="session-counts muted small">
        ${isNew ? '<span class="pill new">New</span>' : ''}
        <span>${counts.due} due</span>
        ${!topicId ? `<span class="topic-tag">${esc(topic.title)}</span>` : ''}
      </p>`;

    exercise({
      def, item, topic, head, title, back,
      done: async (rating) => {
        tts.stop();
        const now = new Date();
        const { record, log } = applyReview(def, state.records.get(def.id), rating,
          now, settings().retention, now.getTime() - shownAt);
        await recordReview(record, log);
        lastId = def.id;
        next();
      },
    });
  }

  next();
}
