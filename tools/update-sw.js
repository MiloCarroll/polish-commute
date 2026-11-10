#!/usr/bin/env node
// Rewrites ASSETS and VERSION in sw.js from the files that make up the app.
// VERSION is a hash of every asset's contents, so any change produces a new cache and
// triggers the in-app "Update available" banner. Run before every deploy:
//   node tools/update-sw.js          (write)
//   node tools/update-sw.js --check  (exit 1 if sw.js is out of date; used by tests)
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['css', 'js', 'vendor', 'content', 'icons'];
const FILES = ['index.html', 'manifest.webmanifest'];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (name.startsWith('.') || name === 'drafts') return [];
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

export function computeAssets() {
  const files = [...FILES.map((f) => join(ROOT, f)), ...DIRS.flatMap((d) => walk(join(ROOT, d)))]
    .map((p) => relative(ROOT, p).split('\\').join('/'))
    .filter((p) => !p.endsWith('.txt'))
    .sort();
  const hash = createHash('sha256');
  for (const f of files) hash.update(f).update('\0').update(readFileSync(join(ROOT, f)));
  // Also hash the worker's own logic (everything except the generated lines).
  hash.update(stripGenerated(readFileSync(join(ROOT, 'sw.js'), 'utf8')));
  return { version: hash.digest('hex').slice(0, 12), assets: ['./', ...files] };
}

function stripGenerated(src) {
  return src.replace(/^const VERSION = .*$/m, '').replace(/^const ASSETS = [\s\S]*?\];$/m, '');
}

export function renderSw(src, { version, assets }) {
  return src
    .replace(/^const VERSION = .*$/m, `const VERSION = '${version}';`)
    .replace(/^const ASSETS = [\s\S]*?\];$/m, `const ASSETS = [\n${assets.map((a) => `  '${a}',`).join('\n')}\n];`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const swPath = join(ROOT, 'sw.js');
  const src = readFileSync(swPath, 'utf8');
  const out = renderSw(src, computeAssets());
  if (process.argv.includes('--check')) {
    if (out !== src) { console.error('sw.js is out of date: run `node tools/update-sw.js`'); process.exit(1); }
    console.log('sw.js is up to date');
  } else {
    writeFileSync(swPath, out);
    console.log(`sw.js updated: version ${computeAssets().version}, ${computeAssets().assets.length} assets`);
  }
}
