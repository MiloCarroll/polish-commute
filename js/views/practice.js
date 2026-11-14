// Practice: a round of up to 20 studied cards, marked as usual, with no effect on the
// schedule. Cards answered wrong come back once at the end of the round.
import { state } from '../app.js';
import { allDefs } from '../content.js';
import { pickRound } from '../practice.js';
import { Rating } from '../scheduler.js';
import { render, onAction, esc } from '../ui.js';
import { exerciseFor } from '../exercises.js';
import { hideAccentBar } from '../accentbar.js';
import { flagButton } from '../flags.js';
import { settings } from '../settings.js';
import { resolveDrill, resolveLine } from '../variants.js';
import * as tts from '../tts.js';

function scopeDefs(scope) {
  if (scope === 'all') return allDefs(state.content);
  return state.content[scope]?.defs ?? null;
}

export function practiceView(scope) {
  const defs = scopeDefs(scope);
  if (!defs) { location.replace('#/'); return; }
  const back = scope === 'all' ? '#/' : `#/module/${scope}`;
  const title = scope === 'all' ? 'Practice' : `Practice: ${state.content[scope].title}`;
  const route = location.hash;
  const stillHere = () => location.hash === route;

  let queue = pickRound(defs, state.records);
  const total = queue.length;
  const retried = new Set();
  let right = 0, answered = 0, retryRight = 0;

  if (!total) {
    render({
      title, back,
      body: `<div class="card center"><h2>Nothing to practise yet</h2>
        <p>Practice uses cards you've already studied that aren't due. Study a few cards first, or do your due reviews.</p></div>`,
      actions: `<a class="btn primary" href="${back}">Back</a>`,
    });
    return;
  }

  function next() {
    hideAccentBar();
    if (!stillHere()) return;
    const def = queue.shift();
    if (!def) return finished();
    const mod = state.content[def.module];
    const item = mod.items.get(def.item);
    const topic = mod.topics.find((t) => t.id === def.topic);
    const g = { learnerGender: settings().learnerGender, partnerGender: settings().partnerGender };
    const shown = def.module === 'dialogues' ? resolveLine(item, topic.cast, g).pl : item.v ? resolveDrill(item, g).pl : item.pl;
    const head = `<div class="session-counts muted small">
        <span class="pill">Practice</span>
        <span>${answered + 1} of ${total + retried.size}</span>
        <span class="topic-tag">${esc(topic.title)}</span>
        ${flagButton(def.id, shown)}
      </div>`;
    exerciseFor(def)({
      def, item, topic, head, title, back,
      done: (rating) => {
        tts.stop();
        answered++;
        const second = retried.has(def.id);
        if (rating !== Rating.Again) { if (second) retryRight++; else right++; }
        else if (!second) { retried.add(def.id); queue.push(def); }
        next();
      },
    });
  }

  function finished() {
    render({
      title, back,
      body: `<div class="card center">
        <h2>Round done</h2>
        <p><strong>${right} of ${total}</strong> right first time.</p>
        ${retried.size ? `<p>${retryRight} of the ${retried.size} you missed right on the second try.</p>` : ''}
        <p class="muted small">Practice doesn't change when cards are next due.</p>
      </div>`,
      actions: `<button class="btn primary" data-action="again">Another round</button><a class="btn" href="${back}">Back</a>`,
    });
    onAction({ again: () => practiceView(scope) });
  }

  next();
}
