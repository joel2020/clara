import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PracticeItem } from "@/lib/db/types";
import type { AssessmentResult } from "@/lib/speech/azure-response";
import type { PronunciationDiagnosis } from "@/lib/speech/pronunciation-diagnosis";
import type { PronunciationVerdict } from "@/lib/speech/pronunciation-policy";
import type { PronunciationSessionState, PronunciationSessionTransition } from "@/lib/speech/pronunciation-session";
import { t } from "@/lib/i18n";
import { PronunciationFeedback } from "./pronunciation-feedback";
import { coachAssessmentEvidence, usePronunciationCoach } from "./use-pronunciation-coach";

const boundaries = vi.hoisted(() => ({
  createRecognition: vi.fn(),
  recordPracticeAttempt: vi.fn(),
  playPronunciation: vi.fn(),
  stopPronunciation: vi.fn(),
  getAttempts: vi.fn(),
  getAttemptsForPracticeBinding: vi.fn(),
  saveAttemptRecording: vi.fn(),
  capturePracticeBinding: vi.fn(),
}));

vi.mock("@/lib/speech/recognition", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/speech/recognition")>();
  return { ...actual, createRecognition: boundaries.createRecognition, recognitionMode: () => "instant" };
});
vi.mock("@/lib/practice", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/practice")>();
  return { ...actual, recordPracticeAttempt: boundaries.recordPracticeAttempt };
});
vi.mock("@/lib/db", () => ({ repo: {
  capturePracticeBinding: boundaries.capturePracticeBinding,
  getAttempts: boundaries.getAttempts,
  getAttemptsForPracticeBinding: boundaries.getAttemptsForPracticeBinding,
  saveAttemptRecording: boundaries.saveAttemptRecording,
} }));
vi.mock("@/lib/speech/player", () => ({
  playPronunciation: boundaries.playPronunciation,
  stopPronunciation: boundaries.stopPronunciation,
}));
vi.mock("@/components/lumi", () => ({
  Lumi: ({ className }: { className?: string }) => <div data-testid="lumi" className={className}>Lumi</div>,
}));

const item: PracticeItem = {
  id: "th:three",
  text: "three",
  ipa: "/θɹiː/",
  mouthHint: "Tongue tip between the teeth.",
  kind: "word",
  categoryId: "th",
  phoneme: "θ",
  pairId: "three-tree",
};

const assessment: AssessmentResult = {
  provider: "azure",
  providerStatus: "valid",
  recognizedText: "tree",
  pronunciationScore: 76,
  accuracyScore: 72,
  completenessScore: 100,
  targetRecognized: true,
  targetPhonemeScore: 61,
  words: [{ word: "three", accuracyScore: 72, errorType: "Mispronunciation", phonemes: [{ phoneme: "θ", accuracyScore: 61 }] }],
};

const diagnosis: PronunciationDiagnosis = {
  target: "/θ/ and /ð/",
  observed: "/t/",
  cueKey: "pronunciation.cue.es.th",
  contrast: { target: "/θ/ and /ð/", likelySubstitution: "/t/, /d/, or /s/" },
  source: "provider",
};

function verdict(outcome: PronunciationVerdict["outcome"]): PronunciationVerdict {
  return { policyVersion: "latam-v1", outcome, reasons: outcome === "mastered" ? [] : ["below-threshold-target-phoneme-score"] };
}

function transition(overrides: Partial<PronunciationSessionTransition> = {}): PronunciationSessionTransition {
  return {
    state: { validAttempts: 1, firstValidScore: 76, status: "active" },
    coachingStage: 2,
    rewardMultiplier: 0,
    xpAward: 0,
    masteryStars: 0,
    combo: 0,
    srsPass: false,
    canContinue: false,
    ...overrides,
  };
}

describe("PronunciationFeedback", () => {
  beforeEach(() => {
    boundaries.createRecognition.mockReset();
    boundaries.recordPracticeAttempt.mockReset();
    boundaries.stopPronunciation.mockReset();
    boundaries.saveAttemptRecording.mockReset();
    boundaries.getAttempts.mockReset();
    boundaries.getAttempts.mockResolvedValue([]);
    boundaries.getAttemptsForPracticeBinding.mockReset();
    boundaries.getAttemptsForPracticeBinding.mockResolvedValue([]);
    boundaries.capturePracticeBinding.mockReset();
    boundaries.capturePracticeBinding.mockReturnValue({ binding: "captured-account" });
  });

  it("labels transcript-only practice as ungraded without ambiguity in English and Spanish", () => {
    expect(t("pronPracticeUngraded", "en")).toBe("Transcript-only practice — ungraded");
    expect(t("pronPracticeUngraded", "es")).toBe("Práctica solo con transcripción — sin calificación");
    expect(t("pronUngradedBody", "en")).toMatch(/pronunciation was not graded/i);
    expect(t("pronUngradedBody", "es")).toMatch(/no calificó tu pronunciación/i);
  });

  it("offers a dedicated save retry without presenting another microphone attempt", async () => {
    const retrySave = vi.fn();
    render(
      <PronunciationFeedback
        target={item.text}
        heard="three"
        verdict={verdict("mastered")}
        diagnosis={null}
        transition={transition({ state: { validAttempts: 1, firstValidScore: 94, status: "mastered" }, canContinue: true })}
        lang="en"
        saveFailed
        onRetrySave={retrySave}
        onListen={vi.fn()}
        onRetry={vi.fn()}
        onContinue={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { name: /couldn.t save/i })).toBeVisible();
    expect(screen.queryByRole("button", { name: /try again|record/i })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /retry save/i }));
    expect(retrySave).toHaveBeenCalledOnce();
  });

  it("explains an account switch without offering a retry into the new account", () => {
    render(
      <PronunciationFeedback
        target={item.text} heard="three" verdict={verdict("mastered")} diagnosis={null}
        transition={transition({ state: { validAttempts: 1, firstValidScore: 94, status: "mastered" }, canContinue: true })}
        lang="en" saveFailure="account-changed" onRetrySave={vi.fn()}
        onListen={vi.fn()} onRetry={vi.fn()} onContinue={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { name: /account changed/i })).toBeVisible();
    expect(screen.getByText(/record it again.*not added to the current account/i)).toBeVisible();
    expect(screen.queryByRole("button", { name: /retry save/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).toBeVisible();
  });

  it.each([
    ["mastered", "Clear"],
    ["retry", "Try again"],
  ] as const)("uses icon and text for the %s verdict", (outcome, label) => {
    render(
      <PronunciationFeedback
        target={item.text}
        heard="three"
        verdict={verdict(outcome)}
        diagnosis={outcome === "mastered" ? null : diagnosis}
        transition={transition(outcome === "mastered" ? { state: { validAttempts: 1, firstValidScore: 92, status: "mastered" }, rewardMultiplier: 1, xpAward: 10, masteryStars: 3, combo: 1, srsPass: true, canContinue: true } : {})}
        scores={assessment}
        lang="en"
        onListen={vi.fn()}
        onRetry={vi.fn()}
        onContinue={vi.fn()}
      />,
    );
    const heading = screen.getByRole("heading", { name: label });
    expect(heading.querySelector("svg")).not.toBeNull();
  });

  it("calls an exhausted third miss Almost and shows improvement plus a short challenge", () => {
    render(
      <PronunciationFeedback
        target={item.text}
        heard="tree"
        verdict={verdict("retry")}
        diagnosis={diagnosis}
        transition={transition({
          state: { validAttempts: 3, firstValidScore: 62, status: "practiced-not-mastered" },
          coachingStage: 3,
          rewardMultiplier: 0.25,
          xpAward: 3,
          dueDayOffset: 1,
          canContinue: true,
        })}
        currentScore={76}
        scores={assessment}
        lang="en"
        onListen={vi.fn()}
        onRetry={vi.fn()}
        onContinue={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { name: "Almost" }).querySelector("svg")).not.toBeNull();
    expect(screen.getByText(/improved from your first try/i)).toBeInTheDocument();
    expect(screen.queryByText(/14 points/i)).not.toBeInTheDocument();
    expect(screen.getByText(/mini challenge/i)).toBeInTheDocument();
  });

  it.each([
    [76, 62, /improved from your first try/i],
    [62, 62, /held steady from your first try/i],
    [52, 62, /dipped from your first try/i],
  ])("describes attempt-three progress qualitatively", (currentScore, firstValidScore, progressLabel) => {
    render(
      <PronunciationFeedback
        target={item.text}
        heard="tree"
        verdict={verdict("retry")}
        diagnosis={diagnosis}
        transition={transition({
          state: { validAttempts: 3, firstValidScore, status: "practiced-not-mastered" },
          coachingStage: 3,
          canContinue: true,
        })}
        currentScore={currentScore}
        lang="en"
        onListen={vi.fn()}
        onRetry={vi.fn()}
        onContinue={vi.fn()}
      />,
    );
    expect(screen.getByText(progressLabel)).toBeInTheDocument();
  });

  it("uses a safe curriculum partner contrast on attempt two when diagnosis has none", () => {
    render(
      <PronunciationFeedback
        target={item.text}
        heard="tree"
        verdict={verdict("retry")}
        diagnosis={null}
        contrast={{ target: "three", likelySubstitution: "tree" }}
        transition={transition()}
        lang="en"
        onListen={vi.fn()}
        onRetry={vi.fn()}
        onContinue={vi.fn()}
      />,
    );
    expect(screen.getAllByText("three").length).toBeGreaterThan(1);
    expect(screen.getByText("tree")).toBeInTheDocument();
  });

  it("shows one correction, its Spanish physical cue, heard text, both listening speeds, and retry", async () => {
    const user = userEvent.setup();
    const onListen = vi.fn();
    const onRetry = vi.fn();
    render(
      <PronunciationFeedback
        target={item.text}
        heard="tree"
        verdict={verdict("retry")}
        diagnosis={diagnosis}
        transition={transition()}
        scores={assessment}
        lang="en"
        onListen={onListen}
        onRetry={onRetry}
        onContinue={vi.fn()}
      />,
    );

    expect(screen.getByText(/Clara heard/i)).toHaveTextContent("tree");
    expect(screen.getAllByTestId("pronunciation-correction")).toHaveLength(1);
    expect(screen.getByText(/Pon la punta de la lengua entre los dientes/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /listen slowly/i }));
    await user.click(screen.getByRole("button", { name: /listen normally/i }));
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(onListen).toHaveBeenNthCalledWith(1, 0.65);
    expect(onListen).toHaveBeenNthCalledWith(2, 1);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("keeps raw scores closed by default and announces politely", async () => {
    const user = userEvent.setup();
    render(
      <PronunciationFeedback
        target={item.text}
        heard="tree"
        verdict={verdict("retry")}
        diagnosis={diagnosis}
        transition={transition()}
        scores={assessment}
        lang="en"
        onListen={vi.fn()}
        onRetry={vi.fn()}
        onContinue={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("Pronunciation 76")).not.toBeVisible();
    await user.click(screen.getByText("Score details"));
    expect(screen.getByText("Pronunciation 76")).toBeInTheDocument();
  });

  it("separates Lumi from the target and microphone lanes and exposes focus/touch/reduced-motion affordances", () => {
    render(
      <PronunciationFeedback
        target={item.text}
        heard="tree"
        verdict={verdict("retry")}
        diagnosis={diagnosis}
        transition={transition()}
        scores={assessment}
        lang="en"
        onListen={vi.fn()}
        onRetry={vi.fn()}
        onContinue={vi.fn()}
      />,
    );
    const layout = screen.getByTestId("pronunciation-feedback-layout");
    expect(layout.className).toContain("grid");
    expect(screen.getByTestId("lumi-lane")).not.toContainElement(screen.getByTestId("target-lane"));
    expect(screen.getByTestId("lumi").className).toContain("[&_img]:z-10");
    const retry = screen.getByRole("button", { name: /try again/i });
    expect(retry.className).toContain("min-h-11");
    expect(retry.className).toContain("focus-visible:");
    expect(screen.getByTestId("sound-path").className).toContain("motion-reduce:");
  });

  it("offers only safe recovery actions for a provider outage", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    const transcriptPractice = vi.fn();
    const technicalSkip = vi.fn();
    render(
      <PronunciationFeedback
        target={item.text}
        heard=""
        verdict={{ policyVersion: "latam-v1", outcome: "technical-skip", reasons: ["provider-technical-skip"] }}
        diagnosis={null}
        transition={transition({ state: { validAttempts: 0, status: "active" }, coachingStage: 1 })}
        lang="en"
        onListen={vi.fn()}
        onRetry={retry}
        onContinue={vi.fn()}
        onTranscriptPractice={transcriptPractice}
        onTechnicalSkip={technicalSkip}
      />,
    );
    expect(screen.getByText(/not graded/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /retry scoring/i }));
    await user.click(screen.getByRole("button", { name: /transcript-only practice/i }));
    await user.click(screen.getByRole("button", { name: /skip because of this issue/i }));
    expect(retry).toHaveBeenCalledOnce();
    expect(transcriptPractice).toHaveBeenCalledOnce();
    expect(technicalSkip).toHaveBeenCalledOnce();
  });

  it("hides retry after a terminal result and exposes only Continue", () => {
    render(
      <PronunciationFeedback
        target={item.text}
        heard="three"
        verdict={verdict("mastered")}
        diagnosis={null}
        transition={transition({
          state: { validAttempts: 1, firstValidScore: 92, status: "mastered" },
          canContinue: true,
        })}
        lang="en"
        onListen={vi.fn()}
        onRetry={vi.fn()}
        onContinue={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
  });

  it("uses foreground text on warning surfaces in light and dark themes", () => {
    const { container } = render(
      <div className="dark">
        <PronunciationFeedback
          target={item.text}
          heard=""
          verdict={{ policyVersion: "latam-v1", outcome: "technical-skip", reasons: ["provider-technical-skip"] }}
          diagnosis={null}
          transition={transition({ state: { validAttempts: 0, status: "active" }, coachingStage: 1 })}
          lang="en"
          onListen={vi.fn()}
          onRetry={vi.fn()}
          onContinue={vi.fn()}
        />
      </div>,
    );
    expect(container.querySelector(".text-warn-foreground")).toBeNull();
    expect(screen.getByRole("heading", { name: /not graded/i })).toHaveClass("text-foreground");
  });
});

describe("usePronunciationCoach", () => {
  beforeEach(() => {
    boundaries.createRecognition.mockReset();
    boundaries.recordPracticeAttempt.mockReset();
    boundaries.stopPronunciation.mockReset();
    boundaries.saveAttemptRecording.mockReset();
    boundaries.getAttempts.mockReset();
    boundaries.getAttempts.mockResolvedValue([]);
    boundaries.getAttemptsForPracticeBinding.mockReset();
    boundaries.getAttemptsForPracticeBinding.mockResolvedValue([]);
    boundaries.capturePracticeBinding.mockReset();
    boundaries.capturePracticeBinding.mockReturnValue({ binding: "captured-account" });
  });

  it("derives target identity and partner substitution from normalized recognized text", () => {
    const partner = { ...item, id: "th:tree", text: "tree" };
    const evidence = coachAssessmentEvidence(
      { ...assessment, recognizedText: "  TREE!  ", targetRecognized: true, minimalPairSubstitution: false },
      item,
      [item, partner],
    );
    expect(evidence.targetRecognized).toBe(false);
    expect(evidence.minimalPairSubstitution).toBe(true);
  });

  it("grades Call Rescue phrase stages against the authored target word", () => {
    const callStage = { ...item, kind: "phrase" as const, text: "Did you say three?", targetWord: "three" };
    const evidence = coachAssessmentEvidence({
      ...assessment,
      recognizedText: "Did you say tree?",
      words: [
        { word: "Did", accuracyScore: 98, phonemes: [] },
        { word: "you", accuracyScore: 97, phonemes: [] },
        { word: "say", accuracyScore: 96, phonemes: [] },
        { word: "three", accuracyScore: 58, phonemes: [{ phoneme: "θ", accuracyScore: 55 }] },
      ],
    }, callStage, []);
    expect(evidence.lowestTargetWordScore).toBe(58);
  });

  it("orchestrates capture through strict verdict, diagnosis, and attempt-two transition", async () => {
    boundaries.createRecognition.mockReturnValue({
      result: Promise.resolve({ transcript: "tree", alternatives: ["tree"], confidence: 1, assessment }),
      stop: vi.fn(),
      cancel: vi.fn(),
    });
    boundaries.recordPracticeAttempt.mockResolvedValue({
      score: { score: 76, passed: false, heard: "tree", heardPartner: false, feedback: "Try again", feedbackKey: "close", gradingOutcome: "retry" },
      recorded: true,
      rewards: { xpGain: 0, newXp: 0, leveledUp: false, oldLevel: 1, newLevel: 1, combo: 0, starsEarned: 0, starTotal: 0, streakIncreased: false, currentStreak: 0, freezeUsed: false, freezeEarned: false, dailyGoalMet: false, unlocked: [] },
      diagnosis: { misses: [], sound: null },
      assessment,
    });

    const { result } = renderHook(() => usePronunciationCoach({
      item,
      lessonId: "th",
      itemPool: [item],
      combo: 0,
      recognitionLang: "en-US",
      cefr: "A1",
    }));
    await act(async () => result.current.start());

    expect(result.current.phase).toBe("feedback");
    expect(result.current.feedback?.verdict.outcome).toBe("retry");
    expect(result.current.feedback?.diagnosis?.cueKey).toBe("pronunciation.cue.es.th");
    expect(result.current.feedback?.transition.coachingStage).toBe(2);
    expect(result.current.feedback?.transition.state.validAttempts).toBe(1);
    expect(boundaries.recordPracticeAttempt.mock.calls[0]?.[0].pronunciation.transition.coachingStage).toBe(2);
    expect(boundaries.capturePracticeBinding.mock.invocationCallOrder[0]).toBeLessThan(boundaries.createRecognition.mock.invocationCallOrder[0]);
    expect(boundaries.recordPracticeAttempt.mock.calls[0]?.[0].persistenceBinding).toBe(boundaries.capturePracticeBinding.mock.results[0]?.value);
    expect(boundaries.getAttemptsForPracticeBinding).toHaveBeenCalledWith(boundaries.capturePracticeBinding.mock.results[0]?.value, { limit: 80 });
    expect(boundaries.getAttempts).not.toHaveBeenCalled();
  });

  it("sends daily attempt evidence through the same atomic commit", async () => {
    boundaries.createRecognition.mockReturnValue({
      result: Promise.resolve({ transcript: "tree", alternatives: ["tree"], confidence: 1, assessment }),
      stop: vi.fn(), cancel: vi.fn(),
    });
    boundaries.recordPracticeAttempt.mockResolvedValue({
      score: { score: 76, passed: false, heard: "tree", heardPartner: false, feedback: "Try again", feedbackKey: "close", gradingOutcome: "retry" },
      recorded: true,
      rewards: { xpGain: 0, newXp: 0, leveledUp: false, oldLevel: 1, newLevel: 1, combo: 0, starsEarned: 0, starTotal: 0, streakIncreased: false, currentStreak: 0, freezeUsed: false, freezeEarned: false, dailyGoalMet: false, unlocked: [] },
      diagnosis: { misses: [], sound: null }, assessment,
    });
    const checkpoint = vi.fn(async () => {});
    const dailyPronunciation = { day: "2026-08-09", activityId: "speak", contentHash: "daily-v2:test", targetIndex: 0 as const };
    const { result } = renderHook(() => usePronunciationCoach({ item, lessonId: "th", itemPool: [item], combo: 0, recognitionLang: "en-US", cefr: "A1", onStateChange: checkpoint, dailyPronunciation }));
    await act(async () => result.current.start());
    expect(checkpoint).not.toHaveBeenCalled();
    expect(boundaries.recordPracticeAttempt.mock.calls[0]?.[0].dailyPronunciation).toEqual(dailyPronunciation);
  });

  it("does not cancel the pending attempt when the checkpoint rerenders the same target", async () => {
    boundaries.createRecognition.mockReturnValue({
      result: Promise.resolve({ transcript: "tree", alternatives: ["tree"], confidence: 1, assessment }),
      stop: vi.fn(), cancel: vi.fn(),
    });
    boundaries.recordPracticeAttempt.mockResolvedValue({
      score: { score: 76, passed: false, heard: "tree", heardPartner: false, feedback: "Try again", feedbackKey: "close", gradingOutcome: "retry" },
      recorded: true,
      rewards: { xpGain: 0, newXp: 0, leveledUp: false, oldLevel: 1, newLevel: 1, combo: 0, starsEarned: 0, starTotal: 0, streakIncreased: false, currentStreak: 0, freezeUsed: false, freezeEarned: false, dailyGoalMet: false, unlocked: [] },
      diagnosis: { misses: [], sound: null }, assessment,
    });
    const rerenderHook: { current?: (props: { initial: PronunciationSessionState }) => void } = {};
    const checkpoint = vi.fn(async (next: PronunciationSessionState) => { rerenderHook.current?.({ initial: next }); });
    const hook = renderHook(({ initial }) => usePronunciationCoach({ item, lessonId: "th", itemPool: [item], combo: 0, recognitionLang: "en-US", cefr: "A1", initialState: initial, onStateChange: checkpoint }), {
      initialProps: { initial: { validAttempts: 0, status: "active" } as PronunciationSessionState },
    });
    rerenderHook.current = hook.rerender;
    await act(async () => hook.result.current.start());
    expect(checkpoint).not.toHaveBeenCalled();
    expect(boundaries.recordPracticeAttempt).toHaveBeenCalledOnce();
    expect(hook.result.current.session.validAttempts).toBe(1);
  });

  it("ends three valid misses as practiced-not-mastered without inventing a pass", async () => {
    boundaries.createRecognition.mockImplementation(() => ({
      result: Promise.resolve({ transcript: "tree", alternatives: ["tree"], confidence: 1, assessment }),
      stop: vi.fn(),
      cancel: vi.fn(),
    }));
    boundaries.recordPracticeAttempt.mockResolvedValue({
      score: { score: 76, passed: false, heard: "tree", heardPartner: false, feedback: "Try again", feedbackKey: "close", gradingOutcome: "retry" },
      recorded: true,
      rewards: { xpGain: 0, newXp: 0, leveledUp: false, oldLevel: 1, newLevel: 1, combo: 0, starsEarned: 0, starTotal: 0, streakIncreased: false, currentStreak: 0, freezeUsed: false, freezeEarned: false, dailyGoalMet: false, unlocked: [] },
      diagnosis: { misses: [], sound: null },
      assessment,
    });
    const { result } = renderHook(() => usePronunciationCoach({ item, lessonId: "th", itemPool: [item], combo: 0, recognitionLang: "en-US", cefr: "A1" }));
    await act(async () => result.current.start());
    await act(async () => result.current.start());
    await act(async () => result.current.start());
    await act(async () => result.current.start());
    expect(result.current.session.status).toBe("practiced-not-mastered");
    expect(result.current.feedback?.transition.rewardMultiplier).toBe(0.25);
    expect(result.current.feedback?.transition.srsPass).toBe(false);
    expect(result.current.feedback?.transition.dueDayOffset).toBe(1);
    expect(boundaries.recordPracticeAttempt).toHaveBeenCalledTimes(3);
  });

  it("commits a mastered terminal result once across rapid clicks and stale retries", async () => {
    const masteredAssessment: AssessmentResult = {
      ...assessment,
      recognizedText: "three",
      pronunciationScore: 94,
      accuracyScore: 94,
      targetPhonemeScore: 92,
      words: [{ word: "three", accuracyScore: 94, phonemes: [{ phoneme: "θ", accuracyScore: 92 }] }],
    };
    let resolveCapture!: (value: unknown) => void;
    const captureResult = new Promise((resolve) => { resolveCapture = resolve; });
    boundaries.createRecognition.mockReturnValue({ result: captureResult, stop: vi.fn(), cancel: vi.fn() });
    boundaries.recordPracticeAttempt.mockResolvedValue({
      score: { score: 94, passed: true, heard: "three", heardPartner: false, feedback: "Clear", feedbackKey: "pass", gradingOutcome: "mastered" },
      recorded: true,
      rewards: { xpGain: 10, newXp: 10, leveledUp: false, oldLevel: 1, newLevel: 1, combo: 3, starsEarned: 3, starTotal: 3, streakIncreased: false, currentStreak: 0, freezeUsed: false, freezeEarned: false, dailyGoalMet: false, unlocked: [] },
      diagnosis: { misses: [], sound: null },
      assessment: masteredAssessment,
    });
    const { result } = renderHook(() => usePronunciationCoach({ item, lessonId: "th", itemPool: [item], combo: 2, recognitionLang: "en-US", cefr: "A1" }));

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.start();
      second = result.current.start();
    });
    expect(boundaries.createRecognition).toHaveBeenCalledOnce();
    resolveCapture({ transcript: "three", alternatives: ["three"], confidence: 1, assessment: masteredAssessment, audio: new Blob(["voice"]) });
    await act(async () => Promise.all([first, second]));
    await act(async () => result.current.start());

    expect(boundaries.recordPracticeAttempt).toHaveBeenCalledOnce();
    expect(boundaries.recordPracticeAttempt.mock.calls[0]?.[0].combo).toBe(3);
    expect(boundaries.saveAttemptRecording).not.toHaveBeenCalled();
  });

  it("retries a failed terminal save with the same commit id without recapturing or regrading", async () => {
    const masteredAssessment: AssessmentResult = {
      ...assessment,
      recognizedText: "three",
      pronunciationScore: 94,
      accuracyScore: 94,
      targetPhonemeScore: 92,
      words: [{ word: "three", accuracyScore: 94, phonemes: [{ phoneme: "θ", accuracyScore: 92 }] }],
    };
    boundaries.createRecognition.mockReturnValue({
      result: Promise.resolve({ transcript: "three", alternatives: ["three"], confidence: 1, assessment: masteredAssessment }),
      stop: vi.fn(),
      cancel: vi.fn(),
    });
    let resolveSave!: (value: unknown) => void;
    const retriedSave = new Promise((resolve) => { resolveSave = resolve; });
    boundaries.recordPracticeAttempt
      .mockRejectedValueOnce(new Error("indexeddb unavailable"))
      .mockReturnValueOnce(retriedSave);
    const { result } = renderHook(() => usePronunciationCoach({ item, lessonId: "th", itemPool: [item], combo: 2, recognitionLang: "en-US", cefr: "A1" }));

    await act(async () => result.current.start());
    expect(result.current.phase).toBe("save-recovery");
    expect(result.current.recovery).toBe("save");
    const firstCommitId = boundaries.recordPracticeAttempt.mock.calls[0]?.[0].clientAttemptId;

    let firstRetry!: Promise<void>;
    let duplicateRetry!: Promise<void>;
    act(() => {
      firstRetry = result.current.retrySave();
      duplicateRetry = result.current.retrySave();
    });
    expect(boundaries.createRecognition).toHaveBeenCalledOnce();
    expect(boundaries.recordPracticeAttempt).toHaveBeenCalledTimes(2);
    expect(boundaries.recordPracticeAttempt.mock.calls[1]?.[0].clientAttemptId).toBe(firstCommitId);
    expect(boundaries.recordPracticeAttempt.mock.calls[1]?.[0].persistenceBinding).toBe(boundaries.recordPracticeAttempt.mock.calls[0]?.[0].persistenceBinding);
    resolveSave({
      score: { score: 94, passed: true, heard: "three", heardPartner: false, feedback: "Clear", feedbackKey: "pass", gradingOutcome: "mastered" },
      recorded: true,
      rewards: { xpGain: 10, newXp: 10, leveledUp: false, oldLevel: 1, newLevel: 1, combo: 3, starsEarned: 3, starTotal: 3, streakIncreased: false, currentStreak: 0, freezeUsed: false, freezeEarned: false, dailyGoalMet: false, unlocked: [] },
      diagnosis: { misses: [], sound: null },
      assessment: masteredAssessment,
    });
    await act(async () => Promise.all([firstRetry, duplicateRetry]));
    expect(result.current.phase).toBe("feedback");
    expect(result.current.session.status).toBe("mastered");
    await act(async () => result.current.start());
    expect(boundaries.createRecognition).toHaveBeenCalledOnce();
    expect(boundaries.recordPracticeAttempt).toHaveBeenCalledTimes(2);
  });

  it("fails closed with account-changed recovery when the captured save binding goes stale", async () => {
    const masteredAssessment: AssessmentResult = {
      ...assessment,
      recognizedText: "three",
      pronunciationScore: 94,
      accuracyScore: 94,
      targetPhonemeScore: 92,
      words: [{ word: "three", accuracyScore: 94, phonemes: [{ phoneme: "θ", accuracyScore: 92 }] }],
    };
    boundaries.createRecognition.mockReturnValue({
      result: Promise.resolve({ transcript: "three", alternatives: ["three"], confidence: 1, assessment: masteredAssessment }),
      stop: vi.fn(), cancel: vi.fn(),
    });
    boundaries.recordPracticeAttempt.mockRejectedValue(Object.assign(new Error("account changed"), { code: "account-changed" }));
    const { result } = renderHook(() => usePronunciationCoach({ item, lessonId: "th", itemPool: [item], combo: 0, recognitionLang: "en-US", cefr: "A1" }));

    await act(async () => result.current.start());

    expect(result.current.phase).toBe("save-recovery");
    expect(result.current.recovery).toBe("account-changed");
    expect(boundaries.recordPracticeAttempt.mock.calls[0]?.[0].persistenceBinding).toBe(boundaries.capturePracticeBinding.mock.results[0]?.value);
  });

  it("never reads B history or diagnoses after A's captured history binding becomes stale", async () => {
    boundaries.createRecognition.mockReturnValue({
      result: Promise.resolve({ transcript: "tree", alternatives: ["tree"], confidence: 1, assessment }),
      stop: vi.fn(), cancel: vi.fn(),
    });
    boundaries.getAttemptsForPracticeBinding.mockRejectedValue(Object.assign(new Error("account changed"), { code: "account-changed" }));
    const { result } = renderHook(() => usePronunciationCoach({ item, lessonId: "th", itemPool: [item], combo: 0, recognitionLang: "en-US", cefr: "A1" }));

    await act(async () => result.current.start());

    expect(boundaries.getAttemptsForPracticeBinding).toHaveBeenCalledWith(boundaries.capturePracticeBinding.mock.results[0]?.value, { limit: 80 });
    expect(boundaries.getAttempts).not.toHaveBeenCalled();
    expect(boundaries.recordPracticeAttempt).not.toHaveBeenCalled();
    expect(result.current.recovery).toBe("account-changed");
    expect(result.current.feedback).toBeNull();
  });

  it("does not publish a stale save completion after unmount", async () => {
    const onOutcome = vi.fn();
    let resolveSave!: (value: unknown) => void;
    boundaries.createRecognition.mockReturnValue({
      result: Promise.resolve({ transcript: "tree", alternatives: ["tree"], confidence: 1, assessment }),
      stop: vi.fn(),
      cancel: vi.fn(),
    });
    boundaries.recordPracticeAttempt.mockReturnValue(new Promise((resolve) => { resolveSave = resolve; }));
    const { result, unmount } = renderHook(() => usePronunciationCoach({ item, lessonId: "th", itemPool: [item], combo: 0, recognitionLang: "en-US", cefr: "A1", onOutcome }));
    let capture!: Promise<void>;
    act(() => { capture = result.current.start(); });
    await act(async () => Promise.resolve());
    unmount();
    resolveSave({
      score: { score: 76, passed: false, heard: "tree", heardPartner: false, feedback: "Try again", feedbackKey: "close", gradingOutcome: "retry" },
      recorded: true,
      rewards: { xpGain: 0, newXp: 0, leveledUp: false, oldLevel: 1, newLevel: 1, combo: 0, starsEarned: 0, starTotal: 0, streakIncreased: false, currentStreak: 0, freezeUsed: false, freezeEarned: false, dailyGoalMet: false, unlocked: [] },
      diagnosis: { misses: [], sound: null },
      assessment,
    });
    await act(async () => capture);
    expect(onOutcome).not.toHaveBeenCalled();
  });

  it("drops a pending result when the practice item changes", async () => {
    const onOutcome = vi.fn();
    let resolveSave!: (value: unknown) => void;
    boundaries.createRecognition.mockReturnValue({
      result: Promise.resolve({ transcript: "tree", alternatives: ["tree"], confidence: 1, assessment }),
      stop: vi.fn(),
      cancel: vi.fn(),
    });
    boundaries.recordPracticeAttempt.mockReturnValue(new Promise((resolve) => { resolveSave = resolve; }));
    const nextItem = { ...item, id: "th:think", text: "think" };
    const { result, rerender } = renderHook(
      ({ activeItem }) => usePronunciationCoach({ item: activeItem, lessonId: "th", itemPool: [activeItem], combo: 0, recognitionLang: "en-US", cefr: "A1", onOutcome }),
      { initialProps: { activeItem: item } },
    );
    let capture!: Promise<void>;
    act(() => { capture = result.current.start(); });
    await act(async () => Promise.resolve());
    rerender({ activeItem: nextItem });
    resolveSave({
      score: { score: 76, passed: false, heard: "tree", heardPartner: false, feedback: "Try again", feedbackKey: "close", gradingOutcome: "retry" },
      recorded: true,
      rewards: { xpGain: 0, newXp: 0, leveledUp: false, oldLevel: 1, newLevel: 1, combo: 0, starsEarned: 0, starTotal: 0, streakIncreased: false, currentStreak: 0, freezeUsed: false, freezeEarned: false, dailyGoalMet: false, unlocked: [] },
      diagnosis: { misses: [], sound: null },
      assessment,
    });
    await act(async () => capture);
    expect(onOutcome).not.toHaveBeenCalled();
    expect(result.current.feedback).toBeNull();
    expect(result.current.phase).toBe("idle");
  });

  it("cancels model playback before capture and cleans capture plus playback on unmount", async () => {
    const cancel = vi.fn();
    boundaries.createRecognition.mockReturnValue({
      result: new Promise(() => {}),
      stop: vi.fn(),
      cancel,
    });
    const { result, unmount } = renderHook(() => usePronunciationCoach({ item, lessonId: "th", itemPool: [item], combo: 0, recognitionLang: "en-US", cefr: "A1" }));
    act(() => { void result.current.start(); });
    expect(boundaries.stopPronunciation.mock.invocationCallOrder[0]).toBeLessThan(boundaries.createRecognition.mock.invocationCallOrder[0]);
    unmount();
    expect(cancel).toHaveBeenCalledOnce();
    expect(boundaries.stopPronunciation).toHaveBeenCalledTimes(2);
  });

  it("loads persisted weaknesses but ignores ones unrelated to the current target", async () => {
    boundaries.getAttemptsForPracticeBinding.mockResolvedValue([
      { itemId: "b-v:berry", lessonId: "b-v", categoryId: "b-v", phoneme: "b", target: "berry", score: 55, passed: false, at: Date.now(), policyVersion: "latam-v1", providerStatus: "valid", targetPhonemeScore: 42 },
      { itemId: "noise", lessonId: "noise", categoryId: "noise", phoneme: "h", target: "noise", score: 0, passed: false, at: Date.now(), providerStatus: "technical-skip", targetPhonemeScore: 0 },
    ]);
    boundaries.createRecognition.mockReturnValue({
      result: Promise.resolve({ transcript: "tree", alternatives: ["tree"], confidence: 1, assessment }),
      stop: vi.fn(),
      cancel: vi.fn(),
    });
    boundaries.recordPracticeAttempt.mockResolvedValue({
      score: { score: 76, passed: false, heard: "tree", heardPartner: false, feedback: "Try again", feedbackKey: "close", gradingOutcome: "retry" },
      recorded: true,
      rewards: { xpGain: 0, newXp: 0, leveledUp: false, oldLevel: 1, newLevel: 1, combo: 0, starsEarned: 0, starTotal: 0, streakIncreased: false, currentStreak: 0, freezeUsed: false, freezeEarned: false, dailyGoalMet: false, unlocked: [] },
      diagnosis: { misses: [], sound: null },
      assessment,
    });
    const { result } = renderHook(() => usePronunciationCoach({ item, lessonId: "th", itemPool: [item], combo: 0, recognitionLang: "en-US", cefr: "A1" }));
    await act(async () => result.current.start());
    expect(boundaries.getAttemptsForPracticeBinding).toHaveBeenCalledWith(boundaries.capturePracticeBinding.mock.results[0]?.value, { limit: 80 });
    expect(boundaries.getAttempts).not.toHaveBeenCalled();
    expect(result.current.feedback?.diagnosis).toMatchObject({ source: "provider", cueKey: "pronunciation.cue.es.th" });
  });

  it("turns a provider outage into technical recovery without a learner write", async () => {
    const { RecognitionError } = await import("@/lib/speech/recognition");
    boundaries.createRecognition.mockReturnValue({
      result: Promise.reject(new RecognitionError("technical-skip", "outage")),
      stop: vi.fn(),
      cancel: vi.fn(),
    });
    const { result } = renderHook(() => usePronunciationCoach({ item, lessonId: "th", itemPool: [item], combo: 0, recognitionLang: "en-US", cefr: "A1" }));
    await act(async () => result.current.start());
    expect(result.current.phase).toBe("feedback");
    expect(result.current.feedback?.verdict.outcome).toBe("technical-skip");
    expect(result.current.session.validAttempts).toBe(0);
    expect(boundaries.recordPracticeAttempt).not.toHaveBeenCalled();
  });

  it("treats a transcript without assessment as unavailable until the learner explicitly chooses ungraded practice", async () => {
    boundaries.createRecognition
      .mockReturnValueOnce({ result: Promise.resolve({ transcript: "three", alternatives: ["three"], confidence: 1 }), stop: vi.fn(), cancel: vi.fn() })
      .mockReturnValueOnce({ result: Promise.resolve({ transcript: "three", alternatives: ["three"], confidence: 1 }), stop: vi.fn(), cancel: vi.fn() });
    const { result } = renderHook(() => usePronunciationCoach({ item, lessonId: "th", itemPool: [item], combo: 0, recognitionLang: "en-US", cefr: "A1" }));
    await act(async () => result.current.start());
    expect(result.current.phase).toBe("feedback");
    expect(result.current.feedback?.verdict.outcome).toBe("technical-skip");
    expect(result.current.ungradedHeard).toBe("");
    expect(boundaries.createRecognition.mock.calls[0]?.[0]).toMatchObject({ target: "three" });

    await act(async () => result.current.practiceWithoutGrade());
    expect(result.current.phase).toBe("ungraded-practice");
    expect(boundaries.createRecognition.mock.calls[1]?.[0]).not.toHaveProperty("target");
    expect(boundaries.recordPracticeAttempt).not.toHaveBeenCalled();
  });

  it.each(["not-allowed", "no-speech"])("keeps %s outside learner attempts", async (code) => {
    const { RecognitionError } = await import("@/lib/speech/recognition");
    boundaries.createRecognition.mockReturnValue({
      result: Promise.reject(new RecognitionError(code, "recover")),
      stop: vi.fn(),
      cancel: vi.fn(),
    });
    const { result } = renderHook(() => usePronunciationCoach({ item, lessonId: "th", itemPool: [item], combo: 0, recognitionLang: "en-US", cefr: "A1" }));
    await act(async () => result.current.start());
    expect(result.current.phase).toBe("recovery");
    expect(result.current.session.validAttempts).toBe(0);
    expect(boundaries.recordPracticeAttempt).not.toHaveBeenCalled();
  });

  it("keeps transcript-only practice explicitly ungraded with no progress mutation", async () => {
    boundaries.createRecognition.mockReturnValue({
      result: Promise.resolve({ transcript: "three", alternatives: ["three"], confidence: 1 }),
      stop: vi.fn(),
      cancel: vi.fn(),
    });
    const { result } = renderHook(() => usePronunciationCoach({ item, lessonId: "th", itemPool: [item], combo: 0, recognitionLang: "en-US", cefr: "A1" }));
    await act(async () => result.current.practiceWithoutGrade());
    expect(result.current.phase).toBe("ungraded-practice");
    expect(result.current.session.validAttempts).toBe(0);
    expect(boundaries.recordPracticeAttempt).not.toHaveBeenCalled();
  });
});
