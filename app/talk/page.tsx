"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mic, Square, RotateCcw, Volume2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/lib/hooks/useSettings";
import { t } from "@/lib/i18n";
import { sfx } from "@/lib/sfx";
import { SCENARIOS, type Scenario } from "@/lib/content/scenarios";
import { createRecognition, type RecognitionHandle } from "@/lib/speech/recognition";

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

  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [correction, setCorrection] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recRef = useRef<RecognitionHandle | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastJoelLine = useRef<string>("");

  // Ensure a single reusable <audio> element (created on the client).
  useEffect(() => {
    audioRef.current = new Audio();
    return () => {
      audioRef.current?.pause();
      recRef.current?.cancel();
    };
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const el = audioRef.current;
      if (!el) return;
      el.src = url;
      el.onended = () => URL.revokeObjectURL(url);
      await el.play().catch(() => {});
    } catch {
      /* voice is best-effort; the text is always on screen */
    }
  }, []);

  const start = useCallback(
    (s: Scenario) => {
      sfx.tap();
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

  const reset = useCallback(() => {
    recRef.current?.cancel();
    audioRef.current?.pause();
    setScenario(null);
    setTurns([]);
    setPhase("idle");
    setCorrection(null);
    setSuggestions([]);
    setError(null);
    setNotConfigured(false);
  }, []);

  // Send the running conversation to Joel and handle his reply.
  const send = useCallback(
    async (herLine: string, nextTurns: Turn[]) => {
      if (!scenario) return;
      setPhase("thinking");
      setCorrection(null);
      setSuggestions([]);
      setError(null);
      // History excludes the opener (the server seeds that itself).
      const history = nextTurns.slice(1).map((turn) => ({
        role: turn.role === "her" ? ("user" as const) : ("assistant" as const),
        text: turn.en,
      }));
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenarioId: scenario.id,
            studentName: settings.studentName,
            coachLanguage: lang,
            history,
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
        };
        setTurns((prev) => [...prev, { role: "joel", en: data.reply, es: data.reply_es }]);
        setCorrection(data.correction);
        setSuggestions(data.suggestions ?? []);
        setPhase("idle");
        sfx.tap();
        void speak(data.reply);
      } catch {
        setError(t("talkError", lang));
        setPhase("idle");
      }
      void herLine;
    },
    [scenario, settings.studentName, lang, speak],
  );

  const addHerLine = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean) return;
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

  if (!ready) return null;

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
          <Bubble key={i} turn={turn} lang={lang} onReplay={turn.role === "joel" ? () => void speak(turn.en) : undefined} replayLabel={t("talkReplay", lang)} />
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
  onReplay,
  replayLabel,
}: {
  turn: Turn;
  lang: "es" | "en";
  onReplay?: () => void;
  replayLabel: string;
}) {
  const isJoel = turn.role === "joel";
  return (
    <div className={cn("flex flex-col gap-1", isJoel ? "items-start" : "items-end")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 leading-relaxed",
          isJoel ? "bg-card border border-hairline" : "bg-primary text-primary-foreground",
        )}
      >
        <p className="font-medium">{turn.en}</p>
        {turn.es && lang === "es" && (
          <p className={cn("mt-1 text-sm", isJoel ? "text-muted-foreground" : "text-primary-foreground/75")}>
            {turn.es}
          </p>
        )}
      </div>
      {isJoel && onReplay && (
        <button
          type="button"
          onClick={onReplay}
          className="inline-flex items-center gap-1 pl-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
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
