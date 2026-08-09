import Link from "next/link";

const H = ({ es, en }: { es: string; en: string }) => (
  <h2 className="mt-8 font-display text-xl font-semibold">
    {es} <span className="block text-sm font-normal text-muted-foreground">{en}</span>
  </h2>
);

const P = ({ es, en }: { es: string; en: string }) => (
  <>
    <p className="mt-3 text-sm leading-relaxed">{es}</p>
    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{en}</p>
  </>
);

/** One shared notice for the public login link and the authenticated route. */
export function PrivacyNotice() {
  return (
    <div className="mx-auto max-w-xl px-5 pb-24 pt-6 sm:px-6">
      <Link href="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
        ← Inicio · Home
      </Link>
      <h1 className="mt-5 font-display text-3xl font-semibold tracking-[-0.02em]">
        Tu voz y tus datos
        <span className="block text-lg font-normal text-muted-foreground">Your voice and your data</span>
      </h1>
      <p className="mt-2 text-xs text-muted-foreground">Actualizado · Updated: 2026-08-08 · v3</p>

      <H es="Cuándo se graba tu voz" en="When your voice is recorded" />
      <P
        es="En los ejercicios, tú tocas el micrófono para empezar. En una llamada con Lumi funciona distinto: se explica abajo. Clara nunca escucha en segundo plano fuera de una práctica que tú iniciaste."
        en="In exercises, you tap the microphone to begin. A call with Lumi works differently, as explained below. Clara never listens in the background outside a practice activity you started."
      />

      <H es="A dónde va tu voz" en="Where your voice goes" />
      <P
        es="Para entenderte y calificarte, tu audio se envía de forma segura a Microsoft Azure Speech (calificación de pronunciación, cuando está configurado), ElevenLabs (transcripción en iPhone) y — si usas Chrome en computador — el reconocimiento de voz del propio navegador (Google). La transcripción de lo que dices (no el audio) se envía a OpenAI para las llamadas con Lumi y para calificar exámenes. La voz grabada de Joel, tu profesor, puede escucharse en las lecciones."
        en="To understand and score you, your audio is sent securely to Microsoft Azure Speech (pronunciation scoring, when configured), ElevenLabs (transcription on iPhone), and — on desktop Chrome — the browser's own speech recognition (Google). The transcript of what you say (not the audio) goes to OpenAI for calls with Lumi and exam grading. Joel, your instructor, may be heard in recorded lessons."
      />
      <P
        es="Estos servicios procesan tu audio para darte el resultado. El audio original es efímero en los sistemas de Clara: se usa solo para la tarea de voz activa y se descarta al terminar. Clara no guarda tu audio original en sus servidores."
        en="These services process your audio to return your result. Raw audio is ephemeral in Clara's systems: it is used only for the active speech task and discarded when processing ends. Clara does not keep your raw audio on its servers."
      />

      <H es="Qué guarda Clara" en="What Clara stores" />
      <P
        es="En tu dispositivo y en tu cuenta (Supabase, protegida por tu inicio de sesión): el texto de lo que el reconocedor entendió, tus puntajes, tu progreso, tu nombre y tus ajustes, y tu historial de exámenes, llamadas y conversaciones. Tu 'diario de voz' (las grabaciones que puedes re-escuchar en Mi Mundo) vive SOLO en tu dispositivo y nunca se sube."
        en="On your device and in your account (Supabase, protected by your sign-in): the text the recognizer heard, your scores, your progress, your name and settings, and your exam/call/conversation history. Your voice journal (the recordings you can replay in Mi Mundo) lives ONLY on your device and is never uploaded."
      />

      <H es="La llamada con Lumi" en="The call with Lumi" />
      <P
        es="Un toque inicia la llamada. Después de que Lumi termina cada turno, Clara abre automáticamente el micrófono para tu respuesta. Se detiene con el silencio, cuando presionas detener o silenciar, cuando el turno llega a 30 segundos o cuando termina la llamada."
        en="One tap starts the call. After Lumi finishes each turn, Clara automatically opens the microphone for your reply. It stops on silence, when you press stop or mute, when the turn reaches 30 seconds, or when the call ends."
      />
      <P
        es="Tu audio va a Microsoft o ElevenLabs solo para convertirlo en texto (y para calificar tu pronunciación cuando repites una frase corregida). Clara no guarda ese audio original en sus servidores. La transcripción de tu turno se envía a OpenAI para que Lumi pueda responderte y corregirte."
        en="Your audio goes to Microsoft or ElevenLabs only to turn it into text (and to score your pronunciation when you repeat a corrected sentence). Clara does not keep that raw audio on its servers. Your turn's transcript goes to OpenAI so Lumi can reply and correct you."
      />
      <P
        es="De cada llamada se guarda el resumen: cuántos turnos hablaste, cuáles salieron limpios, las correcciones y en qué enfocarte, el vocabulario que usaste y tu puntaje de pronunciación cuando se midió. Ese resumen se guarda en tu cuenta para que no lo pierdas si cambias de teléfono. Lo que dijiste palabra por palabra NO se guarda, salvo que tú lo elijas en Ajustes → Llamada virtual; y si lo eliges, se queda solo en este dispositivo y nunca sube a la nube."
        en="What is stored from each call is the summary: how many turns you spoke, which came out clean, the corrections and what to focus on, the vocabulary you used, and your pronunciation score when it was measured. That summary is saved to your account so you do not lose it if you change phones. What you said word for word is NOT stored unless you choose that in Settings → Virtual call; and if you do, it stays on this device only and is never uploaded."
      />
      <P
        es="Puedes borrar esas transcripciones cuando quieras con 'Borrar transcripciones guardadas' en Ajustes. Eso borra tus palabras y deja intactos los resúmenes: borrar tus grabaciones no debe borrarte el progreso."
        en="You can delete those transcripts whenever you want with 'Delete saved transcripts' in Settings. That removes your words and leaves the summaries intact: deleting your recordings should never delete your progress."
      />

      <H es="Cuánto tiempo y cómo borrar" en="Retention and deletion" />
      <P
        es="Tu progreso se conserva mientras uses Clara; todavía no existe un borrado automático. 'Empezar de cero' en Ajustes borra los datos de este dispositivo. Para borrar también tu cuenta y tus datos en la nube, contacta directamente a tu profesor; él solicita y confirma la eliminación manual."
        en="Your progress is kept while you use Clara; there is no automatic deletion yet. 'Start over' in Settings clears this device. To also delete your account and cloud data, contact your teacher directly; they request and confirm the manual deletion."
      />

      <H es="Si niegas el micrófono" en="If you decline the microphone" />
      <P
        es="Puedes negarte (o bloquear el permiso del navegador) y seguir usando todo lo que no necesita voz: lecciones de escucha, la radio de Joel, armar frases, el mapa, las noticias y más."
        en="You can decline (or block the browser permission) and keep using everything that doesn't need your voice: listening exercises, Joel's radio, sentence building, the map, the news, and more."
      />

      <H es="Preguntas" en="Questions" />
      <P
        es="Clara es una aplicación educativa de un profesor independiente; Lumi es su guía de práctica con IA. Si tienes preguntas sobre tus datos o quieres borrarlos de la nube, contacta directamente a tu profesor."
        en="Clara is an educational app run by an independent teacher; Lumi is its AI practice guide. For any question about your data, or to delete it from the cloud, contact your teacher directly."
      />
    </div>
  );
}
