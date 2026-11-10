# Conversations (dialogues) content spec

How `content/dialogues.json` is written. Read `docs/content-vocabulary.md` first: the learner, register, gender and accuracy rules there apply here too.

## Purpose

Short, realistic conversations for the situations the learner actually meets with his partner and her family: everyday spoken Polish, informal *ty* between the couple and with siblings, formal *Pan/Pani* (or *proszę Pana/Pani*, *Państwo*) with her parents and grandparents unless a scene explicitly has them offer *ty* (*Mów mi Krysia*).

Each line becomes cards:
- **listen** (every line): hear the line, think of the meaning, reveal text and translation, grade yourself.
- **say** (the learner's own lines only): see the English, say the line in your head, reveal, grade yourself.

## Topic (= one dialogue) shape

```json
{
  "id": "d-01",
  "title": "Meeting her parents",
  "lesson": {
    "summary": "One sentence setting the scene.",
    "body": ["One short paragraph: who is there, where, and one or two things to notice. Polish in {{double braces}} is tap-to-hear."],
    "more": ["Optional cultural or usage notes, collapsed."]
  },
  "cast": {
    "mama": { "name": "Her mum", "gender": "f" },
    "tata": { "name": "Her dad", "gender": "m" }
  },
  "items": [ ...lines in order... ]
}
```

- `cast` lists everyone except the learner and his partner, with a fixed `gender`. Cast keys: lower case letters only.
- 6–10 lines per dialogue. Lines are in speaking order.

## Line shape

```json
{ "id": "d-01-001", "who": "tata", "to": "learner", "pl": "Dzień dobry, miło Pana poznać.", "en": "Hello, nice to meet you.", "note": null }
```

- `id`: `d-<dialogue 2 digits>-<3 digits>`, numbered from 001. Permanent once released.
- `who`: `learner`, `partner`, or a cast key. `to`: who is addressed (same values, or `all` for a group).
- If the wording depends on the gender of the speaker or of the person addressed (when either is the learner or the partner, whose genders can change in Settings), give all reachable variants in `v` instead of `pl`/`en`:

```json
{ "id": "d-01-004", "who": "mama", "to": "learner",
  "v": {
    "fm": { "pl": "Jesteś głodny?", "en": "Are you hungry?" },
    "ff": { "pl": "Jesteś głodna?", "en": "Are you hungry?" }
  } }
```

  Keys are **speaker gender + listener gender**. Only the reachable keys are needed: a cast member's gender is fixed, the learner's and partner's can be either. So mama → learner needs `fm` and `ff`; learner → partner needs all four; learner → mama needs `mf` and `ff`. `to: "all"` counts as having no listener gender: use keys like `m-` and `f-` (speaker gender then a hyphen).
- `note`: optional one-liner shown on reveal (register, a cultural point, what a phrase literally means).

## Accuracy

Same as vocabulary: textbook-correct, natural, short lines (3–12 words); verify case forms, conjugations, Pan/Pani agreement (3rd person verbs; *Pana/Pani/Panu/Panią* in the right case) and gendered forms in every variant. Use words from `content/vocabulary.json` where possible; new words are fine if common. Original text only.

## Dialogues (version 1)

| id | title | notes |
|---|---|---|
| d-01 | Meeting her parents | at their door; greetings, introductions, flowers/gift, formal address |
| d-02 | Dinner at her parents' | *Smacznego*, compliments on the food, *poproszę jeszcze*, *dziękuję, jestem najedzony* |
| d-03 | Phone call with her mum | short call: how are you, plans for the weekend, passing on greetings (*pozdrów*) |
| d-04 | Morning at home | couple: coffee, sleep, plans for the day, *kochanie* |
| d-05 | Making plans for the weekend | couple: where to go, what time, *może…?*, agreeing and suggesting |
| d-06 | Her brother or sister | informal with a sibling-in-law-to-be; work, football or hobbies, small talk |
| d-07 | Christmas Eve (Wigilia) | with the family: *opłatek* wishes, *Wesołych Świąt*, dishes, an empty place at the table |
| d-08 | Visiting her grandparents | formal and warm; health, the garden, *proszę usiąść*, a little slower |
