"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Lock, Star, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLessons } from "@/lib/hooks/useLessons";
import { useProgressMap } from "@/lib/hooks/useData";
import { isMastered } from "@/lib/srs";
import { useSettings } from "@/lib/hooks/useSettings";
import { t } from "@/lib/i18n";
import type { Lesson, ItemProgress } from "@/lib/db/types";
import { Splash } from "@/components/splash";
import { CharacterAvatar } from "@/components/character";
import { WORLD_SCENERY } from "@/components/map-scenery";

// The journey: the whole curriculum laid out as a path she travels — a stop per
// lesson, conversation units first (her fastest route to speaking), then the
// sound drills. Each stop shows done / current / upcoming, so a solo learner
// always sees exactly where she is and what's next.

function mastery(progress: Map<string, ItemProgress> | undefined, lesson: Lesson) {
  const total = lesson.items.length;
  let mastered = 0;
  let practiced = 0;
  if (progress) {
    for (const item of lesson.items) {
      const p = progress.get(item.id);
      if (p && p.attempts > 0) practiced += 1;
      if (p && isMastered(p)) mastered += 1;
    }
  }
  return { total, mastered, practiced, done: total > 0 && mastered >= total };
}

/** 0–3 stars for a stop, from how much of the lesson is mastered. */
function stopStars(s: { total: number; mastered: number; practiced: number }): number {
  if (!s.practiced || s.total === 0) return 0;
  return Math.max(s.mastered > 0 ? 1 : 0, Math.round((s.mastered / s.total) * 3));
}

function StarRow({ earned }: { earned: number }) {
  return (
    <span className="mt-1 inline-flex gap-0.5" aria-label={`${earned}/3`}>
      {[0, 1, 2].map((i) => (
        <Star
          key={i}
          className={cn("size-3.5", i < earned ? "text-co-yellow drop-shadow-[0_1px_2px_rgba(0,0,0,0.18)]" : "text-muted-foreground/25")}
          style={{ fill: "currentColor" }}
          strokeWidth={0}
        />
      ))}
    </span>
  );
}

export default function MapPage() {
  const lessons = useLessons();
  const progress = useProgressMap();
  const { settings, ready } = useSettings();
  const lang = settings.coachLanguage;

  const journey = useMemo(
    () =>
      [...lessons].sort(
        (a, b) =>
          (a.track === "conversation" ? 0 : 1) - (b.track === "conversation" ? 0 : 1) || a.order - b.order,
      ),
    [lessons],
  );

  const states = journey.map((l) => mastery(progress, l));
  const currentIndex = states.findIndex((s) => !s.done);
  const doneCount = states.filter((s) => s.done).length;

  // Bring her current stop into view — the path is long and she shouldn't
  // scroll past finished weeks every visit. Runs once per progress load.
  const currentRef = useRef<HTMLLIElement | null>(null);
  const scrolled = useRef(false);
  useEffect(() => {
    if (!scrolled.current && progress && currentRef.current && currentIndex > 1) {
      scrolled.current = true;
      currentRef.current.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
    }
  }, [progress, currentIndex]);

  if (!ready) return <Splash />;

  return (
    <div className="mx-auto max-w-xl px-5 pb-28 pt-6 sm:px-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" />
        {t("navLessons", lang)}
      </Link>

      <section className="mt-5 animate-fade-up">
        <p className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <span className="flag-dots" aria-hidden>
            <i /><i /><i />
          </span>
          {t("mapEyebrow", lang)}
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">{t("mapTitle", lang)}</h1>
        <p className="mt-2 max-w-md text-muted-foreground">{t("mapIntro", lang)}</p>

        {/* Overall progress */}
        <div className="mt-5 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-hairline">
            <div
              className="h-full rounded-full bg-gradient-to-r from-co-yellow via-co-blue to-co-red transition-all duration-700"
              style={{ width: `${journey.length ? Math.round((doneCount / journey.length) * 100) : 0}%` }}
            />
          </div>
          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
            {doneCount}/{journey.length} {t("mapStops", lang)}
          </span>
        </div>
      </section>

      {/* The path */}
      <div className="relative mt-10">
        <div className="map-trail pointer-events-none absolute bottom-6 left-1/2 top-2 w-1.5 -translate-x-1/2 rounded-full" aria-hidden />

        <ol className="relative space-y-7">
          {journey.map((lesson, i) => {
            const s = states[i];
            const isCurrent = i === currentIndex;
            const locked = currentIndex !== -1 && i > currentIndex && !s.practiced;
            const left = i % 2 === 0;
            const track = lesson.track === "conversation" ? "conversation" : "sounds";
            const prevTrack = i > 0 ? (journey[i - 1].track === "conversation" ? "conversation" : "sounds") : null;
            const banner = track !== prevTrack ? (
              <li key={`world-${track}`} className="relative flex justify-center py-3">
                {/* soft world tint behind the banner so each section feels like new scenery */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 -top-2 h-24 opacity-50"
                  style={{
                    background: `radial-gradient(60% 100% at 50% 0%, color-mix(in oklch, ${
                      track === "conversation" ? "var(--co-blue)" : "var(--co-red)"
                    } 14%, transparent), transparent)`,
                  }}
                />
                <span className="star-chip z-10 rounded-full px-5 py-2 text-[11px] font-bold uppercase tracking-[0.14em] shadow-md">
                  {t(track === "conversation" ? "mapWorldConv" : "mapWorldSounds", lang)}
                </span>
              </li>
            ) : null;
            const earned = stopStars(s);
            // Scenery lives on the side the node leaves free, every other stop.
            const SceneryPiece = i % 2 === 1 ? WORLD_SCENERY[track][Math.floor(i / 2) % WORLD_SCENERY[track].length] : null;
            return [
              banner,
              <li key={lesson.id} ref={isCurrent ? currentRef : undefined} className="relative flex">
                {SceneryPiece && (
                  <div
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute top-1/2 -translate-y-1/2",
                      left ? "right-2 sm:right-6" : "left-2 sm:left-6",
                    )}
                  >
                    <SceneryPiece />
                  </div>
                )}
                <div className={cn("flex w-1/2", left ? "justify-end pr-5" : "ml-auto justify-start pl-5")}>
                  <div className="relative">
                    {/* Clara waits at the current stop. `welcome` in the avatar
                        frame — the one frame drawn to stay readable this small —
                        and decorative, because the "Aquí" chip already says it. */}
                    {isCurrent && (
                      <div
                        className={cn(
                          "pointer-events-none absolute -top-4 z-10 flex flex-col items-center",
                          left ? "-right-24" : "-left-24",
                        )}
                      >
                        <span className="mb-1 rounded-full bg-foreground px-2.5 py-1 text-[10px] font-semibold text-background shadow-md">
                          {t("mapHere", lang)}
                        </span>
                        <CharacterAvatar state="welcome" size="size-14" />
                      </div>
                    )}
                    <Link
                      href={`/lesson/${lesson.id}`}
                      className={cn("flex flex-col items-center gap-2 text-center", left ? "items-end" : "items-start")}
                    >
                      <span
                        className={cn(
                          "relative grid size-[4.25rem] place-items-center rounded-full shadow-md ring-4 transition-transform active:scale-95",
                          s.done
                            ? "text-primary-foreground ring-primary/25"
                            : isCurrent
                              ? "star-chip arcade-ring ring-co-yellow/30 animate-float bloom-gold"
                              : locked
                                ? "bg-muted text-muted-foreground/50 shadow-none ring-transparent"
                                : "bg-card text-foreground ring-hairline",
                        )}
                        style={
                          s.done
                            ? {
                                background:
                                  "linear-gradient(145deg, color-mix(in oklch, var(--co-blue) 88%, white), var(--co-blue))",
                              }
                            : undefined
                        }
                      >
                        {!locked && <span className="node-shine" aria-hidden />}
                        {s.done ? (
                          <Check className="size-8" strokeWidth={2.5} />
                        ) : locked ? (
                          <Lock className="size-5" />
                        ) : isCurrent ? (
                          <Star className="size-8" style={{ fill: "currentColor" }} strokeWidth={0} />
                        ) : (
                          <span className="font-display text-xl font-semibold tabular-nums">{i + 1}</span>
                        )}
                      </span>
                      <div className={cn("flex w-36 flex-col", left ? "items-end text-right" : "items-start text-left")}>
                        <p className={cn("font-display text-sm font-medium leading-tight", locked && "text-muted-foreground")}>
                          {lesson.title}
                        </p>
                        {!locked && (s.practiced || isCurrent) ? (
                          <StarRow earned={earned} />
                        ) : (
                          <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">{lesson.subtitle}</p>
                        )}
                      </div>
                    </Link>
                  </div>
                </div>
              </li>,
            ];
          })}

          {/* Finish */}
          <li className="relative flex justify-center pt-1">
            <div className="flex flex-col items-center gap-2 text-center">
              <span
                className={cn(
                  "grid size-16 place-items-center rounded-full shadow-sm ring-4",
                  currentIndex === -1 ? "star-chip ring-co-yellow/30" : "bg-muted text-muted-foreground/50 ring-transparent",
                )}
              >
                <Trophy className="size-7" />
              </span>
              <p className="w-40 font-display text-sm font-medium">{t("mapFinish", lang)}</p>
            </div>
          </li>
        </ol>
      </div>
    </div>
  );
}
