// Phoneme-level pronunciation assessment via Azure AI Speech. The client
// records 16 kHz mono WAV and posts it with the target text; Azure returns
// real acoustic scores — overall pronunciation, per-word accuracy/error type,
// and per-phoneme accuracy — which is what lets feedback say exactly WHICH
// sound to fix. Env-gated: without AZURE_SPEECH_KEY the app keeps its
// transcript-based scoring untouched.
//
// Uses the REST short-audio endpoint (clips here are a few seconds), with the
// Pronunciation-Assessment config passed as a base64 header per the API spec.

import { guardApi } from "@/lib/api-guard";
import { requireUser } from "@/lib/auth-server";

export const runtime = "nodejs";
export const maxDuration = 30;

interface AzurePhoneme {
  Phoneme?: string;
  PronunciationAssessment?: { AccuracyScore?: number };
  AccuracyScore?: number;
}

interface AzureWord {
  Word?: string;
  PronunciationAssessment?: { AccuracyScore?: number; ErrorType?: string };
  AccuracyScore?: number;
  ErrorType?: string;
  Phonemes?: AzurePhoneme[];
}

interface AzureNBest {
  PronScore?: number;
  AccuracyScore?: number;
  FluencyScore?: number;
  CompletenessScore?: number;
  Display?: string;
  Words?: AzureWord[];
  PronunciationAssessment?: {
    PronScore?: number;
    AccuracyScore?: number;
    FluencyScore?: number;
    CompletenessScore?: number;
  };
}

function envReady(): boolean {
  return Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
}

/** Lets the client discover whether phoneme scoring is available. */
export async function GET(): Promise<Response> {
  return Response.json({ enabled: envReady() });
}

export async function POST(request: Request): Promise<Response> {
  const blocked = guardApi(request);
  if (blocked) return blocked;
  const unauth = await requireUser(request);
  if (unauth) return unauth;

  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) return Response.json({ error: "not_configured" }, { status: 503 });

  let file: unknown;
  let target: unknown;
  try {
    const form = await request.formData();
    file = form.get("file");
    target = form.get("target");
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }
  if (!(file instanceof Blob) || file.size === 0 || typeof target !== "string" || !target.trim()) {
    return Response.json({ error: "Missing audio or target." }, { status: 400 });
  }
  if (file.size > 4 * 1024 * 1024) {
    return Response.json({ error: "Audio too large." }, { status: 413 });
  }

  const assessment = Buffer.from(
    JSON.stringify({
      ReferenceText: target.trim(),
      GradingSystem: "HundredMark",
      Granularity: "Phoneme",
      Dimension: "Comprehensive",
      EnableMiscue: true,
      PhonemeAlphabet: "IPA",
    }),
  ).toString("base64");

  try {
    const res = await fetch(
      `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
          "Pronunciation-Assessment": assessment,
          Accept: "application/json",
        },
        body: Buffer.from(await file.arrayBuffer()),
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!res.ok) {
      return Response.json({ error: "Assessment failed." }, { status: 502 });
    }
    const data = (await res.json()) as { RecognitionStatus?: string; DisplayText?: string; NBest?: AzureNBest[] };
    if (data.RecognitionStatus !== "Success" || !data.NBest?.length) {
      // Nothing intelligible — let the client treat it like a no-speech miss.
      return Response.json({ display: "", pronScore: 0, words: [] });
    }

    const best = data.NBest[0];
    const pa = best.PronunciationAssessment ?? {};
    const words = (best.Words ?? []).map((w) => ({
      word: w.Word ?? "",
      accuracy: Math.round(w.PronunciationAssessment?.AccuracyScore ?? w.AccuracyScore ?? 0),
      errorType: w.PronunciationAssessment?.ErrorType ?? w.ErrorType ?? "None",
      phonemes: (w.Phonemes ?? []).map((p) => ({
        p: p.Phoneme ?? "",
        accuracy: Math.round(p.PronunciationAssessment?.AccuracyScore ?? p.AccuracyScore ?? 0),
      })),
    }));

    return Response.json({
      display: best.Display ?? data.DisplayText ?? "",
      pronScore: Math.round(pa.PronScore ?? best.PronScore ?? 0),
      accuracyScore: Math.round(pa.AccuracyScore ?? best.AccuracyScore ?? 0),
      fluencyScore: Math.round(pa.FluencyScore ?? best.FluencyScore ?? 0),
      completenessScore: Math.round(pa.CompletenessScore ?? best.CompletenessScore ?? 0),
      words,
    });
  } catch (e) {
    console.error("[api/assess]", e instanceof Error ? e.message : e);
    return Response.json({ error: "Couldn't reach the assessment service." }, { status: 502 });
  }
}
