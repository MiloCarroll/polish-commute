// Renders a topic's lesson: paragraphs with tap-to-hear Polish words ({{word}}),
// a table of letters and sounds, and a collapsed "More detail" section.
import { esc, speakerIcon } from './ui.js';
import * as tts from './tts.js';

/** Escape text and turn {{word}} into a tap-to-hear button. */
export function richText(text) {
  return esc(text).replace(/\{\{(.+?)\}\}/g, (_, w) =>
    `<button class="say-word pl" lang="pl" data-action="say" data-text="${w}">${w}</button>`);
}

export function lessonHtml(lesson) {
  if (!lesson) return '';
  const letters = lesson.letters?.length ? `
    <div class="letters">
      ${lesson.letters.map((l) => `
        <div class="letter-row">
          <div class="letter pl" lang="pl">${esc(l.spelling)}</div>
          <div class="letter-body">
            <p>${richText(l.sound)}</p>
            ${l.examples?.length ? `<p class="examples">${l.examples.map((w) =>
              `<button class="chip pl" lang="pl" data-action="say" data-text="${esc(w)}">${speakerIcon}<span>${esc(w)}</span></button>`).join('')}</p>` : ''}
          </div>
        </div>`).join('')}
    </div>` : '';
  const t = lesson.table;
  const table = t?.rows?.length ? `
    <div class="table-wrap"><table class="lesson-table">
      ${t.caption ? `<caption>${richText(t.caption)}</caption>` : ''}
      ${t.head ? `<thead><tr>${t.head.map((h) => `<th>${richText(h)}</th>`).join('')}</tr></thead>` : ''}
      <tbody>${t.rows.map((r) => `<tr>${r.map((c) => `<td>${richText(c)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>` : '';
  return `
    <section class="lesson">
      ${lesson.summary ? `<p class="lead">${richText(lesson.summary)}</p>` : ''}
      ${(lesson.body ?? []).map((p) => `<p>${richText(p)}</p>`).join('')}
      ${letters}
      ${table}
      ${lesson.more?.length ? `<details class="more"><summary>More detail</summary>
        ${lesson.more.map((p) => `<p>${richText(p)}</p>`).join('')}</details>` : ''}
    </section>`;
}

export const lessonHandlers = { say: (el) => tts.speak(el.dataset.text) };
