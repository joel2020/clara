// One turn of a Virtual Call: the learner's transcribed utterance in, Clara's
// reply plus a candidate correction out.
//
// The route deliberately does NOT hold call state. The client owns the call and
// sends a windowed history each turn, which keeps this endpoint stateless and
// the token cost per turn flat regardless of how long the call runs. Whether a
// correction actually interrupts is decided client-side by
// lib/virtual-call/session.ts, from the same rules the tests exercise.
//
// Cost controls live here rather than in the client, because a client-side cap
// is a suggestion: utterance and history are truncated, history is windowed,
// and guardApi applies per-IP flood limits on top of the provider spend caps.

import { guardApi } from "@/lib/api-guard";
import { requireUser } from "@/lib/auth-server";
import { getChatModel } from "@/lib/ai/chat-client";
import { getVirtualCallScenario } from "@/lib/content/virtual-call-scenarios";
import { ModelCallBrain } from "@/lib/virtual-call/brain";
import { MockCallBrain, type CallBrain, type TurnRequest } from "@/lib/virtual-call/providers";
import { CONTEXT_WINDOW_TURNS, type CorrectionMode } from "@/lib/virtual-call/session";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Hard input ceilings. A turn is one spoken sentence, not a document. */
const MAX_UTTERANCE_CHARS = 500;
const MAX_HISTORY_TEXT = 500;
const MAX_BODY_BYTES = 16_000;

interface TurnBody {
  scenarioId?: unknown;
  mode?: unknown;
  level?: unknown;
  coachLanguage?: unknown;
  studentName?: unknown;
  utterance?: unknown;
  history?: unknown;
}

function pickBrain(): CallBrain | null {
  const model = getChatModel();
  if (model) return new ModelCallBrain(model);
  // No model configured. In development that is the intended offline path so the
  // whole feature stays runnable without keys; in production it means a broken
  // deploy, and answering with canned text would hide that from everyone.
  if (process.env.NODE_ENV === "production") return null;
  return new MockCallBrain();
}

export async function POST(request: Request): Promise<Response> {
  const blocked = guardApi(request);
  if (blocked) return blocked;
  const unauth = await requireUser(request);
  if (unauth) return unauth;

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return Response.json({ error: "too_large" }, { status: 413 });
  }

  let body: TurnBody;
  try {
    body = JSON.parse(raw) as TurnBody;
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const scenario = getVirtualCallScenario(typeof body.scenarioId === "string" ? body.scenarioId : "");
  if (!scenario) return Response.json({ error: "unknown_scenario" }, { status: 400 });

  const utterance = typeof body.utterance === "string" ? body.utterance.trim().slice(0, MAX_UTTERANCE_CHARS) : "";
  if (!utterance) return Response.json({ error: "empty_utterance" }, { status: 400 });

  const mode: CorrectionMode = body.mode === "practice" ? "practice" : "natural";
  const coachLanguage: "es" | "en" = body.coachLanguage === "en" ? "en" : "es";
  const level = typeof body.level === "string" ? body.level.slice(0, 3) : "A2";
  const studentName =
    typeof body.studentName === "string" && body.studentName.trim()
      ? body.studentName.trim().slice(0, 40)
      : "the learner";

  const history = Array.isArray(body.history)
    ? body.history
        .filter((t): t is { role: unknown; text: unknown } => Boolean(t) && typeof t === "object")
        .map((t) => ({
          role: t.role === "learner" ? ("learner" as const) : ("clara" as const),
          text: typeof t.text === "string" ? t.text.slice(0, MAX_HISTORY_TEXT) : "",
        }))
        .filter((t) => t.text.length > 0)
        // Windowed server-side too: a client that ignores the window cannot make
        // one turn arbitrarily expensive.
        .slice(-CONTEXT_WINDOW_TURNS * 2)
    : [];

  const brain = pickBrain();
  if (!brain) return Response.json({ error: "not_configured" }, { status: 503 });

  const req: TurnRequest = {
    scenarioId: scenario.id,
    mode,
    level,
    coachLanguage,
    studentName,
    opener: scenario.openingPrompt,
    history,
    utterance,
    scenario: {
      title: scenario.title.en,
      objective: scenario.objective[coachLanguage],
      targetVocabulary: scenario.targetVocabulary,
      targetGrammar: scenario.targetGrammar[coachLanguage],
      suggestedTurns: scenario.suggestedTurns,
      completionCriteria: scenario.completionCriteria[coachLanguage],
      culturalNote: scenario.culturalNote?.[coachLanguage],
    },
  };

  try {
    const analysis = await brain.analyzeTurn(req);
    if (!analysis.reply) return Response.json({ error: "empty_reply" }, { status: 502 });
    return Response.json({ analysis, provider: brain.name });
  } catch (e) {
    // Usage metadata only. The utterance and the reply are deliberately absent:
    // logging call content would put learner speech in the platform logs, which
    // is exactly what the privacy notice says we do not do.
    console.error("[api/virtual-call/turn]", {
      scenario: scenario.id,
      mode,
      provider: brain.name,
      message: e instanceof Error ? e.message : "unknown",
    });
    return Response.json({ error: "upstream" }, { status: 502 });
  }
}
