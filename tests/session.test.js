import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickToday, newTodayByModule } from '../js/session.js';
import { applyReview, Rating } from '../js/scheduler.js';

const at = (y, mo, d, h, mi = 0) => new Date(y, mo - 1, d, h, mi);
const defs = (m, prefix, n) => Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${i + 1}`, module: m, topic: 't', item: `${prefix}-${i + 1}`, kind: 'rec' }));
const byModule = () => ({ pronunciation: defs('pronunciation', 'p', 3), vocabulary: defs('vocabulary', 'v', 3), grammar: defs('grammar', 'g', 3) });

/** Run a session: answer Good to everything shown, return the ids in order. */
function run(mods, records, newPerDay, now, steps) {
  const logs = [];
  const shown = [];
  let last = null;
  for (let i = 0; i < steps; i++) {
    const t = new Date(now.getTime() + i * 1000);
    const newLeft = newPerDay - new Set(logs.filter((l) => l.state === 0).map((l) => l.cardId)).size;
    const p = pickToday(mods, records, newLeft, logs, t, new Set(last ? [last] : []));
    if (!p.def) break;
    const { record, log } = applyReview(p.def, records.get(p.def.id), Rating.Good, t);
    records.set(p.def.id, record);
    logs.push(log);
    shown.push(p.def.id);
    last = p.def.id;
  }
  return { shown, logs };
}

test('new cards are shared out across the three modules', () => {
  const { shown } = run(byModule(), new Map(), 6, at(2026, 11, 10, 8), 6);
  assert.deepEqual(shown, ['p-1', 'v-1', 'g-1', 'p-2', 'v-2', 'g-2']);
});

test('due reviews from any module come before new cards', () => {
  const mods = byModule();
  const records = new Map();
  // A grammar card reviewed days ago is now due.
  const old = applyReview(mods.grammar[2], undefined, Rating.Easy, at(2026, 11, 1, 8));
  records.set('g-3', old.record);
  const now = new Date(old.record.due + 60000);
  const { shown } = run(mods, records, 2, now, 3);
  assert.equal(shown[0], 'g-3');
  assert.deepEqual(shown.slice(1), ['p-1', 'v-1']);
});

test('a module with no new cards left is skipped', () => {
  const mods = { pronunciation: [], vocabulary: defs('vocabulary', 'v', 2), grammar: defs('grammar', 'g', 2) };
  const { shown } = run(mods, new Map(), 4, at(2026, 11, 10, 8), 4);
  assert.deepEqual(shown, ['v-1', 'g-1', 'v-2', 'g-2']);
});

test('respects the shared allowance and counts per module', () => {
  const { shown, logs } = run(byModule(), new Map(), 2, at(2026, 11, 10, 8), 10);
  assert.equal(new Set(shown).size, 2, 'only two distinct new cards (then their learning steps)');
  assert.deepEqual(newTodayByModule(logs, at(2026, 11, 10, 9)), { pronunciation: 1, vocabulary: 1, grammar: 0 });
});
