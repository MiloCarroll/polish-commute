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
  // Distance from the bottom of the layout viewport to the bottom of the visible area
  // (i.e. the keyboard height on iOS).
  const offset = vv ? Math.max(0, window.innerHeight - (vv.height + vv.offsetTop)) : 0;
  bar.style.transform = `translateY(${-offset}px)`;
}

/**
 * Attach the accent bar to an input. `submit` runs when the bar's Check button is tapped.
 * Returns a function that detaches it.
 */
export function attachAccentBar(input, submit) {
  ensureBar();
  const show = () => { target = input; onSubmit = submit; bar.hidden = false; document.body.classList.add('typing'); position(); };
  const hide = () => {
    // Delay so a tap that moves focus elsewhere doesn't flicker the bar.
    setTimeout(() => {
      if (document.activeElement !== input) { bar.hidden = true; document.body.classList.remove('typing'); }
    }, 100);
  };
  input.addEventListener('focus', show);
  input.addEventListener('blur', hide);
  if (document.activeElement === input) show();
  return () => {
    input.removeEventListener('focus', show);
    input.removeEventListener('blur', hide);
    if (target === input) { bar.hidden = true; target = null; document.body.classList.remove('typing'); }
  };
}

export function hideAccentBar() {
  if (bar) bar.hidden = true;
  target = null;
  document.body.classList.remove('typing');
}
