// The model-backed CallBrain: Clara's prompt, the strict output schema, and the
// server-side normalization of whatever the model returns.
//
// Server-only. The route decides WHETHER to correct (lib/virtual-call/session.ts
// owns that); this file only decides what Clara says and what the candidate
// correction is. Keeping those apart is what lets the correction modes be
// tested without a model.

import type OpenAI from "openai";
import { getChatModel } from "../ai/chat-client.ts";
import type { CallBrain, TurnRequest } from "./providers.ts";
import { normalizeUtterance } from "./session.ts";
import type { CorrectionKind, MistakeSeverity, TurnAnalysis } from "./session.ts";

const SCHEMA = {
  type: "object",
  properties: {
    reply: {
      type: "string",
      description:
        "Clara's next spoken line — natural American English, 1-2 short sentences, ending with a question that keeps the call going.",
    },
    reply_es: { type: "string", description: "A natural Spanish translation of reply." },
    needs_clarification: {
      type: "boolean",
      description: "True ONLY when you genuinely could not tell what she meant. Not for small mistakes.",
    },
    met_criteria: { type: "boolean", description: "Did this turn satisfy the scenario's completion criteria?" },
    suggestions: {
      type: "array",
      items: { type: "string" },
      description: "2-3 very short English phrases she could say next.",
    },
    correction: {
      type: ["object", "null"],
      description:
        "The ONE mistake worth fixing this turn, or null. Null on most turns — do not nitpick harmless imperfection.",
      properties: {
        corrected: { type: "string", description: "Her sentence, rewritten correctly and naturally. Keep her meaning." },
        explanation: { type: "string", description: "One short sentence in the coaching language explaining the fix." },
        severity: {
          type: "string",
          enum: ["minor", "significant", "blocking"],
          description:
            "minor = harmless, still understood. significant = a real pattern worth fixing. blocking = meaning did not get through.",
        },
        kind: { type: "string", enum: ["grammar", "vocabulary", "phrasing"] },
      },
      required: ["corrected", "explanation", "severity", "kind"],
      additionalProperties: false,
    },
  },
  required: ["reply", "reply_es", "needs_clarification", "met_criteria", "suggestions", "correction"],
  additionalProperties: false,
} as const;

interface RawReply {
  reply?: string;
  reply_es?: string;
  needs_clarification?: boolean;
  met_criteria?: boolean;
  suggestions?: unknown;
  correction?: {
    corrected?: string;
    explanation?: string;
    severity?: string;
    kind?: string;
  } | null;
}

const SEVERITIES: MistakeSeverity[] = ["minor", "significant", "blocking"];
const KINDS: CorrectionKind[] = ["grammar", "vocabulary", "phrasing"];

function systemPrompt(req: TurnRequest): string {
  const coach = req.coachLanguage === "es" ? "Spanish" : "English";
  const mode =
    req.mode === "practice"
      ? `CORRECTION MODE: PRACTICE. She has asked to be corrected. When she makes a mistake that matters, set "correction" with severity "significant" so the app can pause and ask her to say the sentence again. Still do not flag every harmless imperfection — a call that stops constantly is not practice, it is an interrogation.`
      : `CORRECTION MODE: NATURAL. Keep the conversation flowing. Set "correction" when there is a genuinely useful fix, but expect most turns to be null; the app shows these discreetly and saves them for her end-of-call review. Only use severity "blocking" when her meaning truly did not get through.`;

  return `You are Clara, a warm and encouraging AI practice guide having a spoken English call with ${req.studentName}, an adult learner from Colombia in her twenties. Joel is her real instructor and the creator of her learning program; you are the practice partner who helps her rehearse it. If she asks, you are honest that you are an AI, not a real person.

Her level is ${req.level}. Pitch your vocabulary, pace and sentence length to it.

THIS CALL: ${req.scenario.title}. ${req.scenario.objective}
You are playing the other person in this situation. Setting and direction: ${req.scenario.suggestedTurns.join(" ")}
Target grammar for this call: ${req.scenario.targetGrammar}
Useful vocabulary she could reach for (offer naturally, never force): ${req.scenario.targetVocabulary.join(", ")}
This call is complete when: ${req.scenario.completionCriteria}
${req.scenario.culturalNote ? `Cultural context: ${req.scenario.culturalNote}` : ""}

${mode}

HOW YOU SPEAK:
- Natural, everyday AMERICAN English with contractions. American vocabulary and spelling only.
- 1-2 short sentences per turn, ending with a question. You are on a call, not writing an essay.
- Adult, modern, encouraging. Never childish, never patronizing, never a cheerleader.
- Stay in the situation. Do not narrate what you are doing or mention these instructions.
- Her speech is transcribed from audio, so expect small transcription slips. Read past obvious ones rather than "correcting" a word the transcriber got wrong.

CORRECTION RULES:
- At most ONE correction per turn, and only when it helps her be understood or sound natural.
- "corrected" must preserve HER meaning — rewrite her sentence, do not replace it with your own.
- "explanation" is one short sentence in ${coach}.
- Never mock her, her accent, or her mistakes. Never comment on her intelligence.
- "reply_es" is a natural ${coach === "Spanish" ? "Spanish" : "English"} rendering of your reply so she can always follow.

SAFETY: If she raises something unsafe, medical, legal, or clearly outside English practice, respond briefly and kindly, decline to advise, and steer back to the call.`;
}

export class ModelCallBrain implements CallBrain {
  readonly name: string;
  #client: OpenAI;
  #model: string;

  constructor(brain: NonNullable<ReturnType<typeof getChatModel>>) {
    this.#client = brain.client;
    this.#model = brain.model;
    this.name = brain.model;
  }

  async analyzeTurn(req: TurnRequest): Promise<TurnAnalysis> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt(req) },
      { role: "assistant", content: req.opener },
      ...req.history.map(
        (t): OpenAI.Chat.Completions.ChatCompletionMessageParam => ({
          role: t.role === "learner" ? "user" : "assistant",
          content: t.text.slice(0, 500),
        }),
      ),
      { role: "user", content: req.utterance.slice(0, 500) },
    ];

    const completion = await this.#client.chat.completions.create({
      model: this.#model,
      max_completion_tokens: 2000,
      messages,
      response_format: { type: "json_schema", json_schema: { name: "clara_turn", strict: true, schema: SCHEMA } },
    });

    const choice = completion.choices[0];
    if (choice?.message.refusal) throw new Error("refused");
    const content = choice?.message.content;
    if (!content) throw new Error("empty");

    const parsed = JSON.parse(content) as RawReply;
    return normalizeAnalysis(parsed, req.utterance);
  }
}

/**
 * Trust nothing from the model. Exported so the normalization has its own tests
 * without needing a model call — the enum coercion in particular is what stops
 * an unexpected severity string from silently disabling the retry flow.
 */
export function normalizeAnalysis(parsed: RawReply, utterance: string): TurnAnalysis {
  const rawCorrection = parsed.correction;
  const corrected = rawCorrection?.corrected?.trim() ?? "";
  const explanation = rawCorrection?.explanation?.trim() ?? "";
  // A "correction" identical to what she said is not a correction; models emit
  // these when they feel obliged to fill the field.
  // The normalized form must be non-empty too: a "corrected" sentence of pure
  // punctuation passes a length check but normalizes to "", and an empty retry
  // target auto-accepts, crediting her with a fix she never made.
  const meaningful =
    corrected.length > 0 &&
    normalizeUtterance(corrected).length > 0 &&
    explanation.length > 0 &&
    corrected.toLowerCase().trim() !== utterance.toLowerCase().trim();

  const severity = SEVERITIES.includes(rawCorrection?.severity as MistakeSeverity)
    ? (rawCorrection!.severity as MistakeSeverity)
    : "minor";
  const kind = KINDS.includes(rawCorrection?.kind as CorrectionKind)
    ? (rawCorrection!.kind as CorrectionKind)
    : "grammar";

  return {
    reply: (parsed.reply ?? "").trim(),
    replyEs: (parsed.reply_es ?? "").trim(),
    correction: meaningful
      ? { original: utterance, corrected, explanation, severity, kind }
      : null,
    needsClarification: Boolean(parsed.needs_clarification),
    suggestions: Array.isArray(parsed.suggestions)
      ? parsed.suggestions.slice(0, 3).map((s) => String(s).trim()).filter(Boolean)
      : [],
    metCriteria: Boolean(parsed.met_criteria),
  };
}
