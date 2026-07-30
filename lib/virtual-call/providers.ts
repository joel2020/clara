// Provider seam for the Virtual Call.
//
// Everything the call needs from a paid third party sits behind one interface,
// for two reasons. First, development and CI must work with no keys at all — a
// contributor should be able to run a whole call locally and see every state,
// which the mock below makes possible without fabricating a credential.
// Second, the turn-based design is meant to be replaced later by a realtime
// full-duplex provider; when that happens only this file's implementations
// change, not the route or the UI. See VIRTUAL_CALL_SYSTEM.md.
//
// Server-only. Never import this from a client component: the concrete
// implementations read API keys from the environment.

import type { CorrectionMode, TurnAnalysis } from "./session.ts";

export interface TurnRequest {
  scenarioId: string;
  mode: CorrectionMode;
  level: string;
  coachLanguage: "es" | "en";
  studentName: string;
  /** Clara's opening line, so the model sees how the call started. */
  opener: string;
  /** Windowed recent turns — never the whole call. */
  history: { role: "clara" | "learner"; text: string }[];
  /** The learner's newest utterance, already transcribed. */
  utterance: string;
  scenario: {
    title: string;
    objective: string;
    targetVocabulary: readonly string[];
    targetGrammar: string;
    suggestedTurns: readonly string[];
    completionCriteria: string;
    culturalNote?: string;
  };
}

export interface CallBrain {
  /** Human-readable id for logging and the health endpoint. Never a key. */
  readonly name: string;
  analyzeTurn(req: TurnRequest): Promise<TurnAnalysis>;
}

/**
 * The development fallback.
 *
 * It is deliberately rule-based rather than random: the same utterance always
 * produces the same analysis, so UI states and tests are reproducible. It
 * detects a couple of real, extremely common Spanish-speaker patterns so the
 * correction and retry flows can be exercised end to end — but it is NOT a
 * language model and must never run in production. The route enforces that.
 */
export class MockCallBrain implements CallBrain {
  readonly name = "mock";

  async analyzeTurn(req: TurnRequest): Promise<TurnAnalysis> {
    const said = req.utterance.trim();
    const lower = said.toLowerCase();

    if (!said) {
      return {
        reply: "Sorry, I didn't catch that. Could you say it again?",
        replyEs: "Perdón, no te escuché. ¿Puedes repetirlo?",
        correction: null,
        needsClarification: true,
        suggestions: ["Let me try again.", "Can you hear me?"],
        metCriteria: false,
      };
    }

    // "Yesterday I go..." — past-tense marker with a present verb. The canonical
    // example from the product brief, and genuinely the most common one.
    const pastMarker = /\b(yesterday|last night|last week|last year)\b/.test(lower);
    const presentGo = /\b(go|eat|see|make|take|come|say|do)\b/.exec(lower);
    if (pastMarker && presentGo) {
      const irregular: Record<string, string> = {
        go: "went", eat: "ate", see: "saw", make: "made",
        take: "took", come: "came", say: "said", do: "did",
      };
      const wrong = presentGo[1];
      const right = irregular[wrong];
      const corrected = said.replace(new RegExp(`\\b${wrong}\\b`, "i"), right);
      return {
        reply: "Nice — that sounds like a good day. What did you do there?",
        replyEs: "Qué bien, suena a un buen día. ¿Y qué hiciste allá?",
        correction: {
          original: said,
          corrected,
          explanation:
            req.coachLanguage === "es"
              ? `Con "yesterday" el verbo va en pasado: "${wrong}" cambia a "${right}".`
              : `With "yesterday" the verb goes in the past: "${wrong}" becomes "${right}".`,
          severity: "significant",
          kind: "grammar",
        },
        needsClarification: false,
        suggestions: ["I met my friends.", "We watched a movie."],
        metCriteria: false,
      };
    }

    // "I have 25 years" — direct calque of "tengo 25 años".
    const ageCalque = /\bi have (\d{1,2}) years?\b/i.exec(said);
    if (ageCalque) {
      return {
        reply: "Got it! And what do you like doing in your free time?",
        replyEs: "¡Listo! ¿Y qué te gusta hacer en tu tiempo libre?",
        correction: {
          original: said,
          corrected: said.replace(ageCalque[0], `I'm ${ageCalque[1]} years old`),
          explanation:
            req.coachLanguage === "es"
              ? 'En inglés la edad va con "to be": "I\'m 25 years old", no "I have 25 years".'
              : 'In English, age uses "to be": "I\'m 25 years old", not "I have 25 years".',
          severity: "significant",
          kind: "grammar",
        },
        needsClarification: false,
        suggestions: ["I like cooking.", "I play football on weekends."],
        metCriteria: false,
      };
    }

    const metCriteria = said.split(/\s+/).length >= 6;
    return {
      reply: "That makes sense. Tell me a bit more about that.",
      replyEs: "Tiene sentido. Cuéntame un poco más de eso.",
      correction: null,
      needsClarification: false,
      suggestions: ["Sure, so basically...", "Well, the thing is..."],
      metCriteria,
    };
  }
}
