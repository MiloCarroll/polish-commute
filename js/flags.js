// Flags: a small "Flag" button on every card marks content that looks wrong, with an
// optional note. Stored in IndexedDB ("flags", keyed by card ID) and listed in Settings.
import * as db from './db.js';
import { esc } from './ui.js';

let flagged = new Set();

export async function loadFlags() {
  const all = await db.getAll('flags');
  flagged = new Set(all.map((f) => f.cardId));
  return all;
}

export const isFlagged = (cardId) => flagged.has(cardId);

/** HTML for the flag button in a card's header. `text` is a snapshot of what the card shows. */
export function flagButton(cardId, text) {
  const on = flagged.has(cardId);
  return `<button type="button" class="flag-btn ${on ? 'on' : ''}" data-flag="${esc(cardId)}" data-flag-text="${esc(text)}"
    aria-label="${on ? 'Flagged: edit flag' : 'Flag this card as possibly wrong'}">⚑ ${on ? 'Flagged' : 'Flag'}</button>`;
}

function dialog() {
  let d = document.getElementById('flag-dialog');
  if (d) return d;
  d = document.createElement('dialog');
  d.id = 'flag-dialog';
  d.className = 'sheet';
  d.innerHTML = `
    <form method="dialog" class="sheet-body">
      <h2>Flag this card</h2>
      <p class="muted small">For content that looks wrong. Flags are listed in Settings so you can send them for fixing.</p>
      <p id="flag-what" class="muted small"></p>
      <label class="stack"><span>What looks wrong? <span class="muted small">(optional)</span></span>
        <textarea id="flag-note" rows="3" class="answer-input left"></textarea></label>
      <div class="row2">
        <button value="cancel" class="btn">Cancel</button>
        <button value="save" class="btn primary">Save flag</button>
      </div>
      <button value="remove" id="flag-remove" class="text-btn danger-text">Remove flag</button>
    </form>`;
  document.body.appendChild(d);
  return d;
}

async function openFlag(btn) {
  const cardId = btn.dataset.flag;
  const existing = await db.get('flags', cardId);
  const d = dialog();
  // Show only the ID: the stored text may contain the card's answer (e.g. a grammar drill).
  d.querySelector('#flag-what').textContent = `Card ${cardId}`;
  d.querySelector('#flag-note').value = existing?.note ?? '';
  d.querySelector('#flag-remove').hidden = !existing;
  d.returnValue = '';
  d.onclose = async () => {
    if (d.returnValue === 'save') {
      const note = d.querySelector('#flag-note').value.trim() || null;
      await db.put('flags', { cardId, note, text: btn.dataset.flagText, created: existing?.created ?? Date.now() });
      flagged.add(cardId);
    } else if (d.returnValue === 'remove') {
      await db.del('flags', cardId);
      flagged.delete(cardId);
    } else return;
    const on = flagged.has(cardId);
    btn.classList.toggle('on', on);
    btn.textContent = `⚑ ${on ? 'Flagged' : 'Flag'}`;
  };
  d.showModal();
}

/** One listener for every flag button, wherever it is rendered. */
export function initFlags() {
  loadFlags();
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-flag]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    openFlag(btn);
  }, true);
}

/** Plain-text list of flags, for pasting into a message to whoever fixes the content. */
export function flagsAsText(flags) {
  const lines = flags.slice().sort((a, b) => a.cardId.localeCompare(b.cardId))
    .map((f) => `${f.cardId} | ${f.text ?? ''}${f.note ? ` | ${f.note}` : ''}`);
  return `Polski flagged cards (${flags.length})\ncard id | card text | note\n${lines.join('\n')}\n`;
}
