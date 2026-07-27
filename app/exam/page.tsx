"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mic, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/lib/hooks/useSettings";
import { useAllProgress } from "@/lib/hooks/useData";
import { repo } from "@/lib/db";
import { Splash } from "@/components/splash";
import { Lumi } from "@/components/lumi";
import { cinematic } from "@/components/cinematic";
import { sfx } from "@/lib/sfx";
import { dayKey } from "@/lib/gamification";
import { LESSON_BY_ID } from "@/lib/content/lessons";
import { levelLessonPool } from "@/lib/onboarding";
import { examEligibility, scoreExam, canAttemptToday, SECTIONS, PASS_SCORE, type SectionKey } from "@/lib/exams";
import { composeExam, retellKeywords, scoreRetell, type ExamSection } from "@/lib/exam-compose";
import { createRecognition } from "@/lib/speech/recognition";
import { scoreAttempt } from "@/lib/speech/scoring";
import { audioUrl } from "@/lib/speech/audio-key";
import { hasRecordedVoice } from "@/lib/speech/player";
import { authHeaders } from "@/lib/auth-client";
import { levelUp } from "@/lib/placement";

// The stage exam. One sitting per day, no retries, six sections — the only thing
// that moves a student's band.
//
// Deliberately austere compared with the drills: no stars, no combo, no juice
// mid-sitting. It should feel like a test, because its result is the claim the app
// makes about her level. Celebration happens only after a pass.
//
// Nothing here writes SRS progress. If exam answers counted as practice, a sitting
// would raise the very mastery percentage that unlocks the next sitting.

type Phase = "intro" | "running" | "grading" | "done";

const SECTION_COPY: Record<SectionKey, { title: string; how: string }> = {
  readAloud: { title: "Lee en voz alta", how: "Lee la frase con tu mejor pronunciación." },
  repeat: { title: "Escucha y repite", how: "Escucha a Joel y repite exactamente lo que dijo." },
  build: { title: "Arma la frase", how: "Toca las palabras en el orden correcto." },
  shortAnswer: { title: "¿Qué escuchaste?", how: "Escucha y elige el significado." },
  retell: { title: "Cuéntalo con tus palabras", how: "Escucha la historia y cuéntala como puedas." },
  openResponse: { title: "Habla libremente", how: "Responde la pregunta hablando unos segundos." },
};

export default function ExamPage() {
  const { settings, update, ready } = useSettings();
  const progress = useAllProgress();
  const level = settings.onboarding?.level ?? "A1";

  const [phase, setPhase] = useState<Phase>("intro");
  const [sectionIdx, setSectionIdx] = useState(0);
  const [itemIdx, setItemIdx] = useState(0);
  const [listening, setListening] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [result, setResult] = useState<ReturnType<typeof scoreExam> | null>(null);
  const [attemptedToday, setAttemptedToday] = useState<boolean | null>(null);
  const [placed, setPlaced] = useState<string[]>([]);
  // Stamped when she taps Start — an event, so the clock is read outside any
  // memoised body. It also means a sitting that crosses midnight is filed under
  // the day it began rather than the day it happened to finish.
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    audioRef.current = new Audio();
    return () => audioRef.current?.pause();
  }, []);

  // One sitting per calendar day, checked against recorded attempts.
  useEffect(() => {
    void repo.getExamAttempts().then((rows) => {
      setAttemptedToday(!canAttemptToday(rows[0]?.day ?? null, dayKey(new Date())));
    });
  }, []);

  const poolItemIds = useMemo(
    () => levelLessonPool(level).flatMap((id) => LESSON_BY_ID.get(id)?.items.map((i) => i.id) ?? []),
    [level],
  );
  const gate = useMemo(
    () => (progress ? examEligibility(progress, poolItemIds) : null),
    [progress, poolItemIds],
  );

  // Seeded by day + level, so a sitting is reproducible and a reload cannot
  // reroll into an easier paper.
  const exam = useMemo(() => {
    const pool = levelLessonPool(level).flatMap((id) => LESSON_BY_ID.get(id)?.items ?? []);
    return composeExam(level, pool, `${dayKey(new Date())}:${level}`);
  }, [level]);

  const section: ExamSection | undefined = exam.sections[sectionIdx];
  const item = section?.items[itemIdx];

  // Scores are mirrored into a ref because grading is kicked off from inside a
  // setTimeout: a closure created this render would otherwise read a stale copy
  // and grade the sitting on incomplete data.
  const scoresRef = useRef<Record<string, number[]>>({});
  const record = (key: string, score: number) => {
    scoresRef.current = { ...scoresRef.current, [key]: [...(scoresRef.current[key] ?? []), score] };
  };

  /** Grade, persist, and promote only on a pass. Driven by the event path, not an
   *  effect, so the sitting is graded exactly once. */
  // Plain functions, not useCallback: they only ever run from an event handler, so
  // memoising them buys nothing and would put the clock reads below inside a
  // memoised body (which react-hooks/purity rightly rejects).
  const finishExam = async () => {
    setPhase("grading");
    const results = SECTIONS.map((s) => {
      const got = scoresRef.current[s.key] ?? [];
      const mean = got.length ? Math.round(got.reduce((a, b) => a + b, 0) / got.length) : 0;
      return { key: s.key, score: mean };
    });
    const outcome = scoreExam(results, level);
    setResult(outcome);
    const began = startedAt ?? 0;
    await repo.saveExamAttempt({
      day: dayKey(new Date(began)),
      at: began,
      level,
      score: outcome.score,
      passed: outcome.passed,
      sections: Object.fromEntries(outcome.sections.map((s) => [s.key, s.score])),
      weakest: outcome.weakest,
    });
    if (outcome.passed && settings.onboarding) {
      await update({ onboarding: { ...settings.onboarding, level: levelUp(level) } });
      sfx.finish?.();
      cinematic.play({ title: `¡${levelUp(level)}!`, subtitle: "Subiste de nivel", stars: 0 });
    }
    setPhase("done");
  };

  const advance = () => {
    setNote(null);
    setPlaced([]);
    const s = exam.sections[sectionIdx];
    const total = s.key === "retell" || s.key === "openResponse" ? 1 : s.items.length;
    if (itemIdx + 1 < total) {
      setItemIdx(itemIdx + 1);
      return;
    }
    if (sectionIdx + 1 < exam.sections.length) {
      setSectionIdx(sectionIdx + 1);
      setItemIdx(0);
      return;
    }
    void finishExam();
  };

  const play = async (url: string) => {
    const el = audioRef.current;
    if (!el) return;
    el.src = url;
    await el.play().catch(() => {});
  };

  const speak = async (text: string) => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("tts");
      await play(URL.createObjectURL(await res.blob()));
    } catch {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "en-US";
        u.rate = 0.95;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      }
    }
  };

  /** Spoken sections: capture, score, record, advance. Never retried. */
  const speakAndScore = async () => {
    if (!section || listening) return;
    setListening(true);
    setNote(null);
    const target = item?.text;
    try {
      const rec = createRecognition(target ? { target } : {});
      const res = await rec.result;
      let score = 0;
      if (section.key === "retell") {
        score = scoreRetell(res.transcript, retellKeywords(level));
      } else if (section.key === "openResponse") {
        const graded = await fetch("/api/grade", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await authHeaders()) },
          body: JSON.stringify({ kind: "openResponse", prompt: section.prompt, transcript: res.transcript, level }),
        })
          .then((r) => (r.ok ? r.json() : { score: 0, fix: null }))
          .catch(() => ({ score: 0, fix: null }));
        score = Number(graded.score) || 0;
        if (graded.fix) setNote(graded.fix);
      } else if (target) {
        score = scoreAttempt({
          target,
          transcript: res.transcript,
          alternatives: res.alternatives,
          kind: "phrase",
          assessment: res.assessment,
        }).score;
      }
      record(section.key, score);
      setListening(false);
      window.setTimeout(advance, section.key === "openResponse" && note ? 1800 : 500);
    } catch {
      // A failed capture scores zero: an exam cannot be dodged by a silent mic.
      record(section.key, 0);
      setNote("No se escuchó nada. Esa parte quedó en cero.");
      setListening(false);
      window.setTimeout(advance, 1400);
    }
  };

  /** Word-order section: exact sequence, one shot. */
  const checkBuild = () => {
    if (!item) return;
    const want = item.text.replace(/[.,!?]/g, "").trim().toLowerCase().split(/\s+/);
    const got = placed.map((w) => w.toLowerCase());
    const correct = want.length === got.length && want.every((w, i) => w === got[i]);
    record("build", correct ? 100 : 0);
    setNote(correct ? null : item.text);
    window.setTimeout(advance, correct ? 400 : 1600);
  };

  /** Meaning-recognition section. */
  const answerShort = (chosen: string) => {
    if (!item) return;
    const correct = chosen === (item.meaning ?? item.text);
    record("shortAnswer", correct ? 100 : 0);
    setNote(correct ? null : (item.meaning ?? item.text));
    window.setTimeout(advance, correct ? 400 : 1400);
  };

  if (!ready || progress === undefined || attemptedToday === null) return <Splash />;

  const shell = (children: React.ReactNode) => (
    <div className="mx-auto max-w-xl px-5 pb-24 pt-6 sm:px-6">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Inicio
      </Link>
      <div className="mt-6">{children}</div>
    </div>
  );

  const card = "rounded-3xl border border-hairline bg-card p-6";

  // ── Gates ────────────────────────────────────────────────────────────────
  if (gate && !gate.eligible) {
    return shell(
      <div className={card}>
        <h1 className="font-display text-2xl font-semibold">Todavía no</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          El examen se abre cuando domines el 80% de tu nivel. Te faltan {gate.remaining} frases.
        </p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-r bg-primary/50" style={{ width: `${Math.max(Math.round(gate.ratio * 100), 1)}%` }} />
        </div>
        <Link href="/today" className="mt-6 block rounded-2xl bg-primary px-5 py-3.5 text-center text-sm font-semibold text-primary-foreground">
          Seguir practicando
        </Link>
      </div>,
    );
  }

  if (attemptedToday && phase === "intro") {
    return shell(
      <div className={card}>
        <h1 className="font-display text-2xl font-semibold">Ya lo intentaste hoy</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Un intento por día. Vuelve mañana — mientras tanto, practica lo que te costó.
        </p>
        <Link href="/today" className="mt-6 block rounded-2xl bg-primary px-5 py-3.5 text-center text-sm font-semibold text-primary-foreground">
          Practicar
        </Link>
      </div>,
    );
  }

  // ── Intro ────────────────────────────────────────────────────────────────
  if (phase === "intro") {
    return shell(
      <div className={card}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Examen de nivel</p>
        <h1 className="mt-1 font-display text-3xl font-semibold">{level} → {levelUp(level)}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Seis partes, unos 10 minutos. Un intento por día y no se puede repetir una parte, así que tómate tu tiempo
          antes de hablar. Necesitas {PASS_SCORE} para pasar.
        </p>
        <ul className="mt-4 grid gap-2 text-sm">
          {SECTIONS.map((s, i) => (
            <li key={s.key} className="flex gap-3 text-muted-foreground">
              <span className="tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-foreground">{SECTION_COPY[s.key].title}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => {
            sfx.tap();
            setStartedAt(Date.now());
            setPhase("running");
          }}
          className="mt-6 w-full rounded-2xl bg-primary px-5 py-4 text-sm font-semibold text-primary-foreground"
        >
          Empezar el examen
        </button>
      </div>,
    );
  }

  // ── Grading ──────────────────────────────────────────────────────────────
  if (phase === "grading") {
    return shell(
      <div className={cn(card, "text-center")}>
        <Lumi frame="bust" mood="think" />
        <p className="mt-4 text-sm text-muted-foreground">Calificando tu examen…</p>
      </div>,
    );
  }

  // ── Result ───────────────────────────────────────────────────────────────
  if (phase === "done" && result) {
    return shell(
      <div className={card}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Resultado</p>
        <div className="mt-2 flex items-end gap-2">
          <span className="font-display text-6xl font-semibold leading-none tabular-nums">{result.score}</span>
          <span className="pb-2 text-sm text-muted-foreground">/ 100</span>
        </div>
        <p className="mt-3 font-display text-xl">
          {result.passed ? `¡Pasaste a ${result.level}!` : "Aún no, y está bien."}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {result.passed
            ? "Tu nivel ya subió. El contenido nuevo está abierto."
            : `Necesitas ${PASS_SCORE}. Lo que más te frenó: ${SECTION_COPY[result.weakest ?? "readAloud"].title.toLowerCase()}.`}
        </p>
        <div className="mt-5 grid gap-3">
          {result.sections.map((s) => (
            <div key={s.key}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span>{SECTION_COPY[s.key].title}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{s.score}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-r bg-primary" style={{ width: `${Math.max(s.score, 1)}%` }} />
              </div>
            </div>
          ))}
        </div>
        <Link href="/" className="mt-6 block rounded-2xl bg-primary px-5 py-3.5 text-center text-sm font-semibold text-primary-foreground">
          Volver al inicio
        </Link>
      </div>,
    );
  }

  // ── Running ──────────────────────────────────────────────────────────────
  if (!section) return <Splash />;
  const copy = SECTION_COPY[section.key];
  const totalItems = section.key === "retell" || section.key === "openResponse" ? 1 : section.items.length;
  const openPrompt =
    section.key === "openResponse" ? (section.prompt ?? "").split(" | ")[itemIdx] ?? (section.prompt ?? "") : section.prompt;

  return shell(
    <div className={card}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {copy.title}
        </p>
        <span className="text-xs tabular-nums text-muted-foreground">
          {sectionIdx + 1}/{SECTIONS.length} · {itemIdx + 1}/{totalItems}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{copy.how}</p>

      {/* readAloud shows the target; repeat hides it until after she speaks. */}
      {section.key === "readAloud" && item && (
        <p lang="en" className="mt-6 font-display text-3xl leading-snug">{item.text}</p>
      )}

      {section.key === "repeat" && item && (
        <button
          type="button"
          onClick={() => void (hasRecordedVoice(item.itemId) ? play(audioUrl(item.itemId)) : speak(item.text))}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-hairline px-5 py-4 text-sm font-medium"
        >
          <Play className="size-4" /> Escuchar
        </button>
      )}

      {section.key === "retell" && (
        <button
          type="button"
          onClick={() => void speak(section.prompt ?? "")}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-hairline px-5 py-4 text-sm font-medium"
        >
          <Play className="size-4" /> Escuchar la historia
        </button>
      )}

      {section.key === "openResponse" && (
        <p lang="en" className="mt-6 font-display text-2xl leading-snug">{openPrompt}</p>
      )}

      {section.key === "shortAnswer" && item && (
        <>
          <button
            type="button"
            onClick={() => void (hasRecordedVoice(item.itemId) ? play(audioUrl(item.itemId)) : speak(item.text))}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-hairline px-5 py-4 text-sm font-medium"
          >
            <Play className="size-4" /> Escuchar
          </button>
          <div className="mt-4 grid gap-2">
            {(() => {
              const right = item.meaning ?? item.text;
              const distractors = section.items
                .filter((i) => i.itemId !== item.itemId)
                .map((i) => i.meaning ?? i.text)
                .filter((m) => m !== right)
                .slice(0, 3);
              const options = [right, ...distractors].sort((a, b) => a.localeCompare(b));
              return options.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => answerShort(o)}
                  className="rounded-2xl border border-hairline px-4 py-3 text-left text-sm hover:border-primary/50"
                >
                  {o}
                </button>
              ));
            })()}
          </div>
        </>
      )}

      {section.key === "build" && item && (
        <>
          <div className="mt-6 min-h-14 rounded-2xl border border-dashed border-hairline p-3">
            <p lang="en" className="font-display text-xl">{placed.join(" ") || "…"}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(() => {
              const words = item.text.replace(/[.,!?]/g, "").trim().split(/\s+/);
              const remaining = [...words];
              for (const p of placed) {
                const i = remaining.indexOf(p);
                if (i >= 0) remaining.splice(i, 1);
              }
              const shown = [...remaining].sort((a, b) => a.localeCompare(b));
              return shown.map((w, i) => (
                <button
                  key={`${w}-${i}`}
                  type="button"
                  onClick={() => setPlaced((prev) => [...prev, w])}
                  className="rounded-xl border border-hairline px-3 py-2 text-sm"
                >
                  {w}
                </button>
              ));
            })()}
          </div>
          <button
            type="button"
            onClick={checkBuild}
            disabled={!placed.length}
            className="mt-4 w-full rounded-2xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            Revisar
          </button>
        </>
      )}

      {/* Spoken sections share one control. */}
      {(section.key === "readAloud" || section.key === "repeat" || section.key === "retell" || section.key === "openResponse") && (
        <button
          type="button"
          onClick={() => void speakAndScore()}
          disabled={listening}
          className={cn(
            "mt-5 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-semibold",
            listening ? "bg-foreground/80 text-background" : "bg-primary text-primary-foreground",
          )}
        >
          <Mic className="size-4" /> {listening ? "Escuchando…" : "Hablar"}
        </button>
      )}

      {note && <p className="mt-4 text-sm text-muted-foreground">{note}</p>}
    </div>,
  );
}
