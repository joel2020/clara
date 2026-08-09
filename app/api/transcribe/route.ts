// Server-side speech-to-text for browsers without the Web Speech API — most
// importantly iOS Safari, which Mariana uses. The client records WAV audio and
// posts it here; we forward it to ElevenLabs Scribe and return
// the transcript. The API key stays on the server.

import { guardApi } from "@/lib/api-guard";
import { requireAllowedUserIdentity } from "@/lib/auth-server";
import { enforcePaidApiQuota } from "@/lib/api-quota";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request): Promise<Response> {
  const blocked = guardApi(request);
  if (blocked) return blocked;
  const identity = await requireAllowedUserIdentity(request);
  if ("response" in identity) return identity.response;
  const quota = await enforcePaidApiQuota({ userId: identity.user.id, route: "transcribe" });
  if (quota) return quota;

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Transcription isn't configured on the server." }, { status: 500 });
  }

  let file: unknown;
  try {
    const form = await request.formData();
    file = form.get("file");
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }
  if (!(file instanceof Blob) || file.size === 0) {
    return Response.json({ error: "No audio received." }, { status: 400 });
  }
  // Guard against oversized uploads (a spoken word/phrase is tiny).
  if (file.size > 8 * 1024 * 1024) {
    return Response.json({ error: "Audio too large." }, { status: 413 });
  }

  const out = new FormData();
  out.append("file", file, "attempt.wav");
  out.append("model_id", "scribe_v1");
  out.append("language_code", "eng");

  try {
    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: out,
    });
    if (!res.ok) {
      return Response.json({ error: "Transcription failed. Try again." }, { status: 502 });
    }
    const data = (await res.json()) as { text?: string };
    // Scribe annotates non-speech, e.g. "(sighs) sheep." or "[music]". Strip
    // those and leading filler so scoring compares actual words to the target.
    const transcript = (data.text ?? "")
      .replace(/\([^)]*\)/g, " ")
      .replace(/\[[^\]]*\]/g, " ")
      .replace(/^[-\s]+/, "")
      .replace(/\s+/g, " ")
      .trim();
    return Response.json({ transcript });
  } catch (e) {
    console.error("[api/transcribe]", e instanceof Error ? e.message : e);
    return Response.json({ error: "Couldn't reach the transcription service." }, { status: 502 });
  }
}
