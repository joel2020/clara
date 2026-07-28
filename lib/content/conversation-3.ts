import type { Lesson, PracticeItem } from "@/lib/db/types";

// Conversación track, part 3 — the B1–B2 units that keep a stronger learner
// moving: giving opinions, telling stories in the past, and sounding natural
// with everyday idioms and softeners. Same chunks-first format; orders continue
// from 40. This is what a learner who places above A2 gets first.

type ChunkRow = { text: string; ipa: string; meaning: string; hint: string };

function chunks(lessonId: string, rows: ChunkRow[]): PracticeItem[] {
  return rows.map((r, i) => ({
    id: `${lessonId}:${i + 1}`,
    text: r.text,
    ipa: r.ipa,
    mouthHint: r.hint,
    kind: "phrase" as const,
    categoryId: "conversation",
    phoneme: "chunk",
    meaning: r.meaning,
  }));
}

export const CONVERSATION_LESSONS_3: Lesson[] = [
  {
    id: "conv-opinions",
    title: "Opinions & agreeing",
    subtitle: "Opiniones y acuerdos",
    description: "Share what you think, agree, and disagree politely.",
    kind: "phrase",
    categoryIds: ["conversation"],
    track: "conversation",
    order: 41,
    intro: {
      summary: "Real conversations are people sharing opinions. A few natural openers let you say what you think and react to others without sounding rude.",
      whyTricky: "Spanish speakers often translate 'I think that…' too literally. Natives soften opinions ('I feel like…', 'to be honest') and disagree gently ('I see your point, but…').",
      how: ["Open with 'I think' or 'I feel like' before your idea.", "Agree fast: 'Totally', 'Exactly', 'Same here'.", "Disagree softly: 'I see your point, but…'."],
      exampleIds: ["conv-opinions:1", "conv-opinions:6"],
    },
    items: chunks("conv-opinions", [
      { text: "I feel like it depends.", ipa: "aɪ fil laɪk ɪt dɪˈpɛndz", meaning: "Siento que depende.", hint: "'feel like' suena 'fíil laik'; junta las palabras." },
      { text: "To be honest, I'm not sure.", ipa: "tə bi ˈɑnɪst aɪm nɑt ʃʊr", meaning: "Para ser honesta, no estoy segura.", hint: "'honest' es muda la h: 'ánest'." },
      { text: "That's a good point.", ipa: "ðæts ə ɡʊd pɔɪnt", meaning: "Es un buen punto.", hint: "'That's' con la lengua entre los dientes." },
      { text: "I totally agree with you.", ipa: "aɪ ˈtoʊtəli əˈɡri wɪθ ju", meaning: "Estoy totalmente de acuerdo contigo.", hint: "'totally' = 'tóurali' con la t suave americana." },
      { text: "I see your point, but…", ipa: "aɪ si jʊr pɔɪnt bʌt", meaning: "Entiendo tu punto, pero…", hint: "Baja el tono en 'but' para suavizar." },
      { text: "It's not a big deal.", ipa: "ɪts nɑt ə bɪɡ dil", meaning: "No es gran cosa.", hint: "'big deal' es una frase fija; dila rápido." },
      { text: "What do you think about it?", ipa: "wʌt du ju θɪŋk əˈbaʊt ɪt", meaning: "¿Tú qué piensas de eso?", hint: "'think': lengua entre los dientes y sopla — nunca t ni s." },
      { text: "Same here, honestly.", ipa: "seɪm hɪr ˈɑnɪstli", meaning: "Igual yo, la verdad.", hint: "'Same here' = 'seim jíir'." },
      { text: "I'd rather not, to be honest.", ipa: "aɪd ˈræðər nɑt tə bi ˈɑnɪst", meaning: "Prefiero que no, la verdad.", hint: "'I'd rather' = 'aid ráder'; muy común." },
      { text: "It makes sense to me.", ipa: "ɪt meɪks sɛns tə mi", meaning: "Tiene sentido para mí.", hint: "'makes sense' junto: 'meiks-sens'." },
    ]),
  },
  {
    id: "conv-stories",
    title: "Telling stories",
    subtitle: "Contar historias",
    description: "Talk about what happened — past events, in order.",
    kind: "phrase",
    categoryIds: ["conversation"],
    track: "conversation",
    order: 42,
    intro: {
      summary: "Being conversational means telling little stories: what you did, what happened. Connectors ('so', 'then', 'anyway') hold a story together.",
      whyTricky: "The past tense endings blur in fast speech ('I was gonna', 'ended up'). And stories rely on linkers Spanish uses differently — 'so' for cause, 'anyway' to get back on track.",
      how: ["Set it up: 'So the other day…'.", "Link events: 'and then', 'so', 'after that'.", "Wrap up: 'and that was it' or 'anyway…'."],
      exampleIds: ["conv-stories:1", "conv-stories:5"],
    },
    items: chunks("conv-stories", [
      { text: "So the other day…", ipa: "soʊ ði ˈʌðər deɪ", meaning: "Entonces el otro día…", hint: "'the other' = 'di áder', junto y suave." },
      { text: "I was gonna call you.", ipa: "aɪ wʌz ˈɡɑnə kɔl ju", meaning: "Te iba a llamar.", hint: "'gonna' = going to; muy americano." },
      { text: "And then it got worse.", ipa: "ænd ðɛn ɪt ɡɑt wɜrs", meaning: "Y luego se puso peor.", hint: "'got worse' = 'gat uérs'." },
      { text: "We ended up staying home.", ipa: "wi ˈɛndɪd ʌp ˈsteɪɪŋ hoʊm", meaning: "Terminamos quedándonos en casa.", hint: "'ended up' = 'éndid ap'; expresa resultado." },
      { text: "It was such a long day.", ipa: "ɪt wʌz sʌtʃ ə lɔŋ deɪ", meaning: "Fue un día tan largo.", hint: "'such a' = 'sách a', enfatiza." },
      { text: "To make a long story short…", ipa: "tə meɪk ə lɔŋ ˈstɔri ʃɔrt", meaning: "Para no hacerte el cuento largo…", hint: "Frase fija; dila fluida, sin pausas." },
      { text: "You won't believe what happened.", ipa: "ju woʊnt bɪˈliv wʌt ˈhæpənd", meaning: "No vas a creer lo que pasó.", hint: "'won't' = 'uóunt', abre la boca redonda." },
      { text: "Anyway, it worked out.", ipa: "ˈɛniweɪ ɪt wɜrkt aʊt", meaning: "En fin, salió bien.", hint: "'worked out' = 'uérkt aut', resultado positivo." },
      { text: "That's when I realized…", ipa: "ðæts wɛn aɪ ˈriəˌlaɪzd", meaning: "Ahí fue cuando me di cuenta…", hint: "'realized' = 'ríalaizd', con z americana." },
      { text: "And that was pretty much it.", ipa: "ænd ðæt wʌz ˈprɪti mʌtʃ ɪt", meaning: "Y eso fue prácticamente todo.", hint: "'pretty much' = 'príri mach', cierra la historia." },
    ]),
  },
  {
    id: "conv-natural",
    title: "Sounding natural",
    subtitle: "Sonar natural",
    description: "Idioms and softeners that make you sound fluent.",
    kind: "phrase",
    categoryIds: ["conversation"],
    track: "conversation",
    order: 43,
    intro: {
      summary: "At B2, it's not about more words — it's about the natural ones: idioms and softeners that make English flow instead of sounding translated.",
      whyTricky: "These are set phrases you can't build word by word ('no worries', 'I'm down', 'my bad'). Learn them as whole chunks and drop them in.",
      how: ["Treat each as one unit — don't translate word for word.", "Use them to react ('for sure', 'no worries').", "Soften requests ('would you mind…')."],
      exampleIds: ["conv-natural:2", "conv-natural:7"],
    },
    items: chunks("conv-natural", [
      { text: "No worries at all.", ipa: "noʊ ˈwɜriz ət ɔl", meaning: "No te preocupes para nada.", hint: "'worries' = 'uéris'; muy usado, relajado." },
      { text: "I'm down, for sure.", ipa: "aɪm daʊn fər ʃʊr", meaning: "Me apunto, claro que sí.", hint: "'I'm down' = estoy dispuesto; 'for sure' = 'fer shúr'." },
      { text: "My bad, I forgot.", ipa: "maɪ bæd aɪ fərˈɡɑt", meaning: "Culpa mía, se me olvidó.", hint: "'My bad' = mi error; súper informal." },
      { text: "It is what it is.", ipa: "ɪt ɪz wʌt ɪt ɪz", meaning: "Es lo que hay.", hint: "Frase fija; ritmo parejo, sin pausas." },
      { text: "Let's play it by ear.", ipa: "lɛts pleɪ ɪt baɪ ɪr", meaning: "Vemos sobre la marcha.", hint: "'by ear' = 'bai íir'; no es literal." },
      { text: "I'll keep you posted.", ipa: "aɪl kip ju ˈpoʊstɪd", meaning: "Te mantengo al tanto.", hint: "'posted' = 'póustid'; te aviso." },
      { text: "Would you mind helping me?", ipa: "wʊd ju maɪnd ˈhɛlpɪŋ mi", meaning: "¿Te importaría ayudarme?", hint: "'Would you mind' suaviza el pedido." },
      { text: "That works for me.", ipa: "ðæt wɜrks fər mi", meaning: "Eso me sirve.", hint: "'works for me' = me viene bien." },
      { text: "I'm just kidding.", ipa: "aɪm dʒʌst ˈkɪdɪŋ", meaning: "Solo estoy bromeando.", hint: "'kidding' = 'kírin' con t suave." },
      { text: "Take your time, no rush.", ipa: "teɪk jʊr taɪm noʊ rʌʃ", meaning: "Tómate tu tiempo, sin afán.", hint: "'no rush' = 'nou rash'; tranquiliza." },
    ]),
  },
];
