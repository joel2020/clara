"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mic, Square, RotateCcw, Volume2, Loader2, BookmarkPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/lib/hooks/useSettings";
import { t } from "@/lib/i18n";
import { sfx } from "@/lib/sfx";
import { SCENARIOS, type Scenario } from "@/lib/content/scenarios";
import { createRecognition, type RecognitionHandle } from "@/lib/speech/recognition";
import { repo } from "@/lib/db";
import { recordQuestEvent } from "@/lib/quests";
import { weakestItems } from "@/lib/weak-items";
import { JoelAvatar } from "@/components/joel-avatar";
import { Splash } from "@/components/splash";
import { authHeaders } from "@/lib/auth-client";
import { SceneVideo } from "@/components/scene-video";

// Which cinematic scene loop backs each roleplay.
const SCENE_FOR: Record<string, string> = {
  greetings: "loop-social-9x16",
  cafe: "loop-cafe-9x16",
  directions: "loop-citywalk-9x16",
  shopping: "loop-citywalk-9x16",
  smalltalk: "loop-social-9x16",
  plans: "loop-restaurant-9x16",
};
import type { ConvItem } from "@/lib/db/types";

// Turn a mined phrase into a stable id so the same phrase isn't added twice.
function convItemId(phrase: string): string {
  const slug = phrase
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `conv:${slug || "phrase"}`;
}

// The live conversation partner. She picks a situation, then really talks with
// Joel: she speaks, the server transcribes + asks Claude for Joel's next line,
// and it plays back in Joel's own voice. A gentle tip and a couple of "you
// could say…" prompts keep an A1–A2 beginner moving without freezing.

interface Turn {
  role: "joel" | "her";
  en: string;
  es?: string;
}

type Phase = "idle" | "recording" | "thinking";

export default function TalkPage() {
  const { settings, ready } = useSettings();
  const lang = settings.coachLanguage;
  // Read off settings once so they can be plain deps of send() below.
  const studentName = settings.studentName;
  const level = settings.onboarding?.level;
  const goal = settings.onboarding?.goal;

  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [correction, setCorrection] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [savedPhrase, setSavedPhrase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recRef = useRef<RecognitionHandle | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastJoelLine = useRef<string>("");
  // Session tracking for the ten-minute milestone. Refs, not state: these are
  // written from audio callbacks and timeouts, where a closure would go stale.
  const sessionStart = useRef<number | null>(null);
  const herTurns = useRef(0);
  const pauses = useRef<number[]>([]);
  const readyToSpeakAt = useRef<number | null>(null);
  const savedSession = useRef(false);
  const scenarioIdRef = useRef<string>("unknown");
  const [focusWords, setFocusWords] = useState<string[]>([]);

  // Ensure a single reusable <audio> element (created on the client).
  useEffect(() => {
    audioRef.current = new Audio();
    return () => {
      audioRef.current?.pause();
      recRef.current?.cancel();
    };
  }, []);

  // Her weakest items — Joel quietly works them into the conversation.
  // Conversation track ONLY: sounds-track items are isolated pronunciation
  // targets ("vase", "base", "boat"), and asking Joel to work those into a scene
  // produced nonsense turns. Those belong in the sound drills, not here.
  useEffect(() => {
    void repo.getAllProgress().then((all) => {
      setFocusWords(weakestItems(all, 5, { track: "conversation" }).map((w) => w.text));
    });
  }, []);

  // Keep the conversation scrolled to the newest line.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, phase, correction, suggestions]);

  const speak = useCallback(async (text: string) => {
    lastJoelLine.current = text;
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const el = audioRef.current;
      if (!el) return;
      el.src = url;
      el.onended = () => {
        URL.revokeObjectURL(url);
        setSpeaking(false);
        // His line just finished: the clock on her hesitation starts here.
        readyToSpeakAt.current = Date.now();
      };
      el.onpause = () => setSpeaking(false);
      setSpeaking(true);
      await el.play().catch(() => setSpeaking(false));
    } catch {
      /* voice is best-effort; the text is always on screen */
    }
  }, []);

  const start = useCallback(
    (s: Scenario) => {
      sfx.tap();
      sessionStart.current = Date.now();
      herTurns.current = 0;
      pauses.current = [];
      readyToSpeakAt.current = null;
      savedSession.current = false;
      scenarioIdRef.current = s.id;
      setScenario(s);
      setTurns([{ role: "joel", en: s.opener.en, es: s.opener.es }]);
      setCorrection(null);
      setSuggestions(s.starters);
      setError(null);
      setNotConfigured(false);
      void speak(s.opener.en);
    },
    [speak],
  );

  /**
   * Persist the session once — the milestone's evidence.
   *
   * Reads only refs, so it has no dependencies and stays safe to call from an
   * unmount cleanup, where a callback captured during render would be stale.
   */
  const saveSession = useCallback((completed: boolean) => {
    const startedAt = sessionStart.current;
    if (!startedAt || savedSession.current || herTurns.current === 0) return;
    savedSession.current = true;
    const measured = pauses.current.filter((p) => p > 0 && p < 60_000);
    void repo.saveTalkSession({
      scenarioId: scenarioIdRef.current,
      at: startedAt,
      durationMs: Date.now() - startedAt,
      studentTurns: herTurns.current,
      avgPauseMs: measured.length ? Math.round(measured.reduce((a, b) => a + b, 0) / measured.length) : null,
      completed,
    });
  }, []);

  // Navigating away mid-conversation: record it as abandoned rather than losing it.
  useEffect(() => {
    return () => saveSession(false);
  }, [saveSession]);

  const reset = useCallback(() => {
    // Leaving a conversation deliberately still counts as completing it — she
    // talked. Only an unmount mid-session is treated as abandoned.
    saveSession(true);
    recRef.current?.cancel();
    audioRef.current?.pause();
    setScenario(null);
    setTurns([]);
    setPhase("idle");
    setCorrection(null);
    setSuggestions([]);
    setError(null);
    setNotConfigured(false);
  }, [saveSession]);

  // Send the running conversation to Joel and handle his reply.
  const send = useCallback(
    async (herLine: string, nextTurns: Turn[]) => {
      if (!scenario) return;
      setPhase("thinking");
      setCorrection(null);
      setSuggestions([]);
      setSavedPhrase(null);
      setError(null);
      // History excludes the opener (the server seeds that itself).
      const history = nextTurns.slice(1).map((turn) => ({
        role: turn.role === "her" ? ("user" as const) : ("assistant" as const),
        text: turn.en,
      }));
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await authHeaders()) },
          body: JSON.stringify({
            scenarioId: scenario.id,
            studentName,
            coachLanguage: lang,
            history,
            focusWords,
            level,
            goal,
          }),
        });
        if (res.status === 503) {
          setNotConfigured(true);
          setPhase("idle");
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as {
          reply: string;
          reply_es: string;
          correction: string | null;
          suggestions: string[];
          practice: { phrase: string; meaning: string } | null;
        };
        setTurns((prev) => [...prev, { role: "joel", en: data.reply, es: data.reply_es }]);
        setCorrection(data.correction);
        setSuggestions(data.suggestions ?? []);
        setPhase("idle");
        sfx.tap();
        void speak(data.reply);
        // Learning loop: this exchange counts toward the daily "talk" quest, and
        // the phrase worth drilling is saved into her review deck as homework.
        void recordQuestEvent("talk");
        if (data.practice?.phrase) {
          const item: ConvItem = {
            id: convItemId(data.practice.phrase),
            text: data.practice.phrase,
            ipa: "",
            mouthHint: "",
            kind: "phrase",
            categoryId: "conversation",
            phoneme: "chunk",
            meaning: data.practice.meaning || undefined,
            source: "talk",
            scenarioId: scenario.id,
            createdAt: Date.now(),
          };
          void repo.saveConvItem(item);
          setSavedPhrase(data.practice.phrase);
        }
      } catch {
        setError(t("talkError", lang));
        setPhase("idle");
      }
      void herLine;
    },
    // focusWords / level / goal load asynchronously after mount, so they must be
    // deps — otherwise this callback keeps the empty values it closed over and
    // Joel never sees her level, goal, or practice phrases.
    [scenario, studentName, level, goal, focusWords, lang, speak],
  );


  const addHerLine = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean) return;
      herTurns.current += 1;
      if (readyToSpeakAt.current) {
        pauses.current.push(Date.now() - readyToSpeakAt.current);
        readyToSpeakAt.current = null;
      }
      setTurns((prev) => {
        const next: Turn[] = [...prev, { role: "her", en: clean }];
        void send(clean, next);
        return next;
      });
    },
    [send],
  );

  const record = useCallback(() => {
    if (phase !== "idle") return;
    audioRef.current?.pause();
    setError(null);
    sfx.tap();
    const handle = createRecognition({ lang: "en-US" });
    recRef.current = handle;
    setPhase("recording");
    handle.result
      .then((r) => {
        setPhase("idle");
        recRef.current = null;
        addHerLine(r.transcript);
      })
      .catch((e: { code?: string; message?: string }) => {
        setPhase("idle");
        recRef.current = null;
        if (e?.code !== "cancelled") setError(e?.message ?? t("talkError", lang));
      });
  }, [phase, addHerLine, lang]);

  const stopRecording = useCallback(() => {
    recRef.current?.stop();
  }, []);

  if (!ready) return <Splash />;

  // ── Scenario picker ──────────────────────────────────────────────────────
  if (!scenario) {
    return (
      <div className="mx-auto max-w-3xl px-5 pb-24 pt-14 sm:px-6 sm:pt-20">
        <BackLink lang={lang} />
        <section className="mt-6 animate-fade-up">
          <p className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            <span className="flag-dots" aria-hidden>
              <i /><i /><i />
            </span>
            {t("talkEyebrow", lang)}
          </p>
          <h1 className="mt-5 font-display text-[2.5rem] font-medium leading-[1.05] tracking-[-0.03em] sm:text-5xl">
            {t("talkTitle", lang)}
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">{t("talkIntro", lang)}</p>
        </section>

        <h2 className="mt-12 font-display text-sm font-semibold uppercase tracking-[0.18em] text-foreground">
          {t("talkChoose", lang)}
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => start(s)}
              className="group flex items-center gap-4 rounded-2xl border border-hairline bg-card px-5 py-4 text-left transition-colors hover:border-primary/40 active:scale-[0.99]"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-2xl">{s.emoji}</span>
              <div className="flex-1">
                <p className="font-display text-lg font-medium tracking-[-0.01em]">{s.title[lang]}</p>
                <p className="text-sm text-muted-foreground">{s.blurb[lang]}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Conversation ─────────────────────────────────────────────────────────
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col px-5 sm:px-6">
      {/* Immersive scene backdrop — a dim cinematic loop that matches the
          roleplay, so it feels like she's really in the moment. */}
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
        <SceneVideo base={`/scenes/${SCENE_FOR[scenario.id] ?? "loop-cafe-9x16"}`} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-background/85 backdrop-blur-[2px]" />
      </div>
      <header className="flex items-center justify-between gap-3 py-4">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {t("talkChange", lang)}
        </button>
        <p className="flex items-center gap-2 text-sm font-medium">
          <span className="text-lg">{scenario.emoji}</span>
          {scenario.title[lang]}
        </p>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto py-4">
        {turns.map((turn, i) => (
          <Bubble
            key={i}
            turn={turn}
            lang={lang}
            speaking={turn.role === "joel" && i === turns.length - 1 && speaking}
            onReplay={turn.role === "joel" ? () => void speak(turn.en) : undefined}
            replayLabel={t("talkReplay", lang)}
          />
        ))}

        {phase === "thinking" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t("talkThinking", lang)}
          </div>
        )}

        {notConfigured && (
          <div className="rounded-2xl border border-hairline bg-card p-5">
            <p className="font-display text-lg font-medium">{t("talkNotConfiguredTitle", lang)}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("talkNotConfigured", lang)}</p>
          </div>
        )}

        {correction && (
          <div className="rounded-2xl border border-primary/25 bg-primary/[0.05] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{t("talkTip", lang)}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground">{correction}</p>
          </div>
        )}

        {savedPhrase && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BookmarkPlus className="size-4 text-success" />
            <span>
              {t("talkSaved", lang)} <span className="font-medium text-foreground">&ldquo;{savedPhrase}&rdquo;</span>
            </span>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {/* Composer */}
      <div className="sticky bottom-0 space-y-3 border-t border-hairline bg-background/95 py-4 backdrop-blur">
        {suggestions.length > 0 && phase === "idle" && (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {t("talkTrySaying", lang)}
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => addHerLine(s)}
                  className="rounded-full border border-hairline bg-card px-3.5 py-1.5 text-sm transition-colors hover:border-primary/40 active:scale-[0.98]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={phase === "recording" ? stopRecording : record}
            disabled={phase === "thinking"}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-2.5 rounded-full px-6 py-4 text-sm font-medium transition-all active:scale-[0.99] disabled:opacity-40",
              phase === "recording"
                ? "bg-destructive text-white"
                : "bg-foreground text-background hover:opacity-90",
            )}
          >
            {phase === "recording" ? (
              <>
                <Square className="size-4 fill-current" />
                {t("talkStop", lang)}
              </>
            ) : (
              <>
                <Mic className="size-5" />
                {phase === "thinking" ? t("talkThinking", lang) : t("talkYourTurn", lang)}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => start(scenario)}
            title={t("talkRestart", lang)}
            className="grid size-12 shrink-0 place-items-center rounded-full border border-hairline text-muted-foreground transition-colors hover:text-foreground"
          >
            <RotateCcw className="size-4" />
          </button>
        </div>
        {phase === "recording" && (
          <p className="text-center text-sm text-muted-foreground">{t("talkListening", lang)}</p>
        )}
      </div>
    </div>
  );
}

function Bubble({
  turn,
  lang,
  speaking,
  onReplay,
  replayLabel,
}: {
  turn: Turn;
  lang: "es" | "en";
  speaking?: boolean;
  onReplay?: () => void;
  replayLabel: string;
}) {
  const isJoel = turn.role === "joel";
  return (
    <div className={cn("flex flex-col gap-1", isJoel ? "items-start" : "items-end")}>
      <div className="flex max-w-[92%] items-end gap-2">
        {isJoel && <JoelAvatar speaking={speaking} className="mb-1" />}
        <div
          className={cn(
            "rounded-2xl px-4 py-3 leading-relaxed",
            isJoel ? "rounded-bl-md border border-hairline bg-card" : "bg-primary text-primary-foreground",
          )}
        >
          <p className="font-medium">{turn.en}</p>
          {turn.es && lang === "es" && (
            <p className={cn("mt-1 text-sm", isJoel ? "text-muted-foreground" : "text-primary-foreground/75")}>
              {turn.es}
            </p>
          )}
        </div>
      </div>
      {isJoel && onReplay && (
        <button
          type="button"
          onClick={onReplay}
          className="inline-flex items-center gap-1 pl-11 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Volume2 className="size-3.5" />
          {replayLabel}
        </button>
      )}
    </div>
  );
}

function BackLink({ lang }: { lang: "es" | "en" }) {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      {t("navLessons", lang)}
    </Link>
  );
}
