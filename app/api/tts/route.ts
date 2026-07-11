// Text-to-speech in Joel's real (cloned) voice, for the live conversation
// partner. The client posts a line of Joel's reply; we synthesize it with
// ElevenLabs and stream back the MP3. The pre-recorded drill clips are static
// files; these lines are generated fresh because they're open-ended. The key
// stays on the server.

import { guardApi } from "@/lib/api-guard";
import { requireUser } from "@/lib/auth-server";

export const runtime = "nodejs";
export const maxDuration = 30;

// Joel is the primary instructor voice, matching the drill audio.
const JOEL_VOICE_ID = process.env.ELEVENLABS_JOEL_VOICE_ID || "OH0RKOa9ViI9M4CAHBcv";
const MODEL = "eleven_multilingual_v2";
const FORMAT = "mp3_44100_128";

export async function POST(request: Request): Promise<Response> {
  const blocked = guardApi(request);
  if (blocked) return blocked;
  const unauth = await requireUser(request);
  if (unauth) return unauth;

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Voice isn't configured on the server." }, { status: 500 });
  }

  let text: unknown;
  try {
    ({ text } = (await request.json()) as { text?: unknown });
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }
  if (typeof text !== "string" || !text.trim()) {
    return Response.json({ error: "No text to speak." }, { status: 400 });
  }
  // A conversational line is short; cap it so a bad request can't run up credits.
  const line = text.trim().slice(0, 400);

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${JOEL_VOICE_ID}?output_format=${FORMAT}`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: line,
          model_id: MODEL,
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true },
        }),
      },
    );
    if (!res.ok || !res.body) {
      return Response.json({ error: "Voice synthesis failed." }, { status: 502 });
    }
    return new Response(res.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json({ error: "Couldn't reach the voice service." }, { status: 502 });
  }
}
