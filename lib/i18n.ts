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
  homeExplore: { es: "Explorar todo", en: "Explore everything" },
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

  // Student settings
  settingsTitle: { es: "Ajustes", en: "Settings" },
  settingsName: { es: "Tu nombre", en: "Your name" },
  settingsCoach: { es: "Idioma de las explicaciones", en: "Coaching language" },
  settingsGoal: { es: "Meta diaria de XP", en: "Daily XP goal" },
  settingsSound: { es: "Sonidos del juego", en: "Game sounds" },
  settingsSync: { es: "Tu código de sincronización", en: "Your sync code" },
  settingsSyncSub: {
    es: "Guárdalo: identifica tu progreso si cambias de teléfono.",
    en: "Keep it safe — it identifies your progress if you switch phones.",
  },
  settingsCopy: { es: "Copiar", en: "Copy" },
  settingsCopied: { es: "¡Copiado!", en: "Copied!" },
  pushTitle: { es: "Recordatorio diario", en: "Daily reminder" },
  pushSub: {
    es: "Lumi te avisa una vez al día para no perder tu racha.",
    en: "Lumi nudges you once a day so your streak survives.",
  },
  pushEnable: { es: "Activar", en: "Turn on" },
  pushEnabled: { es: "Activado — te avisamos a las ~6 pm", en: "On — we'll nudge you around 6 pm" },
  pushDisable: { es: "Desactivar", en: "Turn off" },
  pushDenied: {
    es: "Las notificaciones están bloqueadas en los ajustes del navegador.",
    en: "Notifications are blocked in your browser settings.",
  },
  pushNeedsInstall: {
    es: "En iPhone: primero agrega Clara a tu pantalla de inicio (Compartir → Agregar a inicio) y ábrela desde ahí.",
    en: "On iPhone: first add Clara to your Home Screen (Share → Add to Home Screen) and open it from there.",
  },
  pushError: { es: "No se pudo activar. Intenta de nuevo.", en: "Couldn't turn it on. Try again." },

  settingsDanger: { es: "Zona de peligro", en: "Danger zone" },
  settingsReset: { es: "Borrar todo mi progreso", en: "Erase all my progress" },
  settingsResetSub: {
    es: "Borra estrellas, rachas y todo el avance en este dispositivo. No se puede deshacer.",
    en: "Erases stars, streaks, and all progress on this device. Cannot be undone.",
  },
  settingsResetConfirm: { es: "¿Segura? Toca otra vez para borrar todo.", en: "Sure? Tap again to erase everything." },

  // Sentence builder
  buildCard: { es: "Arma la frase", en: "Build it" },
  buildCardSub: { es: "Escucha y ordena las palabras", en: "Hear it, then order the words" },
  buildTitle: { es: "Arma la frase", en: "Build the sentence" },
  buildIntro: {
    es: "Escucha la frase y toca las palabras en el orden correcto. Así el orden del inglés se te mete en los dedos.",
    en: "Hear the phrase, then tap the words into the right order. English word order, straight into your fingers.",
  },
  buildTapWords: { es: "Toca las palabras en orden…", en: "Tap the words in order…" },
  buildUndo: { es: "Quitar la última", en: "Remove last" },

  // Duet mode
  duetCard: { es: "Escena a dos", en: "Duet scene" },
  duetCardSub: { es: "Actúa una escena con Joel", en: "Act a scene with Joel" },
  duetTitle: { es: "Escena a dos", en: "Duet scenes" },
  duetIntro: {
    es: "Tú y Joel actúan una mini-escena: él dice su línea con su voz, y tú respondes con la tuya al micrófono.",
    en: "You and Joel act out a mini-scene: he says his line in his voice, you answer yours into the mic.",
  },
  duetYourLine: { es: "Tu línea — toca y habla", en: "Your line — tap and speak" },
  duetDone: { es: "¡Escena completa!", en: "Scene complete!" },
  duetNeedsMic: { es: "Las escenas necesitan el micrófono", en: "Duet scenes need the mic" },

  // Media zone (Cine y música + easy news)
  mediaCard: { es: "Cine y música", en: "Movies & music" },
  mediaCardSub: { es: "Tráilers, canciones y noticias de verdad", en: "Real trailers, songs, and news" },
  mediaTitle: { es: "Cine y música", en: "Movies & music" },
  mediaIntro: {
    es: "Inglés americano de verdad: tráilers oficiales, canciones del momento y noticias fáciles. Mira, caza palabras y gana estrellas.",
    en: "Real American English: official trailers, current songs, and easy news. Watch, hunt words, and earn stars.",
  },
  mediaSongs: { es: "Música", en: "Music" },
  mediaTrailers: { es: "Cine", en: "Movies" },
  mediaNews: { es: "Noticias de hoy — en inglés fácil", en: "Today's news — in easy English" },
  mediaNewsLoading: { es: "Buscando las noticias…", en: "Fetching the news…" },
  mediaHunt: { es: "Caza de palabras — toca cada palabra cuando la escuches", en: "Word hunt — tap each word when you hear it" },
  mediaHuntDone: { es: "¡Cazadas todas! Oído de acero.", en: "Got them all! Ears of steel." },
  mediaWatch: { es: "Ver", en: "Watch" },
  mediaClose: { es: "Cerrar", en: "Close" },

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
  // Four-space navigation (redesign): Hoy · Camino · Hablar · Yo
  navCamino: { es: "Camino", en: "Path" },
  navYo: { es: "Yo", en: "Me" },

  // Shadowing / listening game
  shadowCard: { es: "Escucha y repite", en: "Listen & echo" },
  shadowCardSub: { es: "Repite después de Joel — y otras voces", en: "Echo after Joel — and other voices" },
  shadowTitle: { es: "Escucha y repite", en: "Listen & echo" },
  shadowIntro: { es: "Escucha una frase y repítela enseguida, igualito. Casi siempre es Joel, con otras voces americanas de vez en cuando — así entrenas el oído para el inglés real.", en: "Hear a phrase, then echo it right back. It's mostly Joel, with other American voices now and then — that's how you train your ear for real English." },
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
  rarityLegendary: { es: "Legendario", en: "Legendary" },
  shopPets: { es: "Mascotas", en: "Pets" },
  mundoEyebrow: { es: "Mi mundo", en: "My world" },
  mundoTitle: { es: "Tu mundo", en: "Your world" },
  mundoIntro: { es: "Todo lo que has construido, en un solo lugar.", en: "Everything you've built, in one place." },
  mundoWords: { es: "Palabras que sabes", en: "Words you know" },
  mundoSoundsMastered: { es: "Sonidos dominados", en: "Sounds mastered" },
  mundoLevelTo: { es: "para el siguiente nivel", en: "to the next level" },
  mundoActivity: { es: "Tu constancia", en: "Your consistency" },
  mundoActivitySub: { es: "Los días que practicaste este mes", en: "The days you practiced this month" },
  mundoYourSounds: { es: "Tus sonidos", en: "Your sounds" },
  mundoNav: { es: "Mundo", en: "World" },
  mundoEmpty: { es: "Practica un poquito y aquí verás crecer tu mundo.", en: "Practice a little and watch your world grow here." },
  mundoVoice: { es: "Tu voz", en: "Your voice" },
  mundoVoiceSub: { es: "Escúchate — tu mejor toma de cada frase, guardada solo en tu teléfono.", en: "Hear yourself — your best take of each phrase, kept only on your phone." },
  mundoVoiceFirst: { es: "1.ª vez", en: "1st try" },
  radioCard: { es: "Radio de Joel", en: "Joel radio" },
  radioTitle: { es: "Radio de Joel", en: "Joel radio" },
  radioIntro: { es: "Solo escucha. Joel dice cada frase, luego el significado, y la repite. Perfecta para el bus o la cocina — sin micrófono.", en: "Just listen. Joel says each phrase, then the meaning, then says it again. Perfect for the bus or the kitchen — no mic." },
  radioPlay: { es: "Escuchar", en: "Listen" },
  radioPause: { es: "Pausa", en: "Pause" },
  radioSayMeaning: { es: "Decir el significado", en: "Say the meaning" },
  radioOf: { es: "de", en: "of" },
  installTitle: { es: "Instala Clara en tu iPhone", en: "Install Clara on your iPhone" },
  installBody: { es: "Toca Compartir y luego “Agregar a inicio”. Así tu progreso queda protegido y te llegan los recordatorios.", en: "Tap Share, then “Add to Home Screen”. That protects your progress and enables reminders." },
  installDismiss: { es: "Ahora no", en: "Not now" },
  shopOutfits: { es: "Looks de Lumi", en: "Lumi's looks" },
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
  greetMorning: { es: "Buenos días", en: "Good morning" },
  greetAfternoon: { es: "Buenas tardes", en: "Good afternoon" },
  greetEvening: { es: "Buenas noches", en: "Good evening" },
  heroStreakLine: { es: "Racha de {n} días — sigamos hoy.", en: "{n}-day streak — let's keep it today." },
  heroWelcomeBack: { es: "Qué bueno verte de nuevo.", en: "So good to see you again." },

  // Player bar
  level: { es: "Nivel", en: "Level" },
  xpToNext: { es: "XP para subir", en: "XP to next" },
  dayStreak: { es: "días seguidos", en: "day streak" },
  streakStart: { es: "¡empieza tu racha!", en: "start your streak!" },
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
  recNoSpeech: { es: "No te escuchamos. Habla un poquito más fuerte e intenta otra vez.", en: "We didn't catch that. Speak up a little and try again." },
  recSilent: { es: "No se detectó el micrófono. Revisa el permiso del micrófono y vuelve a intentar.", en: "We couldn't hear the mic. Check microphone access and try again." },
  recNotAllowed: { es: "El micrófono está bloqueado. Actívalo en los ajustes del navegador.", en: "The microphone is blocked. Allow it in your browser settings." },
  recConsent: { es: "Para practicar con tu voz, acepta el aviso de privacidad (puedes hacerlo tocando el micrófono otra vez). Todo lo demás sigue disponible sin micrófono.", en: "To practice with your voice, accept the privacy notice (tap the mic again to see it). Everything else works without a microphone." },
  recNetwork: { es: "No pudimos calificar eso. Revisa tu conexión e intenta otra vez.", en: "Couldn't score that. Check your connection and try again." },
  recGeneric: { es: "Algo salió mal. Intenta otra vez.", en: "Something went wrong. Try again." },
  lumiReady: { es: "Cuando quieras — ¡tú puedes!", en: "Whenever you're ready — you've got this!" },
  lumiListening: { es: "Te escucho...", en: "I'm listening..." },
  lumiScoring: { es: "Mmm, a ver...", en: "Hmm, let's see..." },
  introIdea: { es: "La idea", en: "The idea" },
  introNext: { es: "Siguiente", en: "Next" },
  introBack: { es: "Atrás", en: "Back" },
  introCardOf: { es: "de", en: "of" },
  mapHere: { es: "¡Aquí vas!", en: "You're here!" },
  todayChest: { es: "Cofre diario", en: "Daily chest" },
  todayChestLocked: { es: "Completa los 3 pasos para abrirlo", en: "Finish the 3 steps to open it" },
  todayChestReady: { es: "¡Listo! Ábrelo en la tienda", en: "Ready! Open it in the shop" },
  todayChestOpened: { es: "Abierto hoy — vuelve mañana", en: "Opened today — come back tomorrow" },
  settingsDifficulty: { es: "Nivel de exigencia", en: "Scoring strictness" },
  diffAuto: { es: "Automático", en: "Adaptive" },
  diffAutoSub: { es: "Se ajusta a ti: más fácil si te cuesta, más exigente cuando vas bien — recomendado", en: "Adjusts to you: easier when you struggle, tougher when you're cruising — recommended" },
  diffGentle: { es: "Suave", en: "Gentle" },
  diffGentleSub: { es: "Siempre más fácil aprobar mientras aprendes", en: "Always easier to pass while you learn" },
  diffNormal: { es: "Exigente", en: "Strict" },
  diffNormalSub: { es: "La barra completa, para pulir el acento", en: "The full bar, for polishing your accent" },

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
  recapStruggled: { es: "Hoy costó más y no te rendiste — así es como de verdad se te queda.", en: "Today was tougher and you didn't give up — that's how it really sticks." },
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
  fixMispronounced: { es: "necesita trabajo", en: "needs work" },
  scorePron: { es: "Pronunciación", en: "Pronunciation" },
  scoreFluency: { es: "Fluidez", en: "Fluency" },

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
