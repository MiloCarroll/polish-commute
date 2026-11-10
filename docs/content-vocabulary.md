# Vocabulary content spec

How `content/vocabulary.json` is written. Read this before adding or fixing items.

## Learner, register and gender

- Complete beginner, English speaker, **male**, learning everyday spoken Polish to talk with his **female** partner and her family.
- Informal *ty* forms by default. Formal *Pan / Pani* only in the "Polite phrases for older relatives" topic (and where clearly useful elsewhere), always marked `"register": "formal"`.
- Anything colloquial is marked `"register": "colloquial"`. Avoid idioms and slang unless very common.
- **Sentences spoken by the learner** use masculine first-person forms (*byłem zmęczony*, *chciałbym*). **Sentences addressed to the partner** use feminine "you" forms (*byłaś*, *jesteś zmęczona?*). In lines the **partner** says, she uses feminine first-person forms and addresses him with masculine ones.
- A Settings switch can change both genders, so **every sentence whose wording depends on the speaker's or listener's gender must be written in all four variants** (see `v` below).
- Variants only cover the speaker and the listener. Avoid sentences that *mention* the partner in the third person (*moja dziewczyna*, *mój chłopak*, *moja żona*), because they depend on the partner's gender even when she isn't the listener. Use examples about other people instead, and explain "my girlfriend / my boyfriend" in the item's `note`.

## Accuracy rules (mandatory: no native speaker reviews this)

- Standard, common, textbook-correct Polish. Short sentences (about 3–8 words), natural everyday phrasing.
- **Verify** every noun's gender and every case form you use, and every verb's conjugation and aspect pair, against Wiktionary (https://en.wiktionary.org/wiki/<word>, Polish section, has inflection tables) when you have web access. If you can't verify something, choose a simpler word or sentence you are certain of.
- Check after every preposition and negation that the case is right (e.g. *nie mam czasu* genitive, *do domu* genitive, *w domu* locative, *mam brata* accusative = genitive for masculine animate).
- Check aspect (imperfective for habits/ongoing, perfective for one completed action), and past-tense gender endings.
- Double-check diacritics.
- All sentences original. Do not copy from textbooks, courses or apps.

## Item shape

```json
{
  "id": "v-0401",
  "pl": "mama",
  "en": "mum",
  "pos": "noun",
  "gender": "f",
  "rank": 40,
  "register": null,
  "alts": [],
  "prodHint": null,
  "note": null,
  "cards": ["rec", "prod", "gap"],
  "examples": [
    { "pl": "Mama jest w domu.", "en": "Mum is at home.", "gap": "Mama" }
  ]
}
```

| field | required | meaning |
|---|---|---|
| `id` | yes | `v-` + 4 digits, from your topic's ID block (below). Permanent. |
| `pl` | yes | Dictionary form: nouns nominative singular, verbs infinitive, adjectives masculine nominative singular, or a fixed phrase. Lower case unless it must be capitalised. |
| `en` | yes | Short English meaning. Several senses separated by `;`. |
| `pos` | yes | One of `noun`, `verb`, `adjective`, `adverb`, `pronoun`, `numeral`, `preposition`, `conjunction`, `particle`, `interjection`, `phrase`. |
| `gender` | nouns | `m`, `f`, `n`, or `mpl` / `npl` for plural-only nouns (e.g. *drzwi* is `npl`, *rodzice* is `mpl`). |
| `aspectPair` | verbs | The other aspect's infinitive (e.g. *robić* → `"zrobić"`), or `null` if there is no common pair. Also add `"aspect": "impf"` or `"pf"`. |
| `forms` | core verbs | Present tense: `{"ja": "jestem", "ty": "jesteś", "on": "jest", "my": "jesteśmy", "wy": "jesteście", "oni": "są"}`. Required for the verbs in the core verbs topic; optional elsewhere. (For perfective verbs, these are future forms; avoid giving `forms` for perfective verbs.) |
| `rank` | yes | Approximate frequency rank in everyday speech (1 = most common), roughly 1–3000. A rough estimate is fine. |
| `register` | no | `"formal"`, `"colloquial"`, or leave out. |
| `alts` | no | Other Polish answers accepted when typing this item from English (e.g. for *cześć*: `["hej"]` only if "hej" is a real accepted answer for the same English). Also add the feminine form for adjectives (*zmęczony* → `["zmęczona"]`). |
| `prodHint` | when needed | A short hint shown on the English → Polish card when the English is ambiguous, e.g. `"informal"`, `"to a woman"`, `"the one you say when handing something over"`. |
| `note` | no | One short helpful line shown on reveal (usage, register, a memory aid). Plain English. |
| `cards` | yes | Which exercises this item gets (see below). |
| `examples` | yes | 1 or 2 example sentences. |

### Exercises (`cards`)

- `rec` (Polish → English, self-graded): **every item**.
- `prod` (English → Polish, typed): **every item** except a few where typing makes no sense. Unlocks after the recognition card's first success.
- `gap` (sentence with the word missing, typed): about half the items. Needs at least one example with a `gap`.
- `listen` (hear the first example sentence, no text, then reveal and self-grade): about a third of the items, preferring useful whole phrases and sentences.

### Examples

Plain example:
```json
{ "pl": "Mama jest w domu.", "en": "Mum is at home.", "gap": "Mama" }
```

- `gap` (optional) is the exact word or words in `pl` that the learner must type: a whole word (or adjacent words), appearing exactly once, usually an inflected form of the item. The app shows the item's dictionary form as a hint when the gap form differs.
- `gapAlts` (optional): other forms that also fit the gap correctly.

Gender-dependent example (any sentence whose wording changes with the speaker's or listener's gender):
```json
{
  "speaker": "learner",
  "v": {
    "mf": { "pl": "Byłem zmęczony, a ty?", "en": "I was tired, and you?", "gap": "zmęczony" },
    "mm": { "pl": "Byłem zmęczony, a ty?", "en": "I was tired, and you?", "gap": "zmęczony" },
    "ff": { "pl": "Byłam zmęczona, a ty?", "en": "I was tired, and you?", "gap": "zmęczona" },
    "fm": { "pl": "Byłam zmęczona, a ty?", "en": "I was tired, and you?", "gap": "zmęczona" }
  }
}
```

- Keys are **speaker gender + listener gender**: `mf` = male speaker to female listener. All four keys are required, even if two are identical.
- `speaker`: `"learner"` (default) or `"partner"`. For `"partner"`, the speaker is the partner and the listener is the learner. With the default settings (learner male, partner female) a learner line uses `mf` and a partner line uses `fm`.
- Examples whose wording does not depend on gender (most of them) use the plain shape.

## Topics, ID blocks and targets

| topic id | title | IDs | items |
|---|---|---|---|
| v-greetings | Greetings, goodbyes, thanks, apologies | keep v-0001 to v-0006; new from v-0101 | 25 |
| v-yesno | Yes, no and conversation fillers (*no*, *wiesz*, *chyba*, *właśnie*) | keep v-0007, v-0008; new from v-0201 | 22 |
| v-affection | Terms of affection (*kochanie*, *skarbie*) | v-0301… | 15 |
| v-family | Family members and in-laws | v-0401… | 30 |
| v-feelings | Feelings and how you are | v-0501… | 25 |
| v-home | Home and daily routine | v-0601… | 30 |
| v-food | Food, meals and cooking | v-0701… | 35 |
| v-time | Time, days and making plans | v-0801… | 30 |
| v-questions | Question words | v-0901… | 15 |
| v-verbs | Core verbs (*być, mieć, chcieć, iść/jechać, robić, lubić, wiedzieć/znać, móc, musieć*) and their present-tense forms | v-1001… | 35 |
| v-numbers | Numbers 1–20 | v-1101… | 20 |
| v-formal | Polite phrases for older relatives (formal) | v-1201… | 18 |

Within each topic, order items from most to least useful for family and couple conversation (the app introduces them in this order). Number IDs in that order. Prefer words met in earlier topics in example sentences. Vocative forms of affection terms (*kochanie*, *skarbie*, *misiu*) can be the item itself when that's how they're used; note the base form in `note`.

## Topic shape

```json
{ "id": "v-family", "title": "Family members and in-laws", "items": [ ... ] }
```

## Batch 2 topics (family life)

| topic id | title | IDs | items |
|---|---|---|---|
| v-health | Health and how people feel physically | v-1301… | 30 |
| v-weather | Weather and seasons | v-1401… | 25 |
| v-work | Work and studies (incl. talking about a PhD) | v-1501… | 30 |
| v-hobbies | Free time and hobbies | v-1601… | 30 |
| v-holidays | Holidays, celebrations and traditions | v-1701… | 30 |
| v-table | At the table: manners and phrases | v-1801… | 25 |

Avoid repeating words that already exist in `content/vocabulary.json` (check before adding); use them freely in examples.
