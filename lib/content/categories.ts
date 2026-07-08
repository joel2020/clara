import type { SoundCategory } from "@/lib/db/types";

// The contrast sets Spanish speakers most struggle with. Each becomes a row on
// the Weak Sounds dashboard. Order here is the suggested learning order.

export const CATEGORIES: SoundCategory[] = [
  {
    id: "i-vs-ii",
    label: "Short i vs Long ee",
    symbols: "/ɪ/ vs /iː/",
    blurb: "Spanish has one 'i'. English splits it in two — ship vs sheep. Mixing them up changes the word.",
  },
  {
    id: "flap-t",
    label: "The American T",
    symbols: "t → soft d",
    blurb: "Between vowels, Americans turn t into a quick soft d — 'water' is 'wader', 'better' is 'bedder'. The most American sound there is.",
  },
  {
    id: "american-r",
    label: "The American R",
    symbols: "/ɹ/",
    blurb: "American English pronounces every R — car, hard, sister. Curl the tongue back and never drop it.",
  },
  {
    id: "b-vs-v",
    label: "B vs V",
    symbols: "/b/ vs /v/",
    blurb: "In Spanish, b and v sound the same. In English, v needs your teeth on your lip — berry vs very.",
  },
  {
    id: "dj-vs-y",
    label: "J vs Y",
    symbols: "/dʒ/ vs /j/",
    blurb: "The English 'j' is hard and buzzy; 'y' is soft. Jail vs Yale, jet vs yet.",
  },
  {
    id: "th",
    label: "The TH sounds",
    symbols: "/θ/ and /ð/",
    blurb: "No TH in Spanish, so it becomes t, d, or s. Put your tongue between your teeth — think, this.",
  },
  {
    id: "h",
    label: "The H sound",
    symbols: "/h/",
    blurb: "Spanish h is silent and Spanish j is harsh. English h is a soft breath — and sometimes silent (hour).",
  },
  {
    id: "s-clusters",
    label: "S-cluster starts",
    symbols: "/s/ + consonant",
    blurb: "Spanish never starts words with 's' + consonant, so an 'e' sneaks in: 'espeak'. Start clean on the s.",
  },
  {
    id: "ed-endings",
    label: "-ed endings",
    symbols: "/t/ /d/ /ɪd/",
    blurb: "Past-tense -ed has three sounds. Only -ted/-ded adds a syllable — walked, played, wanted.",
  },
  {
    id: "final-clusters",
    label: "Final consonant clusters",
    symbols: "-sts, -sked, -lds",
    blurb: "Spanish words rarely end in stacked consonants, so endings get dropped. Say every one — texts, asked.",
  },
  {
    id: "schwa",
    label: "Schwa reduction",
    symbols: "/ə/",
    blurb: "English squashes unstressed vowels into a lazy 'uh'. It's the most common sound in English — about, banana.",
  },
  {
    id: "word-stress",
    label: "Word stress",
    symbols: "STRESS shifts",
    blurb: "English moves the stress and it changes meaning — PHOto vs photoGRAPHy, a REcord vs to reCORD.",
  },
  {
    id: "connected-speech",
    label: "Connected speech",
    symbols: "rhythm & flow",
    blurb: "Real sentences link words and ride a rhythm. Practice whole phrases, not just single words.",
  },
  {
    id: "conversation",
    label: "Conversation",
    symbols: "real life",
    blurb: "The chunks you actually say out in the world — greetings, ordering, directions, plans.",
  },
];

export const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));
