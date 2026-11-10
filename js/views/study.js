// Study session: picks the next card, shows it, records the grade.
// Stage 1 supports vocabulary recognition (self-graded). Later stages add more card kinds.
import { state, recordReview } from '../app.js';
import { settings } from '../settings.js';
import { allDefs } from '../content.js';
import { pickNext, applyReview, previewIntervals, newRemaining, countCards, Rating } from '../scheduler.js';
import { render, esc, speakerIcon, onAction, $ } from '../ui.js';
import * as tts from '../tts.js';

const GRADES = [
  [Rating.Again, 'Again', 'again'],
  [Rating.Hard, 'Hard', 'hard'],
  [Rating.Good, 'Good', 'good'],
  [Rating.Easy, 'Easy', 'easy'],
];

function scopeDefs(scope, topicId) {
  if (scope === 'all') return allDefs(state.content);
  const mod = state.content[scope];
  if (!mod) return null;
  if (topicId) return mod.topics.find((t) => t.id === topicId)?.cards ?? null;
  return mod.defs;
}

export function studyView(scope, topicId) {
  const defs = scopeDefs(scope, topicId);
  if (!defs) { location.replace('#/'); return; }
  const back = scope === 'all' ? '#/' : topicId ? `#/topic/${scope}/${topicId}` : `#/module/${scope}`;
  const title = scope === 'all' ? 'Review' : state.content[scope].title;
  let lastId = null;
  let timer = null;

  function next() {
    clearTimeout(timer);
    const now = new Date();
    // "Review all due" shows only due cards; new cards come from a module's Continue.
    const newLeft = scope === 'all' ? 0 : newRemaining(settings().newPerDay, state.todayLogs, now);
    let pick = pickNext(defs, state.records, newLeft, now, new Set(lastId ? [lastId] : []));
    if (!pick.def && lastId) pick = pickNext(defs, state.records, newLeft, now);
    if (!pick.def) return finished(pick.waitUntil);
    showCard(pick.def, pick.isNew);
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
    if (waitUntil) timer = setTimeout(() => { if (location.hash.startsWith('#/study/')) next(); }, waitUntil - Date.now() + 500);
  }

  function showCard(def, isNew) {
    const mod = state.content[def.module];
    const item = mod.items.get(def.item);
    const shownAt = Date.now();
    const counts = countCards(defs, state.records);
    const ex = item.examples?.[0];
    let busy = false;

    render({
      title, back,
      body: `
        <p class="session-counts muted small">
          ${isNew ? '<span class="pill new">New</span>' : ''}
          <span>${counts.due} due</span>
        </p>
        <div class="card study">
          <p class="prompt pl" lang="pl">${esc(item.pl)}</p>
          <div class="audio-row">
            <button class="icon-btn" data-action="play" aria-label="Play">${speakerIcon}</button>
            <button class="text-btn" data-action="slow">Slow</button>
          </div>
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

    const say = (slow = false) => tts.speak(item.pl, { slow });
    if (settings().autoplay) tts.autoSpeak(item.pl);

    onAction({
      play: () => say(),
      slow: () => say(true),
      say: (el) => tts.speak(el.dataset.text),
      reveal: () => {
        $('#answer').hidden = false;
        const iv = previewIntervals(state.records.get(def.id), new Date(), settings().retention);
        document.getElementById('actions').innerHTML = `<div class="grades">${GRADES.map(([r, label, cls]) =>
          `<button class="btn grade ${cls}" data-action="grade" data-rating="${r}">
             <span>${label}</span><span class="small">${iv[r]}</span></button>`).join('')}</div>`;
        if (settings().autoplay && ex) tts.autoSpeak(ex.pl);
      },
      grade: async (el) => {
        if (busy) return; // ignore double taps
        busy = true;
        const now = new Date();
        const { record, log } = applyReview(def, state.records.get(def.id), Number(el.dataset.rating),
          now, settings().retention, now.getTime() - shownAt);
        await recordReview(record, log);
        lastId = def.id;
        next();
      },
    });
  }

  next();
}
