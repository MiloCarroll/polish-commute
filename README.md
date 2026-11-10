# Polski: a Polish commute trainer

A personal, offline web app for learning conversational Polish on a 40-minute train commute, used one-handed on an iPhone. No accounts, ads, streaks, points, notifications or microphone. Progress stays on the phone.

**Status: stage 1 (foundation).** Home screen, storage, FSRS scheduling, offline support, settings and the first-run audio screen are in place, with 8 starter vocabulary cards to exercise the whole loop. Pronunciation (stage 2), the full vocabulary module (stage 3), grammar (stage 4) and stats, own cards, flags and export (stage 5) follow.

## How it works

- Plain HTML, CSS and JavaScript ES modules. No framework, no build step, no runtime network requests.
- **Scheduling:** [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) **5.4.2** (MIT, published 2026-09-01), vendored unmodified as `vendor/ts-fsrs-5.4.2.js` (licence in `vendor/ts-fsrs-LICENSE.txt`). Default FSRS parameters, target retention 0.90 (changeable in Settings), fuzz on.
- **Storage:** IndexedDB database `polski` with stores `cards` (FSRS state per studied card), `reviews` (the full review log, never pruned, so parameters can be optimised later), `settings`, and `flags` / `own` (used from stage 5).
- **Daily allowance:** 15 new cards per day shared across all modules. A card counts against the allowance when it is first reviewed. The study day resets at 04:00 local time.
- **Offline:** `sw.js` caches every app file under a versioned cache, cache-first. A new deployment shows "Update available, tap to reload" instead of reloading by itself.
- **Audio:** the Web Speech API with Polish (`pl-PL`) voices only. Enhanced and Premium voices are preferred automatically. The first tap in each session unlocks auto-play (an iOS requirement).

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
js/views/          home, module/topic, study, settings, first-run (welcome)
content/           course content (JSON)
tools/             validate-content.js, update-sw.js, released-ids.json
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

- Item IDs: `pr-NN-NNN` (pronunciation), `v-NNNN` (vocabulary), `g-NN-NNN` (grammar). Card IDs add the exercise, e.g. `v-0001-rec`. User-made cards start with `u-`.
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

## iPhone test checklists

See [`docs/iphone-checklist.md`](docs/iphone-checklist.md).
