// My phrases: list, add, edit and delete the owner's own cards.
import { state, reloadOwnPhrases } from '../app.js';
import * as db from '../db.js';
import { newOwnId, cleanPhrase, OWN_TOPIC } from '../own.js';
import { countCards } from '../scheduler.js';
import { render, esc, onAction, speakerIcon, $ } from '../ui.js';
import { attachAccentBar, hideAccentBar } from '../accentbar.js';
import * as tts from '../tts.js';

export function ownTopicView(topic) {
  const c = countCards(topic.cards, state.records);
  const list = state.own.slice().sort((a, b) => a.created - b.created).map((p) => `
    <li class="word own">
      <button class="icon-btn small" data-action="say" data-text="${esc(p.pl)}" aria-label="Play ${esc(p.pl)}">${speakerIcon}</button>
      <span class="own-text"><span class="pl" lang="pl">${esc(p.pl)}</span> <span class="muted">${esc(p.en)}</span>
        ${p.note ? `<br><span class="small muted">${esc(p.note)}</span>` : ''}</span>
      <a class="text-btn" href="#/phrase/${esc(p.id)}">Edit</a>
    </li>`).join('');
  render({
    title: topic.title,
    back: '#/module/vocabulary',
    body: `
      <p class="muted">Your own words and phrases. Each one gets a Polish → English card, and an English → Polish card once you've got the first one right.</p>
      ${state.own.length
        ? `<p class="muted small">${c.learned}/${c.total} cards learned · ${c.due} due · ${c.newAvailable} new</p><ul class="words">${list}</ul>`
        : '<p class="notice">No phrases yet. Add one you heard, or one you want to say.</p>'}`,
    actions: `<div class="row2">
      <a class="btn" href="#/phrase/new">Add phrase</a>
      ${topic.cards.length && (c.due || c.newAvailable)
        ? `<a class="btn primary" href="#/study/vocabulary/${OWN_TOPIC}">Study</a>`
        : `<button class="btn primary" disabled>Study</button>`}
    </div>`,
  });
  onAction({ say: (el) => tts.speak(el.dataset.text) });
}

export function phraseFormView(id) {
  const existing = id === 'new' ? null : state.own.find((p) => p.id === id);
  if (id !== 'new' && !existing) { location.replace(`#/topic/vocabulary/${OWN_TOPIC}`); return; }
  const back = `#/topic/vocabulary/${OWN_TOPIC}`;
  render({
    title: existing ? 'Edit phrase' : 'Add phrase',
    back,
    body: `
      <form id="phrase-form" class="settings phrase-form" autocomplete="off">
        <label class="stack"><span>Polish</span>
          <input name="pl" id="pl-input" class="answer-input left" lang="pl" required
            autocorrect="off" autocapitalize="off" spellcheck="false" autocomplete="off" value="${esc(existing?.pl ?? '')}">
        </label>
        <button type="button" class="text-btn" data-action="hear">${speakerIcon} Hear it</button>
        <label class="stack"><span>English</span>
          <input name="en" class="answer-input left" required autocomplete="off" value="${esc(existing?.en ?? '')}">
        </label>
        <label class="stack"><span>Note <span class="muted small">(optional)</span></span>
          <textarea name="note" rows="2" class="answer-input left">${esc(existing?.note ?? '')}</textarea>
        </label>
        <p id="form-error" class="warn" hidden></p>
        ${existing ? `<button type="button" class="btn danger" data-action="delete">Delete phrase</button>
          <p class="muted small">Deleting removes its cards and their progress.</p>` : ''}
      </form>`,
    actions: `<button class="btn primary" data-action="save">${existing ? 'Save changes' : 'Add phrase'}</button>`,
  });

  const form = $('#phrase-form');
  const plInput = $('#pl-input');
  attachAccentBar(plInput, () => save());
  form.addEventListener('submit', (e) => { e.preventDefault(); save(); });

  async function save() {
    let clean;
    try {
      clean = cleanPhrase({ pl: form.pl.value, en: form.en.value, note: form.note.value });
    } catch (e) {
      const el = $('#form-error'); el.hidden = false; el.textContent = e.message; return;
    }
    hideAccentBar();
    const phrase = existing
      ? { ...existing, ...clean, updated: Date.now() }
      : { id: newOwnId(), ...clean, created: Date.now() };
    await db.put('own', phrase);
    await reloadOwnPhrases();
    location.hash = back;
  }

  onAction({
    hear: () => { if (plInput.value.trim()) tts.speak(plInput.value.trim()); },
    save: () => save(),
    delete: async () => {
      if (!confirm(`Delete "${existing.pl}" and its progress?`)) return;
      await db.del('own', existing.id);
      const ids = [`${existing.id}-rec`, `${existing.id}-prod`];
      await db.deleteCards(ids);
      ids.forEach((i) => state.records.delete(i));
      await reloadOwnPhrases();
      location.hash = back;
    },
  });
}
