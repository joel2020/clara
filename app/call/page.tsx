"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mic, PhoneOff, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/lib/hooks/useSettings";
import { Splash } from "@/components/splash";
import { Lumi } from "@/components/lumi";
import { sfx } from "@/lib/sfx";
import { CALL_SCENARIOS, QA_CHECKS, type CallScenario, type QaKey } from "@/lib/content/call-scenarios";
import { createRecognition } from "@/lib/speech/recognition";
import { authHeaders } from "@/lib/auth-client";
import { recordQuestEvent } from "@/lib/quests";
import { repo } from "@/lib/db";

// The call simulator — the job path's hard mode.
//
// Lumi is not a tutor here: she is the AI guide role-playing an American customer
// with a problem, at natural speed. She has to run the call herself, and afterwards it is scored against the
// same four things a real BPO quality team checks on a recording.
//
// Deliberately not scored live. A scorecard ticking during a call would make her
// perform for the checklist instead of listening to the customer.

interface Turn {
  role: "customer" | "agent";
  text: string;
  es?: string;
}

interface CallScore {
  checks: { key: QaKey; passed: boolean }[];
  detailsHit: string[];
  detailsTotal: number;
  politeness: number;
  clarity: number;
  highlight: string;
  fix: string;
  score: number;
}

const DIFFICULTY_ES: Record<string, string> = {
  calm: "Tranquilo",
  annoyed: "Molesto",
  angry: "Furioso",
};

export default function CallPage() {
  const { settings, ready } = useSettings();
  const lang = settings.coachLanguage;
  const studentName = settings.studentName;

  const [scenario, setScenario] = useState<CallScenario | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [score, setScore] = useState<CallScore | null>(null);
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    audioRef.current = new Audio();
    return () => audioRef.current?.pause();
  }, []);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, thinking]);

  const speak = async (text: string) => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;
      const el = audioRef.current;
      if (!el) return;
      el.src = URL.createObjectURL(await res.blob());
      // Customers do not speak slowly. A touch above normal keeps it realistic.
      el.playbackRate = 1.08;
      await el.play().catch(() => {});
    } catch {
      /* the line is on screen regardless */
    }
  };

  const start = (s: CallScenario) => {
    sfx.tap();
    setScenario(s);
    setTurns([{ role: "customer", text: s.opener }]);
    setSuggestions([
      "Thank you for calling, my name is " + (studentName || "Ana"),
      "I'm really sorry about that",
      "May I have your full name, please?",
    ]);
    setScore(null);
    setError(null);
    void speak(s.opener);
  };

  const send = async (agentLine: string) => {
    if (!scenario) return;
    const next: Turn[] = [...turns, { role: "agent", text: agentLine }];
    setTurns(next);
    setSuggestions([]);
    setThinking(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          mode: "call",
          callScenarioId: scenario.id,
          studentName,
          coachLanguage: lang,
          history: next.map((t) => ({ role: t.role === "agent" ? "user" : "assistant", text: t.text })),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { reply: string; reply_es: string; suggestions: string[] };
      setTurns((prev) => [...prev, { role: "customer", text: data.reply, es: data.reply_es }]);
      setSuggestions(data.suggestions ?? []);
      void speak(data.reply);
    } catch {
      setError(lang === "es" ? "Se cayó la llamada. Intenta de nuevo." : "The call dropped. Try again.");
    } finally {
      setThinking(false);
    }
  };

  const speakTurn = async () => {
    if (listening || thinking) return;
    setListening(true);
    setError(null);
    try {
      const rec = createRecognition({});
      const res = await rec.result;
      setListening(false);
      if (res.transcript.trim()) await send(res.transcript.trim());
      else setError(lang === "es" ? "No se escuchó nada." : "Nothing was heard.");
    } catch {
      setListening(false);
      setError(lang === "es" ? "No se pudo usar el micrófono." : "The microphone could not be used.");
    }
  };

  const endCall = async () => {
    if (!scenario) return;
    sfx.tap();
    setScoring(true);
    try {
      const res = await fetch("/api/call-score", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          callScenarioId: scenario.id,
          turns: turns.map((t) => ({ role: t.role, text: t.text })),
          coachLanguage: lang,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const scored = (await res.json()) as CallScore;
      setScore(scored);
      // Persisted so job-path practice is measurable and can be counted on her
      // report — otherwise a finished call leaves no trace.
      void repo.saveCallScore({
        scenarioId: scenario.id,
        at: Date.now(),
        score: scored.score,
        checks: Object.fromEntries(scored.checks.map((c) => [c.key, c.passed])),
      });
      void recordQuestEvent("talk");
      sfx.finish?.();
    } catch {
      setError(lang === "es" ? "No se pudo calificar la llamada." : "The call could not be scored.");
    } finally {
      setScoring(false);
    }
  };

  if (!ready) return <Splash />;

  const shell = (children: React.ReactNode) => (
    <div className="mx-auto max-w-xl px-5 pb-28 pt-6 sm:px-6">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {lang === "es" ? "Inicio" : "Home"}
      </Link>
      <div className="mt-6">{children}</div>
    </div>
  );

  // ── Result ───────────────────────────────────────────────────────────────
  if (score) {
    return shell(
      <div className="rounded-3xl border border-hairline bg-card p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {lang === "es" ? "Tu llamada" : "Your call"}
        </p>
        <div className="mt-2 flex items-end gap-2">
          <span className="font-display text-6xl font-semibold leading-none tabular-nums">{score.score}</span>
          <span className="pb-2 text-sm text-muted-foreground">/ 100</span>
        </div>

        <div className="mt-5 grid gap-2">
          {QA_CHECKS.map((c) => {
            const passed = score.checks.find((x) => x.key === c.key)?.passed ?? false;
            return (
              <div key={c.key} className="flex items-center gap-3 text-sm">
                <span
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-full",
                    passed ? "bg-[oklch(0.55_0.082_168)] text-white" : "bg-secondary text-muted-foreground",
                  )}
                >
                  {passed ? <Check className="size-3" /> : <X className="size-3" />}
                </span>
                <span className={passed ? "" : "text-muted-foreground"}>{lang === "es" ? c.es : c.en}</span>
              </div>
            );
          })}
          {score.detailsTotal > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <span
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full",
                  score.detailsHit.length === score.detailsTotal
                    ? "bg-[oklch(0.55_0.082_168)] text-white"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                {score.detailsHit.length === score.detailsTotal ? <Check className="size-3" /> : <X className="size-3" />}
              </span>
              <span className={score.detailsHit.length === score.detailsTotal ? "" : "text-muted-foreground"}>
                {lang === "es" ? "Repitió los datos" : "Read the details back"} ({score.detailsHit.length}/
                {score.detailsTotal})
              </span>
            </div>
          )}
        </div>

        {score.highlight && (
          <p className="mt-5 rounded-2xl bg-primary/[0.06] p-4 text-sm">
            <span className="font-semibold text-primary">{lang === "es" ? "Bien hecho" : "Well done"}:</span>{" "}
            {score.highlight}
          </p>
        )}
        {score.fix && (
          <p className="mt-3 rounded-2xl bg-[oklch(0.66_0.11_70_/_0.09)] p-4 text-sm">
            <span className="font-semibold">{lang === "es" ? "Para la próxima" : "Next time"}:</span> {score.fix}
          </p>
        )}

        <div className="mt-6 grid gap-3">
          <button
            type="button"
            onClick={() => {
              setScore(null);
              setScenario(null);
              setTurns([]);
            }}
            className="rounded-2xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground"
          >
            {lang === "es" ? "Otra llamada" : "Another call"}
          </button>
        </div>
      </div>,
    );
  }

  // ── Scenario picker ──────────────────────────────────────────────────────
  if (!scenario) {
    return shell(
      <>
        <h1 className="font-display text-3xl font-semibold">{lang === "es" ? "Llamada real" : "Real call"}</h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          {lang === "es"
            ? "Un cliente estadounidense con un problema, a velocidad normal. Tú manejas la llamada; al final te califico como lo haría calidad en un BPO."
            : "An American customer with a real problem, at normal speed. You run the call; afterwards it is scored the way a BPO quality team would."}
        </p>
        <div className="mt-6 grid gap-3">
          {CALL_SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => start(s)}
              className="rounded-2xl border border-hairline bg-card p-4 text-left transition-colors hover:border-primary/50"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-display text-lg">{lang === "es" ? s.title.es : s.title.en}</span>
                <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                  {lang === "es" ? DIFFICULTY_ES[s.difficulty] : s.difficulty}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{lang === "es" ? s.blurb.es : s.blurb.en}</p>
            </button>
          ))}
        </div>
      </>,
    );
  }

  // ── In call ──────────────────────────────────────────────────────────────
  return shell(
    <div className="rounded-3xl border border-hairline bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="size-8">
            <Lumi mood="think" frame="bust" />
          </div>
          <div>
            <p className="font-display text-base">{lang === "es" ? "Lumi · Cliente" : "Lumi · Customer"}</p>
            <p className="text-xs text-muted-foreground">
              {lang === "es" ? scenario.title.es : scenario.title.en} ·{" "}
              {lang === "es" ? DIFFICULTY_ES[scenario.difficulty] : scenario.difficulty}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void endCall()}
          disabled={scoring || !turns.some((t) => t.role === "agent")}
          className="inline-flex items-center gap-2 rounded-full border border-hairline px-3 py-2 text-xs font-medium disabled:opacity-40"
        >
          <PhoneOff className="size-3.5" /> {scoring ? (lang === "es" ? "Calificando…" : "Scoring…") : lang === "es" ? "Terminar" : "End"}
        </button>
      </div>

      <div ref={scrollRef} className="mt-4 max-h-[46vh] overflow-y-auto pr-1">
        <div className="grid gap-2.5">
          {turns.map((t, i) => (
            <div
              key={i}
              className={cn(
                "rounded-2xl px-4 py-3 text-sm",
                t.role === "agent"
                  ? "ml-8 bg-primary text-primary-foreground"
                  : "border border-hairline bg-background",
              )}
            >
              <p lang={t.role === "customer" ? "en" : undefined}>{t.text}</p>
              {t.es && <p className="mt-1 text-xs italic opacity-70">{t.es}</p>}
            </div>
          ))}
          {thinking && <p className="text-xs text-muted-foreground">…</p>}
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void send(s)}
              className="rounded-full border border-hairline px-3 py-1.5 text-xs hover:border-primary/50"
              lang="en"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => void speakTurn()}
        disabled={listening || thinking}
        className={cn(
          "mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-semibold",
          listening ? "bg-foreground/80 text-background" : "bg-primary text-primary-foreground",
        )}
      >
        <Mic className="size-4" />{" "}
        {listening ? (lang === "es" ? "Escuchando…" : "Listening…") : lang === "es" ? "Hablar" : "Speak"}
      </button>

      {error && <p className="mt-3 text-sm text-muted-foreground">{error}</p>}
    </div>,
  );
}
