// Scores a finished call against the QA rubric.
//
// This mirrors what a real BPO quality team checks on a recorded call: did she
// greet and identify herself, verify the account, acknowledge the frustration, and
// explain the fix with a next step — plus whether she read the customer's details
// back correctly, which is the most common real-world failure.
//
// Judging is done from the transcript by the model because these are judgements
// about conduct, not string matches. The one thing that IS checked mechanically is
// the details read-back, since that is exact.

import type OpenAI from "openai";
import { guardApi } from "@/lib/api-guard";
import { requireAllowedUserIdentity } from "@/lib/auth-server";
import { enforcePaidApiQuota } from "@/lib/api-quota";
import { getChatModel } from "@/lib/ai/chat-client";
import { getCallScenario, QA_CHECKS } from "@/lib/content/call-scenarios";

export const runtime = "nodejs";
export const maxDuration = 30;

interface Turn {
  role: "customer" | "agent";
  text: string;
}

interface ScoreRequest {
  callScenarioId?: string;
  turns?: Turn[];
  coachLanguage?: "es" | "en";
}

const SCHEMA = {
  type: "object",
  properties: {
    greeted: { type: "boolean", description: "Did she greet the customer AND give her name at the start?" },
    verified: { type: "boolean", description: "Did she verify the account or identity before acting?" },
    empathized: { type: "boolean", description: "Did she acknowledge the customer's frustration in words?" },
    resolved: { type: "boolean", description: "Did she explain the fix AND a concrete next step?" },
    politeness: {
      type: "integer",
      description: "0-100: how professional and warm she sounded overall for a support call.",
    },
    clarity: {
      type: "integer",
      description: "0-100: how easy she was to understand, judging the wording (ignore transcription noise).",
    },
    highlight: { type: "string", description: "One thing she did genuinely well, in Colombian Spanish, one sentence." },
    fix: { type: "string", description: "The single most useful thing to change next call, in Colombian Spanish." },
  },
  required: ["greeted", "verified", "empathized", "resolved", "politeness", "clarity", "highlight", "fix"],
  additionalProperties: false,
} as const;

export async function POST(request: Request): Promise<Response> {
  const blocked = guardApi(request);
  if (blocked) return blocked;
  const identity = await requireAllowedUserIdentity(request);
  if ("response" in identity) return identity.response;
  const quota = await enforcePaidApiQuota({ userId: identity.user.id, route: "call-score" });
  if (quota) return quota;

  const brain = getChatModel();
  if (!brain) return Response.json({ error: "not_configured" }, { status: 503 });

  let body: ScoreRequest;
  try {
    body = (await request.json()) as ScoreRequest;
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }

  const scenario = getCallScenario(body.callScenarioId ?? "");
  if (!scenario) return Response.json({ error: "Unknown scenario." }, { status: 400 });

  // Validate shape before touching fields: a malformed turn must be a 400, not
  // an unhandled TypeError further down.
  const turns = (Array.isArray(body.turns) ? body.turns : [])
    .filter(
      (t): t is Turn =>
        Boolean(t) && typeof t.text === "string" && (t.role === "agent" || t.role === "customer"),
    )
    .slice(-40);
  const agentTurns = turns.filter((t) => t.role === "agent");
  if (agentTurns.length === 0) {
    return Response.json({ error: "empty_call" }, { status: 400 });
  }

  // The details read-back is exact, so it is checked here rather than judged.
  const saidByAgent = agentTurns
    .map((t) => t.text.toLowerCase().replace(/[^a-z0-9@.\s]/g, ""))
    .join(" ");
  const digitsOnly = saidByAgent.replace(/\D/g, "");
  const detailsHit = scenario.details.filter((d) => {
    const norm = d.toLowerCase();
    if (/^[\d.]+$/.test(norm)) return digitsOnly.includes(norm.replace(/\D/g, ""));
    return saidByAgent.includes(norm);
  });

  const transcript = turns.map((t) => `${t.role === "agent" ? "AGENT" : "CUSTOMER"}: ${t.text}`).join("\n");

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: [
        "You are a customer-support quality analyst reviewing one recorded call.",
        "The AGENT is a Colombian learner practising English; the CUSTOMER was simulated.",
        "Judge only what the transcript shows. The agent's speech was transcribed from audio,",
        "so ignore punctuation and small transcription slips — judge conduct, not typing.",
        "Be honest: marking everything true teaches her nothing. A check is true only if the",
        "transcript actually shows it.",
        scenario.extra ? `On this specific call, a good agent also: ${scenario.extra}` : "",
        "Write highlight and fix in warm Colombian Spanish, one sentence each.",
      ]
        .filter(Boolean)
        .join(" "),
    },
    { role: "user", content: `SCENARIO: ${scenario.persona}\n\nTRANSCRIPT:\n${transcript}` },
  ];

  try {
    const completion = await brain.client.chat.completions.create({
      model: brain.model,
      max_completion_tokens: 2000,
      messages,
      response_format: { type: "json_schema", json_schema: { name: "call_score", strict: true, schema: SCHEMA } },
    });
    const content = completion.choices[0]?.message.content;
    if (!content) return Response.json({ error: "Empty score." }, { status: 502 });
    const p = JSON.parse(content) as Record<string, unknown>;

    const clamp = (n: unknown) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
    const checks = QA_CHECKS.map((c) => ({ key: c.key, passed: Boolean(p[c.key]) }));
    const passedCount = checks.filter((c) => c.passed).length;
    const detailScore = scenario.details.length
      ? Math.round((detailsHit.length / scenario.details.length) * 100)
      : 100;

    // The four conduct checks carry half the score; how she sounded and whether she
    // got the details right carry the other half.
    const score = Math.round(
      (passedCount / QA_CHECKS.length) * 50 + (clamp(p.politeness) + clamp(p.clarity)) * 0.15 + detailScore * 0.2,
    );

    return Response.json({
      checks,
      detailsHit,
      detailsTotal: scenario.details.length,
      politeness: clamp(p.politeness),
      clarity: clamp(p.clarity),
      highlight: String(p.highlight ?? "").trim(),
      fix: String(p.fix ?? "").trim(),
      score: Math.max(0, Math.min(100, score)),
    });
  } catch (e) {
    console.error("[api/call-score]", e instanceof Error ? e.message : e);
    return Response.json({ error: "Couldn't score that call." }, { status: 502 });
  }
}
