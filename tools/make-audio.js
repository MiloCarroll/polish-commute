#!/usr/bin/env node
// Generates the bundled audio clips with Azure AI Speech (Agnieszka and Marek), staying
// inside the free (F0) tier: 0.5 million characters a month, 20 requests a minute.
//
//   export AZURE_SPEECH_KEY=...        # your Speech resource key (never commit it)
//   export AZURE_SPEECH_REGION=westeurope
//   node tools/make-audio.js --dry-run            # what would be generated, no key needed
//   node tools/make-audio.js                      # main pass: every text in a matching voice
//   node tools/make-audio.js --pass extra         # extra voices for listening variety
//   node tools/make-audio.js --pass all           # both, e.g. overnight
//
// It is safe to stop (Ctrl-C) and run again: existing clips are skipped. Usage per calendar
// month is recorded in tools/audio-usage.json and the run stops before a self-imposed cap
// (default 400,000 characters, below the 500,000 free allowance). Afterwards it rewrites
// content/audio/manifest.json from the clips on disk. Then run `node tools/update-sw.js`.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectSpeech } from './audio-texts.js';
import { spawn } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO = join(ROOT, 'content', 'audio');
const USAGE = join(ROOT, 'tools', 'audio-usage.json');

// Zofia was dropped after listening tests: she produced audible glitches on some words
// (e.g. "nas") that Agnieszka and Marek did not.
export const VOICES = { f: 'pl-PL-AgnieszkaNeural', m: 'pl-PL-MarekNeural' };
const FORMAT = 'audio-24khz-48kbitrate-mono-mp3';
const FREE_CHARS = 500_000;
const DEFAULT_CAP = 400_000;   // stop well below the free allowance
const PER_REQUEST_MARGIN = 10; // count a little extra per request, to be safe
const GAP_MS = 3300;           // ≈18 requests a minute (F0 allows 20 per 60 seconds)

// Exact silence before and after the speech. The lead-in stops speakers and Bluetooth
// headphones that take a moment to wake up from swallowing the first sound.
const LEAD_MS = 300;
const TAIL_MS = 150;
const STYLE = `lead${LEAD_MS}-tail${TAIL_MS}`; // part of the file name: changing it remakes every clip

export const clipFile = (voice, text) => `${voice}/${createHash('sha1').update(`${VOICES[voice]}\n${STYLE}\n${text}`).digest('hex').slice(0, 16)}.mp3`;

/**
 * Jobs for a pass. main: one clip per text, in the speaker's voice for gender-dependent
 * sentences (both voices if both genders say it), otherwise the main female voice.
 * extra: the male voice for sentences that don't depend on gender, so listening cards
 * can vary the speaker.
 */
export function plan(speech, pass) {
  const jobs = [];
  for (const [text, genders] of speech) {
    const main = genders.size ? [...genders].map((g) => (g === 'm' ? 'm' : 'f')) : ['f'];
    // Extra pass: the other voice for sentences that don't depend on gender, so listening
    // cards alternate between a female and a male speaker.
    const extra = genders.size ? [] : ['m'];
    const voices = pass === 'main' ? main : pass === 'extra' ? extra : [...main, ...extra];
    for (const v of voices) jobs.push({ text, voice: v, file: clipFile(v, text) });
  }
  return jobs;
}

const monthKey = (d = new Date()) => d.toISOString().slice(0, 7); // calendar month, UTC
const readUsage = () => (existsSync(USAGE) ? JSON.parse(readFileSync(USAGE, 'utf8')) : {});
const cost = (text) => [...text].length + PER_REQUEST_MARGIN;

const xml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const ssml = (voice, text) => `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="pl-PL"><voice name="${VOICES[voice]}"><mstts:silence type="Leading-exact" value="${LEAD_MS}ms"/><mstts:silence type="Tailing-exact" value="${TAIL_MS}ms"/>${xml(text)}</voice></speak>`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Rebuild content/audio/manifest.json from the clips present on disk. */
export function writeManifest(speech) {
  const clips = {};
  for (const text of [...speech.keys()].sort()) {
    const byVoice = {};
    for (const v of Object.keys(VOICES)) {
      const f = clipFile(v, text);
      if (existsSync(join(AUDIO, f))) byVoice[v] = f;
    }
    if (Object.keys(byVoice).length) clips[text] = byVoice;
  }
  // Delete clips no longer referenced (removed texts, or made with older settings).
  const keep = new Set(Object.values(clips).flatMap((v) => Object.values(v)));
  for (const v of Object.keys(VOICES)) {
    const dir = join(AUDIO, v);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) if (f.endsWith('.mp3') && !keep.has(`${v}/${f}`)) unlinkSync(join(dir, f));
  }
  mkdirSync(AUDIO, { recursive: true });
  writeFileSync(join(AUDIO, 'manifest.json'), JSON.stringify({ format: 2, voices: VOICES, clips }, null, 0) + '\n');
  return Object.keys(clips).length;
}

/** --sample "nas": the text in every voice at three MP3 qualities, for comparing by ear. */
async function makeSamples(text) {
  const { key, region } = azureEnv();
  const dir = join(ROOT, 'tools', 'audio-samples');
  mkdirSync(dir, { recursive: true });
  const formats = { '48k': 'audio-24khz-48kbitrate-mono-mp3', '96k': 'audio-24khz-96kbitrate-mono-mp3', '160k': 'audio-24khz-160kbitrate-mono-mp3' };
  const usage = readUsage();
  let spent = 0;
  for (const v of Object.keys(VOICES)) {
    for (const [q, format] of Object.entries(formats)) {
      const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: 'POST',
        headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': format, 'User-Agent': 'polski-audio-generator' },
        body: ssml(v, text),
      });
      if (!res.ok) throw new Error(`Azure returned ${res.status}: ${await res.text()}`);
      const out = join(dir, `${text.replace(/[^\p{L}\p{N}]+/gu, '_')}-${v}-${q}.mp3`);
      writeFileSync(out, Buffer.from(await res.arrayBuffer()));
      spent += cost(text);
      console.log(out);
      await sleep(GAP_MS);
    }
  }
  usage[monthKey()] = (usage[monthKey()] ?? 0) + spent;
  writeFileSync(USAGE, JSON.stringify(usage, null, 2) + '\n');
  console.log(`Listen with: afplay <file>. (${spent} characters used.)`);
}

function azureEnv() {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) throw new Error('Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION first (see the top of this file).');
  return { key, region };
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };
  const dry = args.includes('--dry-run');
  const pass = opt('pass', 'main');
  const cap = Number(opt('max-chars', DEFAULT_CAP));
  const limit = Number(opt('limit', Infinity));
  if (!['main', 'extra', 'all'].includes(pass)) throw new Error('--pass must be main, extra or all');
  if (cap > FREE_CHARS) throw new Error(`--max-chars may not exceed the free allowance (${FREE_CHARS})`);

  const sample = opt('sample', null);
  if (sample) return makeSamples(sample);

  const speech = collectSpeech();
  const todo = plan(speech, pass).filter((j) => !existsSync(join(AUDIO, j.file))).slice(0, limit);
  const chars = todo.reduce((n, j) => n + cost(j.text), 0);
  const usage = readUsage();
  const used = usage[monthKey()] ?? 0;
  console.log(`Pass "${pass}": ${todo.length} clips to make, about ${chars.toLocaleString()} characters ` +
    `(${used.toLocaleString()} already used this month, cap ${cap.toLocaleString()}). ` +
    `About ${Math.ceil((todo.length * GAP_MS) / 60000)} minutes at the free-tier rate.`);
  if (dry || !todo.length) { if (!dry) console.log(`Manifest: ${writeManifest(speech)} texts with clips.`); return; }

  const { key, region } = azureEnv();
  const base = `https://${region}.tts.speech.microsoft.com/cognitiveservices`;

  // Check the voices exist before spending anything.
  const vr = await fetch(`${base}/voices/list`, { headers: { 'Ocp-Apim-Subscription-Key': key } });
  if (vr.status === 401) throw new Error('Azure rejected the key (401). Check AZURE_SPEECH_KEY and AZURE_SPEECH_REGION.');
  if (!vr.ok) throw new Error(`Could not list voices (${vr.status}).`);
  const available = new Set((await vr.json()).map((v) => v.ShortName));
  const missing = Object.values(VOICES).filter((v) => !available.has(v));
  if (missing.length) throw new Error(`These voices are not available in ${region}: ${missing.join(', ')}`);

  acquireLock();
  keepAwake();

  let made = 0, spent = 0;
  const skipped = [];
  const started = Date.now();
  const save = () => {
    usage[monthKey()] = (usage[monthKey()] ?? 0) + spent;
    writeFileSync(USAGE, JSON.stringify(usage, null, 2) + '\n');
    spent = 0;
    writeManifest(speech);
  };
  const stop = (code, msg) => { save(); releaseLock(); if (msg) console.log(msg); process.exit(code); };
  process.on('SIGINT', () => stop(130, `\nStopped after ${made} clips. Run the same command again to continue.`));
  process.on('SIGTERM', () => stop(143, `\nStopped after ${made} clips.`));

  for (const job of todo) {
    const c = cost(job.text);
    if ((usage[monthKey()] ?? 0) + spent + c > cap) { console.log(`Reached the monthly cap of ${cap.toLocaleString()} characters; stopping. Run again next month.`); break; }
    const result = await synthesise(base, key, job);
    if (result.ok) {
      const out = join(AUDIO, job.file);
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, result.audio);
      spent += c;
      made++;
    } else if (result.fatal) {
      stop(1, result.message);
    } else {
      skipped.push(`${job.voice}: ${job.text} (${result.message})`);
      console.log(`Skipped one clip: ${result.message}`);
    }
    if (made && made % 25 === 0) {
      save();
      const mins = (Date.now() - started) / 60000;
      const left = Math.round(((todo.length - made - skipped.length) * mins) / Math.max(1, made + skipped.length));
      console.log(`${new Date().toLocaleTimeString()}  ${made}/${todo.length} clips, about ${left} min left`);
    }
    await sleep(GAP_MS);
  }
  save();
  releaseLock();
  if (skipped.length) {
    writeFileSync(join(ROOT, 'tools', 'audio-skipped.txt'), skipped.join('\n') + '\n');
    console.log(`${skipped.length} clips could not be made (listed in tools/audio-skipped.txt); the app uses the phone voice for those.`);
  }
  console.log(`Done: ${made} clips made. Manifest updated. Next: tell Claude, or run node tools/update-sw.js`);
}

/**
 * One request, retried through the night: network drops, timeouts, 5xx and 429 wait and
 * try again (30 s, 1 min, 2 min, 5 min… up to about 45 minutes in total). A 400 (Azure
 * can't read that text) skips just that clip. 401/403 stop the run.
 */
export async function synthesise(base, key, job) {
  const waits = [30, 60, 120, 300, 300, 600, 600, 600]; // seconds
  const scale = Number(process.env.MAKE_AUDIO_WAIT_SCALE ?? 1); // tests only
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(`${base}/v1`, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': FORMAT,
          'User-Agent': 'polski-audio-generator',
        },
        body: ssml(job.voice, job.text),
        signal: AbortSignal.timeout(30000),
      });
    } catch (e) {
      res = { ok: false, status: 0, text: async () => e.message };
    }
    if (res.ok) {
      const audio = Buffer.from(await res.arrayBuffer());
      if (audio.length > 500) return { ok: true, audio };
      res = { ok: false, status: 0, text: async () => 'empty audio' };
    }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, fatal: true, message: `Azure refused the request (${res.status}). Check the key, or if the free quota is used up, wait until next month.` };
    }
    if (res.status === 400) return { ok: false, message: `Azure could not read "${job.text}" (400)` };
    if (attempt >= waits.length) return { ok: false, message: `gave up after repeated errors (${res.status || 'network'})` };
    const why = res.status === 429 ? 'Azure is busy' : res.status ? `Azure error ${res.status}` : `network problem (${await res.text()})`;
    console.log(`${new Date().toLocaleTimeString()}  ${why}; waiting ${waits[attempt] >= 60 ? `${waits[attempt] / 60} min` : `${waits[attempt]} s`} and trying again`);
    await sleep(waits[attempt] * 1000 * scale);
  }
}

// ---- One run at a time; keep the Mac awake ------------------------------------

const LOCK = join(ROOT, 'tools', '.audio-lock');

function acquireLock() {
  if (existsSync(LOCK)) {
    const pid = Number(readFileSync(LOCK, 'utf8'));
    let alive = false;
    try { process.kill(pid, 0); alive = true; } catch { /* not running */ }
    if (alive) throw new Error(`Another make-audio run is already going (process ${pid}). Stop it with Ctrl-C first; two at once would exceed the free-tier rate.`);
  }
  writeFileSync(LOCK, String(process.pid));
}

function releaseLock() {
  try { if (Number(readFileSync(LOCK, 'utf8')) === process.pid) unlinkSync(LOCK); } catch { /* already gone */ }
}

/** On macOS, stop the Mac sleeping while this run is going (the screen may still turn off). */
function keepAwake() {
  if (process.platform !== 'darwin') return;
  try {
    const c = spawn('caffeinate', ['-i', '-w', String(process.pid)], { stdio: 'ignore', detached: true });
    c.unref();
    console.log('Keeping the Mac awake until this run finishes (it can still lock the screen).');
  } catch { /* caffeinate not available */ }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
