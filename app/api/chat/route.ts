// The AI conversation partner. Mariana speaks a line (transcribed by
// /api/transcribe), the client sends the running conversation here, and Claude
// replies AS Joel — in her scenario, in very simple A1–A2 English, with a
// Spanish translation, a gentle correction, and a couple of things she could
// say next. The reply text is then spoken back in Joel's real voice via
// /api/tts. The Anthropic key stays on the server.

import Anthropic from "@anthropic-ai/sdk";
import { getScenario } from "@/lib/content/scenarios";

export const runtime = "nodejs";
export const maxDuration = 30;

// Opus 4.8 is the default. A conversation turn is short and simple, so we leave
// extended thinking off for a snappier reply. Swap the model string here if you
// want faster/cheaper turns (e.g. "claude-haiku-4-5").
const MODEL = "claude-opus-4-8";

interface Turn {
  role: "assistant" | "user";
  text: string;
}

interface ChatRequest {
  scenarioId?: string;
  studentName?: string | null;
  coachLanguage?: "es" | "en";
  history?: Turn[];
}

interface ChatReply {
  reply: string;
  reply_es: string;
  correction: string | null;
  suggestions: string[];
}

const SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string", description: "Joel's next line — very simple English, 1–2 short sentences, ending with a question." },
    reply_es: { type: "string", description: "A natural Spanish translation of reply." },
    correction: {
      type: ["string", "null"],
      description: "If her last line had ONE mistake worth fixing, a short, kind note in the coaching language showing the better way. Otherwise null.",
    },
    suggestions: {
      type: "array",
      items: { type: "string" },
      description: "2–3 very short English phrases she could tap to reply next.",
    },
  },
  required: ["reply", "reply_es", "correction", "suggestions"],
  additionalProperties: false,
} as const;

function systemPrompt(scenarioRole: string, scenarioSetting: string, name: string, coachLang: "es" | "en"): string {
  const coach = coachLang === "es" ? "Spanish" : "English";
  return `You are Joel, a warm, patient English conversation partner and tutor for ${name}, an adult beginner from Colombia. Her English is A1–A2 (beginner). She is practicing speaking out loud.

You are role-playing: you are ${scenarioRole}. ${scenarioSetting}

RULES:
- Speak in VERY simple English. Short sentences. Common, everyday words only. No idioms she wouldn't know.
- Keep every reply to 1–2 short sentences, and end with a simple question so the conversation keeps going.
- Stay fully in the scenario and in character. Never break role or mention that you are an AI.
- Be encouraging and natural, like a kind friend — never like a test.
- Her speech is transcribed from audio, so it may have small errors. Read past obvious transcription slips; assume she is trying her best.
- Gently correct at most ONE mistake per turn, and only when it actually matters for being understood. Put the correction in the "correction" field written in ${coach}, not in your reply. Most turns should have no correction (null) — do not nitpick.
- "reply_es" is a natural ${coachLang === "es" ? "Spanish" : "English"} translation of your English reply, so she always understands you.
- "suggestions" are 2–3 very short, natural English phrases she could say next in this moment.

Reply ONLY with the JSON object matching the schema.`;
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Not configured yet — the client shows a friendly "coming soon" state.
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }

  const scenario = getScenario(body.scenarioId ?? "");
  if (!scenario) {
    return Response.json({ error: "Unknown scenario." }, { status: 400 });
  }

  const history = Array.isArray(body.history) ? body.history.slice(-16) : [];
  const name = (body.studentName || "the student").toString().slice(0, 40);
  const coachLang: "es" | "en" = body.coachLanguage === "en" ? "en" : "es";

  // Build the message list. The scenario opener is the first assistant turn so
  // the model has continuity even though the client rendered it locally.
  const messages: Anthropic.MessageParam[] = [
    { role: "assistant", content: scenario.opener.en },
    ...history.map((t): Anthropic.MessageParam => ({
      role: t.role === "user" ? "user" : "assistant",
      content: (t.text || "").toString().slice(0, 500),
    })),
  ];
  // The conversation must end on a user turn for the model to respond to it.
  if (messages[messages.length - 1]?.role !== "user") {
    return Response.json({ error: "Nothing to respond to." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 600,
      system: systemPrompt(scenario.role, scenario.setting, name, coachLang),
      messages,
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
    });

    if (response.stop_reason === "refusal") {
      return Response.json({ error: "refused" }, { status: 502 });
    }

    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") {
      return Response.json({ error: "Empty reply." }, { status: 502 });
    }

    const parsed = JSON.parse(text.text) as ChatReply;
    return Response.json({
      reply: (parsed.reply ?? "").trim(),
      reply_es: (parsed.reply_es ?? "").trim(),
      correction: parsed.correction ? String(parsed.correction).trim() : null,
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.slice(0, 3).map((s) => String(s).trim()).filter(Boolean)
        : [],
    });
  } catch {
    return Response.json({ error: "Couldn't reach the conversation partner." }, { status: 502 });
  }
}
