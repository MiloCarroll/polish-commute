// Study session: picks the next card, shows a topic's lesson before its first new card,
// renders the exercise for the card's kind, and records the grade.
import { state, recordReview, undoLastReview } from '../app.js';
import { settings, setSetting, newAllowance, addExtraNew, EXTRA_STEP } from '../settings.js';
import { allDefs, MODULES } from '../content.js';
import { pickToday } from '../session.js';
import { pickNext, applyReview, newRemaining, countCards } from '../scheduler.js';
import { render, onAction, esc } from '../ui.js';
import { exerciseFor } from '../exercises.js';
import { lessonHtml, lessonHandlers } from '../lesson.js';
import { hideAccentBar } from '../accentbar.js';
import * as tts from '../tts.js';
import { flagButton } from '../flags.js';
import { resolveDrill, resolveLine } from '../variants.js';

function scopeDefs(scope, topicId) {
  if (scope === 'all' || scope === 'today') return allDefs(state.content);
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
  const back = scope === 'all' || scope === 'today' ? '#/' : topicId ? `#/topic/${scope}/${topicId}` : `#/module/${scope}`;
  const title = scope === 'today' ? "Today's session" : scope === 'all' ? 'Review' : state.content[scope].title;
  const byModule = () => Object.fromEntries(MODULES.map((m) => [m, state.content[m].defs]));
  const pick = (newLeft, now, skip) => (scope === 'today'
    ? pickToday(byModule(), state.records, newLeft, state.todayLogs, now, skip)
    : pickNext(defs, state.records, newLeft, now, skip));
  const route = location.hash;
  let lastId = null;
  let timer = null;
  let undo = null; // { handle, def, isNew, topic } for the last answer
  const stillHere = () => location.hash === route;

  function next() {
    clearTimeout(timer);
    hideAccentBar();
    if (!stillHere()) return;
    const now = new Date();
    // "Review all due" shows only due cards; new cards come from a module's Continue.
    const newLeft = scope === 'all' ? 0 : newRemaining(newAllowance(now), state.todayLogs, now);
    let p = pick(newLeft, now, new Set(lastId ? [lastId] : []));
    if (!p.def && lastId) p = pick(newLeft, now, new Set());
    if (!p.def) return finished(p.waitUntil);

    const topic = state.content[p.def.module].topics.find((t) => t.id === p.def.topic);
    if (p.isNew && topic.lesson && !(settings().lessonsSeen ?? []).includes(topic.id)) {
      return showLesson(topic);
    }
    showCard(p.def, p.isNew, topic);
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
    // Only the allowance is stopping new cards: offer a few more for today.
    const moreNew = scope !== 'all' && newRemaining(newAllowance(), state.todayLogs) === 0
      && countCards(scope === 'today' ? allDefs(state.content) : defs, state.records).newAvailable > 0;
    render({
      title, back,
      body: `<div class="card center">
        <h2>All done for now</h2>
        <p>${waitUntil
          ? `A card you are still learning comes back in about ${mins} minute${mins === 1 ? '' : 's'}.`
          : moreNew ? "Nothing else is due, and today's new cards are used up. You can carry on with a few more."
          : scope === 'today' ? "That's today's session done: nothing else is due and today's new cards are used up." : 'Nothing else is due in this section today.'}</p>
      </div>`,
      actions: `${undo ? '<button type="button" class="btn" data-undo>↶ Undo last answer</button>' : ''}
        ${moreNew && !waitUntil ? `<button type="button" class="btn primary" data-more-new>Learn ${EXTRA_STEP} more new cards</button>
          <a class="btn" href="${back}">Back</a>` : `<a class="btn primary" href="${back}">Back</a>`}`,
    });
    document.querySelector('[data-more-new]')?.addEventListener('click', async () => { await addExtraNew(); next(); }, { once: true });
    if (waitUntil) timer = setTimeout(() => { if (stillHere()) next(); }, waitUntil - Date.now() + 500);
  }

  function showCard(def, isNew, topic) {
    const mod = state.content[def.module];
    const item = mod.items.get(def.item);
    const exercise = exerciseFor(def);
    const shownAt = Date.now();
    const counts = countCards(defs, state.records);
    const g = { learnerGender: settings().learnerGender, partnerGender: settings().partnerGender };
    const shown = def.module === 'dialogues' ? resolveLine(item, topic.cast, g).pl
      : item.v ? resolveDrill(item, g).pl : item.pl;
    const head = `<div class="session-counts muted small">
        ${isNew ? '<span class="pill new">New</span>' : ''}
        <span>${counts.due} due</span>
        ${!topicId ? `<span class="topic-tag">${esc(topic.title)}</span>` : ''}
        ${undo ? '<button type="button" class="undo-btn" data-undo aria-label="Undo the last answer">↶ Undo</button>' : ''}
        ${flagButton(def.id, shown)}
      </div>`;

    exercise({
      def, item, topic, head, title, back,
      done: async (rating) => {
        tts.stop();
        const now = new Date();
        const { record, log } = applyReview(def, state.records.get(def.id), rating,
          now, settings().retention, now.getTime() - shownAt);
        const handle = await recordReview(record, log);
        undo = { handle, def, isNew, topic };
        lastId = def.id;
        next();
      },
    });
  }

  // Undo: put the last answer back and show that card again.
  const onUndo = async (e) => {
    if (!e.target.closest('[data-undo]') || !undo || !stillHere()) return;
    e.preventDefault();
    e.stopPropagation();
    const u = undo;
    undo = null;
    clearTimeout(timer);
    tts.stop();
    hideAccentBar();
    await undoLastReview(u.handle);
    lastId = null;
    showCard(u.def, u.isNew, u.topic);
  };
  document.addEventListener('click', onUndo, true);
  window.addEventListener('hashchange', () => document.removeEventListener('click', onUndo, true), { once: true });

  next();
}
