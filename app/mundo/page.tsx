"use client";

import Link from "next/link";
import { ArrowLeft, Flame, Star, Sparkles, BookOpen, Ear } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/lib/hooks/useSettings";
import { usePlayer } from "@/lib/hooks/usePlayer";
import { useAllProgress, useAllAttempts, useCategoryStats } from "@/lib/hooks/useData";
import { isMastered } from "@/lib/srs";
import { levelProgress, dayKey } from "@/lib/gamification";
import { CATEGORIES } from "@/lib/content/categories";
import { t } from "@/lib/i18n";
import { Lumi } from "@/components/lumi";
import { Splash } from "@/components/splash";

// "Mi mundo" — a warm, motivating snapshot of everything she's built: level,
// words she can say, sounds mastered, her practice-day calendar, and per-sound
// progress. Read-only celebration of progress, in her coaching language.

const CAT_LABEL_ES: Record<string, string> = {
  "i-vs-ii": "i corta vs i larga",
  "flap-t": "La T americana",
  "american-r": "La R americana",
  "b-vs-v": "b vs v",
  "dj-vs-y": "j vs y",
  th: "El sonido TH",
  h: "La H",
  "s-clusters": "Grupos con S",
  "ed-endings": "Terminación -ed",
  "final-clusters": "Grupos finales",
  "word-stress": "Acento de palabra",
  "connected-speech": "Habla conectada",
  schwa: "La schwa",
};

export default function MundoPage() {
  const { settings, ready } = useSettings();
  const lang = settings.coachLanguage;
  const player = usePlayer();
  const progress = useAllProgress();
  const attempts = useAllAttempts();
  const catStats = useCategoryStats();

  if (!ready || !player || progress === undefined || attempts === undefined) return <Splash />;

  const lvl = levelProgress(player.xp);
  const wordsKnown = progress.filter((p) => isMastered(p)).length;
  const soundsMastered = (catStats ?? []).filter((c) => c.masteredItems >= 3).length;

  // Activity calendar — the last 28 days, with a dot per day she practiced.
  const perDay = new Map<string, number>();
  for (const a of attempts) {
    const k = dayKey(new Date(a.at));
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
  }
  const today = new Date();
  const days = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (27 - i));
    const k = dayKey(d);
    return { k, count: perDay.get(k) ?? 0, isToday: k === dayKey(today) };
  });

  // Per-sound progress — only sounds she has touched, best-known first.
  const touched = (catStats ?? [])
    .filter((c) => c.practicedItems > 0)
    .sort((a, b) => b.masteredItems - a.masteredItems || b.accuracy - a.accuracy);

  const label = (id: string) => (lang === "es" && CAT_LABEL_ES[id]) || CATEGORIES.find((c) => c.id === id)?.label || id;

  const started = wordsKnown > 0 || attempts.length > 0;

  return (
    <div className="mx-auto max-w-2xl px-5 pb-28 pt-6 sm:px-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" />
        {t("navHome", lang)}
      </Link>

      {/* Header */}
      <section className="mt-5 flex items-center gap-4 animate-fade-up">
        <Lumi frame="bust" mood="cheer" className="size-20 shrink-0" priority />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">{t("mundoEyebrow", lang)}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
            {settings.studentName ? `${lang === "es" ? "El mundo de" : "The world of"} ${settings.studentName}` : t("mundoTitle", lang)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("mundoIntro", lang)}</p>
        </div>
      </section>

      {/* Level card */}
      <section className="elev-1 mt-6 rounded-3xl border border-hairline bg-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-4xl font-semibold tabular-nums">{lvl.level}</span>
            <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{lang === "es" ? "Nivel" : "Level"}</span>
          </div>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {lvl.toNext} XP {t("mundoLevelTo", lang)}
          </span>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-gradient-to-r from-co-yellow via-co-blue to-co-red transition-all duration-700" style={{ width: `${lvl.pct}%` }} />
        </div>
      </section>

      {/* Stat tiles */}
      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={<BookOpen className="size-5" />} value={wordsKnown} label={t("mundoWords", lang)} tone="blue" />
        <StatTile icon={<Ear className="size-5" />} value={soundsMastered} label={t("mundoSoundsMastered", lang)} tone="gold" />
        <StatTile icon={<Flame className="size-5" />} value={player.currentStreak} label={t("dayStreak", lang)} tone="red" />
        <StatTile icon={<Star className="size-5" style={{ fill: "currentColor" }} />} value={player.stars ?? 0} label={t("stars", lang)} tone="gold" />
      </section>

      {!started && <p className="mt-8 text-center text-sm text-muted-foreground">{t("mundoEmpty", lang)}</p>}

      {/* Activity calendar */}
      <section className="mt-8">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t("mundoActivity", lang)}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("mundoActivitySub", lang)}</p>
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {days.map((d) => (
            <div
              key={d.k}
              title={d.k}
              className={cn(
                "aspect-square rounded-md ring-1 transition-colors",
                d.count === 0
                  ? "bg-secondary ring-hairline"
                  : d.count < 3
                    ? "bg-primary/30 ring-primary/20"
                    : d.count < 8
                      ? "bg-primary/60 ring-primary/30"
                      : "bg-primary ring-primary",
                d.isToday && "ring-2 ring-co-yellow",
              )}
            />
          ))}
        </div>
      </section>

      {/* Per-sound progress */}
      {touched.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t("mundoYourSounds", lang)}</h2>
          <div className="mt-3 space-y-2.5">
            {touched.map((c) => (
              <Link
                key={c.categoryId}
                href={`/lesson/${c.categoryId}`}
                className="flex items-center gap-3 rounded-2xl border border-hairline bg-card px-4 py-3 transition-colors hover:border-primary/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{label(c.categoryId)}</span>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{c.accuracy}%</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn("h-full rounded-full", c.accuracy >= 80 ? "bg-success" : c.accuracy >= 55 ? "bg-co-yellow" : "bg-co-red")}
                      style={{ width: `${Math.max(6, c.accuracy)}%` }}
                    />
                  </div>
                </div>
                {c.masteredItems >= 3 && <Sparkles className="size-4 shrink-0 text-co-yellow" />}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const TILE_TONE = {
  blue: "border-primary/25 bg-primary/[0.06] text-primary",
  gold: "border-[color-mix(in_oklch,var(--co-yellow)_45%,transparent)] bg-[color-mix(in_oklch,var(--co-yellow)_12%,transparent)] text-[color-mix(in_oklch,var(--co-yellow)_55%,#7a5a10)]",
  red: "border-[color-mix(in_oklch,var(--co-red)_30%,transparent)] bg-[color-mix(in_oklch,var(--co-red)_8%,transparent)] text-co-red",
} as const;

function StatTile({ icon, value, label, tone }: { icon: React.ReactNode; value: number; label: string; tone: keyof typeof TILE_TONE }) {
  return (
    <div className={cn("rounded-2xl border p-3.5", TILE_TONE[tone])}>
      <div className="opacity-90">{icon}</div>
      <div className="mt-2 font-display text-2xl font-semibold tabular-nums text-foreground">{value}</div>
      <div className="mt-0.5 text-[11px] font-medium leading-tight text-muted-foreground">{label}</div>
    </div>
  );
}
