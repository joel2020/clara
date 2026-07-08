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
  planCardSub: { es: "Qué practicar cada semana, junto a tus clases", en: "What to practice each week, alongside your live classes" },
  reviewTitleOne: { es: "palabra lista para repasar", en: "word is ready for review" },
  reviewTitleMany: { es: "palabras listas para repasar", en: "words are ready for review" },
  reviewSub: { es: "Un repaso rápido de los sonidos que se te escapan.", en: "A quick refresh on the sounds you've been missing." },

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
