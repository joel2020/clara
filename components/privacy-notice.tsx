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
      <p className="mt-2 text-xs text-muted-foreground">Actualizado · Updated: 2026-07-30 · v2</p>

      <H es="Cuándo se graba tu voz" en="When your voice is recorded" />
      <P
        es="Solo cuando tú tocas el micrófono. La grabación dura mientras hablas (unos segundos por frase; se corta sola a los 7 segundos en los ejercicios) y se detiene cuando terminas o tocas parar. Clara nunca escucha en segundo plano."
        en="Only when you tap the microphone. Recording lasts while you speak (a few seconds per phrase; exercises auto-stop at 7 seconds) and stops when you finish or tap stop. Clara never listens in the background."
      />

      <H es="A dónde va tu voz" en="Where your voice goes" />
      <P
        es="Para entenderte y calificarte, tu audio se envía de forma segura a: Microsoft Azure Speech (calificación de pronunciación, cuando está configurado), ElevenLabs (transcripción en iPhone) y — si usas Chrome en computador — el reconocimiento de voz del propio navegador (Google). El texto de lo que dices (no el audio) se envía a OpenAI para las conversaciones con Joel y para calificar exámenes. La voz de Joel que escuchas se genera con ElevenLabs."
        en="To understand and score you, your audio is sent securely to: Microsoft Azure Speech (pronunciation scoring, when configured), ElevenLabs (transcription on iPhone), and — on desktop Chrome — the browser's own speech recognition (Google). The text of what you say (not the audio) goes to OpenAI for conversations with Joel and exam grading. Joel's voice is generated with ElevenLabs."
      />
      <P
        es="Estos servicios procesan tu audio para darte el resultado. Clara no guarda tu audio en sus servidores."
        en="These services process your audio to return your result. Clara does not keep your raw audio on its servers."
      />

      <H es="Qué guarda Clara" en="What Clara stores" />
      <P
        es="En tu dispositivo y en tu cuenta (Supabase, protegida por tu inicio de sesión): el texto de lo que el reconocedor entendió, tus puntajes, tu progreso, tu nombre y tus ajustes, y tu historial de exámenes, llamadas y conversaciones. Tu 'diario de voz' (las grabaciones que puedes re-escuchar en Mi Mundo) vive SOLO en tu dispositivo y nunca se sube."
        en="On your device and in your account (Supabase, protected by your sign-in): the text the recognizer heard, your scores, your progress, your name and settings, and your exam/call/conversation history. Your voice journal (the recordings you can replay in Mi Mundo) lives ONLY on your device and is never uploaded."
      />

      <H es="La llamada virtual" en="The virtual call" />
      <P
        es="En una llamada con Clara el micrófono se enciende solo cuando tú tocas grabar tu turno, y se corta solo a los 30 segundos. Entre turnos no se graba nada, y la llamada tiene un tope de tiempo."
        en="On a call with Clara the microphone only turns on when you tap to record your turn, and it cuts off on its own after 30 seconds. Nothing is recorded between turns, and the call itself has a time limit."
      />
      <P
        es="Tu audio va a un servicio de voz solo para convertirlo en texto (y para calificar tu pronunciación cuando repites una frase corregida, que es la única vez que hay una frase exacta contra la cual calificar). Clara no guarda ese audio en sus servidores. El texto de tu turno sí se envía al servicio de IA para que Clara pueda responderte y corregirte."
        en="Your audio goes to a speech service only to turn it into text (and to score your pronunciation when you repeat a corrected sentence — the only moment there is an exact target to score against). Clara does not keep that audio on its servers. The text of your turn does go to the AI service so Clara can reply and correct you."
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
        es="Tu progreso se conserva mientras uses Clara; todavía no existe un borrado automático. 'Empezar de cero' en Ajustes borra los datos de este dispositivo. Para borrar también tu cuenta y tus datos en la nube, escríbele a tu profe y se eliminan manualmente."
        en="Your progress is kept while you use Clara; there is no automatic deletion yet. 'Start over' in Settings clears this device. To also delete your account and cloud data, ask your teacher and it is removed manually."
      />

      <H es="Si niegas el micrófono" en="If you decline the microphone" />
      <P
        es="Puedes negarte (o bloquear el permiso del navegador) y seguir usando todo lo que no necesita voz: lecciones de escucha, la radio de Joel, armar frases, el mapa, las noticias y más."
        en="You can decline (or block the browser permission) and keep using everything that doesn't need your voice: listening exercises, Joel's radio, sentence building, the map, the news, and more."
      />

      <H es="Preguntas" en="Questions" />
      <P
        es="Clara es una aplicación educativa de un profesor independiente. Si tienes preguntas sobre tus datos o quieres borrarlos, habla directamente con tu profe."
        en="Clara is an educational app run by an independent teacher. For any question about your data, or to delete it, talk to your teacher directly."
      />
    </div>
  );
}
