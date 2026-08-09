"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PracticeItem } from "@/lib/db/types";
import type { PracticePersistenceBinding } from "@/lib/db/repository";
import type { DailySession } from "@/lib/daily-session";
import { repo } from "@/lib/db";
import { recordPracticeAttempt, type PracticeOutcome } from "@/lib/practice";
import { partnerOf } from "@/lib/content/lessons";
import { createRecognition, RecognitionError, recognitionMode, type RecognitionHandle } from "@/lib/speech/recognition";
import { stopPronunciation } from "@/lib/speech/player";
import { normalize } from "@/lib/speech/scoring";
import { gradePronunciation, type CefrLevel, type PronunciationVerdict } from "@/lib/speech/pronunciation-policy";
import { derivePersonalWeaknesses, diagnosePronunciation, type PronunciationDiagnosis } from "@/lib/speech/pronunciation-diagnosis";
import { isAssessmentResult, type AssessmentResult } from "@/lib/speech/azure-response";
import { targetPhonemeScore as measuredTargetPhonemeScore } from "@/lib/speech/pronunciation-target-evidence";
import {
  INITIAL_PRONUNCIATION_SESSION_STATE,
  isPronunciationSessionState,
  transitionPronunciationSession,
  type PronunciationSessionState,
  type PronunciationSessionTransition,
} from "@/lib/speech/pronunciation-session";

export type PronunciationCoachPhase = "idle" | "capturing" | "assessing" | "feedback" | "recovery" | "save-recovery" | "ungraded-practice";
export type PronunciationRecovery = "permission" | "no-speech" | "capture" | "save" | "account-changed" | null;

export interface PronunciationCoachFeedback {
  heard: string;
  verdict: PronunciationVerdict;
  diagnosis: PronunciationDiagnosis | null;
  transition: PronunciationSessionTransition;
  scores?: AssessmentResult;
  currentScore?: number;
  outcome?: PracticeOutcome;
  contrast?: { target: string; likelySubstitution: string };
  /** Original learner scope that atomically owns this graded evidence. */
  commitBinding?: PracticePersistenceBinding;
}

export interface UsePronunciationCoachOptions {
  item: PracticeItem;
  lessonId: string;
  itemPool: PracticeItem[];
  combo: number;
  recognitionLang: string;
  cefr: CefrLevel;
  onOutcome?: (outcome: PracticeOutcome) => void;
  identityKey?: string;
  initialState?: PronunciationSessionState;
  onStateChange?: (state: PronunciationSessionState) => Promise<void> | void;
  dailyPronunciation?: { day: string; activityId: string; contentHash: string; targetIndex: 0 | 1 | 2 };
  onDailySessionCommitted?: (session: DailySession) => void;
}

interface PendingPronunciationCommit {
  args: Parameters<typeof recordPracticeAttempt>[0];
  feedback: Omit<PronunciationCoachFeedback, "outcome">;
  sequence: number;
  terminal: boolean;
  outcome?: PracticeOutcome;
}

function initialState(value?: PronunciationSessionState): PronunciationSessionState {
  return isPronunciationSessionState(value) ? { ...value } : { ...INITIAL_PRONUNCIATION_SESSION_STATE };
}

function lowest(values: Array<number | undefined>): number | undefined {
  const measured = values.filter((value): value is number => value !== undefined);
  return measured.length > 0 ? Math.min(...measured) : undefined;
}

/** Add target-specific fields from normalized provider evidence; no thresholds live here. */
export function coachAssessmentEvidence(
  assessment: AssessmentResult,
  item: PracticeItem,
  itemPool: PracticeItem[] = [],
): AssessmentResult {
  if (assessment.providerStatus !== "valid" || assessment.recognitionReason) return assessment;
  const target = normalize(item.text);
  const heard = normalize(assessment.recognizedText);
  const partner = partnerOf(item, itemPool);
  const targetPhonemeScore = item.kind === "word" ? measuredTargetPhonemeScore(item, assessment.words) : undefined;
  const scriptedTargetWord = "targetWord" in item && typeof item.targetWord === "string" ? normalize(item.targetWord) : "";
  const gradedWords = scriptedTargetWord
    ? assessment.words.filter((word) => normalize(word.word) === scriptedTargetWord)
    : assessment.words;
  const lowestTargetWordScore = lowest(gradedWords.map((word) => word.accuracyScore));
  return {
    ...assessment,
    targetRecognized: target.length > 0 && heard === target,
    ...(partner ? { minimalPairSubstitution: heard === normalize(partner.text) } : {}),
    ...(targetPhonemeScore === undefined ? {} : { targetPhonemeScore }),
    ...(lowestTargetWordScore === undefined ? {} : { lowestTargetWordScore }),
  };
}

export function usePronunciationCoach(options: UsePronunciationCoachOptions) {
  const onOutcome = options.onOutcome;
  const identityKey = options.identityKey ?? `${options.item.id}:${options.item.text}:${options.item.kind}`;
  const [stateItemId, setStateItemId] = useState(identityKey);
  const [phase, setPhase] = useState<PronunciationCoachPhase>("idle");
  const [feedback, setFeedback] = useState<PronunciationCoachFeedback | null>(null);
  const [recovery, setRecovery] = useState<PronunciationRecovery>(null);
  const [ungradedHeard, setUngradedHeard] = useState("");
  const [session, setSession] = useState<PronunciationSessionState>(() => initialState(options.initialState));
  const sessionRef = useRef<PronunciationSessionState>(initialState(options.initialState));
  const handleRef = useRef<RecognitionHandle | null>(null);
  const captureSequenceRef = useRef(0);
  const captureInFlightRef = useRef(false);
  const saveInFlightRef = useRef<PendingPronunciationCommit | null>(null);
  const terminalCommittedRef = useRef(false);
  const pendingCommitRef = useRef<PendingPronunciationCommit | null>(null);

  const cancelMedia = useCallback(() => {
    stopPronunciation();
    captureSequenceRef.current += 1;
    captureInFlightRef.current = false;
    handleRef.current?.cancel();
    handleRef.current = null;
  }, []);

  const resetSession = useCallback(() => {
    cancelMedia();
    const next = initialState(options.initialState);
    terminalCommittedRef.current = false;
    pendingCommitRef.current = null;
    setStateItemId(identityKey);
    sessionRef.current = next;
    setSession(next);
    setFeedback(null);
    setRecovery(null);
    setUngradedHeard("");
    setPhase("idle");
  }, [cancelMedia, identityKey, options.initialState]);

  useEffect(() => {
    terminalCommittedRef.current = false;
    pendingCommitRef.current = null;
    return () => {
      pendingCommitRef.current = null;
      cancelMedia();
    };
  }, [cancelMedia, identityKey]);

  const handleTechnicalOutage = useCallback((reason: string, heard = "") => {
    const technicalVerdict: PronunciationVerdict = {
      policyVersion: "latam-v1",
      outcome: "technical-skip",
      reasons: ["provider-technical-skip"],
    };
    const transition = transitionPronunciationSession(sessionRef.current, { type: "technical-failure", reason });
    setFeedback({ heard, verdict: technicalVerdict, diagnosis: null, transition });
    setRecovery(null);
    setPhase("feedback");
  }, []);

  const persistPending = useCallback(async () => {
    const pending = pendingCommitRef.current;
    if (!pending || saveInFlightRef.current === pending) return;
    saveInFlightRef.current = pending;
    setRecovery(null);
    setPhase("assessing");
    try {
      const outcome = pending.outcome ?? await recordPracticeAttempt(pending.args);
      pending.outcome = outcome;
      if (pendingCommitRef.current !== pending || pending.sequence !== captureSequenceRef.current) return;
      pendingCommitRef.current = null;
      if (pending.terminal) terminalCommittedRef.current = true;
      if (outcome.dailySession) options.onDailySessionCommitted?.(outcome.dailySession);
      onOutcome?.(outcome);
      sessionRef.current = pending.feedback.transition.state;
      setSession(pending.feedback.transition.state);
      setFeedback({ ...pending.feedback, outcome, commitBinding: pending.args.persistenceBinding });
      setPhase("feedback");
    } catch (error) {
      if (pendingCommitRef.current !== pending || pending.sequence !== captureSequenceRef.current) return;
      setFeedback(pending.feedback);
      setRecovery(
        error && typeof error === "object" && "code" in error && error.code === "account-changed"
          ? "account-changed"
          : "save",
      );
      setPhase("save-recovery");
    } finally {
      if (saveInFlightRef.current === pending) saveInFlightRef.current = null;
    }
  }, [onOutcome, options]);

  const capture = useCallback(async (graded: boolean, persistenceBinding?: PracticePersistenceBinding) => {
    if (captureInFlightRef.current || (graded && (terminalCommittedRef.current || pendingCommitRef.current))) return;
    if (graded && !persistenceBinding) {
      setRecovery("account-changed");
      setPhase("recovery");
      return;
    }
    stopPronunciation();
    const captureSequence = captureSequenceRef.current + 1;
    captureSequenceRef.current = captureSequence;
    captureInFlightRef.current = true;
    if (stateItemId !== identityKey) {
      sessionRef.current = initialState(options.initialState);
      terminalCommittedRef.current = false;
      pendingCommitRef.current = null;
    }
    setStateItemId(identityKey);
    setRecovery(null);
    setFeedback(null);
    setPhase("capturing");
    const handle = createRecognition(graded
      ? {
          lang: options.recognitionLang,
          target: options.item.text,
          assessmentKind: options.item.kind,
        }
      : { lang: options.recognitionLang });
    handleRef.current = handle;
    try {
      const result = await handle.result;
      if (captureSequence !== captureSequenceRef.current) return;
      setPhase("assessing");
      if (!graded) {
        setUngradedHeard(result.transcript);
        setPhase("ungraded-practice");
        return;
      }
      if (!result.assessment) {
        handleTechnicalOutage("assessment-unavailable", result.transcript);
        return;
      }

      const evidence = coachAssessmentEvidence(result.assessment, options.item, options.itemPool);
      if (!isAssessmentResult(evidence) || evidence.providerStatus !== "valid") {
        handleTechnicalOutage("provider-outage");
        return;
      }
      const verdict = gradePronunciation({
        context: options.item.kind === "word" ? "word" : "daily-phrase",
        cefr: options.cefr,
        evidence,
      });
      const currentScore = evidence.pronunciationScore;
      const transition = transitionPronunciationSession(sessionRef.current, {
        type: "valid-verdict",
        verdict,
        combo: verdict.outcome === "mastered" ? options.combo + 1 : 0,
        ...(verdict.outcome === "mastered" || verdict.outcome === "retry" ? { score: currentScore } : {}),
      });
      const attempts = await repo.getAttemptsForPracticeBinding(persistenceBinding!, { limit: 80 });
      if (captureSequence !== captureSequenceRef.current) return;
      const diagnosis = diagnosePronunciation({
        evidence,
        targetItemId: options.item.id,
        personalWeaknesses: derivePersonalWeaknesses(attempts ?? Object.freeze([])),
      });
      const partner = partnerOf(options.item, options.itemPool);
      const contrast = diagnosis?.contrast ?? (partner
        ? { target: options.item.text, likelySubstitution: partner.text }
        : undefined);
      const terminal = transition.state.status === "mastered" || transition.state.status === "practiced-not-mastered";
      const pending: PendingPronunciationCommit = {
        args: {
          item: options.item,
          lessonId: options.lessonId,
          transcript: result.transcript,
          alternatives: result.alternatives,
          combo: options.combo + 1,
          itemPool: options.itemPool,
          assessment: evidence,
          pronunciation: { verdict, diagnosis, transition },
          clientAttemptId: globalThis.crypto.randomUUID(),
          persistenceBinding: persistenceBinding!,
          dailyPronunciation: options.dailyPronunciation,
        },
        feedback: {
          heard: evidence.recognizedText || result.transcript,
          verdict,
          diagnosis,
          transition,
          scores: evidence,
          currentScore,
          contrast,
        },
        sequence: captureSequence,
        terminal,
      };
      pendingCommitRef.current = pending;
      setFeedback(pending.feedback);
      await persistPending();
    } catch (error) {
      if (captureSequence !== captureSequenceRef.current) return;
      if (error instanceof RecognitionError && error.code === "cancelled") {
        setPhase("idle");
        return;
      }
      if (error instanceof RecognitionError && error.code === "not-allowed") {
        setRecovery("permission");
        setPhase("recovery");
        return;
      }
      if (error instanceof RecognitionError && (error.code === "no-speech" || error.code === "silent")) {
        setRecovery("no-speech");
        setPhase("recovery");
        return;
      }
      if (error instanceof RecognitionError && (error.code === "technical-skip" || error.code === "network")) {
        handleTechnicalOutage(error.code);
        return;
      }
      if (error && typeof error === "object" && "code" in error && error.code === "account-changed") {
        cancelMedia();
        setStateItemId(identityKey);
        setRecovery("account-changed");
        setPhase("recovery");
        return;
      }
      setRecovery("capture");
      setPhase("recovery");
    } finally {
      if (captureSequence === captureSequenceRef.current) {
        captureInFlightRef.current = false;
        handleRef.current = null;
      }
    }
  }, [cancelMedia, handleTechnicalOutage, identityKey, options, persistPending, stateItemId]);

  const start = useCallback(() => {
    // This opaque handle is captured before createRecognition and every speech
    // provider await. A later account switch can therefore only commit to this
    // concrete learner database or fail closed.
    const binding = repo.capturePracticeBinding();
    if (!binding) {
      setRecovery("account-changed");
      setPhase("recovery");
      return Promise.resolve();
    }
    return capture(true, binding);
  }, [capture]);
  const practiceWithoutGrade = useCallback(() => capture(false), [capture]);
  const retrySave = useCallback(() => persistPending(), [persistPending]);
  const stop = useCallback(() => {
    if (recognitionMode() === "record") setPhase("assessing");
    handleRef.current?.stop();
  }, []);
  const cancel = cancelMedia;
  const skipTechnical = useCallback(async () => {
    const transition = transitionPronunciationSession(sessionRef.current, { type: "skip-after-outage" });
    try {
      await options.onStateChange?.(transition.state);
    } catch (error) {
      setRecovery(error && typeof error === "object" && "code" in error && error.code === "account-changed" ? "account-changed" : "save");
      setPhase("save-recovery");
      throw error;
    }
    sessionRef.current = transition.state;
    setSession(transition.state);
    setFeedback((current) => current ? { ...current, transition } : current);
  }, [options]);

  const stateMatchesItem = stateItemId === identityKey;
  return {
    phase: stateMatchesItem ? phase : "idle",
    feedback: stateMatchesItem ? feedback : null,
    recovery: stateMatchesItem ? recovery : null,
    ungradedHeard: stateMatchesItem ? ungradedHeard : "",
    session: stateMatchesItem ? session : initialState(options.initialState),
    mode: recognitionMode(),
    start,
    stop,
    cancel,
    practiceWithoutGrade,
    retrySave,
    skipTechnical,
    resetSession,
  };
}
