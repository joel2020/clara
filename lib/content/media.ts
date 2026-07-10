// The media zone: real American English through official YouTube embeds.
// Clara never downloads or reproduces protected video/lyrics; it layers a short
// listening + speaking activity around the creator's own player.

export type MediaKind = "practice" | "song" | "trailer";

export interface MediaItem {
  id: string; // YouTube video id
  kind: MediaKind;
  title: string;
  by: string;
  blurb: { es: string; en: string };
  /** Words or short chunks to catch while watching. */
  focusWords: string[];
  /** Optional speak-back prompts for a real-world conversation video. */
  speakBack?: string[];
}

export const MEDIA_ITEMS: MediaItem[] = [
  // ── Mira y habla: real-world American English ──
  {
    id: "Eps9alVTEHg",
    kind: "practice",
    title: "Speak with me",
    by: "Speak English With Vanessa",
    blurb: {
      es: "Empieza con inglés de la vida real. Mira un pedacito, caza las frases y repítelas como si estuvieras conversando.",
      en: "Start with real-life English. Watch a little, catch the phrases, then say them like you are in the conversation.",
    },
    focusWords: ["hello", "today", "good", "English", "practice"],
    speakBack: ["How's it going?", "I'm doing well.", "What about you?"],
  },
  {
    id: "TfVuXmDzkwc",
    kind: "practice",
    title: "Talk about daily life",
    by: "Speak English With Vanessa",
    blurb: {
      es: "Conversación sencilla sobre el día a día. Perfecta para responder sin traducir palabra por palabra.",
      en: "A simple daily-life conversation. Perfect for answering without translating word by word.",
    },
    focusWords: ["morning", "work", "home", "family", "weekend"],
    speakBack: ["My day was good.", "I work from home.", "What did you do today?"],
  },
  {
    id: "vkyUojDJmWM",
    kind: "practice",
    title: "Daily-life conversations",
    by: "Speak English With Vanessa",
    blurb: {
      es: "Guárdalo para repetir conversaciones reales: café, planes, trabajo y amigos.",
      en: "Save this for repeating real conversations: coffee, plans, work, and friends.",
    },
    focusWords: ["coffee", "plans", "friends", "sure", "sounds good"],
    speakBack: ["That sounds good.", "I'd like a coffee.", "Let's make a plan."],
  },

  // ── Música ──
  {
    id: "eVli-tstM5E",
    kind: "song",
    title: "Espresso",
    by: "Sabrina Carpenter",
    blurb: { es: "El hit del verano — inglés americano rapidito y juguetón.", en: "The summer hit — fast, playful American English." },
    focusWords: ["espresso", "sweet", "morning", "working", "late"],
  },
  {
    id: "b1kbLwvqugk",
    kind: "song",
    title: "Anti-Hero",
    by: "Taylor Swift",
    blurb: { es: "Taylor pronuncia clarísimo — perfecta para el oído.", en: "Taylor's diction is crystal clear — great ear training." },
    focusWords: ["hero", "problem", "me", "everybody", "hi"],
  },
  {
    id: "weRHyjj34ZE",
    kind: "song",
    title: "Whenever, Wherever",
    by: "Shakira",
    blurb: { es: "Nuestra barranquillera cantando en inglés — orgullo colombiano.", en: "Colombia's own Shakira singing in English." },
    focusWords: ["whenever", "wherever", "together", "mountains", "feet"],
  },
  {
    id: "cW8VLC9nnTo",
    kind: "song",
    title: "What Was I Made For?",
    by: "Billie Eilish",
    blurb: { es: "Lenta y suave — ideal para escuchar cada palabra.", en: "Slow and soft — you can catch every word." },
    focusWords: ["made", "real", "happy", "think", "feel"],
  },
  {
    id: "gNi_6U5Pm_o",
    kind: "song",
    title: "good 4 u",
    by: "Olivia Rodrigo",
    blurb: { es: "Inglés joven y real, con actitud.", en: "Young, real English — with attitude." },
    focusWords: ["good", "happy", "baby", "alone", "like"],
  },
  {
    id: "CevxZvSJLk8",
    kind: "song",
    title: "Roar",
    by: "Katy Perry",
    blurb: { es: "Un himno para cantar a gritos — y aprender.", en: "An anthem to belt out — and learn." },
    focusWords: ["roar", "fire", "champion", "louder", "tiger"],
  },

  // ── Cine ──
  {
    id: "LEjhY15eCx0",
    kind: "trailer",
    title: "Inside Out 2",
    by: "Pixar",
    blurb: { es: "Las emociones hablan un inglés clarito y expresivo.", en: "The emotions speak clear, expressive English." },
    focusWords: ["joy", "feelings", "new", "ready", "emotions"],
  },
  {
    id: "6COmYeLsz4c",
    kind: "trailer",
    title: "Wicked",
    by: "Universal Pictures",
    blurb: { es: "Drama, magia y acentos americanos de teatro.", en: "Drama, magic, and theatrical American voices." },
    focusWords: ["good", "magic", "friend", "change", "power"],
  },
  {
    id: "hDZ7y8RP5HE",
    kind: "trailer",
    title: "Moana 2",
    by: "Disney Animation",
    blurb: { es: "Aventura en el mar — vocabulario de viaje y naturaleza.", en: "Ocean adventure — travel and nature vocabulary." },
    focusWords: ["ocean", "together", "far", "island", "home"],
  },
  {
    id: "pBk4NYhWNMM",
    kind: "trailer",
    title: "Barbie",
    by: "Warner Bros.",
    blurb: { es: "Inglés pop, irónico y muy citado — cultura actual.", en: "Pop, ironic, endlessly quoted — current culture." },
    focusWords: ["perfect", "world", "day", "best", "pink"],
  },
];

export function mediaByKind(kind: MediaKind): MediaItem[] {
  return MEDIA_ITEMS.filter((m) => m.kind === kind);
}

export function youtubeThumb(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

export function youtubeEmbed(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}`;
}
