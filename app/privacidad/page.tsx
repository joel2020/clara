import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacidad — Clara",
  description: "Qué datos usa Clara, cuándo se graba tu voz y quién los procesa.",
};

// Plain-language privacy notice (audit P0: voice flowed to third-party
// processors with no disclosure anywhere). Every statement here describes
// verified behavior of the code as it exists — no invented retention or legal
// claims. Statements that need owner/counsel confirmation are tracked in the
// Phase 0 remediation report, not asserted here.
//
// Not legal advice and not a formal policy: this is the honest explanation a
// learner deserves, pending review by qualified counsel.

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

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-xl px-5 pb-24 pt-6 sm:px-6">
      <Link href="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
        ← Inicio · Home
      </Link>
      <h1 className="mt-5 font-display text-3xl font-semibold tracking-[-0.02em]">
        Tu voz y tus datos
        <span className="block text-lg font-normal text-muted-foreground">Your voice and your data</span>
      </h1>
      <p className="mt-2 text-xs text-muted-foreground">Actualizado · Updated: 2026-07-28 · v1</p>

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
