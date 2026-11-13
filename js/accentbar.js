// Accent bar: Polish letter buttons that sit directly above the iOS keyboard while an
// answer input has focus. Uses visualViewport to find the keyboard's top edge.
// Buttons cancel pointerdown so the input keeps focus (and the keyboard stays up).

const LETTERS = ['ą', 'ć', 'ę', 'ł', 'ń', 'ó', 'ś', 'ź', 'ż'];

let bar = null;
let target = null;
let onSubmit = null;

function ensureBar() {
  if (bar) return bar;
  bar = document.createElement('div');
  bar.className = 'accent-bar';
  bar.hidden = true;
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Polish letters');
  bar.innerHTML = LETTERS.map((l) => `<button type="button" data-letter="${l}" lang="pl">${l}</button>`).join('') +
    `<button type="button" class="accent-check" data-check aria-label="Check">✓</button>`;
  // Keep focus in the input: never let a bar tap blur it.
  bar.addEventListener('pointerdown', (e) => e.preventDefault());
  bar.addEventListener('mousedown', (e) => e.preventDefault());
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !target) return;
    if (b.dataset.check !== undefined) { onSubmit?.(); return; }
    insert(target, b.dataset.letter);
  });
  document.body.appendChild(bar);
  window.visualViewport?.addEventListener('resize', position);
  window.visualViewport?.addEventListener('scroll', position);
  window.addEventListener('scroll', position, { passive: true });
  return bar;
}

function insert(input, text) {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  input.setRangeText(text, start, end, 'end');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus();
}

function position() {
  if (!bar || bar.hidden) return;
  const vv = window.visualViewport;
  if (!vv) return; // CSS keeps it at the bottom
  // Pin the bar's top to the bottom edge of the visible area (the keyboard's top edge on
  // iOS). Measuring from the top stays right when iOS scrolls the page to reveal the
  // input, which a bottom-anchored offset did not.
  bar.style.top = `${Math.round(vv.offsetTop + vv.height - bar.offsetHeight)}px`;
  bar.style.bottom = 'auto';
}

/** After the keyboard has settled: re-pin the bar and keep the input above it. */
function settle(input) {
  for (const ms of [50, 250, 500, 800]) {
    setTimeout(() => {
      if (target !== input || bar.hidden) return;
      position();
      const gap = input.getBoundingClientRect().bottom - bar.getBoundingClientRect().top + 8;
      if (gap > 0) window.scrollBy(0, gap);
    }, ms);
  }
}

/**
 * Attach the accent bar to an input. `submit` runs when the bar's Check button is tapped.
 * Returns a function that detaches it.
 */
export function attachAccentBar(input, submit) {
  ensureBar();
  const show = () => { target = input; onSubmit = submit; bar.hidden = false; document.body.classList.add('typing'); position(); settle(input); };
  const hide = () => {
    // Delay so a tap that moves focus elsewhere doesn't flicker the bar.
    setTimeout(() => {
      if (document.activeElement !== input) { bar.hidden = true; document.body.classList.remove('typing'); reset(); }
    }, 100);
  };
  input.addEventListener('focus', show);
  input.addEventListener('blur', hide);
  if (document.activeElement === input) show();
  return () => {
    input.removeEventListener('focus', show);
    input.removeEventListener('blur', hide);
    if (target === input) { bar.hidden = true; target = null; document.body.classList.remove('typing'); reset(); }
  };
}

function reset() {
  if (bar) { bar.style.top = ''; bar.style.bottom = ''; }
}

export function hideAccentBar() {
  if (bar) { bar.hidden = true; reset(); }
  target = null;
  document.body.classList.remove('typing');
}
