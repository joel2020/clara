import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PracticeItem } from "@/lib/db/types";
import type { DailyPronunciationActivity, PronunciationGameKind } from "@/lib/daily-session";
import { PronunciationCoachRound, PronunciationGame } from "./pronunciation-game";
import { advanceSoundSprint, initialSoundSprintState } from "./sound-sprint";
import { chooseTwin, completeTwinSpeech, initialTwinState } from "./beat-the-twin";
import { buildEchoChain, completeEchoChunk, initialEchoState } from "./echo-chain";
import { buildCallRepair, completeCallRescue, initialCallRescueState } from "./call-rescue";
import { ActivityShell } from "@/components/daily-session/activity-shell";
import { advanceDailyPronunciationGame, createDailyPronunciationGameState } from "@/lib/speech/daily-pronunciation-game";
import { StalePracticeBindingError } from "@/lib/db/repository";

const boundaries = vi.hoisted(() => ({
  lang: "en" as "en" | "es",
  coach: null as null | Record<string, unknown>,
  options: null as null | Record<string, unknown>,
  start: vi.fn(), stop: vi.fn(), cancel: vi.fn(), resetSession: vi.fn(), skipTechnical: vi.fn(),
  play: vi.fn((options?: { onStart?: () => void }) => options?.onStart?.()), stopAudio: vi.fn(),
  currentBinding: { account: "b" } as object,
  replaceCorrupt: vi.fn(),
}));

vi.mock("@/lib/hooks/useSettings", () => ({
  useSettings: () => ({ settings: { coachLanguage: boundaries.lang, recognitionLang: "en-US", speechRate: 0.9, voiceURI: undefined, onboarding: { level: "A1" } } }),
}));
vi.mock("@/lib/hooks/useSpeechSupport", () => ({ useSpeechSupport: () => ({ recognition: true, synthesis: true }) }));
vi.mock("@/components/lumi", () => ({ Lumi: () => <div aria-label="Lumi">Lumi</div> }));
vi.mock("@/lib/speech/player", () => ({
  playPronunciation: boundaries.play,
  stopPronunciation: boundaries.stopAudio,
}));
vi.mock("@/lib/db", () => ({ repo: { capturePracticeBinding: () => boundaries.currentBinding, replaceCorruptDailyPronunciation: boundaries.replaceCorrupt } }));
vi.mock("./use-pronunciation-coach", () => ({
  usePronunciationCoach: (options: Record<string, unknown>) => { boundaries.options = options; return boundaries.coach; },
}));

const targets = [
  { id: "th:three", text: "three", ipa: "/θɹiː/", mouthHint: "Tongue between teeth.", kind: "word", categoryId: "th", phoneme: "θ", pairId: "three-tree" },
  { id: "th:Thursday", text: "Thursday", ipa: "/ˈθɝːzdeɪ/", mouthHint: "Start with air.", kind: "word", categoryId: "th", phoneme: "θ", pairId: "thursday-tursday" },
  { id: "th:thank-you", text: "Thank you", ipa: "/ˈθæŋk ju/", mouthHint: "Keep the th airy.", kind: "phrase", categoryId: "th", phoneme: "θ", pairId: "thank-tank" },
] satisfies [PracticeItem, PracticeItem, PracticeItem];
const twin: PracticeItem = { ...targets[0], id: "th:tree", text: "tree", ipa: "/tɹiː/" };
const twin2: PracticeItem = { ...targets[1], id: "th:tursday", text: "Tursday" };
const twin3: PracticeItem = { ...targets[2], id: "th:tank-you", text: "Tank you" };
const attemptEvent = (targetIndex: 0 | 1 | 2, ordinal: 1 | 2 | 3, outcome: "mastered" | "retry", score = 92) => ({
  type: "attempt" as const,
  event: { id: `${targetIndex + 1}${ordinal}111111-1111-4111-8111-111111111111`, targetIndex, ordinal, outcome, score, at: ordinal },
});

function idleCoach(overrides: Record<string, unknown> = {}) {
  return {
    phase: "idle", feedback: null, recovery: null, ungradedHeard: "", session: { validAttempts: 0, status: "active" }, mode: "record",
    start: boundaries.start, stop: boundaries.stop, cancel: boundaries.cancel, practiceWithoutGrade: vi.fn(), retrySave: vi.fn(),
    skipTechnical: boundaries.skipTechnical, resetSession: boundaries.resetSession,
    ...overrides,
  };
}

function activity(game: PronunciationGameKind): DailyPronunciationActivity {
  if (game === "beat-the-twin") return { mode: "scored", game, selectionSource: "latam-prior", feature: "th", targets, itemPool: [...targets, twin, twin2, twin3] };
  if (game === "echo-chain") {
    const sourceTarget: PracticeItem = { ...targets[2], id: "connected-speech:phrase-1", text: "She sells seashells by the seashore", kind: "phrase", categoryId: "connected-speech", phoneme: "s/ʃ" };
    const stages = [
      { kind: "echo-chunk" as const, text: "she sells", stressMarkedText: "She SELLS" },
      { kind: "echo-chunk" as const, text: "she sells seashells", stressMarkedText: "She SELLS SEA-shells" },
      { kind: "echo-chunk" as const, text: "she sells seashells by the seashore", stressMarkedText: "She SELLS SEA-shells by the SEA-shore" },
    ] as const;
    return { mode: "scored", game, selectionSource: "latam-prior", feature: "th", sourceTarget, stages: [...stages], itemPool: [sourceTarget, ...targets], targets: stages.map((stage) => ({ ...sourceTarget, text: stage.text, stressMarkedText: stage.stressMarkedText })) as unknown as typeof targets };
  }
  if (game === "call-rescue") {
    const sourceTarget = targets[0];
    const stages = [
      { kind: "call-keyword" as const, text: "three", targetWord: "three" },
      { kind: "call-clarification" as const, text: "Did you say three?", targetWord: "three" },
      { kind: "call-confirmation" as const, text: "Let me confirm: three.", targetWord: "three" },
    ] as const;
    return { mode: "scored", game, selectionSource: "latam-prior", feature: "th", sourceTarget, stages: [...stages], itemPool: [...targets], targets: stages.map((stage) => ({ ...sourceTarget, kind: stage.kind === "call-keyword" ? "word" : "phrase", text: stage.text, targetWord: stage.targetWord })) as unknown as typeof targets };
  }
  return { mode: "scored", game, selectionSource: "latam-prior", feature: "th", targets, itemPool: [...targets] };
}

beforeEach(() => {
  vi.clearAllMocks();
  boundaries.lang = "en";
  boundaries.coach = idleCoach();
  boundaries.options = null;
  boundaries.currentBinding = { account: "b" };
});

it("passes the exact persisted target attempt state into the coach", () => {
  const value = activity("sound-sprint");
  let state = createDailyPronunciationGameState(value.game, value.targets, value.itemPool);
  state = advanceDailyPronunciationGame(state, attemptEvent(0, 1, "retry", 61));
  state = advanceDailyPronunciationGame(state, attemptEvent(0, 2, "retry", 61));
  render(<PronunciationGame activity={{ ...value, state }} lessonId="lesson" itemPool={[...targets, twin]} recognitionSupported combo={0} onComplete={vi.fn()} />);
  expect(boundaries.options?.initialState).toEqual({ validAttempts: 2, firstValidScore: 61, status: "active" });
});

it("Beat the Twin uses its validated authored pool and never falls back to one choice", async () => {
  const value = activity("beat-the-twin");
  render(<PronunciationGame activity={value} lessonId="lesson" itemPool={[...targets]} recognitionSupported combo={0} onComplete={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: /play sound/i }));
  expect(screen.getAllByRole("button", { name: /listening choice/i })).toHaveLength(2);
});

it("fails closed when persisted game content no longer matches the authored text", () => {
  const value = activity("sound-sprint");
  const state = createDailyPronunciationGameState(value.game, value.targets, value.itemPool);
  const changed = { ...value, state: { ...state, contentHash: "daily-pronunciation-v2:ffffffff" } };
  render(<PronunciationGame activity={changed} lessonId="lesson" itemPool={[...targets, twin]} recognitionSupported combo={0} onComplete={vi.fn()} />);
  expect(screen.getByRole("alert")).toHaveTextContent(/can't resume/i);
  expect(screen.getByRole("button", { name: /start a new safe session/i })).toBeVisible();
  expect(screen.queryByRole("button", { name: /record/i })).not.toBeInTheDocument();
});

it("automatically upgrades a started shipped v1 activity before practice opens", async () => {
  const authored = activity("sound-sprint");
  const migrated = { ...authored, state: createDailyPronunciationGameState(authored.game, authored.targets, authored.itemPool) };
  const { itemPool: _pool, state: _state, ...legacy } = migrated;
  void _pool;
  void _state;
  const binding = { account: "legacy-student" };
  boundaries.currentBinding = binding;
  boundaries.replaceCorrupt.mockResolvedValueOnce({ activities: [{ id: "speak", pronunciation: migrated }] });
  render(<PronunciationGame activity={legacy} day="2026-08-13" activityId="speak" lessonId="lesson" itemPool={[...targets]} recognitionSupported combo={0} onComplete={vi.fn()} />);
  expect(screen.getByRole("status")).toHaveTextContent(/preparing your earlier practice/i);
  expect(await screen.findByRole("button", { name: /record/i })).toBeVisible();
  expect(boundaries.replaceCorrupt).toHaveBeenCalledWith(binding, expect.objectContaining({ day: "2026-08-13", activityId: "speak" }));
});

it("gives shipped v1 recovery a bilingual Retry and Back path when canonical resolution fails", async () => {
  const authored = activity("sound-sprint");
  const { itemPool: _pool, ...legacy } = authored;
  void _pool;
  boundaries.lang = "es";
  boundaries.replaceCorrupt.mockRejectedValueOnce(new Error("canonical target unavailable"));
  render(<PronunciationGame activity={legacy} day="2026-08-14" activityId="speak" lessonId="lesson" itemPool={[...targets]} recognitionSupported combo={0} onComplete={vi.fn()} />);
  expect(await screen.findByText(/no pudimos recuperar esta práctica anterior/i)).toBeVisible();
  expect(screen.getByRole("button", { name: /^reintentar$/i })).toBeVisible();
  expect(screen.getByRole("button", { name: /^volver$/i })).toBeVisible();
});

it("handles safe-session recovery rejection with bilingual Retry and Back controls", async () => {
  const value = activity("sound-sprint");
  const state = createDailyPronunciationGameState(value.game, value.targets, value.itemPool);
  const corrupt = { ...value, state: { ...state, contentHash: "daily-pronunciation-v2:ffffffff" } };
  boundaries.replaceCorrupt.mockRejectedValueOnce(new Error("storage unavailable"));
  render(<PronunciationGame activity={corrupt} lessonId="lesson" itemPool={[...targets]} recognitionSupported combo={0} onComplete={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: /start a new safe session/i }));
  expect(await screen.findByText(/couldn't start a safe session/i)).toBeVisible();
  expect(screen.getByRole("button", { name: /^retry$/i })).toBeVisible();
  expect(screen.getByRole("button", { name: /^back$/i })).toBeVisible();
});

it("commits a rapid final Continue exactly once", async () => {
  const value = activity("sound-sprint");
  let state = createDailyPronunciationGameState(value.game, value.targets, value.itemPool);
  state = advanceDailyPronunciationGame(state, attemptEvent(0, 1, "mastered"));
  state = advanceDailyPronunciationGame(state, { type: "resolve", targetIndex: 0, resolution: "graded-mastered" });
  state = advanceDailyPronunciationGame(state, { type: "resolve", targetIndex: 1, resolution: "technical" });
  const terminalSession = { validAttempts: 1, firstValidScore: 92, status: "mastered" as const };
  state = advanceDailyPronunciationGame(state, attemptEvent(2, 1, "mastered"));
  boundaries.coach = idleCoach({
    phase: "feedback",
    feedback: {
      heard: targets[2].text,
      verdict: { policyVersion: "latam-v1", outcome: "mastered", reasons: [] },
      diagnosis: null,
      currentScore: 92,
      transition: { state: terminalSession, coachingStage: 1, rewardMultiplier: 1, xpAward: 10, masteryStars: 3, combo: 1, srsPass: true, canContinue: true },
    },
  });
  const save = vi.fn(async (savedState: unknown) => { void savedState; });
  render(<PronunciationGame activity={{ ...value, state }} lessonId="lesson" itemPool={[...targets, twin]} recognitionSupported combo={0} onStateChange={save} onComplete={vi.fn()} />);
  const button = screen.getByRole("button", { name: /continue/i });
  fireEvent.click(button);
  fireEvent.click(button);
  await act(async () => {});
  expect(save).toHaveBeenCalledOnce();
  expect(save.mock.calls[0]?.[0]).toMatchObject({ terminal: true, gradedTargets: 2, technicalTargets: 1 });
});

it("uses the graded commit's captured learner binding when Continue follows an account switch", async () => {
  const value = activity("sound-sprint");
  let state = createDailyPronunciationGameState(value.game, value.targets, value.itemPool);
  state = advanceDailyPronunciationGame(state, attemptEvent(0, 1, "mastered"));
  state = advanceDailyPronunciationGame(state, { type: "resolve", targetIndex: 0, resolution: "graded-mastered" });
  state = advanceDailyPronunciationGame(state, attemptEvent(1, 1, "mastered"));
  state = advanceDailyPronunciationGame(state, { type: "resolve", targetIndex: 1, resolution: "graded-mastered" });
  state = advanceDailyPronunciationGame(state, attemptEvent(2, 1, "mastered"));
  const bindingA = { account: "a" };
  boundaries.currentBinding = { account: "b" };
  const terminalSession = { validAttempts: 1, firstValidScore: 92, status: "mastered" as const };
  boundaries.coach = idleCoach({ phase: "feedback", feedback: {
    heard: targets[2].text, verdict: { policyVersion: "latam-v1", outcome: "mastered", reasons: [] }, diagnosis: null, currentScore: 92,
    transition: { state: terminalSession, coachingStage: 1, rewardMultiplier: 1, xpAward: 10, masteryStars: 3, combo: 1, srsPass: true, canContinue: true },
    commitBinding: bindingA,
  } });
  const save = vi.fn(async (savedState: unknown, savedBinding: unknown) => { void savedState; void savedBinding; });
  render(<PronunciationGame activity={{ ...value, state }} lessonId="lesson" itemPool={[...targets, twin]} recognitionSupported combo={0} onStateChange={save} onComplete={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: /continue/i }));
  expect(save.mock.calls[0]?.[1]).toBe(bindingA);
});

it("Save again reuses the failed checkpoint binding and fails closed after an account switch", async () => {
  const value = activity("sound-sprint");
  let state = createDailyPronunciationGameState(value.game, value.targets, value.itemPool);
  state = advanceDailyPronunciationGame(state, attemptEvent(0, 1, "mastered"));
  const bindingA = { account: "a" };
  const bindingB = { account: "b" };
  boundaries.currentBinding = bindingB;
  boundaries.coach = idleCoach({ phase: "feedback", feedback: {
    heard: targets[0].text, verdict: { policyVersion: "latam-v1", outcome: "mastered", reasons: [] }, diagnosis: null, currentScore: 92,
    transition: { state: { validAttempts: 1, firstValidScore: 92, status: "mastered" }, coachingStage: 1, rewardMultiplier: 1, xpAward: 10, masteryStars: 3, combo: 1, srsPass: true, canContinue: true },
    commitBinding: bindingA,
  } });
  const save = vi.fn()
    .mockRejectedValueOnce(new Error("storage unavailable"))
    .mockRejectedValueOnce(new StalePracticeBindingError());
  render(<PronunciationGame activity={{ ...value, state }} lessonId="lesson" itemPool={[...targets, twin]} recognitionSupported combo={0} onStateChange={save} onComplete={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: /continue/i }));
  await userEvent.click(await screen.findByRole("button", { name: /save again/i }));
  expect(save.mock.calls.map((call) => call[1])).toEqual([bindingA, bindingA]);
  expect(await screen.findByText(/account changed/i)).toBeVisible();
  expect(screen.getByRole("button", { name: /^back$/i })).toBeVisible();
  expect(screen.queryByRole("button", { name: /save again/i })).not.toBeInTheDocument();
});

it("uses Spanish guidance when the learner chose a Spanish coach", () => {
  boundaries.lang = "es";
  render(<PronunciationGame activity={activity("call-rescue")} lessonId="lesson" itemPool={[...targets, twin]} recognitionSupported combo={0} onComplete={vi.fn()} />);
  expect(screen.getByText(/convierte una palabra que no se entendió/i)).toBeVisible();
  expect(screen.getByText(/llamada en vivo/i)).toBeVisible();
});

describe("deterministic game state machines", () => {
  it("Sound Sprint ends after exactly three resolved utterances without inventing a pass", () => {
    let state = initialSoundSprintState();
    state = advanceSoundSprint(state, { mastered: false });
    state = advanceSoundSprint(state, { mastered: true });
    state = advanceSoundSprint(state, { mastered: false });
    expect(state).toEqual({ index: 2, resolved: 3, mastered: 1, done: true });
    expect(advanceSoundSprint(state, { mastered: true })).toEqual(state);
  });

  it("Beat the Twin requires a listening choice before scripted speaking", () => {
    let state = initialTwinState();
    expect(completeTwinSpeech(state, { mastered: true })).toEqual(state);
    state = chooseTwin(state, "th:tree", "th:three");
    expect(state).toMatchObject({ phase: "speaking", selectedId: "th:tree", heardCorrectly: false });
    state = completeTwinSpeech(state, { mastered: false });
    expect(state).toMatchObject({ index: 1, phase: "listening", resolved: 1, mastered: 0 });
  });

  it("Echo Chain preserves explicit stress marks while chunks grow", () => {
    expect(buildEchoChain(["I", "NEED", "help"])).toEqual(["I", "I NEED", "I NEED help"]);
    let state = initialEchoState();
    state = completeEchoChunk(state, { mastered: false });
    state = completeEchoChunk(state, { mastered: false });
    state = completeEchoChunk(state, { mastered: false });
    expect(state).toMatchObject({ done: true, resolved: 3, mastered: 0 });
  });

  it("Call Rescue turns one misunderstood word into a three-step repair and does not call exhaustion a pass", () => {
    expect(buildCallRepair("Thursday")).toEqual(["Thursday.", "Did you say Thursday?", "Let me confirm: Thursday."]);
    let state = initialCallRescueState();
    for (let i = 0; i < 3; i += 1) state = completeCallRescue(state, { mastered: false });
    expect(state).toEqual({ index: 2, resolved: 3, mastered: 0, done: true });
  });
});

it.each([
  ["sound-sprint", /sound sprint/i],
  ["beat-the-twin", /beat the twin/i],
  ["echo-chain", /echo chain/i],
  ["call-rescue", /call rescue/i],
] as const)("routes %s to a distinct responsive game", (game, heading) => {
  render(<PronunciationGame activity={activity(game)} lessonId="lesson" itemPool={[...targets, twin]} recognitionSupported combo={0} onComplete={vi.fn()} />);
  expect(screen.getByRole("heading", { name: heading })).toBeVisible();
  expect(screen.getByLabelText("Lumi")).toBeVisible();
});

it("Beat the Twin exposes accessible listening choices before the speaking target", async () => {
  boundaries.play.mockImplementationOnce(() => {});
  render(<PronunciationGame activity={activity("beat-the-twin")} lessonId="lesson" itemPool={[...targets, twin]} recognitionSupported combo={0} onComplete={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: /play sound/i }));
  expect(boundaries.play).toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: /^three/i })).not.toBeInTheDocument();
  await act(async () => { boundaries.play.mock.calls[0]?.[0]?.onStart?.(); });
  expect(screen.queryByRole("button", { name: /record three/i })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /^three/i }));
  expect(screen.getByText(/now say/i)).toBeVisible();
  expect(screen.getByRole("button", { name: /record three/i })).toBeVisible();
});

it("Beat the Twin fails closed without each target's authored pair", () => {
  const invalid = { ...activity("beat-the-twin"), itemPool: [...targets] };
  render(<PronunciationGame activity={invalid} lessonId="lesson" itemPool={[...targets]} recognitionSupported combo={0} onComplete={vi.fn()} />);
  expect(screen.getByRole("alert")).toHaveTextContent(/can't resume/i);
  expect(screen.queryByRole("button", { name: /play sound/i })).not.toBeInTheDocument();
});

it("the shared coach shows status, Stop, recovery, and cancels stale item work", async () => {
  boundaries.coach = idleCoach({ phase: "capturing" });
  const view = render(<PronunciationCoachRound item={targets[0]} lessonId="lesson" itemPool={targets} recognitionSupported combo={0} onResolved={vi.fn()} />);
  expect(screen.getByRole("status")).toHaveTextContent(/listening|recording/i);
  await userEvent.click(screen.getByRole("button", { name: /stop/i }));
  expect(boundaries.stop).toHaveBeenCalledOnce();

  boundaries.coach = idleCoach({ phase: "recovery", recovery: "no-speech" });
  view.rerender(<PronunciationCoachRound item={targets[1]} lessonId="lesson" itemPool={targets} recognitionSupported combo={0} onResolved={vi.fn()} />);
  expect(boundaries.cancel).toHaveBeenCalled();
  expect(screen.getByRole("status")).toHaveTextContent(/didn.t hear|no speech|try again/i);
  expect(screen.getByRole("button", { name: /try again/i })).toBeVisible();
  view.unmount();
  expect(boundaries.stopAudio).toHaveBeenCalled();
});

it("Beat the Twin stops old audio when its target changes or unmounts", () => {
  vi.useFakeTimers();
  try {
  const first = activity("beat-the-twin");
  const view = render(<PronunciationGame activity={first} lessonId="lesson" itemPool={[...targets, twin]} recognitionSupported combo={0} onComplete={vi.fn()} />);
  const replacement = { ...first, targets: [targets[1], targets[0], targets[2]] as [PracticeItem, PracticeItem, PracticeItem] };
  view.rerender(<PronunciationGame activity={replacement} lessonId="lesson" itemPool={[...targets, twin]} recognitionSupported combo={0} onComplete={vi.fn()} />);
  expect(boundaries.stopAudio).toHaveBeenCalled();
  const calls = boundaries.stopAudio.mock.calls.length;
  view.unmount();
  expect(boundaries.stopAudio.mock.calls.length).toBeGreaterThan(calls);
  expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});

it("renders the selected pronunciation game inside the daily speaking step", () => {
  const pronunciation = activity("sound-sprint");
  const speaking = {
    id: "speak", kind: "speak" as const, title: { en: "Speak", es: "Habla" }, targetIds: targets.map(({ id }) => id),
    sourceId: "th", reason: "weak-sound" as const, estimatedMinutes: 2, status: "active" as const, pronunciation,
  };
  const session = {
    id: "daily:test:2026-08-09", version: 1 as const, profileId: "test", day: "2026-08-09",
    objective: { en: "Speak clearly.", es: "Habla claro." }, outcome: { en: "Three lines.", es: "Tres frases." },
    assistance: "spanish-full" as const, activities: [speaking], currentActivityId: "speak", rewardClaimed: false,
    startedAt: 1, completedAt: null, createdAt: 1, updatedAt: 1,
  };
  render(<ActivityShell session={session} activity={speaking} lang="en" transitioning={false} onComplete={vi.fn()} />);
  expect(screen.getByRole("heading", { name: /sound sprint/i })).toBeVisible();
  expect(screen.queryByRole("link", { name: /open activity/i })).not.toBeInTheDocument();
});
