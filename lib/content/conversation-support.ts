import type { Lesson, PracticeItem } from "@/lib/db/types";

// The support-English track — the curriculum the job path is actually about.
//
// Everything else in Clara teaches conversation. This teaches the specific moments
// that decide a customer-support call, which is what a Medellin BPO hires for: how
// to open, how to ask someone to repeat without losing face, how to calm an angry
// caller, how to read a confirmation number back without being misheard, and how to
// close. Plus the interview block that gets her through the screen in the first
// place.
//
// Orders continue from 49 (conversation-4 ends there), so these sit at the end of
// the global ordering and are surfaced by the job path rather than by level alone.

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

/** The lesson ids of the support track, in the order the job path should walk them. */
export const SUPPORT_UNIT_IDS = [
  "sup-open",
  "sup-repeat",
  "sup-empathy",
  "sup-hold",
  "sup-explain",
  "sup-spell",
  "sup-close",
  "sup-limits",
  "sup-interview",
];

export const SUPPORT_LESSONS: Lesson[] = [
  {
    id: "sup-open",
    title: "Opening the call",
    subtitle: "Abrir la llamada",
    description: "Greet, introduce yourself, and verify who you are talking to.",
    kind: "phrase",
    categoryIds: ["conversation"],
    track: "conversation",
    order: 50,
    intro: {
      summary:
        "The first fifteen seconds of a call set everything. Agents are scored on whether they greeted, gave their name, and verified the account before touching anything else.",
      whyTricky:
        "It is a fixed script, and that is the point: you say it the same way every time so your mouth is free to think about the customer's problem. Rushing it is the most common new-agent mistake.",
      how: [
        "Company, then your name, then the offer to help.",
        "Verify before you act: name first, then one more detail.",
        "Smile — it genuinely changes your voice on the phone.",
      ],
      exampleIds: ["sup-open:1", "sup-open:4"],
    },
    items: chunks("sup-open", [
      { text: "Thank you for calling, my name is Ana", ipa: "/θæŋk juː fɔːr ˈkɔːlɪŋ maɪ neɪm ɪz ˈænə/", meaning: "Gracias por llamar, mi nombre es Ana", hint: "'Thank' con th soplada. 'calling' = 'CO-ling'. En el trabajo dirás tu nombre." },
      { text: "How can I help you today?", ipa: "/haʊ kæn aɪ hɛlp juː təˈdeɪ/", meaning: "¿Cómo le puedo ayudar hoy?", hint: "Se junta: 'hau-ka-nai-HELP-yu', con h soplada." },
      { text: "May I have your full name, please?", ipa: "/meɪ aɪ hæv jɔːr fʊl neɪm pliːz/", meaning: "¿Me da su nombre completo, por favor?", hint: "'May I' es más formal que 'can I'. Úsalo al verificar." },
      { text: "Can you confirm the email on the account?", ipa: "/kæn juː kənˈfɜːrm ði ˈiːmeɪl ɑːn ði əˈkaʊnt/", meaning: "¿Me confirma el correo de la cuenta?", hint: "'confirm' con r americana: 'con-FERM'." },
      { text: "Thank you for verifying that", ipa: "/θæŋk juː fɔːr ˈvɛrɪfaɪɪŋ ðæt/", meaning: "Gracias por confirmarlo", hint: "'verifying' = 'VE-ri-fai-ing'. Cierra la verificación." },
      { text: "I have your account open now", ipa: "/aɪ hæv jɔːr əˈkaʊnt ˈoʊpən naʊ/", meaning: "Ya tengo su cuenta abierta", hint: "Le dice al cliente que ya puedes ayudar. Calma la espera." },
      { text: "Just to make sure I have this right", ipa: "/dʒʌst tuː meɪk ʃʊr aɪ hæv ðɪs raɪt/", meaning: "Solo para confirmar que entendí bien", hint: "Tu frase más útil. Evita errores sin sonar insegura." },
      { text: "Who am I speaking with?", ipa: "/huː æm aɪ ˈspiːkɪŋ wɪð/", meaning: "¿Con quién tengo el gusto?", hint: "'speaking with' — no 'speaking to' en soporte." },
      { text: "Is this the best number to reach you?", ipa: "/ɪz ðɪs ðə bɛst ˈnʌmbər tuː riːtʃ juː/", meaning: "¿Este es el mejor número para contactarlo?", hint: "'reach you' = contactarlo. 'RI-chu'." },
      { text: "Let me pull that up for you", ipa: "/lɛt miː pʊl ðæt ʌp fɔːr juː/", meaning: "Permítame buscarlo", hint: "'pull up' = abrir en el sistema. Muy usado." },
    ]),
  },
  {
    id: "sup-repeat",
    title: "Asking someone to repeat",
    subtitle: "Pedir que repitan",
    description: "Get it again, slower, without sounding lost.",
    kind: "phrase",
    categoryIds: ["conversation"],
    track: "conversation",
    order: 51,
    intro: {
      summary:
        "You will not understand every caller — nobody does, not even natives. What separates a good agent is asking again in a way that sounds professional instead of panicked.",
      whyTricky:
        "'What?' and 'Repeat please' sound rude in English. And saying 'yes' when you did not understand is the single most expensive habit on a call: it creates the wrong ticket.",
      how: [
        "Apologise lightly, then ask: 'I'm sorry, could you…'.",
        "Ask for the specific part you missed, not the whole sentence.",
        "Never confirm something you did not hear.",
      ],
      exampleIds: ["sup-repeat:1", "sup-repeat:5"],
    },
    items: chunks("sup-repeat", [
      { text: "I'm sorry, could you say that again?", ipa: "/aɪm ˈsɑːri kʊd juː seɪ ðæt əˈɡɛn/", meaning: "Disculpe, ¿me lo repite?", hint: "Nunca digas solo 'what?'. Empieza con 'I'm sorry'." },
      { text: "Could you speak a little slower, please?", ipa: "/kʊd juː spiːk ə ˈlɪtəl ˈsloʊər pliːz/", meaning: "¿Puede hablar un poco más despacio?", hint: "'a little' suaviza. 'slower' = 'SLO-wer'." },
      { text: "I didn't catch that last part", ipa: "/aɪ ˈdɪdənt kætʃ ðæt læst pɑːrt/", meaning: "No alcancé a escuchar la última parte", hint: "'catch' = alcanzar a oír. Suena natural, no torpe." },
      { text: "Sorry, the line is breaking up", ipa: "/ˈsɑːri ðə laɪn ɪz ˈbreɪkɪŋ ʌp/", meaning: "Disculpe, la línea se está cortando", hint: "'breaking up' = se corta. Culpa la línea, no al cliente." },
      { text: "Did you say fifteen or fifty?", ipa: "/dɪd juː seɪ ˈfɪftiːn ɔːr ˈfɪfti/", meaning: "¿Dijo quince o cincuenta?", hint: "Confusión clásica. 'fifTEEN' acento al final, 'FIFty' al inicio." },
      { text: "Let me read that back to you", ipa: "/lɛt miː riːd ðæt bæk tuː juː/", meaning: "Permítame repetírselo", hint: "'read back' = repetir para confirmar. Te salva de errores." },
      { text: "One moment, I want to get this right", ipa: "/wʌn ˈmoʊmənt aɪ wɑːnt tuː ɡɛt ðɪs raɪt/", meaning: "Un momento, quiero hacerlo bien", hint: "Compra tiempo y suena cuidadosa, no lenta." },
      { text: "Could you spell that for me?", ipa: "/kʊd juː spɛl ðæt fɔːr miː/", meaning: "¿Me lo puede deletrear?", hint: "'spell' = deletrear. Para nombres y correos." },
      { text: "I want to make sure I don't get it wrong", ipa: "/aɪ wɑːnt tuː meɪk ʃʊr aɪ doʊnt ɡɛt ɪt rɔːŋ/", meaning: "Quiero asegurarme de no equivocarme", hint: "Convierte tu duda en cuidado profesional." },
      { text: "Bear with me for one second", ipa: "/bɛr wɪð miː fɔːr wʌn ˈsɛkənd/", meaning: "Deme un segundo, por favor", hint: "'bear with me' = tenme paciencia. Muy americano." },
    ]),
  },
  {
    id: "sup-empathy",
    title: "Empathy & calming",
    subtitle: "Empatía y calmar",
    description: "Take the heat out of an angry call.",
    kind: "phrase",
    categoryIds: ["conversation"],
    track: "conversation",
    order: 52,
    intro: {
      summary:
        "Angry callers are not angry at you. The job is to acknowledge the feeling before touching the facts — an unacknowledged customer repeats themselves louder.",
      whyTricky:
        "Direct translations sound cold ('It is not my fault', 'Calm down'). Never tell an American caller to calm down; it escalates every time. And apologise for the situation without admitting blame.",
      how: [
        "Name the feeling: 'I understand how frustrating that is'.",
        "Apologise for the experience, not for a fault you have not confirmed.",
        "Then move to action: 'Let me fix this'.",
      ],
      exampleIds: ["sup-empathy:1", "sup-empathy:6"],
    },
    items: chunks("sup-empathy", [
      { text: "I understand how frustrating that is", ipa: "/aɪ ˌʌndərˈstænd haʊ ˈfrʌstreɪtɪŋ ðæt ɪz/", meaning: "Entiendo lo frustrante que es", hint: "Tu primera frase con un cliente molesto. Siempre." },
      { text: "I'm really sorry about that", ipa: "/aɪm ˈrɪli ˈsɑːri əˈbaʊt ðæt/", meaning: "Lamento mucho eso", hint: "Disculpa por la situación, sin admitir culpa." },
      { text: "That shouldn't have happened", ipa: "/ðæt ˈʃʊdənt hæv ˈhæpənd/", meaning: "Eso no debió pasar", hint: "'shouldn't have' = 'SHU-dən-tav'. Valida sin culpar a nadie." },
      { text: "Let me take care of this for you", ipa: "/lɛt miː teɪk kɛr ʌv ðɪs fɔːr juː/", meaning: "Permítame encargarme de esto", hint: "Pasa de la emoción a la acción. Baja la tensión." },
      { text: "You're right to be upset", ipa: "/jʊr raɪt tuː biː ʌpˈsɛt/", meaning: "Tiene razón en estar molesto", hint: "Desarma al cliente. Úsalo cuando de verdad aplica." },
      { text: "Thank you for your patience", ipa: "/θæŋk juː fɔːr jɔːr ˈpeɪʃəns/", meaning: "Gracias por su paciencia", hint: "'patience' = 'PEI-shəns'. Mejor que pedir paciencia." },
      { text: "I hear you", ipa: "/aɪ hɪr juː/", meaning: "Lo escucho / lo entiendo", hint: "Corta y poderosa. No es 'I listen you'." },
      { text: "I'd feel the same way", ipa: "/aɪd fiːl ðə seɪm weɪ/", meaning: "Yo sentiría lo mismo", hint: "'I'd' = I would. Te pone del lado del cliente." },
      { text: "Let's get this sorted out", ipa: "/lɛts ɡɛt ðɪs ˈsɔːrtɪd aʊt/", meaning: "Vamos a resolver esto", hint: "'sorted out' = resuelto. 'Let's' incluye al cliente." },
      { text: "I appreciate you letting me know", ipa: "/aɪ əˈpriːʃieɪt juː ˈlɛtɪŋ miː noʊ/", meaning: "Le agradezco que me lo diga", hint: "'appreciate' = 'a-PRI-shieit'. Convierte queja en aporte." },
    ]),
  },
  {
    id: "sup-hold",
    title: "Hold, transfer, callback",
    subtitle: "Espera y transferencia",
    description: "Move the call without losing the customer.",
    kind: "phrase",
    categoryIds: ["conversation"],
    track: "conversation",
    order: 53,
    intro: {
      summary:
        "Silence is what makes customers hang up. Every hold needs a reason, a length, and a thank-you when you come back — that is what the scorecard checks.",
      whyTricky:
        "You must ask permission, not announce it. 'I put you on hold' is an order; 'May I place you on hold?' is a request. And always give a number: two minutes, not 'a moment'.",
      how: [
        "Ask, give a reason, give a time.",
        "Come back before the time you promised.",
        "Explain the transfer before you make it.",
      ],
      exampleIds: ["sup-hold:1", "sup-hold:5"],
    },
    items: chunks("sup-hold", [
      { text: "May I place you on hold for two minutes?", ipa: "/meɪ aɪ pleɪs juː ɑːn hoʊld fɔːr tuː ˈmɪnɪts/", meaning: "¿Me permite ponerlo en espera dos minutos?", hint: "Pide permiso y da el tiempo. Nunca solo 'hold on'." },
      { text: "Thank you for holding", ipa: "/θæŋk juː fɔːr ˈhoʊldɪŋ/", meaning: "Gracias por esperar", hint: "Lo primero al volver. Siempre." },
      { text: "I'm still here with you", ipa: "/aɪm stɪl hɪr wɪð juː/", meaning: "Sigo aquí con usted", hint: "Si la espera se alarga, avisa. Evita que cuelguen." },
      { text: "I need to check that with my team", ipa: "/aɪ niːd tuː tʃɛk ðæt wɪð maɪ tiːm/", meaning: "Necesito verificarlo con mi equipo", hint: "Razón honesta para la espera. 'check' con ch fuerte." },
      { text: "I'm going to transfer you to billing", ipa: "/aɪm ˈɡoʊɪŋ tuː ˈtrænsfɜːr juː tuː ˈbɪlɪŋ/", meaning: "Lo voy a transferir a facturación", hint: "'billing' = facturación. Di a dónde, no solo que transfieres." },
      { text: "Let me stay on the line with you", ipa: "/lɛt miː steɪ ɑːn ðə laɪn wɪð juː/", meaning: "Permítame quedarme en la línea con usted", hint: "'stay on the line' = no colgar. Tranquiliza." },
      { text: "Can I call you back in ten minutes?", ipa: "/kæn aɪ kɔːl juː bæk ɪn tɛn ˈmɪnɪts/", meaning: "¿Le puedo devolver la llamada en diez minutos?", hint: "'call you back' = devolver la llamada." },
      { text: "I don't want to keep you waiting", ipa: "/aɪ doʊnt wɑːnt tuː kiːp juː ˈweɪtɪŋ/", meaning: "No quiero hacerlo esperar", hint: "'keep you waiting' = hacerlo esperar." },
      { text: "My colleague can help you with that", ipa: "/maɪ ˈkɑːliːɡ kæn hɛlp juː wɪð ðæt/", meaning: "Mi compañero le puede ayudar con eso", hint: "'colleague' = 'CA-liig'. No 'compañero' literal." },
      { text: "I'll explain everything before I transfer you", ipa: "/aɪl ɪkˈspleɪn ˈɛvriθɪŋ bɪˈfɔːr aɪ ˈtrænsfɜːr juː/", meaning: "Le explicaré todo antes de transferirlo", hint: "Evita que el cliente repita todo otra vez." },
    ]),
  },
  {
    id: "sup-explain",
    title: "Explaining & next steps",
    subtitle: "Explicar y siguientes pasos",
    description: "Say what happened, what you did, and what happens now.",
    kind: "phrase",
    categoryIds: ["conversation"],
    track: "conversation",
    order: 54,
    intro: {
      summary:
        "A customer forgives almost any problem if they know exactly what happens next. Vague endings ('we'll look into it') are what generate repeat calls.",
      whyTricky:
        "English wants the outcome first, then the detail — the opposite of how Spanish often builds up to the point. And give real timeframes: 'within 24 hours', not 'soon'.",
      how: [
        "Outcome first: 'Good news — I can replace it'.",
        "Then the steps, in order, with a timeframe.",
        "Finish by checking she followed you.",
      ],
      exampleIds: ["sup-explain:1", "sup-explain:7"],
    },
    items: chunks("sup-explain", [
      { text: "Here's what I found", ipa: "/hɪrz wʌt aɪ faʊnd/", meaning: "Esto es lo que encontré", hint: "Abre la explicación. 'Here's' = 'HIRZ'." },
      { text: "The good news is I can fix this today", ipa: "/ðə ɡʊd njuːz ɪz aɪ kæn fɪks ðɪs təˈdeɪ/", meaning: "La buena noticia es que puedo resolverlo hoy", hint: "Resultado primero. Cambia el tono de la llamada." },
      { text: "What happened was a system error", ipa: "/wʌt ˈhæpənd wʌz ə ˈsɪstəm ˈɛrər/", meaning: "Lo que pasó fue un error del sistema", hint: "Explica sin culpar a nadie ni a ti misma." },
      { text: "I've already updated your account", ipa: "/aɪv ɔːlˈrɛdi ʌpˈdeɪtɪd jɔːr əˈkaʊnt/", meaning: "Ya actualicé su cuenta", hint: "'I've already' = ya lo hice. Presente perfecto, muy usado." },
      { text: "You'll see the refund in three to five business days", ipa: "/juːl siː ðə ˈriːfʌnd ɪn θriː tuː faɪv ˈbɪznɪs deɪz/", meaning: "Verá el reembolso en tres a cinco días hábiles", hint: "'business days' = días hábiles. Da plazos reales." },
      { text: "The next step is to confirm your address", ipa: "/ðə nɛkst stɛp ɪz tuː kənˈfɜːrm jɔːr əˈdrɛs/", meaning: "El siguiente paso es confirmar su dirección", hint: "'next step' estructura la llamada." },
      { text: "Does that make sense so far?", ipa: "/dʌz ðæt meɪk sɛns soʊ fɑːr/", meaning: "¿Voy bien hasta ahí?", hint: "Verifica que te sigue, sin sonar condescendiente." },
      { text: "I'm sending you a confirmation email", ipa: "/aɪm ˈsɛndɪŋ juː ə ˌkɑːnfərˈmeɪʃən ˈiːmeɪl/", meaning: "Le estoy enviando un correo de confirmación", hint: "Cierra el ciclo. Reduce llamadas repetidas." },
      { text: "There's nothing else you need to do", ipa: "/ðɛrz ˈnʌθɪŋ ɛls juː niːd tuː duː/", meaning: "No tiene que hacer nada más", hint: "Frase que más tranquiliza. Úsala cuando sea verdad." },
      { text: "If it doesn't arrive, call us back and ask for me", ipa: "/ɪf ɪt ˈdʌzənt əˈraɪv kɔːl ʌs bæk ænd æsk fɔːr miː/", meaning: "Si no llega, llámenos y pregunte por mí", hint: "Ofrece una salida. Genera confianza." },
    ]),
  },
  {
    id: "sup-spell",
    title: "Spelling & numbers",
    subtitle: "Deletrear y números",
    description: "Names, emails, and confirmation numbers, heard correctly the first time.",
    kind: "phrase",
    categoryIds: ["conversation"],
    track: "conversation",
    order: 55,
    intro: {
      summary:
        "This is where calls actually break. A misheard digit creates the wrong order; a misheard letter creates the wrong account. It is also pure pronunciation work, so everything you learned in the sounds lessons pays off here.",
      whyTricky:
        "English letter names trap Spanish speakers: E sounds like Spanish I, I sounds like 'ai', G and J are swapped from Spanish habits. And fifteen/fifty, thirteen/thirty differ only by which syllable you stress.",
      how: [
        "Use the alphabet trick: 'M as in Mary'.",
        "Group digits and pause: 'four four nine — two one seven'.",
        "Always read it back before you act on it.",
      ],
      exampleIds: ["sup-spell:1", "sup-spell:4"],
    },
    items: chunks("sup-spell", [
      { text: "That's M as in Mary", ipa: "/ðæts ɛm æz ɪn ˈmɛri/", meaning: "Es M de María", hint: "El truco estándar. Evita confundir M con N." },
      { text: "B as in boy, not V as in Victor", ipa: "/biː æz ɪn bɔɪ nɑːt viː æz ɪn ˈvɪktər/", meaning: "B de burro, no V de Victor", hint: "Tu confusión número uno. Practícala en voz alta." },
      { text: "Let me read the number back to you", ipa: "/lɛt miː riːd ðə ˈnʌmbər bæk tuː juː/", meaning: "Permítame repetirle el número", hint: "Obligatorio antes de actuar. Te salva del error caro." },
      { text: "Is that five zero, or five oh?", ipa: "/ɪz ðæt faɪv ˈzɪroʊ ɔːr faɪv oʊ/", meaning: "¿Es cinco cero, o cinco 'oh'?", hint: "Los americanos dicen 'oh' por cero. Confirma." },
      { text: "Thirty, three zero", ipa: "/ˈθɜːrti θriː ˈzɪroʊ/", meaning: "Treinta, tres cero", hint: "Di el número y luego los dígitos. Elimina la duda." },
      { text: "All lowercase, no spaces", ipa: "/ɔːl ˈloʊərkeɪs noʊ ˈspeɪsɪz/", meaning: "Todo en minúscula, sin espacios", hint: "Para correos. 'lowercase' = minúscula." },
      { text: "Is there a hyphen or an underscore?", ipa: "/ɪz ðɛr ə ˈhaɪfən ɔːr ən ˈʌndərskɔːr/", meaning: "¿Lleva guion o guion bajo?", hint: "'hyphen' = guion, 'underscore' = guion bajo." },
      { text: "At gmail dot com", ipa: "/æt ˈdʒiːmeɪl dɑːt kɑːm/", meaning: "Arroba gmail punto com", hint: "'at' = arroba, 'dot' = punto. Nunca 'arroba'." },
      { text: "Your confirmation number is one two three", ipa: "/jɔːr ˌkɑːnfərˈmeɪʃən ˈnʌmbər ɪz wʌn tuː θriː/", meaning: "Su número de confirmación es uno dos tres", hint: "Dígito por dígito, con pausas. No 'ciento veintitrés'." },
      { text: "I'll spell it slowly for you", ipa: "/aɪl spɛl ɪt ˈsloʊli fɔːr juː/", meaning: "Se lo deletreo despacio", hint: "Ofrécelo antes de que lo pidan." },
    ]),
  },
  {
    id: "sup-close",
    title: "Closing the call",
    subtitle: "Cerrar la llamada",
    description: "Check nothing is left, then close warmly.",
    kind: "phrase",
    categoryIds: ["conversation"],
    track: "conversation",
    order: 56,
    intro: {
      summary:
        "The close is scored on two things: did you ask whether anything else was needed, and did you thank them by name. It takes eight seconds and it is what customers remember.",
      whyTricky:
        "'Anything else?' alone sounds like you want them off the phone. And 'Bye' is too abrupt for American service English — there is a small ritual before it.",
      how: [
        "Ask if anything else is open — fully, not clipped.",
        "Recap what will happen next in one line.",
        "Thank them, use their name, then close.",
      ],
      exampleIds: ["sup-close:1", "sup-close:6"],
    },
    items: chunks("sup-close", [
      { text: "Is there anything else I can help you with?", ipa: "/ɪz ðɛr ˈɛniθɪŋ ɛls aɪ kæn hɛlp juː wɪð/", meaning: "¿Hay algo más en que le pueda ayudar?", hint: "La frase completa, no solo 'anything else'." },
      { text: "So just to recap", ipa: "/soʊ dʒʌst tuː ˈriːkæp/", meaning: "En resumen", hint: "'recap' = resumir. Cierra sin dejar dudas." },
      { text: "You should receive that shortly", ipa: "/juː ʃʊd rɪˈsiːv ðæt ˈʃɔːrtli/", meaning: "Debería recibirlo pronto", hint: "'shortly' suena más profesional que 'soon'." },
      { text: "Thank you for calling, Mr. Miller", ipa: "/θæŋk juː fɔːr ˈkɔːlɪŋ ˈmɪstər ˈmɪlər/", meaning: "Gracias por llamar, señor Miller", hint: "Usa el apellido. Es lo que más se recuerda." },
      { text: "You have a great day", ipa: "/juː hæv ə ɡreɪt deɪ/", meaning: "Que tenga un buen día", hint: "Muy americano. Cálido y estándar." },
      { text: "If you have any questions, we're here", ipa: "/ɪf juː hæv ˈɛni ˈkwɛstʃənz wɪr hɪr/", meaning: "Si tiene preguntas, aquí estamos", hint: "Deja la puerta abierta sin invitar otra queja." },
      { text: "I'm glad we got that resolved", ipa: "/aɪm ɡlæd wiː ɡɑːt ðæt rɪˈzɑːlvd/", meaning: "Me alegra que lo hayamos resuelto", hint: "'resolved' = resuelto. 'we' comparte el logro." },
      { text: "You'll get a short survey after this call", ipa: "/juːl ɡɛt ə ʃɔːrt ˈsɜːrveɪ ˈæftər ðɪs kɔːl/", meaning: "Recibirá una encuesta corta después de esta llamada", hint: "La encuesta es tu calificación. Menciónala con calma." },
      { text: "Thanks again for your time", ipa: "/θæŋks əˈɡɛn fɔːr jɔːr taɪm/", meaning: "Gracias de nuevo por su tiempo", hint: "Cierre corto y elegante." },
      { text: "Take care", ipa: "/teɪk kɛr/", meaning: "Cuídese", hint: "Despedida cálida y muy común. Mejor que solo 'bye'." },
    ]),
  },
  {
    id: "sup-limits",
    title: "Saying no professionally",
    subtitle: "Decir no con profesionalismo",
    description: "Refuse, admit you don't know, and hold a boundary.",
    kind: "phrase",
    categoryIds: ["conversation"],
    track: "conversation",
    order: 57,
    intro: {
      summary:
        "You will not be able to do everything a customer asks. Saying so clearly is a senior skill — vague agreement to avoid conflict is what creates escalations later.",
      whyTricky:
        "'No' alone reads as hostile in English service, but so does over-apologising. The pattern is: what you cannot do, then immediately what you can.",
      how: [
        "Never leave a no without an alternative.",
        "'I don't know' is fine when followed by 'let me find out'.",
        "Stay warm and stay firm — those are not opposites.",
      ],
      exampleIds: ["sup-limits:1", "sup-limits:4"],
    },
    items: chunks("sup-limits", [
      { text: "I'm not able to do that, but here's what I can do", ipa: "/aɪm nɑːt ˈeɪbəl tuː duː ðæt bʌt hɪrz wʌt aɪ kæn duː/", meaning: "No puedo hacer eso, pero esto sí puedo hacer", hint: "El patrón completo. Nunca el 'no' solo." },
      { text: "That's outside what I can access", ipa: "/ðæts aʊtˈsaɪd wʌt aɪ kæn ˈæksɛs/", meaning: "Eso está fuera de lo que puedo ver", hint: "Explica el límite sin sonar a excusa." },
      { text: "I don't know, but let me find out", ipa: "/aɪ doʊnt noʊ bʌt lɛt miː faɪnd aʊt/", meaning: "No sé, pero permítame averiguarlo", hint: "Honestidad con acción. Nunca inventes una respuesta." },
      { text: "Let me check with someone who can", ipa: "/lɛt miː tʃɛk wɪð ˈsʌmwʌn huː kæn/", meaning: "Permítame consultar con alguien que sí pueda", hint: "Convierte tu límite en un camino." },
      { text: "I understand, and I wish I could", ipa: "/aɪ ˌʌndərˈstænd ænd aɪ wɪʃ aɪ kʊd/", meaning: "Entiendo, y ojalá pudiera", hint: "'I wish I could' = ojalá pudiera. Empatía sin ceder." },
      { text: "The policy doesn't allow that, unfortunately", ipa: "/ðə ˈpɑːləsi ˈdʌzənt əˈlaʊ ðæt ʌnˈfɔːrtʃənətli/", meaning: "La política no lo permite, desafortunadamente", hint: "'policy' = política. Al final suaviza." },
      { text: "What I can offer is a replacement", ipa: "/wʌt aɪ kæn ˈɔːfər ɪz ə rɪˈpleɪsmənt/", meaning: "Lo que puedo ofrecer es un reemplazo", hint: "Redirige a lo posible. Estructura muy útil." },
      { text: "I'd rather be honest with you", ipa: "/aɪd ˈræðər biː ˈɑːnɪst wɪð juː/", meaning: "Prefiero serle honesta", hint: "'I'd rather' = preferiría. Gana confianza." },
      { text: "Let me set the right expectation", ipa: "/lɛt miː sɛt ðə raɪt ˌɛkspɛkˈteɪʃən/", meaning: "Permítame aclarar qué esperar", hint: "Evita decepciones después. Frase muy profesional." },
      { text: "I don't want to promise something I can't deliver", ipa: "/aɪ doʊnt wɑːnt tuː ˈprɑːmɪs ˈsʌmθɪŋ aɪ kænt dɪˈlɪvər/", meaning: "No quiero prometer algo que no pueda cumplir", hint: "Convierte un no en integridad." },
    ]),
  },
  {
    id: "sup-interview",
    title: "The job interview",
    subtitle: "La entrevista",
    description: "Get through the screen: yourself, the company, schedule, and pay.",
    kind: "phrase",
    categoryIds: ["conversation"],
    track: "conversation",
    order: 58,
    intro: {
      summary:
        "The interview is the actual gate. Most of it is four or five predictable questions, so the winning strategy is to have your answers so rehearsed that your English sounds effortless.",
      whyTricky:
        "'Tell me about yourself' is not asking for your life story — it wants ninety seconds about your work. And when asked about a weakness, name a real one plus what you are doing about it.",
      how: [
        "Present, then past, then why this job.",
        "Give numbers where you can — they sound concrete.",
        "Always have two questions ready for them.",
      ],
      exampleIds: ["sup-interview:1", "sup-interview:5"],
    },
    items: chunks("sup-interview", [
      { text: "Thanks for taking the time to meet with me", ipa: "/θæŋks fɔːr ˈteɪkɪŋ ðə taɪm tuː miːt wɪð miː/", meaning: "Gracias por tomarse el tiempo de reunirse conmigo", hint: "Tu primera frase. Cálida y profesional." },
      { text: "I've been working in customer service for two years", ipa: "/aɪv bɪn ˈwɜːrkɪŋ ɪn ˈkʌstəmər ˈsɜːrvɪs fɔːr tuː jɪrz/", meaning: "He trabajado en servicio al cliente por dos años", hint: "'I've been working' = sigo en eso. Empieza por el presente." },
      { text: "I'm good at staying calm with difficult customers", ipa: "/aɪm ɡʊd æt ˈsteɪɪŋ kɑːm wɪð ˈdɪfɪkəlt ˈkʌstəmərz/", meaning: "Soy buena manteniendo la calma con clientes difíciles", hint: "'good at' + verbo con -ing. Tu fortaleza clave." },
      { text: "I'm working on speaking more confidently in English", ipa: "/aɪm ˈwɜːrkɪŋ ɑːn ˈspiːkɪŋ mɔːr ˈkɑːnfɪdəntli ɪn ˈɪŋɡlɪʃ/", meaning: "Estoy trabajando en hablar inglés con más confianza", hint: "Debilidad real más acción. Nunca 'no tengo debilidades'." },
      { text: "I'm interested in this company because you support customers worldwide", ipa: "/aɪm ˈɪntrəstɪd ɪn ðɪs ˈkʌmpəni bɪˈkʌz juː səˈpɔːrt ˈkʌstəmərz ˈwɜːrldwaɪd/", meaning: "Me interesa esta empresa porque atienden clientes en todo el mundo", hint: "Menciona algo específico de ellos. Se nota." },
      { text: "I'm available for the night shift", ipa: "/aɪm əˈveɪləbəl fɔːr ðə naɪt ʃɪft/", meaning: "Estoy disponible para el turno de la noche", hint: "'shift' = turno. Los BPO preguntan esto siempre." },
      { text: "I'm looking for something in that range", ipa: "/aɪm ˈlʊkɪŋ fɔːr ˈsʌmθɪŋ ɪn ðæt reɪndʒ/", meaning: "Busco algo en ese rango", hint: "Para el salario. No des una cifra exacta primero." },
      { text: "Could you tell me more about the training?", ipa: "/kʊd juː tɛl miː mɔːr əˈbaʊt ðə ˈtreɪnɪŋ/", meaning: "¿Me puede contar más sobre la capacitación?", hint: "Ten dos preguntas listas. Muestra interés real." },
      { text: "That's a great question, let me think for a second", ipa: "/ðæts ə ɡreɪt ˈkwɛstʃən lɛt miː θɪŋk fɔːr ə ˈsɛkənd/", meaning: "Buena pregunta, déjeme pensar un segundo", hint: "Compra tiempo sin sonar perdida. Totalmente aceptable." },
      { text: "When can I expect to hear back from you?", ipa: "/wɛn kæn aɪ ɪkˈspɛkt tuː hɪr bæk frʌm juː/", meaning: "¿Cuándo puedo esperar su respuesta?", hint: "'hear back' = recibir respuesta. Cierra la entrevista tú." },
    ]),
  },
];
