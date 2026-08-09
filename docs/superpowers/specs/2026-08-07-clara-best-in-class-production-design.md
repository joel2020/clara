# Clara best-in-class production design

**Date:** 2026-08-07

**Status:** Approved in conversation; awaiting written-spec review

**Audience:** Adult English learners in Latin America, initially Colombian Spanish speakers

**Product name:** Clara

**Recurring character:** Lumi

## 1. Outcome

Clara becomes a production-ready daily English-learning application that can compete
with leading consumer learning products on clarity, motivation, feedback quality, and
polish without copying their visual identity. The redesign keeps the existing Lumi
anime character, makes her the only recurring student-facing character, expands her
wardrobe through a controlled Higgsfield workflow, simplifies the learner journey, and
makes pronunciation practice a strict, frequent, enjoyable part of normal use.

The release target is a final production audit of at least 9.0/10 with no unresolved
P0 findings. Visual polish alone cannot satisfy this target: security, privacy,
accessibility, reliability, database isolation, device evidence, observability, and
learning-quality gates are part of the product definition.

## 2. Product boundaries

### In scope

- Four primary learner spaces: Hoy, Camino, Hablar, and Yo.
- A single dominant daily mission with a coherent practice sequence.
- Lumi as the only recurring student-facing character and the only dressable figure.
- The six-outfit Lumi City Remix collection and a redesigned Lumi's Closet.
- Strict, versioned pronunciation grading built for common LATAM transfer patterns.
- Daily pronunciation practice, targeted review, and periodic speaking challenges.
- Production blockers identified in the 2026-08-07 audit.
- Evidence-backed release gates for code, deployment, database, and real devices.

### Out of scope

- Copying Duolingo's mascot, path, visual language, sounds, or reward choreography.
- Real-money cosmetics, loot boxes, randomized rewards, or expiring purchases.
- Treating a detectable LATAM accent as failure when speech remains intelligible.
- Retaining multiple competing guides, student avatars, or synthetic recurring humans.
- Storing raw learner audio after assessment.
- Claims that Clara provides an official language certification.

## 3. Experience principles

1. **One next action.** Every primary screen has one visually dominant action.
2. **Frequent speaking.** Every normal daily session contains scored pronunciation.
3. **Strict evidence, supportive delivery.** Clara does not lower the pronunciation
   standard to manufacture wins; it changes scaffolding, not truth.
4. **Intelligibility before imitation.** Meaning-changing sound errors, missing word
   endings, and rhythm problems receive priority. Benign accent variation does not.
5. **Lumi carries emotion.** She reacts, celebrates, models outfits, and encourages.
   Clara is the product voice; Lumi never pretends to be a human teacher.
6. **Rewards follow real effort and mastery.** Practice can preserve a streak, but
   mastery, accuracy bonuses, and premium unlocks require evidence.
7. **Failure is designed.** Microphone denial, provider outage, low scores, offline
   transitions, and sync conflicts have calm, actionable states.
8. **Accessible by default.** Touch, keyboard, screen reader, zoom, contrast, reduced
   motion, and safe-area behavior are release requirements.

## 4. Information architecture

### Hoy

Hoy is the default signed-in destination and replaces competing home/today concepts.
It shows:

- Lumi in the currently equipped outfit.
- A personalized greeting.
- One job- or life-relevant promise for today.
- Estimated duration and one Start action.
- One quiet progress statement and yesterday's win.

It does not show a wall of zeroed metrics, a grid of modes, or store inventory.

### Camino

Camino explains progression: units, sound priorities, stage assessments, job-track
milestones, and what is blocking the next step. Existing drill URLs may remain for deep
links, but they are not primary navigation destinations.

### Hablar

Hablar contains conversation practice: virtual calls, scenarios, duets, and speaking
challenges. The guide identity is Lumi. Clara remains the application's name.

### Yo

Yo contains meaningful progress, streak history, sound profile, settings, privacy,
and the entry to Lumi's Closet. The separate learner avatar and duplicate progress
destinations are removed from the learner-facing information architecture.

### Immersive sessions

Lessons, daily sessions, calls, exams, and placement are full-screen experiences. The
four-tab navigation is hidden while an immersive session is active so recording and
feedback controls cannot compete with the tab bar.

## 5. Daily learning loop

1. **Promise:** Hoy states what the learner will be able to say today and why it matters.
2. **Hear:** the learner distinguishes the day's target from a likely LATAM transfer
   error or minimal-pair neighbor.
3. **Build:** the learner sees meaning, stress, and a concise Spanish articulatory cue.
4. **Speak:** at least three scored utterances are included in the session plan.
5. **Use:** the target appears in a realistic phrase or conversation turn.
6. **Reflect:** Clara shows one success and one next focus.
7. **Return:** the completion screen previews tomorrow's useful situation.

Every daily session includes a pronunciation activity. A weak sound or recent valid
miss outranks generic new content when selecting the speaking target. Technical capture
failures never enter weakness, mastery, reward, or streak calculations.

## 6. Pronunciation system

### 6.1 Goal and fairness

The target is clear General American English that is reliably understood in work and
daily-life situations. Grading is stricter than the current application, but it is not
an accent-erasure system. The engine prioritizes errors that change a word, remove an
important ending, or materially reduce intelligibility.

Adaptive difficulty may change preparation, speed, number of examples, Spanish support,
and hint visibility. It must not lower pronunciation pass thresholds. The existing
`ease` deduction is removed from acoustic pronunciation verdicts.

### 6.2 LATAM priority map

The initial curriculum and diagnosis prioritize:

1. /ɪ/ versus /iː/ and additional English vowel distinctions absent from the five-vowel
   Spanish system, including /ʊ/ versus /uː/, /æ/ versus /ɛ/, and /ʌ/ versus /ɑ/.
2. /b/ versus /v/.
3. /dʒ/ versus /j/ and /ʃ/ versus /tʃ/ where evidence shows confusion.
4. /θ/ and /ð/ versus common substitutions such as /t/, /d/, or /s/.
5. Initial S clusters without an added vowel: speak, stop, street.
6. Final consonants and clusters, including plural and past-tense endings.
7. English /h/ versus a Spanish-style strong jota.
8. Rhotic American /r/, including word-final position.
9. Schwa, vowel reduction, word stress, and sentence rhythm.
10. Connected speech and the American flap as fluency refinements, not early hard-fail
    accent markers.

The map supplies an initial prior, not a permanent stereotype. After valid learner
attempts exist, the individual's measured weak sounds outrank the regional prior.

### 6.3 Assessment evidence

Scripted words and phrases use Azure pronunciation assessment with:

- en-US locale.
- HundredMark grading.
- Phoneme granularity and IPA names.
- Miscue enabled only when reference text exists.
- Prosody enabled for en-US scripted phrases.
- Overall pronunciation, accuracy, fluency, completeness, prosody, word accuracy,
  error type, and phoneme accuracy retained as structured scores.

Unscripted conversation receives diagnostic scores, not a direct mastery verdict. When
Clara identifies a correction, the learner repeats the corrected sentence as a scripted
attempt; that retry is eligible for mastery evidence.

### 6.4 Versioned pass standards

All thresholds live in one pure, versioned policy module. Initial policy `latam-v1`:

| Context | Required evidence |
|---|---|
| Target word | Pronunciation score >= 82, target phoneme >= 75, no minimal-pair substitution, and target recognized |
| Daily target phrase | Pronunciation and accuracy >= 78, completeness >= 90, and no target-word score below 70 |
| Phrase prosody, A0-A1 | Diagnostic only; never the sole reason for failure |
| Phrase prosody, A2+ | Prosody >= 65, unless unavailable from the provider |
| Stage assessment | Pronunciation and accuracy >= 85, completeness >= 95, target phoneme >= 80, and prosody >= 70 for A2+ |
| Free conversation | No binary pass; lowest-confidence word or sound becomes a scripted retry target |

Provider absence never becomes a zero score. An assessment is `valid`, `technical-skip`,
or `unavailable`; only valid evidence can pass or fail.

Thresholds are calibrated before broad rollout using at least 30 recordings from at
least six LATAM adult speakers, independently rated for intelligibility and target-sound
accuracy by the instructor. Calibration may adjust numeric thresholds, but must be
recorded as a new policy version with boundary tests and a dated rationale.

### 6.5 Three-attempt coaching loop

Each targeted item allows up to three valid attempts:

1. **Attempt one:** normal target audio and concise prompt.
2. **Attempt two:** highlight the lowest-scoring word/phoneme, show one Spanish mouth
   cue, play slow and normal audio, and contrast the likely substitution.
3. **Attempt three:** use a short rhythm or minimal-pair challenge and show progress
   relative to the learner's own first attempt.

If the third valid attempt still fails, the activity completes as
`practiced-not-mastered`. The learner keeps daily-session continuity and earns 25% of
base practice XP, but earns no mastery stars, combo bonus, or SRS pass. The item is due
the next local day and remains visible as a current focus. A failed pronunciation item
never blocks the rest of a normal daily session.

Stage assessments remain gated and cannot be passed through attempt exhaustion.

### 6.6 Practice formats

- **Beat the Twin:** choose and pronounce the correct minimal pair before the distractor
  reaches Lumi.
- **Sound Sprint:** three short target utterances with immediate sound-level feedback.
- **Echo Chain:** copy stress and rhythm across progressively longer chunks.
- **Call Rescue:** repair one misunderstood word from a realistic call.
- **Weekly Sound Boss:** use the learner's three weakest high-impact sounds in a short
  scenario; this is evidence-backed practice, not an arbitrary difficulty spike.

Lumi celebrates effort after a genuine retry and mastery after a valid pass. Her
reactions never obscure the target text, microphone, or correction.

### 6.7 Feedback anatomy

Every pronunciation result uses the same hierarchy:

1. What Clara heard.
2. Whether the message was clear.
3. The one sound or word to fix now.
4. A physical articulation cue in the learner's support language.
5. Listen slowly, listen normally, and try again.

Raw scores are available in detail views, but the primary state is Clear, Almost, or
Try again. Color is always paired with text and an icon. Feedback never says an accent
is bad or claims that one provider score is a clinical or official judgment.

### 6.8 Pronunciation data

No raw audio is retained after assessment. The attempt record adds only structured,
bounded evidence needed for learning and calibration:

- Assessment policy version and provider status.
- Pronunciation, accuracy, fluency, completeness, and prosody scores when available.
- Target phoneme score, weakest phoneme, and weakest word.
- Attempt ordinal and outcome: mastered, practiced-not-mastered, or technical-skip.

Analytics receive bounded categories and numbers only, never raw audio, email, or
unrestricted transcripts. New cloud fields use an additive migration and retain
per-user RLS.

## 7. Character identity

- **Clara** is the application and its editorial voice.
- **Lumi** is the only recurring student-facing character.
- Lumi remains the existing anime character: her face, hair, skin tone, body
  proportions, line treatment, and personality are not redesigned.
- Lumi encourages, reacts, and models clothing. She is transparent that she is an AI
  practice companion and never claims to be a human instructor.
- Joel media, the separate learner avatar, pet characters, and legacy Clara character
  renders are removed from learner-facing routes. Assets may remain temporarily during
  migration but are not reachable in the finished experience.
- Scenario extras are non-recurring and serve the exercise rather than becoming guides.

The virtual-call system prompt, scenario openings, consent copy, and visible labels all
use Lumi consistently. No learner-facing scenario may introduce the guide as Clara.

## 8. Lumi City Remix

The first approved collection contains:

| ID | Display name | Visual brief | Unlock |
|---|---|---|---|
| `cancha-chic` | Cancha Chic | Oversized blue football jersey, white pleated skort, red sneakers, compact crossbody | 140 stars |
| `club-lectura` | Club de Lectura | Ivory blouse, navy knit vest, plaid skirt, loafers, crew socks | 160 stars |
| `nuevo-romance` | Nuevo Romance | Soft-pink ruffled top, dark denim midi skirt, ballet flats, ribbon detail | 180 stars |
| `moto-rosa` | Moto Rosa | Cropped cherry racing jacket, black wide-leg jeans, statement sneakers | Level 5 and 200 stars |
| `retro-86` | Retro 86 | Cobalt windbreaker, high-waisted relaxed trousers, bright accessories, vintage sneakers | Seven completed daily sessions; sessions need not be consecutive |
| `la-jefa` | La Jefa | Tailored waistcoat, wide-leg trousers, fitted shirt, polished shoes | First passed interview/call milestone |

Colombian identity appears through subtle color and naming, never costume, flags as
clothing, or cultural cliché.

### 8.1 Higgsfield production workflow

1. Upload the approved current base Lumi image to the selected Higgsfield workspace.
2. Create a reusable character reference element named `lumi-clara-app`.
3. Use GPT Image 2 through Higgsfield at 2K high quality and 3:4 ratio. It supports
   reference-element injection and instruction-based editing suitable for this raster
   character system. Do not use the realistic Soul model for production Lumi art.
4. For each output, combine the reusable Lumi element with the matching existing pose
   reference. Prompts change clothing only and explicitly lock face, hair, skin tone,
   proportions, pose, lighting, line style, and transparent background.
5. Generate one Cancha Chic idle test and perform visual, transparency, dimensions,
   likeness, and store-stage fit checks before any batch.
6. After the test passes, generate the existing seven-pose contract for each outfit:
   idle, cheer, think, encourage, clap, point, and love.
7. Remove backgrounds if needed, crop to the existing safe canvas, optimize to WebP or
   PNG within the existing component contract, and record prompt, model, settings,
   generation ID, cost, and rejection reason.
8. Reject outputs with face drift, hair drift, skin-tone change, anatomy artifacts,
   pose mismatch, missing limbs, baked text, logos, opaque backgrounds, or inconsistent
   light direction. “Close enough” does not ship.

Every generation batch receives a credit estimate first. The six outfits require 42
accepted pose images; rejected candidates do not enter the repository.

## 9. Lumi's Closet

The store is renamed **El clóset de Lumi · Lumi's Closet** and focuses on one large
try-on stage.

- Outfit cards show available, locked, owned, or equipped with text and icon.
- Selecting a card previews the outfit immediately without purchasing it.
- Purchase confirmation shows price, current balance, and balance after purchase.
- Equipped changes save locally first and sync through the existing outbox.
- A failed sync keeps the local choice and shows a retryable queued state.
- No purchase can make the balance negative or double-spend on repeated submission.
- Earned milestone outfits cannot be bought early.
- Previously owned items remain owned if later eligibility rules change.
- The Closet is entered from Yo or an earned-outfit preview, not primary navigation.

The separate `avatar-outfit`, cap, and pet presentation is removed from the learner
store. Background/effect inventory may remain only when it supports Lumi's stage and
meets the same visual-quality and accessibility rules.

## 10. Motion and sound

- Interaction motion is 150-300ms and communicates press, save, unlock, retry, or state
  transition.
- Lumi may use the existing finite reaction poses; no perpetual floating or distracting
  idle loop appears beside reading or recording controls.
- Reduced-motion mode preserves every state as a clear still.
- Success sound is brief and reserved for valid mastery or meaningful unlocks.
- Failure uses no punitive buzzer. A soft reset cue may accompany a retry.
- Browser vibration, when supported, is optional and restricted to meaningful
  confirmations.

## 11. Production hardening

### Dependencies and CI

- Resolve the current 9 high and 1 moderate production dependency findings.
- Add a production dependency audit or equivalent maintained scanner to CI.
- Pin one supported Node version across local development, CI, and Vercel.
- Configure the correct Next/Turbopack workspace root.

### Privacy and consent

- Rewrite voice consent and privacy copy to state that a virtual call automatically
  opens the microphone for the learner's turn after the guide finishes.
- Explain stop, mute, provider processing, retention, transcript use, and deletion.
- Keep raw audio ephemeral and never use it for unrelated analytics.

### Authentication and cost controls

- Choose and enforce one access model. This design uses invite-only access until public
  beta readiness: the server-side allowlist protects learner entry and paid routes.
- Add per-user quotas and a shared/global rate limit before public enrollment.
- Make login copy, `/api/me`, guards, environment variables, tests, and operations
  documentation describe the same model.

### Browser protections

- Add and test Content Security Policy, `frame-ancestors`, Referrer Policy, Permissions
  Policy including microphone scope, HSTS where appropriate, and MIME protections.
- Permit only the required Supabase, Azure, OpenAI, ElevenLabs, media, and application
  origins.

### Accessibility

- Replace custom modal behavior with accessible focus-managed dialogs.
- Repair visible/programmatic labels, keyboard dismissal, focus restoration, inert
  backgrounds, and live announcements.
- Keep touch targets at least 44 by 44 CSS pixels and allow browser zoom.
- Pass automated axe checks and a manual VoiceOver/keyboard journey.

### Supabase and recovery

- Reconnect the Clara Supabase project and run current security/performance advisors.
- Verify account isolation with two real test users and owner-only access where intended.
- Enable leaked-password protection.
- Maintain one authoritative, tested database restore path based on the current schema;
  historical permissive files cannot appear in default rebuild instructions.
- Remove hardcoded duplicated admin-email authorization from RLS in favor of one durable
  role or admin source.

### Observability

- Add scrubbed error reporting with source maps.
- Alert on uptime, authentication failure, speech-provider errors/latency, sync failure,
  and unusual AI/speech cost.
- Define SLOs for sign-in, daily-session completion, pronunciation response, and sync.

### Trust surface

- Use a branded HTTPS domain.
- Publish formal privacy, terms, contact, retention, and account-deletion procedures.
- Keep the product restricted to adults unless a separate child-safety/legal review is
  completed.

## 12. Failure behavior

| Failure | Learner behavior | Evidence behavior |
|---|---|---|
| Microphone denied | Explain how to enable it; allow listening practice | No failed attempt written |
| No speech captured | Invite a retry without blame | No failed attempt written |
| Assessment provider unavailable | Allow technical skip or transcript-only ungraded practice | `technical-skip`; no mastery/failure |
| Low valid score | Give one targeted cue and next attempt | Valid miss; affects weak-sound queue |
| Third valid miss | Continue session, schedule next-day review | Practiced-not-mastered; 25% base XP |
| Offline during practice | Continue cached/local practice where possible | Queue writes; assessment requiring provider is unavailable |
| Sync conflict | Keep completed evidence and prevent duplicate reward | Deterministic merge and idempotent reward |
| Cosmetic purchase request repeated | Return existing ownership/purchase outcome | No double charge |

## 13. Architecture boundaries

- `pronunciation-policy`: pure versioned thresholds and verdicts; no UI, network, clock,
  or storage reads.
- `pronunciation-diagnosis`: maps provider word/phoneme evidence to one pedagogical
  correction using the LATAM prior plus personal history.
- `pronunciation-session`: owns the three-attempt state machine and reward outcome.
- `assessment adapter`: maps Azure responses to provider-independent internal evidence.
- `daily composer`: guarantees a speaking target and ranks individual weakness over the
  regional prior.
- `character manifest`: owns Lumi identity, pose contract, outfit assets, and alt rules.
- `closet catalog`: owns prices and unlock conditions; pure store state quotes actions.
- UI components render these modules but cannot invent grading, rewards, or ownership.

## 14. Verification strategy

### Automated

- Boundary tests for every `latam-v1` threshold.
- Proof that acoustic grading ignores adaptive ease.
- Target-phoneme and minimal-pair substitution tests.
- Three valid misses produce practiced-not-mastered, no stars, 25% XP, and next-day due.
- Technical failures produce no miss, weakness, mastery, reward, or streak damage.
- A2+ prosody rules and A0-A1 diagnostic-only behavior.
- Daily composition always contains scored speaking.
- Personal evidence outranks LATAM prior after sufficient valid history.
- Content lint for every priority contrast, General American IPA, Spanish cues, and
  prohibited harmful respellings.
- Character manifest tests for 6 outfits times 7 poses, canvas contract, and missing
  files.
- Store tests for price, level, session, and milestone unlocks; ownership precedence;
  idempotent purchase; and non-negative balance.
- Accessibility component tests for dialog names, focus, Escape, and keyboard actions.
- Auth, origin, quota, headers, privacy, RLS schema, and recovery checks.
- Typecheck, zero-error lint ratchet, complete unit suite, and optimized production build.
- Production dependency audit with zero unaccepted high or critical findings.

### Human and device

- Instructor-rated threshold calibration set: at least 30 recordings, six LATAM adults.
- Current iPhone Safari and installed PWA.
- Older Android Chrome device.
- Desktop Chrome, Safari, and Firefox.
- VoiceOver and keyboard-only core journey.
- Sign-in, onboarding, daily session, three-attempt pronunciation loop, virtual call,
  microphone denial/recovery, offline/reconnect, reward, Closet purchase/equip, push,
  and cross-device continuation.
- Two-account Supabase isolation and a restore rehearsal.

Every manual check records date, device/browser version, account role, expected result,
actual result, screenshot or log evidence, and owner.

## 15. Rollout

1. **Foundation:** dependency fixes, identity/consent correction, access consistency,
   security headers, and pronunciation policy tests.
2. **Pronunciation:** provider adapter, strict verdicts, three-attempt coaching, daily
   cadence, feedback UI, migration, and calibration.
3. **Experience:** four-space navigation, Hoy simplification, immersive shells, Lumi-only
   identity, and accessible feedback/dialog patterns.
4. **Assets and store:** one Higgsfield test, approved six-outfit batch, manifest,
   Lumi's Closet, unlocks, and economy verification.
5. **Operations:** Supabase verification, observability, recovery, trust surface, and
   device/cross-device evidence.
6. **Release:** healthy Vercel production deployment, full completion audit, pilot, and
   final score at or above 9.0/10 with no P0 findings.

## 16. Definition of done

This project is complete only when:

- The approved learner experience and all six Lumi outfits are live in production.
- Lumi is the only recurring student-facing character and is named consistently.
- Every daily session includes strict pronunciation practice and the approved
  three-attempt behavior.
- The pronunciation policy has human-calibration evidence and passes boundary tests.
- All production-hardening requirements in section 11 are implemented and verified.
- Typecheck, lint, tests, build, dependency gate, accessibility checks, and real-device
  journeys pass on the release commit.
- Vercel is healthy, current Supabase policies/advisors are verified, cross-account
  isolation is proven, and restore evidence exists.
- The final audit scores Clara at least 9.0/10 and lists no unresolved P0 issue.
