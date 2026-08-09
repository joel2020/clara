# Strict LATAM Pronunciation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make strict, supportive pronunciation practice a scored part of every daily Clara session for adult LATAM English learners.

**Architecture:** Azure responses are normalized into provider-independent evidence. Three pure modules own thresholds, diagnosis, and attempt progression; UI, daily composition, exams, and virtual calls consume their verdicts without recalculating scores. Structured evidence syncs through an additive per-user migration while raw audio remains ephemeral.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Azure Speech Pronunciation Assessment, Dexie 4, Supabase Postgres/RLS, Node test runner.

## Global Constraints

- Policy version is `latam-v1`; adaptive `ease` may alter scaffolding but never a pass threshold.
- Optimize for intelligibility, word identity, important endings, and work/daily-life communication—not accent erasure.
- Only `valid` evidence may pass or fail. Provider absence, permission denial, and no-speech are technical outcomes.
- Free conversation is diagnostic; only the following scripted repair can become mastery evidence.
- Three valid misses complete normal practice as `practiced-not-mastered`; stage assessments remain gated.
- Persist bounded scores and categories only. Never retain or sync raw audio.
- Personal valid evidence outranks the regional prior once the learner has evidence for a sound.

---

### Task 1: Establish the pure versioned grading policy

**Files:**
- Create: `lib/speech/pronunciation-policy.ts`
- Create: `lib/speech/pronunciation-policy.test.mjs`
- Modify: `lib/speech/scoring.ts`

**Interfaces:**

```ts
export const PRONUNCIATION_POLICY_VERSION = "latam-v1";
export type PronunciationContext = "word" | "daily-phrase" | "stage" | "free";
export type ProviderStatus = "valid" | "technical-skip" | "unavailable";

export interface PronunciationEvidence {
  providerStatus: ProviderStatus;
  pronunciationScore?: number;
  accuracyScore?: number;
  fluencyScore?: number;
  completenessScore?: number;
  prosodyScore?: number;
  targetPhonemeScore?: number;
  lowestTargetWordScore?: number;
  targetRecognized?: boolean;
  minimalPairSubstitution?: boolean;
}

export interface PronunciationVerdict {
  policyVersion: typeof PRONUNCIATION_POLICY_VERSION;
  outcome: "mastered" | "retry" | "diagnostic" | "technical-skip";
  reasons: string[];
}

export function gradePronunciation(input: {
  context: PronunciationContext;
  cefr: "A0" | "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  evidence: PronunciationEvidence;
}): PronunciationVerdict;
```

- [ ] **Step 1: Write failing threshold boundary tests**

Cover one below, exactly at, and one above every boundary: word 82/75; daily phrase
78/78/90/70; A2+ phrase prosody 65; stage 85/85/95/80 and A2+ prosody 70. Prove A0-A1
prosody is diagnostic, absent provider scores do not become zero, free speech never
returns `mastered`, and minimal-pair substitution fails a target word.

```js
assert.equal(gradeWord({ pronunciationScore: 81, targetPhonemeScore: 75 }), "retry");
assert.equal(gradeWord({ pronunciationScore: 82, targetPhonemeScore: 75 }), "mastered");
assert.equal(gradeStage({ pronunciationScore: 85, accuracyScore: 85,
  completenessScore: 95, targetPhonemeScore: 80, prosodyScore: 70 }), "mastered");
```

- [ ] **Step 2: Confirm the focused test fails**

```bash
node --experimental-strip-types lib/speech/pronunciation-policy.test.mjs
```

Expected: FAIL because the policy module does not exist.

- [ ] **Step 3: Implement `latam-v1` as data plus pure comparisons**

Reject out-of-range numeric evidence, include stable reason codes, and keep all policy
numbers in this module. Remove the acoustic `ease` deduction from `lib/speech/scoring.ts`;
legacy transcript similarity may remain only as an ungraded fallback.

- [ ] **Step 4: Verify no grading caller can lower thresholds**

```bash
rg -n 'ease|ACOUSTIC_WORD|ACOUSTIC_PHRASE|score.*>=' lib app components
node --experimental-strip-types lib/speech/pronunciation-policy.test.mjs
npm run typecheck
```

Expected: all acoustic mastery comparisons live in `pronunciation-policy.ts`; focused
tests and typecheck pass.

- [ ] **Step 5: Commit**

```bash
git add lib/speech/pronunciation-policy.ts lib/speech/pronunciation-policy.test.mjs lib/speech/scoring.ts
git commit -m "feat: add strict versioned pronunciation policy"
```

### Task 2: Normalize complete Azure pronunciation evidence

**Files:**
- Create: `lib/speech/azure-response.ts`
- Create: `lib/speech/azure-response.test.mjs`
- Create: `lib/speech/fixtures/azure-word.json`
- Create: `lib/speech/fixtures/azure-phrase.json`
- Modify: `lib/speech/azure.ts`
- Modify: `app/api/assess/route.ts`
- Modify: `lib/virtual-call/api-contract.test.mjs`

**Interfaces:**

```ts
export interface AssessedWord {
  word: string;
  accuracyScore?: number;
  errorType?: string;
  phonemes: Array<{ phoneme: string; accuracyScore?: number }>;
}

export interface AssessmentResult extends PronunciationEvidence {
  provider: "azure";
  recognizedText: string;
  words: AssessedWord[];
}

export function normalizeAzureAssessment(payload: unknown): AssessmentResult;
```

- [ ] **Step 1: Add redacted provider fixtures and failing adapter tests**

Prove the adapter extracts overall pronunciation, accuracy, fluency, completeness,
prosody, word scores, error types, IPA phonemes, and provider status. Include fixtures
with missing prosody and malformed results; do not include learner names or audio.

- [ ] **Step 2: Confirm failure**

```bash
node --experimental-strip-types lib/speech/azure-response.test.mjs
```

- [ ] **Step 3: Enable the required Azure assessment properties**

Keep `en-US`, `HundredMark`, `Phoneme`, IPA names, and reference-text miscue behavior.
For scripted phrases send `EnableProsodyAssessment: true`. Parse `NBest[0]` through the
adapter and return the provider-independent result from `/api/assess`; never forward the
entire provider payload to the browser or logs.

- [ ] **Step 4: Test word, phrase, missing-score, and provider-error paths**

```bash
node --experimental-strip-types lib/speech/azure-response.test.mjs
node --experimental-strip-types lib/virtual-call/api-contract.test.mjs
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add lib/speech/azure-response.ts lib/speech/azure-response.test.mjs lib/speech/fixtures lib/speech/azure.ts app/api/assess/route.ts lib/virtual-call/api-contract.test.mjs
git commit -m "feat: normalize Azure pronunciation evidence"
```

### Task 3: Diagnose one high-value LATAM correction

**Files:**
- Create: `lib/speech/latam-prior.ts`
- Create: `lib/speech/pronunciation-diagnosis.ts`
- Create: `lib/speech/pronunciation-diagnosis.test.mjs`

**Interfaces:**

```ts
export interface PronunciationDiagnosis {
  target: string;
  observed?: string;
  cueKey: string;
  contrast?: { target: string; likelySubstitution: string };
  source: "personal-evidence" | "latam-prior" | "provider";
}

export function diagnosePronunciation(input: {
  evidence: AssessmentResult;
  personalWeaknesses: SoundWeakness[];
}): PronunciationDiagnosis | null;
```

- [ ] **Step 1: Write failing ranking and safety tests**

Cover /ɪ/-/iː/, /ʊ/-/uː/, /æ/-/ɛ/, /ʌ/-/ɑ/, /b/-/v/, /dʒ/-/j/,
/ʃ/-/tʃ/, /θ ð/, initial S clusters, final clusters/endings, /h/, rhotic /r/,
schwa/stress/rhythm, connected speech, and flap. Assert one correction only, American
IPA, no “bad accent” language, and measured personal evidence outranks the prior.

- [ ] **Step 2: Confirm the diagnosis tests fail**

```bash
node --experimental-strip-types lib/speech/pronunciation-diagnosis.test.mjs
```

- [ ] **Step 3: Implement deterministic ranking and Spanish articulation cue keys**

Rank word-identity/minimal-pair errors first, omitted endings second, intelligibility
errors third, and rhythm/fluency refinements last. The prior may break a tie only until
valid personal evidence exists for that sound.

- [ ] **Step 4: Verify and commit**

```bash
node --experimental-strip-types lib/speech/pronunciation-diagnosis.test.mjs
npm run typecheck
git add lib/speech/latam-prior.ts lib/speech/pronunciation-diagnosis.ts lib/speech/pronunciation-diagnosis.test.mjs
git commit -m "feat: add evidence-led LATAM pronunciation diagnosis"
```

### Task 4: Implement the three-valid-attempt state machine

**Files:**
- Create: `lib/speech/pronunciation-session.ts`
- Create: `lib/speech/pronunciation-session.test.mjs`
- Modify: `lib/gamification.ts`
- Modify: `lib/daily-session-reward.ts`

**Interfaces:**

```ts
export interface PronunciationSessionState {
  validAttempts: number;
  firstValidScore?: number;
  status: "active" | "mastered" | "practiced-not-mastered" | "technical-skip";
}

export type PronunciationSessionEvent =
  | { type: "valid-verdict"; verdict: PronunciationVerdict; score?: number }
  | { type: "technical-failure"; reason: string }
  | { type: "skip-after-outage" };

export interface PronunciationSessionTransition {
  state: PronunciationSessionState;
  coachingStage: 1 | 2 | 3;
  rewardMultiplier: 0 | 0.25 | 1;
  masteryStars: number;
  srsPass: boolean;
  dueDayOffset?: 1;
}
```

- [ ] **Step 1: Write failing state-transition tests**

Prove technical failures do not increment attempts, miss three returns
`practiced-not-mastered`, reward is exactly 25% of base XP rounded by the existing reward
rule, mastery stars/combo/SRS pass are zero/false, due day offset is one, and normal
session navigation continues. Prove stage callers cannot use attempt exhaustion as pass.

- [ ] **Step 2: Run and observe failure**

```bash
node --experimental-strip-types lib/speech/pronunciation-session.test.mjs
```

- [ ] **Step 3: Implement pure transitions and reward helpers**

Do not read the clock in the state machine. The caller supplies a local day when it
writes the due item. Preserve existing idempotency keys for session rewards.

- [ ] **Step 4: Verify and commit**

```bash
node --experimental-strip-types lib/speech/pronunciation-session.test.mjs
node --experimental-strip-types lib/daily-session-reward.test.mjs
npm run typecheck
git add lib/speech/pronunciation-session.ts lib/speech/pronunciation-session.test.mjs lib/gamification.ts lib/daily-session-reward.ts
git commit -m "feat: add three-attempt pronunciation coaching"
```

### Task 5: Persist structured evidence with additive local and cloud migrations

**Files:**
- Modify: `lib/db/types.ts`
- Modify: `lib/db/dexie.ts`
- Modify: `lib/db/repository.ts`
- Modify: `lib/db/dexie-repository.ts`
- Modify: `lib/sync/supabase-sync.ts`
- Create: `supabase/migration-v7-pronunciation-evidence.sql`
- Modify: `supabase/current-schema.sql`
- Modify: `lib/sync/schema.test.mjs`
- Modify: `lib/sync/coverage.test.mjs`
- Create: `lib/speech/pronunciation-persistence.test.mjs`

**Data additions to `Attempt`:**

```ts
policyVersion?: "latam-v1";
providerStatus?: ProviderStatus;
pronunciationScore?: number;
accuracyScore?: number;
completenessScore?: number;
prosodyScore?: number;
targetPhonemeScore?: number;
weakestPhoneme?: string;
weakestWord?: string;
attemptOrdinal?: 1 | 2 | 3;
pronunciationOutcome?: "mastered" | "practiced-not-mastered" | "technical-skip";
```

- [ ] **Step 1: Write failing persistence and schema-contract tests**

Assert a new record round-trips all bounded fields, legacy records remain readable,
unknown/unbounded provider payloads are dropped, and the SQL migration enables owner-only
RLS. Explicitly assert no `audio`, `audio_url`, or blob column is added.

- [ ] **Step 2: Run focused failures**

```bash
node --experimental-strip-types lib/speech/pronunciation-persistence.test.mjs
node lib/sync/schema.test.mjs
```

- [ ] **Step 3: Add Dexie version 12 and SQL migration v7**

Use an additive Dexie version without rewriting legacy attempts. Add nullable bounded
columns to the cloud attempt table, check constraints for 0–100 scores and enumerated
outcomes, current user RLS, and indexes required by weak-sound and due-day queries.

- [ ] **Step 4: Map allowlisted fields through the outbox**

Update serialization, restore, and merge logic. Do not sync raw provider JSON,
transcripts, email, or audio. A technical skip must not create weakness evidence.

- [ ] **Step 5: Verify and commit**

```bash
node --experimental-strip-types lib/speech/pronunciation-persistence.test.mjs
node lib/sync/schema.test.mjs
node lib/sync/coverage.test.mjs
npm test
npm run typecheck
git add lib/db lib/sync supabase/migration-v7-pronunciation-evidence.sql supabase/current-schema.sql lib/speech/pronunciation-persistence.test.mjs
git commit -m "feat: persist bounded pronunciation evidence"
```

### Task 6: Build the consistent pronunciation coach UI

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `components/practice/use-pronunciation-coach.ts`
- Create: `components/practice/pronunciation-feedback.tsx`
- Create: `components/practice/pronunciation-feedback.test.tsx`
- Modify: `components/practice/produce-panel.tsx`
- Modify: `components/practice/shadow-round.tsx`
- Modify: `lib/practice.ts`
- Modify: `lib/i18n.ts`

**Interfaces:**
- `usePronunciationCoach` owns capture → assess → verdict → diagnosis → transition.
- `PronunciationFeedback` receives a verdict and diagnosis; it performs no scoring.

- [ ] **Step 1: Install and configure the component-test harness**

```bash
npm install --save-dev vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

Configure `vitest.config.ts` for jsdom, the existing `@/` alias, and
`tests/setup.ts`; add `test:components: "vitest run"` to `package.json`.

- [ ] **Step 2: Write failing behavior and accessibility tests**

Prove every result presents: what Clara heard, message clarity, one correction, one
Spanish physical cue, slow listen, normal listen, and retry. Assert primary labels are
Clear/Almost/Try again with icon and text, raw scores are behind a details disclosure,
Lumi never overlaps the target or microphone, and live announcements are polite.

- [ ] **Step 3: Confirm focused failure**

```bash
npx vitest run components/practice/pronunciation-feedback.test.tsx
```

- [ ] **Step 4: Integrate the pure modules and technical recovery**

Permission denial and no-speech open the existing recovery path and write no miss.
Provider outage offers retry, transcript-only ungraded practice, or technical skip.
Attempt two exposes slow/normal audio and one contrast; attempt three adds progress from
the first valid score and a short rhythm/minimal-pair challenge.

- [ ] **Step 5: Verify and commit**

```bash
npx vitest run components/practice/pronunciation-feedback.test.tsx
npm test
npm run typecheck
git add package.json package-lock.json vitest.config.ts tests/setup.ts components/practice lib/practice.ts lib/i18n.ts
git commit -m "feat: add supportive strict pronunciation feedback"
```

### Task 7: Guarantee daily speaking and add four game formats

**Files:**
- Modify: `lib/daily-session.ts`
- Modify: `lib/daily-session.test.mjs`
- Modify: `lib/daily-session-loader.ts`
- Create: `lib/speech/weekly-sound-boss.ts`
- Create: `lib/speech/weekly-sound-boss.test.mjs`
- Create: `components/practice/pronunciation-game.tsx`
- Create: `components/practice/sound-sprint.tsx`
- Create: `components/practice/beat-the-twin.tsx`
- Create: `components/practice/echo-chain.tsx`
- Create: `components/practice/call-rescue.tsx`

**Interfaces:**
- Daily composer returns at least one scored speaking activity with three short target
  utterances.
- Weekly Sound Boss selects the three weakest high-impact sounds from valid evidence.

- [ ] **Step 1: Add failing composer and selection tests**

Assert every generated normal session has scored speech, recent miss/due item wins over
personal weakness, personal weakness wins over the LATAM prior, and valid evidence only
feeds the boss. Fixed fixtures must produce deterministic game and target selection.

- [ ] **Step 2: Confirm tests fail**

```bash
node --experimental-strip-types lib/daily-session.test.mjs
node --experimental-strip-types lib/speech/weekly-sound-boss.test.mjs
```

- [ ] **Step 3: Implement composition and game renderer**

Keep Sound Sprint to three utterances. Beat the Twin combines listening choice and a
scripted pronunciation target. Echo Chain grows chunks while preserving stress marks.
Call Rescue turns one misunderstood call word into a scripted repair. All four reuse
the same coach hook and policy.

- [ ] **Step 4: Verify and commit**

```bash
node --experimental-strip-types lib/daily-session.test.mjs
node --experimental-strip-types lib/speech/weekly-sound-boss.test.mjs
npm test
npm run typecheck
git add lib/daily-session.ts lib/daily-session.test.mjs lib/daily-session-loader.ts lib/speech/weekly-sound-boss.ts lib/speech/weekly-sound-boss.test.mjs components/practice
git commit -m "feat: add daily pronunciation games"
```

### Task 8: Separate conversation diagnosis from scripted mastery

**Files:**
- Modify: `lib/virtual-call/session.ts`
- Modify: `lib/virtual-call/session.test.mjs`
- Modify: `lib/virtual-call/report.ts`
- Modify: `components/virtual-call/use-virtual-call.ts`
- Modify: `components/virtual-call/correction-card.tsx`
- Modify: `components/virtual-call/call-report.tsx`
- Modify: `app/api/virtual-call/report/route.ts`

**Interfaces:**
- Unscripted call turn returns bounded diagnostic targets only.
- Correction card creates a reference-text retry graded by `latam-v1`.

- [ ] **Step 1: Add failing free-versus-scripted tests**

Prove an excellent free turn cannot return mastery, one lowest-confidence high-impact
word becomes the correction target, the exact corrected sentence is sent to the scripted
assessment, and only that retry can write a mastery outcome.

- [ ] **Step 2: Confirm failure**

```bash
node --experimental-strip-types lib/virtual-call/session.test.mjs
```

- [ ] **Step 3: Integrate diagnosis and the shared coach**

Do not send unrestricted transcripts to analytics or Sentry. Keep the in-memory/session
retention options from the foundation consent work. A correction card shows one cue and
slow/normal playback before the learner retries.

- [ ] **Step 4: Verify and commit**

```bash
node --experimental-strip-types lib/virtual-call/session.test.mjs
node --experimental-strip-types lib/virtual-call/api-contract.test.mjs
npm run typecheck
git add lib/virtual-call components/virtual-call app/api/virtual-call/report/route.ts
git commit -m "feat: make call pronunciation evidence honest"
```

### Task 9: Enforce strict stage-assessment gates

**Files:**
- Modify: `lib/exam-grading.ts`
- Modify: `lib/exam-grading.test.mjs`
- Modify: `lib/exam-compose.ts`
- Modify: `lib/exam-compose.test.mjs`
- Modify: `app/exam/page.tsx`

- [ ] **Step 1: Add failing stage boundary and exhaustion tests**

Test all `latam-v1` stage boundaries, A0-A1 versus A2+ prosody, technical skips, and
three valid misses. Assert the exam remains incomplete after exhausted misses and gives a
clear practice recommendation rather than awarding the stage.

- [ ] **Step 2: Confirm failure**

```bash
node --experimental-strip-types lib/exam-grading.test.mjs
node --experimental-strip-types lib/exam-compose.test.mjs
```

- [ ] **Step 3: Route every speaking item through the stage policy**

Remove duplicate threshold math. Compose enough target evidence to cover the current
stage's priority sounds and endings; preserve accessibility and recovery for technical
failures without treating them as learner misses.

- [ ] **Step 4: Verify and commit**

```bash
node --experimental-strip-types lib/exam-grading.test.mjs
node --experimental-strip-types lib/exam-compose.test.mjs
npm test
npm run typecheck
git add lib/exam-grading.ts lib/exam-grading.test.mjs lib/exam-compose.ts lib/exam-compose.test.mjs app/exam/page.tsx
git commit -m "feat: enforce strict pronunciation stage gates"
```

### Task 10: Complete and lint the LATAM sound curriculum

**Files:**
- Modify: `lib/content/lessons.ts`
- Create: `lib/content/pronunciation-content.test.mjs`
- Modify: `lib/content/conversation-support.ts`

- [ ] **Step 1: Add a failing content contract**

Require a teachable item, minimal/near pair where pedagogically valid, General American
IPA, Spanish articulation cue, slow and normal audio key, and useful workplace/daily-life
example for every priority in section 6.2 of the approved spec. Prohibit accent-shaming,
fake-English respellings that reinforce Spanish vowels, and unsupported IPA symbols.

- [ ] **Step 2: Confirm missing contrasts fail**

```bash
node --experimental-strip-types lib/content/pronunciation-content.test.mjs
```

Expected: FAIL for at least /ʊ/-/uː/, /æ/-/ɛ/, /ʌ/-/ɑ/, and /ʃ/-/tʃ/ coverage.

- [ ] **Step 3: Add the missing content and cues**

Keep connected speech and the American flap as later fluency refinements, not early hard
fail markers. Record new audio keys in the existing manifest and fail the contract if an
asset key is missing.

- [ ] **Step 4: Verify and commit**

```bash
node --experimental-strip-types lib/content/pronunciation-content.test.mjs
npm test
git add lib/content/lessons.ts lib/content/conversation-support.ts lib/content/pronunciation-content.test.mjs
git commit -m "content: complete LATAM pronunciation priorities"
```

### Task 11: Create a reproducible human-calibration gate

**Files:**
- Create: `scripts/validate-pronunciation-calibration.mjs`
- Create: `docs/verification/pronunciation-calibration-template.json`
- Create: `docs/verification/pronunciation-calibration.md`
- Modify: `package.json`

**Calibration record shape:**

```json
{
  "policyVersion": "latam-v1",
  "recordedAt": "YYYY-MM-DD",
  "speakerCount": 6,
  "recordingCount": 30,
  "instructor": "recorded-in-private-evidence",
  "samples": [],
  "decision": { "status": "accepted", "rationale": "" }
}
```

- [ ] **Step 1: Write the validator and prove the empty template fails**

Validate at least 30 recordings, at least six distinct adult LATAM speakers, independent
instructor intelligibility and target-sound ratings, aggregate false-pass/false-fail
counts, dated rationale, and matching policy version. Reject files containing audio,
email, full names, or unrestricted transcripts.

```bash
node scripts/validate-pronunciation-calibration.mjs docs/verification/pronunciation-calibration-template.json
```

Expected: non-zero because a template is not evidence.

- [ ] **Step 2: Add `verify:pronunciation-calibration`**

Point the script at `docs/verification/pronunciation-calibration.json`, a deliberately
gitignored local evidence file. Document the instructor procedure and anonymized sample
IDs. Do not fabricate results to make the gate pass.

- [ ] **Step 3: Run all code checks; record the remaining human gate**

```bash
npm test
npm run typecheck
npm run lint:ratchet
npm run build
```

Expected: code checks pass. Calibration remains an explicit release blocker until the
real six-speaker/30-recording evidence file validates.

- [ ] **Step 4: Commit the validator and procedure**

```bash
git add scripts/validate-pronunciation-calibration.mjs docs/verification/pronunciation-calibration-template.json docs/verification/pronunciation-calibration.md package.json package-lock.json .gitignore
git commit -m "test: add pronunciation calibration release gate"
```

## Pronunciation completion gate

- [ ] Every normal composed daily session contains one scored pronunciation activity.
- [ ] Policy, adapter, diagnosis, session-state, persistence, game, call, and exam tests pass.
- [ ] Three valid misses yield 25% base XP, zero stars/combo/SRS pass, and next-day review.
- [ ] Technical failures never become learner failures or weakness evidence.
- [ ] Stored and synced payloads contain no raw audio or unrestricted transcript.
- [ ] `npm test && npm run typecheck && npm run lint:ratchet && npm run build` exits 0.
- [ ] Real calibration evidence covers at least 30 recordings from at least six LATAM adults and validates against the shipped policy version.
