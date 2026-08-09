# Virtual Call

A spoken practice call between an adult learner and **Lumi**, the AI practice
guide. The learner talks, Lumi answers, useful corrections surface according to
the chosen mode, and the call ends with a short review.

**Joel is the real instructor and the author of the learning program. Lumi is an
AI character who helps the learner rehearse it.** That distinction is not
decoration: it is disclosed persistently in the call header, Lumi admits it if
asked, and no line is ever attributed to Joel unless he has approved it (see
[Humor](#humor-content)).

> **Naming.** The app is called Clara; the guide is called Lumi. Keeping those
> apart matters — an earlier version named the guide Clara too, which made
> "Llamada con Clara" ambiguous and had the model introducing itself as the
> product. In code the guide's role is `"guide"`, not her name, so changing the
> character again touches the prompt, the copy and the artwork, but no types.

This is a different feature from `/call`, which is the BPO customer-service
simulator where Joel plays an impatient American customer and the learner is a
support agent being graded. Both exist on purpose; neither replaces the other.

---

## 1. Architecture

The call is **turn-based**: one learner recording per turn, transcribed, analyzed,
answered. It is not full duplex. See [Upgrade path](#10-upgrade-path-to-real-time)
for why, and what changes when that becomes possible.

Four layers, deliberately separated so each is testable on its own:

| Layer | Where | Responsibility |
| --- | --- | --- |
| Content | `lib/content/virtual-call-scenarios.ts` | Typed scenarios. No logic. |
| Domain | `lib/virtual-call/session.ts`, `report.ts`, `humor.ts` | Call state machine, correction policy, retry matching, report assembly. Pure, no I/O, plain-node testable. |
| Providers | `lib/virtual-call/providers.ts`, `brain.ts` | The seam to paid third parties, plus a deterministic mock. Server-only. |
| Transport | `app/api/virtual-call/turn`, `app/api/virtual-call/report` | Auth, limits, validation, windowing. Stateless. |
| UI | `app/virtual-call/`, `components/virtual-call/` | Presentation and call controls. |

### The load-bearing decision: the model proposes, the domain decides

The model returns a *candidate* correction with a severity. It does **not**
decide whether the call stops. `shouldInterrupt(mode, correction, needsClarification)`
in `session.ts` does, from rules with tests behind them. This is why Natural and
Practice are genuinely different products rather than a prompt adjective, and why
their behavior can be proven without spending a token.

### Stateless server, client-owned call

The server holds no call state. Each turn posts a **windowed** history
(`CONTEXT_WINDOW_TURNS = 8`), so token cost per turn is flat no matter how long
the call runs, and a crashed tab cannot strand a server session.

---

## 2. User flow

1. **Pick a scenario.** Filtered and ordered by her CEFR level.
2. **Privacy and mic.** The existing one-time voice-consent sheet
   (`lib/speech/consent.ts`) gates the first capture anywhere in the app,
   including here. Nothing records before an affirmative action.
3. **Lumi opens.** `openingPrompt` renders locally and is spoken, so the call
   starts instantly with no model round trip.
4. **The learner speaks.** The call is **continuous**: the mic opens on its own
   when the guide stops talking, and silence hands the turn back — one tap
   starts the call, and nothing is tapped again. `wav-recorder` detects
   end-of-speech from a per-frame peak (a cumulative peak can say "the mic
   worked" but never "she has finished"), and only ever after speech was heard,
   so a learner thinking before she answers is not cut off. Manual stop stays
   available, and `MAX_RECORDING_MS` (30s) is still the ceiling.
   With audio muted there is no voice to stop, so the handoff instead fires when
   the reply is on screen to read — muting the guide must not silently disable
   the conversation.
5. **Transcribe → analyze → reply.** `POST /api/virtual-call/turn`.
6. **Correction, per mode.** See below.
7. **Repeat** until the scenario's `targetTurns`, `MAX_TURNS` (24), or
   `MAX_CALL_MS` (10 min).
8. **Report.** Numbers computed locally; prose from
   `POST /api/virtual-call/report`.

### Correction modes

| | Natural Call | Practice Call |
| --- | --- | --- |
| Interrupts on `significant` | No | **Yes** — explains, asks for the sentence again, verifies |
| Interrupts on `blocking` | Yes | Yes |
| Interrupts on `minor` | Never | Never |
| Inline display | Discreet, below the turn | Discreet, below the turn |
| Where corrections land | End-of-call review | Immediately **and** the review |

`minor` never stops either mode. A call that halts on every harmless article is
not practice; it is an interrogation, and learners stop taking it.

A retry is accepted at word-level similarity `>= 0.8` against the corrected
sentence (`utteranceSimilarity`, token edit distance). **One retry only** — the
correction is recorded for the report either way, so demanding it twice adds
pressure without adding learning.

---

## 3. Provider interfaces

```ts
interface CallBrain {
  readonly name: string;                       // for logs/health — never a key
  analyzeTurn(req: TurnRequest): Promise<TurnAnalysis>;
}
```

Two implementations:

- **`ModelCallBrain`** (`brain.ts`) — the configured chat model via the existing
  `lib/ai/chat-client.ts`, so Azure OpenAI is used when configured and plain
  OpenAI otherwise. Strict JSON Structured Outputs.
- **`MockCallBrain`** (`providers.ts`) — the **development fallback**. Rule-based
  and deterministic, so every UI state and both correction modes are reachable
  with **no API keys at all**. It detects two real, very common Spanish-speaker
  patterns (past-tense marker with a present verb; `I have 25 years`). It is
  **refused in production**: `pickBrain()` returns `null` when `NODE_ENV` is
  production and no model is configured, and the route answers `503`. Canned text
  in production would hide a broken deploy from everyone.

Speech in and out reuses what already exists rather than adding providers:
transcription through `lib/speech/recognition.ts` (Web Speech → cloud transcribe
→ Azure, already consent-gated), and the guide's voice through `/api/tts`.

### Pronunciation is evidence-based

**Every spoken turn is graded**, free conversation included. Azure runs an
*unscripted* assessment when the reference text is omitted, so it scores what she
actually chose to say rather than only a sentence handed to her to repeat.

- A retry is **scripted**: graded against the corrected sentence, so completeness
  and miscue are meaningful. `PronunciationEvidence` carries `target`.
- A free turn is **unscripted**: accuracy, fluency and prosody against her own
  words. No `target`, and `completenessScore` is omitted rather than reported as
  a zero — "did she say all the expected words" has no meaning without expected
  words, and a zero would read as a failure she did not earn.
- `EnableMiscue` is on only for scripted assessment. Left on for free speech it
  would flag every word she chose herself as an insertion.
- `summarizePronunciation()` returns `undefined` only when nothing was scored at
  all — that means the service was unavailable, and the report says so rather
  than implying she spoke well.

Never present a transcript as pronunciation analysis. A score must come from the
speech service having actually heard the audio.

---

## 4. Environment variables

By name only; all server-side, none exposed to the client.

| Name | Used for | Absent |
| --- | --- | --- |
| `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT` | the guide's replies and report prose | Falls back to `OPENAI_API_KEY` |
| `OPENAI_API_KEY` | Same, non-Azure | Dev: mock brain. Prod: `503` |
| `ELEVENLABS_API_KEY` | the guide's spoken voice | Call runs text-only |
| `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | Retry pronunciation scoring | Retries still verified by transcript; no pronunciation reported |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auth on the API routes | Dev: auth disabled. Prod: routes fail **closed** |

---

## 5. Privacy and retention

- **No background recording.** Capture starts only on an explicit press, and the
  first capture anywhere opens the one-time voice-consent sheet.
- **A clear recording indicator** whenever the mic is live, perceivable
  non-visually as well as visually.
- **Audio is not stored on our servers.** It goes to the speech service for
  transcription and is not persisted by these routes.
- **Transcripts are not saved by default.** The retention preference defaults to
  storing none; the aggregate report (counts, corrections, vocabulary) is what
  persists so her progress survives.
- **Deletion.** Settings offers deleting stored transcripts. This clears
  transcript text while **keeping** the aggregate rows — deleting a recording is
  not the same as deleting her learning history, and conflating them would erase
  progress she did not ask to lose.
- **Logs carry metadata only.** The turn route logs scenario, mode, provider and
  an error message — never the utterance or the reply. Putting learner speech in
  platform logs would contradict the notice.
- **No secrets client-side.** Every key is read server-side only.

---

## 6. Cost controls

| Control | Value | Where |
| --- | --- | --- |
| Max call duration | 10 min | `MAX_CALL_MS` |
| Max recording per turn | 30 s | `MAX_RECORDING_MS` |
| Max turns | 24 | `MAX_TURNS` |
| Context window | 8 turns | `CONTEXT_WINDOW_TURNS`, enforced **server-side too** |
| Max utterance | 500 chars | turn route |
| Max body | 16 KB turn / 32 KB report | turn + report routes, measured in **bytes** |
| Max vocabulary item | 60 chars | report route — these strings enter the system prompt |
| Fact counts | clamped 0-100 | report route |
| Durable call-turn quota | 100/user/day + 90/global/min | `api-quota.ts` + atomic Supabase RPC |
| Same-origin only | required | existing `guardApi` |

Cost drivers, in rough order: the chat model (one call per learner turn, plus one
per report), speech synthesis (one per guide reply), and transcription (one per
learner turn). Windowing is what keeps a long call from growing quadratically.

---

## 7. Data model

`VirtualCallRecord` (Dexie store `virtualCalls`, additive schema version) holds
the completed call: scenario, mode, level, timings, turn counts, corrections,
priorities, vocabulary used, optional pronunciation summary, retry counts, and —
only when retention is enabled — the transcript.

**The report syncs; the transcript never does.** `public.virtual_calls`
(`supabase/virtual_calls.sql`, own-rows-only RLS) mirrors the report so it
survives an iOS storage eviction — Safari drops IndexedDB after about seven
inactive days, which used to take her whole call history with it. The table has
no transcript column and `virtualCallRow()` names every column explicitly rather
than spreading the record, so a field added to `VirtualCallRecord` later cannot
ride along into the payload. `lib/virtual-call/persistence.test.mjs` asserts all
three of those properties.

Rollback: the store is additive and nothing existing is modified, so reverting the
app code leaves prior data intact and simply stops writing new rows.

---

## 8. Authoring content

### Scenarios

Add an entry to `VIRTUAL_CALL_SCENARIOS` in
`lib/content/virtual-call-scenarios.ts`. Nothing else changes — the picker, the
prompt and the report all read from it. Fields: `title`, `description`, `level`,
`objective`, `targetVocabulary`, `targetGrammar`, `openingPrompt`,
`suggestedTurns`, `completionCriteria`, `targetTurns`, `length`, and an optional
`culturalNote` shown when the situation differs culturally from Colombia.

Keep `openingPrompt` natural and ending in a question; it is spoken verbatim.

### Humor content

All reactions live in `lib/content/humor.ts` so Joel can read and edit them in one
place. Rules enforced by tests:

- Humor fires on **success only**, and "success" is checked rather than assumed:
  `selectCallHumor` takes a required `succeeded` flag and returns nothing when it
  is false. A call that ran one turn and missed its objective gets no celebration
  — that was found in browser testing, where a mastery line landed on a call the
  learner had just struggled through, and it read as the app not listening.
  Never on a correction, a failed retry, a mic problem, or an error.
- At most `MAX_REACTIONS_PER_CALL` (2), and "light" allows one, at the end only.
- Never targets the learner: every line is tagged `situation`, `self`, or
  `culture`, and there is deliberately no `learner` option.
- Slang carries a plain-Spanish meaning and a register note.
- **Joel's lines are all `approval: "draft"` and are excluded at runtime.** The
  call asks for his voice and legitimately gets nothing until he approves each
  line. Nothing is put in his mouth that he has not signed off.

Learners can set humor to off / light / full.

---

## 9. Testing

```bash
npx tsx lib/virtual-call/session.test.mjs   # domain: modes, retries, report
npx tsx lib/virtual-call/humor.test.mjs     # humor safety rules
npm test                                    # whole suite
npm run verify                              # typecheck + ratchet + tests + build
```

Running the call locally with **no API keys**: unset the Supabase vars so auth is
disabled in dev, and the mock brain answers.

```bash
NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= npm run dev
# then open http://localhost:3000/virtual-call
```

Exercising the API directly:

```bash
curl -s -X POST http://localhost:3000/api/virtual-call/turn \
  -H 'content-type: application/json' -H 'Origin: http://localhost:3000' \
  --data-binary '{"scenarioId":"introducing-yourself","mode":"practice","level":"A2",
                  "coachLanguage":"es","utterance":"Yesterday I go to my friend house.","history":[]}'
```

---

## 10. Upgrade path to real-time

The turn-based shape is a deliberate first version, not a limitation of ambition.
Full duplex needs continuous capture, server-side VAD, barge-in, and streaming
synthesis — none of which the current architecture supports reliably, and all of
which change the cost model substantially.

What makes the swap tractable later:

1. **`CallBrain` is the only seam.** A realtime provider implements the same
   interface plus a streaming variant; the route and UI keep their contracts.
2. **The domain is transport-agnostic.** `applyTurn` / `applyRetry` /
   `shouldInterrupt` care about utterances, not about how audio arrived.
3. **`CallPhase` already models the states** a realtime call needs
   (`listening`, `processing`, `clara-speaking`), so the UI does not need
   rebuilding — barge-in becomes a new transition, not a new screen.

The real work when it happens: interruption handling (what does a correction mean
when she is still talking?), and a much tighter per-minute cost ceiling.

---

## 11. Known limitations

- Turn-based, not full duplex. The guide cannot be interrupted mid-sentence.
- Pronunciation is only ever scored on retries, and only when Azure Speech is
  configured. Free-speech turns are transcript-only by design.
- The mock brain recognizes two mistake patterns, not a grammar model. It exists
  to make the flow runnable and testable without keys, not to teach.
- `metCriteria` is the model's judgment of the scenario's completion criteria; it
  is not independently verified against the transcript.
- The guide's artwork is Lumi's existing pose set, resolved from whatever outfit
  the learner has equipped in the store, so the guide on a call is the same
  character she has been dressing.
- `metCriteria` is the model's judgment, not an independent check of the
  transcript, so the "did you reach the goal" line is only as good as that.
