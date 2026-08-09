"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { ALL_ITEMS, LESSON_BY_ID } from "@/lib/content/lessons";
import { levelLessonPool } from "@/lib/onboarding";
import { examEligibility, scoreExam, canAttemptToday, SECTIONS, PASS_SCORE, type SectionKey } from "@/lib/exams";
import { composeExam, type ExamSection } from "@/lib/exam-compose";
import {
  GRADER_RETRIES,
  foldGradePaths,
  interpretCaptureFailure,
  interpretGraderResponse,
  initialStageSpeakingState,
  transitionStageSpeaking,
  type StageSpeakingState,
  type GradePath,
} from "@/lib/exam-grading";
import { RecognitionError, createRequiredAssessmentRecognition } from "@/lib/speech/recognition";
import { audioUrl } from "@/lib/speech/audio-key";
import { hasRecordedVoice } from "@/lib/speech/player";
import { authHeaders } from "@/lib/auth-client";
import { levelUp } from "@/lib/placement";
import type { PracticePersistenceBinding } from "@/lib/db/repository";
import type { RecognitionHandle } from "@/lib/speech/recognition";
import { LATAM_PRONUNCIATION_PRIOR } from "@/lib/speech/latam-prior";
import { pronunciationCue } from "@/lib/i18n";
import { StagePracticeRequired } from "@/components/exam/stage-practice-required";
import type { ExamCheckpoint, ExamCheckpointIdentity } from "@/lib/db/types";
import type { ExamCheckpointCas } from "@/lib/db/types";
import { ExamCheckpointConflictError, sameExamCheckpointIdentity } from "@/lib/exam-checkpoint";
import { OwnedTtsSession } from "@/lib/speech/owned-tts";
import { resolveExamSaveFailure } from "@/lib/exam-save-recovery";

// The stage exam. One sitting per day, no retries, six sections — the only thing
// that moves a student's band.
//
// Deliberately austere compared with the drills: no stars, no combo, no juice
// mid-sitting. It should feel like a test, because its result is the claim the app
// makes about her level. Celebration happens only after a pass.
//
// Nothing here writes SRS progress. If exam answers counted as practice, a sitting
// would raise the very mastery percentage that unlocks the next sitting.

type Phase = "intro" | "running" | "pending-advance" | "grading" | "done" | "voided" | "practice-required" | "conflict" | "save-error" | "account-changed" | "level-changed";

const SECTION_COPY: Record<SectionKey, { title: string; how: string }> = {
  readAloud: { title: "Lee en voz alta", how: "Lee la frase con tu mejor pronunciación." },
  repeat: { title: "Escucha y repite", how: "Escucha a Joel y repite exactamente lo que dijo." },
  build: { title: "Arma la frase", how: "Toca las palabras en el orden correcto." },
  shortAnswer: { title: "¿Qué escuchaste?", how: "Escucha y elige el significado." },
  retell: { title: "Cuéntalo con tus palabras", how: "Escucha la historia y cuéntala como puedas." },
  openResponse: { title: "Habla libremente", how: "Responde la pregunta hablando unos segundos." },
};

export default function ExamPage() {
  const { settings, ready } = useSettings();
  const progress = useAllProgress();
  const settingsLevel = settings.onboarding?.level ?? "A1";
  // Once a sitting starts (or is discovered on reload), its source band is
  // immutable. A later settings refresh may change the dashboard, never the
  // paper, score identity, or level written by this sitting.
  const [sittingSourceLevel, setSittingSourceLevel] = useState<typeof settingsLevel | null>(null);
  const level = sittingSourceLevel ?? settingsLevel;
  const candidateLevel = levelUp(level);

  const [phase, setPhase] = useState<Phase>("intro");
  const [sectionIdx, setSectionIdx] = useState(0);
  const [itemIdx, setItemIdx] = useState(0);
  const [listening, setListening] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [result, setResult] = useState<ReturnType<typeof scoreExam> | null>(null);
  const [attemptedToday, setAttemptedToday] = useState<boolean | null>(null);
  const [checkpointReady, setCheckpointReady] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [pendingAdvance, setPendingAdvance] = useState<ExamCheckpoint["pendingAdvance"]>();
  const [saveRetryCount, setSaveRetryCount] = useState(0);
  const [placed, setPlaced] = useState<string[]>([]);
  const [speakingState, setSpeakingState] = useState<StageSpeakingState>(() => initialStageSpeakingState());
  const [practiceFocus, setPracticeFocus] = useState<ExamCheckpoint["focus"]>();
  const [practiceAttempts, setPracticeAttempts] = useState(0);
  // Stamped when she taps Start — an event, so the clock is read outside any
  // memoised body. It also means a sitting that crosses midnight is filed under
  // the day it began rather than the day it happened to finish.
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<RecognitionHandle | null>(null);
  const preflightAbortRef = useRef<AbortController | null>(null);
  const timersRef = useRef<Set<number>>(new Set());
  const bindingRef = useRef<PracticePersistenceBinding | null>(null);
  const startedProfileRef = useRef<string | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const activeRef = useRef(true);
  const captureEpochRef = useRef(0);
  const speakingBusyRef = useRef(false);
  const checkpointSequenceRef = useRef(0);
  const checkpointCasRef = useRef<ExamCheckpointCas | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const pendingAdvanceRef = useRef<ExamCheckpoint["pendingAdvance"]>(undefined);
  const advancingCommitRef = useRef(false);
  const finalSaveBusyRef = useRef(false);
  const discoveredCheckpointRef = useRef<ExamCheckpoint | null>(null);
  const ttsOwnerRef = useRef<OwnedTtsSession | null>(null);
  const disposeTts = () => {
    ttsOwnerRef.current?.dispose();
    window.speechSynthesis?.cancel();
  };
  const clearEphemeral = () => {
    captureEpochRef.current += 1;
    speakingBusyRef.current = false;
    recognitionRef.current?.cancel();
    recognitionRef.current = null;
    preflightAbortRef.current?.abort();
    preflightAbortRef.current = null;
    for (const timer of timersRef.current) window.clearTimeout(timer);
    timersRef.current.clear();
    disposeTts();
  };
  const schedule = (callback: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      timersRef.current.delete(timer);
      if (activeRef.current) callback();
    }, delay);
    timersRef.current.add(timer);
  };
  useEffect(() => {
    activeRef.current = true;
    audioRef.current = new Audio();
    ttsOwnerRef.current = new OwnedTtsSession(audioRef.current);
    return () => {
      activeRef.current = false;
      clearEphemeral();
      ttsOwnerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if ((phase === "running" || phase === "pending-advance" || phase === "grading") && startedProfileRef.current !== (settings.profileId ?? null)) {
      clearEphemeral();
      setPhase("voided");
    }
  }, [phase, settings.profileId]);

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
    const levelItems = levelLessonPool(level).flatMap((id) => LESSON_BY_ID.get(id)?.items ?? []);
    const authoredSoundItems = ALL_ITEMS.filter((candidate) => candidate.categoryId !== "conversation");
    const pool = [...new Map([...levelItems, ...authoredSoundItems].map((candidate) => [candidate.id, candidate])).values()];
    return composeExam(candidateLevel, pool, `${dayKey(new Date())}:${candidateLevel}`);
  }, [candidateLevel, level]);

  const examIdentity = useMemo<ExamCheckpointIdentity | null>(() => exam.status === "ready" ? {
    day: dayKey(new Date()),
    sourceLevel: level,
    candidateLevel,
    seed: `${dayKey(new Date())}:${candidateLevel}`,
    contentVersion: exam.contentVersion,
    contentHash: exam.contentHash,
  } : null, [candidateLevel, exam, level]);

  const section: ExamSection | undefined = exam.sections[sectionIdx];
  const item = section?.items[itemIdx];

  // Scores are mirrored into a ref because grading is kicked off from inside a
  // setTimeout: a closure created this render would otherwise read a stale copy
  // and grade the sitting on incomplete data.
  const scoresRef = useRef<Record<string, number[]>>({});
  // Which grading machinery produced each score — stored with the sitting so a
  // disputed band is auditable (audit P1).
  const pathsRef = useRef<Record<string, GradePath[]>>({});
  const applyCheckpoint = useCallback((checkpoint: ExamCheckpoint) => {
    checkpointSequenceRef.current = checkpoint.sequence;
    checkpointCasRef.current = { sessionId: checkpoint.sessionId, sequence: checkpoint.sequence };
    sessionIdRef.current = checkpoint.sessionId;
    startedProfileRef.current = checkpoint.profileId;
    scoresRef.current = checkpoint.scores;
    pathsRef.current = checkpoint.gradePaths as Record<string, GradePath[]>;
    setStartedAt(checkpoint.startedAt);
    startedAtRef.current = checkpoint.startedAt;
    setSectionIdx(checkpoint.sectionIdx);
    setItemIdx(checkpoint.itemIdx);
    setSpeakingState(checkpoint.speaking);
    setPracticeFocus(checkpoint.focus);
    setPracticeAttempts(checkpoint.speaking.validAcousticAttempts);
    setPendingAdvance(checkpoint.pendingAdvance);
    pendingAdvanceRef.current = checkpoint.pendingAdvance;
    setAdvancing(checkpoint.status === "pending-advance");
    setNote(checkpoint.pendingAdvance?.feedback ?? null);
    setPhase(checkpoint.status);
  }, []);
  // Discover the owner-bound sitting without deleting mismatches. Its source
  // level is frozen before composition so a cloud settings refresh cannot
  // silently relabel an A1 paper as B2.
  useEffect(() => {
    if (!ready || !settings.profileId) return;
    const binding = repo.capturePracticeBinding();
    if (!binding) {
      queueMicrotask(() => setCheckpointReady(true));
      return;
    }
    bindingRef.current = binding;
    let cancelled = false;
    void repo.peekExamCheckpointForPracticeBinding(binding).then((checkpoint) => {
      if (cancelled) return;
      if (checkpoint?.day === dayKey(new Date())) {
        discoveredCheckpointRef.current = checkpoint;
        setSittingSourceLevel(checkpoint.sourceLevel as typeof settingsLevel);
      } else {
        setCheckpointReady(true);
      }
    }).catch(() => {}).finally(() => {
      if (!cancelled && !discoveredCheckpointRef.current) setCheckpointReady(true);
    });
    return () => { cancelled = true; };
  }, [ready, settings.profileId]);

  useEffect(() => {
    const checkpoint = discoveredCheckpointRef.current;
    if (!checkpoint || !examIdentity || checkpointReady) return;
    if (sameExamCheckpointIdentity(checkpoint, examIdentity)) applyCheckpoint(checkpoint);
    else {
      setNote("El contenido de este examen cambió. Conservamos la sesión sin sobrescribirla. · This exam content changed. We preserved the sitting without overwriting it.");
      setPhase("conflict");
    }
    setCheckpointReady(true);
  }, [applyCheckpoint, checkpointReady, examIdentity]);

  const persistCheckpoint = async (input: {
    sectionIdx: number;
    itemIdx: number;
    status?: ExamCheckpoint["status"];
    speaking?: StageSpeakingState;
    focus?: ExamCheckpoint["focus"];
    pendingAdvance?: ExamCheckpoint["pendingAdvance"];
    scores?: Record<string, number[]>;
    gradePaths?: Record<string, GradePath[]>;
  }) => {
    const binding = bindingRef.current;
    const profileId = startedProfileRef.current;
    const began = startedAtRef.current;
    const expected = checkpointCasRef.current;
    const sessionId = sessionIdRef.current;
    if (!binding || !profileId || !examIdentity || !began || !sessionId) throw new Error("Stage exam identity unavailable");
    const speaking = input.speaking ?? initialStageSpeakingState();
    const checkpoint: ExamCheckpoint = {
      id: "active",
      version: 1,
      sequence: expected ? expected.sequence + 1 : 0,
      sessionId,
      profileId,
      ...examIdentity,
      startedAt: began,
      status: input.status ?? "running",
      sectionIdx: input.sectionIdx,
      itemIdx: input.itemIdx,
      scores: input.scores ?? scoresRef.current,
      gradePaths: input.gradePaths ?? pathsRef.current,
      speaking: {
        status: speaking.status === "voided" ? "ready" : speaking.status,
        learnerMisses: speaking.learnerMisses,
        validAcousticAttempts: speaking.validAcousticAttempts,
      },
      ...(input.focus ? { focus: input.focus } : {}),
      ...(input.pendingAdvance ? { pendingAdvance: input.pendingAdvance } : {}),
    };
    await repo.saveExamCheckpointForPracticeBinding(binding, checkpoint, expected);
    checkpointSequenceRef.current = checkpoint.sequence;
    checkpointCasRef.current = { sessionId, sequence: checkpoint.sequence };
  };

  const acceptScore = async (key: string, score: number, path: GradePath, feedback: string | null, delayMs: number, speaking?: StageSpeakingState) => {
    setAdvancing(true);
    const nextScores = { ...scoresRef.current, [key]: [...(scoresRef.current[key] ?? []), score] };
    const nextPaths = { ...pathsRef.current, [key]: [...(pathsRef.current[key] ?? []), path] };
    const total = sectionTotal(exam.sections[sectionIdx]);
    const next = itemIdx + 1 < total
      ? { sectionIdx, itemIdx: itemIdx + 1 }
      : sectionIdx + 1 < exam.sections.length
        ? { sectionIdx: sectionIdx + 1, itemIdx: 0 }
        : null;
    const pending: NonNullable<ExamCheckpoint["pendingAdvance"]> = {
      completedSectionIdx: sectionIdx,
      completedItemIdx: itemIdx,
      nextSectionIdx: next?.sectionIdx ?? null,
      nextItemIdx: next?.itemIdx ?? null,
      feedback,
      delayMs,
    };
    await persistCheckpoint({ sectionIdx, itemIdx, status: "pending-advance", speaking, pendingAdvance: pending, scores: nextScores, gradePaths: nextPaths });
    scoresRef.current = nextScores;
    pathsRef.current = nextPaths;
    if (speaking) setSpeakingState(speaking);
    pendingAdvanceRef.current = pending;
    setPendingAdvance(pending);
    setPhase("pending-advance");
    setNote(feedback);
    setListening(false);
    setAdvancing(true);
    schedule(() => void advance(pending), delayMs);
  };

  const voidSitting = async (message?: string) => {
    const binding = bindingRef.current;
    clearEphemeral();
    const expected = checkpointCasRef.current;
    if (binding && expected) {
      try {
        await repo.clearExamCheckpointForPracticeBinding(binding, expected);
        checkpointCasRef.current = null;
      } catch (error) {
        if (error instanceof ExamCheckpointConflictError) {
          setPhase("conflict");
          setNote("Hay una versión más nueva de este examen. Recárgala para continuar. · A newer session is ready; reload to resume it.");
          return;
        }
      }
    }
    setPhase("voided");
    if (message) setNote(message);
    setListening(false);
  };

  /**
   * Ask the CEFR-aware grader, retrying once. Returns null when the grader is
   * genuinely unavailable — the caller VOIDS the sitting instead of recording
   * a zero or falling back to a gameable heuristic (audit P1: provider
   * failure must never silently change what a passing grade means).
   */
  const gradeOpen = async (kind: "retell" | "openResponse", prompt: string, transcript: string) => {
    for (let attempt = 0; attempt <= GRADER_RETRIES; attempt++) {
      try {
        const res = await fetch("/api/grade", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await authHeaders()) },
          body: JSON.stringify({ kind, prompt, transcript, level: candidateLevel }),
        });
        const body = await res.json().catch(() => null);
        const grade = interpretGraderResponse(res.status, body);
        if (grade.kind === "scored") return grade;
      } catch {
        /* network — retry, then void */
      }
    }
    return null;
  };

  /** Grade, persist, and promote only on a pass. Driven by the event path, not an
   *  effect, so the sitting is graded exactly once. */
  // Plain functions, not useCallback: they only ever run from an event handler, so
  // memoising them buys nothing and would put the clock reads below inside a
  // memoised body (which react-hooks/purity rightly rejects).
  const finishExam = async () => {
    if (finalSaveBusyRef.current) return;
    finalSaveBusyRef.current = true;
    try {
    const binding = bindingRef.current;
    if (!binding) {
      clearEphemeral();
      setNote("La cuenta cambió antes de guardar. No escribimos este resultado en otra cuenta. · The account changed before save; this result was not written to another learner.");
      setPhase("account-changed");
      return;
    }
    setPhase("grading");
    const results = SECTIONS.map((s) => {
      const got = scoresRef.current[s.key] ?? [];
      const mean = got.length ? Math.round(got.reduce((a, b) => a + b, 0) / got.length) : 0;
      return { key: s.key, score: mean };
    });
    const outcome = scoreExam(results, level);
    const began = startedAtRef.current ?? startedAt ?? 0;
    if (outcome.passed && (!settings.onboarding || settings.onboarding.level !== level)) {
      clearEphemeral();
      setNote("Tu nivel cambió antes de guardar. Conservamos el examen y no bajamos tu nivel. · Your level changed before save. We preserved the exam and did not downgrade you.");
      setPhase("level-changed");
      return;
    }
    try {
      const promotedOnboarding = outcome.passed && settings.onboarding
        ? { ...settings.onboarding, level: levelUp(level) }
        : undefined;
      await repo.saveExamAttemptForPracticeBinding(binding, {
        day: dayKey(new Date(began)),
        at: began,
        level,
        score: outcome.score,
        passed: outcome.passed,
        sections: Object.fromEntries(outcome.sections.map((s) => [s.key, s.score])),
        weakest: outcome.weakest,
        gradePaths: foldGradePaths(pathsRef.current),
      }, promotedOnboarding, examIdentity ?? undefined, checkpointCasRef.current ?? undefined);
      if (promotedOnboarding) {
        sfx.finish?.();
        cinematic.play({ title: `¡${levelUp(level)}!`, subtitle: "Subiste de nivel", stars: 0 });
      }
    } catch (error) {
      clearEphemeral();
      if (!examIdentity) {
        setNote("No pudimos verificar este examen. Vuelve al inicio de forma segura. · We couldn't verify this exam. Return home safely.");
        setPhase("conflict");
        return;
      }
      const recovery = await resolveExamSaveFailure({
        error, repo, binding, identity: examIdentity, sessionId: sessionIdRef.current ?? "", retryCount: saveRetryCount,
      });
      if (recovery.kind === "resume") {
        applyCheckpoint(recovery.checkpoint);
      } else if (recovery.kind === "restart") {
        checkpointCasRef.current = null;
        sessionIdRef.current = null;
        discoveredCheckpointRef.current = null;
        setSittingSourceLevel(null);
        scoresRef.current = {};
        pathsRef.current = {};
        setSectionIdx(0);
        setItemIdx(0);
        setNote(null);
        setSaveRetryCount(0);
        setPhase("intro");
      } else if (recovery.kind === "account-changed") {
        setNote("La cuenta cambió antes de guardar. No escribimos este resultado en otra cuenta. · The account changed before save; this result was not written to another learner.");
        setPhase("account-changed");
      } else if (recovery.kind === "level-changed") {
        setNote("Tu nivel cambió antes de guardar. Conservamos el examen y no bajamos tu nivel. · Your level changed before save. We preserved the exam and did not downgrade you.");
        setPhase("level-changed");
      } else if (recovery.kind === "conflict") {
        setNote("Hay una versión más nueva o ya usada de este examen. Recarga para continuar de forma segura. · A newer or completed sitting exists; reload to continue safely.");
        setPhase("conflict");
      } else {
        setSaveRetryCount(recovery.retryCount);
        setNote(recovery.canRetry
          ? "No pudimos guardar tu resultado. El examen sigue guardado; puedes reintentar. · We couldn't save your result. The exam is preserved; you can retry."
          : "No pudimos guardar después de varios intentos. El examen sigue guardado; vuelve más tarde. · Save still failed after several tries. Your exam remains preserved; return later.");
        setPhase("save-error");
      }
      return;
    }
    setSaveRetryCount(0);
    setResult(outcome);
    setPhase("done");
    } finally {
      finalSaveBusyRef.current = false;
    }
  };

  /** Items in a section: spoken-target sections count items; prompt sections
   *  count their prompts (openResponse carries two questions joined by " | "). */
  const sectionTotal = (s: ExamSection): number =>
    s.items.length || (s.prompt ? s.prompt.split(" | ").length : 1);

  const advance = async (accepted = pendingAdvanceRef.current) => {
    if (!accepted || advancingCommitRef.current) return;
    advancingCommitRef.current = true;
    try {
      if (accepted.nextSectionIdx !== null && accepted.nextItemIdx !== null) {
        await persistCheckpoint({ sectionIdx: accepted.nextSectionIdx, itemIdx: accepted.nextItemIdx });
        clearEphemeral();
        setNote(null);
        setPlaced([]);
        setSpeakingState(initialStageSpeakingState());
        pendingAdvanceRef.current = undefined;
        setPendingAdvance(undefined);
        setAdvancing(false);
        setPhase("running");
        setSectionIdx(accepted.nextSectionIdx);
        setItemIdx(accepted.nextItemIdx);
        return;
      }
      await finishExam();
      clearEphemeral();
    } catch {
      await voidSitting();
    } finally {
      advancingCommitRef.current = false;
    }
  };

  const play = async (url: string) => {
    disposeTts();
    const el = audioRef.current;
    if (!el) return;
    el.src = url;
    await el.play().catch(() => {});
  };

  const speak = async (text: string) => {
    const owner = ttsOwnerRef.current;
    if (!owner) return;
    const outcome = await owner.speak(async (signal) => {
      const headers = await authHeaders();
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ text }),
        signal,
      });
      if (!res.ok) throw new Error("tts");
      return res.blob();
    });
    if (outcome === "failed" && activeRef.current && window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      u.rate = 0.95;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }
  };

  /** Spoken sections: strict acoustic stage gates for authored targets. */
  const speakAndScore = async () => {
    if (!section || listening || speakingBusyRef.current) return;
    speakingBusyRef.current = true;
    disposeTts();
    const captureEpoch = captureEpochRef.current;
    setListening(true);
    setNote(null);
    const target = item?.text;
    try {
      const preflight = new AbortController();
      preflightAbortRef.current = preflight;
      const rec = await createRequiredAssessmentRecognition(target && item
        ? { target, assessmentKind: item.kind, signal: preflight.signal }
        : { assessmentKind: "free", signal: preflight.signal });
      if (preflightAbortRef.current === preflight) preflightAbortRef.current = null;
      if (!activeRef.current || captureEpoch !== captureEpochRef.current) {
        rec.cancel();
        return;
      }
      recognitionRef.current = rec;
      const res = await rec.result;
      if (!activeRef.current || captureEpoch !== captureEpochRef.current) return;
      recognitionRef.current = null;
      let score = 0;
      if (section.key === "retell" || section.key === "openResponse") {
        // Unscripted speech is graded by the CEFR-aware model or not at all —
        // the old keyword-bag retell scored word salad at 100 (audit P1). For
        // openResponse, grade the one question she actually saw.
        const prompt =
          section.key === "retell"
            ? (section.prompt ?? "")
            : ((section.prompt ?? "").split(" | ")[itemIdx] ?? section.prompt ?? "");
        const graded = await gradeOpen(section.key, prompt, res.transcript);
        if (!activeRef.current || captureEpoch !== captureEpochRef.current) return;
        if (!graded) {
          await voidSitting("El servicio de pronunciación no respondió. Este examen no contará.");
          return;
        }
        await acceptScore(section.key, graded.score, "llm", graded.fix, graded.fix ? 1800 : 500);
        return;
      } else if (target) {
        const transition = res.assessment
          ? transitionStageSpeaking(speakingState, { type: "acoustic", cefr: candidateLevel, evidence: res.assessment })
          : transitionStageSpeaking(speakingState, { type: "technical", code: "incomplete" });
        setListening(false);
        if (!transition.accepted) {
          speakingBusyRef.current = false;
          return;
        }
        if (transition.disposition === "void") {
          await voidSitting("La evidencia acústica llegó incompleta. Este examen no contará.");
          return;
        }
        if (transition.disposition === "practice-required") {
          if (!item?.targetFeature || !item.lessonId) {
            await voidSitting("No pudimos abrir una práctica segura para este objetivo.");
            return;
          }
          const focus = { itemId: item.itemId, itemText: item.text, feature: item.targetFeature, lessonId: item.lessonId, mouthHint: item.mouthHint };
          setAdvancing(true);
          await persistCheckpoint({ sectionIdx, itemIdx, status: "practice-required", speaking: transition.state, focus });
          clearEphemeral();
          setSpeakingState(transition.state);
          setPracticeFocus(focus);
          setPracticeAttempts(transition.state.validAcousticAttempts);
          setPhase("practice-required");
          return;
        }
        if (transition.disposition === "retry") {
          setAdvancing(true);
          await persistCheckpoint({ sectionIdx, itemIdx, speaking: transition.state });
          setSpeakingState(transition.state);
          speakingBusyRef.current = false;
          setAdvancing(false);
          const reason = transition.state.lastVerdict?.reasons[0];
          setNote(reason?.includes("target-phoneme")
            ? "Casi. Haz el sonido objetivo más claro y termina toda la palabra. · Make the target sound clearer and finish the whole word."
            : "Casi. Baja la velocidad y di cada sonido completo. · Slow down and finish every sound.");
          return;
        }
        score = transition.score ?? 0;
        await acceptScore(section.key, score, "azure", null, 650, transition.state);
        return;
      }
      await acceptScore(section.key, score, "mechanical", null, 500);
    } catch (e) {
      if (!activeRef.current || captureEpoch !== captureEpochRef.current) return;
      recognitionRef.current = null;
      if (e instanceof ExamCheckpointConflictError) {
        await voidSitting();
        return;
      }
      const failure = interpretCaptureFailure(e instanceof RecognitionError ? e.code : undefined);
      // Declining/cancelling capture is not a scoring event. Stay on the item.
      if (failure.kind === "retry") {
        setNote("Para el examen necesitas aceptar el aviso de voz. Toca el micrófono otra vez.");
        setListening(false);
        speakingBusyRef.current = false;
        return;
      }
      if (failure.kind === "void") {
        await voidSitting("El servicio de pronunciación no respondió. Este examen no contará.");
        return;
      }
      const transition = transitionStageSpeaking(speakingState, { type: "no-speech" });
      setListening(false);
      if (!transition.accepted) {
        speakingBusyRef.current = false;
        return;
      }
      if (transition.disposition === "practice-required") {
        if (!item?.targetFeature || !item.lessonId) {
          await voidSitting("No pudimos abrir una práctica segura para este objetivo.");
          return;
        }
        const focus = { itemId: item.itemId, itemText: item.text, feature: item.targetFeature, lessonId: item.lessonId, mouthHint: item.mouthHint };
        setAdvancing(true);
        await persistCheckpoint({ sectionIdx, itemIdx, status: "practice-required", speaking: transition.state, focus });
        clearEphemeral();
        setSpeakingState(transition.state);
        setPracticeFocus(focus);
        setPracticeAttempts(transition.state.validAcousticAttempts);
        setPhase("practice-required");
        return;
      }
      setAdvancing(true);
      await persistCheckpoint({ sectionIdx, itemIdx, speaking: transition.state });
      setSpeakingState(transition.state);
      speakingBusyRef.current = false;
      setAdvancing(false);
      setNote("No escuchamos voz. Intenta otra vez; todavía no hay nota. · No speech detected; no score was recorded.");
    }
  };

  /** Word-order section: exact sequence, one shot. */
  const checkBuild = async () => {
    if (!item || speakingBusyRef.current) return;
    speakingBusyRef.current = true;
    const want = item.text.replace(/[.,!?]/g, "").trim().toLowerCase().split(/\s+/);
    const got = placed.map((w) => w.toLowerCase());
    const correct = want.length === got.length && want.every((w, i) => w === got[i]);
    try {
      await acceptScore("build", correct ? 100 : 0, "mechanical", correct ? null : item.text, correct ? 400 : 1600);
    } catch { await voidSitting(); }
  };

  /** Meaning-recognition section. */
  const answerShort = async (chosen: string) => {
    if (!item || speakingBusyRef.current) return;
    speakingBusyRef.current = true;
    const correct = chosen === (item.meaning ?? item.text);
    try {
      await acceptScore("shortAnswer", correct ? 100 : 0, "mechanical", correct ? null : (item.meaning ?? item.text), correct ? 400 : 1400);
    } catch { await voidSitting(); }
  };

  if (!ready || progress === undefined || attemptedToday === null
    || (Boolean(examIdentity && settings.profileId) && !checkpointReady)) return <Splash />;

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
  if (exam.status === "unavailable") {
    return shell(
      <div className={cn(card, "text-center")}>
        <Lumi frame="bust" mood="think" />
        <h1 className="mt-4 font-display text-2xl font-semibold">Examen temporalmente no disponible</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Falta contenido de pronunciación verificado para crear un examen justo. No inventamos preguntas ni calificamos con material incompleto.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Verified pronunciation content is incomplete, so no exam was created.</p>
        <Link href="/today" className="mt-6 block rounded-2xl bg-primary px-5 py-3.5 text-center text-sm font-semibold text-primary-foreground">Practicar hoy</Link>
      </div>,
    );
  }

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
          Seis partes, unos 10 minutos. En pronunciación tendrás hasta tres intentos por objetivo. Necesitas {PASS_SCORE} para pasar.
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
          onClick={() => void (async () => {
            if (speakingBusyRef.current) return;
            sfx.tap();
            clearEphemeral();
            speakingBusyRef.current = true;
            const binding = repo.capturePracticeBinding();
            bindingRef.current = binding;
            startedProfileRef.current = settings.profileId ?? null;
            if (!binding) {
              speakingBusyRef.current = false;
              setPhase("voided");
              return;
            }
            const began = Date.now();
            setSittingSourceLevel(settingsLevel);
            sessionIdRef.current = crypto.randomUUID();
            checkpointCasRef.current = null;
            startedAtRef.current = began;
            setStartedAt(began);
            setSpeakingState(initialStageSpeakingState());
            checkpointSequenceRef.current = 0;
            try {
              await persistCheckpoint({ sectionIdx: 0, itemIdx: 0 });
              speakingBusyRef.current = false;
              setPhase("running");
            } catch (error) {
              if (error instanceof ExamCheckpointConflictError) {
                clearEphemeral();
                setNote("Hay una versión más nueva de este examen. Recárgala para continuar. · A newer session is ready; reload to resume it.");
                setPhase("conflict");
              } else {
                await voidSitting();
              }
            }
          })()}
          className="mt-6 w-full rounded-2xl bg-primary px-5 py-4 text-sm font-semibold text-primary-foreground"
        >
          Empezar el examen
        </button>
      </div>,
    );
  }

  // ── Grading ──────────────────────────────────────────────────────────────
  if (phase === "voided") {
    return shell(
      <div className={cn(card, "text-center")}>
        <Lumi frame="bust" mood="think" />
        <h2 className="mt-4 font-display text-xl font-semibold">No pudimos calificar tu examen</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          El servicio que califica tus respuestas habladas no respondió. Este intento{" "}
          <strong>no cuenta</strong> — no gastaste tu examen de hoy y nada quedó registrado.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          The grading service didn&apos;t respond. This sitting doesn&apos;t count — nothing was
          recorded and you can try again.
        </p>
        <div className="mt-5 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => {
              clearEphemeral();
              scoresRef.current = {};
              pathsRef.current = {};
              bindingRef.current = null;
              startedProfileRef.current = null;
              startedAtRef.current = null;
              setSectionIdx(0);
              setItemIdx(0);
              setNote(null);
              setSpeakingState(initialStageSpeakingState());
              setPhase("intro");
            }}
            className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
          >
            Intentar de nuevo · Try again
          </button>
          <Link href="/" className="text-sm text-muted-foreground underline-offset-2 hover:underline">
            Volver al inicio · Back home
          </Link>
        </div>
      </div>,
    );
  }

  if (phase === "practice-required") {
    return shell(
      <div className={card}><StagePracticeRequired focus={practiceFocus} attempts={practiceAttempts} /></div>,
    );
  }

  if (phase === "conflict") {
    return shell(<div className={cn(card, "text-center")}><Lumi frame="bust" mood="think" /><h2 className="mt-4 font-display text-xl font-semibold">Tu examen cambió en otra pestaña</h2><p className="mt-2 text-sm text-muted-foreground">{note}</p><button type="button" onClick={() => window.location.reload()} className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">Recargar y continuar · Reload and resume</button></div>);
  }

  if (phase === "save-error") {
    return shell(
      <div className={cn(card, "text-center")}>
        <Lumi frame="bust" mood="think" />
        <h2 className="mt-4 font-display text-xl font-semibold">Tu resultado está a salvo</h2>
        <p className="mt-2 text-sm text-muted-foreground">{note}</p>
        {saveRetryCount <= 2 && <button type="button" onClick={() => void finishExam()} className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">Guardar de nuevo · Retry save</button>}
        <Link href="/" className="mt-4 block text-sm text-muted-foreground underline-offset-2 hover:underline">Volver al inicio · Back home</Link>
      </div>,
    );
  }

  if (phase === "account-changed" || phase === "level-changed") {
    return shell(<div className={cn(card, "text-center")}><Lumi frame="bust" mood="think" /><h2 className="mt-4 font-display text-xl font-semibold">{phase === "account-changed" ? "La cuenta cambió" : "Tu nivel cambió"}</h2><p className="mt-2 text-sm text-muted-foreground">{note}</p><Link href="/" className="mt-6 block rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">Volver de forma segura · Back safely</Link></div>);
  }

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
        <Link
          href="/"
          onClick={(event) => {
            event.preventDefault();
            window.location.assign("/");
          }}
          className="mt-6 block rounded-2xl bg-primary px-5 py-3.5 text-center text-sm font-semibold text-primary-foreground"
        >
          Volver al inicio
        </Link>
      </div>,
    );
  }

  // ── Running ──────────────────────────────────────────────────────────────
  if (!section) return <Splash />;
  const copy = SECTION_COPY[section.key];
  const totalItems = sectionTotal(section);
  const openPrompt =
    section.key === "openResponse" ? (section.prompt ?? "").split(" | ")[itemIdx] ?? (section.prompt ?? "") : section.prompt;
  const isScriptedSpeaking = section.key === "readAloud" || section.key === "repeat";
  const cueKey = item?.targetFeature ? LATAM_PRONUNCIATION_PRIOR[item.targetFeature].cueKey : null;
  const captureOrdinal = Math.min(3, speakingState.learnerMisses + 1);

  return shell(
    <div className={card} aria-busy={advancing} data-exam-advancing={advancing ? "true" : "false"}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {copy.title}
        </p>
        <span className="text-xs tabular-nums text-muted-foreground">
          {sectionIdx + 1}/{SECTIONS.length} · {itemIdx + 1}/{totalItems}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{copy.how}</p>

      {isScriptedSpeaking && (
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-secondary/60 px-4 py-3" aria-live="polite">
          <span className="text-xs font-semibold">Intento {captureOrdinal} de 3</span>
          <span className="text-xs text-muted-foreground">Attempt {captureOrdinal} of 3</span>
        </div>
      )}

      {/* readAloud shows the target; repeat hides it until after she speaks. */}
      {section.key === "readAloud" && item && (
        <>
          <p lang="en" className="mt-6 font-display text-3xl leading-snug">{item.text}</p>
          <button
            type="button"
            disabled={advancing}
            onClick={() => void (hasRecordedVoice(item.itemId) ? play(audioUrl(item.itemId)) : speak(item.text))}
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-hairline px-4 py-2 text-sm font-medium"
          >
            <Play className="size-4" /> Reproducir modelo · Replay
          </button>
        </>
      )}

      {section.key === "repeat" && item && (
        <button
          type="button"
          disabled={advancing}
          onClick={() => void (hasRecordedVoice(item.itemId) ? play(audioUrl(item.itemId)) : speak(item.text))}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-hairline px-5 py-4 text-sm font-medium"
        >
          <Play className="size-4" /> Escuchar de nuevo · Replay
        </button>
      )}

      {isScriptedSpeaking && item && cueKey && (
        <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Clave de pronunciación · Pronunciation cue</p>
          <p className="mt-2 text-sm">{pronunciationCue(cueKey, "es")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{pronunciationCue(cueKey, "en")}</p>
          <p lang="en" className="mt-2 text-xs text-muted-foreground">{item.mouthHint}</p>
        </div>
      )}

      {section.key === "retell" && (
        <button
          type="button"
          disabled={advancing}
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
            disabled={advancing}
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
                  disabled={advancing}
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
                  disabled={advancing}
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
            disabled={!placed.length || advancing}
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
          disabled={listening || advancing}
          aria-label={listening ? "Escuchando pronunciación" : `Grabar intento ${captureOrdinal} de 3`}
          className={cn(
            "mt-5 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-semibold",
            listening ? "bg-foreground/80 text-background" : "bg-primary text-primary-foreground",
          )}
        >
          <Mic className="size-4" /> {listening ? "Escuchando…" : "Hablar"}
        </button>
      )}

      {note && <p className="mt-4 text-sm text-muted-foreground">{note}</p>}
      {pendingAdvance && (
        <button type="button" disabled={!advancing} onClick={() => void advance(pendingAdvance)} className="mt-4 w-full rounded-2xl border border-primary px-5 py-3 text-sm font-semibold text-primary disabled:opacity-40">
          Continuar · Continue
        </button>
      )}
    </div>,
  );
}
