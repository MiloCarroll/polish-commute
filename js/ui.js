// Small DOM helpers shared by the views.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const viewEl = () => document.getElementById('view');
const actionsEl = () => document.getElementById('actions');

/**
 * Render a screen. `body` is the scrolling content, `actions` the thumb-zone button bar
 * at the bottom (empty string hides it). `title` sets the header; `back` shows a back link.
 */
export function render({ title = 'Polski', back = null, body = '', actions = '' }) {
  document.getElementById('title').textContent = title;
  const backEl = document.getElementById('back');
  backEl.hidden = !back;
  if (back) backEl.setAttribute('href', back);
  viewEl().innerHTML = body;
  actionsEl().innerHTML = actions;
  actionsEl().hidden = !actions;
  viewEl().scrollTop = 0;
  window.scrollTo(0, 0);
}

/** Delegate clicks on [data-action] inside the view and action bar. */
export function onAction(handlers) {
  const handler = (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || !handlers[el.dataset.action]) return;
    e.preventDefault();
    handlers[el.dataset.action](el, e);
  };
  viewEl().onclick = handler;
  actionsEl().onclick = handler;
}

export const speakerIcon = `<svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>`;

export function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
