# Polski: a Polish commute trainer

A personal, offline web app for learning conversational Polish on a 40-minute train commute, used one-handed on an iPhone. No accounts, ads, streaks, points, notifications or microphone. Progress stays on the phone.

**Status: version 1 complete (stages 1–5).**

- **Pronunciation:** 12 topics with lessons; listen and choose, dictation, stress spotting.
- **Vocabulary:** 18 topics, about 470 words; Polish → English, English → Polish, listening, sentence gaps and whole-sentence "how would you say…" cards, with gender-aware example sentences; plus *My phrases* for your own cards.
- **Grammar:** 8 topics with plain-English explanations and tables; choose-the-form then typed drills, each wrong answer showing a reason and a link back to the explanation.
- **Conversations:** 8 short dialogues for real situations with her family (meeting her parents, dinner, a phone call with her mum, Wigilia, her grandparents…), with gender variants. Every line has a listening card; your own lines also get a "your turn" card. The topic page shows the whole script with *Play all*.
- **Around it:** *Undo* for the last answer, a one-tap *Today's session* (all due reviews, then new cards shared across the three modules), a shared daily allowance, Stats, a Flag button on every card, export/import with a backup reminder, a session timer and an offline update banner.

## How it works

- Plain HTML, CSS and JavaScript ES modules. No framework, no build step, no runtime network requests.
- **Scheduling:** [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) **5.4.2** (MIT, published 2026-09-01), vendored unmodified as `vendor/ts-fsrs-5.4.2.js` (licence in `vendor/ts-fsrs-LICENSE.txt`). Default FSRS parameters, target retention 0.90 (changeable in Settings), fuzz on.
- **Storage:** IndexedDB database `polski` with stores `cards` (FSRS state per studied card), `reviews` (the full review log, never pruned, so parameters can be optimised later), `settings`, `flags` (cards marked as possibly wrong, with a note) and `own` (your own phrases).
- **Daily allowance:** 15 new cards per day shared across all modules. A card counts against the allowance when it is first reviewed. The study day resets at 04:00 local time.
- **Today's session** (`js/session.js`): every due card from every module first, then new cards from whichever module has introduced the fewest new cards today, so the allowance is spread evenly. Learning cards are shown a little early only when nothing else is left.
- **Audio clips (optional):** if `content/audio/manifest.json` exists, mapping exact Polish text to a file in `content/audio/`, those clips are played instead of the live voice (and cached for offline use). Clips are generated once with Azure AI Speech on the free tier (`tools/make-audio.js`, with a monthly character cap below the free allowance): Agnieszka as the main voice, Marek for the learner's own gender-dependent lines and as a second speaker on listening cards (Zofia was dropped after she glitched on some words). Setup and commands: [`docs/audio-setup.md`](docs/audio-setup.md). `node tools/audio-texts.js --list` prints every text the app can speak (about 1,500). Without clips the app uses the iPhone's Polish voice. `content/audio/test.m4a` is a test clip for checking whether recorded audio plays with the phone on silent.
- **Offline:** `sw.js` caches every app file under a versioned cache, cache-first. A new deployment shows "Update available, tap to reload" instead of reloading by itself.
- **Audio:** the Web Speech API with Polish (`pl-PL`) voices only. The first tap in each session unlocks auto-play (an iOS requirement).

## Your data

Everything stays in the browser storage of the phone that uses the app; nothing is sent anywhere.

- **Back up:** Settings shows when you last exported, and Home reminds you after 14 days (or after a week of study if you've never exported). Settings → *Export progress* saves a `polski-progress-YYYY-MM-DD.json` file (save it to Files or iCloud Drive). It contains every card's state, the full review log, settings, flags and your own phrases.
- **Restore:** Settings → *Import from file…* shows what the file contains and asks before replacing everything. The import is all-or-nothing, and restores the data exactly (checked by unit tests and an in-browser round trip).
- **Flags:** tap ⚑ *Flag* on any card whose content looks wrong. Settings lists them; *Copy* or *Export as text* gives a plain list (card ID, card text, note) to send back for fixing.
- **Reset:** Settings → *Reset all progress* (asks twice) forgets card progress and the review log, keeping settings, own phrases and flags.
- Safari can clear website data for apps that go unused for weeks; the app asks for persistent storage, but export a backup now and then.

### Known iPhone audio limits (tested on the owner's iPhone 15 Pro, November 2026)

- **No sound on silent.** Speech is muted while the phone is on silent; asking iOS for a "playback" audio session did not change this. Use headphones or turn silent off.
- **Built-in voice only.** Safari offers web apps only the built-in compact Polish voice ("Zosia"). Enhanced and Premium voices downloaded in iPhone Settings are not exposed, so the first-run screen no longer suggests downloading one (a deliberate departure from the brief). The app still prefers an Enhanced or Premium voice if a future iOS lists one.

```
index.html, manifest.webmanifest, sw.js
css/app.css
js/app.js          entry point, routing, service-worker registration
js/db.js           IndexedDB wrapper
js/scheduler.js    FSRS wrapper, daily allowance, card picking (pure, unit-tested)
js/day.js          04:00 study-day arithmetic (pure, unit-tested)
js/content.js      loads content/*.json and builds card definitions
js/settings.js     settings with defaults
js/tts.js          speech synthesis
js/grading.js      typed-answer normalising and grading (pure, unit-tested)
js/variants.js     gender variants of example sentences (pure, unit-tested)
js/accentbar.js    ą ć ę ł ń ó ś ź ż buttons above the iOS keyboard
js/exercises.js    card screens: recognition, listen and choose, dictation, stress
js/lesson.js       topic lessons with tap-to-hear words
js/session.js      today's session: which card comes next (pure, unit-tested)
js/stats.js        stats calculations (pure, unit-tested)
js/backup.js       export/import file format (pure, unit-tested)
js/own.js          My phrases: IDs and cards (pure, unit-tested)
js/flags.js        Flag button, flag dialog, text export
js/timer.js        session timer bar and message
js/views/          home, module/topic, study, stats, phrases, settings, first-run (welcome)
content/           course content (JSON); how to write it: docs/content-pronunciation.md, docs/content-vocabulary.md, docs/content-grammar.md
tools/             validate-content.js, update-sw.js, released-ids.json, audio-texts.js, make-audio.js
tests/             node --test unit tests
```

## Run locally

Any static file server works. From the repository root:

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765. Service workers run on `localhost` without HTTPS.

## Tests and content validation

Needs Node 20 or newer. No packages to install.

```bash
node --test tests/
```

```bash
node tools/validate-content.js
```

The tests also fail if `sw.js` is out of date or the content does not validate.

## Deploy

GitHub Pages serves the `main` branch root. Before every push:

```bash
node tools/update-sw.js && node tools/validate-content.js && node --test tests/
```

`update-sw.js` rewrites the file list and version hash in `sw.js`, so phones pick up the new version and show the update banner. Then commit and `git push`. Pages usually updates within a minute or two.

## Adding or fixing content without losing progress

Progress is stored against **card IDs**, so released IDs must never change.

- Item IDs: `pr-NN-NNN` (pronunciation), `v-NNNN` (vocabulary), `g-NN-NNN` (grammar). Card IDs add the exercise, e.g. `pr-05-003-listen`, `v-0001-rec`; a grammar drill's ID is its card ID (`g-03-017`). User-made cards start with `u-`.
- To fix a typo or translation, edit the item in place and keep its `id`.
- To add items, give them new IDs (the next unused number). Never reuse or renumber an ID, even if you delete an item.
- Order within a topic is the order cards are introduced; you can reorder freely because IDs do not encode position.
- After a release, record the shipped card IDs so the validator catches accidental removals:

```bash
node tools/validate-content.js --release
```

## Content accuracy

No native speaker reviews this content, so it follows the safeguards in the project brief (kept private): common textbook Polish, inflections checked against Wiktionary, and a separate error-hunting review pass per content file.

**Stage 1 starter words** (cześć, dzień dobry, dziękuję, proszę, przepraszam, do zobaczenia, tak, nie) and their example sentences are basic, invariable or fixed phrases; they were checked by a review pass but not yet against Wiktionary. Items that could not be verified will be listed here.

**Pronunciation (stage 2):** 12 topics, 295 items, 367 cards. Drafted to `docs/content-pronunciation.md`, then given a separate full error-hunting review that fixed 5 issues (one near-homophone distractor, one missing homophone in `alts`, three overstated lesson claims), plus 3 follow-up fixes to borderline distractors and glosses.
- *Verified on Wiktionary:* every stress exception in pr-12 (muzyka, fizyka, polityka, matematyka, byliśmy, byliście, robiliśmy, chciałabym, zrobiłabym, chcielibyśmy, czterysta, siedemset, osiemset, dziewięćset); every assimilation answer in pr-11 (prośba, liczba, także, łyżka, książka, łódka, ławka, twój, wtorek); and the phonetic claims for wziął, zaczęli, kąt, jabłko, wszystko, źdźbło, chrząszcz, zdjęcie, pszczoła, dzwon, dżinsy, czeszę, prosię, buzia, obiad.
- *Not individually looked up:* the remaining basic high-frequency words in pr-01 to pr-08 (checked from knowledge during review), made-up distractor spellings (can't be verified by nature), and three historical notes in `more` sections (rz was once a distinct sound; some older speakers keep a dark ł; some eastern speakers voice h).
- *Subtlest listening contrasts, worth checking by ear on the phone:* pszczoła / pczoła (pr-10-003), wieś (pr-07-009; the rare command form wieź sounds identical and is not in `alts`).

**Vocabulary (stage 3):** 12 topics, 301 words, 870 cards (Polish → English, English → Polish, 158 sentence gaps, 110 listening), 35 example sentences with all four gender variants. Drafted to `docs/content-vocabulary.md`, then three separate reviewers checked every item and variant (agreement, case after prepositions, negation and numbers, aspect, gendered forms, Pan/Pani, diacritics, phrasing): 13 small fixes (more accepted answers, hints for ambiguous English, two word-order improvements), plus 3 follow-up fixes (an unfair perfective gap, an ambiguous translation, present-for-future replaced with *będę*).
- *Verified on Wiktionary:* the present tense and aspect pair of all 35 core verbs and the pairs of kroić, kłaść, piec, czuć, bać się, smażyć, martwić, budzić, ubierać, cieszyć, zmywać, pozdrowić, przytulić; vocatives misiu, kotku, skarbie; buziak (acc. buziaka), dokładka, kanapa, ogród, stopień, szwagier/szwagierka, teść, rodzeństwo, państwo, wyspany, najedzony.
- *Not individually looked up* (checked from standard grammar by the reviewers): very common nouns such as dom, pokój, kuchnia, stół, drzwi, sól, tydzień and the days of the week; common pairs wstawać/wstać, myć/umyć, gotować/ugotować, oglądać/obejrzeć; teściowa, dziadkowie, narzeczona/narzeczony; kochanie and słoneczko as vocatives.
- *Judgement calls:* sprzątać is paired with posprzątać (the everyday "clean up"), although Wiktionary lists sprzątnąć; lubić, kochać and pamiętać have no aspect pair (polubić/pokochać/zapamiętać change the meaning); pytać/zapytać is given as the textbook pair. Sentences mentioning "my girlfriend/boyfriend" are avoided because gender variants only cover the speaker and listener.

**Grammar (stage 4):** 8 topics, 273 drills (about 40% choose-the-form, then typed), 48 with all four gender variants (mostly the past tense). Drafted to `docs/content-grammar.md`, then three separate reviewers checked every drill and variant: fixes were the explanation wording (124 past-tense reasons that had been left unfinished, four lesson sentences that were imprecise, czyj added to the question-words lesson), *Jesteś przystojna* → *Jesteś ładna* (przystojny is "handsome" of a man), one translation, plus follow-ups (perfective *zadzwoniłaś* accepted, the album exception to -um, the -owa- → -uj- rule stated exactly).
- *Verified on Wiktionary:* present tense of być, mieć, znać, czekać, mieszkać, słuchać, mówić, robić, lubić, widzieć, myśleć, tęsknić, uczyć się, pracować, gotować, rozumieć, pisać, jechać, iść, pić, słyszeć; past tense of być, robić, pracować, tęsknić, dzwonić, sprzątać, oglądać, wiedzieć, widzieć, spać, chcieć, myśleć, mieć, pić, gotować, kupić, zadzwonić and the irregular iść (szedłem/szłam), jeść (jadł-), móc (mogłem, mógł); genders of noc, rzecz, kość, wieś, mysz, gość, muzeum; genitive/accusative of ser, sok, klucz, kurczak, szwagier, makaron, telefon, samochód, pies, teść, czas, chleb, obiad, kot, rower, sól, pomysł, dziadek, wujek, kuzyn, pytanie; czekać na + acc., tęsknić za + instr., słuchać + gen.
- *Not individually looked up:* the common feminine and neuter genitives (kawy, wody, herbaty, mamy, babci, mięsa, piwa, mleka, wina, ciasta …), brat → brata, film → filmu, and the adjective endings.
- *Simplifications kept on purpose:* masculine inanimate nouns "stay the same" in the accusative (colloquial *jem banana* is not mentioned); partitive genitive after *chcę* is explained but only accepted where it is common.

**Vocabulary batch 2:** 6 topics (health, weather, work and studies, hobbies, holidays, at the table), 170 words, each reviewed separately: 20 small fixes to notes, translations and accepted answers, including one real error (22–24 take *stopnie*, not *stopni*). Verified on Wiktionary: the genders and case forms of nearly all health and weather nouns, plecy, kaszel, doktorant, promotor, studia, stypendium, hobby, szachy, sylwester, opłatek, święconka, Wielkanoc, Wigilia, widelec, and the verbs kichać, wziąć, wiać, biegać, zdać, zarabiać, interesować się, częstować, nalać, usiąść, wznieść, świętować.

**Conversations:** 8 dialogues, 80 lines, reviewed separately (no grammar, case, gender or pan/pani errors found; 13 wording improvements, pan/pani written lower case, the learner's job set to a PhD). The reviewer did not need to look anything up; the writers checked uszko/uszkami, pokazać, gwiazdka, najedzony, głośnik, napić się and nałożyć. Wigilia customs in d-07 are kept to well-known ones.
- *Known duplicate:* *o której* exists in both Time and Question words (both IDs released, so both are kept).
