"use client";

import Link from "next/link";
import { ArrowLeft, Mic2, Users, Check } from "lucide-react";
import { useSettings } from "@/lib/hooks/useSettings";
import { useProgressMap } from "@/lib/hooks/useData";
import { LESSON_BY_ID } from "@/lib/content/lessons";
import { isMastered } from "@/lib/srs";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type ItemProgressMap = ReturnType<typeof useProgressMap>;

// Live mastery for a lesson: how many of its items are in a mastered SRS box.
function lessonMastery(progress: ItemProgressMap, lessonId?: string): { mastered: number; total: number } | null {
  if (!lessonId) return null;
  const lesson = LESSON_BY_ID.get(lessonId);
  if (!lesson) return null;
  let mastered = 0;
  if (progress) {
    for (const item of lesson.items) {
      const p = progress.get(item.id);
      if (p && isMastered(p)) mastered += 1;
    }
  }
  return { mastered, total: lesson.items.length };
}

// The 12-week plan: coordinates daily app practice with the two weekly live
// sessions. Chunks-first strategy — each week pairs one conversation unit (the
// scenario she'll roleplay live) with one or two sound lessons. Bilingual by
// coach language.

interface Week {
  n: number;
  /** Starts a new phase band above this week. */
  phase?: { es: string; en: string };
  conv: { es: string; en: string; href?: string };
  sounds: { es: string; en: string };
  live: { es: string; en: string };
}

const WEEKS: Week[] = [
  // Fase 1 — Fundamentos
  { n: 1, phase: { es: "Fundamentos", en: "Foundations" }, conv: { es: "Saludos y presentaciones", en: "Greetings & introductions", href: "/lesson/conv-greetings" }, sounds: { es: "I corta vs ii larga", en: "Short i vs Long ee" }, live: { es: "Preséntate una y otra vez — nombre, origen, a qué te dedicas.", en: "Introduce yourself over and over — name, origin, what you do." } },
  { n: 2, conv: { es: "Café y restaurante", en: "Café & restaurant", href: "/lesson/conv-cafe" }, sounds: { es: "B vs V", en: "B vs V" }, live: { es: "Con Lumi: pide todo un menú, de la mesa a la cuenta.", en: "With Lumi: order a whole menu, from the table to the check." } },
  { n: 3, conv: { es: "Direcciones", en: "Directions", href: "/lesson/conv-directions" }, sounds: { es: "Los sonidos TH", en: "The TH sounds" }, live: { es: "Pregunta y da direcciones por turnos con un mapa real.", en: "Ask for and give directions in turns with a real map." } },
  { n: 4, conv: { es: "Compras", en: "Shopping", href: "/lesson/conv-shopping" }, sounds: { es: "La H", en: "The H sound" }, live: { es: "Tienda: precios, tallas, pagar. Repasa las semanas 1–2.", en: "Store: prices, sizes, paying. Recycle weeks 1–2." } },
  // Fase 2 — El día a día
  { n: 5, phase: { es: "El día a día", en: "Everyday life" }, conv: { es: "Números y precios", en: "Numbers & prices", href: "/lesson/conv-numbers" }, sounds: { es: "La T americana", en: "The American T" }, live: { es: "Regatea precios y da tu número de teléfono en voz alta.", en: "Haggle prices and say your phone number out loud." } },
  { n: 6, conv: { es: "La hora y los días", en: "Time, days & dates", href: "/lesson/conv-time" }, sounds: { es: "La R americana", en: "The American R" }, live: { es: "Agenda planes: '¿A qué hora? ¿Qué día?' sin dudar.", en: "Set plans: 'What time? What day?' without hesitating." } },
  { n: 7, conv: { es: "Charla casual", en: "Small talk", href: "/lesson/conv-smalltalk" }, sounds: { es: "Inicios con s", en: "S-cluster starts" }, live: { es: "Cinco minutos de small talk sin parar — clima, finde, trabajo.", en: "Five minutes of nonstop small talk — weather, weekend, work." } },
  { n: 8, conv: { es: "El clima", en: "Weather", href: "/lesson/conv-weather" }, sounds: { es: "J vs Y", en: "J vs Y" }, live: { es: "Abre CADA conversación con el clima, como un americano.", en: "Open EVERY conversation with the weather, like an American." } },
  // Fase 3 — Tu mundo
  { n: 9, phase: { es: "Tu mundo", en: "Your world" }, conv: { es: "Familia y personas", en: "Family & people", href: "/lesson/conv-family" }, sounds: { es: "Terminaciones -ed", en: "-ed endings" }, live: { es: "Presenta a toda tu familia y pregunta por la suya.", en: "Introduce your whole family and ask about theirs." } },
  { n: 10, conv: { es: "Trabajo", en: "Work & jobs", href: "/lesson/conv-work" }, sounds: { es: "Grupos finales", en: "Final consonant clusters" }, live: { es: "'¿A qué te dedicas?' — cuenta tu día de trabajo entero.", en: "'What do you do?' — tell your whole workday." } },
  { n: 11, conv: { es: "Emociones y reacciones", en: "Feelings & reactions", href: "/lesson/conv-feelings" }, sounds: { es: "La schwa", en: "Schwa reduction" }, live: { es: "Reacciona rápido a buenas y malas noticias, con calidez.", en: "React fast to good and bad news, with warmth." } },
  // Fase 4 — Moverte por el mundo
  { n: 12, phase: { es: "Por el mundo", en: "Out in the world" }, conv: { es: "Transporte", en: "Getting around", href: "/lesson/conv-transport" }, sounds: { es: "Acento de palabra", en: "Word stress" }, live: { es: "Toma el bus, pide un taxi, pregunta cómo llegar.", en: "Take the bus, call a cab, ask how to get somewhere." } },
  { n: 13, conv: { es: "Viajes y aeropuerto", en: "Travel & the airport", href: "/lesson/conv-travel" }, sounds: { es: "Habla conectada", en: "Connected speech" }, live: { es: "Simula el check-in, la seguridad y migración de punta a punta.", en: "Simulate check-in, security, and immigration end to end." } },
  { n: 14, conv: { es: "En el hotel", en: "At the hotel", href: "/lesson/conv-hotel" }, sounds: { es: "Repaso de sonidos débiles", en: "Weak-sound review" }, live: { es: "Registra tu entrada, pide toallas y haz el checkout.", en: "Check in, ask for towels, and check out." } },
  // Fase 5 — Situaciones reales
  { n: 15, phase: { es: "Situaciones reales", en: "Real situations" }, conv: { es: "Salud y el médico", en: "Health & the doctor", href: "/lesson/conv-health" }, sounds: { es: "Repasa tus sonidos más débiles", en: "Drill your weakest sounds" }, live: { es: "Explica tres síntomas distintos y pide ayuda con claridad.", en: "Explain three different symptoms and ask for help clearly." } },
  { n: 16, conv: { es: "Por teléfono", en: "On the phone", href: "/lesson/conv-phone" }, sounds: { es: "Repaso de la R y la T", en: "R and T review" }, live: { es: "Una llamada real solo por voz — contesta, aclara, despídete.", en: "A real voice-only call — answer, clarify, say goodbye." } },
  { n: 17, conv: { es: "Ayuda y emergencias", en: "Help & emergencies", href: "/lesson/conv-emergency" }, sounds: { es: "Claridad bajo presión", en: "Clarity under pressure" }, live: { es: "Practica pedir ayuda fuerte y claro — que salga sin pensar.", en: "Practice asking for help loud and clear — until it's automatic." } },
  // Fase 6 — Sonar americano
  { n: 18, phase: { es: "Sonar americano", en: "Sounding American" }, conv: { es: "Inglés casual", en: "Sound American", href: "/lesson/conv-american" }, sounds: { es: "Reducciones: gonna, wanna", en: "Reductions: gonna, wanna" }, live: { es: "Reemplaza las formas lentas por las reales toda la conversación.", en: "Swap slow forms for the real ones the whole conversation." } },
  { n: 19, conv: { es: "Más inglés casual", en: "Sound American II", href: "/lesson/conv-american-2" }, sounds: { es: "Frasecitas de la calle", en: "Everyday street phrases" }, live: { es: "Charla 100% casual: 'gotcha', 'no way', 'I'm down'.", en: "100% casual chat: 'gotcha', 'no way', 'I'm down'." } },
  { n: 20, conv: { es: "Examen: todas las unidades, todas las voces", en: "Exam: every unit, every voice" }, sounds: { es: "Repaso general", en: "Full review" }, live: { es: "La 'entrevista': 20 minutos solo en inglés. Celebra después.", en: "The 'interview': 20 minutes English-only. Then celebrate." } },
];

export default function PlanPage() {
  const { settings } = useSettings();
  const progress = useProgressMap();
  const es = settings.coachLanguage === "es";
  const name = settings.studentName;
  const lessonIdFromHref = (href?: string) => (href ? href.replace("/lesson/", "") : undefined);

  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-14 sm:px-6 sm:pt-16">
      <Link
        href="/"
        className="group mb-8 flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
        {t("navLessons", settings.coachLanguage)}
      </Link>

      <header className="animate-fade-up">
        <p className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          <span className="flag-dots" aria-hidden>
            <i /><i /><i />
          </span>
          {es ? "Tu ruta a la conversación" : "Your route to conversation"}
        </p>
        <h1 className="mt-4 font-display text-4xl font-medium tracking-[-0.03em] sm:text-5xl">
          {es ? "20 semanas." : "20 weeks."}
        </h1>
        <p className="mt-5 max-w-lg text-muted-foreground">
          {es
            ? `El plan${name ? ` de ${name}` : ""}: 15–30 minutos al día. Cada día haces tu sesión guiada — repaso, la unidad de la semana y una conversación con Lumi, tu guía de IA. La app te enseña, te corrige y te lleva de la mano.`
            : `The plan${name ? ` for ${name}` : ""}: 15–30 minutes a day. Each day you do your guided session — review, the week's unit, and a conversation with Lumi, your AI guide. The app teaches, corrects, and walks you through it.`}
        </p>
      </header>

      {/* The weekly rhythm */}
      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-hairline bg-card p-5">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            <Mic2 className="size-4" />
            {es ? "Cada día · la app" : "Every day · the app"}
          </p>
          <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-foreground/85">
            <li>{es ? "1 · Tu repaso pendiente (primero, siempre)" : "1 · Your review queue (first, always)"}</li>
            <li>{es ? "2 · La unidad de conversación de la semana" : "2 · The week's conversation unit"}</li>
            <li>{es ? "3 · Una conversación con Lumi sobre esa unidad" : "3 · A conversation with Lumi about that unit"}</li>
            <li>{es ? "4 · La lección de sonidos de la semana" : "4 · The week's sound lesson"}</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-hairline bg-card p-5">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            <Users className="size-4" />
            {es ? "Conversación con Lumi (IA)" : "Conversation with Lumi (AI)"}
          </p>
          <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-foreground/85">
            <li>{es ? "Elige un escenario: café, direcciones, planes…" : "Pick a scenario: café, directions, plans…"}</li>
            <li>{es ? "Habla de verdad — Lumi responde como guía de IA" : "Really talk — Lumi replies as an AI guide"}</li>
            <li>{es ? "Te corrige con cariño y guarda lo difícil para repasar" : "Lumi corrects gently and saves the hard bits to review"}</li>
          </ul>
        </div>
      </div>

      {/* Week by week */}
      <section className="mt-12">
        <div className="border-b border-hairline pb-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em]">
            {es ? "Semana a semana" : "Week by week"}
          </h2>
        </div>
        <ol>
          {WEEKS.map((w) => {
            const mastery = lessonMastery(progress, lessonIdFromHref(w.conv.href));
            const done = mastery ? mastery.total > 0 && mastery.mastered >= mastery.total : false;
            return (
            <div key={w.n}>
            {w.phase && (
              <li className="flex items-center gap-3 pb-2 pt-7">
                <span className="star-chip rounded-full px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] shadow-sm">
                  {es ? w.phase.es : w.phase.en}
                </span>
                <span className="h-px flex-1 bg-hairline" aria-hidden />
              </li>
            )}
            <li className="border-b border-hairline py-5">
              <div className="flex items-start gap-5">
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full pt-0 font-mono text-[13px] tabular-nums",
                    done ? "bg-success text-white" : "text-muted-foreground/70",
                  )}
                >
                  {done ? <Check className="size-4" /> : String(w.n).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    {w.conv.href ? (
                      <Link href={w.conv.href} className="font-display text-lg font-medium tracking-[-0.01em] transition-colors hover:text-primary">
                        {es ? w.conv.es : w.conv.en}
                      </Link>
                    ) : (
                      <p className="font-display text-lg font-medium tracking-[-0.01em]">{es ? w.conv.es : w.conv.en}</p>
                    )}
                    {mastery && (
                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                        {mastery.mastered}/{mastery.total}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    {es ? "Sonidos: " : "Sounds: "}
                    {es ? w.sounds.es : w.sounds.en}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                    <span className="font-medium text-primary">{es ? "Con Lumi: " : "With Lumi: "}</span>
                    {es ? w.live.es : w.live.en}
                  </p>
                </div>
              </div>
            </li>
            </div>
            );
          })}
        </ol>
      </section>

      <p className="mt-8 text-sm text-muted-foreground">
        {es
          ? "Después de la semana 20: repasa lo que menos domines, y el instructor puede crear lecciones a tu medida en el modo instructor."
          : "After week 20: keep drilling your weakest units, and the instructor can author custom lessons for you in Instructor mode."}
      </p>
    </div>
  );
}
