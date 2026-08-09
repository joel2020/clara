"use client";

import { Zap } from "lucide-react";
import type { DailyPronunciationActivity } from "@/lib/daily-session";
import type { PracticeItem } from "@/lib/db/types";
import type { PracticeOutcome } from "@/lib/practice";
import type { CoachLang } from "@/lib/i18n";
import { PronunciationCoachRound, type PronunciationResolution } from "./pronunciation-coach-round";
import type { DailyPronunciationGameEvent, DailyPronunciationGameState } from "@/lib/speech/daily-pronunciation-game";
import type { PracticePersistenceBinding } from "@/lib/db/repository";
import type { DailySession } from "@/lib/daily-session";

export interface SoundSprintState { index: number; resolved: number; mastered: number; done: boolean }
export const initialSoundSprintState = (): SoundSprintState => ({ index: 0, resolved: 0, mastered: 0, done: false });
export function advanceSoundSprint(state: SoundSprintState, result: Pick<PronunciationResolution, "mastered">): SoundSprintState {
  if (state.done) return state;
  const resolved = state.resolved + 1;
  return { index: Math.min(2, state.index + 1), resolved, mastered: state.mastered + Number(result.mastered), done: resolved === 3 };
}

export function SoundSprint({ activity, day, activityId, state, transition, captureBinding, lessonId, itemPool, recognitionSupported, combo, onOutcome, onDailySessionCommitted, lang }: GameProps) {
  const target = activity.targets[state.targetIndex];
  const targetIndex = state.targetIndex as 0 | 1 | 2;
  const finish = (result: PronunciationResolution) => void transition({ type: "resolve", targetIndex: state.targetIndex, resolution: result.kind }, result.binding);
  return (
    <section className="mx-auto w-full max-w-3xl" aria-labelledby="sound-sprint-title">
      <header className="mb-5 flex items-end justify-between gap-4">
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{lang === "es" ? "3 frases rápidas" : "3 quick lines"}</p><h2 id="sound-sprint-title" className="font-display text-3xl font-semibold tracking-[-0.03em]">Sound Sprint</h2><p className="mt-1 text-sm text-muted-foreground">{lang === "es" ? "Claro y breve. Una frase, una respiración." : "Keep it crisp. One line, one breath."}</p></div>
        <Zap className="size-8 text-warn-foreground" aria-hidden="true" />
      </header>
      <ol aria-label={lang === "es" ? "Progreso del sprint" : "Sprint progress"} className="mb-5 grid grid-cols-3 gap-2">
        {activity.targets.map((item, index) => <li key={`${item.id}:${index}`} className={`h-2 rounded-full ${state.resolutions[index] ? "bg-success" : index === state.targetIndex && !state.terminal ? "bg-primary" : "bg-muted"}`}><span className="sr-only">{lang === "es" ? `Línea ${index + 1}${state.resolutions[index] ? " completada" : ""}` : `Line ${index + 1}${state.resolutions[index] ? " complete" : ""}`}</span></li>)}
      </ol>
      {!state.terminal && <PronunciationCoachRound key={`${target.id}:${state.targetIndex}`} item={target} lessonId={target.lessonId ?? lessonId} itemPool={itemPool} recognitionSupported={recognitionSupported} combo={combo} initialState={state.sessions[state.targetIndex]} identityKey={`${state.contentHash}:${state.targetIndex}`} dailyPronunciation={{ day, activityId, contentHash: state.contentHash, targetIndex }} captureBinding={captureBinding} onDailySessionCommitted={onDailySessionCommitted} onResolved={finish} onOutcome={onOutcome} />}
    </section>
  );
}

export interface GameProps {
  activity: DailyPronunciationActivity; day: string; activityId: string; state: DailyPronunciationGameState; transition: (event: DailyPronunciationGameEvent, binding?: PracticePersistenceBinding) => Promise<boolean>; captureBinding: () => PracticePersistenceBinding | null; lessonId: string; itemPool: PracticeItem[]; recognitionSupported: boolean; combo: number;
  onOutcome?: (outcome: PracticeOutcome) => void; onDailySessionCommitted?: (session: DailySession) => void; lang: CoachLang;
}
