"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Flame, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Lesson, ItemProgress, PracticeItem } from "@/lib/db/types";
import { repo } from "@/lib/db";
import { orderForSession, isMastered } from "@/lib/srs";
import { partnerOf, LESSONS } from "@/lib/content/lessons";
import { useSpeechSupport } from "@/lib/hooks/useSpeechSupport";
import { useSettings } from "@/lib/hooks/useSettings";
import { unlock, ACHIEVEMENT_BY_ID } from "@/lib/gamification";
import { sfx } from "@/lib/sfx";
import { celebrate, levelUpBurst } from "@/lib/fx";
import type { PracticeOutcome } from "@/lib/practice";
import { t, type CoachLang } from "@/lib/i18n";
import { hintFor, introFor, achievementText } from "@/lib/content/es";
import { meaningFor } from "@/lib/content/word-es";
import { ListenButton } from "./listen-button";
import { ProducePanel } from "./produce-panel";
import { DistinguishDrill } from "./distinguish-drill";
import { SpeechSupportNotice } from "./speech-support-notice";
import { LevelUpOverlay } from "./level-up-overlay";
import { LearnIntro } from "./learn-intro";
import { Lumi } from "@/components/lumi";
import { juice } from "@/components/juice";
import { cinematic } from "@/components/cinematic";
import { track } from "@/lib/analytics";
import { SceneVideo } from "@/components/scene-video";

// A full lesson runs in stages: Learn (mini-class) → Ear (minimal pairs) →
// Words (speak each one) → Sentences (the sound in connected speech) → Done.
// Stages a lesson doesn't have are skipped automatically.

type Stage = "loading" | "learn" | "distinguish" | "produce" | "phrases" | "done";

export function PracticeSession({ lesson }: { lesson: Lesson }) {
  const support = useSpeechSupport();
  const { settings } = useSettings();
  const lang = settings.coachLanguage;

  const [stage, setStage] = useState<Stage>("loading");

  // Funnel instrumentation: start on mount, complete when the session finishes,
  // abandon if she leaves before finishing (the drop-off signal).
  const started = useRef(false);
  const completedRef = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    track("lesson_start", { lesson: lesson.id });
    return () => {
      if (started.current && !completedRef.current) track("lesson_abandon", { lesson: lesson.id });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);
  useEffect(() => {
    if (stage === "done" && !completedRef.current) {
      completedRef.current = true;
      track("lesson_complete", { lesson: lesson.id });
    }
  }, [stage, lesson.id]);
  const [wordQueue, setWordQueue] = useState<PracticeItem[]>([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [combo, setCombo] = useState(0);
  const [sessionBestCombo, setSessionBestCombo] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  const [sessionStars, setSessionStars] = useState(0);
  const [levelUp, setLevelUp] = useState<number | null>(null);

  const pairs = useMemo(() => buildPairs(lesson.items), [lesson.items]);
  // Sentences keep their authored order — they build on each other.
  const phraseQueue = useMemo(() => lesson.items.filter((i) => i.kind === "phrase"), [lesson.items]);

  const hasLearn = Boolean(lesson.intro);
  const hasEar = pairs.length > 0;

  const firstDrillStage: Stage = hasEar ? "distinguish" : wordQueue.length > 0 ? "produce" : "phrases";

  // Snapshot SRS order for the words once at mount so the queue doesn't reshuffle.
  useEffect(() => {
    let active = true;
    repo.getAllProgress().then((all: ItemProgress[]) => {
      if (!active) return;
      const map = new Map(all.map((p) => [p.itemId, p]));
      const words = lesson.items.filter((i) => i.kind === "word");
      const ordered = orderForSession(words, map, Date.now());
      setWordQueue(ordered);
      const start: Stage = lesson.intro
        ? "learn"
        : buildPairs(lesson.items).length > 0
          ? "distinguish"
          : ordered.length > 0
            ? "produce"
            : "phrases";
      setStage(start);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);

  const handleOutcome = (item: PracticeItem, o: PracticeOutcome) => {
    setResults((prev) => ({ ...prev, [item.id]: o.score.passed }));
    setCombo(o.rewards.combo);
    setSessionBestCombo((b) => Math.max(b, o.rewards.combo));
    setSessionXp((x) => x + o.rewards.xpGain);
    setSessionStars((s) => s + o.rewards.starsEarned);
    const r = o.rewards;
    if (r.leveledUp) {
      setLevelUp(r.newLevel);
      sfx.levelUp();
      levelUpBurst();
    }
    if (r.dailyGoalMet) {
      toast.success(lang === "es" ? "¡Meta diaria cumplida!" : "Daily goal reached", {
        description: lang === "es" ? `${settings.dailyGoal} XP hoy. Hermoso.` : `${settings.dailyGoal} XP today. Beautiful.`,
      });
      sfx.goal();
    }
    if (r.streakIncreased && r.currentStreak > 1) {
      toast(lang === "es" ? `Racha de ${r.currentStreak} días` : `${r.currentStreak}-day streak`, {
        description: lang === "es" ? "Mantén viva la llama." : "Keep the fire going.",
      });
    }
    for (const id of r.unlocked) {
      const a = ACHIEVEMENT_BY_ID.get(id);
      if (a) {
        const tx = achievementText(id, a, lang);
        toast.success(lang === "es" ? `Logro — ${tx.name}` : `Achievement — ${tx.name}`, { description: tx.description });
        sfx.achievement();
      }
    }
  };

  if (stage === "loading" || !support) {
    return <div className="mx-auto max-w-xl px-5 py-24 text-center text-muted-foreground">Loading…</div>;
  }

  const speakQueue = stage === "phrases" ? phraseQueue : wordQueue;
  const current = speakQueue[index];
  const totalItems = wordQueue.length + phraseQueue.length;
  const clearCount = Object.values(results).filter(Boolean).length;

  const afterWords = () => {
    if (phraseQueue.length > 0) {
      setIndex(0);
      setStage("phrases");
      sfx.tap();
    } else {
      setStage("done");
    }
  };

  const advance = () => {
    if (index + 1 < speakQueue.length) setIndex((i) => i + 1);
    else if (stage === "produce") afterWords();
    else setStage("done");
  };

  const afterEar = () => {
    setIndex(0);
    setStage(wordQueue.length > 0 ? "produce" : phraseQueue.length > 0 ? "phrases" : "done");
  };

  return (
    <div className="mx-auto max-w-xl px-5 pb-24 pt-8 sm:px-6">
      {levelUp !== null && <LevelUpOverlay level={levelUp} onClose={() => setLevelUp(null)} />}

      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="group flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
          {t("navLessons", lang)}
        </Link>
        <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">{lesson.subtitle}</span>
      </div>

      <Stepper
        steps={[
          ...(hasLearn ? [{ key: "learn", label: t("stageLearn", lang) }] : []),
          ...(hasEar ? [{ key: "distinguish", label: t("stageEar", lang) }] : []),
          ...(wordQueue.length > 0 ? [{ key: "produce", label: t("stageWords", lang) }] : []),
          ...(phraseQueue.length > 0 ? [{ key: "phrases", label: t("stageSentences", lang) }] : []),
        ]}
        current={stage}
      />

      <SpeechSupportNotice support={support} />

      {stage === "learn" && (
        <section className="animate-fade-up">
          <Header eyebrow={t("learnEyebrow", lang)} title={lesson.title} />
          <LearnIntro lesson={lesson} onStart={() => setStage(firstDrillStage)} />
        </section>
      )}

      {stage === "distinguish" && (
        <section className="animate-fade-up">
          <Header eyebrow={t("earEyebrow", lang)} title={lesson.title} />
          <DistinguishDrill pairs={pairs} synthesisSupported={support.synthesis} onDone={afterEar} />
          <div className="mt-10 text-center">
            <button
              onClick={afterEar}
              className="text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              {t("skipToSpeaking", lang)}
            </button>
          </div>
        </section>
      )}

      {(stage === "produce" || stage === "phrases") && current && (
        <section className="animate-fade-up" key={stage}>
          <div className="mb-6">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
                {stage === "phrases" ? t("sentence", lang) : t("word", lang)} {String(index + 1).padStart(2, "0")} /{" "}
                {String(speakQueue.length).padStart(2, "0")}
              </span>
              <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
                {clearCount} {t("clear", lang)}
              </span>
            </div>
            <div className="h-px w-full bg-hairline">
              <div
                className="h-px bg-foreground transition-all duration-500"
                style={{ width: `${(index / speakQueue.length) * 100}%` }}
              />
            </div>
            <div className="mt-3 flex h-6 items-center justify-center">
              {combo >= 2 && (
                <span className="animate-scale-in inline-flex items-center gap-1.5 rounded-full bg-warn/15 px-3 py-1 text-xs font-semibold text-warn-foreground">
                  <Flame className="size-3.5" />
                  {t("onARoll", lang)} · {combo}× {t("combo", lang)}
                </span>
              )}
            </div>
          </div>

          <ProduceItemCard
            item={current}
            partner={partnerOf(current, lesson.items)}
            synthesisSupported={support.synthesis}
            lang={lang}
          />

          <div className="my-10 flex items-center gap-4">
            <div className="h-px flex-1 bg-hairline" />
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {t("nowYouTry", lang)}
            </span>
            <div className="h-px flex-1 bg-hairline" />
          </div>

          <ProducePanel
            key={current.id}
            item={current}
            lessonId={lesson.id}
            itemPool={lesson.items}
            recognitionSupported={support.recognition}
            combo={combo}
            onOutcome={(o) => handleOutcome(current, o)}
            hasNext={index + 1 < speakQueue.length || (stage === "produce" && phraseQueue.length > 0)}
            onNext={advance}
          />

          {!support.recognition && (
            <div className="mt-8 text-center">
              <button
                className="text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                onClick={advance}
              >
                {index + 1 < speakQueue.length ? t("skipToNext", lang) : t("continue", lang)}
              </button>
            </div>
          )}
        </section>
      )}

      {stage === "done" && (
        <DoneCard
          lesson={lesson}
          results={results}
          total={totalItems}
          sessionXp={sessionXp}
          sessionStars={sessionStars}
          bestCombo={sessionBestCombo}
          onRestart={restart}
          lang={lang}
          studentName={settings.studentName}
        />
      )}
    </div>
  );

  function restart() {
    setIndex(0);
    setResults({});
    setCombo(0);
    setSessionBestCombo(0);
    setSessionXp(0);
    setSessionStars(0);
    setStage(hasLearn ? "learn" : firstDrillStage);
  }
}

function Stepper({ steps, current }: { steps: { key: string; label: string }[]; current: Stage }) {
  if (steps.length < 2 || current === "loading") return null;
  const activeIdx = current === "done" ? steps.length : steps.findIndex((s) => s.key === current);
  return (
    <nav aria-label="Lesson stages" className="mb-8">
      <ol className="flex items-center justify-center gap-2">
        {steps.map((s, i) => {
          const state = i < activeIdx ? "done" : i === activeIdx ? "active" : "todo";
          return (
            <li key={s.key} className="flex items-center gap-2">
              {i > 0 && <span className="h-px w-6 bg-hairline" aria-hidden />}
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors",
                  state === "active" && "bg-foreground text-background",
                  state === "done" && "text-primary",
                  state === "todo" && "text-muted-foreground/60",
                )}
                aria-current={state === "active" ? "step" : undefined}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Header({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-8 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
      <h1 className="mt-3 font-display text-3xl font-medium tracking-[-0.02em]">{title}</h1>
    </div>
  );
}

function ProduceItemCard({
  item,
  partner,
  synthesisSupported,
  lang,
}: {
  item: PracticeItem;
  partner?: PracticeItem;
  synthesisSupported: boolean;
  lang: CoachLang;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      {item.note && (
        <span className="mb-4 rounded-full border border-hairline px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {item.note}
        </span>
      )}
      <h1
        className={cn(
          "font-display font-medium tracking-[-0.03em] text-foreground",
          item.kind === "phrase" ? "text-4xl leading-[1.1] sm:text-5xl" : "text-7xl sm:text-8xl",
        )}
      >
        {item.text}
      </h1>
      <p className="mt-5 font-mono text-base text-muted-foreground">{item.ipa}</p>
      {meaningFor(item.text, item.meaning) && (
        <p className="mt-3 max-w-md text-base italic text-primary/90">{meaningFor(item.text, item.meaning)}</p>
      )}
      {partner && (
        <p className="mt-3 text-sm text-muted-foreground">
          {t("not", lang)} <span className="font-medium text-foreground">{partner.text}</span>
        </p>
      )}
      <div className="mt-8 w-full max-w-sm border-t border-hairline pt-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {item.kind === "phrase" ? t("rhythmTip", lang) : t("mouthPosition", lang)}
        </p>
        <p className="mt-2 text-[15px] leading-relaxed text-foreground/85">
          {hintFor(item.id, item.mouthHint, lang)}
        </p>
      </div>
      <div className="mt-8">
        <ListenButton text={item.text} itemId={item.id} supported={synthesisSupported} />
      </div>
    </div>
  );
}

function DoneCard({
  lesson,
  results,
  total,
  sessionXp,
  sessionStars,
  bestCombo,
  onRestart,
  lang,
  studentName,
}: {
  lesson: Lesson;
  results: Record<string, boolean>;
  total: number;
  sessionXp: number;
  sessionStars: number;
  bestCombo: number;
  onRestart: () => void;
  lang: CoachLang;
  studentName: string | null;
}) {
  const clear = Object.values(results).filter(Boolean).length;
  const attempted = Object.keys(results).length;
  const firedRef = useRef(false);

  // Celebrate once, and unlock event-based achievements (perfect lesson, sound mastered).
  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    celebrate();
    sfx.finish();
    juice.centerBurst(sessionStars > 0 ? `+${sessionStars} ★` : undefined);
    if (attempted > 0 && clear === attempted) juice.sweep();
    // The movie moment — a brief cheer cutscene over the recap.
    cinematic.play({
      title: attempted > 0 && clear === attempted ? "¡Impecable!" : "¡Muy bien!",
      subtitle: t("lessonComplete", lang),
      stars: sessionStars,
    });

    void (async () => {
      const ids: string[] = [];
      if (attempted >= total && total > 0 && clear === total) ids.push("perfect_lesson");

      const progress = await repo.getAllProgress();
      const byItem = new Map(progress.map((p) => [p.itemId, p]));
      for (const catId of lesson.categoryIds) {
        const catItems = LESSONS.flatMap((l) => l.items).filter((i) => i.categoryId === catId);
        if (catItems.length > 0 && catItems.every((i) => { const p = byItem.get(i.id); return p && isMastered(p); })) {
          ids.push("sound_master");
        }
      }
      if (!ids.length) return;
      const player = await repo.getPlayerStats();
      const { stats, unlocked } = unlock(player, ids);
      if (unlocked.length) {
        await repo.savePlayerStats(stats);
        for (const id of unlocked) {
          const a = ACHIEVEMENT_BY_ID.get(id);
          if (a) {
            const tx = achievementText(id, a, lang);
            toast.success(lang === "es" ? `Logro — ${tx.name}` : `Achievement — ${tx.name}`, { description: tx.description });
            sfx.achievement();
          }
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spoken = lesson.items.filter((i) => i.id in results);

  return (
    <div className="animate-scale-in py-8 text-center">
      {/* Lumi leads the payoff — clapping proud on a clear, warm on a review */}
      <div className="relative mx-auto w-fit">
        <Lumi
          frame="bust"
          mood={
            attempted > 0 && clear === attempted
              ? "clap"
              : attempted > 0 && clear / attempted < 0.5
                ? "encourage"
                : "cheer"
          }
          className="mx-auto size-24"
          priority
        />
        {sessionStars > 0 && (
          <span className="star-chip bloom-gold absolute -right-9 top-0 animate-star-pop rounded-full px-3 py-1 font-display text-sm font-semibold">
            +{sessionStars} ★
          </span>
        )}
      </div>

      {/* Joel himself, proud of her, when the session went well. */}
      {attempted > 0 && clear / attempted >= 0.5 && (
        <div className="mx-auto mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span className="size-11 overflow-hidden rounded-full ring-2 ring-white/70 shadow-[0_8px_20px_-8px_rgba(0,0,0,0.3)]">
            <SceneVideo base="/character/joel-celebrate" className="h-full w-full object-cover object-[center_18%]" alt="Joel" />
          </span>
          <span>{lang === "es" ? "Joel está orgulloso de ti" : "Joel is proud of you"}</span>
        </div>
      )}

      <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">{t("lessonComplete", lang)}</p>
      <h2 className="mt-3 font-display text-4xl font-medium tracking-[-0.02em]">
        {attempted > 0 && clear === attempted
          ? "¡Impecable!"
          : studentName
            ? `¡Muy bien, ${studentName}!`
            : "¡Muy bien!"}
      </h2>
      <p className="mx-auto mt-3 max-w-sm text-muted-foreground">
        {attempted > 0
          ? lang === "es"
            ? `Dijiste ${attempted} y te salieron claras ${clear}. Cada repetición cuenta.`
            : `You spoke ${attempted} ${attempted === 1 ? "item" : "items"} and nailed ${clear}. Every rep counts.`
          : lang === "es"
            ? "Buen trabajo repasando la lección. Vuelve a grabar cuando quieras."
            : "Nice work going through the lesson. Come back and record when you're ready."}
      </p>
      {attempted > 0 && clear / attempted < 0.5 && (
        <p className="mx-auto mt-2 max-w-sm text-sm font-medium text-primary">{t("recapStruggled", lang)}</p>
      )}

      {attempted > 0 && (
        <div className="mx-auto mt-8 grid max-w-sm grid-cols-3 gap-2.5">
          <RecapStat value={`+${sessionXp}`} label={t("xpEarned", lang)} tone="blue" delay={0} />
          <RecapStat value={`${Math.round((clear / attempted) * 100)}%`} label={t("accuracy", lang)} tone="gold" delay={90} />
          <RecapStat value={`${bestCombo}×`} label={t("bestCombo", lang)} tone="red" delay={180} />
        </div>
      )}

      {/* What she said this session — wins and the ones coming back */}
      {spoken.length > 0 && (
        <div className="mx-auto mt-7 flex max-w-md flex-wrap justify-center gap-2">
          {spoken.map((item) => (
            <span
              key={item.id}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium",
                results[item.id]
                  ? "border-success/30 bg-success/[0.07] text-foreground"
                  : "border-hairline bg-secondary/50 text-muted-foreground",
              )}
            >
              {results[item.id] ? <Check className="size-3 text-success" /> : <X className="size-3" />}
              {item.text}
            </span>
          ))}
        </div>
      )}

      <div className="mt-9 flex items-center justify-center gap-3">
        <Button onClick={onRestart} variant="secondary" className="gap-1.5 rounded-full px-5">
          <Sparkles className="size-4" />
          {t("again", lang)}
        </Button>
        <Link href="/play" className={cn(buttonVariants(), "rounded-full px-5")}>
          {t("speedRound", lang)}
        </Link>
        <Link href="/dashboard" className={cn(buttonVariants({ variant: "secondary" }), "rounded-full px-5")}>
          {t("seeSounds", lang)}
        </Link>
      </div>
      <p className="mt-6 text-xs text-muted-foreground">{t("missedResurface", lang)}</p>
    </div>
  );
}

const RECAP_TONES = {
  blue: "border-primary/25 bg-primary/[0.06]",
  gold: "border-[color-mix(in_oklch,var(--co-yellow)_45%,transparent)] bg-[color-mix(in_oklch,var(--co-yellow)_14%,transparent)]",
  red: "border-[color-mix(in_oklch,var(--co-red)_30%,transparent)] bg-[color-mix(in_oklch,var(--co-red)_9%,transparent)]",
} as const;

function RecapStat({
  value,
  label,
  tone,
  delay,
}: {
  value: string;
  label: string;
  tone: keyof typeof RECAP_TONES;
  delay: number;
}) {
  return (
    <div
      className={cn("animate-pop-in rounded-2xl border px-3 py-4", RECAP_TONES[tone])}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="font-display text-2xl font-medium tabular-nums">{value}</div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
    </div>
  );
}

function buildPairs(items: PracticeItem[]): [PracticeItem, PracticeItem][] {
  const byPair = new Map<string, PracticeItem[]>();
  for (const it of items) {
    if (!it.pairId) continue;
    const list = byPair.get(it.pairId) ?? [];
    list.push(it);
    byPair.set(it.pairId, list);
  }
  return [...byPair.values()].filter((l) => l.length === 2).map((l) => [l[0], l[1]] as [PracticeItem, PracticeItem]);
}
