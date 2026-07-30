// The Virtual Call turn provider — the ONE seam between this UI and the model.
//
// ===========================================================================
// ONE SEAM. Every caller goes through the VirtualCallTurnProvider type, so the
// binding at the bottom of this file is the only place that decides where a
// turn is analyzed. It is bound to `fetchTurnAnalysis`, the live route.
//
// Point it at `mockTurnProvider` to walk every call state with no auth, no
// model key and no network — that is how the UI is reviewed and screenshotted.
// A future realtime provider swaps in at this same binding.
// ===========================================================================

import { authHeaders } from "@/lib/auth-client";
import type { CoachLang } from "@/lib/i18n";
import type { Level } from "@/lib/placement";
import type { CorrectionMode, TurnAnalysis, TurnCorrection } from "@/lib/virtual-call/session";

/** The request body of POST /api/virtual-call/turn, field for field. */
export interface VirtualCallTurnRequest {
  scenarioId: string;
  mode: CorrectionMode;
  level: Level;
  /** The language Clara explains in — never the language she speaks in. */
  coachLanguage: CoachLang;
  studentName: string;
  /** What the learner just said, as transcribed. */
  utterance: string;
  /** Recent lines from both sides, oldest first, already windowed. */
  history: { role: "clara" | "learner"; text: string }[];
  /** Aborted when the call ends or the learner navigates away. */
  signal?: AbortSignal;
}

export type VirtualCallTurnProvider = (req: VirtualCallTurnRequest) => Promise<TurnAnalysis>;

/** Thrown with the route's own error code, so a caller can tell 503 from 502. */
export class TurnRequestError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
    this.name = "TurnRequestError";
  }
}

/** The real provider: one POST to the stateless turn route. */
export const fetchTurnAnalysis: VirtualCallTurnProvider = async ({ signal, ...body }) => {
  const res = await fetch("/api/virtual-call/turn", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(body),
    signal,
  });
  const payload = (await res.json().catch(() => null)) as
    | { analysis?: TurnAnalysis; error?: string }
    | null;
  if (!res.ok || !payload?.analysis) {
    throw new TurnRequestError(payload?.error ?? "upstream", res.status);
  }
  return payload.analysis;
};

// ---------------------------------------------------------------------------
// MOCK PROVIDER — NOT PRODUCTION. Offline, deterministic, no network.
//
// It exists so the screen is fully demonstrable — including the inline
// correction, the practice-mode interrupt, the retry, and the clarification
// path — without auth, a model key, or a network. Delete it with the swap above.
//
// To walk the states by hand, say one of the demo lines:
//   "i have 25 years"      → significant grammar fix (interrupts in practice)
//   "i no understand"      → significant grammar fix
//   "i am agree with you"  → significant phrasing fix
//   "a lot of peoples"     → minor fix (inline only, never interrupts)
//   "um like i think so"   → minor phrasing fix (filler removed)
// Any fourth turn returns needsClarification, which interrupts in both modes.
// ---------------------------------------------------------------------------

interface MockPatch {
  re: RegExp;
  fix: string;
  kind: TurnCorrection["kind"];
  severity: TurnCorrection["severity"];
  explanation: { es: string; en: string };
}

const MOCK_PATCHES: MockPatch[] = [
  {
    re: /\bi have (\d+) years?\b/i,
    fix: "I'm $1 years old",
    kind: "grammar",
    severity: "significant",
    explanation: {
      es: "La edad en inglés va con el verbo to be: I'm 25 years old, no I have 25 years.",
      en: "English states age with the verb to be: I'm 25 years old, not I have 25 years.",
    },
  },
  {
    re: /\bi no (\w+)/i,
    fix: "I don't $1",
    kind: "grammar",
    severity: "significant",
    explanation: {
      es: "Para negar un verbo en presente se usa don't: I don't understand.",
      en: "To negate a present-tense verb use don't: I don't understand.",
    },
  },
  {
    re: /\bi am agree\b/i,
    fix: "I agree",
    kind: "phrasing",
    severity: "significant",
    explanation: {
      es: "Agree ya es el verbo, así que no lleva am: I agree.",
      en: "Agree is already the verb, so it takes no am: I agree.",
    },
  },
  {
    re: /\bpeoples\b/i,
    fix: "people",
    kind: "vocabulary",
    severity: "minor",
    explanation: {
      es: "People ya es plural; peoples no se usa así.",
      en: "People is already plural; peoples is not used that way.",
    },
  },
  {
    re: /\bmore better\b/i,
    fix: "better",
    kind: "grammar",
    severity: "minor",
    explanation: {
      es: "Better ya es comparativo, no necesita more.",
      en: "Better is already comparative, so it does not take more.",
    },
  },
];

const FILLER = /\b(um+|uh+|eh+|like)\b/gi;

function sentenceCase(s: string): string {
  const trimmed = s.trim().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;
  const capitalized = trimmed[0].toUpperCase() + trimmed.slice(1);
  const withI = capitalized.replace(/\bi\b/g, "I");
  return /[.?!]$/.test(withI) ? withI : `${withI}.`;
}

function mockCorrection(transcript: string, lang: CoachLang): TurnCorrection | null {
  for (const patch of MOCK_PATCHES) {
    if (!patch.re.test(transcript)) continue;
    const corrected = sentenceCase(transcript.replace(patch.re, patch.fix));
    if (corrected.toLowerCase() === sentenceCase(transcript).toLowerCase()) continue;
    return {
      original: transcript,
      corrected,
      explanation: patch.explanation[lang],
      severity: patch.severity,
      kind: patch.kind,
    };
  }
  // Filler removal — a real, coherent phrasing note that any transcript can hit.
  const cleaned = sentenceCase(transcript.replace(FILLER, " "));
  if (cleaned && cleaned.toLowerCase() !== sentenceCase(transcript).toLowerCase()) {
    return {
      original: transcript,
      corrected: cleaned,
      explanation:
        lang === "es"
          ? "Se entiende mejor sin las muletillas. Intenta la frase de corrido."
          : "It lands better without the filler. Try the sentence in one go.",
      severity: "minor",
      kind: "phrasing",
    };
  }
  return null;
}

const MOCK_REPLIES: { en: string; es: string }[] = [
  {
    en: "That makes sense. Tell me a bit more — what happened next?",
    es: "Tiene sentido. Cuéntame un poco más: ¿qué pasó después?",
  },
  {
    en: "Nice. And how did you feel about that at the time?",
    es: "Qué bien. ¿Y cómo te sentiste con eso en ese momento?",
  },
  {
    en: "Got it. Let me ask you something else — what would you do differently?",
    es: "Entendido. Te pregunto otra cosa: ¿qué harías distinto?",
  },
  {
    en: "Okay, good. Last thing before we wrap up — anything you want to add?",
    es: "Bien. Última cosa antes de cerrar: ¿algo que quieras agregar?",
  },
];

const MOCK_CLARIFY = {
  en: "Sorry, I didn't quite catch that. Could you say it another way?",
  es: "Perdón, no te entendí bien. ¿Lo puedes decir de otra forma?",
};

const MOCK_SUGGESTIONS = ["Actually, I think…", "Could you say that again?", "What about you?"];

/** Fake latency, so the processing state is visible while the mock is in place. */
const MOCK_LATENCY_MS = 700;

export const mockTurnProvider: VirtualCallTurnProvider = (req) =>
  new Promise<TurnAnalysis>((resolve, reject) => {
    const timer = setTimeout(() => {
      // History interleaves both sides, so learner turns are half of it.
      const index = Math.floor(req.history.length / 2);
      // Every fourth turn, Clara genuinely misses it — the clarification path.
      const needsClarification = index > 0 && index % 4 === 3;
      const correction = needsClarification ? null : mockCorrection(req.utterance, req.coachLanguage);
      const reply = needsClarification ? MOCK_CLARIFY : MOCK_REPLIES[index % MOCK_REPLIES.length];
      resolve({
        reply: reply.en,
        replyEs: reply.es,
        correction,
        needsClarification,
        suggestions: MOCK_SUGGESTIONS,
        metCriteria: index >= 3,
      });
    }, MOCK_LATENCY_MS);
    req.signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

/**
 * The provider the UI actually calls: the real turn route.
 *
 * The mock above is kept deliberately rather than deleted. It is the only way
 * to walk every call state — inline correction, practice-mode interrupt, retry,
 * clarification — with no network and no spend, which is what makes the UI
 * testable and reviewable. Point this binding at `mockTurnProvider` to do that.
 * The server has its own separate mock for keyless development; this one exists
 * for the client.
 */
export const virtualCallTurnProvider: VirtualCallTurnProvider = fetchTurnAnalysis;
