// UI strings for the coaching layer, in the student's language. The practice
// CONTENT (words, sentences, IPA) is always English — that's what she's
// learning. The INSTRUCTIONS meet her where she is: Spanish for beginners
// ("es", the default), English for advanced students ("en").

export type CoachLang = "es" | "en";

const STRINGS = {
  // Header / nav
  navLessons: { es: "Lecciones", en: "Lessons" },
  navSounds: { es: "Sonidos", en: "Sounds" },

  // Home
  heroEyebrow: { es: "Pronunciación en inglés", en: "English pronunciation" },
  heroTitleTop: { es: "Dilo claro.", en: "Dilo claro." },
  heroTitleBottom: { es: "Say it clearly.", en: "Say it clearly." },
  heroBody: {
    es: "De Colombia al mundo — ejercicios cortos enfocados en los sonidos del inglés que más nos cuestan a los hispanohablantes. Escucha, habla, y mira tu progreso.",
    en: "De Colombia al mundo — focused drills built around the exact sounds Spanish speakers find tricky. Listen, speak, and watch the rough edges smooth out.",
  },
  speedRound: { es: "Ronda rápida", en: "Speed round" },
  speedRoundSub: { es: "15 palabras, supera tu combo", en: "15 words, beat your combo" },
  lessonsHeading: { es: "Lecciones", en: "Lessons" },
  trackConversation: { es: "Conversación", en: "Conversation" },
  trackConversationSub: { es: "Frases para la vida real — tu ruta más rápida a hablar", en: "Real-life chunks — your fastest route to speaking" },
  trackSounds: { es: "Sonidos", en: "Sounds" },
  trackSoundsSub: { es: "Los sonidos del inglés que más nos cuestan", en: "The English sounds Spanish speakers find hardest" },
  planCard: { es: "Tu plan de 12 semanas", en: "Your 12-week plan" },
  planCardSub: { es: "Qué practicar cada semana, a tu ritmo", en: "What to practice each week, at your own pace" },
  homeGames: { es: "Juega y practica", en: "Play & practice" },
  lessonsCardSub: { es: "Todas las unidades y sonidos", en: "Every unit and sound" },

  // Review page
  reviewLoading: { es: "Cargando repaso…", en: "Loading review…" },
  reviewAllDone: { es: "Estás al día", en: "All caught up" },
  reviewAllDoneSub: {
    es: "No tienes nada pendiente ahora. Practica una lección para seguir sumando.",
    en: "Nothing's due right now. Practice a lesson to keep building.",
  },
  backHome: { es: "Volver al inicio", en: "Back home" },
  reviewLessonTitle: { es: "Repaso", en: "Review" },
  reviewLessonSub: { es: "Palabras por refrescar", en: "Words to refresh" },

  // Speed round
  srNeedsMic: { es: "La ronda rápida necesita el micrófono", en: "Speed Round needs the mic" },
  srNeedsMicSub: {
    es: "Este navegador no puede calificar tu voz. Abre Clara en Google Chrome para jugar.",
    en: "This browser can't score speech. Open Clara in Google Chrome to play.",
  },
  playAgain: { es: "Jugar otra vez", en: "Play again" },
  srSayIt: { es: "¡Dilo ya!", en: "Say it!" },
  srSayThenStop: { es: "Dilo y toca detener", en: "Say it, then tap stop" },
  srTapFast: { es: "Toca y habla — ¡rápido!", en: "Tap and speak — fast!" },

  reviewTitleOne: { es: "palabra lista para repasar", en: "word is ready for review" },
  reviewTitleMany: { es: "palabras listas para repasar", en: "words are ready for review" },
  reviewSub: { es: "Un repaso rápido de los sonidos que se te escapan.", en: "A quick refresh on the sounds you've been missing." },

  // Adventure map / journey
  mapCard: { es: "Tu aventura", en: "Your journey" },
  mapCardSub: { es: "El camino, paso a paso", en: "Your path, step by step" },
  mapEyebrow: { es: "El camino", en: "The path" },
  mapTitle: { es: "Tu aventura", en: "Your journey" },
  mapIntro: { es: "Avanza por el camino: cada parada te acerca a hablar inglés americano.", en: "Follow the path — each stop gets you closer to speaking American English." },
  mapFinish: { es: "¡Conversacional!", en: "Conversational!" },
  mapWorldConv: { es: "Mundo 1 · Conversación", en: "World 1 · Conversation" },
  mapWorldSounds: { es: "Mundo 2 · Sonidos", en: "World 2 · Sounds" },
  mapStops: { es: "paradas completas", en: "stops complete" },

  // Listening comprehension game
  listenCard: { es: "Oído de acero", en: "Sharp ears" },
  listenCardSub: { es: "Escucha sin leer y adivina el significado", en: "Hear it — no reading — and pick the meaning" },
  listenTitle: { es: "Oído de acero", en: "Sharp ears" },
  listenIntro: {
    es: "Escucha la frase — sin verla escrita — y elige qué significa. Así se entiende el inglés de la vida real.",
    en: "Hear the phrase — no text — and choose what it means. That's how you learn to understand real-life English.",
  },
  listenWhich: { es: "¿Qué significa?", en: "What does it mean?" },

  // Bottom navigation (mobile)
  navHome: { es: "Inicio", en: "Home" },
  navToday: { es: "Hoy", en: "Today" },
  navTalk: { es: "Hablar", en: "Talk" },
  navListenTab: { es: "Oído", en: "Ears" },
  navMap: { es: "Mapa", en: "Map" },

  // Shadowing / listening game
  shadowCard: { es: "Escucha y repite", en: "Listen & echo" },
  shadowCardSub: { es: "Distintas voces americanas — entrena tu oído", en: "Different American voices — train your ear" },
  shadowTitle: { es: "Escucha y repite", en: "Listen & echo" },
  shadowIntro: { es: "Escucha una frase y repítela enseguida, igualito. Oirás distintas voces americanas — así entrenas el oído para el inglés real.", en: "Hear a phrase, then echo it right back. You'll hear different American voices — that's how you train your ear for real English." },
  shadowStart: { es: "Empezar", en: "Start" },
  shadowListen: { es: "Escucha bien…", en: "Listen closely…" },
  shadowRepeat: { es: "Ahora repite", en: "Now repeat" },
  shadowReplay: { es: "Escuchar otra vez", en: "Hear it again" },
  shadowExit: { es: "Salir", en: "Exit" },
  shadowNeedsMic: { es: "Repetir necesita el micrófono", en: "Shadowing needs the mic" },

  // Today's guided session
  todayCard: { es: "Sesión de hoy", en: "Today's session" },
  todayCardSub: { es: "Tu rutina guiada — empieza aquí", en: "Your guided routine — start here" },
  todayTitle: { es: "Tu sesión de hoy", en: "Your session today" },
  todayIntro: { es: "Sigue los pasos y en ~15 minutos habrás practicado todo lo que necesitas hoy.", en: "Follow the steps — in ~15 minutes you'll have practiced everything you need today." },
  todayStart: { es: "Empezar", en: "Start" },
  todayContinue: { es: "Continuar", en: "Continue" },
  todayReview: { es: "Calentamiento", en: "Warm up" },
  todayReviewSub: { es: "Repasa lo que ya viste", en: "Refresh what you've seen" },
  todayReviewNone: { es: "Nada que repasar hoy — ¡listo!", en: "Nothing to review today — done!" },
  todayLearn: { es: "Aprende", en: "Learn" },
  todayTalk: { es: "Conversa con Joel", en: "Talk with Joel" },
  todayDoneTitle: { es: "¡Sesión completa!", en: "Session complete!" },
  todayDoneSub: { es: "Lo hiciste todo hoy. Nos vemos mañana.", en: "You did it all today. See you tomorrow." },
  todayStarsToday: { es: "estrellas hoy", en: "stars today" },
  todayStep: { es: "Paso", en: "Step" },

  // Star shop
  shopCard: { es: "Tienda de estrellas", en: "Star shop" },
  shopCardSub: { es: "Gasta tus estrellas en Lumi", en: "Spend your stars on Lumi" },
  shopTitle: { es: "Tienda de Lumi", en: "Lumi's shop" },
  shopIntro: { es: "Gana estrellas hablando bien y vístela a tu gusto.", en: "Earn stars by speaking clearly, then style her up." },
  shopBackgrounds: { es: "Fondos", en: "Backgrounds" },
  shopAccessories: { es: "Accesorios", en: "Accessories" },
  shopEffects: { es: "Efectos", en: "Effects" },
  shopEquip: { es: "Poner", en: "Equip" },
  shopEquipped: { es: "Puesto", en: "Equipped" },
  shopNeedMore: { es: "Te faltan estrellas", en: "Not enough stars" },
  chestTitle: { es: "Cofre diario", en: "Daily chest" },
  chestOpen: { es: "Abrir cofre", en: "Open chest" },
  chestGot: { es: "¡Ganaste", en: "You got" },
  chestBack: { es: "Vuelve mañana por más", en: "Come back tomorrow for more" },

  // Stars (game currency)
  stars: { es: "estrellas", en: "stars" },
  starsEarned: { es: "estrellas ganadas", en: "stars earned" },
  perfectStars: { es: "¡Perfecto! 3 estrellas", en: "Perfect! 3 stars" },
  heroTagline: { es: "¡Hola! Aprende inglés americano jugando.", en: "Hi! Learn American English by playing." },

  // Player bar
  level: { es: "Nivel", en: "Level" },
  xpToNext: { es: "XP para subir", en: "XP to next" },
  dayStreak: { es: "días seguidos", en: "day streak" },
  today: { es: "hoy", en: "today" },

  // Stages / stepper
  stageLearn: { es: "Aprende", en: "Learn" },
  stageEar: { es: "Oído", en: "Ear" },
  stageWords: { es: "Palabras", en: "Words" },
  stageSentences: { es: "Frases", en: "Sentences" },
  learnEyebrow: { es: "Aprende", en: "Learn" },
  earEyebrow: { es: "Entrena el oído", en: "Train your ear" },
  skipToSpeaking: { es: "Saltar a hablar", en: "Skip to speaking" },
  round: { es: "Ronda", en: "Round" },
  whichWord: { es: "¿Cuál palabra escuchaste?", en: "Which word did you hear?" },
  word: { es: "Palabra", en: "Word" },
  sentence: { es: "Frase", en: "Sentence" },
  clear: { es: "claras", en: "clear" },
  onARoll: { es: "¡En racha!", en: "On a roll" },
  combo: { es: "combo", en: "combo" },
  nowYouTry: { es: "Ahora tú", en: "Now you try" },
  mouthPosition: { es: "Posición de la boca", en: "Mouth position" },
  rhythmTip: { es: "Consejo de ritmo", en: "Rhythm tip" },
  not: { es: "no es", en: "not" },
  voice: { es: "voz", en: "voice" },

  // Learn intro
  whyTricky: { es: "Por qué cuesta desde el español", en: "Why it's tricky in Spanish" },
  howToMakeIt: { es: "Cómo se hace", en: "How to make it" },
  hearIt: { es: "Escúchalo — toca para oír", en: "Hear it — tap to listen" },
  letsPractice: { es: "Listo — a practicar", en: "Listo — let's practice" },

  // Listen / record controls
  listen: { es: "Escucha", en: "Listen" },
  slow: { es: "Lento", en: "Slow" },
  otherVoice: { es: "Otra voz", en: "Hear another voice" },
  tapToSpeak: { es: "Toca y habla", en: "Tap to speak" },
  tapToRecord: { es: "Toca, habla y detén", en: "Tap, speak, then stop" },
  listening: { es: "Escuchando… dilo ahora", en: "Listening… say it now" },
  recording: { es: "Grabando… detén al terminar", en: "Recording… tap stop when done" },
  checking: { es: "Revisando…", en: "Checking…" },
  noRecognition: { es: "Este navegador no puede grabar", en: "Recording not supported here" },
  stopRecording: { es: "Detener", en: "Stop recording" },

  // Results
  resultClear: { es: "¡Clarísimo!", en: "Clear." },
  resultWrongTwin: { es: "La gemela equivocada.", en: "Wrong twin." },
  resultAlmost: { es: "Casi.", en: "Almost." },
  heard: { es: "Escuché", en: "Heard" },
  wanted: { es: "querías", en: "wanted" },
  tryAgain: { es: "Otra vez", en: "Try again" },
  next: { es: "Siguiente", en: "Next" },
  finish: { es: "Terminar", en: "Finish" },
  skipToNext: { es: "Saltar a la siguiente", en: "Skip to next" },
  continue: { es: "Continuar", en: "Continue" },

  // Done card
  lessonComplete: { es: "Lección completa", en: "Lesson complete" },
  xpEarned: { es: "xp ganados", en: "xp earned" },
  accuracy: { es: "precisión", en: "accuracy" },
  bestCombo: { es: "mejor combo", en: "best combo" },
  again: { es: "Otra vez", en: "Again" },
  seeSounds: { es: "Tus sonidos", en: "Sounds" },
  missedResurface: {
    es: "Las palabras que fallaste volverán a aparecer pronto.",
    en: "Missed words resurface sooner next time.",
  },

  // Support notice
  supportNone: {
    es: "Este navegador no reproduce audio ni reconoce tu voz. Para la experiencia completa, abre Clara en Google Chrome en un computador.",
    en: "This browser doesn't support audio playback or speech recognition. For the full experience, open Clara in Google Chrome on a computer.",
  },
  supportNoRecognition: {
    es: "Este navegador no puede grabar ni calificar tu voz — puedes escuchar, pero no recibir puntaje. Usa Google Chrome para la experiencia completa.",
    en: "Recording and scoring aren't supported in this browser, so you can listen but can't be scored. Use Google Chrome for the full loop.",
  },

  // Live conversation partner
  talkCard: { es: "Conversación en vivo", en: "Live conversation" },
  talkCardSub: { es: "Habla de verdad con Joel, tu compañero de IA", en: "Really talk with Joel, your AI partner" },
  talkEyebrow: { es: "Habla con Joel", en: "Talk with Joel" },
  talkTitle: { es: "Conversación en vivo", en: "Live conversation" },
  talkIntro: {
    es: "Elige una situación y habla con Joel como en la vida real. Él te responde con su voz, te entiende, y te da un empujoncito cuando lo necesitas.",
    en: "Pick a situation and talk with Joel like in real life. He answers in his own voice, understands you, and nudges you when you need it.",
  },
  talkChoose: { es: "Elige una situación", en: "Choose a situation" },
  talkStart: { es: "Empezar", en: "Start" },
  talkYourTurn: { es: "Tu turno — toca y habla", en: "Your turn — tap and speak" },
  talkListening: { es: "Escuchando… habla ahora", en: "Listening… speak now" },
  talkStop: { es: "Detener", en: "Stop" },
  talkThinking: { es: "Joel está pensando…", en: "Joel is thinking…" },
  talkYouSaid: { es: "Dijiste", en: "You said" },
  talkTip: { es: "Un consejito", en: "A little tip" },
  talkTrySaying: { es: "Puedes decir…", en: "You could say…" },
  talkRestart: { es: "Reiniciar", en: "Restart" },
  talkChange: { es: "Cambiar situación", en: "Change situation" },
  talkReplay: { es: "Repetir", en: "Replay" },
  talkError: { es: "Ups, algo falló. Intenta de nuevo.", en: "Oops, something went wrong. Try again." },
  talkSaved: { es: "Guardado para tu práctica:", en: "Saved to your practice:" },

  // Daily quests
  questsTitle: { es: "Misiones de hoy", en: "Today's missions" },
  questsSub: { es: "Un poquito cada día — así se vuelve fluida.", en: "A little every day — that's how fluency comes." },
  questsAllDone: { es: "¡Misiones completas! +30 XP", en: "Missions complete! +30 XP" },
  questTalk: { es: "Conversa con Joel", en: "Have a conversation" },
  questReview: { es: "Repasa 5 palabras", en: "Review 5 words" },
  questLearn: { es: "Aprende 5 palabras nuevas", en: "Learn 5 new words" },

  // Streak freeze
  freezeTip: {
    es: "Protección de racha: cubre un día perdido para que tu racha no se pierda.",
    en: "Streak freeze: covers one missed day so your streak survives.",
  },
  talkNotConfiguredTitle: { es: "Casi listo", en: "Almost ready" },
  talkNotConfigured: {
    es: "El compañero de conversación necesita una llave de API de Anthropic para funcionar. Añádela y estará lista.",
    en: "The conversation partner needs an Anthropic API key to work. Add it and it's ready to go.",
  },

  // Pinpoint sound diagnosis (result card)
  fixSound: { es: "El sonido a arreglar", en: "The sound to fix" },
  fixSounded: { es: "sonó como", en: "sounded like" },
  fixDropped: { es: "se perdió", en: "got dropped" },
  fixPractice: { es: "Practicar este sonido", en: "Practice this sound" },

  // Feedback lines (mirror scoring.ts buildFeedback)
  fbPerfect: { es: "Perfecto — exactamente así.", en: "Perfect — that's exactly it." },
  fbNice: { es: "Muy bien — se entendió clarito. Sigue así.", en: "Nice — that's clear. Keep it up." },
  fbClose: { es: "Cerquita. Escúchala otra vez y repítela.", en: "Close. Listen once more, then try again." },
  fbNotQuite: {
    es: "Todavía no. Toca Escucha, mira el consejo de boca, e inténtalo de nuevo.",
    en: "Not quite. Tap Listen, watch the mouth hint, and give it another go.",
  },
} as const;

export type StringKey = keyof typeof STRINGS;

export function t(key: StringKey, lang: CoachLang): string {
  return STRINGS[key][lang];
}

/** "That sounded like X. Aim for Y…" — the minimal-pair miss, translated. */
export function partnerFeedback(partner: string, target: string, lang: CoachLang): string {
  return lang === "es"
    ? `Eso sonó como "${partner}". La meta es "${target}" — nota la diferencia e inténtalo otra vez.`
    : `That sounded like "${partner}". Aim for "${target}" — notice the difference and try again.`;
}
