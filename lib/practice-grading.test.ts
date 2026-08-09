import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Attempt } from "@/lib/db/types";

const boundaries = vi.hoisted(() => {
  const rewards = (xpGain = 0, starsEarned = 0) => ({
    xpGain, newXp: 10 + xpGain, leveledUp: false, oldLevel: 1, newLevel: 1,
    combo: 1, starsEarned, starTotal: starsEarned, streakIncreased: false,
    currentStreak: 1, freezeUsed: false, freezeEarned: false,
    dailyGoalMet: false, unlocked: [],
  });
  const repo = {
    capturePracticeBinding: vi.fn(() => ({ binding: "practice" })),
    getSettings: vi.fn(async () => ({ difficulty: "normal", dailyGoal: 40, profileId: "profile-1" })),
    getAttempts: vi.fn(async () => []),
    recordAttempt: vi.fn(async () => undefined),
    commitPracticeAttempt: vi.fn(async (_binding: unknown, mutation: { attempt: Attempt; progress?: unknown; reward?: { passed: boolean; xpAward?: number; masteryStars?: number } }): Promise<
      | { status: "committed"; rewards: ReturnType<typeof rewards>; outboxIds: number[] }
      | { status: "already-committed"; outboxIds: [] }
    > => ({
      status: "committed" as const,
      rewards: mutation.reward
        ? rewards(mutation.reward.xpAward ?? (mutation.reward.passed ? 10 : 2), mutation.reward.masteryStars ?? (mutation.reward.passed ? 2 : 0))
        : rewards(),
      outboxIds: [],
    })),
    getProgress: vi.fn(async () => undefined),
    saveProgress: vi.fn(async (progress: unknown) => { void progress; }),
    getPlayerStats: vi.fn(async () => ({ xp: 10, todayXp: 0, stars: 0, currentStreak: 0 })),
    savePlayerStats: vi.fn(async (stats: unknown) => { void stats; }),
  };
  return {
    repo,
    scoreAttempt: vi.fn(),
    applyAttempt: vi.fn(),
    recordQuestEvent: vi.fn(),
    pushAttempt: vi.fn(() => undefined),
    pushProgress: vi.fn(),
    pushPlayer: vi.fn(),
    flushOutbox: vi.fn(async () => ({ delivered: 0, remaining: 0 })),
    diagnosis: { misses: [{ expected: "water", heard: "wader" }], sound: null },
  };
});

vi.mock("@/lib/db", () => ({ repo: boundaries.repo }));
vi.mock("@/lib/speech/scoring", () => ({
  scoreAttempt: boundaries.scoreAttempt,
  isGradedScoreResult: (result: { gradingOutcome: string }) =>
    result.gradingOutcome === "mastered" || result.gradingOutcome === "retry",
}));
vi.mock("@/lib/content/lessons", () => ({ partnerOf: () => undefined }));
vi.mock("@/lib/gamification", () => ({ applyAttempt: boundaries.applyAttempt, levelForXp: () => 1 }));
vi.mock("@/lib/quests", () => ({ recordQuestEvent: boundaries.recordQuestEvent }));
vi.mock("@/lib/sync/supabase-sync", () => ({
  pushAttempt: boundaries.pushAttempt,
  pushProgress: boundaries.pushProgress,
  pushPlayer: boundaries.pushPlayer,
}));
vi.mock("@/lib/sync/outbox", () => ({ flushOutbox: boundaries.flushOutbox }));
vi.mock("@/lib/speech/diagnose", () => ({
  diagnose: () => boundaries.diagnosis,
  diagnoseAssessment: () => boundaries.diagnosis,
}));

import { recordPracticeAttempt } from "@/lib/practice";

const item = {
  id: "flap-t:water",
  text: "water",
  ipa: "/wɔtər/",
  mouthHint: "Tap the t.",
  kind: "word" as const,
  categoryId: "flap-t",
  phoneme: "t",
};
const practiceBinding = { binding: "caller-captured" } as never;

const safeRewards = {
  xpGain: 0,
  newXp: 0,
  leveledUp: false,
  oldLevel: 0,
  newLevel: 0,
  combo: 0,
  starsEarned: 0,
  starTotal: 0,
  streakIncreased: false,
  currentStreak: 0,
  freezeUsed: false,
  freezeEarned: false,
  dailyGoalMet: false,
  unlocked: [],
};

const normalRewards = {
  ...safeRewards,
  xpGain: 10,
  newXp: 20,
  oldLevel: 1,
  newLevel: 1,
  combo: 1,
  starsEarned: 2,
  starTotal: 2,
};

const scored = (gradingOutcome: "mastered" | "retry" | "diagnostic" | "technical-skip" | "ungraded") => ({
  score: 84,
  passed: gradingOutcome === "mastered",
  heard: "wader",
  heardPartner: false,
  feedback: `feedback:${gradingOutcome}`,
  feedbackKey: gradingOutcome === "diagnostic" ? "diagnostic" : "close",
  gradingOutcome,
});

const mutationBoundaries = () => [
  boundaries.repo.commitPracticeAttempt,
  boundaries.repo.getProgress,
  boundaries.repo.getPlayerStats,
  boundaries.applyAttempt,
  boundaries.recordQuestEvent,
  boundaries.pushAttempt,
  boundaries.pushProgress,
  boundaries.pushPlayer,
  boundaries.flushOutbox,
];

const run = () => recordPracticeAttempt({
  item,
  lessonId: "flap-t",
  transcript: "wader",
  alternatives: [],
  combo: 1,
  persistenceBinding: practiceBinding,
});

beforeEach(() => {
  vi.clearAllMocks();
  boundaries.applyAttempt.mockReturnValue({ stats: { xp: 20 }, rewards: normalRewards });
});

describe("recordPracticeAttempt grading isolation", () => {
  for (const outcome of ["diagnostic", "technical-skip", "ungraded"] as const) {
    it(`returns ${outcome} feedback without persistence, progress, rewards, quests, or sync`, async () => {
      const score = scored(outcome);
      boundaries.scoreAttempt.mockReturnValue(score);

      const result = await run();

      expect(result.recorded).toBe(false);
      expect(result.score).toBe(score);
      expect(result.score.feedback).toBe(`feedback:${outcome}`);
      expect(result.diagnosis).toEqual(boundaries.diagnosis);
      expect(result.rewards).toEqual(safeRewards);
      expect(boundaries.repo.getSettings).not.toHaveBeenCalled();
      for (const boundary of mutationBoundaries()) expect(boundary).not.toHaveBeenCalled();
    });
  }

  for (const [outcome, passed] of [["mastered", true], ["retry", false]] as const) {
    it(`keeps the normal mutation pipeline for valid ${outcome} evidence`, async () => {
      boundaries.scoreAttempt.mockReturnValue(scored(outcome));

      const result = await run();

      expect(result.recorded).toBe(true);
      expect(result.score.passed).toBe(passed);
      expect(boundaries.repo.commitPracticeAttempt).toHaveBeenCalledTimes(1);
      expect(boundaries.flushOutbox).toHaveBeenCalledTimes(1);
      for (const boundary of [
        boundaries.repo.getSettings, boundaries.repo.getProgress, boundaries.repo.getPlayerStats,
        boundaries.applyAttempt, boundaries.recordQuestEvent, boundaries.pushAttempt,
        boundaries.pushProgress, boundaries.pushPlayer,
      ]) expect(boundary).not.toHaveBeenCalled();
      const localAttempt = boundaries.repo.commitPracticeAttempt.mock.calls[0]?.[1].attempt;
      expect(localAttempt.clientAttemptId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    });
  }

  it("deduplicates rewards, quests, and cloud effects when the same commit is retried", async () => {
    const clientAttemptId = "77777777-7777-4777-8777-777777777777";
    boundaries.scoreAttempt.mockReturnValue(scored("mastered"));
    boundaries.repo.commitPracticeAttempt
      .mockResolvedValueOnce({ status: "committed", rewards: normalRewards, outboxIds: [] })
      .mockResolvedValueOnce({ status: "already-committed", outboxIds: [] });

    const first = await recordPracticeAttempt({ item, lessonId: "flap-t", transcript: "wader", alternatives: [], combo: 1, clientAttemptId, persistenceBinding: practiceBinding });
    const duplicate = await recordPracticeAttempt({ item, lessonId: "flap-t", transcript: "wader", alternatives: [], combo: 1, clientAttemptId, persistenceBinding: practiceBinding });

    expect(first.recorded).toBe(true);
    expect(duplicate.recorded).toBe(false);
    expect(duplicate.rewards.xpGain).toBe(0);
    expect(boundaries.repo.commitPracticeAttempt.mock.calls.map(([, mutation]) => mutation.attempt.clientAttemptId)).toEqual([clientAttemptId, clientAttemptId]);
    expect(boundaries.flushOutbox).toHaveBeenCalledOnce();
    expect(boundaries.recordQuestEvent).not.toHaveBeenCalled();
    expect(boundaries.pushAttempt).not.toHaveBeenCalled();
    expect(boundaries.pushProgress).not.toHaveBeenCalled();
    expect(boundaries.pushPlayer).not.toHaveBeenCalled();
  });

  it("retries the same prepared grade and captured binding without scoring again", async () => {
    const request = { item, lessonId: "flap-t", transcript: "wader", alternatives: [], combo: 1, persistenceBinding: practiceBinding };
    boundaries.scoreAttempt.mockReturnValue(scored("mastered"));
    boundaries.repo.commitPracticeAttempt
      .mockRejectedValueOnce(new Error("temporary storage failure"))
      .mockResolvedValueOnce({ status: "committed", rewards: normalRewards, outboxIds: [] });

    await expect(recordPracticeAttempt(request)).rejects.toThrow("temporary storage failure");
    await expect(recordPracticeAttempt(request)).resolves.toMatchObject({ recorded: true });

    expect(boundaries.scoreAttempt).toHaveBeenCalledOnce();
    expect(boundaries.repo.capturePracticeBinding).not.toHaveBeenCalled();
    expect(boundaries.repo.commitPracticeAttempt.mock.calls[1]?.[0]).toBe(boundaries.repo.commitPracticeAttempt.mock.calls[0]?.[0]);
    expect(boundaries.repo.commitPracticeAttempt.mock.calls[1]?.[1].attempt.clientAttemptId)
      .toBe(boundaries.repo.commitPracticeAttempt.mock.calls[0]?.[1].attempt.clientAttemptId);
  });

  it("lets the strict coach persist retry evidence without early SRS, reward, or quest mutation", async () => {
    // Deliberately disagree with the legacy A0 adapter: the versioned coach
    // verdict must remain authoritative for an A2+ caller.
    boundaries.scoreAttempt.mockReturnValue(scored("mastered"));
    const result = await recordPracticeAttempt({
      item,
      lessonId: "flap-t",
      transcript: "wader",
      alternatives: [],
      combo: 1,
      persistenceBinding: practiceBinding,
      assessment: {
        provider: "azure",
        providerStatus: "valid",
        recognizedText: "wader",
        pronunciationScore: 84,
        accuracyScore: 70,
        targetPhonemeScore: 60,
        targetRecognized: false,
        words: [{ word: "water", accuracyScore: 70, phonemes: [{ phoneme: "t", accuracyScore: 60 }] }],
      },
      pronunciation: {
        verdict: { policyVersion: "latam-v1", outcome: "retry", reasons: ["target-not-recognized"] },
        diagnosis: null,
        transition: {
          state: { validAttempts: 1, firstValidScore: 84, status: "active" },
          coachingStage: 2,
          rewardMultiplier: 0,
          xpAward: 0,
          masteryStars: 0,
          combo: 0,
          srsPass: false,
          canContinue: false,
        },
      },
    });

    expect(result.recorded).toBe(true);
    expect(result.score.passed).toBe(false);
    expect(boundaries.repo.commitPracticeAttempt).toHaveBeenCalledOnce();
    expect(boundaries.repo.commitPracticeAttempt.mock.calls[0]?.[1].attempt).toMatchObject({
      passed: false,
      policyVersion: "latam-v1",
      providerStatus: "valid",
      pronunciationScore: 84,
      targetPhonemeScore: 60,
      attemptOrdinal: 1,
    });
    expect(boundaries.repo.commitPracticeAttempt.mock.calls[0]?.[1]).not.toHaveProperty("progress");
    expect(boundaries.applyAttempt).not.toHaveBeenCalled();
    expect(boundaries.repo.commitPracticeAttempt.mock.calls[0]?.[1]).not.toHaveProperty("reward");
    expect(boundaries.recordQuestEvent).not.toHaveBeenCalled();
    expect(boundaries.pushAttempt).not.toHaveBeenCalled();
    expect(boundaries.pushProgress).not.toHaveBeenCalled();
    expect(result.rewards.xpGain).toBe(0);
  });

  it("applies exactly the third-miss practice reward and one-day SRS boundary", async () => {
    boundaries.scoreAttempt.mockReturnValue(scored("retry"));
    boundaries.repo.getPlayerStats.mockResolvedValueOnce({
      xp: 10,
      todayXp: 0,
      stars: 0,
      currentStreak: 0,
    });
    boundaries.applyAttempt.mockReturnValueOnce({
      stats: { xp: 12, todayXp: 2, stars: 0 },
      rewards: { ...normalRewards, xpGain: 2, newXp: 12, starsEarned: 0, starTotal: 0, combo: 0 },
    });
    const before = Date.now();
    const result = await recordPracticeAttempt({
      item,
      lessonId: "flap-t",
      transcript: "wader",
      alternatives: [],
      combo: 1,
      persistenceBinding: practiceBinding,
      assessment: {
        provider: "azure",
        providerStatus: "valid",
        recognizedText: "wader",
        pronunciationScore: 84,
        accuracyScore: 70,
        targetPhonemeScore: 60,
        targetRecognized: false,
        words: [{ word: "water", accuracyScore: 70, phonemes: [{ phoneme: "t", accuracyScore: 60 }] }],
      },
      pronunciation: {
        verdict: { policyVersion: "latam-v1", outcome: "retry", reasons: ["target-not-recognized"] },
        diagnosis: null,
        transition: {
          state: { validAttempts: 3, firstValidScore: 70, status: "practiced-not-mastered" },
          coachingStage: 3,
          rewardMultiplier: 0.25,
          xpAward: 3,
          masteryStars: 0,
          combo: 0,
          srsPass: false,
          dueDayOffset: 1,
          canContinue: true,
        },
      },
    });

    expect(result.rewards.xpGain).toBe(3);
    expect(result.rewards.starsEarned).toBe(0);
    const mutation = boundaries.repo.commitPracticeAttempt.mock.calls[0]?.[1] as unknown as { attempt: Attempt; progress: { passed: boolean; score: number; dueInMs: number }; reward: { xpAward: number; masteryStars: number } };
    expect(mutation.reward).toMatchObject({ xpAward: 3, masteryStars: 0 });
    expect(mutation.attempt.pronunciationOutcome).toBe("practiced-not-mastered");
    expect(mutation.progress).toEqual({ passed: false, score: 84, dueInMs: 86_400_000 });
    expect(mutation.attempt.at).toBeGreaterThanOrEqual(before);
  });
});
