import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Lesson, PracticeItem } from "@/lib/db/types";
import type { PracticeOutcome } from "@/lib/practice";

const boundaries = vi.hoisted(() => ({
  getAllProgress: vi.fn(async () => []),
  getPlayerStats: vi.fn(),
  savePlayerStats: vi.fn(),
  playPronunciation: vi.fn(),
  stopPronunciation: vi.fn(),
  track: vi.fn(),
  scrollTo: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: ({ fill, priority, src, ...props }: ComponentProps<"img"> & {
    fill?: boolean;
    priority?: boolean;
  }) => {
    void fill;
    void priority;
    return createElement("img", { ...props, src: String(src) });
  },
}));

vi.mock("@/lib/db", () => ({
  repo: {
    getAllProgress: boundaries.getAllProgress,
    getPlayerStats: boundaries.getPlayerStats,
    savePlayerStats: boundaries.savePlayerStats,
    saveAttemptRecording: vi.fn(async () => undefined),
  },
}));

vi.mock("@/lib/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: {
      coachLanguage: "es",
      recognitionLang: "en-US",
      speechRate: 0.9,
      voiceURI: undefined,
      dailyGoal: 40,
      studentName: null,
    },
    ready: true,
    update: vi.fn(),
    saveVoiceConsent: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useSpeechSupport", () => ({
  useSpeechSupport: () => ({ synthesis: true, recognition: true }),
}));

vi.mock("@/lib/speech/player", () => ({
  playPronunciation: boundaries.playPronunciation,
  stopPronunciation: boundaries.stopPronunciation,
  hasRecordedVoice: () => false,
  pickAltVoice: vi.fn(),
}));

vi.mock("@/lib/analytics", () => ({ track: boundaries.track }));

vi.mock("@/components/practice/learn-intro", () => ({
  LearnIntro: ({ lesson, onStart }: { lesson: Lesson; onStart: () => void }) => (
    <div>
      <h2>{`Legacy learn · ${lesson.id}`}</h2>
      <button type="button" onClick={onStart}>Start legacy drills</button>
    </div>
  ),
}));

vi.mock("@/components/practice/distinguish-drill", () => ({
  DistinguishDrill: ({
    pairs,
    synthesisSupported,
    onDone,
  }: {
    pairs: [PracticeItem, PracticeItem][];
    synthesisSupported: boolean;
    onDone: () => void;
  }) => {
    void pairs;
    void synthesisSupported;
    return (
      <div>
        <h2>Legacy ear drill</h2>
        <button type="button" onClick={onDone}>Complete ear drill</button>
      </div>
    );
  },
}));

vi.mock("@/components/practice/produce-panel", () => ({
  ProducePanel: ({
    item,
    lessonId,
    itemPool,
    recognitionSupported,
    combo,
    onOutcome,
    onNext,
    hasNext,
  }: {
    item: PracticeItem;
    lessonId: string;
    itemPool: PracticeItem[];
    recognitionSupported: boolean;
    combo: number;
    onOutcome?: (outcome: PracticeOutcome) => void;
    onNext: () => void;
    hasNext: boolean;
  }) => {
    void lessonId;
    void itemPool;
    void recognitionSupported;
    void combo;
    void onOutcome;
    void hasNext;
    return <button type="button" onClick={onNext}>{`Advance · ${item.id}`}</button>;
  },
}));

vi.mock("@/lib/sfx", () => ({
  sfx: {
    tap: vi.fn(),
    correct: vi.fn(),
    wrong: vi.fn(),
    levelUp: vi.fn(),
    goal: vi.fn(),
    achievement: vi.fn(),
    finish: vi.fn(),
  },
}));

vi.mock("@/lib/fx", () => ({ celebrate: vi.fn(), levelUpBurst: vi.fn() }));
vi.mock("@/components/juice", () => ({ juice: { centerBurst: vi.fn(), sweep: vi.fn() } }));
vi.mock("@/components/cinematic", () => ({ cinematic: { play: vi.fn() } }));
vi.mock("sonner", () => {
  const toast = Object.assign(vi.fn(), { success: vi.fn() });
  return { toast };
});

import { PracticeSession } from "@/components/practice/practice-session";

function phrase(id: string, text: string, visualObjectId?: string): PracticeItem {
  return {
    id,
    text,
    ipa: `/${id}/`,
    meaning: `Meaning ${id}`,
    mouthHint: `Hint ${id}`,
    kind: "phrase",
    categoryId: "conversation",
    phoneme: "conversation",
    visualObjectId,
  };
}

function word(id: string, text: string, pairId: string): PracticeItem {
  return {
    id,
    text,
    ipa: `/${id}/`,
    mouthHint: `Hint ${id}`,
    kind: "word",
    categoryId: "test-sound",
    phoneme: "test",
    pairId,
  };
}

const cafeItems = [
  phrase("conv-cafe:1", "A table for two, please", "table"),
  phrase("conv-cafe:2", "Can I see the menu?", "menu"),
  phrase("conv-cafe:3", "Can I have a coffee, please?", "coffee"),
  phrase("conv-cafe:4", "I'd like the chicken", "chicken"),
];

function cafeLesson(visualTopicId: Lesson["visualTopicId"] = "cafe-restaurant"): Lesson {
  return {
    id: "conv-cafe",
    title: "Café & restaurant",
    subtitle: "Pedir comida",
    description: "Order with confidence.",
    kind: "phrase",
    categoryIds: ["conversation"],
    items: cafeItems,
    track: "conversation",
    visualTopicId,
    intro: {
      summary: "Legacy introduction",
      whyTricky: "Legacy explanation",
      how: ["Legacy step"],
      exampleIds: ["conv-cafe:1"],
    },
    order: 22,
  };
}

function unrelatedLesson(): Lesson {
  return {
    id: "sound-test",
    title: "Unrelated sound lesson",
    subtitle: "Sound order",
    description: "Keep the established sequence.",
    kind: "minimal-pairs",
    categoryIds: ["test-sound"],
    items: [
      word("sound-test:1", "ship", "test-pair"),
      word("sound-test:2", "sheep", "test-pair"),
      phrase("sound-test:3", "The ship is here"),
      phrase("sound-test:4", "The sheep is here"),
    ],
    intro: {
      summary: "Legacy introduction",
      whyTricky: "Legacy explanation",
      how: ["Legacy step"],
      exampleIds: ["sound-test:1"],
    },
    order: 1,
  };
}

function tracked(type: string) {
  return boundaries.track.mock.calls.filter(([event]) => event === type);
}

function currentStage(): string | null {
  return screen
    .getByRole("navigation", { name: "Lesson stages" })
    .querySelector('[aria-current="step"]')
    ?.textContent ?? null;
}

async function enterCafeSpeaking(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Entrar al café" }));
  const objectGroup = await screen.findByRole("group", { name: "Explora los objetos del café" });
  await user.click(within(objectGroup).getByRole("button", { name: "Coffee · Café" }));
  await user.click(screen.getByRole("button", { name: "Continuar para hablar" }));
  await screen.findByRole("heading", { name: "Can I have a coffee, please?" });
}

async function advanceAllCafePhrases(user: ReturnType<typeof userEvent.setup>) {
  for (const id of ["conv-cafe:3", "conv-cafe:1", "conv-cafe:2", "conv-cafe:4"]) {
    await user.click(screen.getByRole("button", { name: `Advance · ${id}` }));
  }
  await screen.findByText("¡Muy bien!");
}

describe("PracticeSession contextual visual sequence", () => {
  beforeEach(() => {
    boundaries.getAllProgress.mockClear();
    boundaries.getPlayerStats.mockReset();
    boundaries.savePlayerStats.mockReset();
    boundaries.playPronunciation.mockReset();
    boundaries.stopPronunciation.mockReset();
    boundaries.track.mockReset();
    boundaries.scrollTo.mockReset();
    boundaries.scrollTo.mockImplementation((options: ScrollToOptions | number, y?: number) => {
      const top = typeof options === "number" ? (y ?? 0) : (options.top ?? 0);
      Object.defineProperty(window, "scrollY", { configurable: true, value: top });
    });
    Object.defineProperty(window, "scrollTo", {
      configurable: true,
      value: boundaries.scrollTo,
      writable: true,
    });
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  });

  afterEach(() => cleanup());

  it("starts a resolved café lesson at story, marks the stage, and shows the topic once", async () => {
    render(<PracticeSession lesson={cafeLesson()} />);

    expect(await screen.findByRole("heading", { name: "Pide un café con confianza" })).not.toBeNull();
    expect(currentStage()).toBe("Historia");
    expect(screen.queryByRole("heading", { name: "Legacy learn · conv-cafe" })).toBeNull();
    await waitFor(() => {
      expect(tracked("visual_topic_shown")).toEqual([
        ["visual_topic_shown", { topicId: "cafe-restaurant", lessonId: "conv-cafe" }],
      ]);
    });
  });

  it("moves from story to exactly four discovery choices and stops prior playback", async () => {
    const user = userEvent.setup();
    render(<PracticeSession lesson={cafeLesson()} />);
    boundaries.stopPronunciation.mockClear();

    await user.click(await screen.findByRole("button", { name: "Entrar al café" }));

    expect(currentStage()).toBe("Descubre");
    const objectGroup = screen.getByRole("group", { name: "Explora los objetos del café" });
    expect(within(objectGroup).getAllByRole("button").map((button) => button.getAttribute("aria-label")))
      .toEqual(["Coffee · Café", "Menu · Menú", "Table · Mesa", "Card · Tarjeta"]);
    expect(boundaries.stopPronunciation).toHaveBeenCalledTimes(1);
  });

  it("resets scroll and focuses each newly entered visual stage heading", async () => {
    const user = userEvent.setup();
    render(<PracticeSession lesson={cafeLesson()} />);
    Object.defineProperty(window, "scrollY", { configurable: true, value: 620 });

    await user.click(await screen.findByRole("button", { name: "Entrar al café" }));

    const discoveryHeading = await screen.findByRole("heading", { name: "Explora el café" });
    await waitFor(() => {
      expect(window.scrollY).toBe(0);
      expect(document.activeElement).toBe(discoveryHeading);
    });

    const objectGroup = screen.getByRole("group", { name: "Explora los objetos del café" });
    await user.click(within(objectGroup).getByRole("button", { name: "Coffee · Café" }));
    Object.defineProperty(window, "scrollY", { configurable: true, value: 940 });
    await user.click(screen.getByRole("button", { name: "Continuar para hablar" }));

    const phraseHeading = await screen.findByRole("heading", { name: "Can I have a coffee, please?" });
    await waitFor(() => {
      expect(window.scrollY).toBe(0);
      expect(document.activeElement).toBe(phraseHeading);
    });
    expect(boundaries.scrollTo).toHaveBeenCalledTimes(2);
  });

  it("fits stage markers into the 320px row while preserving desktop spacing", async () => {
    render(<PracticeSession lesson={cafeLesson()} />);
    await screen.findByRole("heading", { name: "Pide un café con confianza" });

    const tracker = screen.getByRole("navigation", { name: "Lesson stages" });
    const list = within(tracker).getByRole("list");
    expect(list.className).toContain("w-full");
    expect(list.className).toContain("justify-between");
    expect(list.className).toContain("sm:w-auto");
    expect(list.className).toContain("sm:justify-center");

    for (const label of ["Historia", "Descubre", "Frases"]) {
      const marker = within(tracker).getByText(label);
      expect(marker.className).toContain("whitespace-nowrap");
      expect(marker.className).toContain("px-2");
      expect(marker.className).toContain("sm:px-3");
    }
    for (const separator of tracker.querySelectorAll('[aria-hidden="true"]')) {
      expect(separator.className).toContain("hidden");
      expect(separator.className).toContain("sm:block");
    }
  });

  it("promotes the coffee entry phrase and preserves the remaining authored phrase order", async () => {
    const user = userEvent.setup();
    render(<PracticeSession lesson={cafeLesson()} />);

    await enterCafeSpeaking(user);

    expect(currentStage()).toBe("Frases");
    expect(tracked("visual_to_speaking")).toEqual([
      ["visual_to_speaking", { topicId: "cafe-restaurant", lessonId: "conv-cafe" }],
    ]);
    for (const [id, heading] of [
      ["conv-cafe:3", "Can I have a coffee, please?"],
      ["conv-cafe:1", "A table for two, please"],
      ["conv-cafe:2", "Can I see the menu?"],
      ["conv-cafe:4", "I'd like the chicken"],
    ]) {
      expect(screen.getByRole("heading", { name: heading })).not.toBeNull();
      await user.click(screen.getByRole("button", { name: `Advance · ${id}` }));
    }
    expect(await screen.findByText("¡Muy bien!")).not.toBeNull();
  });

  it("keeps the consent fallback advance action touch-sized and keyboard-visible", async () => {
    const user = userEvent.setup();
    render(<PracticeSession lesson={cafeLesson()} />);

    await enterCafeSpeaking(user);

    const advance = screen.getByRole("button", { name: "Saltar a la siguiente" });
    expect(advance.className).toContain("min-h-11");
    expect(advance.className).toContain("min-w-11");
    expect(advance.className).toContain("px-3");
    expect(advance.className).toContain("focus-visible:outline-2");
    expect(advance.className).toContain("focus-visible:outline-ring");

    advance.focus();
    expect(document.activeElement).toBe(advance);
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("heading", { name: "A table for two, please" })).not.toBeNull();
  });

  it("keeps failed speaking audio retry touch-sized, keyboard-visible, and retryable", async () => {
    const user = userEvent.setup();
    render(<PracticeSession lesson={cafeLesson()} />);

    await enterCafeSpeaking(user);
    boundaries.playPronunciation.mockClear();
    await user.click(screen.getByRole("button", { name: "Escucha" }));
    const firstAttempt = boundaries.playPronunciation.mock.calls[0]?.[0];
    act(() => firstAttempt.onError());

    const retry = await screen.findByRole("button", { name: "Otra vez" });
    expect(retry.className).toContain("min-h-11");
    expect(retry.className).toContain("min-w-11");
    expect(retry.className).toContain("px-3");
    expect(retry.className).toContain("focus-visible:outline-2");
    expect(retry.className).toContain("focus-visible:outline-ring");

    retry.focus();
    expect(document.activeElement).toBe(retry);
    await user.keyboard("{Enter}");
    expect(boundaries.playPronunciation).toHaveBeenCalledTimes(2);
  });

  it("stops playback, resets scroll, and focuses the next heading between visual phrases", async () => {
    const user = userEvent.setup();
    render(<PracticeSession lesson={cafeLesson()} />);
    await enterCafeSpeaking(user);
    boundaries.stopPronunciation.mockClear();
    boundaries.scrollTo.mockClear();
    Object.defineProperty(window, "scrollY", { configurable: true, value: 1180 });

    await user.click(screen.getByRole("button", { name: "Advance · conv-cafe:3" }));

    const nextHeading = await screen.findByRole("heading", { name: "A table for two, please" });
    await waitFor(() => {
      expect(window.scrollY).toBe(0);
      expect(document.activeElement).toBe(nextHeading);
    });
    expect(boundaries.stopPronunciation).toHaveBeenCalledTimes(1);
    expect(boundaries.scrollTo).toHaveBeenCalledTimes(1);
  });

  it("restarts at story with the phrase index reset and journey analytics still one-time", async () => {
    const user = userEvent.setup();
    render(<PracticeSession lesson={cafeLesson()} />);
    await enterCafeSpeaking(user);
    await advanceAllCafePhrases(user);

    await user.click(screen.getByRole("button", { name: "Otra vez" }));
    expect(await screen.findByRole("heading", { name: "Pide un café con confianza" })).not.toBeNull();
    expect(currentStage()).toBe("Historia");
    await enterCafeSpeaking(user);

    expect(screen.getByRole("heading", { name: "Can I have a coffee, please?" })).not.toBeNull();
    expect(tracked("visual_topic_shown")).toHaveLength(1);
    expect(tracked("visual_to_speaking")).toHaveLength(1);
    expect(tracked("lesson_complete")).toEqual([["lesson_complete", { lesson: "conv-cafe" }]]);
  });

  it("keeps lesson abandonment when the learner exits during the visual story", async () => {
    const { unmount } = render(<PracticeSession lesson={cafeLesson()} />);
    await screen.findByRole("heading", { name: "Pide un café con confianza" });

    unmount();

    expect(tracked("lesson_start")).toEqual([["lesson_start", { lesson: "conv-cafe" }]]);
    expect(tracked("lesson_abandon")).toEqual([["lesson_abandon", { lesson: "conv-cafe" }]]);
    expect(tracked("lesson_complete")).toHaveLength(0);
  });

  it("falls back to the legacy learn and authored phrase sequence when the topic pack is missing", async () => {
    const user = userEvent.setup();
    render(<PracticeSession lesson={cafeLesson("airport-travel")} />);

    expect(await screen.findByRole("heading", { name: "Legacy learn · conv-cafe" })).not.toBeNull();
    expect(currentStage()).toBe("Aprende");
    expect(screen.queryByRole("heading", { name: "Pide un café con confianza" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Start legacy drills" }));

    expect(await screen.findByRole("heading", { name: "A table for two, please" })).not.toBeNull();
    expect(tracked("visual_topic_shown")).toHaveLength(0);
    expect(tracked("visual_to_speaking")).toHaveLength(0);
  });

  it("keeps an unrelated lesson on learn, ear, words, and authored phrases in order", async () => {
    const user = userEvent.setup();
    render(<PracticeSession lesson={unrelatedLesson()} />);

    expect(await screen.findByRole("heading", { name: "Legacy learn · sound-test" })).not.toBeNull();
    expect(currentStage()).toBe("Aprende");
    await user.click(screen.getByRole("button", { name: "Start legacy drills" }));

    expect(await screen.findByRole("heading", { name: "Legacy ear drill" })).not.toBeNull();
    expect(currentStage()).toBe("Oído");
    await user.click(screen.getByRole("button", { name: "Complete ear drill" }));

    for (const [id, heading, stage] of [
      ["sound-test:1", "ship", "Palabras"],
      ["sound-test:2", "sheep", "Palabras"],
      ["sound-test:3", "The ship is here", "Frases"],
      ["sound-test:4", "The sheep is here", "Frases"],
    ]) {
      expect(await screen.findByRole("heading", { name: heading })).not.toBeNull();
      expect(currentStage()).toBe(stage);
      await user.click(screen.getByRole("button", { name: `Advance · ${id}` }));
    }
    expect(await screen.findByText("¡Muy bien!")).not.toBeNull();
    expect(tracked("visual_topic_shown")).toHaveLength(0);
    expect(tracked("visual_to_speaking")).toHaveLength(0);
  });
});
