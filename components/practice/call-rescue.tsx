"use client";

import { PhoneCall } from "lucide-react";
import { PronunciationCoachRound, type PronunciationResolution } from "./pronunciation-coach-round";
import type { GameProps } from "./sound-sprint";

export interface CallRescueState { index: number; resolved: number; mastered: number; done: boolean }
export const initialCallRescueState = (): CallRescueState => ({ index: 0, resolved: 0, mastered: 0, done: false });
export const buildCallRepair = (keyword: string): [string, string, string] => [`${keyword}.`, `Did you say ${keyword}?`, `Let me confirm: ${keyword}.`];
export function completeCallRescue(state: CallRescueState, result: Pick<PronunciationResolution, "mastered">): CallRescueState {
  if (state.done) return state;
  const resolved = state.resolved + 1;
  return { index: Math.min(2, state.index + 1), resolved, mastered: state.mastered + Number(result.mastered), done: resolved === 3 };
}

export function CallRescue({ activity, day, activityId, state, transition, captureBinding, lessonId, itemPool, recognitionSupported, combo, onOutcome, onDailySessionCommitted, lang }: GameProps) {
  const target = activity.targets[state.targetIndex];
  const targetIndex = state.targetIndex as 0 | 1 | 2;
  const finish = (result: PronunciationResolution) => void transition({ type: "resolve", targetIndex: state.targetIndex, resolution: result.kind }, result.binding);
  return (
    <section className="mx-auto w-full max-w-3xl" aria-labelledby="call-rescue-title">
      <header className="mb-5"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{lang === "es" ? "Repara la llamada" : "Repair the call"}</p><h2 id="call-rescue-title" className="font-display text-3xl font-semibold tracking-[-0.03em]">Call Rescue</h2><p className="mt-1 text-sm text-muted-foreground">{lang === "es" ? "Convierte una palabra que no se entendió en una reparación tranquila y profesional." : "Turn one misunderstood word into a calm, professional repair."}</p></header>
      <div className="mb-5 rounded-3xl bg-foreground p-5 text-background shadow-[0_24px_60px_-38px_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-background/60"><PhoneCall className="size-4" aria-hidden="true" /> {lang === "es" ? "Llamada en vivo" : "Live call"} · {lang === "es" ? "paso" : "step"} {state.targetIndex + 1}/3</div>
        <p className="mt-4 text-sm text-background/70">{state.targetIndex === 0 ? (lang === "es" ? "Cliente: «Perdón, ¿qué palabra?»" : "Caller: “Sorry, which word?”") : state.targetIndex === 1 ? (lang === "es" ? "Tú: comprueba la palabra que escuchaste." : "You: check the word you heard.") : (lang === "es" ? "Tú: cierra la reparación con seguridad." : "You: close the repair with confidence.")}</p>
        <p lang="en" className="mt-2 font-display text-2xl font-semibold">“{target.text}”</p>
      </div>
      {!state.terminal && <PronunciationCoachRound key={`${target.id}:${state.targetIndex}`} item={target} lessonId={target.lessonId ?? lessonId} itemPool={itemPool} recognitionSupported={recognitionSupported} combo={combo} initialState={state.sessions[state.targetIndex]} identityKey={`${state.contentHash}:${state.targetIndex}`} dailyPronunciation={{ day, activityId, contentHash: state.contentHash, targetIndex }} captureBinding={captureBinding} onDailySessionCommitted={onDailySessionCommitted} onResolved={finish} onOutcome={onOutcome} />}
    </section>
  );
}
