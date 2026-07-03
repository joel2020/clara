import type { Lesson, PracticeItem } from "@/lib/db/types";

// The Conversación track: scenario-based units of high-frequency conversational
// chunks for an A1–A2 learner. The strategy is chunks-first — she memorizes
// whole phrases until they're automatic (grammar comes along for free at this
// level), the app drills them daily with SRS, and the live sessions roleplay
// the same scenario. Every chunk carries its Spanish meaning so she always
// knows what she's saying.

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

export const CONVERSATION_LESSONS: Lesson[] = [
  {
    id: "conv-greetings",
    title: "Greetings & introductions",
    subtitle: "Saludos",
    description: "The first sixty seconds of any conversation — automatic.",
    kind: "phrase",
    categoryIds: ["conversation"],
    track: "conversation",
    order: 21,
    intro: {
      summary: "The first minute of every conversation uses the same few phrases. Make them automatic and you'll never freeze on hello.",
      whyTricky:
        "Spanish greets with one question (¿cómo estás?); English volleys it back fast — 'I'm good, thanks. And you?' The rhythm of the exchange is the skill, not the words.",
      how: [
        "Learn each phrase as ONE piece of sound, not word by word.",
        "Answer + return: never just 'I'm good' — always '...and you?'",
        "Say them out loud until your mouth answers before your brain.",
      ],
      exampleIds: ["conv-greetings:1", "conv-greetings:4"],
    },
    items: chunks("conv-greetings", [
      { text: "Hi, how are you?", ipa: "/haɪ haʊ ɑːr juː/", meaning: "Hola, ¿cómo estás?", hint: "Una sola ola: jai-jauaryú. La h es un soplido suave." },
      { text: "I'm good, thanks. And you?", ipa: "/aɪm ɡʊd θæŋks ænd juː/", meaning: "Bien, gracias. ¿Y tú?", hint: "Siempre devuelve la pregunta: '...and you?' sube al final." },
      { text: "My name is Mariana", ipa: "/maɪ neɪm ɪz .../", meaning: "Me llamo Mariana", hint: "'name is' se une: 'nei-mis'." },
      { text: "Nice to meet you", ipa: "/naɪs tə miːt juː/", meaning: "Mucho gusto", hint: "'to' es débil: 'nais-ta-mít-yu'." },
      { text: "Where are you from?", ipa: "/wɛr ɑːr juː frʌm/", meaning: "¿De dónde eres?", hint: "'Where are' se funde: 'wer-ar'. Baja el tono al final." },
      { text: "I'm from Colombia", ipa: "/aɪm frʌm kəˈlʌmbiə/", meaning: "Soy de Colombia", hint: "En inglés es 'ka-LAM-bia', no 'Colombia' — acento en LAM." },
      { text: "I'm learning English", ipa: "/aɪm ˈlɜːrnɪŋ ˈɪŋɡlɪʃ/", meaning: "Estoy aprendiendo inglés", hint: "'learning': la r americana, sin vibrar. 'ING-glish'." },
      { text: "Can you speak slower, please?", ipa: "/kæn juː spiːk ˈsloʊər pliːz/", meaning: "¿Puedes hablar más despacio, por favor?", hint: "Tu frase de emergencia. 'speak' limpio: sp, sin 'e' antes." },
      { text: "How do you say this in English?", ipa: "/haʊ də juː seɪ ðɪs ɪn ˈɪŋɡlɪʃ/", meaning: "¿Cómo se dice esto en inglés?", hint: "'do you' se relaja: 'jau-da-yu-séi'. Úsala en cada clase." },
      { text: "See you later!", ipa: "/siː juː ˈleɪtər/", meaning: "¡Nos vemos!", hint: "'later' con t suave americana: 'léi-der'." },
    ]),
  },
  {
    id: "conv-cafe",
    title: "Café & restaurant",
    subtitle: "Pedir comida",
    description: "Order anything, anywhere — politely and clearly.",
    kind: "phrase",
    categoryIds: ["conversation"],
    track: "conversation",
    order: 22,
    intro: {
      summary: "Ordering is the most predictable conversation in English — the same six phrases work in every café and restaurant in the world.",
      whyTricky:
        "Spanish orders with 'me das...' or 'quiero...'. English softens everything: 'Can I have...?' and 'I'd like...' — direct translation sounds rude, the polite chunks sound native.",
      how: [
        "'Can I have...?' is your master key — it orders anything.",
        "'I'd like...' = 'quisiera'. The 'd is tiny but polite.",
        "End almost everything with 'please' — English expects it.",
      ],
      exampleIds: ["conv-cafe:2", "conv-cafe:3"],
    },
    items: chunks("conv-cafe", [
      { text: "A table for two, please", ipa: "/ə ˈteɪbəl fɔːr tuː pliːz/", meaning: "Una mesa para dos, por favor", hint: "La primera 'a' es una schwa perezosa: 'a-TEI-bol'." },
      { text: "Can I see the menu?", ipa: "/kæn aɪ siː ðə ˈmɛnjuː/", meaning: "¿Puedo ver el menú?", hint: "'Can I' se une: 'ke-nai'. MEN-yu, acento al inicio." },
      { text: "Can I have a coffee, please?", ipa: "/kæn aɪ hæv ə ˈkɔːfi pliːz/", meaning: "¿Me das un café, por favor?", hint: "Tu llave maestra: 'ke-nai-hav'. Sirve para pedir TODO." },
      { text: "I'd like the chicken", ipa: "/aɪd laɪk ðə ˈtʃɪkɪn/", meaning: "Quisiera el pollo", hint: "'I'd' con d chiquita: 'aid-laik'. Es el 'quisiera' del inglés." },
      { text: "No onions, please", ipa: "/noʊ ˈʌnjənz pliːz/", meaning: "Sin cebolla, por favor", hint: "'onions' = 'AN-yons', no 'o-nions'." },
      { text: "It's delicious", ipa: "/ɪts dɪˈlɪʃəs/", meaning: "Está delicioso", hint: "'de-LI-shas' — la última sílaba se relaja en schwa." },
      { text: "Can we get the check, please?", ipa: "/kæn wiː ɡɛt ðə tʃɛk pliːz/", meaning: "¿Nos traes la cuenta, por favor?", hint: "'check' = cuenta en EE. UU. Termina la k: che-K." },
      { text: "Do you take cards?", ipa: "/də juː teɪk kɑːrdz/", meaning: "¿Aceptan tarjeta?", hint: "'Do you' débil: 'da-yu'. Termina 'cards' con dz." },
      { text: "To go, please", ipa: "/tə ɡoʊ pliːz/", meaning: "Para llevar, por favor", hint: "'to' débil otra vez: 'ta-GOU'." },
      { text: "Keep the change", ipa: "/kiːp ðə tʃeɪndʒ/", meaning: "Quédate con el cambio", hint: "'change' termina en j vibrante: chein-DZH." },
    ]),
  },
  {
    id: "conv-directions",
    title: "Directions & getting around",
    subtitle: "Direcciones",
    description: "Never be lost — ask, understand, and arrive.",
    kind: "phrase",
    categoryIds: ["conversation"],
    track: "conversation",
    order: 23,
    intro: {
      summary: "Asking for directions and understanding the answer — the survival skill for any city.",
      whyTricky:
        "'Excuse me' opens every question to a stranger — Spanish 'disculpe' works the same way, but in English skipping it sounds abrupt. And the answers come fast: left, right, next to, far.",
      how: [
        "Always open with 'Excuse me...' — it buys you a friendly listener.",
        "Learn the answer words too: left, right, straight, next to, far.",
        "'How do I get to...?' works for anywhere on earth.",
      ],
      exampleIds: ["conv-directions:1", "conv-directions:2"],
    },
    items: chunks("conv-directions", [
      { text: "Excuse me, where is the bathroom?", ipa: "/ɪkˈskjuːz miː wɛr ɪz ðə ˈbæθruːm/", meaning: "Disculpa, ¿dónde está el baño?", hint: "'Excuse me' abre todo: 'eks-KIUS-mi'. TH en 'bathroom'." },
      { text: "How do I get to the airport?", ipa: "/haʊ də aɪ ɡɛt tə ðə ˈɛrpɔːrt/", meaning: "¿Cómo llego al aeropuerto?", hint: "Plantilla universal: 'jau-da-ai-GET-tu...' + lugar." },
      { text: "Is it far from here?", ipa: "/ɪz ɪt fɑːr frʌm hɪr/", meaning: "¿Queda lejos de aquí?", hint: "'Is it' se une: 'i-sit'. R americana en 'far'." },
      { text: "Turn left at the corner", ipa: "/tɜːrn lɛft æt ðə ˈkɔːrnər/", meaning: "Gira a la izquierda en la esquina", hint: "Vas a ESCUCHAR esta — 'turn left', 'turn right'. Practica ambas." },
      { text: "It's next to the bank", ipa: "/ɪts nɛkst tə ðə bæŋk/", meaning: "Está al lado del banco", hint: "'next to' = al lado de. El grupo 'kst' completo: neks-t." },
      { text: "I'm lost", ipa: "/aɪm lɔːst/", meaning: "Estoy perdida", hint: "Corta y honesta. Termina la t: los-T." },
      { text: "Can you show me on the map?", ipa: "/kæn juː ʃoʊ miː ɑːn ðə mæp/", meaning: "¿Me muestras en el mapa?", hint: "'show me' — sh suave, no ch: 'shou-mi'." },
      { text: "What time does the bus leave?", ipa: "/wʌt taɪm dʌz ðə bʌs liːv/", meaning: "¿A qué hora sale el bus?", hint: "'does the' se aprieta: 'das-tha'. 'leave' con ii larga." },
      { text: "One ticket, please", ipa: "/wʌn ˈtɪkɪt pliːz/", meaning: "Un tiquete, por favor", hint: "'ticket' con i corta y relajada: TI-kit." },
      { text: "Stop here, please", ipa: "/stɑːp hɪr pliːz/", meaning: "Pare aquí, por favor", hint: "'stop' limpio: st sin 'e'. H suave en 'here'." },
    ]),
  },
  {
    id: "conv-shopping",
    title: "Shopping",
    subtitle: "Compras",
    description: "Prices, sizes, and paying — without pointing.",
    kind: "phrase",
    categoryIds: ["conversation"],
    track: "conversation",
    order: 24,
    intro: {
      summary: "Shopping talk is short and transactional — perfect chunks for a beginner to win with.",
      whyTricky:
        "'How much is this?' has no literal Spanish shape (¿cuánto cuesta?), and the questions come with 'do you have...?' — English question order takes practice to feel natural.",
      how: [
        "'How much is this?' — point and ask. Works everywhere.",
        "'Do you have...?' = '¿tienen...?' — memorize it as one block.",
        "Sizes are easy: small, medium, large — say them clean.",
      ],
      exampleIds: ["conv-shopping:1", "conv-shopping:3"],
    },
    items: chunks("conv-shopping", [
      { text: "How much is this?", ipa: "/haʊ mʌtʃ ɪz ðɪs/", meaning: "¿Cuánto cuesta esto?", hint: "'much is' se une: 'ma-chis'. TH con voz en 'this'." },
      { text: "That's too expensive", ipa: "/ðæts tuː ɪkˈspɛnsɪv/", meaning: "Está muy caro", hint: "'too' larga = demasiado. 'eks-PEN-siv', v con dientes." },
      { text: "Do you have this in medium?", ipa: "/də juː hæv ðɪs ɪn ˈmiːdiəm/", meaning: "¿Tienes esto en talla M?", hint: "'Do you have' como un bloque: 'da-yu-HAV'." },
      { text: "Can I try it on?", ipa: "/kæn aɪ traɪ ɪt ɑːn/", meaning: "¿Me lo puedo probar?", hint: "'try it on' se encadena: 'trai-it-ÓN'." },
      { text: "I'm just looking, thanks", ipa: "/aɪm dʒʌst ˈlʊkɪŋ θæŋks/", meaning: "Solo estoy mirando, gracias", hint: "Tu escudo en las tiendas. J vibrante en 'just'." },
      { text: "I'll take it", ipa: "/aɪl teɪk ɪt/", meaning: "Me lo llevo", hint: "'I'll' = 'ail'. Corto y decidido: 'ail-TEI-kit'." },
      { text: "Can I pay with card?", ipa: "/kæn aɪ peɪ wɪð kɑːrd/", meaning: "¿Puedo pagar con tarjeta?", hint: "'with' termina en TH suave con voz — no 'wit'." },
      { text: "Do you have anything cheaper?", ipa: "/də juː hæv ˈɛniθɪŋ ˈtʃiːpər/", meaning: "¿Tienes algo más barato?", hint: "'anything' con TH de aire: 'E-ni-thing'." },
    ]),
  },
  {
    id: "conv-smalltalk",
    title: "Small talk",
    subtitle: "Charla casual",
    description: "Weather, weekends, work — the glue of every friendship.",
    kind: "phrase",
    categoryIds: ["conversation"],
    track: "conversation",
    order: 25,
    intro: {
      summary: "Small talk is how English speakers warm up to each other — tiny questions about the day, the weekend, the weather.",
      whyTricky:
        "In Spanish, small talk with strangers is optional; in English it's expected — the cashier, the waiter, everybody. The trick is having three go-to questions ready so it never feels like an exam.",
      how: [
        "Your three openers: 'How's your day going?', 'How was your weekend?', 'Any plans for the weekend?'",
        "Answers stay short and warm: 'It was great, thanks for asking.'",
        "A compliment always works: 'I love this song.'",
      ],
      exampleIds: ["conv-smalltalk:1", "conv-smalltalk:5"],
    },
    items: chunks("conv-smalltalk", [
      { text: "How's your day going?", ipa: "/haʊz jɔːr deɪ ˈɡoʊɪŋ/", meaning: "¿Cómo va tu día?", hint: "'How's' = jau-z, con z. Sube en 'going?'." },
      { text: "The weather is beautiful today", ipa: "/ðə ˈwɛðər ɪz ˈbjuːtɪfəl təˈdeɪ/", meaning: "El clima está hermoso hoy", hint: "'weather' con TH de voz: UE-ther. 'BIU-ti-fol'." },
      { text: "What do you do for work?", ipa: "/wʌt də juː duː fɔːr wɜːrk/", meaning: "¿En qué trabajas?", hint: "'What do you do' se aprieta: 'wa-da-ya-DU'." },
      { text: "I work from home", ipa: "/aɪ wɜːrk frʌm hoʊm/", meaning: "Trabajo desde casa", hint: "'work' con r americana: uérk. H suave en 'home'." },
      { text: "Do you have any plans for the weekend?", ipa: "/də juː hæv ˈɛni plænz fɔːr ðə ˈwiːkɛnd/", meaning: "¿Tienes planes para el fin de semana?", hint: "Larga pero rítmica: golpea 'plans' y 'weekend'." },
      { text: "Not much, just relaxing", ipa: "/nɑːt mʌtʃ dʒʌst rɪˈlæksɪŋ/", meaning: "Nada especial, solo descansar", hint: "'just' con j vibrante. 're-LAK-sing'." },
      { text: "How was your weekend?", ipa: "/haʊ wʌz jɔːr ˈwiːkɛnd/", meaning: "¿Cómo estuvo tu fin de semana?", hint: "El lunes empieza así. 'was your' se une: 'wa-shor'." },
      { text: "It was great, thanks for asking", ipa: "/ɪt wʌz ɡreɪt θæŋks fɔːr ˈæskɪŋ/", meaning: "Estuvo genial, gracias por preguntar", hint: "'thanks for asking' te hace sonar encantadora. TH de aire." },
      { text: "I love this song", ipa: "/aɪ lʌv ðɪs sɔːŋ/", meaning: "Me encanta esta canción", hint: "'love' termina en v de dientes: la-V. TH en 'this'." },
      { text: "Have a good day!", ipa: "/hæv ə ɡʊd deɪ/", meaning: "¡Que tengas buen día!", hint: "Se une todo: 'ja-va-gud-DEI'. Despídete siempre así." },
    ]),
  },
  {
    id: "conv-plans",
    title: "Making plans",
    subtitle: "Planes",
    description: "Invite, accept, reschedule — social life in English.",
    kind: "phrase",
    categoryIds: ["conversation"],
    track: "conversation",
    order: 26,
    intro: {
      summary: "Inviting someone, saying yes, moving a date — these chunks run your social calendar.",
      whyTricky:
        "'Do you want to...?' compresses to 'wanna' in real speech, and times use 'at' (at seven) where Spanish uses 'a las'. Small patterns, big naturalness.",
      how: [
        "'Do you want to grab a coffee?' — 'grab' makes it casual and friendly.",
        "Accept with enthusiasm: 'That sounds great.'",
        "Cancel with grace: 'Sorry, I can't make it. Can we do it another day?'",
      ],
      exampleIds: ["conv-plans:2", "conv-plans:3"],
    },
    items: chunks("conv-plans", [
      { text: "Are you free tomorrow?", ipa: "/ɑːr juː friː təˈmɑːroʊ/", meaning: "¿Estás libre mañana?", hint: "'free' con ii larga y sonriente. 'ta-MA-rou'." },
      { text: "Do you want to grab a coffee?", ipa: "/də juː wɑːnt tə ɡræb ə ˈkɔːfi/", meaning: "¿Quieres tomarnos un café?", hint: "En la calle suena 'wanna': 'da-ya-wana-grab-a-COffee'." },
      { text: "That sounds great", ipa: "/ðæt saʊndz ɡreɪt/", meaning: "Suena genial", hint: "Tu 'sí' entusiasta. 'sounds' termina en dz." },
      { text: "What time works for you?", ipa: "/wʌt taɪm wɜːrks fɔːr juː/", meaning: "¿A qué hora te queda bien?", hint: "'works' — uérks, con el grupo rks completo." },
      { text: "Let's meet at seven", ipa: "/lɛts miːt æt ˈsɛvən/", meaning: "Nos vemos a las siete", hint: "'Let's' = lets, con ts. 'at seven', no 'a las seven'." },
      { text: "Sorry, I can't make it", ipa: "/ˈsɑːri aɪ kænt meɪk ɪt/", meaning: "Lo siento, no puedo ir", hint: "'can't make it' = no puedo ir. La t de can't casi muda: 'kaen(t)'." },
      { text: "Can we do it another day?", ipa: "/kæn wiː duː ɪt əˈnʌðər deɪ/", meaning: "¿Lo dejamos para otro día?", hint: "'another' con TH de voz y schwa: 'a-NA-ther'." },
      { text: "I'll text you later", ipa: "/aɪl tɛkst juː ˈleɪtər/", meaning: "Te escribo más tarde", hint: "'text you' se une: 'teks-chu'. Así se despiden los planes." },
      { text: "Where do you want to meet?", ipa: "/wɛr də juː wɑːnt tə miːt/", meaning: "¿Dónde nos encontramos?", hint: "Otra vez 'wanna': 'wer-da-ya-wana-MIIT'." },
      { text: "I'm on my way", ipa: "/aɪm ɑːn maɪ weɪ/", meaning: "Voy en camino", hint: "El mensaje más usado del inglés: 'ai-mon-mai-UEI'." },
    ]),
  },
];
