import { ITEM_BY_ID } from "@/lib/content/lessons";
import type { PracticeItem } from "@/lib/db/types";

// Dialogue duets: short two-person scenes composed ENTIRELY from existing
// curriculum phrases. Joel speaks his lines in his recorded voice; she speaks
// hers into the mic and gets scored through the normal practice pipeline —
// which means duet practice earns real SRS credit on real curriculum items.
// The bridge between shadowing (imitate) and /talk (improvise): scripted
// conversation, spoken aloud, both directions.

export interface DuetLine {
  speaker: "joel" | "her";
  itemId: string;
}

export interface Duet {
  id: string;
  emoji: string;
  title: { es: string; en: string };
  blurb: { es: string; en: string };
  lines: DuetLine[];
}

const DUETS_RAW: Duet[] = [
  {
    id: "meet",
    emoji: "👋",
    title: { es: "Nos conocemos", en: "First meeting" },
    blurb: { es: "Preséntate como en la vida real.", en: "Introduce yourself like in real life." },
    lines: [
      { speaker: "joel", itemId: "conv-greetings:1" }, // Hi, how are you?
      { speaker: "her", itemId: "conv-greetings:2" }, // I'm good, thanks. And you?
      { speaker: "joel", itemId: "conv-greetings:5" }, // Where are you from?
      { speaker: "her", itemId: "conv-greetings:6" }, // I'm from Colombia
      { speaker: "joel", itemId: "conv-smalltalk:7" }, // How was your weekend?
      { speaker: "her", itemId: "conv-smalltalk:8" }, // It was great, thanks for asking
    ],
  },
  {
    id: "cafe",
    emoji: "☕",
    title: { es: "Amigos en el café", en: "Friends at the café" },
    blurb: { es: "Pidan juntos, como dos amigos.", en: "Order together, like two friends." },
    lines: [
      { speaker: "joel", itemId: "conv-cafe:1" }, // A table for two, please
      { speaker: "her", itemId: "conv-cafe:3" }, // Can I have a coffee, please?
      { speaker: "joel", itemId: "conv-cafe:4" }, // I'd like the chicken
      { speaker: "her", itemId: "conv-cafe:6" }, // It's delicious
      { speaker: "joel", itemId: "conv-cafe:7" }, // Can we get the check, please?
      { speaker: "her", itemId: "conv-cafe:10" }, // Keep the change
    ],
  },
  {
    id: "hallway",
    emoji: "🌤️",
    title: { es: "Charla en el pasillo", en: "Hallway small talk" },
    blurb: { es: "La charla casual de todos los días.", en: "Everyday casual small talk." },
    lines: [
      { speaker: "joel", itemId: "conv-smalltalk:3" }, // What do you do for work?
      { speaker: "her", itemId: "conv-smalltalk:4" }, // I work from home
      { speaker: "joel", itemId: "conv-smalltalk:5" }, // Do you have any plans for the weekend?
      { speaker: "her", itemId: "conv-smalltalk:6" }, // Not much, just relaxing
      { speaker: "joel", itemId: "conv-smalltalk:10" }, // Have a good day!
      { speaker: "her", itemId: "conv-greetings:10" }, // See you later!
    ],
  },
  {
    id: "plans",
    emoji: "📅",
    title: { es: "Hagamos planes", en: "Making plans" },
    blurb: { es: "Cuadra una cita para un café.", en: "Set up a coffee date." },
    lines: [
      { speaker: "joel", itemId: "conv-plans:2" }, // Do you want to grab a coffee?
      { speaker: "her", itemId: "conv-plans:3" }, // That sounds great
      { speaker: "joel", itemId: "conv-plans:4" }, // What time works for you?
      { speaker: "her", itemId: "conv-plans:5" }, // Let's meet at seven
      { speaker: "joel", itemId: "conv-plans:8" }, // I'll text you later
      { speaker: "her", itemId: "conv-smalltalk:10" }, // Have a good day!
    ],
  },
  {
    id: "american",
    emoji: "🇺🇸",
    title: { es: "Súper americano", en: "Super American" },
    blurb: { es: "Gonna, wanna, to go — el inglés de la calle.", en: "Gonna, wanna, to go — street English." },
    lines: [
      { speaker: "joel", itemId: "conv-american:4" }, // Do you wanna come?
      { speaker: "her", itemId: "conv-american:9" }, // Sounds good!
      { speaker: "joel", itemId: "conv-american:8" }, // For here or to go?
      { speaker: "her", itemId: "conv-cafe:9" }, // To go, please
      { speaker: "joel", itemId: "conv-american:7" }, // Gimme a second
      { speaker: "her", itemId: "conv-american:10" }, // No worries
    ],
  },
  {
    id: "shopping",
    emoji: "🛍️",
    title: { es: "De compras", en: "Shopping trip" },
    blurb: { es: "Dos amigas de compras — precios y decisiones.", en: "Two friends shopping — prices and decisions." },
    lines: [
      { speaker: "joel", itemId: "conv-shopping:1" }, // How much is this?
      { speaker: "her", itemId: "conv-shopping:2" }, // That's too expensive
      { speaker: "joel", itemId: "conv-shopping:4" }, // Can I try it on?
      { speaker: "her", itemId: "conv-american:9" }, // Sounds good!
      { speaker: "joel", itemId: "conv-shopping:6" }, // I'll take it
      { speaker: "her", itemId: "conv-cafe:10" }, // Keep the change
    ],
  },
  {
    id: "casual",
    emoji: "🤙",
    title: { es: "Casual total", en: "Totally casual" },
    blurb: { es: "El inglés de la calle: dunno, wanna, see ya.", en: "Street English: dunno, wanna, see ya." },
    lines: [
      { speaker: "joel", itemId: "conv-american-2:11" }, // What's the plan?
      { speaker: "her", itemId: "conv-american-2:2" }, // I dunno
      { speaker: "joel", itemId: "conv-american:4" }, // Do you wanna come?
      { speaker: "her", itemId: "conv-american-2:9" }, // I'm down
      { speaker: "joel", itemId: "conv-american:3" }, // I'm gonna go
      { speaker: "her", itemId: "conv-american-2:12" }, // See ya!
    ],
  },
  {
    id: "tourist",
    emoji: "🗺️",
    title: { es: "Turista en apuros", en: "Tourist in trouble" },
    blurb: { es: "Tú preguntas el camino — Joel te guía.", en: "You ask the way — Joel guides you." },
    lines: [
      { speaker: "her", itemId: "conv-directions:2" }, // How do I get to the airport?
      { speaker: "joel", itemId: "conv-directions:4" }, // Turn left at the corner
      { speaker: "her", itemId: "conv-directions:3" }, // Is it far from here?
      { speaker: "joel", itemId: "conv-directions:5" }, // It's next to the bank
      { speaker: "her", itemId: "conv-american:12" }, // Awesome, thanks!
      { speaker: "joel", itemId: "conv-american:11" }, // You got it
    ],
  },
];

/** Only scenes whose every line resolves to a real curriculum item. */
export const DUETS: Duet[] = DUETS_RAW.filter((d) => d.lines.every((l) => ITEM_BY_ID.has(l.itemId)));

export function duetItem(line: DuetLine): PracticeItem {
  return ITEM_BY_ID.get(line.itemId) as PracticeItem;
}
