# Clara pronunciation-content standard

Every learner-facing pronunciation string — `ipa`, `hint`/`mouthHint`, lesson
intros, and the Spanish hint layer (`lib/content/es.ts`) — follows these rules.
They exist because the app shipped hints that taught the exact transfer errors
the sound track corrects ("zank you", "jelp-mi"), and British IPA in an
American-English product. `lib/content/content-lint.test.mjs` enforces the
mechanical parts.

## 1. The variety is General American, everywhere

- IPA follows General American as transcribed by Merriam-Webster / American
  dictionaries, adapted to the app's existing symbol set.
- Never use British-only symbols: **/ɒ/** (write /ɑː/ for LOT words: *stop,
  want, honest, sorry, problem, not*), or the centring diphthongs /ɪə eə ʊə/
  (write /ɪr, ɛr~er, ʊr/: *hear* /hɪr/, *hair* /hɛr/, *tour* /tʊr/).
- CLOTH-set words before /ŋ f s θ/ keep /ɔː/ where GenAm does: *wrong* /rɔːŋ/,
  *offer* /ˈɔːfər/, *long, cost, call*.
- *was* is /wʌz/, *because* is /bɪˈkʌz/.
- Post-vocalic r is always pronounced (rhotic): /ɑːr, ɔːr, ər, ɜːr/.
- Flap t may be shown in hints ("wa-der") because it is a target feature of
  American English — that is a correct-sound respelling, not an error.

## 2. Respelling rules (hints)

Respellings written with Spanish orthography are allowed — they are the
bridge for an A1 Colombian reader — **except** where Spanish orthography
would prescribe the wrong sound. For those sounds, keep the English letters
and add an articulatory cue:

| English sound | Never write | Write instead | Cue (Spanish) |
|---|---|---|---|
| /θ/ /ð/ (think, this) | z, s, t, d ("zank") | `th` | "lengua entre los dientes y sopla" |
| /h/ (help, how) | Spanish j ("jelp", "jau") | `h` | "h soplada / un soplido suave, nunca una j fuerte" |
| /dʒ/ (job, just) | y | `dy` ("dyob") | "j dura y vibrante" |
| /ʃ/ (she, show) | ch | `sh` | "shhh de silencio" |
| /v/ (very) | b | `v` | "labio y dientes, con vibración" |
| initial s-cluster (speak) | es- ("espík") | `s` ("spik") | "sin e antes de la s" |

Rationale for /h/: many Colombian dialects realize j as a soft [h], so "jelp"
can *sound* harmless locally — but the app's own `h` lesson teaches that
English h is a breath, not a jota, and the respelling contradicts it (and
misteaches any non-Colombian reader). Write `h` and say it's a soplido.

## 3. Corrective contrasts

Naming the typical error is allowed and encouraged — as a **negated
contrast**, never as the prescription:

- Good: "'think': lengua entre los dientes y sopla — nunca t ni s."
- Bad: "'think' = 'zink'." (prescribes the error)

The content lint bans the known error-respellings outright, so put the error
word in plain letters ("no digas 'tink'") rather than inventing new
respellings of the error.

## 4. Other rules

- Stress is marked in respellings with CAPITALS on the stressed syllable
  ("hau-MACH-i-sit") and with /ˈ/ in IPA. They must agree.
- Linking/reduction cues ("se junta", "se relaja") are core to the course —
  keep them, subject to the tables above.
- No abandoned edits, self-corrections ("... no,"), or TODO notes in any
  learner-visible string (lint-enforced).
- The learner's name never appears in content. Use the `{name}` token,
  resolved by `lib/personalize.ts`; drill items that need a fixed name use the
  curriculum character **Ana** (audio must be regenerated whenever such an
  item's text changes — clips are keyed by item id, not text, so stale audio
  will not fail loudly; `scripts/generate-audio.mjs` + `generate-es-audio.mjs`
  after deleting the item's clips).
- When adding new content: run `node lib/content/content-lint.test.mjs`, and
  verify any transcription you are not sure of against Merriam-Webster
  (https://www.merriam-webster.com/) before shipping — plausible-sounding
  IPA is how the British vowels got in.
