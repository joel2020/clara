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
];

/** Only scenes whose every line resolves to a real curriculum item. */
export const DUETS: Duet[] = DUETS_RAW.filter((d) => d.lines.every((l) => ITEM_BY_ID.has(l.itemId)));

export function duetItem(line: DuetLine): PracticeItem {
  return ITEM_BY_ID.get(line.itemId) as PracticeItem;
}
