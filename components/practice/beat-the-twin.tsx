"use client";

import { useEffect, useMemo } from "react";
import { Headphones, Volume2 } from "lucide-react";
import { Lumi } from "@/components/lumi";
import { playPronunciation, stopPronunciation } from "@/lib/speech/player";
import { cn } from "@/lib/utils";
import { PronunciationCoachRound, type PronunciationResolution } from "./pronunciation-coach-round";
import type { GameProps } from "./sound-sprint";

export interface TwinState { index: number; phase: "listening" | "speaking"; selectedId?: string; heardCorrectly?: boolean; resolved: number; mastered: number; done: boolean }
export const initialTwinState = (): TwinState => ({ index: 0, phase: "listening", resolved: 0, mastered: 0, done: false });
export function chooseTwin(state: TwinState, selectedId: string, targetId: string): TwinState {
  if (state.done || state.phase !== "listening") return state;
  return { ...state, phase: "speaking", selectedId, heardCorrectly: selectedId === targetId };
}
export function completeTwinSpeech(state: TwinState, result: Pick<PronunciationResolution, "mastered">): TwinState {
  if (state.done || state.phase !== "speaking") return state;
  const resolved = state.resolved + 1;
  return { index: Math.min(2, state.index + 1), phase: "listening", resolved, mastered: state.mastered + Number(result.mastered), done: resolved === 3 };
}

export function BeatTheTwin({ activity, day, activityId, state, transition, captureBinding, lessonId, itemPool, recognitionSupported, combo, onOutcome, onDailySessionCommitted, lang }: GameProps) {
  const target = activity.targets[state.targetIndex];
  const targetIndex = state.targetIndex as 0 | 1 | 2;
  const contrast = useMemo(() => itemPool.find((item) => item.id !== target.id && item.pairId && item.pairId === target.pairId), [itemPool, target]);
  const options = contrast ? [target, contrast].sort((a, b) => a.id.localeCompare(b.id)) : [];
  useEffect(() => () => stopPronunciation(), [target.id]);
  const finish = (result: PronunciationResolution) => void transition({ type: "resolve", targetIndex: state.targetIndex, resolution: result.kind }, result.binding);
  if (!contrast) return <div role="alert" className="rounded-2xl border border-warn/30 bg-warn/[0.08] p-4 text-sm">{lang === "es" ? "Esta pareja de sonidos no está disponible. Vuelve atrás e inténtalo de nuevo." : "This sound pair is unavailable. Go back and try again."}</div>;
  return (
    <section className="mx-auto w-full max-w-3xl" aria-labelledby="beat-twin-title">
      <header className="mb-5"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{lang === "es" ? "Escucha → habla" : "Hear it → say it"}</p><h2 id="beat-twin-title" className="font-display text-3xl font-semibold tracking-[-0.03em]">Beat the Twin</h2><p className="mt-1 text-sm text-muted-foreground">{lang === "es" ? "Detecta el sonido parecido y luego haz que tu palabra quede clarísima." : "Catch the sound-alike, then make your target unmistakable."}</p></header>
      {state.stage !== "choice-made" && !state.terminal && (
        <div className="rounded-3xl border border-hairline bg-card p-5 text-center">
          <div aria-hidden="true" className="mx-auto mb-3 w-fit"><Lumi frame="bust" mood="think" className="size-20" /></div>
          <Headphones className="mx-auto size-8 text-primary" aria-hidden="true" />
          <button type="button" onClick={() => { const binding = captureBinding(); if (binding) playPronunciation({ id: target.id, text: target.text, onStart: () => { void transition({ type: "listen", targetIndex: state.targetIndex }, binding); } }); }} aria-label={lang === "es" ? `Reproducir sonido ${state.targetIndex + 1}` : `Play sound ${state.targetIndex + 1}`} className="mx-auto mt-4 grid size-16 place-items-center rounded-full bg-foreground text-background outline-none transition-transform active:scale-95 focus-visible:ring-3 focus-visible:ring-ring motion-reduce:transition-none"><Volume2 className="size-6" aria-hidden="true" /></button>
          {state.stage === "listened" && <fieldset className="mt-5"><legend className="text-sm font-semibold">{lang === "es" ? "¿Cuál escuchaste?" : "Which one did you hear?"}</legend><div className="mt-3 grid grid-cols-2 gap-3">{options.map((option) => <button key={option.id} type="button" onClick={() => { void transition({ type: "choose", targetIndex: state.targetIndex, choiceId: option.id }); }} aria-label={`${option.text}, ${lang === "es" ? "opción de escucha" : "listening choice"}`} className="min-h-14 rounded-2xl border border-hairline px-3 font-display text-xl outline-none transition-colors hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring">{option.text}</button>)}</div></fieldset>}
        </div>
      )}
      {state.stage === "choice-made" && !state.terminal && <div><p role="status" className={cn("mb-3 rounded-2xl px-4 py-3 text-sm", state.choiceId === target.id ? "bg-success/10" : "bg-primary/[0.07]")}>{state.choiceId === target.id ? (lang === "es" ? "Bien oído. Ahora dilo con claridad." : "Nice catch. Now say it clearly.") : (lang === "es" ? `Era “${target.text}”. Ahora dilo con claridad.` : `That was “${target.text}.” Now say it clearly.`)}</p><PronunciationCoachRound key={`${target.id}:${state.targetIndex}`} item={target} lessonId={target.lessonId ?? lessonId} itemPool={itemPool} recognitionSupported={recognitionSupported} combo={combo} initialState={state.sessions[state.targetIndex]} identityKey={`${state.contentHash}:${state.targetIndex}`} dailyPronunciation={{ day, activityId, contentHash: state.contentHash, targetIndex }} captureBinding={captureBinding} onDailySessionCommitted={onDailySessionCommitted} onResolved={finish} onOutcome={onOutcome} /></div>}
    </section>
  );
}
