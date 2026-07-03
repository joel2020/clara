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
  conv: { es: string; en: string; href?: string };
  sounds: { es: string; en: string };
  live: { es: string; en: string };
}

const WEEKS: Week[] = [
  { n: 1, conv: { es: "Saludos y presentaciones", en: "Greetings & introductions", href: "/lesson/conv-greetings" }, sounds: { es: "I corta vs ii larga", en: "Short i vs Long ee" }, live: { es: "Preséntense una y otra vez — nombre, origen, a qué te dedicas.", en: "Introduce yourselves over and over — name, origin, what you do." } },
  { n: 2, conv: { es: "Café y restaurante", en: "Café & restaurant", href: "/lesson/conv-cafe" }, sounds: { es: "B vs V", en: "B vs V" }, live: { es: "Juego de rol: él es el mesero. Pide todo el menú.", en: "Roleplay: he's the waiter. Order the whole menu." } },
  { n: 3, conv: { es: "Direcciones y transporte", en: "Directions & getting around", href: "/lesson/conv-directions" }, sounds: { es: "Los sonidos TH", en: "The TH sounds" }, live: { es: "Con un mapa real: pregunta y da direcciones por turnos.", en: "With a real map: ask for and give directions in turns." } },
  { n: 4, conv: { es: "Compras", en: "Shopping", href: "/lesson/conv-shopping" }, sounds: { es: "La H", en: "The H sound" }, live: { es: "Tienda imaginaria: precios, tallas, pagar. Repasa semanas 1–2.", en: "Imaginary store: prices, sizes, paying. Recycle weeks 1–2." } },
  { n: 5, conv: { es: "Charla casual", en: "Small talk", href: "/lesson/conv-smalltalk" }, sounds: { es: "Inicios con s", en: "S-cluster starts" }, live: { es: "Cinco minutos de small talk sin parar — clima, finde, trabajo.", en: "Five minutes of nonstop small talk — weather, weekend, work." } },
  { n: 6, conv: { es: "Planes e invitaciones", en: "Making plans", href: "/lesson/conv-plans" }, sounds: { es: "J vs Y", en: "J vs Y" }, live: { es: "Inviten, acepten, cancelen y reagenden por mensaje y en voz.", en: "Invite, accept, cancel, reschedule — by text and out loud." } },
  { n: 7, conv: { es: "Repaso: las 6 unidades en ronda rápida", en: "Review: all 6 units via speed rounds" }, sounds: { es: "Terminaciones -ed", en: "-ed endings" }, live: { es: "Conversación libre de 10 minutos usando solo lo aprendido.", en: "Free 10-minute conversation using only what she's learned." } },
  { n: 8, conv: { es: "Repite las unidades que tengan menos precisión", en: "Re-run the units with lowest accuracy" }, sounds: { es: "Grupos finales", en: "Final consonant clusters" }, live: { es: "Escenario sorpresa: él elige el rol sin avisar.", en: "Surprise scenario: he picks the roleplay unannounced." } },
  { n: 9, conv: { es: "Frases de cada lección de sonidos", en: "The sentence stages of every sound lesson" }, sounds: { es: "La schwa", en: "Schwa reduction" }, live: { es: "Cuéntale tu día completo en inglés. Él solo corrige al final.", en: "Tell him your whole day in English. He corrects only at the end." } },
  { n: 10, conv: { es: "Ronda rápida diaria + repaso", en: "Daily speed round + review queue" }, sounds: { es: "Acento de palabra", en: "Word stress" }, live: { es: "Debate suave: ¿playa o montaña? Defiende tu opinión.", en: "Gentle debate: beach or mountains? Defend your opinion." } },
  { n: 11, conv: { es: "Todo el repaso pendiente a cero", en: "Clear the entire review queue" }, sounds: { es: "Habla conectada", en: "Connected speech" }, live: { es: "Llamada telefónica real en inglés (sin verse las caras).", en: "A real phone call in English (no faces, voice only)." } },
  { n: 12, conv: { es: "Examen: todas las unidades, todas las voces", en: "Exam week: every unit, every voice" }, sounds: { es: "Repaso general", en: "Full review" }, live: { es: "La 'entrevista': 20 minutos solo en inglés. Celebren después.", en: "The 'interview': 20 minutes English-only. Then celebrate." } },
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
          {es ? "12 semanas." : "12 weeks."}
        </h1>
        <p className="mt-5 max-w-lg text-muted-foreground">
          {es
            ? `El plan${name ? ` de ${name}` : ""}: 20–30 minutos diarios en la app (la unidad de la semana + tu repaso), y dos clases en vivo por semana que son PURA conversación — la app enseña, la clase practica.`
            : `The plan${name ? ` for ${name}` : ""}: 20–30 minutes a day in the app (the week's unit + your review queue), and two live sessions a week that are PURE conversation — the app teaches, class practices.`}
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
            <li>{es ? "3 · La lección de sonidos de la semana" : "3 · The week's sound lesson"}</li>
            <li>{es ? "4 · Una ronda rápida si quieres el combo" : "4 · A speed round if you're chasing the combo"}</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-hairline bg-card p-5">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            <Users className="size-4" />
            {es ? "2 veces por semana · en vivo (1 hora)" : "Twice a week · live (1 hour)"}
          </p>
          <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-foreground/85">
            <li>{es ? "10 min · calentar con las frases de la semana" : "10 min · warm up with the week's chunks"}</li>
            <li>{es ? "35 min · el juego de rol de la semana — solo inglés" : "35 min · the week's roleplay — English only"}</li>
            <li>{es ? "15 min · correcciones y metas para la app" : "15 min · corrections and app goals"}</li>
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
            <li key={w.n} className="border-b border-hairline py-5">
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
                    <span className="font-medium text-primary">{es ? "En vivo: " : "Live: "}</span>
                    {es ? w.live.es : w.live.en}
                  </p>
                </div>
              </div>
            </li>
            );
          })}
        </ol>
      </section>

      <p className="mt-8 text-sm text-muted-foreground">
        {es
          ? "Después de la semana 12: nuevas unidades de conversación, y el instructor puede crear lecciones a tu medida en el modo instructor."
          : "After week 12: new conversation units, and the instructor can author custom lessons for you in Instructor mode."}
      </p>
    </div>
  );
}
