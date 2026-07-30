// The Medellín humor reaction bank (spec section 11). Pure data: the selector
// in lib/humor.ts decides when (and whether) any of this ever renders.
//
// Editorial rules, enforced by tests in lib/humor.test.mjs:
// - Humor never ridicules the learner's English. Every line targets the
//   situation, the speaker themself, or affectionate local culture — never
//   the learner ("target" below records which, so tests can assert it).
// - Any line using slang carries a plain-Spanish meaning and a register note.
// - Clara's lines ship as reviewed copy ("reviewed" = releasable).
// - Joel's lines were written as proposals in his classroom register and held
//   as approval: "draft" (excluded at runtime) until he read them. Joel
//   approved all six on 2026-07-30, so they now carry "joel-approved" and can
//   reach a learner in his voice. Any NEW line starts life as "draft" again:
//   the gate is per line, not per file, and a draft is never presented as an
//   authentic Joel quote.

export type HumorSpeaker = "clara" | "joel";
export type HumorStrength = "light" | "strong";
export type HumorApproval = "reviewed" | "draft" | "joel-approved";
/** What the joke is about. Deliberately no "learner" member. */
export type HumorTarget = "situation" | "self" | "culture";

/** Positive moments where a reaction may appear. Restricted contexts
 *  (consent, errors, corrections) live in lib/humor.ts, not here. */
export type HumorContext =
  | "session-complete"
  | "mastery"
  | "comeback"
  | "streak"
  | "speed-round"
  | "recovery"
  | "perfect";

export interface HumorSlangNote {
  /** The slang term as used in the line. */
  term: string;
  /** Plain-Spanish meaning, no slang. */
  meaning: string;
  /** Register note: how local/informal it is, who says it to whom. */
  register: string;
}

export interface HumorReaction {
  id: string;
  speaker: HumorSpeaker;
  contexts: HumorContext[];
  strength: HumorStrength;
  approval: HumorApproval;
  target: HumorTarget;
  /** Bilingual like lib/i18n.ts: es is the learner's primary language. */
  text: { es: string; en: string };
  slang?: HumorSlangNote;
}

// ── Clara: reviewed, releasable ─────────────────────────────────────────────
// Light observational humor, warm young-adult register, occasional paisa
// phrasing. Celebrates effort and situations; never grades the learner.

const CLARA: HumorReaction[] = [
  {
    id: "clara-complete-1",
    speaker: "clara",
    contexts: ["session-complete"],
    strength: "light",
    approval: "reviewed",
    target: "situation",
    text: {
      es: "Sesión lista. El sofá te esperó todo este tiempo y ni se quejó.",
      en: "Session done. The couch waited this whole time and didn't even complain.",
    },
  },
  {
    id: "clara-complete-2",
    speaker: "clara",
    contexts: ["session-complete"],
    strength: "light",
    approval: "reviewed",
    target: "self",
    text: {
      es: "Terminamos. Y aquí estoy yo, celebrando como si el esfuerzo hubiera sido mío.",
      en: "We're done. And here I am, celebrating like the effort was mine.",
    },
  },
  {
    id: "clara-complete-3",
    speaker: "clara",
    contexts: ["session-complete"],
    strength: "light",
    approval: "reviewed",
    target: "culture",
    text: {
      es: "Qué bacano cerrar el día así. Mañana repetimos.",
      en: "So good to close the day like this. Tomorrow we do it again.",
    },
    slang: {
      term: "bacano",
      meaning: "muy bueno, agradable",
      register: "Coloquial colombiano, informal y positivo; común entre jóvenes.",
    },
  },
  {
    id: "clara-complete-4",
    speaker: "clara",
    contexts: ["session-complete"],
    strength: "strong",
    approval: "reviewed",
    target: "situation",
    text: {
      es: "Todo completo y cero excusas. Que alguien le avise al calendario que hoy sí se pudo.",
      en: "Everything done, zero excuses. Someone tell the calendar that today actually happened.",
    },
  },
  {
    id: "clara-streak-1",
    speaker: "clara",
    contexts: ["streak"],
    strength: "light",
    approval: "reviewed",
    target: "culture",
    text: {
      es: "Otro día juicioso. Ni el tinto de la mañana es tan constante.",
      en: "Another dedicated day. Not even the morning coffee is this consistent.",
    },
    slang: {
      term: "juicioso",
      meaning: "dedicado, disciplinado, que cumple con sus deberes",
      register: "Coloquial colombiano, cariñoso; lo dicen familiares y amigos con aprobación.",
    },
  },
  {
    id: "clara-streak-2",
    speaker: "clara",
    contexts: ["streak"],
    strength: "strong",
    approval: "reviewed",
    target: "culture",
    text: {
      es: "¡Hágale pues! Esta racha ya tiene más disciplina que fila de banco un lunes.",
      en: "Keep it going! This streak has more discipline than a bank line on a Monday.",
    },
    slang: {
      term: "hágale pues",
      meaning: "siga adelante, anímese a hacerlo",
      register: "Muy coloquial, típico de Antioquia; amistoso e informal, entre conocidos.",
    },
  },
  {
    id: "clara-mastery-1",
    speaker: "clara",
    contexts: ["mastery"],
    strength: "strong",
    approval: "reviewed",
    target: "situation",
    text: {
      es: "Dominado. Ese sonido ya puede pedir residencia permanente.",
      en: "Mastered. That sound can apply for permanent residency now.",
    },
  },
  {
    id: "clara-mastery-2",
    speaker: "clara",
    contexts: ["mastery"],
    strength: "light",
    approval: "reviewed",
    target: "culture",
    text: {
      es: "Nivel superado, parce. Esto ya va en serio.",
      en: "Level cleared. This is getting serious now.",
    },
    slang: {
      term: "parce",
      meaning: "amigo o amiga, forma corta de parcero",
      register: "Coloquial paisa, muy común entre jóvenes; cercano y de confianza.",
    },
  },
  {
    id: "clara-comeback-1",
    speaker: "clara",
    contexts: ["comeback"],
    strength: "light",
    approval: "reviewed",
    target: "situation",
    text: {
      es: "Volviste. La app ya estaba ensayando su cara de \"te extrañé\".",
      en: "You're back. The app was already rehearsing its \"I missed you\" face.",
    },
  },
  {
    id: "clara-comeback-2",
    speaker: "clara",
    contexts: ["comeback"],
    strength: "strong",
    approval: "reviewed",
    target: "culture",
    text: {
      es: "¡Qué nota verte de vuelta! Hasta el botón de practicar estaba aburrido sin ti.",
      en: "So good to see you back! Even the practice button was bored without you.",
    },
    slang: {
      term: "qué nota",
      meaning: "qué bueno, qué agradable",
      register: "Coloquial colombiano, positivo e informal; común en Medellín.",
    },
  },
  {
    id: "clara-speed-1",
    speaker: "clara",
    contexts: ["speed-round"],
    strength: "light",
    approval: "reviewed",
    target: "culture",
    text: {
      es: "Esa ronda pasó más rápido que aguacero de tarde en Medellín.",
      en: "That round went by faster than an afternoon downpour in Medellín.",
    },
  },
  {
    id: "clara-recovery-1",
    speaker: "clara",
    contexts: ["recovery"],
    strength: "light",
    approval: "reviewed",
    target: "self",
    text: {
      es: "Tropezar es parte del show. Yo una vez perdí el hilo a mitad de frase y aquí sigo, sonriendo en píxeles.",
      en: "Stumbling is part of the show. I once lost my train of thought mid-sentence and here I am, still smiling in pixels.",
    },
  },
  {
    id: "clara-perfect-1",
    speaker: "clara",
    contexts: ["perfect"],
    strength: "light",
    approval: "reviewed",
    target: "self",
    text: {
      es: "Perfecto de verdad. Lo revisé dos veces porque ni yo lo podía creer.",
      en: "Actually perfect. I checked twice because even I couldn't believe it.",
    },
  },
];

// ── Joel: candidate drafts only ─────────────────────────────────────────────
// Proposals in Joel's classroom register for HIS review. Not real quotes.
// Every entry stays "draft" (excluded at runtime) until Joel flips it to
// "joel-approved" himself, line by line.

const JOEL_DRAFTS: HumorReaction[] = [
  {
    id: "joel-draft-mastery-1",
    speaker: "joel",
    contexts: ["mastery"],
    strength: "strong",
    approval: "joel-approved",
    target: "situation",
    text: {
      es: "Eso que acabas de lograr no es suerte. La suerte no se repite tres veces seguidas.",
      en: "What you just pulled off isn't luck. Luck doesn't repeat itself three times in a row.",
    },
  },
  {
    id: "joel-draft-mastery-2",
    speaker: "joel",
    contexts: ["mastery"],
    strength: "light",
    approval: "joel-approved",
    target: "self",
    text: {
      es: "A mí ese sonido me costó más de lo que admito en clase.",
      en: "That sound cost me more effort than I admit in class.",
    },
  },
  {
    id: "joel-draft-comeback-1",
    speaker: "joel",
    contexts: ["comeback"],
    strength: "strong",
    approval: "joel-approved",
    target: "situation",
    text: {
      es: "Volver es la parte difícil, y ya la hiciste. Lo demás es costumbre.",
      en: "Coming back is the hard part, and you already did it. The rest is habit.",
    },
  },
  {
    id: "joel-draft-streak-1",
    speaker: "joel",
    contexts: ["streak"],
    strength: "light",
    approval: "joel-approved",
    target: "situation",
    text: {
      es: "Una racha así no se ve todos los días. Bueno, en tu caso sí, todos los días.",
      en: "A streak like this isn't something you see every day. Well, in your case it is. Every day.",
    },
  },
  {
    id: "joel-draft-complete-1",
    speaker: "joel",
    contexts: ["session-complete"],
    strength: "light",
    approval: "joel-approved",
    target: "situation",
    text: {
      es: "Sesión completa. Hoy el que descansa con la conciencia tranquila eres tú.",
      en: "Full session. Today you're the one resting with a clear conscience.",
    },
  },
  {
    id: "joel-draft-recovery-1",
    speaker: "joel",
    contexts: ["recovery"],
    strength: "light",
    approval: "joel-approved",
    target: "self",
    text: {
      es: "Equivocarse es entrenar. Yo llevo años en esto y todavía me enredo con algunas palabras.",
      en: "Making mistakes is training. I've been at this for years and some words still trip me up.",
    },
  },
];

export const HUMOR_BANK: HumorReaction[] = [...CLARA, ...JOEL_DRAFTS];
