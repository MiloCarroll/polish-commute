# Pronunciation content spec

How `content/pronunciation.json` is written. Read this before adding or fixing items.

## Learner and goal

Complete beginner, English speaker, learning everyday spoken Polish. Audio is the iPhone's built-in Polish text-to-speech voice. Exercises are done silently (no speaking aloud, no microphone).

## Accuracy rules (mandatory: no native speaker reviews this)

- Use only **common, standard words** whose spelling and meaning you are certain of. Prefer everyday words (home, family, food, body, weather, common verbs in the infinitive or 1st person). No rare words, no proper names, no slang.
- Double-check every diacritic: ą ć ę ł ń ó ś ź ż.
- English glosses: short, the most common meaning (e.g. "wardrobe", "to drink").
- English sound comparisons only where honest. Say "no English equivalent" or "roughly like…" where it is only approximate. Never claim Polish *sz* equals English *sh* exactly (it is harder/retroflex); *ś* is softer, like a hissing "sh" with the tongue raised towards the palate (similar to the sound in Mandarin "x").
- All text must be original (not copied from textbooks or websites).

## Topic shape

```json
{
  "id": "pr-05",
  "title": "sz, cz, rz/ż",
  "lesson": {
    "summary": "One sentence saying what this topic teaches.",
    "body": [
      "Paragraph 1. Polish words in the text are written in {{double braces}} so the app makes them tap-to-hear.",
      "Paragraph 2 (1–3 short paragraphs in total, plain English)."
    ],
    "letters": [
      { "spelling": "sz", "sound": "Honest description / English comparison.", "examples": ["szafa", "kasza"] }
    ],
    "more": ["Optional extra detail paragraphs, shown collapsed under 'More detail'."]
  },
  "items": [ ... ]
}
```

`letters[].examples` should be words that also appear as items in the topic where possible.

## Item shape

```json
{
  "id": "pr-05-001",
  "pl": "szafa",
  "en": "wardrobe",
  "cards": ["listen", "dict"],
  "listen": { "options": ["szafa", "siafa", "safa"] },
  "alts": [],
  "syll": ["sza", "fa"],
  "stress": 0,
  "stressNote": "Only for exceptions: one line saying why stress is not on the second-to-last syllable."
}
```

- `id`: `pr-<topic 2 digits>-<3 digits>`, numbered from 001 in order. Permanent once released.
- `pl`: the Polish word or very short phrase, lower case unless it must be capitalised.
- `cards`: one or two of `"listen"`, `"dict"`, `"stress"`.
  - **listen** (listen and choose): the learner hears `pl` and picks the right spelling. Needs `listen.options`: 3 or 4 strings, one of which is the answer (`pl` by default). Optional `listen.q` replaces the question (default "Which word did you hear?") and optional `listen.answer` when the answer is not `pl` (for example the devoicing topic asks "Which sound do you hear at the end?" with options `["p", "b"]` and answer `"p"`).
  - **dict** (dictation): the learner hears `pl` (and sees the English meaning as a hint) and types it. Use for short words (up to about 8 letters). If another common word sounds identical, list its spelling in `alts` (e.g. `może` / `morze`). If not, `alts` can be left out.
  - **stress** (stress spotting): the learner sees `syll` and taps the stressed syllable. Needs `syll` (joined, they must spell `pl` exactly, ignoring spaces) and `stress` (0-based index). Stress is on the second-to-last syllable unless `stressNote` explains the exception. Mainly for topic 12; topic 1 may have a few.

### Distractor rules for `listen.options` (important)

Every option must sound **audibly different** from the answer in standard Polish. Never put two spellings in one option set that are pronounced the same. These pairs are pronounced the same and must never be the only difference between the answer and a distractor:

- *ó* = *u*
- *rz* = *ż* (and after p, t, k, ch, *rz* sounds like *sz*: *trzy* ≈ "tszy")
- *ch* = *h*
- *ś* = *si* before a vowel, *ć* = *ci*, *ź* = *zi*, *ń* = *ni* (*siano* would sound like "śano"), so never offer both forms
- final devoicing: word-final *b/p*, *d/t*, *g/k*, *w/f*, *z/s*, *ż/sz*, *dz/c* etc. sound the same (*chleb* ≈ "chlep")
- *ą* before *p/b* sounds like *om*, before *t/d/c/cz* like *on*, before *k/g* like *oŋ*; *ę* likewise with *e*. So *kąt* and *kont* sound alike. Contrast *ą* with *ę*, or with plain *o*/*a*, instead.
- word-final *ę* is usually pronounced almost like plain *e*, so do not contrast final *ę* with final *e*.

Good distractors swap in a **different** sound from the topic's confusable set: *sz / ś(si) / s*, *cz / ć(ci) / c*, *ż(rz) / ź(zi) / z*, *ł / l*, *w / ł*, *y / i*, *ą / ę / o*, *dz / dź(dzi) / dż*, *h(ch) / k*. Distractors may be made-up spellings, but must look like plausible Polish spelling (e.g. use *si* not *ś* before a vowel).

## Topic list and targets

| id | title | emphasis |
|---|---|---|
| pr-01 | The alphabet and the six oral vowels | a e i o u y; letters that differ from English (c, j, w); a few stress cards for 2-syllable words |
| pr-02 | y versus i; ó and u sound the same | listen: y/i minimal pairs (być/bić, my/mi). ó=u explained; dict cards teach common ó words |
| pr-03 | ł and w | ł ≈ English w; w ≈ English v; listen: ł/l, ł/w contrasts |
| pr-04 | Nasal vowels ą and ę | how they change before different consonants and at word end; listen ą vs ę vs o/e where audible |
| pr-05 | sz, cz, rz/ż | the "hard" series; rz=ż; rz after p/t/k = sz |
| pr-06 | ś, ć, ź, ń and si, ci, zi, ni | the "soft" series; spelling rule: accent letter before consonant/at end, i-spelling before a vowel |
| pr-07 | Telling the two "sh / ch / zh" series apart | the core listening drill: about 30 listen items, minimal pairs where possible (kasza/kasa, czy/ci, proszę/prosię) |
| pr-08 | dz, dź, dż | dzwon, dzień, dżem; listen contrasts |
| pr-09 | ch and h | same sound, like Scottish "loch"; listen contrasts with k |
| pr-10 | Consonant clusters | chrząszcz, szczęście, wszystko, pszczoła, źdźbło; mostly listen + dict with short words |
| pr-11 | Devoicing at word end and in clusters | chleb ≈ chlep; listen cards use `q` + `answer` ("Which sound do you hear at the end?") |
| pr-12 | Stress on the second-to-last syllable, and common exceptions | stress cards: regular words, then exceptions: -yka/-ika words (muzyka, matematyka), past plural (byliśmy, robiliście), conditional (chciałbym, zrobiłbym), hundreds (czterysta, siedemset) |

Each topic: 18–28 items (pr-07: about 30). Most items have 1 card, some 2. Aim for roughly 60% listen, 25% dict, 15% stress overall (topic 12 is mostly stress).

## Syllables

Split by spoken syllables: one vowel (a ą e ę i o ó u y) per syllable. An *i* directly before another vowel only softens the consonant and is not its own syllable (*sio-stra*, *nie*, *cie-szę*). Put consonant clusters at the start of the next syllable where natural (*sio-stra*, *o-kno*). For stress the exact boundary matters less than the syllable count.
