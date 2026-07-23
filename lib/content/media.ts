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
  /** APP-AUTHORED practical phrase tied to the video's theme (NOT a quote/lyric)
   *  — she shadows it in the "Say it" step. Ours, so it's copyright-clean. */
  sayIt?: { text: string; meaning: string };
  /** A tiny Spanish speaking task to use the phrase for real ("Use it"). */
  useIt?: { es: string; en: string };
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
    sayIt: { text: "Can I get an iced coffee?", meaning: "¿Me das un café frío?" },
    useIt: { es: "Pide tu bebida favorita en inglés.", en: "Order your favorite drink in English." },
  },
  {
    id: "b1kbLwvqugk",
    kind: "song",
    title: "Anti-Hero",
    by: "Taylor Swift",
    blurb: { es: "Taylor pronuncia clarísimo — perfecta para el oído.", en: "Taylor's diction is crystal clear — great ear training." },
    focusWords: ["hero", "problem", "me", "everybody", "hi"],
    sayIt: { text: "It's not you, it's me.", meaning: "No eres tú, soy yo." },
    useIt: { es: "Cuéntale algo sobre ti a alguien.", en: "Tell someone something about yourself." },
  },
  {
    id: "weRHyjj34ZE",
    kind: "song",
    title: "Whenever, Wherever",
    by: "Shakira",
    blurb: { es: "Nuestra barranquillera cantando en inglés — orgullo colombiano.", en: "Colombia's own Shakira singing in English." },
    focusWords: ["whenever", "wherever", "together", "mountains", "feet"],
    sayIt: { text: "I'll go wherever you go.", meaning: "Voy a donde tú vayas." },
    useIt: { es: "Invita a alguien a un plan.", en: "Invite someone to do something." },
  },
  {
    id: "cW8VLC9nnTo",
    kind: "song",
    title: "What Was I Made For?",
    by: "Billie Eilish",
    blurb: { es: "Lenta y suave — ideal para escuchar cada palabra.", en: "Slow and soft — you can catch every word." },
    focusWords: ["made", "real", "happy", "think", "feel"],
    sayIt: { text: "How do you really feel?", meaning: "¿Cómo te sientes de verdad?" },
    useIt: { es: "Pregúntale a alguien cómo está.", en: "Ask someone how they're doing." },
  },
  {
    id: "gNi_6U5Pm_o",
    kind: "song",
    title: "good 4 u",
    by: "Olivia Rodrigo",
    blurb: { es: "Inglés joven y real, con actitud.", en: "Young, real English — with attitude." },
    focusWords: ["good", "happy", "baby", "alone", "like"],
    sayIt: { text: "I'm happy for you.", meaning: "Me alegro por ti." },
    useIt: { es: "Felicita a alguien por algo bueno.", en: "Congratulate someone." },
  },
  {
    id: "CevxZvSJLk8",
    kind: "song",
    title: "Roar",
    by: "Katy Perry",
    blurb: { es: "Un himno para cantar a gritos — y aprender.", en: "An anthem to belt out — and learn from." },
    focusWords: ["roar", "fire", "champion", "louder", "tiger"],
    sayIt: { text: "You've got this!", meaning: "¡Tú puedes!" },
    useIt: { es: "Anima a un amigo que está nervioso.", en: "Cheer up a nervous friend." },
  },

  // ── Cine ──
  {
    id: "LEjhY15eCx0",
    kind: "trailer",
    title: "Inside Out 2",
    by: "Pixar",
    blurb: { es: "Las emociones hablan un inglés clarito y expresivo.", en: "The emotions speak clear, expressive English." },
    focusWords: ["joy", "feelings", "new", "ready", "emotions"],
    sayIt: { text: "I'm feeling a little nervous.", meaning: "Estoy un poco nervioso/a." },
    useIt: { es: "Di cómo te sientes hoy.", en: "Say how you feel today." },
  },
  {
    id: "6COmYeLsz4c",
    kind: "trailer",
    title: "Wicked",
    by: "Universal Pictures",
    blurb: { es: "Drama, magia y acentos americanos de teatro.", en: "Drama, magic, and theatrical American voices." },
    focusWords: ["good", "magic", "friend", "change", "power"],
    sayIt: { text: "You're a really good friend.", meaning: "Eres muy buen amigo/a." },
    useIt: { es: "Dile algo lindo a un amigo.", en: "Say something kind to a friend." },
  },
  {
    id: "hDZ7y8RP5HE",
    kind: "trailer",
    title: "Moana 2",
    by: "Disney Animation",
    blurb: { es: "Aventura en el mar — vocabulario de viaje y naturaleza.", en: "Ocean adventure — travel and nature vocabulary." },
    focusWords: ["ocean", "together", "far", "island", "home"],
    sayIt: { text: "Let's go on an adventure.", meaning: "Vamos a una aventura." },
    useIt: { es: "Propón un viaje o un plan divertido.", en: "Suggest a trip or a fun plan." },
  },
  {
    id: "pBk4NYhWNMM",
    kind: "trailer",
    title: "Barbie",
    by: "Warner Bros.",
    blurb: { es: "Inglés pop, irónico y muy citado — cultura actual.", en: "Pop, ironic, endlessly quoted — current culture." },
    focusWords: ["perfect", "world", "day", "best", "pink"],
    sayIt: { text: "Today's gonna be a great day.", meaning: "Hoy va a ser un gran día." },
    useIt: { es: "Di algo positivo sobre tu día.", en: "Say something positive about your day." },
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
