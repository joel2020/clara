import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Lesson, PracticeItem } from "@/lib/db/types";
import type { PracticeOutcome } from "@/lib/practice";

const boundaries = vi.hoisted(() => ({
  getAllProgress: vi.fn(async () => []),
  getAttempts: vi.fn(async () => []),
  getAttemptsForPracticeBinding: vi.fn(async () => []),
  capturePracticeBinding: vi.fn(() => ({ binding: "context-scene" })),
  playPronunciation: vi.fn(),
  stopPronunciation: vi.fn(),
  recordPracticeAttempt: vi.fn(),
  recognitionSupported: true,
  voiceConsent: undefined as { version: number; at: number } | undefined,
  recognitionResult: {
    transcript: "Can I have a coffee, please?",
    confidence: 1,
    alternatives: ["Can I have a coffee, please?"],
  } as Record<string, unknown>,
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
    capturePracticeBinding: boundaries.capturePracticeBinding,
    getAllProgress: boundaries.getAllProgress,
    getAttempts: boundaries.getAttempts,
    getAttemptsForPracticeBinding: boundaries.getAttemptsForPracticeBinding,
  },
}));

vi.mock("@/lib/hooks/usePlayer", () => ({ usePlayer: () => undefined }));

vi.mock("@/lib/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: {
      coachLanguage: "es",
      recognitionLang: "en-US",
      speechRate: 0.9,
      voiceURI: undefined,
      dailyGoal: 40,
      studentName: null,
      voiceConsent: boundaries.voiceConsent,
    },
    ready: true,
    update: vi.fn(),
    saveVoiceConsent: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useSpeechSupport", () => ({
  useSpeechSupport: () => ({ synthesis: true, recognition: boundaries.recognitionSupported }),
}));

vi.mock("@/lib/speech/player", () => ({
  playPronunciation: boundaries.playPronunciation,
  stopPronunciation: boundaries.stopPronunciation,
  hasRecordedVoice: () => false,
  pickAltVoice: vi.fn(),
}));

vi.mock("@/lib/speech/recognition", () => ({
  RecognitionError: class RecognitionError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  recognitionErrorKey: () => "recGeneric",
  recognitionMode: () => "instant",
  createRecognition: () => ({
    result: Promise.resolve(boundaries.recognitionResult),
    stop: vi.fn(),
    cancel: vi.fn(),
  }),
}));

vi.mock("@/lib/practice", () => ({
  recordPracticeAttempt: boundaries.recordPracticeAttempt,
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

vi.mock("@/lib/fx", () => ({
  celebrate: vi.fn(),
  levelUpBurst: vi.fn(),
  popConfetti: vi.fn(),
}));

vi.mock("@/components/juice", () => ({
  juice: { centerBurst: vi.fn(), sweep: vi.fn() },
}));

vi.mock("@/components/cinematic", () => ({
  cinematic: { play: vi.fn() },
}));

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));

vi.mock("sonner", () => {
  const toast = Object.assign(vi.fn(), { success: vi.fn() });
  return { toast };
});

import { ProducePanel } from "@/components/practice/produce-panel";
import { PracticeSession } from "@/components/practice/practice-session";
import { ContextPhraseScene } from "@/components/visual-learning/context-phrase-scene";
import { CAFE_RESTAURANT_PACK } from "@/lib/visual-learning/manifest";

const coffeeItem: PracticeItem = {
  id: "conv-cafe:3",
  text: "Can I have a coffee, please?",
  ipa: "/kæn aɪ hæv ə ˈkɔːfi pliːz/",
  meaning: "¿Me das un café, por favor?",
  mouthHint: "Une can I: ke-nai.",
  kind: "phrase",
  categoryId: "conversation",
  phoneme: "conversation",
  visualObjectId: "coffee",
};

function coffeeLesson(item: PracticeItem = coffeeItem): Lesson {
  return {
    id: "conv-cafe",
    title: "Café & restaurant",
    subtitle: "Café y restaurante",
    description: "Order with confidence.",
    kind: "phrase",
    categoryIds: ["conversation"],
    items: [item],
    track: "conversation",
    visualTopicId: "cafe-restaurant",
    order: 22,
  };
}

function twoPhraseCoffeeLesson(): Lesson {
  return {
    ...coffeeLesson(),
    items: [
      {
        ...coffeeItem,
        id: "conv-cafe:1",
        text: "A table for two, please",
        visualObjectId: "table",
      },
      coffeeItem,
    ],
  };
}

function outcome(passed: boolean): PracticeOutcome {
  return {
    score: {
      score: passed ? 96 : 48,
      passed,
      heard: passed ? coffeeItem.text : "Can I have tea",
      heardPartner: false,
      feedback: passed ? "Clear." : "Try again.",
      feedbackKey: passed ? "perfect" : "notQuite",
      gradingOutcome: passed ? "mastered" : "retry",
    },
    recorded: true,
    rewards: {
      xpGain: passed ? 12 : 2,
      newXp: passed ? 12 : 2,
      leveledUp: false,
      oldLevel: 1,
      newLevel: 1,
      combo: passed ? 1 : 0,
      starsEarned: passed ? 3 : 0,
      starTotal: passed ? 3 : 0,
      streakIncreased: false,
      currentStreak: 0,
      freezeUsed: false,
      freezeEarned: false,
      dailyGoalMet: false,
      unlocked: [],
    },
    diagnosis: { misses: [], sound: null },
  };
}

async function enterCafeSpeaking() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Entrar al café" }));
  await user.click(screen.getByRole("button", { name: "Coffee · Café" }));
  await user.click(screen.getByRole("button", { name: "Continuar para hablar" }));
}

describe("ContextPhraseScene", () => {
  beforeEach(() => {
    boundaries.getAllProgress.mockClear();
    boundaries.playPronunciation.mockReset();
    boundaries.stopPronunciation.mockReset();
    boundaries.recordPracticeAttempt.mockReset();
  });

  it("catches a missing focused object, bilingual label, live phrase, IPA, meaning, or manifest speak pose", () => {
    const { container } = render(
      <ContextPhraseScene pack={CAFE_RESTAURANT_PACK} item={coffeeItem} language="es" />,
    );

    const scene = screen.getByRole("group", { name: "Coffee phrase scene" });
    expect(screen.getByAltText("Una taza de café").getAttribute("src"))
      .toBe("/visual-learning/cafe-restaurant/objects/coffee.webp");
    expect(screen.getByText("Coffee")).not.toBeNull();
    expect(screen.getByText("Café")).not.toBeNull();

    const phrase = screen.getByRole("heading", { name: coffeeItem.text });
    expect(phrase.getAttribute("lang")).toBe("en");
    expect(screen.getByText(coffeeItem.ipa)).not.toBeNull();
    expect(screen.getByText(coffeeItem.meaning!)).not.toBeNull();
    expect(screen.getByText(coffeeItem.meaning!).getAttribute("lang")).toBe("es");

    expect(scene.contains(phrase)).toBe(true);
    expect(container.querySelector('img[src="/character/lumi-think.png"]')).not.toBeNull();
  });

  it("catches unresolved object IDs that replace the technical fallback with an empty visual shell", () => {
    const { container } = render(
      <ContextPhraseScene
        pack={CAFE_RESTAURANT_PACK}
        item={{ ...coffeeItem, visualObjectId: "missing" }}
        language="en"
      />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("keeps persistence, grading, and rewards out of the phrase scene", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/visual-learning/context-phrase-scene.tsx"),
      "utf8",
    );

    expect(source).not.toMatch(
      /\brecordPracticeAttempt\b|\brepo\b|@\/lib\/practice|@\/lib\/gamification/,
    );
  });

  it("catches raw colors, gradients, controls, or reward UI entering the visual teaching surface", () => {
    const { container } = render(
      <ContextPhraseScene pack={CAFE_RESTAURANT_PACK} item={coffeeItem} language="en" />,
    );

    const renderedPresentation = Array.from(container.querySelectorAll<HTMLElement>(
      "[data-context-phrase-scene], [data-phrase-copy], [data-phrase-copy] [class], [data-phrase-copy] [style]",
    ))
      .flatMap((element) => [
        element.getAttribute("class") ?? "",
        element.getAttribute("style") ?? "",
      ])
      .join(" ");
    expect(renderedPresentation).not.toMatch(/(?:#[0-9a-f]{3,8}|rgba?\(|gradient)/i);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByLabelText(/record|microphone/i)).toBeNull();
    expect(container.querySelector(".star-chip, .sparkle")).toBeNull();
  });
});

describe("PracticeSession phrase-scene integration", () => {
  beforeEach(() => {
    boundaries.recognitionSupported = true;
    boundaries.voiceConsent = undefined;
    Object.defineProperty(window, "scrollTo", {
      configurable: true,
      value: vi.fn(),
      writable: true,
    });
  });

  it("catches a resolved topic/object pair that stays on the text-only focal card", async () => {
    render(<PracticeSession lesson={coffeeLesson()} />);
    await enterCafeSpeaking();

    expect(await screen.findByRole("group", { name: "Coffee phrase scene" })).not.toBeNull();
    expect(screen.getByText(coffeeItem.mouthHint)).not.toBeNull();
    expect(screen.getByRole("button", { name: "Escucha" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Grabar tu pronunciación" })).not.toBeNull();
  });

  it("lets a learner without voice consent skip to the next phrase without hiding microphone practice", async () => {
    const user = userEvent.setup();
    render(<PracticeSession lesson={twoPhraseCoffeeLesson()} />);
    await enterCafeSpeaking();

    expect(screen.getByRole("button", { name: "Grabar tu pronunciación" })).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Saltar a la siguiente" }));

    expect(await screen.findByRole("heading", { name: "A table for two, please" })).not.toBeNull();
  });

  it("keeps the regular microphone path when current voice consent is granted", async () => {
    boundaries.voiceConsent = { version: 2, at: 1 };
    render(<PracticeSession lesson={twoPhraseCoffeeLesson()} />);
    await enterCafeSpeaking();

    expect(screen.getByRole("button", { name: "Grabar tu pronunciación" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Saltar a la siguiente" })).toBeNull();
  });

  it("renders one no-mic advance control when speech recognition is unsupported", async () => {
    boundaries.recognitionSupported = false;
    render(<PracticeSession lesson={twoPhraseCoffeeLesson()} />);
    await enterCafeSpeaking();

    expect(screen.getAllByRole("button", { name: "Saltar a la siguiente" })).toHaveLength(1);
  });

  it.each([
    ["absent topic", { ...coffeeLesson(), visualTopicId: undefined }],
    [
      "unresolved object",
      coffeeLesson({ ...coffeeItem, visualObjectId: "not-in-manifest" }),
    ],
  ])("keeps the old text-only card for an %s", async (_case, lesson) => {
    render(<PracticeSession lesson={lesson} />);
    if (lesson.visualTopicId) await enterCafeSpeaking();

    const phrase = await screen.findByRole("heading", { name: coffeeItem.text });
    expect(phrase.className).toContain("text-4xl");
    expect(screen.queryByRole("group", { name: "Coffee phrase scene" })).toBeNull();
    expect(screen.getByText(coffeeItem.ipa)).not.toBeNull();
    expect(screen.getByText(coffeeItem.meaning!)).not.toBeNull();
    expect(screen.getByText(coffeeItem.mouthHint)).not.toBeNull();
    expect(screen.getByRole("button", { name: "Escucha" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Grabar tu pronunciación" })).not.toBeNull();
  });
});

describe("ProducePanel outcome ownership", () => {
  it.each([
    [false, "Otra vez", "/character/lumi-encourage.png"],
    [true, "Claro", "/character/lumi-cheer.png"],
  ] as const)(
    "keeps the %s PracticeOutcome in control of Lumi's result mood",
    async (passed, resultHeading, expectedArt) => {
      const user = userEvent.setup();
      const recognizedText = passed ? coffeeItem.text : "Can I have tea, please?";
      boundaries.recognitionResult = {
        transcript: recognizedText,
        confidence: 1,
        alternatives: [recognizedText],
        assessment: {
          provider: "azure",
          providerStatus: "valid",
          recognizedText,
          pronunciationScore: passed ? 94 : 62,
          accuracyScore: passed ? 94 : 62,
          completenessScore: 100,
          prosodyScore: 80,
          words: [{ word: "coffee", accuracyScore: passed ? 94 : 62, phonemes: [{ phoneme: "conversation", accuracyScore: passed ? 94 : 62 }] }],
        },
      };
      boundaries.recordPracticeAttempt.mockResolvedValueOnce(outcome(passed));
      const { container } = render(
        <ProducePanel
          item={coffeeItem}
          lessonId="conv-cafe"
          itemPool={[coffeeItem]}
          recognitionSupported
          combo={0}
          onNext={() => {}}
          hasNext={false}
        />,
      );

      await user.click(screen.getByRole("button", { name: "Grabar tu pronunciación" }));
      expect(await screen.findByRole("heading", { name: resultHeading })).not.toBeNull();
      await waitFor(() => {
        expect(container.querySelector(`img[src="${expectedArt}"]`)).not.toBeNull();
      });
    },
  );
});
