// The AI conversation partner. Mariana speaks a line (transcribed by
// /api/transcribe), the client sends the running conversation here, and the
// model replies AS Joel — in her scenario, in very simple A1–A2 English, with a
// Spanish translation, a gentle correction, and a couple of things she could
// say next. The reply text is then spoken back in Joel's real voice via
// /api/tts. The OpenAI key stays on the server.

import OpenAI from "openai";
import { getScenario } from "@/lib/content/scenarios";
import { guardApi } from "@/lib/api-guard";
import { requireUser } from "@/lib/auth-server";

export const runtime = "nodejs";
export const maxDuration = 30;

// gpt-4o-mini: cheap and fast, plenty for simple A1–A2 roleplay. Swap the model
// string here if you ever want a stronger (pricier) model.
const MODEL = "gpt-4o-mini";

interface Turn {
  role: "assistant" | "user";
  text: string;
}

interface ChatRequest {
  scenarioId?: string;
  studentName?: string | null;
  coachLanguage?: "es" | "en";
  history?: Turn[];
  /** Her weakest SRS items — Joel weaves them naturally into the roleplay. */
  focusWords?: string[];
  /** CEFR level from placement (A0..C1) — pitches Joel's difficulty. */
  level?: string;
  /** Her stated goal (travel/social/work/moving/dating/fluency). */
  goal?: string;
}

interface ChatReply {
  reply: string;
  reply_es: string;
  correction: string | null;
  suggestions: string[];
  practice: { phrase: string; meaning: string } | null;
}

// OpenAI Structured Outputs (strict) schema — guarantees valid JSON back.
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
    practice: {
      type: ["object", "null"],
      description:
        "The ONE short English phrase from this exchange most worth her drilling later — the corrected form if you corrected her, otherwise a useful natural phrase she should master. Null if nothing stands out this turn.",
      properties: {
        phrase: { type: "string", description: "The English phrase to practice (a few words, no punctuation clutter)." },
        meaning: { type: "string", description: "Its natural Spanish translation." },
      },
      required: ["phrase", "meaning"],
      additionalProperties: false,
    },
  },
  required: ["reply", "reply_es", "correction", "suggestions", "practice"],
  additionalProperties: false,
} as const;

// How Joel pitches the conversation for each CEFR level — vocabulary, sentence
// length, pace, and how hard to push. This is what makes a beginner and a B1
// learner get genuinely different conversations.
const LEVEL_GUIDE: Record<string, string> = {
  A0: "She is an absolute beginner (A0). Use only the most basic words and very short 3–5 word sentences, one idea per reply. Lots of encouragement.",
  A1: "She is a beginner (A1). Short simple sentences, common words, 1–2 sentences, always ending in a simple question.",
  A2: "She is elementary (A2). She can handle full simple sentences and everyday topics — nudge her to answer in complete sentences, and use slightly richer everyday vocabulary.",
  B1: "She is intermediate (B1). Have a real back-and-forth: ask for opinions and short stories, use natural everyday American English at a normal pace, 2–3 sentences is fine.",
  B2: "She is upper-intermediate (B2). Speak naturally with idioms, contractions and nuance; challenge her with follow-ups, hypotheticals and opinions, and correct subtle unnatural phrasing.",
  C1: "She is advanced (C1). Speak as with a native — full natural pace, idioms, humor, nuance; push for precision and only correct genuinely non-native or unclear phrasing.",
};

const GOAL_CONTEXT: Record<string, string> = {
  travel: "Her goal is travel English — when it fits naturally, lean into airports, hotels, directions, ordering, and getting around.",
  social: "Her goal is social confidence — lean into small talk, making friends, hangouts, and casual chit-chat.",
  work: "Her goal is work/career English — lean into introductions, meetings, and professional small talk.",
  moving: "Her goal is moving abroad — lean into apartments, appointments, phone calls, and daily-life logistics.",
  dating: "Her goal is dating and relationships — lean into flirty-but-respectful small talk, making plans, and getting to know someone.",
  fluency: "Her goal is general fluency — keep a natural mix of everyday topics.",
};

function systemPrompt(
  scenarioRole: string,
  scenarioSetting: string,
  name: string,
  coachLang: "es" | "en",
  focusWords: string[],
  level: string,
  goal: string,
): string {
  const coach = coachLang === "es" ? "Spanish" : "English";
  const levelGuide = LEVEL_GUIDE[level] ?? LEVEL_GUIDE.A2;
  const goalContext = GOAL_CONTEXT[goal] ?? GOAL_CONTEXT.fluency;
  const focus = focusWords.length
    ? `\n\nFOCUS ITEMS: ${name} is currently struggling with these words/phrases: ${focusWords
        .map((w) => `"${w}"`)
        .join(", ")}. When it fits the scene NATURALLY, use one of them in your reply or steer the moment so she would say one — and prefer them in "suggestions" when they genuinely fit. Never force one in awkwardly, never more than one per turn, and never mention that these are practice targets.`
    : "";
  return `You are Joel, a warm, patient AMERICAN English conversation partner and tutor for ${name}, an adult learner from Colombia. ${levelGuide} ${goalContext} She is practicing speaking out loud.

You are role-playing: you are ${scenarioRole}. ${scenarioSetting}${focus}

RULES:
- Speak natural, everyday AMERICAN English. Use American vocabulary (apartment, elevator, sidewalk, check/bill, "to go", vacation, cell phone, awesome), American spelling (color, favorite, realize), and common American expressions and contractions ("gonna", "wanna", "I'm", "it's", "how's it going", "sounds good", "no worries", "you got it"). Do NOT use British words (flat, lift, pavement, holiday, mobile) or British spelling.
- Match her level (above): pitch your vocabulary, sentence length, pace, and how hard you push to it. End with a question that keeps the conversation going. Simple does not mean stiff — sound like a friendly American, not a textbook.
- Stay fully in the scenario and in character. Never break role or mention that you are an AI.
- Be encouraging and natural, like a kind friend — never like a test.
- Her speech is transcribed from audio, so it may have small errors. Read past obvious transcription slips; assume she is trying her best.
- Gently correct at most ONE mistake per turn, and only when it matters for being understood or for sounding American. Prefer the natural American form (e.g. nudge "I am going to" → "I'm gonna", "How are you?" → "How's it going?") when it helps her sound native. Put the correction in the "correction" field written in ${coach}, not in your reply. Most turns should have no correction (null) — do not nitpick.
- "reply_es" is a natural Spanish translation of your English reply, so she always understands you.
- "suggestions" are 2–3 very short, natural American English phrases she could say next in this moment.
- "practice" is the single phrase most worth her drilling after this turn: if you corrected her, the correct American form; otherwise a natural, high-frequency American phrase from this exchange worth making automatic. Keep it short (2–6 words) and clean. Use null when nothing this turn is worth isolating.`;
}

export async function POST(request: Request): Promise<Response> {
  const blocked = guardApi(request);
  if (blocked) return blocked;
  const unauth = await requireUser(request);
  if (unauth) return unauth;

  const apiKey = process.env.OPENAI_API_KEY;
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
  const focusWords = Array.isArray(body.focusWords)
    ? body.focusWords
        .filter((w): w is string => typeof w === "string" && w.trim().length > 0)
        .map((w) => w.trim().slice(0, 60))
        .slice(0, 6)
    : [];
  const level = typeof body.level === "string" ? body.level.slice(0, 3) : "A2";
  const goal = typeof body.goal === "string" ? body.goal.slice(0, 20) : "fluency";

  // Build the message list: system prompt, then the scenario opener as Joel's
  // first turn (the client rendered it locally), then the running conversation.
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt(scenario.role, scenario.setting, name, coachLang, focusWords, level, goal) },
    { role: "assistant", content: scenario.opener.en },
    ...history.map(
      (turn): OpenAI.Chat.Completions.ChatCompletionMessageParam => ({
        role: turn.role === "user" ? "user" : "assistant",
        content: (turn.text || "").toString().slice(0, 500),
      }),
    ),
  ];
  // The conversation must end on a user turn for the model to respond to it.
  if (messages[messages.length - 1]?.role !== "user") {
    return Response.json({ error: "Nothing to respond to." }, { status: 400 });
  }

  const client = new OpenAI({ apiKey });

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      max_completion_tokens: 600,
      messages,
      response_format: {
        type: "json_schema",
        json_schema: { name: "joel_reply", strict: true, schema: SCHEMA },
      },
    });

    const choice = completion.choices[0];
    if (choice?.message.refusal) {
      return Response.json({ error: "refused" }, { status: 502 });
    }
    const content = choice?.message.content;
    if (!content) {
      return Response.json({ error: "Empty reply." }, { status: 502 });
    }

    const parsed = JSON.parse(content) as ChatReply;
    // The model sometimes writes "none"/"Ninguna" instead of null — normalize.
    const rawCorrection = parsed.correction ? String(parsed.correction).trim() : "";
    const correction =
      rawCorrection && !/^(ninguna|ninguno|none|n\/?a|nada|null|-)\.?$/i.test(rawCorrection) ? rawCorrection : null;
    const practice =
      parsed.practice && parsed.practice.phrase?.trim()
        ? { phrase: parsed.practice.phrase.trim(), meaning: (parsed.practice.meaning ?? "").trim() }
        : null;
    return Response.json({
      reply: (parsed.reply ?? "").trim(),
      reply_es: (parsed.reply_es ?? "").trim(),
      correction,
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.slice(0, 3).map((s) => String(s).trim()).filter(Boolean)
        : [],
      practice,
    });
  } catch {
    return Response.json({ error: "Couldn't reach the conversation partner." }, { status: 502 });
  }
}
