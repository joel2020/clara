// Scenarios for the Virtual Call — a spoken practice conversation with Clara,
// the AI practice guide who helps a learner follow Joel's program.
//
// Deliberately separate from lib/content/call-scenarios.ts: that file is the BPO
// simulator, where Joel plays an impatient American customer and the learner is
// the support agent being graded. This file is ordinary conversation practice,
// where Clara is a friendly partner. Same app, opposite intent — merging them
// would force one prompt to be both a customer and a coach.
//
// Authoring a new scenario: add an entry below. Nothing else needs to change —
// the picker, the turn route, and the report all read from VIRTUAL_CALL_SCENARIOS.
// See VIRTUAL_CALL_SYSTEM.md for the field-by-field guide.

import type { Level } from "../placement.ts";

/** Roughly how long a call should run before Clara starts wrapping it up. */
export type CallLength = "short" | "standard";

export interface VirtualCallScenario {
  id: string;
  title: { es: string; en: string };
  description: { es: string; en: string };
  /** The app's existing CEFR band — the floor at which this call makes sense. */
  level: Level;
  /** What the learner should be able to do afterwards, in her coach language. */
  objective: { es: string; en: string };
  /** Words worth reaching for. Offered to the model as permission, not a script. */
  targetVocabulary: string[];
  /** The grammar this call naturally exercises (e.g. past simple). */
  targetGrammar: { es: string; en: string };
  /** Clara's first spoken line. Rendered locally so the call opens instantly. */
  openingPrompt: string;
  /** Where the conversation can go, so Clara has somewhere to steer. */
  suggestedTurns: string[];
  /** What "done" means for this call. Checked against the transcript. */
  completionCriteria: { es: string; en: string };
  /** Target learner turns before Clara wraps up. */
  targetTurns: number;
  length: CallLength;
  /** Shown to the learner when the situation differs culturally from Colombia. */
  culturalNote?: { es: string; en: string };
}

export const VIRTUAL_CALL_SCENARIOS: VirtualCallScenario[] = [
  {
    id: "introducing-yourself",
    title: { es: "Presentarte", en: "Introducing yourself" },
    description: {
      es: "Cuenta quién eres, a qué te dedicas y qué te gusta hacer.",
      en: "Say who you are, what you do, and what you like doing.",
    },
    level: "A1",
    objective: {
      es: "Presentarte con dos o tres frases completas sin traducir en tu cabeza.",
      en: "Introduce yourself in two or three full sentences without translating in your head.",
    },
    targetVocabulary: ["my name is", "I'm from", "I work as", "I'm studying", "nice to meet you"],
    targetGrammar: {
      es: "Presente simple con I y verbo to be.",
      en: "Present simple with I, and the verb to be.",
    },
    openingPrompt: "Hi! I'm Lumi. I'd love to get to know you — tell me a little about yourself. What's your name and what do you do?",
    suggestedTurns: [
      "Ask what she does for work or study.",
      "Ask where in Colombia she is from.",
      "Ask what she does on weekends.",
      "Ask why she is learning English.",
    ],
    completionCriteria: {
      es: "Dijiste tu nombre, de dónde eres y a qué te dedicas.",
      en: "You said your name, where you are from, and what you do.",
    },
    targetTurns: 5,
    length: "short",
  },
  {
    id: "meeting-someone-new",
    title: { es: "Conocer a alguien", en: "Meeting someone new" },
    description: {
      es: "Small talk con alguien que acabas de conocer en un evento.",
      en: "Small talk with someone you have just met at an event.",
    },
    level: "A2",
    objective: {
      es: "Mantener una conversación casual y hacer preguntas de vuelta.",
      en: "Keep a casual conversation going and ask questions back.",
    },
    targetVocabulary: ["how's it going", "what about you", "that sounds", "actually", "I've been"],
    targetGrammar: {
      es: "Preguntas con do/does y respuestas cortas naturales.",
      en: "Questions with do/does, and natural short answers.",
    },
    openingPrompt: "Hey! I don't think we've met — I'm Lumi. Are you here with someone, or did you come on your own?",
    suggestedTurns: [
      "Ask how she knows the host.",
      "Share something small about yourself so it feels mutual.",
      "Ask what she does outside of work.",
      "Find something you have in common.",
    ],
    completionCriteria: {
      es: "Respondiste y también hiciste preguntas de vuelta.",
      en: "You answered and also asked questions back.",
    },
    targetTurns: 6,
    length: "standard",
    culturalNote: {
      es: "En EE. UU. el small talk con desconocidos es normal y breve; no es invasivo preguntar a qué te dedicas.",
      en: "In the US, small talk with strangers is normal and brief; asking what someone does is not intrusive.",
    },
  },
  {
    id: "ordering-restaurant",
    title: { es: "Pedir en un restaurante", en: "Ordering at a restaurant" },
    description: {
      es: "Ordena comida, pregunta por el plato y pide la cuenta.",
      en: "Order food, ask about a dish, and ask for the check.",
    },
    level: "A1",
    objective: {
      es: "Pedir lo que quieres y resolver un cambio sin bloquearte.",
      en: "Order what you want and handle a change without freezing.",
    },
    targetVocabulary: ["I'll have", "could I get", "does it come with", "the check", "to go"],
    targetGrammar: {
      es: "Peticiones educadas con could/can y I'll have.",
      en: "Polite requests with could/can, and I'll have.",
    },
    openingPrompt: "Hi there, welcome in! Can I start you off with something to drink?",
    suggestedTurns: [
      "Take her drink order, then ask if she is ready to order food.",
      "Answer a question about a dish.",
      "Mention one item is sold out so she has to choose again.",
      "Offer dessert, then bring the check.",
    ],
    completionCriteria: {
      es: "Ordenaste bebida y comida, y pediste la cuenta.",
      en: "You ordered a drink and food, and asked for the check.",
    },
    targetTurns: 6,
    length: "standard",
    culturalNote: {
      es: "En EE. UU. se deja propina del 15–20 % y la cuenta no llega hasta que la pides.",
      en: "In the US you tip 15–20%, and the check does not arrive until you ask for it.",
    },
  },
  {
    id: "job-interview",
    title: { es: "Entrevista de trabajo", en: "Job interview" },
    description: {
      es: "Responde preguntas típicas de una entrevista en inglés.",
      en: "Answer typical interview questions in English.",
    },
    level: "B1",
    objective: {
      es: "Hablar de tu experiencia y tus fortalezas con ejemplos concretos.",
      en: "Talk about your experience and strengths with concrete examples.",
    },
    targetVocabulary: ["I have experience in", "my strength is", "I handled", "I'm looking for", "responsible for"],
    targetGrammar: {
      es: "Pasado simple y present perfect para experiencia laboral.",
      en: "Past simple and present perfect for work experience.",
    },
    openingPrompt: "Thanks for coming in today. To start — could you tell me a bit about your background and what you're looking for?",
    suggestedTurns: [
      "Ask about a specific challenge she handled at work.",
      "Ask what her biggest strength is, and push for an example.",
      "Ask why she wants this role.",
      "Invite her questions, then close warmly.",
    ],
    completionCriteria: {
      es: "Describiste tu experiencia y diste al menos un ejemplo concreto.",
      en: "You described your experience and gave at least one concrete example.",
    },
    targetTurns: 6,
    length: "standard",
    culturalNote: {
      es: "En EE. UU. se espera que hables de tus logros de forma directa; no se ve como arrogancia.",
      en: "In the US you are expected to state your achievements directly; it is not read as bragging.",
    },
  },
  {
    id: "workplace-conversation",
    title: { es: "Conversación en el trabajo", en: "Workplace conversation" },
    description: {
      es: "Habla con un compañero sobre una tarea y un plazo.",
      en: "Talk with a coworker about a task and a deadline.",
    },
    level: "B1",
    objective: {
      es: "Pedir ayuda, dar una actualización y negociar un plazo.",
      en: "Ask for help, give an update, and negotiate a deadline.",
    },
    targetVocabulary: ["I'm working on", "could you take a look", "by end of day", "I'm running behind", "let's sync"],
    targetGrammar: {
      es: "Futuro con going to / will para compromisos.",
      en: "Future with going to / will for commitments.",
    },
    openingPrompt: "Morning! Quick one — how's that report coming along? I told the team we'd have it today.",
    suggestedTurns: [
      "Ask for a status update.",
      "React if she needs more time, and negotiate.",
      "Ask if she needs anything from you.",
      "Confirm the new plan clearly.",
    ],
    completionCriteria: {
      es: "Diste una actualización y acordaron un plan concreto.",
      en: "You gave an update and agreed on a concrete plan.",
    },
    targetTurns: 5,
    length: "standard",
  },
  {
    id: "travel-problem",
    title: { es: "Problema viajando", en: "Travel problem" },
    description: {
      es: "Tu vuelo se retrasó y necesitas resolverlo en el aeropuerto.",
      en: "Your flight is delayed and you need to sort it out at the airport.",
    },
    level: "A2",
    objective: {
      es: "Explicar un problema y pedir una solución con claridad.",
      en: "Explain a problem and ask for a solution clearly.",
    },
    targetVocabulary: ["my flight was delayed", "I need to get to", "is there another", "what are my options", "connecting flight"],
    targetGrammar: {
      es: "Pasado simple para contar qué pasó y preguntas con what/when.",
      en: "Past simple to say what happened, and what/when questions.",
    },
    openingPrompt: "Hi, thanks for waiting — I see there's a note on your booking. What can I help you with today?",
    suggestedTurns: [
      "Ask for her booking details and what happened.",
      "Offer one option that does not fully work, so she has to push back.",
      "Offer a workable alternative.",
      "Confirm the new plan and wish her a good trip.",
    ],
    completionCriteria: {
      es: "Explicaste el problema y conseguiste una alternativa.",
      en: "You explained the problem and got an alternative.",
    },
    targetTurns: 6,
    length: "standard",
  },
  {
    id: "social-plans",
    title: { es: "Planes con amigos", en: "Social plans" },
    description: {
      es: "Organiza un plan: proponer, ajustar y confirmar.",
      en: "Make a plan: suggest, adjust, and confirm.",
    },
    level: "A2",
    objective: {
      es: "Proponer un plan y responder a una contrapropuesta.",
      en: "Suggest a plan and respond to a counter-suggestion.",
    },
    targetVocabulary: ["do you want to", "how about", "I'm free", "works for me", "let's do it"],
    targetGrammar: {
      es: "Sugerencias con how about / let's y horas y días.",
      en: "Suggestions with how about / let's, plus times and days.",
    },
    openingPrompt: "Hey! A few of us are getting together this weekend — any chance you're free? What do you feel like doing?",
    suggestedTurns: [
      "Suggest something, then let her counter.",
      "Negotiate the day and time.",
      "Ask who else should come.",
      "Confirm the final plan out loud.",
    ],
    completionCriteria: {
      es: "Acordaron qué hacer y cuándo.",
      en: "You agreed on what to do and when.",
    },
    targetTurns: 5,
    length: "short",
  },
  {
    id: "dating-conversation",
    title: { es: "Una cita", en: "Dating conversation" },
    description: {
      es: "Una primera cita relajada: conocerse y mostrar interés.",
      en: "A relaxed first date: getting to know each other and showing interest.",
    },
    level: "B1",
    objective: {
      es: "Sostener una conversación con interés genuino y humor ligero.",
      en: "Hold a conversation with genuine interest and light humor.",
    },
    targetVocabulary: ["I'm really into", "what got you into", "that's funny", "I'd love to", "we should"],
    targetGrammar: {
      es: "Preguntas abiertas y expresar gustos con like / into.",
      en: "Open questions and expressing taste with like / into.",
    },
    openingPrompt: "This place is nicer than the photos, honestly. So — how was your week? Anything good happen?",
    suggestedTurns: [
      "Ask about something she enjoys, and follow up on a detail.",
      "Share something about yourself so it stays balanced.",
      "Ask an open question about what she is looking for.",
      "Suggest doing something again.",
    ],
    completionCriteria: {
      es: "Hiciste preguntas abiertas y compartiste algo tuyo.",
      en: "You asked open questions and shared something of your own.",
    },
    targetTurns: 6,
    length: "standard",
    culturalNote: {
      es: "Conversación respetuosa: coquetear está bien, pero nada explícito ni presión.",
      en: "Respectful conversation: light flirting is fine, nothing explicit and no pressure.",
    },
  },
];

export function getVirtualCallScenario(id: string): VirtualCallScenario | undefined {
  return VIRTUAL_CALL_SCENARIOS.find((s) => s.id === id);
}

/** Scenarios at or below her level, hardest first, so the picker leads with a real fit. */
export function scenariosForLevel(level: Level, order: readonly Level[]): VirtualCallScenario[] {
  const rank = (l: Level) => order.indexOf(l);
  const ceiling = rank(level);
  return [...VIRTUAL_CALL_SCENARIOS].sort((a, b) => {
    const ra = rank(a.level);
    const rb = rank(b.level);
    const aFits = ra <= ceiling;
    const bFits = rb <= ceiling;
    if (aFits !== bFits) return aFits ? -1 : 1;
    return aFits ? rb - ra : ra - rb;
  });
}
