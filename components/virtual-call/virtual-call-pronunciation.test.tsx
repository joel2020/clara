import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import type { AssessmentResult } from "@/lib/speech/azure-response";
import { RecognitionError } from "@/lib/speech/recognition";
import { CorrectionCard } from "./correction-card";
import { CallReportView } from "./call-report";
import { RetryPrompt } from "./retry-prompt";
import { RetryOutcomeNote } from "./retry-prompt";
import { useVirtualCall } from "./use-virtual-call";

const boundaries = vi.hoisted(() => ({
  createRecognition: vi.fn(),
  capturePracticeBinding: vi.fn(),
  saveVirtualCallForPracticeBinding: vi.fn(),
}));

vi.mock("@/lib/speech/recognition", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/speech/recognition")>();
  return { ...actual, createRecognition: boundaries.createRecognition };
});
vi.mock("@/lib/db", () => ({ repo: {
  capturePracticeBinding: boundaries.capturePracticeBinding,
  saveVirtualCallForPracticeBinding: boundaries.saveVirtualCallForPracticeBinding,
} }));
vi.mock("@/lib/auth-client", () => ({ authHeaders: async () => ({}) }));

const scenario = {
  id: "test-call", title: { es: "Prueba", en: "Test" }, description: { es: "", en: "" }, level: "A2" as const,
  objective: { es: "", en: "" }, targetVocabulary: [], targetGrammar: { es: "", en: "" },
  openingPrompt: "Tell me about it.", suggestedTurns: [], completionCriteria: { es: "", en: "" }, targetTurns: 3, length: "short" as const,
};

const freeEvidence: AssessmentResult = {
  provider: "azure", providerStatus: "valid", recognizedText: "I think it is useful.",
  pronunciationScore: 100, accuracyScore: 100, fluencyScore: 100, completenessScore: 100, prosodyScore: 100,
  targetPhonemeScore: 100, lowestTargetWordScore: 100, targetRecognized: true, minimalPairSubstitution: false,
  words: [{ word: "think", accuracyScore: 35, phonemes: [{ phoneme: "θ", accuracyScore: 35 }] }],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  boundaries.capturePracticeBinding.mockReturnValue({ account: "learner-a" });
  boundaries.saveVirtualCallForPracticeBinding.mockResolvedValue(undefined);
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => String(input).includes("/report")
    ? new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } })
    : new Response("audio", { status: 200 })));
  vi.stubGlobal("URL", { createObjectURL: () => "blob:test", revokeObjectURL: vi.fn() });
  vi.stubGlobal("Audio", class {
    src = ""; playbackRate = 1; onended: (() => void) | null = null; onpause: (() => void) | null = null;
    pause() { this.onpause?.(); }
    async play() { queueMicrotask(() => this.onended?.()); }
  });
});

it("uses one exact displayed reference for phrase capture and preserves the mic-start learner binding", async () => {
  const privateReference = `${"I think student.private+call@example.com has SSN 123-45-6789 ".padEnd(199, "X")}.`;
  expect(privateReference).toHaveLength(200);
  const free = deferred<{ transcript: string; confidence: number; alternatives: string[]; assessment: AssessmentResult }>();
  const scripted = deferred<{ transcript: string; confidence: number; alternatives: string[]; assessment: AssessmentResult }>();
  const cancel = vi.fn();
  boundaries.createRecognition
    .mockReturnValueOnce({ result: free.promise, stop: vi.fn(), cancel })
    .mockReturnValueOnce({ result: scripted.promise, stop: vi.fn(), cancel });
  const provider = vi.fn(async () => ({
    reply: "Thanks.", replyEs: "Gracias.", needsClarification: false, suggestions: [], metCriteria: false,
    correction: { original: privateReference, corrected: privateReference, explanation: privateReference, severity: "significant" as const, kind: "phrasing" as const },
  }));
  const { result, unmount } = renderHook(() => useVirtualCall({ lang: "en", level: "A2", studentName: "Ana", provider }));
  await act(async () => result.current.start(scenario, "practice"));
  await waitFor(() => expect(result.current.state).not.toBeNull());
  act(() => result.current.record());
  expect(boundaries.capturePracticeBinding.mock.invocationCallOrder[0]).toBeLessThan(boundaries.createRecognition.mock.invocationCallOrder[0]);
  await act(async () => free.resolve({ transcript: privateReference, confidence: 0.9, alternatives: [], assessment: freeEvidence }));
  await waitFor(() => expect(result.current.state?.pendingRetry?.pronunciation?.referenceSentence).toBe(privateReference));
  const exactDisplayed = result.current.state!.pendingRetry!.pronunciation!.referenceSentence;
  boundaries.capturePracticeBinding.mockReturnValue({ account: "learner-b" });
  act(() => result.current.retry());
  expect(boundaries.createRecognition.mock.calls[1]?.[0]).toMatchObject({ assessmentKind: "phrase", target: exactDisplayed });
  expect(boundaries.capturePracticeBinding).toHaveBeenCalledOnce();
  await act(async () => scripted.resolve({ transcript: exactDisplayed, confidence: 0.9, alternatives: [], assessment: freeEvidence }));
  act(() => result.current.end());
  await waitFor(() => expect(boundaries.saveVirtualCallForPracticeBinding).toHaveBeenCalledOnce());
  expect(boundaries.saveVirtualCallForPracticeBinding.mock.calls[0]?.[0]).toEqual({ account: "learner-a" });
  const reportRequest = vi.mocked(fetch).mock.calls.find(([input]) => String(input).includes("/api/virtual-call/report"));
  expect(reportRequest).toBeDefined();
  const reportBody = JSON.parse(String((reportRequest?.[1] as RequestInit | undefined)?.body));
  expect(JSON.stringify(reportBody)).not.toContain("student.private+call@example.com");
  expect(JSON.stringify(reportBody)).not.toContain("123-45-6789");
  expect(reportBody.facts).not.toHaveProperty("priorities");
  unmount();
});

it("shows one pronunciation cue with accessible slow and normal replay before retry", async () => {
  const pronunciation = {
    assessmentKind: "free" as const, policyVersion: "latam-v1" as const, outcome: "diagnostic" as const,
    targetWord: "think", targetSound: "/θ/ and /ð/", cueKey: "pronunciation.cue.es.th" as const,
    referenceSentence: "I think it is useful.", source: "provider" as const,
  };
  const correction = { original: "I tink it is useful.", corrected: "I think it is useful.", explanation: "Use think.", severity: "significant" as const, kind: "phrasing" as const, pronunciation };
  const onListen = vi.fn();
  render(<><CorrectionCard correction={correction} lang="en" /><RetryPrompt correction={correction} lang="en" recording={false} disabled={false} onRecord={vi.fn()} onStop={vi.fn()} onListen={onListen} /></>);
  expect(screen.getAllByText("think").length).toBeGreaterThan(0);
  expect(screen.getByText(/tongue tip between your teeth/i)).toBeVisible();
  expect(screen.getAllByText("I think it is useful.").length).toBeGreaterThan(0);
  await userEvent.click(screen.getByRole("button", { name: /play slowly/i }));
  await userEvent.click(screen.getByRole("button", { name: /play at normal speed/i }));
  expect(onListen.mock.calls.map(([rate]) => rate)).toEqual([0.65, 1]);
});

it("cancels an active microphone on unmount without saving a stale result", async () => {
  const active = deferred<{ transcript: string; confidence: number; alternatives: string[]; assessment: AssessmentResult }>();
  const cancel = vi.fn();
  boundaries.createRecognition.mockReturnValueOnce({ result: active.promise, stop: vi.fn(), cancel });
  const provider = vi.fn(async () => ({ reply: "Thanks.", replyEs: "Gracias.", correction: null, needsClarification: false, suggestions: [], metCriteria: false }));
  const { result, unmount } = renderHook(() => useVirtualCall({ lang: "es", level: "A2", studentName: "Ana", provider }));
  await act(async () => result.current.start(scenario, "practice"));
  await waitFor(() => expect(result.current.state).not.toBeNull());
  act(() => result.current.record());
  unmount();
  expect(cancel).toHaveBeenCalledOnce();
  await act(async () => active.resolve({ transcript: "A stale result.", confidence: 0.9, alternatives: [], assessment: freeEvidence }));
  expect(provider).not.toHaveBeenCalled();
  expect(boundaries.saveVirtualCallForPracticeBinding).not.toHaveBeenCalled();
});

it("fully disposes a deferred guide voice before opening the free-conversation microphone", async () => {
  const pendingTts = deferred<Response>();
  const pendingRecognition = deferred<{ transcript: string; confidence: number; alternatives: string[]; assessment: AssessmentResult }>();
  let ttsRequest: RequestInit | undefined;
  const createObjectURL = vi.fn(() => "blob:late-free");
  const revokeObjectURL = vi.fn();
  const audioInstances: Array<{
    src: string;
    onended: (() => void) | null;
    onpause: (() => void) | null;
    pause: ReturnType<typeof vi.fn>;
    play: ReturnType<typeof vi.fn>;
  }> = [];
  vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    ttsRequest = init;
    return pendingTts.promise;
  }));
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
  vi.stubGlobal("Audio", class {
    src = ""; playbackRate = 1; onended: (() => void) | null = null; onpause: (() => void) | null = null;
    pause = vi.fn(() => this.onpause?.());
    play = vi.fn(async () => {});
    constructor() { audioInstances.push(this); }
  });
  boundaries.createRecognition.mockReturnValueOnce({ result: pendingRecognition.promise, stop: vi.fn(), cancel: vi.fn() });
  const { result, unmount } = renderHook(() => useVirtualCall({ lang: "en", level: "A2", studentName: "Ana", provider: vi.fn() }));
  act(() => result.current.start(scenario, "practice"));
  await waitFor(() => expect(ttsRequest).toBeDefined());

  act(() => result.current.record());

  expect((ttsRequest?.signal as AbortSignal).aborted).toBe(true);
  expect(boundaries.createRecognition).toHaveBeenCalledOnce();
  expect(audioInstances[0]).toMatchObject({ src: "", onended: null, onpause: null });
  await act(async () => pendingTts.resolve(new Response("late", { status: 200 })));
  expect(createObjectURL).not.toHaveBeenCalled();
  expect(audioInstances[0].play).not.toHaveBeenCalled();
  expect(revokeObjectURL).not.toHaveBeenCalled();
  unmount();
});

it("ignores late recognition errors after reset and end", async () => {
  const afterReset = deferred<{ transcript: string; confidence: number; alternatives: string[]; assessment: AssessmentResult }>();
  const afterEnd = deferred<{ transcript: string; confidence: number; alternatives: string[]; assessment: AssessmentResult }>();
  boundaries.createRecognition
    .mockReturnValueOnce({ result: afterReset.promise, stop: vi.fn(), cancel: vi.fn() })
    .mockReturnValueOnce({ result: afterEnd.promise, stop: vi.fn(), cancel: vi.fn() });
  const { result, unmount } = renderHook(() => useVirtualCall({ lang: "es", level: "A2", studentName: "Ana", provider: vi.fn() }));
  act(() => result.current.start(scenario, "practice"));
  act(() => result.current.record());
  act(() => result.current.reset());
  await act(async () => afterReset.reject(new RecognitionError("technical-skip", "late")));
  expect(result.current.state).toBeNull();
  expect(result.current.error).toBeNull();
  act(() => result.current.start(scenario, "practice"));
  act(() => result.current.record());
  act(() => result.current.end());
  await act(async () => afterEnd.reject(new RecognitionError("no-speech", "late")));
  expect(result.current.state?.phase).toBe("ended");
  expect(result.current.error).toBeNull();
  unmount();
});

it("finalizes a real scripted provider outage and releases the held guide reply", async () => {
  const free = deferred<{ transcript: string; confidence: number; alternatives: string[]; assessment: AssessmentResult }>();
  const scripted = deferred<{ transcript: string; confidence: number; alternatives: string[]; assessment: AssessmentResult }>();
  boundaries.createRecognition
    .mockReturnValueOnce({ result: free.promise, stop: vi.fn(), cancel: vi.fn() })
    .mockReturnValueOnce({ result: scripted.promise, stop: vi.fn(), cancel: vi.fn() });
  const provider = vi.fn(async () => ({
    reply: "The guide continues.", replyEs: "La guía continúa.", needsClarification: false, suggestions: [], metCriteria: false,
    correction: { original: "I tink it.", corrected: "I think it.", explanation: "Use think.", severity: "significant" as const, kind: "phrasing" as const },
  }));
  const { result, unmount } = renderHook(() => useVirtualCall({ lang: "es", level: "A2", studentName: "Ana", provider }));
  await act(async () => result.current.start(scenario, "practice"));
  act(() => result.current.record());
  await act(async () => free.resolve({ transcript: "I tink it.", confidence: 1, alternatives: [], assessment: freeEvidence }));
  await waitFor(() => expect(result.current.state?.pendingRetry).not.toBeNull());
  act(() => result.current.retry());
  await act(async () => scripted.reject(new RecognitionError("technical-skip", "provider unavailable")));
  await waitFor(() => expect(result.current.state?.pendingRetry).toBeNull());
  expect(result.current.error).toBeNull();
  expect(result.current.state?.turns[0]?.retry).toMatchObject({
    accepted: false,
    transcriptStatus: "unavailable",
    pronunciationOutcome: "technical-skip",
    pronunciationPolicyVersion: "latam-v1",
  });
  expect(result.current.entries.at(-1)).toMatchObject({ kind: "guide", text: "The guide continues." });
  expect(boundaries.saveVirtualCallForPracticeBinding).not.toHaveBeenCalled();
  unmount();
});

it("keeps a no-speech scripted retry pending and shows the bilingual retryable mic error", async () => {
  const free = deferred<{ transcript: string; confidence: number; alternatives: string[]; assessment: AssessmentResult }>();
  const scripted = deferred<{ transcript: string; confidence: number; alternatives: string[]; assessment: AssessmentResult }>();
  boundaries.createRecognition
    .mockReturnValueOnce({ result: free.promise, stop: vi.fn(), cancel: vi.fn() })
    .mockReturnValueOnce({ result: scripted.promise, stop: vi.fn(), cancel: vi.fn() });
  const provider = vi.fn(async () => ({
    reply: "Continue.", replyEs: "Continúa.", needsClarification: false, suggestions: [], metCriteria: false,
    correction: { original: "I tink it.", corrected: "I think it.", explanation: "Use think.", severity: "significant" as const, kind: "phrasing" as const },
  }));
  const { result, unmount } = renderHook(() => useVirtualCall({ lang: "es", level: "A2", studentName: "Ana", provider }));
  await act(async () => result.current.start(scenario, "practice"));
  act(() => result.current.record());
  await act(async () => free.resolve({ transcript: "I tink it.", confidence: 1, alternatives: [], assessment: freeEvidence }));
  await waitFor(() => expect(result.current.state?.pendingRetry).not.toBeNull());
  act(() => result.current.retry());
  await act(async () => scripted.reject(new RecognitionError("no-speech", "no speech")));
  expect(result.current.state?.pendingRetry).not.toBeNull();
  expect(result.current.error?.message).toMatch(/No te escuchamos/i);
  expect(result.current.entries.some((entry) => entry.kind === "guide" && entry.text === "Continue.")).toBe(false);
  unmount();
});

it("fully disposes a deferred correction voice before opening the scripted retry microphone", async () => {
  const free = deferred<{ transcript: string; confidence: number; alternatives: string[]; assessment: AssessmentResult }>();
  const retryRecognition = deferred<{ transcript: string; confidence: number; alternatives: string[]; assessment: AssessmentResult }>();
  const deferredCorrectionTts = deferred<Response>();
  const ttsRequests: RequestInit[] = [];
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    if (!String(input).includes("/api/tts")) return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    ttsRequests.push(init ?? {});
    return ttsRequests.length === 1
      ? Promise.resolve(new Response("opening", { status: 200 }))
      : deferredCorrectionTts.promise;
  }));
  const createObjectURL = vi.fn(() => "blob:opening-only");
  const revokeObjectURL = vi.fn();
  const audioInstances: Array<{
    src: string;
    onended: (() => void) | null;
    onpause: (() => void) | null;
    pause: ReturnType<typeof vi.fn>;
    play: ReturnType<typeof vi.fn>;
  }> = [];
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
  vi.stubGlobal("Audio", class {
    src = ""; playbackRate = 1; onended: (() => void) | null = null; onpause: (() => void) | null = null;
    pause = vi.fn(() => this.onpause?.());
    play = vi.fn(async () => {});
    constructor() { audioInstances.push(this); }
  });
  boundaries.createRecognition
    .mockReturnValueOnce({ result: free.promise, stop: vi.fn(), cancel: vi.fn() })
    .mockReturnValueOnce({ result: retryRecognition.promise, stop: vi.fn(), cancel: vi.fn() });
  const provider = vi.fn(async () => ({
    reply: "Continue.", replyEs: "Continúa.", needsClarification: false, suggestions: [], metCriteria: false,
    correction: { original: "I tink it.", corrected: "I think it.", explanation: "Use think.", severity: "significant" as const, kind: "phrasing" as const },
  }));
  const { result, unmount } = renderHook(() => useVirtualCall({ lang: "en", level: "A2", studentName: "Ana", provider }));
  act(() => result.current.start(scenario, "practice"));
  await waitFor(() => expect(audioInstances[0]?.src).toBe("blob:opening-only"));
  act(() => result.current.record());
  await act(async () => free.resolve({ transcript: "I tink it.", confidence: 1, alternatives: [], assessment: freeEvidence }));
  await waitFor(() => expect(ttsRequests).toHaveLength(2));

  act(() => result.current.retry());

  expect((ttsRequests[1].signal as AbortSignal).aborted).toBe(true);
  expect(boundaries.createRecognition).toHaveBeenCalledTimes(2);
  expect(audioInstances[0]).toMatchObject({ src: "", onended: null, onpause: null });
  await act(async () => deferredCorrectionTts.resolve(new Response("late correction", { status: 200 })));
  expect(createObjectURL).toHaveBeenCalledTimes(1);
  expect(audioInstances[0].play).toHaveBeenCalledTimes(1);
  expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  unmount();
});

it("aborts superseded TTS, ignores out-of-order responses, and revokes the owned URL on end", async () => {
  const first = deferred<Response>();
  const second = deferred<Response>();
  const ttsRequests: RequestInit[] = [];
  vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes("/report")) return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    ttsRequests.push(init ?? {});
    return ttsRequests.length === 1 ? first.promise : second.promise;
  }));
  const revoked: string[] = [];
  let urlSequence = 0;
  vi.stubGlobal("URL", { createObjectURL: () => `blob:tts-${++urlSequence}`, revokeObjectURL: (url: string) => revoked.push(url) });
  const audioInstances: Array<{ src: string; playbackRate: number; pause: ReturnType<typeof vi.fn>; onended: (() => void) | null; onpause: (() => void) | null }> = [];
  vi.stubGlobal("Audio", class {
    src = ""; playbackRate = 1; onended: (() => void) | null = null; onpause: (() => void) | null = null;
    pause = vi.fn(() => this.onpause?.());
    constructor() { audioInstances.push(this); }
    async play() {}
  });
  const provider = vi.fn();
  const { result, unmount } = renderHook(() => useVirtualCall({ lang: "en", level: "A2", studentName: "Ana", provider }));
  act(() => result.current.start(scenario, "practice"));
  await waitFor(() => expect(ttsRequests).toHaveLength(1));
  act(() => result.current.replay("Newest guide line", 0.65));
  await waitFor(() => expect(ttsRequests).toHaveLength(2));
  expect((ttsRequests[0].signal as AbortSignal).aborted).toBe(true);
  await act(async () => second.resolve(new Response("newest", { status: 200 })));
  await waitFor(() => expect(audioInstances[0].src).toBe("blob:tts-1"));
  expect(audioInstances[0].playbackRate).toBe(0.65);
  await act(async () => first.resolve(new Response("stale", { status: 200 })));
  expect(audioInstances[0].src).toBe("blob:tts-1");
  act(() => result.current.end());
  expect(audioInstances[0].src).toBe("");
  expect(audioInstances[0].onended).toBeNull();
  expect(audioInstances[0].onpause).toBeNull();
  expect(revoked).toEqual(["blob:tts-1"]);
  unmount();
  expect(revoked).toEqual(["blob:tts-1"]);
});

it("aborts pending TTS on unmount and a late response cannot create a blob URL", async () => {
  const pending = deferred<Response>();
  let requestInit: RequestInit | undefined;
  const createObjectURL = vi.fn(() => "blob:must-not-exist");
  vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => { requestInit = init; return pending.promise; }));
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });
  const audioInstances: Array<{ src: string }> = [];
  vi.stubGlobal("Audio", class {
    src = ""; playbackRate = 1; onended: (() => void) | null = null; onpause: (() => void) | null = null;
    constructor() { audioInstances.push(this); }
    pause() {}
    async play() {}
  });
  const { result, unmount } = renderHook(() => useVirtualCall({ lang: "en", level: "A2", studentName: "Ana", provider: vi.fn() }));
  act(() => result.current.start(scenario, "practice"));
  await waitFor(() => expect(requestInit).toBeDefined());
  unmount();
  expect((requestInit?.signal as AbortSignal).aborted).toBe(true);
  await act(async () => pending.resolve(new Response("late", { status: 200 })));
  expect(createObjectURL).not.toHaveBeenCalled();
  expect(audioInstances[0].src).toBe("");
});

it("revokes each replaced or failed-playback TTS URL exactly once", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("audio", { status: 200 })));
  const revoked: string[] = [];
  let urlSequence = 0;
  vi.stubGlobal("URL", { createObjectURL: () => `blob:owned-${++urlSequence}`, revokeObjectURL: (url: string) => revoked.push(url) });
  let plays = 0;
  const audioInstances: Array<{ src: string }> = [];
  vi.stubGlobal("Audio", class {
    src = ""; playbackRate = 1; onended: (() => void) | null = null; onpause: (() => void) | null = null;
    constructor() { audioInstances.push(this); }
    pause() {}
    async play() { plays += 1; if (plays === 2) throw new Error("autoplay blocked"); }
  });
  const { result, unmount } = renderHook(() => useVirtualCall({ lang: "en", level: "A2", studentName: "Ana", provider: vi.fn() }));
  act(() => result.current.start(scenario, "practice"));
  await waitFor(() => expect(audioInstances[0].src).toBe("blob:owned-1"));
  act(() => result.current.replay("Replacement"));
  await waitFor(() => expect(result.current.audioFailed).toBe(true));
  expect(audioInstances[0].src).toBe("");
  expect(revoked).toEqual(["blob:owned-1", "blob:owned-2"]);
  unmount();
  expect(revoked).toEqual(["blob:owned-1", "blob:owned-2"]);
});

it("labels transcript acceptance and acoustic practice as separate outcomes", () => {
  render(<RetryOutcomeNote outcome={{ transcript: "I think it is useful.", accepted: true, similarity: 1, at: 1, pronunciationOutcome: "retry", pronunciationPolicyVersion: "latam-v1" }} lang="en" />);
  expect(screen.getByText(/call keeps moving/i)).toBeVisible();
  expect(screen.getByText(/practiced, not mastered yet/i)).toBeVisible();
  expect(screen.queryByText(/^pronunciation mastered$/i)).not.toBeInTheDocument();
});

it("renders an honest localized unavailable status even without a pronunciation outcome", () => {
  const outcome = { transcript: "", accepted: false, similarity: 0, at: 1, transcriptStatus: "unavailable" as const };
  const { rerender } = render(<RetryOutcomeNote outcome={outcome} lang="en" />);
  expect(screen.getByRole("status")).toHaveTextContent("Pronunciation grading was unavailable.");
  rerender(<RetryOutcomeNote outcome={outcome} lang="es" />);
  expect(screen.getByRole("status")).toHaveTextContent("La calificación de pronunciación no estuvo disponible.");
});

it("reports diagnosis, practiced, mastered, and unavailable evidence without averaging free speech", () => {
  const diagnostic = {
    assessmentKind: "free" as const, policyVersion: "latam-v1" as const, outcome: "diagnostic" as const,
    targetWord: "think", targetSound: "/θ/ and /ð/", cueKey: "pronunciation.cue.es.th" as const,
    referenceSentence: "I think it is useful.", source: "provider" as const,
  };
  render(<CallReportView
    report={{ scenarioId: scenario.id, durationMs: 30_000, learnerTurns: 3, cleanTurns: 2, metCriteria: true,
      corrections: [], priorities: [], vocabularyUsed: [], retriedCount: 3, retriedAcceptedCount: 3,
      pronunciation: { diagnosticTargets: [diagnostic], scripted: { graded: 2, mastered: 1, practiced: 1, unavailable: 1, averageScore: 78 } } }}
    scenario={scenario} lang="en" onReplay={vi.fn()} onAnother={vi.fn()} homeHref="/" />);
  expect(screen.getByText(/diagnostic target: think/i)).toBeVisible();
  expect(screen.getByText(/1 mastered/i)).toBeVisible();
  expect(screen.getByText(/1 practiced, not mastered/i)).toBeVisible();
  expect(screen.getByText(/1 unavailable/i)).toBeVisible();
  expect(screen.getByText(/78.*2 scripted sentences measured/i)).toBeVisible();
});
