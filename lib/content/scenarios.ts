// The Conversación en vivo (live conversation) scenarios. Each one is a small
// roleplay where Joel plays a role and the learner talks back — the same six
// situations as the Conversación drill track, but now open-ended and spoken.
// The drills build the chunks; this is where she uses them for real.

export interface Scenario {
  id: string;
  /** Emoji shown on the scenario card. */
  emoji: string;
  title: { es: string; en: string };
  /** One-line setting shown under the title. */
  blurb: { es: string; en: string };
  /** The role Joel plays — feeds the system prompt so he stays in character.
   *  May contain {name}; resolve with lib/personalize before use. */
  role: string;
  /** The situation, described to the model in plain English. */
  setting: string;
  /** Joel's opening line and its Spanish translation. */
  opener: { en: string; es: string };
  /** A few things she could say to get started (English). */
  starters: string[];
}

export const SCENARIOS: Scenario[] = [
  {
    id: "greetings",
    emoji: "👋",
    title: { es: "Conocer a alguien", en: "Meeting someone" },
    blurb: { es: "Saludos e introducciones", en: "Greetings & introductions" },
    role: "a friendly new coworker meeting {name} for the first time",
    setting:
      "You just met {name} at work. Make small introductions — names, where she is from, what she does — the way two friendly coworkers meet on a first day.",
    opener: { en: "Hi! I'm Joel. Nice to meet you. What's your name?", es: "¡Hola! Soy Joel. Mucho gusto. ¿Cómo te llamas?" },
    starters: ["Hi, I'm {name}.", "Nice to meet you too.", "I'm from Colombia."],
  },
  {
    id: "cafe",
    emoji: "☕",
    title: { es: "En el café", en: "At the café" },
    blurb: { es: "Pedir comida y bebida", en: "Ordering food & drinks" },
    role: "a warm barista at a coffee shop taking {name}'s order",
    setting:
      "{name} walks into your coffee shop. Take her order step by step — greet her, ask what she'd like, offer a size, ask about food, and handle paying. Keep it easy and friendly.",
    opener: { en: "Hi, welcome! What can I get for you today?", es: "¡Hola, bienvenida! ¿Qué te sirvo hoy?" },
    starters: ["Can I have a coffee, please?", "Can I see the menu?", "Do you take cards?"],
  },
  {
    id: "directions",
    emoji: "🗺️",
    title: { es: "Pidiendo direcciones", en: "Asking directions" },
    blurb: { es: "Encontrar tu camino", en: "Finding your way" },
    role: "a kind stranger on the street helping {name} find the way",
    setting:
      "{name} is a little lost and stops you on the street. Help them get where they're going — ask where she wants to go, then give simple directions (left, right, straight, next to). Be patient and clear.",
    opener: { en: "Hi there! You look a little lost. Where are you trying to go?", es: "¡Hola! Pareces un poco perdida. ¿A dónde quieres ir?" },
    starters: ["How do I get to the airport?", "Is it far from here?", "Excuse me, I'm lost."],
  },
  {
    id: "shopping",
    emoji: "🛍️",
    title: { es: "De compras", en: "Shopping" },
    blurb: { es: "Precios, tallas y pagar", en: "Prices, sizes & paying" },
    role: "a helpful shop assistant in a clothing store",
    setting:
      "{name} is browsing in your clothing store. Help them shop — ask if she needs help, talk about sizes and prices, let them try things on, and finish the sale. Keep the language simple.",
    opener: { en: "Hi! Let me know if you need any help. Are you looking for anything special?", es: "¡Hola! Avísame si necesitas ayuda. ¿Buscas algo en especial?" },
    starters: ["How much is this?", "Do you have this in medium?", "Can I try it on?"],
  },
  {
    id: "smalltalk",
    emoji: "🌤️",
    title: { es: "Charla casual", en: "Small talk" },
    blurb: { es: "El clima, la semana, el trabajo", en: "Weather, weekends, work" },
    role: "a friendly neighbor chatting with {name}",
    setting:
      "You bump into {name} in the hallway. Make warm small talk — the weather, their day, their weekend, their work. Keep it light and short, and keep the conversation going with easy questions.",
    opener: { en: "Hey {name}! Beautiful day, isn't it? How's your day going?", es: "¡Hola, {name}! Bonito día, ¿no? ¿Cómo va tu día?" },
    starters: ["It's going well, thanks!", "The weather is beautiful today.", "How was your weekend?"],
  },
  {
    id: "plans",
    emoji: "📅",
    title: { es: "Hacer planes", en: "Making plans" },
    blurb: { es: "Invitar, aceptar, reagendar", en: "Invite, accept, reschedule" },
    role: "a friend inviting {name} to do something this week",
    setting:
      "You're {name}'s friend and you'd like to make plans with them this week — coffee, a walk, something easy. Invite them, agree on a day and time, and set it up. Keep it casual and warm.",
    opener: { en: "Hey! Are you free this week? Do you want to grab a coffee?", es: "¡Hola! ¿Estás libre esta semana? ¿Quieres que tomemos un café?" },
    starters: ["That sounds great!", "What time works for you?", "Sorry, I can't make it."],
  },
];

export function getScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
