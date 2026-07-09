// The media zone: real American English through OFFICIAL YouTube embeds —
// studio trailers and artists' own music videos. Playback happens in YouTube's
// player (rights and ads stay with the owner); Clara adds the learning layer
// around it: a word-hunt listening activity per video. We never display lyrics
// or clip/download anything — single focus WORDS are the scaffold, which keeps
// the feature firmly on the right side of copyright.
//
// Every id below is validated against YouTube's oEmbed endpoint (see the
// commit that added it) — official channels only.

export type MediaKind = "song" | "trailer";

export interface MediaItem {
  id: string; // youtube video id
  kind: MediaKind;
  title: string;
  by: string; // artist or studio
  blurb: { es: string; en: string };
  /** Single common words to hunt for while listening — tap when you hear one. */
  focusWords: string[];
}

export const MEDIA_ITEMS: MediaItem[] = [
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
    blurb: { es: "Un himno para cantar a gritos — y aprender.", en: "An anthem to belt out — and learn from." },
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
  // Privacy-enhanced host; playback and rights stay with YouTube/the owner.
  return `https://www.youtube-nocookie.com/embed/${id}`;
}
