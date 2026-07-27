// Grades the two open-ended exam sections.
//
// The scripted sections are scored mechanically (recognition accuracy, word order,
// keyword coverage), but a retell and an open response cannot be — and they carry
// the most weight in a sitting precisely because unscripted speech is what a CEFR
// band actually claims. A heuristic there would be dishonest, so the model grades
// them against explicit CEFR-shaped criteria and must return a number plus the one
// thing to fix.

import type OpenAI from "openai";
import { guardApi } from "@/lib/api-guard";
import { requireUser } from "@/lib/auth-server";
import { getChatModel } from "@/lib/ai/chat-client";

export const runtime = "nodejs";
export const maxDuration = 30;

interface GradeRequest {
  kind?: "retell" | "openResponse";
  /** The passage she heard, or the question she was asked. */
  prompt?: string;
  /** What the recognizer heard her say. */
  transcript?: string;
  /** CEFR band the sitting is for, so the bar scales. */
  level?: string;
}

const SCHEMA = {
  type: "object",
  properties: {
    score: {
      type: "integer",
      description: "0-100 for this answer, judged against the criteria for the stated CEFR level.",
    },
    fix: {
      type: "string",
      description: "The single most useful thing she should fix, in Colombian Spanish, one short sentence.",
    },
  },
  required: ["score", "fix"],
  additionalProperties: false,
} as const;

function systemPrompt(kind: "retell" | "openResponse", level: string): string {
  const shared = [
    `You are grading one spoken answer from an English exam sitting at CEFR level ${level}.`,
    "The answer was transcribed from audio, so ignore punctuation, capitalisation and small",
    "transcription slips. Judge the SPEAKING, not the typing.",
    "Grade against what is expected AT THIS LEVEL — a B1 answer should not be marked down for",
    "lacking C1 nuance, and a C1 answer should not be praised for A2 simplicity.",
    "Be fair but not generous: this score decides whether she advances a stage.",
    "An empty, off-topic, or single-word answer scores under 20.",
  ];
  const specific =
    kind === "retell"
      ? [
          "TASK: she heard a short passage and had to retell it in her own words.",
          "Score on how much of the content survived, whether the sequence of events is clear,",
          "and whether it is understandable — not on matching the original wording.",
        ]
      : [
          "TASK: she was asked an open question and had to answer it out loud.",
          "Score on whether she actually answered it, developed the idea beyond one clause,",
          "and stayed comprehensible. Fluency and range matter more than perfect grammar.",
        ];
  return [...shared, ...specific, 'Write "fix" in Colombian Spanish, warm and specific.'].join(" ");
}

export async function POST(request: Request): Promise<Response> {
  const blocked = guardApi(request);
  if (blocked) return blocked;
  const unauth = await requireUser(request);
  if (unauth) return unauth;

  const brain = getChatModel();
  if (!brain) return Response.json({ error: "not_configured" }, { status: 503 });

  let body: GradeRequest;
  try {
    body = (await request.json()) as GradeRequest;
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }

  const kind = body.kind === "retell" ? "retell" : "openResponse";
  const level = typeof body.level === "string" ? body.level.slice(0, 3) : "B1";
  const prompt = (body.prompt ?? "").toString().slice(0, 1200);
  const transcript = (body.transcript ?? "").toString().slice(0, 2000);

  // Nothing said is a zero, and it needs no model call.
  if (!transcript.trim()) {
    return Response.json({ score: 0, fix: "No se escuchó tu respuesta. Intenta hablar más cerca del micrófono." });
  }

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt(kind, level) },
    {
      role: "user",
      content:
        kind === "retell"
          ? `PASSAGE SHE HEARD:\n${prompt}\n\nHER RETELLING:\n${transcript}`
          : `QUESTION:\n${prompt}\n\nHER ANSWER:\n${transcript}`,
    },
  ];

  try {
    const completion = await brain.client.chat.completions.create({
      model: brain.model,
      max_completion_tokens: 2000,
      messages,
      response_format: { type: "json_schema", json_schema: { name: "exam_grade", strict: true, schema: SCHEMA } },
    });
    const content = completion.choices[0]?.message.content;
    if (!content) return Response.json({ error: "Empty grade." }, { status: 502 });
    const parsed = JSON.parse(content) as { score: number; fix: string };
    const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
    return Response.json({ score, fix: (parsed.fix ?? "").trim() });
  } catch {
    return Response.json({ error: "Couldn't grade that answer." }, { status: 502 });
  }
}
