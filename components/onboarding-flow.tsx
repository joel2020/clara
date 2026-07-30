"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Volume2, RotateCcw, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/lib/hooks/useSettings";
import { usePlayer } from "@/lib/hooks/usePlayer";
import { sfx } from "@/lib/sfx";
import { CharacterIllustration } from "@/components/character";
import { juice } from "@/components/juice";
import {
  SKILLS, type Skill, type SelfLevel, type Level,
  startDifficulty, nextDifficulty, shouldContinue, scorePlacement, difficultyToLevel,
  levelIndex, levelDown, type AnswerRecord, type PlacementResult,
} from "@/lib/placement";
import { GOALS, type Goal, type DailyMinutes, firstWeekPlan, levelBlurbEs, type OnboardingProfile } from "@/lib/onboarding";
import type { LearningPath } from "@/lib/paths";
import { PLACEMENT_BANK, pickQuestion, type PlacementQ } from "@/lib/content/placement-questions";
import { authHeaders } from "@/lib/auth-client";

// Fisher–Yates: return a shuffled copy (never mutate the shared question bank).
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Speak a listening prompt in Joel's real (ElevenLabs) voice via /api/tts,
// falling back to browser speech only if the request fails so an item is never
// silent. Reuses the audio element across calls.
async function playJoelVoice(text: string, audioRef: React.MutableRefObject<HTMLAudioElement | null>) {
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error("tts");
    const url = URL.createObjectURL(await res.blob());
    let el = audioRef.current;
    if (!el) {
      el = new Audio();
      audioRef.current = el;
    }
    el.src = url;
    el.onended = () => URL.revokeObjectURL(url);
    await el.play().catch(() => {});
  } catch {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }
}

// Premium adaptive onboarding, in Colombian Spanish. Collects who she is and what
// she's after, then runs a short adaptive English check that gets harder or
// easier as she answers — landing on a CEFR level with a friendly result and a
// personalized first week. Feels like a challenge, not an exam. Self-gates: only
// shows for a signed-in learner who hasn't been placed yet.

type Step = "name" | "place" | "path" | "goal" | "minutes" | "self" | "test" | "result";
const SKILL_ROTATION: Skill[] = ["listening", "vocabulary", "grammar", "reading"];
const TOTAL_STEPS = 7; // name..self + test (result isn't counted on the bar)

// The two destinations. Asked in her words — no "CEFR", no "BPO".
const PATH_OPTIONS: { id: LearningPath; es: string; blurb: string }[] = [
  {
    id: "job",
    es: "Para trabajar",
    blurb: "Quiero un puesto en soporte o servicio al cliente con una empresa de Estados Unidos.",
  },
  {
    id: "general",
    es: "Para hablar con confianza",
    blurb: "Quiero conversar sin bloquearme: viajes, amigos, la familia, el día a día.",
  },
];

const SELF_OPTIONS: { id: SelfLevel; es: string }[] = [
  { id: "zero", es: "Empiezo de cero" },
  { id: "basics", es: "Sé lo básico" },
  { id: "understandMore", es: "Entiendo más de lo que hablo" },
  { id: "converse", es: "Puedo tener conversaciones" },
];

export function OnboardingFlow() {
  const { settings, update, ready } = useSettings();
  const player = usePlayer();
  // Give login-time cloud hydration a moment to land before we decide whether
  // this is a brand-new learner — so an existing signed-in user never flashes
  // into onboarding on a fresh device while her progress is still loading.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(true), 1200);
    return () => window.clearTimeout(t);
  }, []);
  const [step, setStep] = useState<Step>("name");
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const name = nameOverride ?? settings.studentName ?? "";
  const [country, setCountry] = useState("Colombia");
  const [city, setCity] = useState("Medellín");
  const [path, setPath] = useState<LearningPath | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [minutes, setMinutes] = useState<DailyMinutes>(20);
  const [self, setSelf] = useState<SelfLevel | null>(null);

  // adaptive test state
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [current, setCurrent] = useState<PlacementQ | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const usedIds = useRef<Set<string>>(new Set());
  const difficulty = useRef(1);
  const rotation = useRef(0);
  const [result, setResult] = useState<PlacementResult | null>(null);
  const [startLower, setStartLower] = useState(false);

  if (!ready || !settled || settings.onboarding || !player) return null;
  // Only brand-new learners are placed; anyone with existing progress skips
  // straight to their app (they can retake placement from /profile).
  if (player.xp > 0 || player.totalAttempts > 0) return null;

  const stepIndex = (["name", "place", "path", "goal", "minutes", "self", "test"] as Step[]).indexOf(step) + 1;

  const go = (s: Step) => {
    sfx.tap();
    setStep(s);
  };

  // ── adaptive test ──
  const nextQuestion = (fromAnswers: AnswerRecord[]) => {
    if (!shouldContinue(fromAnswers, { min: 8, max: 12 })) {
      finishTest(fromAnswers);
      return;
    }
    // rotate skills; find the next skill that still has an unused question
    for (let tries = 0; tries < SKILL_ROTATION.length; tries++) {
      const skill = SKILL_ROTATION[rotation.current % SKILL_ROTATION.length];
      rotation.current += 1;
      const q = pickQuestion(skill, difficulty.current, usedIds.current);
      if (q) {
        usedIds.current.add(q.id);
        // Shuffle so the correct choice isn't always the first option.
        setCurrent({ ...q, options: shuffle(q.options) });
        setPicked(null);
        return;
      }
    }
    finishTest(fromAnswers); // bank exhausted
  };

  const beginTest = () => {
    difficulty.current = startDifficulty(self ?? undefined);
    rotation.current = 0;
    usedIds.current = new Set();
    setAnswers([]);
    setStep("test");
    nextQuestion([]);
  };

  const answer = (idx: number) => {
    if (!current || picked !== null) return;
    setPicked(idx);
    const correct = Boolean(current.options[idx]?.correct);
    if (correct) juice.centerBurst();
    sfx.tap();
    const rec: AnswerRecord = { skill: current.skill, difficulty: current.difficulty, correct };
    const next = [...answers, rec];
    setAnswers(next);
    difficulty.current = nextDifficulty(difficulty.current, rec);
    // brief pause so she sees the right answer, then advance
    window.setTimeout(() => nextQuestion(next), 650);
  };

  const finishTest = (finalAnswers: AnswerRecord[]) => {
    const r = scorePlacement(finalAnswers);
    setResult(r);
    setStep("result");
    juice.centerBurst();
    sfx.goal?.();
  };

  const finish = async () => {
    if (!result || !goal) return;
    const level: Level = startLower ? levelDown(result.level) : result.level;
    const profile: OnboardingProfile = {
      name: name.trim() || settings.studentName || "Clara",
      country: country.trim() || "Colombia",
      city: city.trim() || "Medellín",
      goal,
      dailyMinutes: minutes,
      selfLevel: self ?? "basics",
      level,
      subscores: result.subscores,
      path: path ?? "general",
      completedAt: Date.now(),
    };
    sfx.finish?.();
    await update({ studentName: profile.name, onboarding: profile, dailyGoal: minutes === 10 ? 20 : minutes === 20 ? 40 : 60 });
    window.location.href = "/today";
  };

  // Skip the adaptive test: complete onboarding using the self-assessed level so
  // it PERSISTS and never nags again — she can retake real placement any time
  // from /profile. Without this, onboarding only saved at the end of the full
  // quiz, so an unfinished quiz meant being re-onboarded on every login.
  const skipTest = async () => {
    if (!goal || !self) return;
    const level: Level = difficultyToLevel(startDifficulty(self));
    const profile: OnboardingProfile = {
      name: name.trim() || settings.studentName || "Clara",
      country: country.trim() || "Colombia",
      city: city.trim() || "Medellín",
      goal,
      dailyMinutes: minutes,
      selfLevel: self,
      level,
      path: path ?? "general",
      completedAt: Date.now(),
    };
    sfx.finish?.();
    await update({ studentName: profile.name, onboarding: profile, dailyGoal: minutes === 10 ? 20 : minutes === 20 ? 40 : 60 });
    window.location.href = "/today";
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="hero-calm pointer-events-none absolute inset-0" aria-hidden />
      <div className="flag-bar absolute inset-x-0 top-0 h-[3px]" aria-hidden />

      <div className="relative mx-auto flex min-h-full max-w-md flex-col px-6 pb-10 pt-8">
        {/* progress bar */}
        {step !== "result" && (
          <div className="mb-8 flex items-center gap-2">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <span
                key={i}
                className={cn("h-1.5 flex-1 rounded-full transition-colors", i < stepIndex ? "bg-primary" : "bg-muted-foreground/20")}
              />
            ))}
          </div>
        )}

        {step === "name" && (
          <Card>
            <Eyebrow>Bienvenida · Welcome</Eyebrow>
            <H>¿Cómo te llamas?</H>
            <input
              value={name}
              onChange={(e) => setNameOverride(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && name.trim() && go("place")}
              placeholder="Tu nombre"
              autoFocus
              className="mt-6 w-full border-b border-border bg-transparent pb-2 font-display text-3xl font-medium outline-none placeholder:text-muted-foreground/30 focus:border-primary"
            />
            <Primary disabled={!name.trim()} onClick={() => go("place")}>Seguir</Primary>
          </Card>
        )}

        {step === "place" && (
          <Card>
            <Eyebrow>Un poquito de ti</Eyebrow>
            <H>¿De dónde eres?</H>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Field label="País" value={country} onChange={setCountry} />
              <Field label="Ciudad" value={city} onChange={setCity} />
            </div>
            <Primary onClick={() => go("path")}>Seguir</Primary>
          </Card>
        )}

        {step === "path" && (
          <Card>
            <Eyebrow>Tu camino</Eyebrow>
            <H>¿Para qué quieres tu inglés?</H>
            <div className="mt-6 grid gap-3">
              {PATH_OPTIONS.map((p) => (
                <Choice
                  key={p.id}
                  active={path === p.id}
                  title={p.es}
                  blurb={p.blurb}
                  onClick={() => {
                    setPath(p.id);
                    sfx.tap();
                  }}
                />
              ))}
            </div>
            <Primary disabled={!path} onClick={() => go("goal")}>
              Seguir
            </Primary>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Puedes cambiarlo después. Tu progreso no se pierde.
            </p>
          </Card>
        )}

        {step === "goal" && (
          <Card>
            <Eyebrow>Tu meta</Eyebrow>
            <H>¿De qué quieres hablar?</H>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {GOALS.map((g) => (
                <Choice key={g.id} active={goal === g.id} title={g.es} onClick={() => { setGoal(g.id); sfx.tap(); }} />
              ))}
            </div>
            <Primary disabled={!goal} onClick={() => go("minutes")}>Seguir</Primary>
          </Card>
        )}

        {step === "minutes" && (
          <Card>
            <Eyebrow>Tu ritmo</Eyebrow>
            <H>¿Cuánto quieres practicar al día?</H>
            <div className="mt-6 grid grid-cols-3 gap-3">
              {([10, 20, 30] as DailyMinutes[]).map((m) => (
                <Choice key={m} active={minutes === m} title={`${m} min`} onClick={() => { setMinutes(m); sfx.tap(); }} />
              ))}
            </div>
            <Primary onClick={() => go("self")}>Seguir</Primary>
          </Card>
        )}

        {step === "self" && (
          <Card>
            <Eyebrow>Tu nivel</Eyebrow>
            <H>¿Cómo te sientes con el inglés hoy?</H>
            <div className="mt-6 grid gap-3">
              {SELF_OPTIONS.map((o) => (
                <Choice key={o.id} active={self === o.id} title={o.es} wide onClick={() => { setSelf(o.id); sfx.tap(); }} />
              ))}
            </div>
            <Primary disabled={!self} onClick={beginTest}>Hacer la prueba rápida</Primary>
            <p className="mt-3 text-center text-xs text-muted-foreground">Toma 2–3 min y se ajusta a ti.</p>
            <button
              type="button"
              disabled={!self}
              onClick={skipTest}
              className="mt-4 block w-full text-center text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground disabled:opacity-40"
            >
              Saltar la prueba y empezar
            </button>
          </Card>
        )}

        {step === "test" && current && (
          <TestCard q={current} picked={picked} onAnswer={answer} index={answers.length} />
        )}

        {step === "result" && result && (
          <ResultCard
            result={result}
            goal={goal!}
            startLower={startLower}
            onToggleLower={() => { setStartLower((v) => !v); sfx.tap(); }}
            onFinish={finish}
          />
        )}
      </div>
    </div>
  );
}

// ── the adaptive question card ──
function TestCard({ q, picked, onAnswer, index }: { q: PlacementQ; picked: number | null; onAnswer: (i: number) => void; index: number }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speak = () => {
    if (!q.speak) return;
    void playJoelVoice(q.speak, audioRef);
  };
  // auto-play listening items in Joel's voice when they appear
  useEffect(() => { if (q.kind === "listen") speak(); // eslint-disable-next-line
  }, [q.id]);

  return (
    <div className="animate-fade-up">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Pregunta {index + 1}</p>
      <p className="mt-2 text-sm text-muted-foreground">{q.promptEs}</p>

      {q.kind === "listen" ? (
        <button
          type="button"
          onClick={speak}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-hairline bg-card py-6 font-display text-lg text-primary transition-colors hover:border-primary/40"
        >
          <Volume2 className="size-5" /> Escuchar otra vez
        </button>
      ) : (
        <p className="mt-4 rounded-2xl border border-hairline bg-card px-5 py-6 text-center font-display text-2xl">{q.stem}</p>
      )}

      <div className="mt-5 grid gap-3">
        {q.options.map((o, i) => {
          const isPicked = picked === i;
          const reveal = picked !== null;
          const good = reveal && o.correct;
          const bad = reveal && isPicked && !o.correct;
          return (
            <button
              key={i}
              type="button"
              disabled={reveal}
              onClick={() => onAnswer(i)}
              className={cn(
                "flex items-center justify-between rounded-2xl border px-5 py-4 text-left text-base transition-all active:scale-[0.99]",
                good && "border-success bg-success/10",
                bad && "border-destructive bg-destructive/10",
                !reveal && "border-hairline bg-card hover:border-primary/40",
                reveal && !good && !bad && "border-hairline bg-card opacity-60",
              )}
            >
              {o.text}
              {good && <Check className="size-5 text-success" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── result screen ──
function ResultCard({ result, goal, startLower, onToggleLower, onFinish }: {
  result: PlacementResult; goal: Goal; startLower: boolean; onToggleLower: () => void; onFinish: () => void;
}) {
  const shown = startLower ? levelDown(result.level) : result.level;
  const blurb = levelBlurbEs(shown);
  const plan = firstWeekPlan(shown, goal);
  const skillEs: Record<Skill, string> = {
    listening: "Escucha", vocabulary: "Vocabulario", grammar: "Gramática", reading: "Lectura", speaking: "Habla",
  };
  return (
    <div className="animate-scale-in text-center">
      {/* Onboarding is an approved `welcome` screen: this is the moment she is
          placed and let in, so Clara greets rather than applauds. */}
      <div className="mx-auto h-28 w-24"><CharacterIllustration state="welcome" preload /></div>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Tu nivel</p>
      <h2 className="mt-1 font-display text-5xl font-semibold tracking-[-0.02em]">{shown}</h2>
      <p className="mt-2 font-display text-xl">{blurb.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{blurb.sub}</p>

      {/* subscores */}
      <div className="mx-auto mt-6 grid max-w-sm gap-2.5 text-left">
        {SKILLS.filter((s) => (result.subscores[s] ?? 0) > 0 || result.strengths.includes(s) || result.improve.includes(s)).map((s) => (
          <div key={s} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs font-medium text-muted-foreground">{skillEs[s]}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.round(((result.subscores[s] ?? 0) / 5) * 100)}%` }} />
            </span>
          </div>
        ))}
      </div>

      {result.improve.length > 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          A pulir: <span className="text-foreground">{result.improve.map((s) => skillEs[s]).join(", ")}</span>
        </p>
      )}

      {/* first-week plan */}
      <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-hairline bg-card p-4 text-left">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Tu primera semana</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {plan.map((d) => (
            <span key={d.day} className="rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">Día {d.day}</span>
          ))}
        </div>
      </div>

      {levelIndex(result.level) > 0 && (
        <button type="button" onClick={onToggleLower} className="mt-5 text-sm text-muted-foreground underline-offset-4 hover:underline">
          {startLower ? "Usar mi nivel completo" : "Prefiero empezar un nivel más abajo, con confianza"}
        </button>
      )}

      <button
        type="button"
        onClick={onFinish}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 font-display text-lg font-semibold text-primary-foreground transition-transform active:scale-[0.99]"
      >
        Empezar mi primer día <ArrowRight className="size-5" />
      </button>
    </div>
  );
}

// ── small building blocks ──
function Card({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-up flex flex-1 flex-col justify-center">{children}</div>;
}
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
      <span className="flag-dots" aria-hidden><i /><i /><i /></span>
      {children}
    </p>
  );
}
function H({ children }: { children: React.ReactNode }) {
  return <h1 className="mt-4 font-display text-3xl font-medium leading-tight tracking-[-0.02em]">{children}</h1>;
}
function Primary({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 font-display text-lg font-semibold text-primary-foreground transition-transform active:scale-[0.99] disabled:opacity-30"
    >
      {children} <ArrowRight className="size-5" />
    </button>
  );
}
function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1.5 w-full rounded-xl border border-hairline bg-card px-3.5 py-2.5 outline-none focus:border-primary" />
    </label>
  );
}
function Choice({
  active,
  title,
  onClick,
  wide,
  blurb,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
  wide?: boolean;
  /** Optional explanation under the title — used by the path choice. */
  blurb?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-2xl border p-4 transition-all active:scale-[0.99]",
        wide || blurb ? "text-left" : "text-center",
        active ? "border-primary bg-primary/[0.06]" : "border-hairline bg-card hover:border-foreground/30",
      )}
    >
      <span className={cn("font-display text-lg", active && "text-primary")}>{title}</span>
      {blurb && <span className="mt-1 block text-sm leading-snug text-muted-foreground">{blurb}</span>}
    </button>
  );
}
