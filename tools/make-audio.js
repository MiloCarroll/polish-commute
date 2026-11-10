#!/usr/bin/env node
// Generates the bundled audio clips with Azure AI Speech (neural Polish voices), staying
// inside the free (F0) tier: 0.5 million characters a month, 20 requests a minute.
//
//   export AZURE_SPEECH_KEY=...        # your Speech resource key (never commit it)
//   export AZURE_SPEECH_REGION=westeurope
//   node tools/make-audio.js --dry-run            # what would be generated, no key needed
//   node tools/make-audio.js                      # main pass: every text in a matching voice
//   node tools/make-audio.js --pass extra         # extra voices for listening variety
//
// It is safe to stop (Ctrl-C) and run again: existing clips are skipped. Usage per calendar
// month is recorded in tools/audio-usage.json and the run stops before a self-imposed cap
// (default 400,000 characters, below the 500,000 free allowance). Afterwards it rewrites
// content/audio/manifest.json from the clips on disk. Then run `node tools/update-sw.js`.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectSpeech } from './audio-texts.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO = join(ROOT, 'content', 'audio');
const USAGE = join(ROOT, 'tools', 'audio-usage.json');

export const VOICES = { f: 'pl-PL-ZofiaNeural', m: 'pl-PL-MarekNeural', f2: 'pl-PL-AgnieszkaNeural' };
const FORMAT = 'audio-24khz-48kbitrate-mono-mp3';
const FREE_CHARS = 500_000;
const DEFAULT_CAP = 400_000;   // stop well below the free allowance
const PER_REQUEST_MARGIN = 10; // count a little extra per request, to be safe
const GAP_MS = 3300;           // ≈18 requests a minute (F0 allows 20 per 60 seconds)

export const clipFile = (voice, text) => `${voice}/${createHash('sha1').update(`${VOICES[voice]}\n${text}`).digest('hex').slice(0, 16)}.mp3`;

/**
 * Jobs for a pass. main: one clip per text, in the speaker's voice for gender-dependent
 * sentences (both voices if both genders say it), otherwise the main female voice.
 * extra: a second female voice for everything female, and the male voice for sentences
 * that don't depend on gender, so listening cards can vary the speaker.
 */
export function plan(speech, pass) {
  const jobs = [];
  for (const [text, genders] of speech) {
    const main = genders.size ? [...genders].map((g) => (g === 'm' ? 'm' : 'f')) : ['f'];
    const extra = [];
    if (!genders.size) extra.push('m', 'f2');
    else if (genders.has('f')) extra.push('f2');
    const voices = pass === 'main' ? main : pass === 'extra' ? extra : [...main, ...extra];
    for (const v of voices) jobs.push({ text, voice: v, file: clipFile(v, text) });
  }
  return jobs;
}

const monthKey = (d = new Date()) => d.toISOString().slice(0, 7); // calendar month, UTC
const readUsage = () => (existsSync(USAGE) ? JSON.parse(readFileSync(USAGE, 'utf8')) : {});
const cost = (text) => [...text].length + PER_REQUEST_MARGIN;

const xml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const ssml = (voice, text) => `<speak version="1.0" xml:lang="pl-PL"><voice name="${VOICES[voice]}">${xml(text)}</voice></speak>`;
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
  mkdirSync(AUDIO, { recursive: true });
  writeFileSync(join(AUDIO, 'manifest.json'), JSON.stringify({ format: 2, voices: VOICES, clips }, null, 0) + '\n');
  return Object.keys(clips).length;
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

  const speech = collectSpeech();
  const todo = plan(speech, pass).filter((j) => !existsSync(join(AUDIO, j.file))).slice(0, limit);
  const chars = todo.reduce((n, j) => n + cost(j.text), 0);
  const usage = readUsage();
  const used = usage[monthKey()] ?? 0;
  console.log(`Pass "${pass}": ${todo.length} clips to make, about ${chars.toLocaleString()} characters ` +
    `(${used.toLocaleString()} already used this month, cap ${cap.toLocaleString()}). ` +
    `About ${Math.ceil((todo.length * GAP_MS) / 60000)} minutes at the free-tier rate.`);
  if (dry || !todo.length) { if (!dry) console.log(`Manifest: ${writeManifest(speech)} texts with clips.`); return; }

  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) throw new Error('Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION first (see the top of this file).');
  const base = `https://${region}.tts.speech.microsoft.com/cognitiveservices`;

  // Check the voices exist before spending anything.
  const vr = await fetch(`${base}/voices/list`, { headers: { 'Ocp-Apim-Subscription-Key': key } });
  if (vr.status === 401) throw new Error('Azure rejected the key (401). Check AZURE_SPEECH_KEY and AZURE_SPEECH_REGION.');
  if (!vr.ok) throw new Error(`Could not list voices (${vr.status}).`);
  const available = new Set((await vr.json()).map((v) => v.ShortName));
  const missing = Object.values(VOICES).filter((v) => !available.has(v));
  if (missing.length) throw new Error(`These voices are not available in ${region}: ${missing.join(', ')}`);

  let made = 0, spent = 0;
  const save = () => {
    usage[monthKey()] = (usage[monthKey()] ?? 0) + spent;
    writeFileSync(USAGE, JSON.stringify(usage, null, 2) + '\n');
    spent = 0;
    writeManifest(speech);
  };
  process.on('SIGINT', () => { save(); console.log(`\nStopped after ${made} clips. Run again to continue.`); process.exit(130); });

  for (const job of todo) {
    const c = cost(job.text);
    if ((usage[monthKey()] ?? 0) + spent + c > cap) { console.log(`Reached the monthly cap of ${cap.toLocaleString()} characters; stopping. Run again next month.`); break; }
    let tries = 0;
    while (true) {
      const res = await fetch(`${base}/v1`, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': FORMAT,
          'User-Agent': 'polski-audio-generator',
        },
        body: ssml(job.voice, job.text),
      });
      if (res.ok) {
        const out = join(AUDIO, job.file);
        mkdirSync(dirname(out), { recursive: true });
        writeFileSync(out, Buffer.from(await res.arrayBuffer()));
        spent += c;
        made++;
        break;
      }
      if (res.status === 429 && tries < 6) { tries++; process.stdout.write(' (busy, waiting a minute)'); await sleep(60000); continue; }
      if (res.status === 401 || res.status === 403) { save(); throw new Error(`Azure refused the request (${res.status}). If the free quota is used up, wait until next month.`); }
      save();
      throw new Error(`Azure returned ${res.status} for "${job.text}": ${await res.text()}`);
    }
    if (made % 25 === 0) { save(); console.log(`${made}/${todo.length} clips`); }
    await sleep(GAP_MS);
  }
  save();
  console.log(`Done: ${made} clips made. Manifest updated. Now run: node tools/update-sw.js`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
