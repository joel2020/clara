import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PracticeItem } from "@/lib/db/types";
import { DuetScene } from "./duet-scene";
import { SpeedRound } from "./speed-round";

const boundaries = vi.hoisted(() => ({
  binding: { account: "A" } as Record<string, string>,
  activeAccount: "A",
  capturePracticeBinding: vi.fn(),
  createRecognition: vi.fn(),
  recordPracticeAttempt: vi.fn(),
  playPronunciation: vi.fn(),
  stopPronunciation: vi.fn(),
  sfxCorrect: vi.fn(),
  juiceBurst: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ repo: { capturePracticeBinding: boundaries.capturePracticeBinding } }));
vi.mock("@/lib/hooks/useSettings", () => ({
  useSettings: () => ({ settings: { coachLanguage: "en", recognitionLang: "en-US", speechRate: 0.9, voiceURI: undefined } }),
}));
vi.mock("@/lib/hooks/useSpeechSupport", () => ({ useSpeechSupport: () => ({ recognition: true, synthesis: true }) }));
vi.mock("@/lib/speech/recognition", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/speech/recognition")>();
  return { ...actual, createRecognition: boundaries.createRecognition, recognitionMode: () => "instant" };
});
vi.mock("@/lib/practice", () => ({ recordPracticeAttempt: boundaries.recordPracticeAttempt }));
vi.mock("@/lib/speech/player", () => ({
  playPronunciation: boundaries.playPronunciation, stopPronunciation: boundaries.stopPronunciation,
  pickDrillVoice: () => ({ slug: "alloy" }),
}));
vi.mock("@/lib/sfx", () => ({ sfx: { tap: vi.fn(), correct: boundaries.sfxCorrect, wrong: vi.fn(), finish: vi.fn() } }));
vi.mock("@/lib/fx", () => ({ celebrate: vi.fn(), popConfetti: vi.fn() }));
vi.mock("@/components/juice", () => ({ juice: { centerBurst: boundaries.juiceBurst, burst: vi.fn(), float: vi.fn(), sweep: vi.fn() } }));
vi.mock("@/components/lumi", () => ({ Lumi: () => <div>Lumi</div> }));
vi.mock("@/components/joel-avatar", () => ({
  JoelAvatar: ({ speaking }: { speaking?: boolean }) => <div data-testid="joel-avatar" data-speaking={speaking ? "true" : "false"}>Joel</div>,
}));

const item: PracticeItem = {
  id: "th:three", text: "three", ipa: "/θɹiː/", mouthHint: "Tongue between teeth.",
  kind: "word", categoryId: "th", phoneme: "θ",
};
const duet = {
  id: "test", emoji: "🎭", title: { en: "Test duet", es: "Dueto" },
  blurb: { en: "Test", es: "Prueba" }, lines: [{ speaker: "her" as const, itemId: item.id }],
};
const joelDuet = {
  ...duet,
  lines: [
    { speaker: "joel" as const, itemId: item.id },
    { speaker: "her" as const, itemId: "th:think" },
  ],
};

const deferred = () => {
  let resolve!: (value: unknown) => void;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

const flushPromises = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  boundaries.binding = { account: "A" };
  boundaries.activeAccount = "A";
  boundaries.capturePracticeBinding.mockImplementation(() => boundaries.binding);
  boundaries.recordPracticeAttempt.mockImplementation(async (args) => {
    if (args.persistenceBinding.account !== boundaries.activeAccount) {
      throw Object.assign(new Error("account changed"), { code: "account-changed" });
    }
    return {
      score: { passed: true, heard: "three", feedback: "Clear" }, recorded: true,
      rewards: { xpGain: 10, combo: 1, starsEarned: 3 }, diagnosis: { misses: [], sound: null },
    };
  });
});

describe.each([
  ["Duet", () => render(<DuetScene duet={duet} onExit={vi.fn()} />), /your line/i],
  ["Speed", () => render(<SpeedRound items={[item]} onExit={vi.fn()} />), /record/i],
] as const)("%s capture ownership", (_name, mount, buttonName) => {
  it("captures A before recognition and never publishes A's stale result after switching to B", async () => {
    const gate = deferred();
    const cancel = vi.fn();
    boundaries.createRecognition.mockReturnValue({ result: gate.promise, stop: vi.fn(), cancel });
    mount();

    await userEvent.click(screen.getByRole("button", { name: buttonName }));
    expect(boundaries.capturePracticeBinding.mock.invocationCallOrder[0]).toBeLessThan(boundaries.createRecognition.mock.invocationCallOrder[0]);
    boundaries.activeAccount = "B";
    gate.resolve({ transcript: "three", alternatives: ["three"], assessment: undefined });
    await act(async () => { await gate.promise; await Promise.resolve(); });

    expect(boundaries.recordPracticeAttempt).toHaveBeenCalledOnce();
    expect(boundaries.recordPracticeAttempt.mock.calls[0]?.[0].persistenceBinding).toBe(boundaries.binding);
    expect(boundaries.sfxCorrect).not.toHaveBeenCalled();
    expect(boundaries.juiceBurst).not.toHaveBeenCalled();
  });

  it("cancels capture and ignores a result that resolves after unmount", async () => {
    const gate = deferred();
    const cancel = vi.fn();
    boundaries.createRecognition.mockReturnValue({ result: gate.promise, stop: vi.fn(), cancel });
    const view = mount();
    await userEvent.click(screen.getByRole("button", { name: buttonName }));

    view.unmount();
    gate.resolve({ transcript: "three", alternatives: ["three"], assessment: undefined });
    await act(async () => { await gate.promise; await Promise.resolve(); });

    expect(cancel).toHaveBeenCalledOnce();
    expect(boundaries.recordPracticeAttempt).not.toHaveBeenCalled();
  });
});

it("Duet cancels and suppresses a deferred result when the scene changes", async () => {
  const gate = deferred();
  const cancel = vi.fn();
  boundaries.createRecognition.mockReturnValue({ result: gate.promise, stop: vi.fn(), cancel });
  const view = render(<DuetScene duet={duet} onExit={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: /your line/i }));

  view.rerender(<DuetScene duet={{ ...duet, id: "replacement" }} onExit={vi.fn()} />);
  gate.resolve({ transcript: "three", alternatives: ["three"], assessment: undefined });
  await act(async () => { await gate.promise; await Promise.resolve(); });

  expect(cancel).toHaveBeenCalled();
  expect(boundaries.recordPracticeAttempt).not.toHaveBeenCalled();
});

it("Duet clears Joel's delayed handoff when the scene unmounts", () => {
  vi.useFakeTimers();
  try {
    const view = render(<DuetScene duet={joelDuet} onExit={vi.fn()} />);

    act(() => { vi.advanceTimersByTime(400); });
    expect(boundaries.playPronunciation).toHaveBeenCalledOnce();
    act(() => { boundaries.playPronunciation.mock.calls[0]?.[0].onEnd(); });
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});

it("Duet clears pre-play and safety timers when it unmounts before playback", () => {
  vi.useFakeTimers();
  try {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const view = render(<DuetScene duet={joelDuet} onExit={vi.fn()} />);
    expect(vi.getTimerCount()).toBe(2);

    view.unmount();
    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    act(() => { vi.runAllTimers(); });
    expect(boundaries.playPronunciation).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
    vi.useRealTimers();
  }
});

it("Duet replaces the pending pre-play when the current item identity changes", () => {
  vi.useFakeTimers();
  try {
    const view = render(<DuetScene duet={joelDuet} onExit={vi.fn()} />);
    const replacement = {
      ...joelDuet,
      lines: [
        { speaker: "joel" as const, itemId: "th:think" },
        { speaker: "her" as const, itemId: item.id },
      ],
    };

    view.rerender(<DuetScene duet={replacement} onExit={vi.fn()} />);
    act(() => { vi.advanceTimersByTime(400); });

    expect(boundaries.playPronunciation).toHaveBeenCalledOnce();
    expect(boundaries.playPronunciation.mock.calls[0]?.[0]).toMatchObject({ id: "th:think", text: "think" });
    view.unmount();
  } finally {
    vi.useRealTimers();
  }
});

it("Duet clears the safety timer when playback ends", () => {
  vi.useFakeTimers();
  try {
    const view = render(<DuetScene duet={joelDuet} onExit={vi.fn()} />);
    act(() => { vi.advanceTimersByTime(400); });
    expect(vi.getTimerCount()).toBe(1);

    act(() => { boundaries.playPronunciation.mock.calls[0]?.[0].onEnd(); });
    expect(vi.getTimerCount()).toBe(1);
    view.unmount();
  } finally {
    vi.useRealTimers();
  }
});

it("Duet ignores an old playback callback after the scene id changes", () => {
  vi.useFakeTimers();
  try {
    const view = render(<DuetScene duet={joelDuet} onExit={vi.fn()} />);
    act(() => { vi.advanceTimersByTime(400); });
    const oldOnEnd = boundaries.playPronunciation.mock.calls[0]?.[0].onEnd;

    view.rerender(<DuetScene duet={{ ...joelDuet, id: "replacement" }} onExit={vi.fn()} />);
    act(() => {
      oldOnEnd();
      vi.advanceTimersByTime(450);
    });

    expect(screen.queryByRole("button", { name: /your line/i })).not.toBeInTheDocument();
    view.unmount();
  } finally {
    vi.useRealTimers();
  }
});

it("Duet resets Joel's speaking indicator before replacement pre-play", () => {
  vi.useFakeTimers();
  try {
    const view = render(<DuetScene duet={joelDuet} onExit={vi.fn()} />);
    act(() => { vi.advanceTimersByTime(400); });
    expect(screen.getByTestId("joel-avatar")).toHaveAttribute("data-speaking", "true");

    view.rerender(<DuetScene duet={{ ...joelDuet, id: "replacement" }} onExit={vi.fn()} />);
    expect(screen.getByTestId("joel-avatar")).toHaveAttribute("data-speaking", "false");
    view.unmount();
  } finally {
    vi.useRealTimers();
  }
});

it("Speed cancels and suppresses a deferred result when the practice item changes", async () => {
  const gate = deferred();
  const cancel = vi.fn();
  boundaries.createRecognition.mockReturnValue({ result: gate.promise, stop: vi.fn(), cancel });
  const view = render(<SpeedRound items={[item]} onExit={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: /record/i }));
  const replacement = { ...item, id: "th:think", text: "think" };

  view.rerender(<SpeedRound items={[replacement]} onExit={vi.fn()} />);
  gate.resolve({ transcript: "three", alternatives: ["three"], assessment: undefined });
  await act(async () => { await gate.promise; await Promise.resolve(); });

  expect(cancel).toHaveBeenCalled();
  expect(boundaries.recordPracticeAttempt).not.toHaveBeenCalled();
});

it("Speed replaces the pending preview when the round item text changes", () => {
  vi.useFakeTimers();
  try {
    const view = render(<SpeedRound items={[item]} onExit={vi.fn()} />);
    view.rerender(<SpeedRound items={[{ ...item, text: "THREE replacement" }]} onExit={vi.fn()} />);

    act(() => { vi.advanceTimersByTime(200); });
    expect(boundaries.playPronunciation).toHaveBeenCalledOnce();
    expect(boundaries.playPronunciation.mock.calls[0]?.[0]).toMatchObject({ id: item.id, text: "THREE replacement" });
    view.unmount();
  } finally {
    vi.useRealTimers();
  }
});

it("Speed clears its pending preview on unmount", () => {
  vi.useFakeTimers();
  try {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const view = render(<SpeedRound items={[item]} onExit={vi.fn()} />);

    view.unmount();
    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    act(() => { vi.runAllTimers(); });
    expect(boundaries.playPronunciation).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
    vi.useRealTimers();
  }
});

it("Speed clears its pending preview when the learner binding is unavailable", () => {
  vi.useFakeTimers();
  try {
    boundaries.capturePracticeBinding.mockReturnValue(null);
    const view = render(<SpeedRound items={[item]} onExit={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /record/i }));
    expect(vi.getTimerCount()).toBe(0);
    act(() => { vi.runAllTimers(); });
    expect(boundaries.playPronunciation).not.toHaveBeenCalled();
    view.unmount();
  } finally {
    vi.useRealTimers();
  }
});

it("Speed clears a successful feedback advance when the round is replaced", async () => {
  vi.useFakeTimers();
  try {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    boundaries.createRecognition.mockReturnValue({
      result: Promise.resolve({ transcript: "three", alternatives: ["three"], assessment: undefined }),
      stop: vi.fn(),
      cancel: vi.fn(),
    });
    const view = render(<SpeedRound items={[item]} onExit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /record/i }));
    await flushPromises();

    view.rerender(<SpeedRound items={[{ ...item, text: "THREE replacement" }]} onExit={vi.fn()} />);
    expect(clearTimeoutSpy).toHaveBeenCalled();
    act(() => { vi.runAllTimers(); });
    expect(screen.getByRole("button", { name: /record/i })).toBeEnabled();
    view.unmount();
  } finally {
    vi.restoreAllMocks();
    vi.useRealTimers();
  }
});

it("Speed clears a successful feedback advance on unmount", async () => {
  vi.useFakeTimers();
  try {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    boundaries.createRecognition.mockReturnValue({
      result: Promise.resolve({ transcript: "three", alternatives: ["three"], assessment: undefined }),
      stop: vi.fn(),
      cancel: vi.fn(),
    });
    const view = render(<SpeedRound items={[item]} onExit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /record/i }));
    await flushPromises();

    view.unmount();
    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    act(() => { vi.runAllTimers(); });
    expect(boundaries.playPronunciation).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
    vi.useRealTimers();
  }
});

it("Speed clears a failed feedback advance when the round is replaced", async () => {
  vi.useFakeTimers();
  try {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    boundaries.createRecognition.mockReturnValue({
      result: Promise.reject(new Error("capture failed")),
      stop: vi.fn(),
      cancel: vi.fn(),
    });
    const view = render(<SpeedRound items={[item]} onExit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /record/i }));
    await flushPromises();

    view.rerender(<SpeedRound items={[{ ...item, text: "THREE replacement" }]} onExit={vi.fn()} />);
    expect(clearTimeoutSpy).toHaveBeenCalled();
    act(() => { vi.runAllTimers(); });
    expect(screen.getByRole("button", { name: /record/i })).toBeEnabled();
    view.unmount();
  } finally {
    vi.restoreAllMocks();
    vi.useRealTimers();
  }
});

it("Speed clears a failed feedback advance on unmount", async () => {
  vi.useFakeTimers();
  try {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    boundaries.createRecognition.mockReturnValue({
      result: Promise.reject(new Error("capture failed")),
      stop: vi.fn(),
      cancel: vi.fn(),
    });
    const view = render(<SpeedRound items={[item]} onExit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /record/i }));
    await flushPromises();

    view.unmount();
    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    act(() => { vi.runAllTimers(); });
    expect(boundaries.playPronunciation).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
    vi.useRealTimers();
  }
});
