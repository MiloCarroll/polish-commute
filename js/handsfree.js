// Hands-free listening: joins recorded clips and silent pauses into one MP3, so it keeps
// playing as a single track with the screen off. Pure parts, unit-tested.
//
// All clips are MPEG-2 Layer III, 24 kHz mono, 48 kbit/s (Azure's
// audio-24khz-48kbitrate-mono-mp3), so their frames can be joined byte for byte.

const BITRATES = {
  1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], // MPEG-1 Layer III
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],     // MPEG-2/2.5 Layer III
};
const RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

/** Parse one Layer III frame header at offset i, or null. */
export function frameAt(bytes, i) {
  if (i + 4 > bytes.length || bytes[i] !== 0xff || (bytes[i + 1] & 0xe0) !== 0xe0) return null;
  const ver = (bytes[i + 1] >> 3) & 3;      // 3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5
  const layer = (bytes[i + 1] >> 1) & 3;    // 1 = Layer III
  if (ver === 1 || layer !== 1) return null;
  const br = BITRATES[ver === 3 ? 1 : 2][bytes[i + 2] >> 4];
  const sr = RATES[ver]?.[(bytes[i + 2] >> 2) & 3];
  if (!br || !sr) return null;
  const pad = (bytes[i + 2] >> 1) & 1;
  const samples = ver === 3 ? 1152 : 576;
  const length = Math.floor(((samples / 8) * br * 1000) / sr) + pad;
  const mono = (bytes[i + 3] >> 6) === 3;
  return { length, samples, sr, ver, mono };
}

function skipId3(bytes) {
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    const size = (bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9];
    return 10 + size;
  }
  return 0;
}

const isTagFrame = (bytes, i, f) => {
  const side = f.ver === 3 ? (f.mono ? 17 : 32) : (f.mono ? 9 : 17);
  const o = i + 4 + side;
  const tag = String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
  return tag === 'Xing' || tag === 'Info' || tag === 'VBRI';
};

/**
 * The audio frames of an MP3 file, without ID3 tags or the Xing/Info header frame (which
 * would tell the player the joined file is as short as the first clip).
 * Returns { bytes, seconds }.
 */
export function audioFrames(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let i = skipId3(bytes);
  const parts = [];
  let samples = 0, sr = 24000, first = true;
  while (i < bytes.length) {
    const f = frameAt(bytes, i);
    if (!f) { i++; continue; }
    if (!(first && isTagFrame(bytes, i, f))) {
      parts.push(bytes.subarray(i, Math.min(bytes.length, i + f.length)));
      samples += f.samples;
      sr = f.sr;
    }
    first = false;
    i += f.length;
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return { bytes: out, seconds: samples / sr };
}

// A silent frame in the clips' format: header FF F3 64 C4 (MPEG-2 Layer III, 48 kbit/s,
// 24 kHz, mono) followed by zeros (no audio data decodes as silence). 144 bytes = 24 ms.
const SILENT_FRAME = (() => {
  const f = new Uint8Array(144);
  f.set([0xff, 0xf3, 0x64, 0xc4]);
  return f;
})();
export const SILENT_FRAME_SECONDS = 576 / 24000;

/** Silence of about `seconds`, as MP3 frames. */
export function silence(seconds) {
  const n = Math.max(1, Math.round(seconds / SILENT_FRAME_SECONDS));
  const out = new Uint8Array(n * SILENT_FRAME.length);
  for (let k = 0; k < n; k++) out.set(SILENT_FRAME, k * SILENT_FRAME.length);
  return { bytes: out, seconds: n * SILENT_FRAME_SECONDS };
}

/**
 * The steps for one sentence.
 *   mode "understand": Polish, pause (you work out the meaning), Polish again, English.
 *   mode "speak":      English, pause (you say it in Polish), Polish, Polish again.
 * Without an English clip, "understand" plays the Polish twice and the English is only
 * shown on screen; "speak" needs the English clip.
 */
export function stepsFor({ pl, en }, mode, pause) {
  if (mode === 'speak') {
    if (!en) return null;
    return [{ clip: en }, { gap: pause }, { clip: pl }, { gap: 1 }, { clip: pl }, { gap: 2 }];
  }
  return en
    ? [{ clip: pl }, { gap: pause }, { clip: pl }, { gap: 0.7 }, { clip: en }, { gap: 2 }]
    : [{ clip: pl }, { gap: pause }, { clip: pl }, { gap: 2 }];
}

/** Shuffle (Fisher–Yates) with an injectable random source. */
export function shuffled(arr, rand = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
