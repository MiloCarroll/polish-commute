# Grammar content spec

How `content/grammar.json` is written. Read this before adding or fixing drills.

## Learner, register and gender

Same rules as `docs/content-vocabulary.md`:
- Complete beginner, English speaker, **male**, talking with his **female** partner and her family. Informal *ty* by default; formal *Pan/Pani* only where useful, and say so.
- **Learner's own sentences** use masculine forms (*byłem*, *zmęczony*). **Sentences addressed to the partner** use feminine "you" forms (*byłaś*, *jesteś zmęczona?*). **Partner's own lines** use feminine first person and address him with masculine forms.
- Every sentence whose wording depends on the speaker's or listener's gender is written in **all four variants** (`v`, keys = speaker gender + listener gender). Avoid sentences that mention the partner in the third person (*moja dziewczyna*).
- Use vocabulary the learner has already met where possible: see the words in `content/vocabulary.json`.

## Accuracy rules (mandatory: no native speaker reviews this)

- Standard, textbook-correct, natural everyday Polish. Short sentences (3–8 words).
- Verify noun genders, case forms and verb conjugations on Wiktionary (https://en.wiktionary.org/wiki/<word>, Polish section) when you have web access; if you can't verify something, use something simpler you're certain of.
- Check agreement, case after prepositions, negation and numbers, aspect, gendered past-tense forms and diacritics.
- Explanations: plain English, accurate, honest about exceptions without drowning a beginner. All text original (not copied from textbooks or websites).

## Topic shape

```json
{
  "id": "g-05",
  "title": "Negation and the genitive",
  "lesson": {
    "summary": "One sentence: what this topic teaches.",
    "body": [
      "One or two short paragraphs of plain English. Polish words in {{double braces}} become tap-to-hear."
    ],
    "table": {
      "caption": "optional caption",
      "head": ["Positive", "Negative"],
      "rows": [["Mam {{czas}}.", "Nie mam {{czasu}}."]]
    },
    "more": ["Optional extra paragraphs, collapsed under 'More detail'."]
  },
  "items": [ ... ]
}
```

- `table` is optional: include one only where it truly helps (a small grid, at most about 6 rows and 4 columns). Cells may contain `{{Polish}}`.
- Keep `body` to one or two paragraphs. Put nuance and exceptions in `more`.

## Drill item shape

```json
{
  "id": "g-05-001",
  "type": "choose",
  "pl": "Nie mam czasu.",
  "en": "I don't have time.",
  "gap": "czasu",
  "hint": "czas",
  "options": ["czas", "czasu", "czasem"],
  "alts": [],
  "reason": "After a negated verb the object goes into the genitive: czas → czasu."
}
```

| field | meaning |
|---|---|
| `id` | `g-<topic 2 digits>-<3 digits>`, numbered from 001 in order. Permanent once released. This is also the card ID. |
| `type` | `"choose"` (pick from options) or `"type"` (type the answer). **All `choose` items come first in a topic, then `type` items** (roughly the first 40% choose). |
| `pl` | The full correct sentence. |
| `en` | Natural English translation. |
| `gap` | The exact word(s) in `pl` the learner must supply: whole word(s), appearing exactly once. |
| `hint` | The base form shown in brackets after the gap, e.g. `(czas)`. Use the dictionary form, or the infinitive for verbs, or the pronoun/subject for forms of być. Leave out only if the answer is obvious from the task. |
| `options` | `choose` only: 3 or 4 different strings, exactly one of which is `gap`. Distractors should be real, plausible forms (other cases, other persons, the other gender), not nonsense. |
| `alts` | Other answers that are also fully correct in this sentence (e.g. word order or a synonym form). |
| `reason` | One line shown after a wrong answer: why this form, in plain English. |
| `prompt` | Optional instruction replacing the default "Fill the gap", e.g. "Make it negative". |

Gender-dependent items use `v` with all four variants; each variant carries its own `pl`, `en`, `gap`, and where they differ `hint`, `options`, `reason`:

```json
{
  "id": "g-08-004",
  "type": "type",
  "speaker": "learner",
  "v": {
    "mf": { "pl": "Wczoraj byłem w domu.", "en": "Yesterday I was at home.", "gap": "byłem", "hint": "być", "reason": "A man says byłem (I was)." },
    "mm": { "pl": "Wczoraj byłem w domu.", "en": "Yesterday I was at home.", "gap": "byłem", "hint": "być", "reason": "A man says byłem (I was)." },
    "ff": { "pl": "Wczoraj byłam w domu.", "en": "Yesterday I was at home.", "gap": "byłam", "hint": "być", "reason": "A woman says byłam (I was)." },
    "fm": { "pl": "Wczoraj byłam w domu.", "en": "Yesterday I was at home.", "gap": "byłam", "hint": "być", "reason": "A woman says byłam (I was)." }
  }
}
```

`speaker` is `"learner"` (default) or `"partner"`; the listener is the other person.

## Topics and targets

| id | title | focus |
|---|---|---|
| g-01 | Być and personal pronouns | jestem, jesteś, jest, jesteśmy, jesteście, są; pronouns ja, ty, on, ona, ono, my, wy, oni, one; dropping the pronoun (*jestem* not *ja jestem*) and when to keep it (contrast/emphasis). |
| g-02 | Noun gender from word endings | consonant → masculine, -a → feminine, -o/-e/-ę/-um → neuter; common exceptions (*mężczyzna*, *tata*, men's names in -a; *noc*, *mysz*, *kość*, *rzecz*, *wieś* feminine). Drills: *mój/moja/moje*, *ten/ta/to*, adjective ending with a noun. |
| g-03 | Present-tense conjugation groups | -am/-asz (*mam, czytam, znam*), -ę/-esz (*piszę, idę, jadę, piję*), -ę/-isz/-ysz (*mówię, robię, lubię, słyszę*); ja/ty/on most, then my/wy/oni. |
| g-04 | Accusative after mam, lubię, chcę, widzę | feminine -a → -ę (*kawa → kawę*), masculine animate = genitive (*brat → brata*, *pies → psa*), masculine inanimate and neuter unchanged (*mam dom*, *lubię piwo*). |
| g-05 | Negation and the genitive | *nie mam czasu*, *nie lubię kawy*, *nie ma chleba*, *nie widzę brata*; *nie ma* = "there isn't". Verbs that take other cases keep them (*nie jestem* + instrumental is out of scope; avoid). |
| g-06 | Adjective agreement in the nominative | -y/-i (masc.), -a (fem.), -e (neuter, and plural non-masculine-personal); *dobry dom*, *dobra kawa*, *dobre piwo*; *jestem zmęczony / jesteś zmęczona* with gender variants. Keep to nominative singular (plural only lightly in `more`). |
| g-07 | Questions and question words | *czy* yes/no questions, *co, kto, gdzie, kiedy, jak, dlaczego, ile*; word order; intonation-only questions. Drills: choose the question word that fits the answer/English. |
| g-08 | Past tense: "I was", "you were" | emphasise masculine "I" (-łem: *byłem, miałem, robiłem*) and feminine "you" (-łaś: *byłaś, miałaś, robiłaś*); 3rd person *był/była*; formation from the infinitive (*robić → robił-*); *-ąć* and irregular stems only if certain (*iść → szedłem/szłaś*, *jeść → jadłem*). Heavy use of all four variants. |

Each topic: **25–40 drills**.
