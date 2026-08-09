import test from "node:test";
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://clara.test";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test-key";
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const PROFILE = "11111111-1111-4111-8111-111111111111";
const DAY = "2026-08-09";
const { composeDailySession } = await import("../daily-session.ts");
const { LESSONS } = await import("../content/lessons.ts");
const { deliverQueued, pullDailySession } = await import("./supabase-sync.ts");
const { advanceDailyPronunciationGame, createDailyPronunciationGameState, dailyPronunciationContentHash, dailyPronunciationLegacyContentHash } = await import("../speech/daily-pronunciation-game.ts");
const { mergeDailySessions } = await import("../daily-session-merge.ts");

const scenario = { id: "cafe", emoji: "☕", title: { es: "Café", en: "Cafe" }, blurb: { es: "", en: "" }, role: "barista", setting: "cafe", opener: { es: "", en: "" }, starters: [] };
const th = LESSONS.find((lesson) => lesson.id === "th");
const source = th.items[0];
const composed = composeDailySession({
  profileId: PROFILE, day: DAY, now: 1_800_000_000_000, level: "A1", path: "general", lessons: [th], scenarios: [scenario],
  progress: [{ itemId: source.id, lessonId: th.id, categoryId: source.categoryId, phoneme: source.phoneme, attempts: 1, passes: 0, box: 1, dueAt: 0, lastResult: "fail", lastScore: 50, updatedAt: 1 }],
});

function serve(payload, version = payload.version, updatedAt = payload.updatedAt) {
  globalThis.fetch = async () => new Response(JSON.stringify({ profile_id: PROFILE, day: DAY, version, payload, updated_at: updatedAt }), {
    status: 200,
    headers: { "content-type": "application/vnd.pgrst.object+json" },
  });
}

test("pullDailySession restores a bounded v2 pronunciation session", async () => {
  serve(composed, 2, composed.updatedAt + 10);
  const pulled = await pullDailySession(PROFILE, DAY);
  assert.equal(pulled?.version, 2);
  assert.equal(pulled?.updatedAt, composed.updatedAt + 10);
  assert.deepEqual(pulled?.activities.find((activity) => activity.kind === "speak")?.pronunciation?.state, composed.activities.find((activity) => activity.kind === "speak")?.pronunciation?.state);
});

test("pullDailySession preserves a valid pre-fingerprint v2 state without erasing progress", async () => {
  const legacyV2 = structuredClone(composed);
  const pronunciation = legacyV2.activities.find((activity) => activity.kind === "speak").pronunciation;
  pronunciation.state.contentHash = dailyPronunciationLegacyContentHash(pronunciation.game, pronunciation.targets);
  serve(legacyV2);
  const pulled = await pullDailySession(PROFILE, DAY);
  assert.equal(pulled?.activities.find((activity) => activity.kind === "speak")?.pronunciation?.state?.contentHash, pronunciation.state.contentHash);
});

test("pullDailySession strips private and unknown nested fields", async () => {
  const injected = structuredClone(composed);
  injected.email = "private@example.test";
  injected.activities[0].privateNote = "secret";
  injected.activities.find((activity) => activity.pronunciation).pronunciation.targets[0].providerPayload = { raw: true };
  serve(injected);
  const pulled = await pullDailySession(PROFILE, DAY);
  assert.ok(pulled);
  assert.equal("email" in pulled, false);
  assert.equal("privateNote" in pulled.activities[0], false);
  assert.equal("providerPayload" in pulled.activities.find((activity) => activity.pronunciation).pronunciation.targets[0], false);
});

test("pullDailySession rejects malformed and unbounded v2 arrays", async () => {
  const malformed = structuredClone(composed);
  malformed.activities.find((activity) => activity.pronunciation).pronunciation.state.attemptEvents = Array.from({ length: 10 }, (_, index) => ({ id: `${index}1111111-1111-4111-8111-111111111111`, targetIndex: 0, outcome: "retry", score: 50, ordinal: 1, at: index }));
  serve(malformed);
  assert.equal(await pullDailySession(PROFILE, DAY), null);
});

test("pullDailySession rejects a v2 day whose required speaking game is diagnostic-only word stress", async () => {
  const diagnostic = structuredClone(composed);
  const lesson = LESSONS.find((entry) => entry.id === "word-stress");
  const itemPool = lesson.items.map((item) => ({ ...item, lessonId: lesson.id }));
  const targets = itemPool.slice(0, 3);
  const pronunciation = {
    mode: "scored", game: "sound-sprint", selectionSource: "curriculum-fallback", feature: "word-stress",
    targets, itemPool, state: createDailyPronunciationGameState("sound-sprint", targets, itemPool),
  };
  const speaking = diagnostic.activities.find((activity) => activity.kind === "speak");
  speaking.pronunciation = pronunciation;
  speaking.targetIds = targets.map((item) => item.id);
  speaking.sourceId = lesson.id;
  serve(diagnostic);
  assert.equal(await pullDailySession(PROFILE, DAY), null);
});

test("pullDailySession preserves and round-trips the shipped bounded v1 pronunciation shape", async () => {
  // Literal wire fixture from the Task 7 v1 contract at 2e8b0b2: no state,
  // itemPool, stages, sourceTarget, or lessonId existed on pronunciation.
  const historicalPronunciation = {
    mode: "scored", game: "sound-sprint", selectionSource: "due-item", feature: "th",
    targets: [
      { id: "th:three", text: "three", ipa: "/θriː/", mouthHint: "TH then glide to r — tongue starts between the teeth.", kind: "word", categoryId: "th", phoneme: "θ" },
      { id: "th:both", text: "both", ipa: "/boʊθ/", mouthHint: "End with tongue between teeth, just air.", kind: "word", categoryId: "th", phoneme: "θ" },
      { id: "th:thank", text: "thank", ipa: "/θæŋk/", mouthHint: "Air-only TH at the start — not 't', not 's'.", kind: "word", categoryId: "th", phoneme: "θ" },
    ],
  };
  const legacy = { ...composed, version: 1, activities: composed.activities.map((activity) => {
    const bounded = { ...activity };
    if (bounded.pronunciation) {
      bounded.pronunciation = { ...historicalPronunciation, privateProviderPayload: { transcript: "secret" } };
    }
    return bounded;
  }) };
  serve(legacy, 1);
  const pulled = await pullDailySession(PROFILE, DAY);
  const pronunciation = pulled?.activities.find((activity) => activity.kind === "speak")?.pronunciation;
  assert.equal(pulled?.version, 1);
  assert.deepEqual(pronunciation?.targets, legacy.activities.find((activity) => activity.kind === "speak").pronunciation.targets);
  assert.equal("privateProviderPayload" in pronunciation, false);
  const requests = [];
  globalThis.fetch = async (input, init = {}) => {
    requests.push({ input: String(input), init });
    return new Response(JSON.stringify(pulled), { status: 200, headers: { "content-type": "application/json" } });
  };
  assert.equal(await deliverQueued("daily-session", PROFILE, pulled), true);
  const pushed = JSON.parse(String(requests[0].init.body)).p_payload;
  assert.deepEqual(pushed.activities.find((activity) => activity.kind === "speak").pronunciation, pronunciation);
});

test("pullDailySession rejects a fabricated Beat partner absent from authored curriculum", async () => {
  const pairs = LESSONS.find((lesson) => lesson.id === "i-vs-ii");
  const pairSource = pairs.items[0];
  const beat = Array.from({ length: 96 }, (_, offset) => composeDailySession({
    profileId: PROFILE, day: `2027-01-${String(offset + 1).padStart(2, "0")}`, now: 1_800_000_000_000,
    level: "A1", path: "general", lessons: [pairs], scenarios: [scenario],
    progress: [{ itemId: pairSource.id, lessonId: pairs.id, categoryId: pairSource.categoryId, phoneme: pairSource.phoneme, attempts: 1, passes: 0, box: 1, dueAt: 0, lastResult: "fail", lastScore: 50, updatedAt: 1 }],
  })).find((plan) => plan.activities.some((activity) => activity.pronunciation?.game === "beat-the-twin"));
  assert.ok(beat);
  beat.day = DAY;
  beat.id = `daily:${PROFILE}:${DAY}`;
  const pronunciation = beat.activities.find((activity) => activity.pronunciation).pronunciation;
  const target = pronunciation.targets[0];
  pronunciation.itemPool = pronunciation.itemPool.filter((item) => item.pairId !== target.pairId || item.id === target.id);
  pronunciation.itemPool.push({ ...target, id: "fabricated:partner", text: "fabricated" });
  serve(beat);
  assert.equal(await pullDailySession(PROFILE, DAY), null);
});

test("pullDailySession rejects a Beat choice from an unrelated authored pair", async () => {
  const pairs = LESSONS.find((lesson) => lesson.id === "i-vs-ii");
  const pairSource = pairs.items[0];
  const beat = Array.from({ length: 96 }, (_, offset) => composeDailySession({
    profileId: PROFILE, day: `2027-04-${String(offset + 1).padStart(2, "0")}`, now: 1_800_000_000_000,
    level: "A1", path: "general", lessons: [pairs], scenarios: [scenario],
    progress: [{ itemId: pairSource.id, lessonId: pairs.id, categoryId: pairSource.categoryId, phoneme: pairSource.phoneme, attempts: 1, passes: 0, box: 1, dueAt: 0, lastResult: "fail", lastScore: 50, updatedAt: 1 }],
  })).find((plan) => plan.activities.some((activity) => activity.pronunciation?.game === "beat-the-twin"));
  assert.ok(beat);
  beat.day = DAY;
  beat.id = `daily:${PROFILE}:${DAY}`;
  const pronunciation = beat.activities.find((activity) => activity.pronunciation).pronunciation;
  const target = pronunciation.targets[0];
  const unrelated = pronunciation.itemPool.find((item) => item.pairId && item.pairId !== target.pairId);
  assert.ok(unrelated);
  pronunciation.state = advanceDailyPronunciationGame(pronunciation.state, { type: "listen", targetIndex: 0 });
  pronunciation.state = advanceDailyPronunciationGame(pronunciation.state, { type: "choose", targetIndex: 0, choiceId: unrelated.id });
  serve(beat);
  assert.equal(await pullDailySession(PROFILE, DAY), null);
});

test("pullDailySession rejects fabricated Echo stage text", async () => {
  const lesson = LESSONS.find((entry) => entry.id === "connected-speech");
  const echoSource = lesson.items.find((item) => item.id === "connected-speech:phrase-1");
  const echo = Array.from({ length: 96 }, (_, offset) => composeDailySession({
    profileId: PROFILE, day: `2028-02-${String(offset + 1).padStart(2, "0")}`, now: 1_800_000_000_000,
    level: "A1", path: "general", lessons: [lesson], scenarios: [scenario],
    progress: [{ itemId: echoSource.id, lessonId: lesson.id, categoryId: echoSource.categoryId, phoneme: echoSource.phoneme, attempts: 1, passes: 0, box: 1, dueAt: 0, lastResult: "fail", lastScore: 50, updatedAt: 1 }],
  })).find((plan) => plan.activities.some((activity) => activity.pronunciation?.game === "echo-chain"));
  assert.ok(echo);
  echo.day = DAY;
  echo.id = `daily:${PROFILE}:${DAY}`;
  echo.activities.find((activity) => activity.pronunciation).pronunciation.stages[1].text = "A fabricated coffee sentence";
  serve(echo);
  assert.equal(await pullDailySession(PROFILE, DAY), null);
});

test("pullDailySession rejects forged Call grading metadata even with a recomputed fingerprint", async () => {
  const lesson = LESSONS.find((entry) => entry.id === "th");
  const callSource = lesson.items[0];
  const call = Array.from({ length: 96 }, (_, offset) => composeDailySession({
    profileId: PROFILE, day: `2029-03-${String(offset + 1).padStart(2, "0")}`, now: 1_800_000_000_000,
    level: "A1", path: "general", lessons: [lesson], scenarios: [scenario],
    progress: [{ itemId: callSource.id, lessonId: lesson.id, categoryId: callSource.categoryId, phoneme: callSource.phoneme, attempts: 1, passes: 0, box: 1, dueAt: 0, lastResult: "fail", lastScore: 50, updatedAt: 1 }],
  })).find((plan) => plan.activities.some((activity) => activity.pronunciation?.game === "call-rescue"));
  assert.ok(call);
  call.day = DAY;
  call.id = `daily:${PROFILE}:${DAY}`;
  const pronunciation = call.activities.find((activity) => activity.pronunciation).pronunciation;
  pronunciation.targets[1].mouthHint = "forged grading hint";
  pronunciation.state.contentHash = dailyPronunciationContentHash(pronunciation.game, pronunciation.targets, pronunciation.itemPool);
  serve(call);
  assert.equal(await pullDailySession(PROFILE, DAY), null);
});

test("a validated v2 pull merges concurrent device evidence to the canonical golden state", async () => {
  const local = structuredClone(composed);
  const remote = structuredClone(composed);
  const localPronunciation = local.activities.find((activity) => activity.pronunciation).pronunciation;
  const remotePronunciation = remote.activities.find((activity) => activity.pronunciation).pronunciation;
  const retry = {
    type: "attempt",
    event: { id: "11111111-1111-4111-8111-111111111111", targetIndex: 0, ordinal: 1, outcome: "retry", score: 58, at: 20 },
  };
  const mastery = {
    type: "attempt",
    event: { id: "22222222-2222-4222-8222-222222222222", targetIndex: 0, ordinal: 1, outcome: "mastered", score: 91, at: 30 },
  };
  localPronunciation.state = advanceDailyPronunciationGame(localPronunciation.state, retry);
  remotePronunciation.state = advanceDailyPronunciationGame(remotePronunciation.state, mastery);
  local.updatedAt += 1;
  remote.updatedAt += 2;
  serve(remote);
  const pulled = await pullDailySession(PROFILE, DAY);
  assert.ok(pulled);
  const merged = mergeDailySessions(local, pulled);
  const state = merged.activities.find((activity) => activity.pronunciation).pronunciation.state;
  assert.deepEqual(state.attemptEvents.map((event) => event.id), [mastery.event.id, retry.event.id]);
  assert.equal(state.sessions[0].firstValidScore, 91);
  assert.equal(state.sessions[0].status, "mastered");
});
