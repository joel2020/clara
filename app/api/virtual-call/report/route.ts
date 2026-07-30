// The end-of-call report's prose.
//
// The numbers are NOT produced here. lib/virtual-call/report.ts computes turn
// counts, corrections, retries and pronunciation from what actually happened,
// and the client sends that computed report in. This route only writes the
// encouraging summary around it, and is given the facts rather than trusted to
// infer them — which is what stops the report praising work she did not do.
//
// If no model is configured the route still answers, with plain assembled copy.
// A learner who finishes a call always gets a report.

import { guardApi } from "@/lib/api-guard";
import { requireUser } from "@/lib/auth-server";
import { getChatModel } from "@/lib/ai/chat-client";
import { getVirtualCallScenario } from "@/lib/content/virtual-call-scenarios";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BODY_BYTES = 32_000;

interface ReportBody {
  scenarioId?: unknown;
  coachLanguage?: unknown;
  studentName?: unknown;
  facts?: {
    learnerTurns?: unknown;
    cleanTurns?: unknown;
    durationMs?: unknown;
    metCriteria?: unknown;
    retriedAcceptedCount?: unknown;
    vocabularyUsed?: unknown;
    priorities?: unknown;
  };
}

const SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description:
        "2-3 encouraging sentences in the coaching language about how the call went. Specific to the facts given. Never invent achievements.",
    },
    did_well: {
      type: "array",
      items: { type: "string" },
      description: "1-3 short, concrete things she communicated successfully, grounded ONLY in the facts given.",
    },
    next_activity: {
      type: "string",
      description: "One short suggestion for what to practice next, in the coaching language.",
    },
  },
  required: ["summary", "did_well", "next_activity"],
  additionalProperties: false,
} as const;

/** Plain report copy when no model is configured. Never blocks the learner. */
function fallbackProse(
  turns: number,
  clean: number,
  met: boolean,
  lang: "es" | "en",
): { summary: string; did_well: string[]; next_activity: string } {
  if (lang === "en") {
    return {
      summary: `You spoke ${turns} ${turns === 1 ? "time" : "times"} on this call${
        met ? " and got to the goal of the conversation" : ""
      }. ${clean > 0 ? `${clean} of those turns needed no corrections at all.` : "Keep going — every call gets easier."}`,
      did_well: clean > 0 ? [`${clean} turns were clear and correct.`] : ["You kept the conversation going."],
      next_activity: "Try the same call again and see how much smoother it feels.",
    };
  }
  return {
    summary: `Hablaste ${turns} ${turns === 1 ? "vez" : "veces"} en esta llamada${
      met ? " y llegaste al objetivo de la conversación" : ""
    }. ${clean > 0 ? `${clean} de esos turnos no necesitaron ninguna corrección.` : "Sigue así, cada llamada se siente más fácil."}`,
    did_well: clean > 0 ? [`${clean} turnos salieron claros y correctos.`] : ["Mantuviste la conversación."],
    next_activity: "Repite esta misma llamada y siente cuánto más fluida te sale.",
  };
}

export async function POST(request: Request): Promise<Response> {
  const blocked = guardApi(request);
  if (blocked) return blocked;
  const unauth = await requireUser(request);
  if (unauth) return unauth;

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return Response.json({ error: "too_large" }, { status: 413 });

  let body: ReportBody;
  try {
    body = JSON.parse(raw) as ReportBody;
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const scenario = getVirtualCallScenario(typeof body.scenarioId === "string" ? body.scenarioId : "");
  if (!scenario) return Response.json({ error: "unknown_scenario" }, { status: 400 });

  const lang: "es" | "en" = body.coachLanguage === "en" ? "en" : "es";
  const f = body.facts ?? {};
  const turns = Number.isFinite(f.learnerTurns) ? Math.max(0, Math.trunc(f.learnerTurns as number)) : 0;
  const clean = Number.isFinite(f.cleanTurns) ? Math.max(0, Math.trunc(f.cleanTurns as number)) : 0;
  const met = Boolean(f.metCriteria);
  const retriesFixed = Number.isFinite(f.retriedAcceptedCount)
    ? Math.max(0, Math.trunc(f.retriedAcceptedCount as number))
    : 0;
  const vocab = Array.isArray(f.vocabularyUsed)
    ? f.vocabularyUsed.filter((v): v is string => typeof v === "string").slice(0, 10)
    : [];
  const priorities = Array.isArray(f.priorities)
    ? f.priorities
        .filter((p): p is { corrected?: string; explanation?: string } => Boolean(p) && typeof p === "object")
        .slice(0, 3)
        .map((p) => ({
          corrected: typeof p.corrected === "string" ? p.corrected.slice(0, 200) : "",
          explanation: typeof p.explanation === "string" ? p.explanation.slice(0, 300) : "",
        }))
    : [];

  const brain = getChatModel();
  if (!brain) {
    return Response.json({ prose: fallbackProse(turns, clean, met, lang), provider: "fallback" });
  }

  const coach = lang === "es" ? "Spanish" : "English";
  const system = `You are Clara, an encouraging AI practice guide, writing a short end-of-call review for an adult Colombian learner in her twenties. Write in ${coach}.

These are the FACTS of the call. Do not invent anything beyond them, and never claim she did something the facts do not show:
- Scenario: ${scenario.title.en} (${scenario.objective.en})
- Learner speaking turns: ${turns}
- Turns that needed no correction: ${clean}
- Reached the goal of the conversation: ${met ? "yes" : "not this time"}
- Mistakes she fixed when asked to say the sentence again: ${retriesFixed}
- Target vocabulary she actually used: ${vocab.length ? vocab.join(", ") : "none this call"}
- Things to work on next: ${priorities.map((p) => p.corrected).filter(Boolean).join(" | ") || "nothing major"}

Be warm, specific and adult. No baby talk, no empty praise. If the call was short, say so kindly rather than inflating it. Do not mention pronunciation at all — it is not in these facts.`;

  try {
    const completion = await brain.client.chat.completions.create({
      model: brain.model,
      max_completion_tokens: 1200,
      messages: [
        { role: "system", content: system },
        { role: "user", content: "Write the review." },
      ],
      response_format: { type: "json_schema", json_schema: { name: "call_report", strict: true, schema: SCHEMA } },
    });
    const content = completion.choices[0]?.message.content;
    if (!content) throw new Error("empty");
    const parsed = JSON.parse(content) as { summary?: string; did_well?: unknown; next_activity?: string };
    return Response.json({
      prose: {
        summary: (parsed.summary ?? "").trim() || fallbackProse(turns, clean, met, lang).summary,
        did_well: Array.isArray(parsed.did_well)
          ? parsed.did_well.slice(0, 3).map((s) => String(s).trim()).filter(Boolean)
          : [],
        next_activity: (parsed.next_activity ?? "").trim(),
      },
      provider: brain.model,
    });
  } catch (e) {
    console.error("[api/virtual-call/report]", {
      scenario: scenario.id,
      message: e instanceof Error ? e.message : "unknown",
    });
    // A failed model call must not cost her the report she just earned.
    return Response.json({ prose: fallbackProse(turns, clean, met, lang), provider: "fallback" });
  }
}
