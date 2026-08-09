import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PracticeItem } from "@/lib/db/types";
import { ProducePanel } from "./produce-panel";
import { ShadowRound } from "./shadow-round";

const boundaries = vi.hoisted(() => ({
  coach: {} as Record<string, unknown>,
  stop: vi.fn(),
  cancel: vi.fn(),
  resetSession: vi.fn(),
  stopPronunciation: vi.fn(),
}));

vi.mock("./use-pronunciation-coach", () => ({
  usePronunciationCoach: () => boundaries.coach,
}));
vi.mock("@/lib/hooks/useSettings", () => ({
  useSettings: () => ({ settings: { coachLanguage: "en", recognitionLang: "en-US", onboarding: { level: "A1" } } }),
}));
vi.mock("@/lib/hooks/useSpeechSupport", () => ({ useSpeechSupport: () => ({ recognition: true, synthesis: true }) }));
vi.mock("@/lib/speech/player", () => ({
  playPronunciation: vi.fn(),
  stopPronunciation: boundaries.stopPronunciation,
  pickDrillVoice: () => ({ slug: "alloy" }),
}));
vi.mock("@/lib/sfx", () => ({ sfx: { correct: vi.fn(), wrong: vi.fn(), finish: vi.fn() } }));
vi.mock("@/components/juice", () => ({ juice: { centerBurst: vi.fn() } }));
vi.mock("@/components/lumi", () => ({ Lumi: () => <div>Lumi</div> }));
vi.mock("@/components/character", () => ({ CharacterIllustration: () => <div>Lumi</div> }));

const item: PracticeItem = {
  id: "th:three",
  text: "three",
  ipa: "/θɹiː/",
  mouthHint: "Tongue between the teeth.",
  kind: "word",
  categoryId: "th",
  phoneme: "θ",
};

const transition = {
  state: { validAttempts: 1, firstValidScore: 94, status: "mastered" as const },
  coachingStage: 1 as const,
  rewardMultiplier: 1 as const,
  xpAward: 10,
  masteryStars: 3,
  combo: 2,
  srsPass: true,
  canContinue: true,
};

function coach(overrides: Record<string, unknown> = {}) {
  return {
    phase: "idle",
    feedback: null,
    recovery: null,
    ungradedHeard: "",
    session: { validAttempts: 0, status: "active" },
    mode: "record",
    start: vi.fn(),
    stop: boundaries.stop,
    cancel: boundaries.cancel,
    practiceWithoutGrade: vi.fn(),
    skipTechnical: vi.fn(),
    resetSession: boundaries.resetSession,
    retrySave: vi.fn(),
    ...overrides,
  };
}

describe("pronunciation caller lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boundaries.coach = coach();
  });

  it("shows a live recording status and a wired Stop button in Shadow mode", async () => {
    boundaries.coach = coach({ phase: "capturing" });
    render(<ShadowRound items={[item]} onExit={vi.fn()} />);

    expect(screen.getByRole("status")).toHaveTextContent(/recording/i);
    await userEvent.click(screen.getByRole("button", { name: /stop recording/i }));
    expect(boundaries.stop).toHaveBeenCalledOnce();
  });

  it("cancels capture and playback before leaving Shadow mode", async () => {
    const onExit = vi.fn();
    render(<ShadowRound items={[item]} onExit={onExit} />);
    await userEvent.click(screen.getByRole("button", { name: /exit/i }));

    expect(boundaries.cancel).toHaveBeenCalledOnce();
    expect(boundaries.stopPronunciation).toHaveBeenCalled();
    expect(boundaries.stopPronunciation.mock.invocationCallOrder[0]).toBeLessThan(onExit.mock.invocationCallOrder[0]);
  });

  it("stops playback before Produce advances after a terminal clear", async () => {
    const onNext = vi.fn();
    boundaries.coach = coach({
      phase: "feedback",
      feedback: {
        heard: "three",
        verdict: { policyVersion: "latam-v1", outcome: "mastered", reasons: [] },
        diagnosis: null,
        transition,
      },
    });
    render(
      <ProducePanel
        item={item}
        lessonId="th"
        itemPool={[item]}
        recognitionSupported
        combo={1}
        onNext={onNext}
        hasNext
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(boundaries.cancel).toHaveBeenCalledOnce();
    expect(boundaries.stopPronunciation).toHaveBeenCalled();
    expect(boundaries.stopPronunciation.mock.invocationCallOrder[0]).toBeLessThan(onNext.mock.invocationCallOrder[0]);
  });

  it("shows Shadow account-change recovery as non-retryable with a safe continue action", async () => {
    const onExit = vi.fn();
    boundaries.coach = coach({
      phase: "save-recovery",
      recovery: "account-changed",
      feedback: {
        heard: "three",
        verdict: { policyVersion: "latam-v1", outcome: "mastered", reasons: [] },
        diagnosis: null,
        transition,
      },
    });
    render(<ShadowRound items={[item]} onExit={onExit} />);

    expect(screen.getByRole("heading", { name: /account changed/i })).toBeVisible();
    expect(screen.queryByRole("button", { name: /retry save/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(boundaries.cancel).toHaveBeenCalled();
    expect(onExit).toHaveBeenCalledOnce();
  });

  it("keeps Shadow storage failure retryable and distinct from account change", () => {
    const retrySave = vi.fn();
    boundaries.coach = coach({
      phase: "save-recovery",
      recovery: "save",
      retrySave,
      feedback: {
        heard: "three",
        verdict: { policyVersion: "latam-v1", outcome: "mastered", reasons: [] },
        diagnosis: null,
        transition,
      },
    });
    render(<ShadowRound items={[item]} onExit={vi.fn()} />);

    expect(screen.getByRole("heading", { name: /couldn.t save/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /retry save/i })).toBeVisible();
    expect(screen.queryByRole("heading", { name: /account changed/i })).not.toBeInTheDocument();
  });
});
