import type { Skill } from "@/lib/placement";

// Seed bank for the adaptive placement check. Each item is tagged with a skill
// and a CEFR difficulty 0..5 (A0..C1). The onboarding controller rotates skills
// and picks an unused item near the running difficulty, stepping up/down with
// performance. Content is practical American English with Colombian-Spanish
// support — measuring real conversational ability, not grammar trivia.
//
// `mcq`: multiple choice, one correct. `listen`: same, but `speak` holds the
// English text the UI plays aloud (SpeechSynthesis) instead of showing it.

export interface PlacementQ {
  id: string;
  skill: Skill;
  difficulty: number; // 0..5
  kind: "mcq" | "listen";
  /** Instruction shown above the item (Spanish). */
  promptEs: string;
  /** For mcq: the English stimulus shown. For listen: hidden; use `speak`. */
  stem?: string;
  /** For listen items: the English sentence the UI speaks aloud. */
  speak?: string;
  options: { text: string; correct?: boolean }[];
}

const Q = (
  id: string,
  skill: Skill,
  difficulty: number,
  kind: "mcq" | "listen",
  promptEs: string,
  body: { stem?: string; speak?: string },
  options: [string, boolean][],
): PlacementQ => ({
  id,
  skill,
  difficulty,
  kind,
  promptEs,
  ...body,
  options: options.map(([text, correct]) => ({ text, correct })),
});

export const PLACEMENT_BANK: PlacementQ[] = [
  // ── Vocabulary (English word/phrase → meaning) ──
  Q("v0", "vocabulary", 0, "mcq", "¿Qué significa esta palabra?", { stem: "water" }, [["agua", true], ["fuego", false], ["silla", false]]),
  Q("v1", "vocabulary", 1, "mcq", "¿Qué significa?", { stem: "cheap" }, [["barato", true], ["caro", false], ["rápido", false]]),
  Q("v2", "vocabulary", 2, "mcq", "¿Qué significa?", { stem: "on time" }, [["a tiempo", true], ["tarde", false], ["a veces", false]]),
  Q("v3", "vocabulary", 3, "mcq", "¿Qué significa esta expresión?", { stem: "I'm broke" }, [["No tengo plata", true], ["Estoy roto (herido)", false], ["Estoy aburrido", false]]),
  Q("v4", "vocabulary", 4, "mcq", "¿Qué significa?", { stem: "It's a rip-off" }, [["Es un robo (muy caro)", true], ["Es un regalo", false], ["Es un descuento", false]]),
  Q("v5", "vocabulary", 5, "mcq", "¿Qué significa este modismo?", { stem: "Let's play it by ear" }, [["Vemos sobre la marcha", true], ["Escuchemos música", false], ["Hagamos un plan fijo", false]]),

  // ── Grammar in context (pick what a native would say) ──
  Q("g0", "grammar", 0, "mcq", "Completa: ¿Cuál suena natural?", { stem: "___ name is Ana." }, [["My", true], ["Me", false], ["I", false]]),
  Q("g1", "grammar", 1, "mcq", "Completa la frase.", { stem: "She ___ coffee every morning." }, [["drinks", true], ["drink", false], ["drinking", false]]),
  Q("g2", "grammar", 2, "mcq", "Completa la frase.", { stem: "I ___ to the beach last weekend." }, [["went", true], ["go", false], ["going", false]]),
  Q("g3", "grammar", 3, "mcq", "¿Cuál es correcta?", { stem: "If it rains, we ___ stay home." }, [["will", true], ["would have", false], ["are", false]]),
  Q("g4", "grammar", 4, "mcq", "Completa naturalmente.", { stem: "I wish I ___ more time." }, [["had", true], ["have", false], ["will have", false]]),
  Q("g5", "grammar", 5, "mcq", "¿Cuál suena más nativa?", { stem: "By the time we arrived, the movie ___." }, [["had already started", true], ["already started", false], ["was already start", false]]),

  // ── Reading (short text → meaning) ──
  Q("r0", "reading", 0, "mcq", "Lee y responde: ¿Qué dice?", { stem: "Open 9am–5pm." }, [["Abierto de 9 a 5", true], ["Cerrado los domingos", false], ["Gratis los lunes", false]]),
  Q("r1", "reading", 1, "mcq", "¿Qué pide el mensaje?", { stem: "Please text me when you arrive." }, [["Que le escribas al llegar", true], ["Que lo llames mañana", false], ["Que traigas comida", false]]),
  Q("r2", "reading", 2, "mcq", "¿Qué significa?", { stem: "The meeting was pushed to Friday." }, [["La reunión se movió al viernes", true], ["Se canceló la reunión", false], ["La reunión empezó tarde", false]]),
  Q("r3", "reading", 3, "mcq", "¿Cuál es la idea?", { stem: "I can't make it tonight, let's catch up soon." }, [["Hoy no puede, pero quiere verse pronto", true], ["Está en camino ahora", false], ["Nunca quiere verse", false]]),
  Q("r4", "reading", 4, "mcq", "¿Qué tono tiene?", { stem: "I'd appreciate it if you could get back to me by EOD." }, [["Pide respuesta hoy, con cortesía", true], ["Está molesto y exige ya", false], ["No le importa la respuesta", false]]),
  Q("r5", "reading", 5, "mcq", "¿Qué implica?", { stem: "That's easier said than done." }, [["Es más difícil de lo que parece", true], ["Es muy fácil", false], ["Ya está hecho", false]]),

  // ── Listening (UI speaks English → pick meaning) ──
  Q("l0", "listening", 0, "listen", "Escucha y elige el significado.", { speak: "Hello, how are you?" }, [["Hola, ¿cómo estás?", true], ["¿Cuántos años tienes?", false], ["¿Dónde vives?", false]]),
  Q("l1", "listening", 1, "listen", "Escucha y elige.", { speak: "How much is this?" }, [["¿Cuánto cuesta esto?", true], ["¿Dónde está el baño?", false], ["¿Qué hora es?", false]]),
  Q("l2", "listening", 2, "listen", "Escucha y elige.", { speak: "Can I get a table for two?" }, [["¿Me da una mesa para dos?", true], ["¿Puedo pagar con tarjeta?", false], ["¿Está abierto?", false]]),
  Q("l3", "listening", 3, "listen", "Escucha y elige.", { speak: "Do you want to grab a coffee later?" }, [["¿Tomamos un café más tarde?", true], ["¿Ya te tomaste el café?", false], ["¿Trabajas en un café?", false]]),
  Q("l4", "listening", 4, "listen", "Escucha y elige.", { speak: "I was gonna call you, but I totally forgot." }, [["Te iba a llamar, pero se me olvidó", true], ["Te llamé y no contestaste", false], ["No quiero llamarte", false]]),
  Q("l5", "listening", 5, "listen", "Escucha y elige.", { speak: "Honestly, I'm swamped this week — can we push it?" }, [["Está muy ocupada; pide posponer", true], ["Está libre toda la semana", false], ["Quiere adelantar el plan", false]]),
];

/** Pick an unused question for a skill nearest the target difficulty. */
export function pickQuestion(skill: Skill, targetDifficulty: number, usedIds: Set<string>): PlacementQ | null {
  const pool = PLACEMENT_BANK.filter((q) => q.skill === skill && !usedIds.has(q.id));
  if (!pool.length) return null;
  pool.sort((a, b) => Math.abs(a.difficulty - targetDifficulty) - Math.abs(b.difficulty - targetDifficulty));
  return pool[0];
}

/** The spoken prompt for the optional speaking step. */
export const SPEAKING_PROMPT = {
  es: "Preséntate y cuéntame qué hiciste ayer. Habla 15–20 segundos.",
  en: "Introduce yourself and tell me what you did yesterday.",
};
