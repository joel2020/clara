// Spanish coaching content — the instruction layer for beginners, keyed by the
// same ids as the English content in lessons.ts / categories.ts. The practice
// TARGETS stay English; everything that teaches is available here in Spanish.
// Lookups fall back to English when a key is missing, so partial coverage can
// never break the app.

import type { LessonIntro } from "@/lib/db/types";

// ── Mouth hints / rhythm tips, by practice-item id ──────────────────────────

const SHORT_I_ES = "Relaja los labios y la mandíbula. Corta y rapidita, casi perezosa. No sonrías.";
const LONG_E_ES = "Sonríe ancho, estira los labios hacia atrás, lengua arriba. Alárgala: iiii.";
const FLAP_ES = "Entre dos vocales, la T no es dura: tócala una vez y sale como una d suave y rápida. 'water' → 'GUA-der'.";
const AMER_R_ES = "Curva la punta de la lengua hacia arriba y atrás sin tocar nada, y pronuncia TODAS las R — hasta al final. 'car', nunca 'ca'.";

export const HINTS_ES: Record<string, string> = {
  // The American T (flap)
  "flap-t:water": FLAP_ES,
  "flap-t:better": FLAP_ES,
  "flap-t:letter": FLAP_ES,
  "flap-t:city": FLAP_ES,
  "flap-t:party": FLAP_ES,
  "flap-t:later": FLAP_ES,
  "flap-t:pretty": FLAP_ES,
  "flap-t:daughter": FLAP_ES,
  "flap-t:computer": FLAP_ES,
  "flap-t:thirty": FLAP_ES,
  // The American R (rhotic)
  "american-r:car": AMER_R_ES,
  "american-r:hard": AMER_R_ES,
  "american-r:work": AMER_R_ES,
  "american-r:bird": AMER_R_ES,
  "american-r:world": AMER_R_ES,
  "american-r:first": AMER_R_ES,
  "american-r:sister": AMER_R_ES,
  "american-r:teacher": AMER_R_ES,
  "american-r:morning": AMER_R_ES,
  "american-r:girl": AMER_R_ES,
  // /ɪ/ vs /iː/
  "i-vs-ii:ship": SHORT_I_ES,
  "i-vs-ii:sheep": LONG_E_ES,
  "i-vs-ii:bit": SHORT_I_ES,
  "i-vs-ii:beat": LONG_E_ES,
  "i-vs-ii:fill": SHORT_I_ES,
  "i-vs-ii:feel": LONG_E_ES,
  "i-vs-ii:live": SHORT_I_ES,
  "i-vs-ii:leave": LONG_E_ES,
  "i-vs-ii:sit": SHORT_I_ES,
  "i-vs-ii:seat": LONG_E_ES,
  "i-vs-ii:it": SHORT_I_ES,
  "i-vs-ii:eat": LONG_E_ES,
  "i-vs-ii:phrase-1": "I corta y relajada en 'sit', ii larga y sonriente en 'seat'.",
  "i-vs-ii:phrase-2": "I corta y perezosa en 'live', y estira la de 'sea'.",
  "i-vs-ii:phrase-3": "Dos íes cortas (did, ship) y dos largas (see, sheep).",

  // /b/ vs /v/
  "b-vs-v:berry": "Junta los dos labios y suéltalos con un pequeño pop.",
  "b-vs-v:very": "Dientes de arriba sobre el labio de abajo, empuja el aire — vibra.",
  "b-vs-v:ban": "Labios juntos, suelta con la voz encendida.",
  "b-vs-v:van": "Dientes al labio, vibra, y abre hacia la vocal.",
  "b-vs-v:boat": "Los dos labios se juntan y explotan — sin dientes.",
  "b-vs-v:vote": "Dientes al labio primero — siente el zumbido: vvv.",
  "b-vs-v:base": "Labios juntos para empezar.",
  "b-vs-v:vase": "Dientes al labio para empezar — vvv.",
  "b-vs-v:bat": "Explota los labios para la b.",
  "b-vs-v:vat": "Haz vibrar los dientes sobre el labio para la v.",
  "b-vs-v:phrase-1": "Dientes al labio en 'van' y 'very'; los labios explotan en 'big'.",
  "b-vs-v:phrase-2": "Empieza 'vote' con zumbido y 'berry' con pop de labios.",
  "b-vs-v:phrase-3": "b, v, b — siente el cambio cada vez.",

  // /dʒ/ vs /j/
  "dj-vs-y:jail": "La lengua presiona el paladar y suelta con una j vibrante.",
  "dj-vs-y:yale": "Lengua suave y baja — desliza 'yy' hacia la vocal.",
  "dj-vs-y:jet": "J dura: un golpecito de zumbido al empezar.",
  "dj-vs-y:yet": "Y suave: sin zumbido, solo desliza.",
  "dj-vs-y:joke": "J vibrante para empezar.",
  "dj-vs-y:yolk": "Y suave para empezar — como 'yo'.",
  "dj-vs-y:jam": "Presiona y suelta una j dura.",
  "dj-vs-y:yam": "Desliza una y suave.",
  "dj-vs-y:jello": "Empieza duro y vibrante.",
  "dj-vs-y:yellow": "Empieza suave, deslizando.",
  "dj-vs-y:phrase-1": "J dura y vibrante en 'jet', deslizada suave en 'yet'.",
  "dj-vs-y:phrase-2": "Desliza 'yellow', haz vibrar 'jello'.",
  "dj-vs-y:phrase-3": "Dos jotas vibrantes, dos yes suaves.",

  // TH
  "th:think": "Punta de la lengua entre los dientes, sopla aire — sin voz.",
  "th:three": "TH y luego desliza a la r — la lengua empieza entre los dientes.",
  "th:both": "Termina con la lengua entre los dientes, solo aire.",
  "th:thank": "TH de puro aire al empezar — ni 't' ni 's'.",
  "th:this": "Lengua entre los dientes, pero ENCIENDE la voz — vibra.",
  "th:the": "TH suave y vibrante, lengua apenas entre los dientes.",
  "th:mother": "TH con voz en el medio — vibra entre los dientes.",
  "th:breathe": "Termina con voz — siente el zumbido en la punta de la lengua.",
  "th:sink": "La lengua se queda detrás de los dientes — un siseo.",
  "th:thin": "Lengua entre los dientes, aire suave.",
  "th:tin": "La lengua toca detrás de los dientes — una t seca.",
  "th:phrase-1": "Lengua entre los dientes dos veces: aire en 'think', voz en 'this'.",
  "th:phrase-2": "Cada TH con la lengua afuera. Ni t, ni s.",
  "th:phrase-3": "Termina 'breathe' con vibración y empieza 'think' con aire.",

  // H
  "h:hat": "Un soplido suave y luego la vocal. Suave, sin raspar.",
  "h:house": "Sopla suavecito al empezar — como empañar un espejo.",
  "h:behind": "Mantén la h suave en el medio: be-HIND.",
  "h:hello": "Soplido ligero en la h, acento en 'lo'.",
  "h:happy": "Empieza con soplido suave, no con raspado de garganta.",
  "h:ahead": "H suave en el medio: a-HEAD.",
  "h:hour": "¡La h es MUDA! Empieza en la vocal: 'our'.",
  "h:honest": "H muda — di 'onist'.",
  "h:honor": "H muda — di 'onor'.",
  "h:phrase-1": "Cuatro soplidos suaves — sin raspar la garganta.",
  "h:phrase-2": "Sopla 'hope' y 'he' — pero 'honest' NO lleva h.",
  "h:phrase-3": "Haches suaves, y una muda en 'hour'.",

  // S-clusters
  "s-clusters:speak": "Sisea la s primero y pasa directo a la p. Sin 'e' antes.",
  "s-clusters:school": "Empieza en la s — 'sssk', no 'esk'.",
  "s-clusters:student": "Arranca con la s, luego la t. Inicio limpio.",
  "s-clusters:spain": "s y p de inmediato — sin vocal adelante.",
  "s-clusters:street": "Tres sonidos seguidos: s-t-r. Empieza siseando.",
  "s-clusters:stop": "Empieza en la s, no 'estop'.",
  "s-clusters:start": "Sisea hasta la t — inicio limpio.",
  "s-clusters:study": "s-t juntas al frente.",
  "s-clusters:spanish": "Irónicamente — dilo limpio: 'sp', no 'esp'.",
  "s-clusters:special": "Arranca en la s y desliza a la p.",
  "s-clusters:phrase-1": "Cuatro inicios limpios con s. Sin 'e' antes de ninguno.",
  "s-clusters:phrase-2": "Sisea directo a la t — stop, street.",
  "s-clusters:phrase-3": "st, st, sp — empieza cada uno con el siseo.",

  // -ed endings
  "ed-endings:walked": "Termina en una t rapidita: 'walkt'. Sin sílaba extra.",
  "ed-endings:helped": "Solo agrega la t: 'helpt'.",
  "ed-endings:asked": "'askt' — s, k, t, todas al final.",
  "ed-endings:watched": "'watcht' — termina en t seca.",
  "ed-endings:played": "D suave al final: 'playd'. Una sola sílaba.",
  "ed-endings:lived": "'livd' — termina con d sonora.",
  "ed-endings:called": "'cold' con d suave al final.",
  "ed-endings:used": "'yuzd' — d sonora al final.",
  "ed-endings:wanted": "Agrega una sílaba COMPLETA: 'want-id'.",
  "ed-endings:needed": "Sílaba extra: 'need-id'.",
  "ed-endings:started": "'start-id' — se oye el -id.",
  "ed-endings:decided": "'decide-id' — sílaba extra completa.",
  "ed-endings:phrase-1": "'walkt', 'talkt' — t rápida, sin sílaba extra.",
  "ed-endings:phrase-2": "Las dos llevan sílaba extra: want-id, need-id.",
  "ed-endings:phrase-3": "D suave en 'played', -id completo en 'decided'.",

  // Final clusters
  "final-clusters:texts": "Dilo todo: 'teksts'. No botes la última t.",
  "final-clusters:asked": "'askt' — s, k, t hasta el final.",
  "final-clusters:world": "Termina la l y la d: 'wor-ld'.",
  "final-clusters:films": "l, m, z aterrizan todas: 'filmz'.",
  "final-clusters:helped": "l, p, t: 'helpt'.",
  "final-clusters:facts": "'fakts' — conserva la t final.",
  "final-clusters:desks": "s, k, s: 'desks'. No pares en 'desk'.",
  "final-clusters:months": "n, TH, s: 'munths'. Lengua afuera para el th.",
  "final-clusters:clothes": "TH con voz y luego z: 'clothez'.",
  "final-clusters:phrase-1": "Termina cada final: askt, teksts.",
  "final-clusters:phrase-2": "rld, tcht, lmz — aterriza cada consonante.",
  "final-clusters:phrase-3": "helpt y fakts — conserva la t final.",

  // Schwa
  "schwa:about": "El primer sonido es un 'a' chiquito y perezoso: 'a-BAUT'.",
  "schwa:banana": "Solo el medio es fuerte: 'ba-NA-na' con las débiles flojitas.",
  "schwa:the": "Antes de consonante es 'tha' flojito, no 'thi'.",
  "schwa:problem": "La segunda vocal se relaja: 'PROB-lam'.",
  "schwa:supply": "La primera sílaba es débil: 'sa-PLY'.",
  "schwa:again": "Empieza flojito: 'a-GUEN'.",
  "schwa:support": "'sa-PORT' — primera sílaba débil.",
  "schwa:around": "'a-RAUND' — relaja esa primera vocal.",
  "schwa:phrase-1": "Tres 'a' perezosas: the, a-, su-.",
  "schwa:phrase-2": "Relaja cada vocal débil — ba-NA-na, a-GUEN.",
  "schwa:phrase-3": "a-RAUND, sa-PORT — aplasta las sílabas débiles.",

  // Word stress
  "word-stress:photo": "Golpea la primera parte: FO-to.",
  "word-stress:photography": "El acento se mueve: fo-TO-gra-fi.",
  "word-stress:present": "Un regalo = PRE-sent (acento al inicio).",
  "word-stress:present-verb": "Presentar = pre-SENT (acento al final).",
  "word-stress:record": "Un disco = RE-cord (acento al inicio).",
  "word-stress:record-verb": "Grabar = re-CORD (acento al final).",
  "word-stress:object": "Un objeto = OB-ject (acento al inicio).",
  "word-stress:object-verb": "Objetar = ob-JECT (acento al final).",
  "word-stress:phrase-1": "Primero el verbo: re-CORD. Luego el sustantivo: RE-cord.",
  "word-stress:phrase-2": "pre-SENT (dar), PRE-sent (regalo).",
  "word-stress:phrase-3": "fo-TO-gra-fi, y luego FO-to — siente cómo se mueve el golpe.",

  // Connected speech
  "connected-speech:phrase-1": "Cambia limpio entre 's' y 'sh'. Ligero y fluido.",
  "connected-speech:phrase-2": "Une 'about it' en 'abau-tit'. TH suave en 'thinking'.",
  "connected-speech:phrase-3": "Lengua entre los dientes en cada TH. Lento primero, luego rápido.",
  "connected-speech:phrase-4": "Dientes al labio en 'very', labios juntos en las palabras con b.",
  "connected-speech:phrase-5": "Un soplido suave en cada h. No las botes.",
  "connected-speech:phrase-6": "Inglés natural: 'whatcha wanna do'. Relaja las palabras chiquitas.",
};

// ── Lesson intros (the Learn stage) ──────────────────────────────────────────

export const INTROS_ES: Record<string, LessonIntro> = {
  "i-vs-ii": {
    summary: "El inglés parte la 'i' del español en dos vocales distintas: una corta y relajada, otra larga y tensa.",
    whyTricky:
      "El español tiene una sola 'i', así que al principio 'ship' y 'sheep' suenan idénticas. En inglés son palabras diferentes — y confundirlas da pena rapidito.",
    how: [
      "La /ɪ/ corta — relaja labios y mandíbula por completo. Rapidita y perezosa. No sonrías.",
      "La /iː/ larga — sonríe ancho, labios hacia atrás, lengua arriba. Alárgala: iiii.",
      "Siéntelo: la cara floja para 'ship', apretada y sonriente para 'sheep'.",
    ],
    exampleIds: ["i-vs-ii:ship", "i-vs-ii:sheep", "i-vs-ii:live", "i-vs-ii:leave"],
  },
  "flap-t": {
    summary: "La T americana es EL sonido más gringo: entre dos vocales, la T (y la D) se vuelven una d suave y rápida.",
    whyTricky:
      "Los libros y el inglés británico mantienen la T dura, así que 'water' suena 'wa-TER'. Los americanos la tocan: 'GUA-der'. Si dices la T dura suenas tieso o extranjero; si no oyes ese toquecito, el inglés rápido se vuelve imposible de entender.",
    how: [
      "Busca una T (o D) entre dos vocales: wa-t-er, be-tt-er, ci-t-y.",
      "En vez de una T dura, toca una vez la encía detrás de los dientes — sale como una d suave y rápida.",
      "Ligera y veloz: 'water' → 'GUA-der', 'city' → 'SI-di', 'party' → 'PAR-di'.",
    ],
    exampleIds: ["flap-t:water", "flap-t:better", "flap-t:city", "flap-t:party"],
  },
  "american-r": {
    summary: "El inglés americano es rótico: se pronuncia TODA R, incluso al final de la palabra — car, hard, sister.",
    whyTricky:
      "La R del español es un toque o vibración con la punta de la lengua adelante. La R americana es al revés — la lengua se curva hacia atrás y no toca nada. Y a diferencia del británico, los americanos nunca se comen la R final.",
    how: [
      "Lleva la lengua arriba y atrás, con la punta apuntando al paladar — pero sin tocarlo.",
      "Redondea un poco los labios y deja que 'gruña' grave.",
      "Pronuncia la R también al FINAL: 'car', 'teacher', 'morning' — nunca 'ca' ni 'tícha'.",
    ],
    exampleIds: ["american-r:car", "american-r:work", "american-r:sister", "american-r:girl"],
  },
  "conv-american": {
    summary: "El inglés americano real no es el del libro: la gente dice 'gonna', 'wanna', 'gotta'. Apréndelos y sonarás natural — y por fin entenderás el inglés rápido.",
    whyTricky:
      "Los libros enseñan 'going to' y 'want to', pero ningún americano los dice completos al conversar. Si solo conoces las formas lentas, te congelas cuando escuchas las reales — y suenas a libro de texto.",
    how: [
      "Aprende la forma reducida como UN solo sonido: gonna, wanna, gotta, lemme, gimme.",
      "La T americana entre vocales es una d suave: 'gotta' = 'GA-da', 'you got it' = 'ya-GA-dit'.",
      "Mantén la R americana fuerte en todas partes: 'worries', 'here', 'for'.",
    ],
    exampleIds: ["conv-american:3", "conv-american:1"],
  },
  "conv-american-2": {
    summary: "Segunda ronda del inglés real de la calle: las frasecitas casuales que los amigos se dicen todo el día.",
    whyTricky:
      "Casi nunca salen en los libros, pero los americanos las usan sin parar — si no reconoces 'gotcha' o 'I dunno', media conversación casual se te escapa.",
    how: [
      "Aprende cada una como un solo sonido con un sentimiento, no palabra por palabra.",
      "'kinda' = kind of, 'dunno' = don't know, 'gotcha' = got you, 'ya' = you.",
      "Dilas rápido y relajado — pronunciarlas con cuidado las arruina.",
    ],
    exampleIds: ["conv-american-2:2", "conv-american-2:9"],
  },
  "b-vs-v": {
    summary: "En inglés, la b y la v son dos sonidos distintos hechos en lugares distintos de la boca.",
    whyTricky:
      "En español, b y v se pronuncian igual, así que 'berry' y 'very' se vuelven una sola palabra. Los gringos oyen la diferencia de inmediato.",
    how: [
      "Para /b/ — junta los dos labios y suéltalos con la voz encendida.",
      "Para /v/ — apoya los dientes de arriba en el labio de abajo y empuja el aire. Vibra.",
      "Mírate en un espejo: con la v se ven los dientes; con la b, solo labios.",
    ],
    exampleIds: ["b-vs-v:berry", "b-vs-v:very", "b-vs-v:boat", "b-vs-v:vote"],
  },
  "dj-vs-y": {
    summary: "La j del inglés es dura y vibrante; la y es un deslizado suave. El español queda en el medio — el inglés las separa.",
    whyTricky:
      "En Colombia solemos decir 'yo' con una j suavecita, así que 'jet' y 'yet' se mezclan. En inglés son sonidos y palabras distintas.",
    how: [
      "Para /dʒ/ — presiona la lengua contra el paladar y suelta con zumbido, como la g de 'gym'.",
      "Para /j/ — lengua relajada, solo desliza. Sin contacto, sin zumbido.",
      "Susúrralas: la j todavía hace fricción; la y es puro aire.",
    ],
    exampleIds: ["dj-vs-y:jet", "dj-vs-y:yet", "dj-vs-y:jail", "dj-vs-y:yale"],
  },
  th: {
    summary: "Los dos sonidos TH — el de puro aire /θ/ y el con voz /ð/ — necesitan la lengua entre los dientes.",
    whyTricky:
      "El español latino no tiene TH, así que sale t, d o s: 'tink', 'dis', 'sank you'. Poner la lengua entre los dientes se siente raro al principio — es normal, y es todo el truco.",
    how: [
      "Pon la punta de la lengua suavemente entre los dientes. Sí — que se vea.",
      "Para 'think': sopla solo aire. Sin voz.",
      "Para 'this': misma posición, pero enciende la voz para que vibre.",
      "Practica frente al espejo hasta que ver tu lengua se sienta normal.",
    ],
    exampleIds: ["th:think", "th:this", "th:three", "th:mother"],
  },
  h: {
    summary: "La h del inglés es un soplido suave — mucho más suave que la j del español — y a veces desaparece por completo.",
    whyTricky:
      "La h del español es muda y la j raspa la garganta. La h inglesa queda en el medio: un soplidito tibio, como empañar un espejo. Y en 'hour' y 'honest' sí es muda de verdad.",
    how: [
      "Exhala suave con la boca abierta — sin raspar, sin esfuerzo.",
      "Pega la vocal justo después del soplido: h-at, h-ouse.",
      "Apréndete las de h muda — hour, honest, honor — y empiézalas en la vocal.",
    ],
    exampleIds: ["h:hat", "h:house", "h:hour", "h:honest"],
  },
  "s-clusters": {
    summary: "En inglés las palabras pueden empezar con s + consonante — sin vocal adelante. Speak, no 'espeak'.",
    whyTricky:
      "El español nunca empieza una palabra con s + consonante (escuela, estudiante, España), así que la boca mete una 'e' solita. Los angloparlantes oyen esa sílaba extra al instante.",
    how: [
      "Empieza siseando la s: sssss.",
      "Mientras siseas, salta directo a la siguiente consonante: ssss-peak.",
      "Nada de vocal antes de la s. Si oyes una 'e', vuelve a empezar desde el siseo.",
    ],
    exampleIds: ["s-clusters:speak", "s-clusters:school", "s-clusters:spain", "s-clusters:street"],
  },
  "ed-endings": {
    summary: "El pasado con -ed tiene tres sonidos distintos — y solo uno agrega una sílaba.",
    whyTricky:
      "La escritura dice 'ed', y dan ganas de decir 'walk-ed' con sílaba completa siempre. El inglés solo lo hace después de t o d: wanted, needed.",
    how: [
      "Después de sonidos suaves (k, p, s, ch, f): el -ed es una /t/ rápida. walked → 'walkt'.",
      "Después de sonidos con voz (l, v, n, vocales): una /d/ suave. played → 'playd'.",
      "Solo después de t o d: sílaba extra completa /ɪd/. wanted → 'want-id'.",
    ],
    exampleIds: ["ed-endings:walked", "ed-endings:played", "ed-endings:wanted"],
  },
  "final-clusters": {
    summary: "El inglés amontona consonantes al final de las palabras — y todas cuentan.",
    whyTricky:
      "Las palabras en español terminan suave, casi siempre en vocal, n, s o r. Finales como 'texts' (k-s-t-s) parecen imposibles y se recortan a 'tex'. Pero botar finales cambia el sentido: ask no es asked.",
    how: [
      "Di la palabra despacio aterrizando cada consonante: te-k-s-t-s.",
      "Acelera poco a poco sin botar ninguna.",
      "Exagera la última consonante al practicar — al hablar normal saldrá perfecta.",
    ],
    exampleIds: ["final-clusters:texts", "final-clusters:asked", "final-clusters:world", "final-clusters:films"],
  },
  schwa: {
    summary: "La schwa — una 'a' chiquita y perezosa — es el sonido más común de todo el inglés.",
    whyTricky:
      "El español pronuncia cada vocal completa y clara. El inglés hace lo contrario: las vocales sin acento se aplastan en 'a'. Pronunciar todas las vocales completas es lo que más delata el acento.",
    how: [
      "Encuentra la sílaba fuerte y golpéala: ba-NA-na.",
      "Deja las demás vocales flojitas: ba-NA-na con las débiles casi mudas.",
      "La schwa es corta, central y sin esfuerzo — la boca casi ni se mueve.",
    ],
    exampleIds: ["schwa:about", "schwa:banana", "schwa:problem", "schwa:supply"],
  },
  "word-stress": {
    summary: "El inglés golpea una sílaba por palabra — y mover ese golpe puede cambiar el significado.",
    whyTricky:
      "El acento del español es predecible y hasta se marca con tilde. El del inglés es invisible y se mueve: FO-to se vuelve fo-TO-gra-fi, y RE-cord (disco) vs re-CORD (grabar) son palabras distintas.",
    how: [
      "Haz la sílaba fuerte más larga, más alta y más sonora.",
      "Aplasta las sílabas de alrededor (hola otra vez, schwa).",
      "En pares sustantivo/verbo: el sustantivo acentúa la PRIMERA sílaba, el verbo la SEGUNDA.",
    ],
    exampleIds: ["word-stress:photo", "word-stress:photography", "word-stress:record", "word-stress:record-verb"],
  },
  "conv-greetings": {
    summary: "El primer minuto de toda conversación usa las mismas frases. Hazlas automáticas y nunca te congelarás en el hola.",
    whyTricky:
      "El español saluda con una pregunta (¿cómo estás?); el inglés la devuelve rapidito: 'I'm good, thanks. And you?' El ritmo del intercambio es la habilidad, no las palabras.",
    how: [
      "Aprende cada frase como UN solo bloque de sonido, no palabra por palabra.",
      "Responde y devuelve: nunca solo 'I'm good' — siempre '...and you?'",
      "Dilas en voz alta hasta que tu boca responda antes que tu cerebro.",
    ],
    exampleIds: ["conv-greetings:1", "conv-greetings:4"],
  },
  "conv-cafe": {
    summary: "Pedir comida es la conversación más predecible del inglés — las mismas seis frases funcionan en cualquier café del mundo.",
    whyTricky:
      "El español pide con 'me das...' o 'quiero...'. El inglés lo suaviza todo: 'Can I have...?' y 'I'd like...' — la traducción literal suena grosera; los bloques corteses suenan nativos.",
    how: [
      "'Can I have...?' es tu llave maestra — pide lo que sea.",
      "'I'd like...' = 'quisiera'. La 'd es diminuta pero cortés.",
      "Termina casi todo con 'please' — el inglés lo espera.",
    ],
    exampleIds: ["conv-cafe:2", "conv-cafe:3"],
  },
  "conv-directions": {
    summary: "Preguntar el camino y entender la respuesta — la habilidad de supervivencia en cualquier ciudad.",
    whyTricky:
      "'Excuse me' abre toda pregunta a un desconocido — como 'disculpe', pero en inglés saltárselo suena brusco. Y las respuestas llegan rápido: left, right, next to, far.",
    how: [
      "Abre siempre con 'Excuse me...' — te compra un oyente amable.",
      "Aprende también las palabras de las respuestas: left, right, straight, next to, far.",
      "'How do I get to...?' funciona para llegar a cualquier lugar del planeta.",
    ],
    exampleIds: ["conv-directions:1", "conv-directions:2"],
  },
  "conv-shopping": {
    summary: "Hablar de compras es corto y transaccional — bloques perfectos para ganar confianza desde ya.",
    whyTricky:
      "'How much is this?' no tiene la forma del español (¿cuánto cuesta?), y las preguntas van con 'do you have...?' — el orden de la pregunta inglesa necesita práctica para sentirse natural.",
    how: [
      "'How much is this?' — señala y pregunta. Funciona en todas partes.",
      "'Do you have...?' = '¿tienen...?' — memorízalo como un bloque.",
      "Las tallas son fáciles: small, medium, large — dilas limpias.",
    ],
    exampleIds: ["conv-shopping:1", "conv-shopping:3"],
  },
  "conv-smalltalk": {
    summary: "El small talk es cómo los angloparlantes entran en confianza — preguntitas sobre el día, el finde, el clima.",
    whyTricky:
      "En español, la charla con desconocidos es opcional; en inglés se espera — el cajero, el mesero, todo el mundo. El truco es tener tres preguntas listas para que nunca se sienta como un examen.",
    how: [
      "Tus tres aperturas: 'How's your day going?', 'How was your weekend?', 'Any plans for the weekend?'",
      "Las respuestas, cortas y cálidas: 'It was great, thanks for asking.'",
      "Un cumplido siempre funciona: 'I love this song.'",
    ],
    exampleIds: ["conv-smalltalk:1", "conv-smalltalk:5"],
  },
  "conv-plans": {
    summary: "Invitar, aceptar, mover una cita — estos bloques manejan tu vida social en inglés.",
    whyTricky:
      "'Do you want to...?' se comprime a 'wanna' en la calle, y las horas usan 'at' (at seven) donde el español usa 'a las'. Patrones chiquitos, naturalidad grande.",
    how: [
      "'Do you want to grab a coffee?' — 'grab' lo hace casual y amistoso.",
      "Acepta con entusiasmo: 'That sounds great.'",
      "Cancela con gracia: 'Sorry, I can't make it. Can we do it another day?'",
    ],
    exampleIds: ["conv-plans:2", "conv-plans:3"],
  },
  "connected-speech": {
    summary: "El inglés real une las palabras y fluye con ritmo — se habla en olas, no palabra por palabra.",
    whyTricky:
      "El español le da el mismo tiempo a cada sílaba. El inglés estira las palabras fuertes y aplasta todo lo demás — por eso los nativos suenan 'rápido'. No es que hablen rápido; las palabras chiquitas son diminutas.",
    how: [
      "Encuentra las palabras grandes — sustantivos y verbos — y acentúa esas.",
      "Une el final de una palabra con la siguiente: 'about it' → 'abau-tit'.",
      "Marca un pulso constante en las palabras fuertes y deja que el resto ruede en medio.",
    ],
    exampleIds: ["connected-speech:phrase-2", "connected-speech:phrase-6"],
  },

  // ── Conversación, parte 2 ──
  "conv-numbers": {
    summary: "Los números están en todo lo real: precios, teléfonos, horas, direcciones. Con unos pocos patrones los dices casi todos.",
    whyTricky: "El 'teen' y el 'ty' (thirteen vs thirty) confunden a todos; el acento es la pista. Y los precios se dicen en dos números: 'five ninety-nine', no 'cinco punto noventa y nueve'.",
    how: ["Marca la diferencia: thir-TEEN vs THIR-ty.", "Precios = dólares + centavos: '$5.99' → 'five ninety-nine'.", "Pregunta 'How much?' por todo lo que quieras comprar."],
    exampleIds: ["conv-numbers:3", "conv-numbers:6"],
  },
  "conv-time": {
    summary: "Todo plan necesita una hora y un día. Estas frases te dejan poner una, pedir una y no llegar tarde.",
    whyTricky: "El inglés dice primero la hora y luego los minutos: 'three thirty'. Y 'What time?' no es 'When?' — la hora es el reloj, el día es el calendario.",
    how: ["Hora + minutos: 3:30 → 'three thirty'.", "'What time?' para el reloj, 'What day?' para el calendario.", "'At' para las horas, 'on' para los días: at 3, on Monday."],
    exampleIds: ["conv-time:1", "conv-time:4"],
  },
  "conv-family": {
    summary: "La gente pregunta por tu familia rapidísimo — así se pone cálida la conversación. Unas frases y presentas a todos los que quieres.",
    whyTricky: "El inglés usa mucho el posesivo: 'my husband', 'her sister'. Y para presentar a alguien que está ahí se dice 'this is...', no 'he is...'.",
    how: ["'This is my...' para presentar a alguien presente.", "'I have...' + número para cuántos.", "Rompe el hielo con 'Do you have kids?' — es charla normal."],
    exampleIds: ["conv-family:1", "conv-family:3"],
  },
  "conv-work": {
    summary: "'What do you do?' es de las primeras preguntas que hace un americano. Estas frases la responden y mantienen la charla del trabajo.",
    whyTricky: "'What do you do?' significa 'en qué trabajas', no 'qué estás haciendo'. Y dices 'I'm a...' + oficio (con 'a'): 'I'm a teacher', nunca 'I'm teacher'.",
    how: ["Responde 'What do you do?' con 'I'm a...' + oficio.", "No te comas el 'a': 'a nurse', 'an engineer'.", "'I work at...' + lugar, 'I work as...' + rol."],
    exampleIds: ["conv-work:1", "conv-work:2"],
  },
  "conv-transport": {
    summary: "Las ciudades se mueven en buses, trenes y apps. Estas frases te llevan a donde vas y te traen de vuelta.",
    whyTricky: "En EE. UU. hay palabras propias: 'subway' (no metro), 'the bus stop', 'a ride'. Y el transporte se 'takes' o 'catches', nunca 'coger' traducido literal.",
    how: ["'Take' o 'catch' el bus/tren — no 'coger'.", "Apps: 'I'll call an Uber.'", "'How do I get to...?' pregunta el camino a cualquier lado."],
    exampleIds: ["conv-transport:1", "conv-transport:4"],
  },
  "conv-travel": {
    summary: "Los aeropuertos funcionan con las mismas preguntas en inglés en todo el mundo. Sábetelas y viajas tranquila, no estresada.",
    whyTricky: "El inglés del aeropuerto es cortés y fijo — 'I'm here on vacation', 'Just this bag'. Los oficiales preguntan corto; respuestas cortas y claras funcionan mejor.",
    how: ["Responde la pregunta de migración: '¿business o vacation?'", "Respuestas cortas y claras en seguridad.", "'Where is...?' encuentra cualquier puerta, mostrador o salida."],
    exampleIds: ["conv-travel:2", "conv-travel:5"],
  },
  "conv-hotel": {
    summary: "Una estadía en hotel es un guion corto y amable. Estas frases cubren llegar, pedir y salir.",
    whyTricky: "Los hoteles son extra corteses: aquí 'Could I...?' suena mejor que 'Can I...?'. Y 'reservation' lleva el acento en el medio: re-ser-VA-tion.",
    how: ["'I have a reservation' abre el registro.", "'Could I...?' es el pedido cortés de hotel.", "'What time is checkout?' te ahorra un cobro."],
    exampleIds: ["conv-hotel:1", "conv-hotel:4"],
  },
  "conv-health": {
    summary: "Cuando no te sientes bien, necesitas palabras ya. Estas te dejan explicar un síntoma y pedir ayuda — donde sea.",
    whyTricky: "El inglés usa 'I have a...' para síntomas ('a headache', 'a fever') y 'It hurts' para el dolor — no 'me duele' traducido. Las partes del cuerpo van con 'my': 'my throat hurts'.",
    how: ["'I have a...' para un síntoma, 'It hurts' para el dolor.", "'My ___ hurts' dice dónde.", "'I need to see a doctor' pide atención con claridad."],
    exampleIds: ["conv-health:1", "conv-health:3"],
  },
  "conv-weather": {
    summary: "Los americanos abren con el clima todo el tiempo — es amable y seguro. Unas líneas mantienen esa charla viva.",
    whyTricky: "El clima usa 'It's...' para todo ('it's hot', 'it's raining') — no hay sujeto que traducir. Y '-ing' para lo que pasa ahora: 'it's raining', no 'it rains' cuando es ahora mismo.",
    how: ["'It's...' + palabra de clima cubre casi todo.", "'-ing' para ahora mismo: 'it's snowing'.", "Reacciona con 'I know, right?' para seguir la charla."],
    exampleIds: ["conv-weather:1", "conv-weather:5"],
  },
  "conv-feelings": {
    summary: "Sonar fluido es sobre todo reaccionar — frasecitas rápidas que muestran que escuchas y te importa.",
    whyTricky: "Las reacciones en inglés son cortas e idiomáticas: 'I'm so happy for you', 'That's too bad'. El silencio se siente frío en inglés, así que una reacción rápida da calidez.",
    how: ["Reacciona rápido — hasta una frase corta da calidez.", "Iguala el ánimo: feliz, triste, emocionada.", "'That's...' + palabra de emoción es un patrón seguro."],
    exampleIds: ["conv-feelings:1", "conv-feelings:4"],
  },
  "conv-phone": {
    summary: "El inglés del teléfono tiene su propio guion — contestar, preguntar quién llama y manejar la mala señal.",
    whyTricky: "Las frases del teléfono son fijas: 'This is Mariana', no 'I am Mariana', al contestar. Y 'Can you hear me?' es el arreglo universal para la mala línea.",
    how: ["Contesta con 'This is...' + tu nombre.", "'Can you hear me?' arregla la mala señal.", "'I'll call you back' te da tiempo."],
    exampleIds: ["conv-phone:1", "conv-phone:4"],
  },
  "conv-emergency": {
    summary: "En una emergencia no hay tiempo de buscar palabras. Vale la pena que estas pocas sean automáticas — para ti y para quien esté cerca.",
    whyTricky: "El inglés de emergencia es fuerte, corto y directo — la cortesía se cae. 'Call 911' (nine-one-one) es el número de EE. UU., dicho dígito por dígito.",
    how: ["Sé directa y fuerte — deja la cortesía.", "'911' es 'nine-one-one', dígito por dígito.", "'I need help' + qué, dicho claro, mueve a la gente."],
    exampleIds: ["conv-emergency:1", "conv-emergency:3"],
  },
  "conv-opinions": {
    summary: "Las conversaciones reales son gente compartiendo opiniones. Unos pocos inicios naturales te dejan decir lo que piensas y reaccionar sin sonar brusca.",
    whyTricky: "El error común es traducir 'I think that…' muy literal. Los nativos suavizan ('I feel like…', 'to be honest') y no están de acuerdo con delicadeza ('I see your point, but…').",
    how: ["Abre con 'I think' o 'I feel like' antes de tu idea.", "Acuerda rápido: 'Totally', 'Exactly', 'Same here'.", "Discrepa suave: 'I see your point, but…'."],
    exampleIds: ["conv-opinions:1", "conv-opinions:6"],
  },
  "conv-stories": {
    summary: "Ser conversacional es contar historias pequeñas: qué hiciste, qué pasó. Los conectores ('so', 'then', 'anyway') mantienen la historia unida.",
    whyTricky: "Las terminaciones de pasado se pegan al hablar rápido ('I was gonna', 'ended up'). Y las historias usan conectores que el español maneja distinto — 'so' para causa, 'anyway' para retomar.",
    how: ["Arranca: 'So the other day…'.", "Une los hechos: 'and then', 'so', 'after that'.", "Cierra: 'and that was it' o 'anyway…'."],
    exampleIds: ["conv-stories:1", "conv-stories:5"],
  },
  "conv-natural": {
    summary: "En B2 no se trata de más palabras, sino de las naturales: modismos y suavizadores que hacen que el inglés fluya en vez de sonar traducido.",
    whyTricky: "Son frases fijas que no se arman palabra por palabra ('no worries', 'I'm down', 'my bad'). Apréndelas como bloques completos y suéltalas.",
    how: ["Trátalas como una sola unidad — no traduzcas palabra por palabra.", "Úsalas para reaccionar ('for sure', 'no worries').", "Suaviza pedidos ('would you mind…')."],
    exampleIds: ["conv-natural:2", "conv-natural:7"],
  },
  "conv-diplomatic": {
    summary: "En C1 la habilidad no es tener razón, sino tenerla con elegancia. Los nativos discrepan todo el tiempo, pero lo acolchan para que nadie quede mal.",
    whyTricky: "El español traducido directo puede sonar brusco ('No, estás mal'). El inglés envuelve el desacuerdo en suavizadores ('I hear you, but…', 'I'd push back a little') que mantienen la calma.",
    how: ["Primero acolcha, luego difiere: 'That's fair, but…'.", "Matiza en vez de afirmar: 'I'm not entirely convinced'.", "Deja una salida: 'Correct me if I'm wrong'."],
    exampleIds: ["conv-diplomatic:1", "conv-diplomatic:6"],
  },
  "conv-idioms": {
    summary: "Los modismos son la huella de quien habla con fluidez. Unos pocos, bien puestos, hacen que suenes como si vivieras en el idioma — no como si lo recitaras.",
    whyTricky: "No se traducen palabra por palabra ('piece of cake' no es sobre pastel). Aprende cada uno como un bloque completo y úsalo en el momento justo.",
    how: ["Memoriza cada uno como un bloque, no palabra por palabra.", "Empareja con la situación: 'piece of cake' = fácil.", "No abuses — un modismo bien puesto vale por cinco."],
    exampleIds: ["conv-idioms:1", "conv-idioms:6"],
  },
  "conv-professional": {
    summary: "El inglés profesional tiene su propio registro — nítido, un poco indirecto, lleno de frases fijas. Estas son las que aparecen en cada reunión y correo.",
    whyTricky: "La franqueza normal en español puede leerse como agresiva en el trabajo; el inglés de oficina suaviza y empaca ('circle back', 'set expectations'). Es un código que aprendes como bloques.",
    how: ["Usa la frase fija que el nativo espera: 'circle back', 'follow up'.", "Suaviza pedidos: 'Can you walk me through it?'.", "Señala el proceso: 'let's align on next steps'."],
    exampleIds: ["conv-professional:1", "conv-professional:6"],
  },
  "conv-persuade": {
    summary: "En C2 puedes ganar una discusión y conservar a un amigo. Persuadir en inglés se apoya en ceder un poco para ganar mucho — conceder un punto y luego girarlo.",
    whyTricky: "El ritmo del debate es idiomático: concedes ('you've got a point'), pivotas ('that said') y rematas ('at the end of the day'). Los conectores llevan la persuasión, no el vocabulario grande.",
    how: ["Concede y luego pivota: 'You've got a point, but…'.", "Enmarca tu postura: 'The way I see it…'.", "Remata: 'At the end of the day, it comes down to…'."],
    exampleIds: ["conv-persuade:2", "conv-persuade:6"],
  },
  "conv-abstract": {
    summary: "La fluidez real aparece cuando el tema se vuelve abstracto — matices, hipótesis, disyuntivas. El inglés tiene frases hechas para justo esos movimientos.",
    whyTricky: "Hablar en abstracto está lleno de modismos ('gray area', 'cuts both ways', 'slippery slope'). Cada uno comprime una idea entera; conocerlos te deja pensar en voz alta a velocidad nativa.",
    how: ["Nombra el matiz: 'it's a bit of a gray area'.", "Señala una hipótesis: 'hypothetically speaking…'.", "Comprime la disyuntiva: 'it cuts both ways'."],
    exampleIds: ["conv-abstract:1", "conv-abstract:6"],
  },
  "conv-humor": {
    summary: "El humor es lo último que dominas en otro idioma — y lo primero que hace sentir a la gente que de verdad perteneces. La chispa americana corre con ironía y bromas suaves.",
    whyTricky: "El tono invierte el sentido: 'Yeah, right' significa lo contrario de sí. La ironía vive en la entrega, así que el tiempo y un tono plano importan tanto como las palabras.",
    how: ["Aplana el tono para la ironía: 'Yeah, right'.", "Señala la broma: 'I'm just messing with you'.", "Sígueles la corriente: 'Tell me about it'."],
    exampleIds: ["conv-humor:2", "conv-humor:4"],
  },
};

// ── Category blurbs (Weak Sounds dashboard) ──────────────────────────────────

export const CATEGORY_BLURBS_ES: Record<string, string> = {
  "i-vs-ii": "El español tiene una sola 'i'. El inglés la parte en dos — ship vs sheep. Confundirlas cambia la palabra.",
  "b-vs-v": "En español, b y v suenan igual. En inglés, la v necesita dientes sobre el labio — berry vs very.",
  "dj-vs-y": "La 'j' inglesa es dura y vibrante; la 'y' es suave. Jail vs Yale, jet vs yet.",
  th: "No hay TH en español, así que sale t, d o s. Lengua entre los dientes — think, this.",
  h: "La h española es muda y la j raspa. La h inglesa es un soplido suave — y a veces muda (hour).",
  "s-clusters": "El español nunca empieza con 's' + consonante, y se cuela una 'e': 'espeak'. Arranca limpio en la s.",
  "ed-endings": "El -ed del pasado tiene tres sonidos. Solo -ted/-ded agrega sílaba — walked, played, wanted.",
  "final-clusters": "Las palabras españolas casi no terminan en consonantes amontonadas y los finales se botan. Dilos todos — texts, asked.",
  schwa: "El inglés aplasta las vocales débiles en una 'a' perezosa. Es el sonido más común del inglés — about, banana.",
  "word-stress": "El inglés mueve el acento y cambia el sentido — FO-to vs fo-TO-gra-fi, RE-cord vs re-CORD.",
  "connected-speech": "Las frases reales unen palabras y llevan ritmo. Practica frases completas, no palabras sueltas.",
  conversation: "Los bloques que de verdad dices en la calle — saludos, pedir, direcciones, planes.",
};

// ── Achievements ─────────────────────────────────────────────────────────────

export const ACHIEVEMENTS_ES: Record<string, { name: string; description: string }> = {
  first_steps: { name: "Primeras palabras", description: "Graba tu primer intento." },
  combo_5: { name: "Combo ×5", description: "Logra 5 claras seguidas." },
  combo_10: { name: "En llamas", description: "Logra 10 claras seguidas." },
  fifty_clear: { name: "Cincuenta claras", description: "Di 50 palabras con claridad." },
  hundred_clear: { name: "Centenario", description: "Di 100 palabras con claridad." },
  streak_3: { name: "Tres días", description: "Practica 3 días seguidos." },
  streak_7: { name: "Guerrera de la semana", description: "Practica 7 días seguidos." },
  streak_30: { name: "Imparable", description: "Practica 30 días seguidos." },
  level_5: { name: "Nivel 5", description: "Alcanza el nivel 5." },
  level_10: { name: "Nivel 10", description: "Alcanza el nivel 10." },
  perfect_lesson: { name: "Impecable", description: "Termina una lección con todo claro." },
  sound_master: { name: "Maestra del sonido", description: "Domina todas las palabras de un sonido." },
};

export function achievementText(
  id: string,
  english: { name: string; description: string },
  lang: "es" | "en",
): { name: string; description: string } {
  return lang === "es" ? ACHIEVEMENTS_ES[id] ?? english : english;
}

// ── Lookup helpers (English fallback) ────────────────────────────────────────

export function hintFor(itemId: string, englishHint: string, lang: "es" | "en"): string {
  return lang === "es" ? HINTS_ES[itemId] ?? englishHint : englishHint;
}

export function introFor(lessonId: string, english: LessonIntro | undefined, lang: "es" | "en"): LessonIntro | undefined {
  if (!english) return undefined;
  if (lang !== "es") return english;
  const es = INTROS_ES[lessonId];
  return es ? { ...es, exampleIds: english.exampleIds } : english;
}

export function blurbFor(categoryId: string, englishBlurb: string, lang: "es" | "en"): string {
  return lang === "es" ? CATEGORY_BLURBS_ES[categoryId] ?? englishBlurb : englishBlurb;
}
