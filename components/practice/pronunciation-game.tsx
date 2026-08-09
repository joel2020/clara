"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { dailyPronunciationChoiceIds, isAuthoredDailyPronunciationActivity, type DailyPronunciationActivity, type DailySession } from "@/lib/daily-session";
import type { PracticeItem } from "@/lib/db/types";
import type { PracticeOutcome } from "@/lib/practice";
import { repo } from "@/lib/db";
import { StalePracticeBindingError, type PracticePersistenceBinding } from "@/lib/db/repository";
import { useSettings } from "@/lib/hooks/useSettings";
import { BeatTheTwin } from "./beat-the-twin";
import { CallRescue } from "./call-rescue";
import { EchoChain } from "./echo-chain";
import { SoundSprint } from "./sound-sprint";
import {
  advanceDailyPronunciationGame,
  createDailyPronunciationGameState,
  dailyPronunciationContentHash,
  dailyPronunciationLegacyContentHash,
  isDailyPronunciationGameState,
  type DailyPronunciationGameEvent,
  type DailyPronunciationGameState,
} from "@/lib/speech/daily-pronunciation-game";
export { PronunciationCoachRound } from "./pronunciation-coach-round";

type PronunciationGameProps = {
  activity: DailyPronunciationActivity;
  day?: string;
  activityId?: string;
  lessonId: string;
  itemPool: PracticeItem[];
  recognitionSupported: boolean;
  combo: number;
  onStateChange?: (state: DailyPronunciationGameState, binding: PracticePersistenceBinding) => Promise<void> | void;
  onComplete: (result: { mastered: number; resolved: number; status: "completed" | "technical-skip" }) => void;
  onOutcome?: (outcome: PracticeOutcome) => void;
};

export function PronunciationGame(props: PronunciationGameProps) {
  const legacy = props.activity.state === undefined && props.activity.itemPool === undefined;
  return legacy ? <LegacyPronunciationRecovery {...props} /> : <ValidatedPronunciationGame {...props} />;
}

function LegacyPronunciationRecovery(props: PronunciationGameProps) {
  const { settings } = useSettings();
  const [migrated, setMigrated] = useState<DailyPronunciationActivity | null>(null);
  const [failed, setFailed] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const attemptedRef = useRef(false);
  const recover = useCallback(() => {
    if (recovering) return;
    const binding = repo.capturePracticeBinding();
    if (!binding) { setFailed(true); return; }
    setRecovering(true);
    setFailed(false);
    void repo.replaceCorruptDailyPronunciation(binding, {
      day: props.day ?? "test-day", activityId: props.activityId ?? "pronunciation", at: Date.now(),
    }).then((session) => {
      const pronunciation = session.activities.find((entry) => entry.id === (props.activityId ?? "pronunciation"))?.pronunciation;
      if (!pronunciation?.state || !pronunciation.itemPool || !isAuthoredDailyPronunciationActivity(pronunciation)) {
        throw new Error("Invalid legacy migration");
      }
      setMigrated(pronunciation);
    }).catch(() => setFailed(true)).finally(() => setRecovering(false));
  }, [props.activityId, props.day, recovering]);
  useEffect(() => {
    if (attemptedRef.current) return;
    attemptedRef.current = true;
    recover();
  }, [recover]);

  if (migrated) return <ValidatedPronunciationGame {...props} activity={migrated} />;
  if (failed) return <div role="alert" className="rounded-2xl border border-warn/30 bg-warn/[0.08] p-4 text-sm">
    <p>{settings.coachLanguage === "es" ? "No pudimos recuperar esta práctica anterior. Inténtalo otra vez o vuelve atrás." : "We couldn't recover this earlier practice. Try again or go back."}</p>
    <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={recovering} onClick={recover} className="min-h-11 rounded-xl bg-foreground px-4 font-semibold text-background disabled:opacity-50">{settings.coachLanguage === "es" ? "Reintentar" : "Retry"}</button><button type="button" onClick={() => window.history.back()} className="min-h-11 rounded-xl border border-hairline px-4 font-semibold">{settings.coachLanguage === "es" ? "Volver" : "Back"}</button></div>
  </div>;
  return <div role="status" className="rounded-2xl border border-hairline p-4 text-sm">{settings.coachLanguage === "es" ? "Preparando tu práctica anterior…" : "Preparing your earlier practice…"}</div>;
}

function ValidatedPronunciationGame({ activity, day = "test-day", activityId = "pronunciation", lessonId, itemPool, recognitionSupported, combo, onStateChange, onComplete, onOutcome }: PronunciationGameProps) {
  const { settings } = useSettings();
  const strongContentHash = dailyPronunciationContentHash(activity.game, activity.targets, activity.itemPool ?? itemPool);
  const acceptedContentHashes = [strongContentHash, dailyPronunciationLegacyContentHash(activity.game, activity.targets)];
  const allowedChoiceIds = dailyPronunciationChoiceIds(activity, activity.state?.targetIndex ?? 0);
  const persistedStateValid = activity.state?.game === activity.game && isDailyPronunciationGameState(activity.state, acceptedContentHashes, allowedChoiceIds);
  const contentHash = persistedStateValid ? activity.state!.contentHash : strongContentHash;
  const authoredActivityValid = isAuthoredDailyPronunciationActivity(activity);
  const persistedStateCorrupt = activity.state !== undefined && !persistedStateValid;
  const initial: DailyPronunciationGameState = persistedStateValid
    ? activity.state!
    : createDailyPronunciationGameState(activity.game, activity.targets, activity.itemPool ?? itemPool);
  const [storedState, setState] = useState(initial);
  const [recoveredCorruptState, setRecoveredCorruptState] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState(false);
  const state = storedState.contentHash === contentHash ? storedState : initial;
  const [failedCheckpoint, setFailedCheckpoint] = useState<{ state: DailyPronunciationGameState; binding: PracticePersistenceBinding } | null>(null);
  const [checkpointAccountChanged, setCheckpointAccountChanged] = useState(false);
  const inFlightRef = useRef(false);
  const completedHashRef = useRef<string | null>(null);
  const persist = async (next: DailyPronunciationGameState, binding: PracticePersistenceBinding, retry = false) => {
    if (inFlightRef.current) return false;
    inFlightRef.current = true;
    try {
      await onStateChange?.(next, binding);
      setFailedCheckpoint(null);
      setCheckpointAccountChanged(false);
      setState(next);
      if (next.terminal && completedHashRef.current !== next.contentHash) {
        completedHashRef.current = next.contentHash;
        onComplete({ mastered: next.masteredTargets, resolved: 3, status: next.gradedTargets > 0 ? "completed" : "technical-skip" });
      }
      return true;
    } catch (error) {
      setFailedCheckpoint({ state: next, binding });
      if (retry && error instanceof StalePracticeBindingError) setCheckpointAccountChanged(true);
      return false;
    } finally {
      inFlightRef.current = false;
    }
  };
  const transition = async (event: DailyPronunciationGameEvent, capturedBinding?: PracticePersistenceBinding) => {
    if (inFlightRef.current || state.terminal) return false;
    const binding = capturedBinding ?? repo.capturePracticeBinding();
    if (!binding) return false;
    const next = advanceDailyPronunciationGame(state, event);
    if (next === state) return false;
    return persist(next, binding);
  };
  const handleDailySessionCommitted = (session: DailySession) => {
    const committed = session.activities.find((entry) => entry.id === activityId)?.pronunciation?.state;
    if (committed && isDailyPronunciationGameState(committed, contentHash, dailyPronunciationChoiceIds(activity, committed.targetIndex))) setState(committed);
  };
  const handleOutcome = (outcome: PracticeOutcome) => {
    if (outcome.dailySession) handleDailySessionCommitted(outcome.dailySession);
    onOutcome?.(outcome);
  };
  const recoverCorrupt = () => {
    const binding = repo.capturePracticeBinding();
    if (!binding) { setRecoveryError(true); return; }
    setRecovering(true);
    setRecoveryError(false);
    void repo.replaceCorruptDailyPronunciation(binding, { day, activityId, at: Date.now() })
      .then((session) => {
        const next = session.activities.find((entry) => entry.id === activityId)?.pronunciation?.state;
        if (!next || !isDailyPronunciationGameState(next, contentHash, dailyPronunciationChoiceIds(activity, next.targetIndex))) throw new Error("Invalid recovery state");
        setState(next);
        setRecoveredCorruptState(true);
      })
      .catch(() => setRecoveryError(true))
      .finally(() => setRecovering(false));
  };
  const props = { activity, day, activityId, state, transition, captureBinding: () => repo.capturePracticeBinding(), lessonId, itemPool: activity.itemPool ?? itemPool, recognitionSupported, combo, onOutcome: handleOutcome, onDailySessionCommitted: handleDailySessionCommitted, lang: settings.coachLanguage };
  const identity = contentHash;
  if ((!authoredActivityValid || persistedStateCorrupt) && !recoveredCorruptState) {
    return <div role="alert" className="rounded-2xl border border-warn/30 bg-warn/[0.08] p-4 text-sm"><p>{recoveryError
      ? (settings.coachLanguage === "es" ? "No pudimos iniciar una sesión segura. Inténtalo otra vez o vuelve atrás." : "We couldn't start a safe session. Try again or go back.")
      : (settings.coachLanguage === "es" ? "No podemos reanudar esta práctica sin arriesgar tus intentos guardados." : "We can't resume this practice without risking your saved attempts.")}</p>{authoredActivityValid && persistedStateCorrupt && (recoveryError
      ? <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={recovering} onClick={recoverCorrupt} className="min-h-11 rounded-xl bg-foreground px-4 font-semibold text-background disabled:opacity-50">{settings.coachLanguage === "es" ? "Reintentar" : "Retry"}</button><button type="button" onClick={() => window.history.back()} className="min-h-11 rounded-xl border border-hairline px-4 font-semibold">{settings.coachLanguage === "es" ? "Volver" : "Back"}</button></div>
      : <button type="button" disabled={recovering} onClick={recoverCorrupt} className="mt-3 min-h-11 rounded-xl bg-foreground px-4 font-semibold text-background disabled:opacity-50">{settings.coachLanguage === "es" ? "Iniciar una sesión nueva y segura" : "Start a new safe session"}</button>)}</div>;
  }
  const game = activity.game === "beat-the-twin" ? <BeatTheTwin key={identity} {...props} />
    : activity.game === "echo-chain" ? <EchoChain key={identity} {...props} />
      : activity.game === "call-rescue" ? <CallRescue key={identity} {...props} />
        : <SoundSprint key={identity} {...props} />;
  return <>{failedCheckpoint?.state.contentHash === contentHash && <div role="alert" className="mb-4 rounded-2xl border border-warn/30 bg-warn/[0.08] p-3 text-sm">{checkpointAccountChanged
    ? <><p>{settings.coachLanguage === "es" ? "La cuenta cambió. Vuelve atrás para proteger el intento de la cuenta original." : "The account changed. Go back to protect the original account's attempt."}</p><button type="button" onClick={() => window.history.back()} className="mt-2 min-h-11 rounded-xl border border-hairline px-4 font-semibold">{settings.coachLanguage === "es" ? "Volver" : "Back"}</button></>
    : <><p>{settings.coachLanguage === "es" ? "No pudimos guardar este paso. Tu intento sigue aquí." : "We couldn't save this step. Your attempt is still here."}</p><button type="button" onClick={() => void persist(failedCheckpoint.state, failedCheckpoint.binding, true)} className="mt-2 min-h-11 rounded-xl bg-foreground px-4 font-semibold text-background">{settings.coachLanguage === "es" ? "Volver a guardar" : "Save again"}</button></>}</div>}{game}</>;
}
