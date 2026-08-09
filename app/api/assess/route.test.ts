import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-guard", () => ({ guardApi: () => null }));
vi.mock("@/lib/auth-server", () => ({
  requireAllowedUserIdentity: async () => ({ user: { id: "test-user" } }),
}));
vi.mock("@/lib/api-quota", () => ({ enforcePaidApiQuota: async () => null }));

import { POST } from "./route";

const success = {
  RecognitionStatus: "Success",
  NBest: [{
    Display: "coffee",
    PronunciationAssessment: { PronScore: 81.6, ProsodyScore: 64.6 },
    Words: [{ Word: "coffee", Phonemes: [{ Phoneme: "k", AccuracyScore: 79.6 }] }],
  }],
};

function request(kind: string, target?: string): Request {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array([1, 2, 3])], { type: "audio/wav" }), "attempt.wav");
  form.append("kind", kind);
  if (target !== undefined) form.append("target", target);
  return { formData: async () => form } as Request;
}

function provider(payload: unknown, status = 200) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    void input;
    void init;
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  });
}

function assessmentHeader(mock: ReturnType<typeof vi.fn>) {
  const init = mock.mock.calls[0][1] as RequestInit;
  const headers = init.headers as Record<string, string>;
  return JSON.parse(Buffer.from(headers["Pronunciation-Assessment"], "base64").toString("utf8"));
}

beforeEach(() => {
  vi.stubEnv("AZURE_SPEECH_KEY", "test-secret-key");
  vi.stubEnv("AZURE_SPEECH_REGION", "test-region");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/assess provider boundary", () => {
  it("uses exact word semantics without prosody", async () => {
    const fetchMock = provider(success);
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(request("word", "coffee"));
    expect(response.status).toBe(200);
    expect(assessmentHeader(fetchMock)).toEqual({
      ReferenceText: "coffee",
      GradingSystem: "HundredMark",
      Granularity: "Phoneme",
      Dimension: "Comprehensive",
      EnableMiscue: true,
      EnableProsodyAssessment: false,
      PhonemeAlphabet: "IPA",
    });
    expect(fetchMock.mock.calls[0][0]).toContain("language=en-US&format=detailed");
    await expect(response.json()).resolves.toMatchObject({
      provider: "azure",
      providerStatus: "valid",
      pronunciationScore: 81.6,
    });
  });

  it("enables prosody for a scripted phrase only", async () => {
    const fetchMock = provider(success);
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(request("phrase", "I'd like a coffee"));
    expect(response.status).toBe(200);
    expect(assessmentHeader(fetchMock).EnableProsodyAssessment).toBe(true);
  });

  it("keeps free speech unscripted and without prosody", async () => {
    const fetchMock = provider(success);
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(request("free"));
    expect(response.status).toBe(200);
    expect(assessmentHeader(fetchMock)).toMatchObject({
      ReferenceText: "",
      EnableMiscue: false,
      EnableProsodyAssessment: false,
    });
  });

  it.each([
    ["free", "unexpected target"],
    ["word", undefined],
    ["phrase", undefined],
    ["unknown", "coffee"],
  ])("rejects invalid mode/reference pair %s", async (kind, target) => {
    const fetchMock = provider(success);
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(request(kind, target));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marshals no-match as a bounded learner capture outcome without invented zeros", async () => {
    vi.stubGlobal("fetch", provider({ RecognitionStatus: "NoMatch", NBest: [] }));
    const response = await POST(request("free"));
    expect(await response.json()).toEqual({
      provider: "azure",
      providerStatus: "valid",
      recognitionReason: "no-match",
      recognizedText: "",
      words: [],
    });
  });

  it("marshals malformed provider evidence as a technical skip", async () => {
    vi.stubGlobal("fetch", provider({
      RecognitionStatus: "Success",
      NBest: [{ Display: "hello", Words: [{ Word: "", Phonemes: [{ Phoneme: "h" }] }] }],
    }));
    const response = await POST(request("free"));
    expect(await response.json()).toEqual({
      provider: "azure",
      providerStatus: "technical-skip",
      recognizedText: "",
      words: [],
    });
  });

  it("returns a bounded error for malformed JSON", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not-json", { status: 200 })));
    const response = await POST(request("free"));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Couldn't reach the assessment service." });
    expect(errorLog).toHaveBeenCalledWith("[api/assess] provider request failed");
  });

  it("returns a bounded error for provider non-2xx", async () => {
    vi.stubGlobal("fetch", provider({ SecretRaw: "must-not-leak" }, 429));
    const response = await POST(request("free"));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Assessment failed." });
  });

  it("never forwards raw payload fields, credentials, names, or audio", async () => {
    vi.stubGlobal("fetch", provider({
      ...success,
      SecretRaw: "must-not-leak",
      LearnerName: "private-name",
      Audio: "private-audio",
    }));
    const response = await POST(request("phrase", "coffee"));
    const body = JSON.stringify(await response.json());
    expect(body).not.toContain("must-not-leak");
    expect(body).not.toContain("private-name");
    expect(body).not.toContain("private-audio");
    expect(body).not.toContain("test-secret-key");
  });
});
