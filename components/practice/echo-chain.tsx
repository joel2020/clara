"use client";

import { Waves } from "lucide-react";
import { PronunciationCoachRound, type PronunciationResolution } from "./pronunciation-coach-round";
import type { GameProps } from "./sound-sprint";

export interface EchoState { index: number; resolved: number; mastered: number; done: boolean }
export const initialEchoState = (): EchoState => ({ index: 0, resolved: 0, mastered: 0, done: false });
export const buildEchoChain = (chunks: readonly string[]): string[] => chunks.map((_, index) => chunks.slice(0, index + 1).join(" "));
export function completeEchoChunk(state: EchoState, result: Pick<PronunciationResolution, "mastered">): EchoState {
  if (state.done) return state;
  const resolved = state.resolved + 1;
  return { index: Math.min(2, state.index + 1), resolved, mastered: state.mastered + Number(result.mastered), done: resolved === 3 };
}

export function EchoChain({ activity, day, activityId, state, transition, captureBinding, lessonId, itemPool, recognitionSupported, combo, onOutcome, onDailySessionCommitted, lang }: GameProps) {
  const target = activity.targets[state.targetIndex];
  const targetIndex = state.targetIndex as 0 | 1 | 2;
  const finish = (result: PronunciationResolution) => void transition({ type: "resolve", targetIndex: state.targetIndex, resolution: result.kind }, result.binding);
  return (
    <section className="mx-auto w-full max-w-3xl" aria-labelledby="echo-chain-title">
      <header className="mb-5"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{lang === "es" ? "Construye el ritmo" : "Build the rhythm"}</p><h2 id="echo-chain-title" className="font-display text-3xl font-semibold tracking-[-0.03em]">Echo Chain</h2><p className="mt-1 text-sm text-muted-foreground">{lang === "es" ? "Alarga la frase sin perder el golpe de voz." : "Grow the phrase without losing its stressed beat."}</p></header>
      <div className="mb-5 grid gap-2" aria-label={lang === "es" ? "Pasos del eco" : "Echo steps"}>
        {activity.targets.map((chunk, index) => (
          <div
            key={`${chunk.id}:${index}`}
            className={`flex min-h-12 items-center gap-3 rounded-2xl border px-4 ${index === state.targetIndex && !state.terminal ? "border-primary bg-primary/[0.06]" : "border-hairline bg-card"}`}
          >
            <Waves className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span lang="en" className="font-display text-lg">{chunk.stressMarkedText ?? chunk.text}</span>
            {chunk.ipa && <span className="ml-auto font-ipa text-xs text-muted-foreground">{chunk.ipa}</span>}
          </div>
        ))}
      </div>
      {!state.terminal && <PronunciationCoachRound key={`${target.id}:${state.targetIndex}`} item={target} lessonId={target.lessonId ?? lessonId} itemPool={itemPool} recognitionSupported={recognitionSupported} combo={combo} initialState={state.sessions[state.targetIndex]} identityKey={`${state.contentHash}:${state.targetIndex}`} dailyPronunciation={{ day, activityId, contentHash: state.contentHash, targetIndex }} captureBinding={captureBinding} onDailySessionCommitted={onDailySessionCommitted} onResolved={finish} onOutcome={onOutcome} />}
    </section>
  );
}
