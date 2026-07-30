"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Flame, Star, Sparkles, BookOpen, Ear, Play, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { repo } from "@/lib/db";
import { ITEM_BY_ID } from "@/lib/content/lessons";
import type { PhraseRecording } from "@/lib/db/types";
import { useSettings } from "@/lib/hooks/useSettings";
import { usePlayer } from "@/lib/hooks/usePlayer";
import { useAllProgress, useAllAttempts, useCategoryStats } from "@/lib/hooks/useData";
import { isMastered } from "@/lib/srs";
import { levelProgress, dayKey } from "@/lib/gamification";
import { CATEGORIES } from "@/lib/content/categories";
import { t } from "@/lib/i18n";
import { CharacterIllustration } from "@/components/character";
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

  // "Tu semana" — the last 7 days at a glance, to make progress feel real.
  const weekAgo = today.getTime() - 7 * 86_400_000;
  const weekAttempts = attempts.filter((a) => a.at >= weekAgo);
  const weekDays = new Set(weekAttempts.map((a) => dayKey(new Date(a.at)))).size;
  const weekPasses = weekAttempts.filter((a) => a.passed).length;
  const weekAcc = weekAttempts.length ? Math.round((weekPasses / weekAttempts.length) * 100) : 0;
  const weekItems = new Set(weekAttempts.map((a) => a.itemId)).size;

  return (
    <div className="mx-auto max-w-2xl px-5 pb-28 pt-6 sm:px-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" />
        {t("navHome", lang)}
      </Link>

      {/* Header */}
      <section className="mt-5 flex items-center gap-4 animate-fade-up">
        <CharacterIllustration mode="bust" mood="cheer" className="size-20 shrink-0" priority />
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

      {/* Tu semana — the last 7 days, so progress feels real week to week */}
      {weekAttempts.length > 0 && (
        <section className="elev-1 mt-8 rounded-3xl border border-hairline bg-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            {lang === "es" ? "Tu semana" : "Your week"}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="font-display text-3xl font-semibold">{weekDays}<span className="text-lg text-muted-foreground">/7</span></p>
              <p className="mt-0.5 text-xs text-muted-foreground">{lang === "es" ? "días activos" : "active days"}</p>
            </div>
            <div>
              <p className="font-display text-3xl font-semibold">{weekItems}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{lang === "es" ? "frases practicadas" : "phrases practiced"}</p>
            </div>
            <div>
              <p className="font-display text-3xl font-semibold">{weekAcc}%</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{lang === "es" ? "aciertos" : "accuracy"}</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {weekDays >= 5
              ? lang === "es" ? "¡Semana increíble! Así se vuelve fluida." : "Amazing week! This is how fluency builds."
              : weekDays >= 2
                ? lang === "es" ? "Vas bien — un poquito más y haces el hábito." : "Nice pace — a little more and it's a habit."
                : lang === "es" ? "Cada día cuenta. Hoy es un buen día para practicar." : "Every day counts. Today's a good day to practice."}
          </p>
        </section>
      )}

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

      <VoiceJournal lang={lang} />

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

// "Tu voz" — her saved takes, playable. One shared audio element; object URLs
// are created per play and revoked when it ends so memory stays flat.
function VoiceJournal({ lang }: { lang: "es" | "en" }) {
  const [recs, setRecs] = useState<PhraseRecording[]>([]);
  const [playing, setPlaying] = useState<string | null>(null); // `${itemId}:${which}`
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    void repo.getRecordings().then(setRecs);
    return () => audioRef.current?.pause();
  }, []);

  if (!recs.length) return null;

  const play = (rec: PhraseRecording, which: "first" | "best") => {
    const key = `${rec.itemId}:${which}`;
    if (!audioRef.current) audioRef.current = new Audio();
    const el = audioRef.current;
    el.pause();
    if (playing === key) {
      setPlaying(null);
      return;
    }
    const url = URL.createObjectURL(which === "best" ? rec.bestBlob : rec.firstBlob);
    el.src = url;
    el.onended = () => {
      URL.revokeObjectURL(url);
      setPlaying(null);
    };
    setPlaying(key);
    void el.play().catch(() => setPlaying(null));
  };

  const shown = recs.slice(0, 20);

  return (
    <section className="mt-8">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t("mundoVoice", lang)}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("mundoVoiceSub", lang)}</p>
      <div className="mt-3 space-y-2">
        {shown.map((rec) => {
          const item = ITEM_BY_ID.get(rec.itemId);
          if (!item) return null;
          const grew = rec.bestAt - rec.firstAt > 60_000 && rec.bestScore > rec.firstScore;
          return (
            <div key={rec.itemId} className="flex items-center gap-2.5 rounded-2xl border border-hairline bg-card px-4 py-2.5">
              <button
                type="button"
                onClick={() => play(rec, "best")}
                aria-label={`${item.text}`}
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full transition-all active:scale-95",
                  playing === `${rec.itemId}:best` ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
                )}
              >
                <Play className="size-4" style={{ fill: "currentColor" }} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.text}</p>
                <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{rec.bestScore}%</p>
              </div>
              {grew && (
                <button
                  type="button"
                  onClick={() => play(rec, "first")}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full border border-hairline px-2.5 py-1 text-[11px] font-medium transition-colors",
                    playing === `${rec.itemId}:first` ? "border-primary/50 text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <History className="size-3" />
                  {t("mundoVoiceFirst", lang)}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
