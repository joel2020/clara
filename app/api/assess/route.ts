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
import { requireAllowedUserIdentity } from "@/lib/auth-server";
import { enforcePaidApiQuota } from "@/lib/api-quota";
import { AZURE_RESPONSE_LIMITS, normalizeAzureAssessment, type AssessmentKind } from "@/lib/speech/azure-response";

export const runtime = "nodejs";
export const maxDuration = 30;

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
  const identity = await requireAllowedUserIdentity(request);
  if ("response" in identity) return identity.response;
  const quota = await enforcePaidApiQuota({ userId: identity.user.id, route: "assess" });
  if (quota) return quota;

  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) return Response.json({ error: "not_configured" }, { status: 503 });

  let file: unknown;
  let target: unknown;
  let kind: unknown;
  try {
    const form = await request.formData();
    file = form.get("file");
    target = form.get("target");
    kind = form.get("kind");
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }
  if (!(file instanceof Blob) || file.size === 0) {
    return Response.json({ error: "Missing audio." }, { status: 400 });
  }
  // The target is OPTIONAL. With one, Azure runs a scripted assessment and can
  // report completeness and miscue against the expected sentence. Without one
  // it runs an UNSCRIPTED assessment of whatever she actually said, which is
  // what makes it possible to grade free conversation rather than only a
  // repeat-after-me drill.
  const reference = typeof target === "string" ? target.trim() : "";
  const assessmentKind: AssessmentKind | null = kind === "word" || kind === "phrase" || kind === "free" ? kind : null;
  const scripted = assessmentKind === "word" || assessmentKind === "phrase";
  if (
    !assessmentKind ||
    (scripted && !reference) ||
    (assessmentKind === "free" && reference.length > 0) ||
    reference.length > AZURE_RESPONSE_LIMITS.recognizedTextLength
  ) {
    return Response.json({ error: "Invalid assessment mode." }, { status: 400 });
  }
  if (file.size > 4 * 1024 * 1024) {
    return Response.json({ error: "Audio too large." }, { status: 413 });
  }

  const assessment = Buffer.from(
    JSON.stringify({
      ReferenceText: reference,
      GradingSystem: "HundredMark",
      Granularity: "Phoneme",
      Dimension: "Comprehensive",
      // Miscue compares what she said against the expected words, which only
      // means something when there ARE expected words. Left on for unscripted
      // speech it would flag every word she chose herself as an insertion.
      EnableMiscue: scripted,
      // Azure exposes this only for scripted speech. Free conversation remains
      // diagnostic rather than pretending a missing prosody score is zero.
      EnableProsodyAssessment: assessmentKind === "phrase",
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
    const data: unknown = await res.json();
    return Response.json(normalizeAzureAssessment(data));
  } catch {
    console.error("[api/assess] provider request failed");
    return Response.json({ error: "Couldn't reach the assessment service." }, { status: 502 });
  }
}
