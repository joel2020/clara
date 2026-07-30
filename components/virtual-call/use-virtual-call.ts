"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authHeaders } from "@/lib/auth-client";
import type { VirtualCallScenario } from "@/lib/content/virtual-call-scenarios";
import { t, type CoachLang } from "@/lib/i18n";
import type { Level } from "@/lib/placement";
import { createRecognition, recognitionErrorKey, type RecognitionHandle } from "@/lib/speech/recognition";
import type { Assessment } from "@/lib/speech/azure";
import { repo } from "@/lib/db";
import { buildReport, type CallReport } from "@/lib/virtual-call/report";
import {
  applyRetry,
  applyTurn,
  callDurationMs,
  callTimeRemainingMs,
  CONTEXT_WINDOW_TURNS,
  createCallState,
  endCall as endCallState,
  MAX_RECORDING_MS,
  mustEnd,
  shouldInterrupt,
  shouldShowInline,
  type CallState,
  type CorrectionMode,
  type PronunciationEvidence,
} from "@/lib/virtual-call/session";
import { virtualCallTurnProvider, type VirtualCallTurnProvider } from "./turn-provider";

// The Virtual Call controller.
//
// Everything the screen renders comes from here, and every rule about what a
// call DOES lives in lib/virtual-call/session.ts — this hook only sequences
// the browser work around it (speech capture, audio playback, clocks,
// connectivity) and never re-decides when Clara interrupts or whether a retry
// passed. The model call goes through one injectable provider (see
// ./turn-provider.ts), so swapping the mock for the real endpoint touches no
// component.

/**
 * What the screen shows. These are the session phases plus the three states a
 * phase cannot express: whether the mic is open, whether the browser lost the
 * network, and whether the last request failed. `your-turn` is the settled
 * state between Clara finishing a line and the learner tapping record — saying
 * "Clara is speaking" while she is silent would be a lie to a screen reader.
 */
export type CallUiState =
  | "idle"
  | "connecting"
  | "clara-speaking"
  | "your-turn"
  | "listening"
  | "processing"
  | "awaiting-retry"
  | "correction"
  | "error"
  | "offline"
  | "ended";

/** One line of the running conversation, in the order it was said. */
export type CallEntry =
  | { id: string; kind: "clara"; text: string; textEs: string }
  /** `turnIndex` addresses the recorded LearnerTurn once it has been applied;
   *  `text` is kept here so her words appear the instant she stops recording,
   *  before (and even if) the turn analysis comes back. */
  | { id: string; kind: "learner"; text: string; turnIndex: number };

/** The encouraging copy from /api/virtual-call/report. Never carries numbers:
 *  every figure on the report is computed locally from the recorded turns. */
export interface CallProse {
  summary: string;
  did_well: string[];
  next_activity: string;
}

export interface CallError {
  /** "turn" is recoverable by resending; "mic" and "audio" are not. */
  kind: "turn" | "mic";
  message: string;
}

export interface VirtualCallController {
  scenario: VirtualCallScenario | null;
  mode: CorrectionMode;
  state: CallState | null;
  uiState: CallUiState;
  entries: CallEntry[];
  suggestions: string[];
  report: CallReport | null;
  /** Model-written encouragement around the computed report. Null until it
   *  arrives, and stays null if it never does. */
  prose: CallProse | null;
  elapsedMs: number;
  remainingMs: number;
  error: CallError | null;
  /** Set when TTS failed or was blocked. Clara's words stay readable regardless. */
  audioFailed: boolean;
  online: boolean;
  muted: boolean;
  timeUp: boolean;
  /** The turn whose retry was just resolved, so its outcome can be shown. */
  retriedTurnIndex: number | null;
  start: (scenario: VirtualCallScenario, mode: CorrectionMode) => void;
  record: () => void;
  retry: () => void;
  stopRecording: () => void;
  toggleMute: () => void;
  end: () => void;
  /** Back to the picker, discarding the finished call. */
  reset: () => void;
  /** Resend the turn that failed. */
  resend: () => void;
  dismissError: () => void;
  replay: (text: string) => void;
}

let entrySeq = 0;
function nextEntryId(prefix: string): string {
  entrySeq += 1;
  return `${prefix}-${entrySeq}`;
}

/** The one place an Azure assessment becomes report-grade evidence. */
function toPronunciation(assessment: Assessment | undefined, target: string): PronunciationEvidence | undefined {
  if (!assessment) return undefined;
  const missed = assessment.words
    .filter((w) => w.errorType !== "None")
    .sort((a, b) => a.accuracy - b.accuracy)[0];
  return {
    score: Math.round(assessment.pronScore),
    target,
    ...(missed ? { worstWord: missed.word } : {}),
  };
}

export function useVirtualCall(options: {
  lang: CoachLang;
  level: Level;
  /** Passed straight through so Clara can address her by name. */
  studentName: string;
  /** Injected in tests and when the real endpoint replaces the mock. */
  provider?: VirtualCallTurnProvider;
}): VirtualCallController {
  const { lang, level, studentName, provider = virtualCallTurnProvider } = options;

  const [scenario, setScenario] = useState<VirtualCallScenario | null>(null);
  const [mode, setMode] = useState<CorrectionMode>("natural");
  const [state, setState] = useState<CallState | null>(null);
  const [entries, setEntries] = useState<CallEntry[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<CallError | null>(null);
  const [audioFailed, setAudioFailed] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [metCriteria, setMetCriteria] = useState(false);
  const [retriedTurnIndex, setRetriedTurnIndex] = useState<number | null>(null);
  const [online, setOnline] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recRef = useRef<RecognitionHandle | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  /** The reply Clara is holding back while she waits for a corrected sentence. */
  const heldReply = useRef<{ en: string; es: string } | null>(null);
  /** The turn in flight, kept so a failed send can be retried unchanged. */
  const inFlight = useRef<{ transcript: string; turnIndex: number } | null>(null);

  // One reusable <audio>, created on the client.
  useEffect(() => {
    audioRef.current = new Audio();
    const el = audioRef.current;
    return () => {
      el?.pause();
      recRef.current?.cancel();
      abortRef.current?.abort();
    };
  }, []);

  // Connectivity. The call pauses rather than failing: nothing is lost, and the
  // learner is told why the controls went quiet.
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const running = state !== null && state.phase !== "ended";

  // The call clock, and the hard stop that rides on it. One second is the
  // finest resolution the UI shows. The ceiling is enforced here rather than in
  // an effect watching the clock, so the decision and the tick that triggers it
  // happen in the same place — and the state updater stays pure.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const at = Date.now();
      setNow(at);
      setState((s) => (s && s.phase !== "ended" && mustEnd(s, at) ? endCallState(s, at) : s));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  // Whatever ended the call — her hand, the duration ceiling, the turn ceiling —
  // the mic, the audio, and any request in flight stop with it.
  useEffect(() => {
    if (state?.phase !== "ended") return;
    recRef.current?.cancel();
    abortRef.current?.abort();
    audioRef.current?.pause();
  }, [state?.phase]);

  const speak = useCallback(
    async (text: string) => {
      const el = audioRef.current;
      if (!el || muted) return;
      setAudioFailed(false);
      setSpeaking(true);
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await authHeaders()) },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        el.src = url;
        el.onended = () => {
          URL.revokeObjectURL(url);
          setSpeaking(false);
        };
        el.onpause = () => setSpeaking(false);
        await el.play();
      } catch {
        // Voice is an enhancement: her words are always on screen, so a failed
        // or autoplay-blocked playback is a notice, never a blocked call.
        setSpeaking(false);
        setAudioFailed(true);
      }
    },
    [muted],
  );

  const start = useCallback(
    (next: VirtualCallScenario, nextMode: CorrectionMode) => {
      abortRef.current?.abort();
      recRef.current?.cancel();
      heldReply.current = null;
      inFlight.current = null;
      const startedAt = Date.now();
      setScenario(next);
      setMode(nextMode);
      setState(createCallState({ scenarioId: next.id, mode: nextMode, level, startedAt, targetTurns: next.targetTurns }));
      setEntries([{ id: nextEntryId("clara"), kind: "clara", text: next.openingPrompt, textEs: "" }]);
      setSuggestions([]);
      setError(null);
      setAudioFailed(false);
      setMetCriteria(false);
      setRetriedTurnIndex(null);
      setNow(startedAt);
      // "Connecting" is the honest name for fetching and starting Clara's
      // opening line; it clears whether the audio played or not.
      setConnecting(true);
      void speak(next.openingPrompt).finally(() => setConnecting(false));
    },
    [level, speak],
  );

  /** Ask the provider for Clara's response to one learner turn. */
  const send = useCallback(
    async (transcript: string, turnIndex: number) => {
      const current = state;
      if (!current || !scenario) return;
      inFlight.current = { transcript, turnIndex };
      setError(null);
      setSuggestions([]);
      setState((s) => (s ? { ...s, phase: "processing" } : s));
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const analysis = await provider({
          scenarioId: scenario.id,
          mode: current.mode,
          level: current.level,
          coachLanguage: lang,
          studentName,
          utterance: transcript,
          // Both sides of the conversation, oldest first, windowed by the
          // session module's own constant so the client and the route agree on
          // how much history a turn is allowed to cost.
          history: entries
            .map((e) => ({ role: e.kind === "clara" ? ("clara" as const) : ("learner" as const), text: e.text }))
            .slice(-CONTEXT_WINDOW_TURNS * 2),
          signal: controller.signal,
        });
        inFlight.current = null;
        if (analysis.metCriteria) setMetCriteria(true);
        // The session module decides whether this interrupts — not the UI. Asked
        // BEFORE the state update rather than read back out of it, because a
        // state updater must stay pure (StrictMode invokes it twice in dev).
        const correction = analysis.correction;
        const interrupted =
          shouldInterrupt(current.mode, correction, analysis.needsClarification) && correction !== null;
        setState((s) => (s ? applyTurn(s, { transcript, analysis, at: Date.now() }) : s));
        if (interrupted && correction) {
          // Hold the real reply until she has said the fixed sentence, so the
          // conversation does not run away from the correction.
          heldReply.current = { en: analysis.reply, es: analysis.replyEs };
          const ask = {
            en: `One quick fix — try saying: "${correction.corrected}"`,
            es: `Una corrección rápida: intenta decir "${correction.corrected}"`,
          };
          setEntries((prev) => [
            ...prev,
            { id: nextEntryId("clara"), kind: "clara", text: ask.en, textEs: ask.es },
          ]);
          setSuggestions([]);
          void speak(ask.en);
          return;
        }
        setEntries((prev) => [
          ...prev,
          { id: nextEntryId("clara"), kind: "clara", text: analysis.reply, textEs: analysis.replyEs },
        ]);
        setSuggestions(analysis.suggestions ?? []);
        void speak(analysis.reply);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        // The turn is kept in `inFlight` so "try again" resends it unchanged.
        setState((s) => (s ? { ...s, phase: "clara-speaking" } : s));
        setError({ kind: "turn", message: t("vcallTurnError", lang) });
      }
    },
    [state, scenario, provider, lang, studentName, entries, speak],
  );

  /** Score a retry against the pending correction and release the held reply. */
  const finishRetry = useCallback(
    (transcript: string, assessment: Assessment | undefined) => {
      const pending = state?.pendingRetry;
      const pendingIndex = state?.pendingRetryTurn ?? null;
      if (!pending || pendingIndex === null) return;
      setRetriedTurnIndex(pendingIndex);
      // Pronunciation evidence exists only here, where the target sentence is
      // known. Absent evidence stays absent — it is never inferred.
      const pronunciation = toPronunciation(assessment, pending.corrected);
      setState((s) =>
        s
          ? applyRetry(s, {
              transcript,
              at: Date.now(),
              ...(pronunciation ? { pronunciation } : {}),
            })
          : s,
      );
      const reply = heldReply.current;
      heldReply.current = null;
      if (!reply) return;
      setEntries((prev) => [
        ...prev,
        { id: nextEntryId("clara"), kind: "clara", text: reply.en, textEs: reply.es },
      ]);
      void speak(reply.en);
    },
    [state, speak],
  );

  /** Open the mic. `target` is set only for a retry, where the sentence is known. */
  const capture = useCallback(
    (target?: string) => {
      if (!state || recording || !online) return;
      audioRef.current?.pause();
      setError(null);
      const turnIndex = state.turns.length;
      const handle = createRecognition({ lang: "en-US", ...(target ? { target } : {}) });
      recRef.current = handle;
      setRecording(true);
      // MAX_RECORDING_MS is a cost control as much as a UX one: stop rather
      // than let an open mic run.
      const cap = setTimeout(() => handle.stop(), MAX_RECORDING_MS);
      handle.result
        .then((result) => {
          clearTimeout(cap);
          recRef.current = null;
          setRecording(false);
          const said = result.transcript.trim();
          if (!said) {
            setError({ kind: "mic", message: t("recNoSpeech", lang) });
            return;
          }
          if (target) {
            finishRetry(said, result.assessment);
            return;
          }
          setRetriedTurnIndex(null);
          setEntries((prev) => [...prev, { id: nextEntryId("learner"), kind: "learner", text: said, turnIndex }]);
          void send(said, turnIndex);
        })
        .catch((e: unknown) => {
          clearTimeout(cap);
          recRef.current = null;
          setRecording(false);
          const code = (e as { code?: string } | null)?.code;
          if (code === "cancelled") return;
          setError({ kind: "mic", message: t(recognitionErrorKey(e), lang) });
        });
    },
    [state, recording, online, lang, send, finishRetry],
  );

  const record = useCallback(() => capture(), [capture]);
  const retry = useCallback(() => capture(state?.pendingRetry?.corrected), [capture, state]);
  const stopRecording = useCallback(() => recRef.current?.stop(), []);

  const toggleMute = useCallback(() => {
    setMuted((was) => {
      if (!was) {
        audioRef.current?.pause();
        setSpeaking(false);
      }
      return !was;
    });
  }, []);

  const end = useCallback(() => {
    recRef.current?.cancel();
    abortRef.current?.abort();
    audioRef.current?.pause();
    setRecording(false);
    setSpeaking(false);
    setState((s) => (s && s.phase !== "ended" ? endCallState(s, Date.now()) : s));
  }, []);

  const reset = useCallback(() => {
    recRef.current?.cancel();
    abortRef.current?.abort();
    audioRef.current?.pause();
    heldReply.current = null;
    inFlight.current = null;
    setScenario(null);
    setState(null);
    setEntries([]);
    setSuggestions([]);
    setError(null);
    setRecording(false);
    setSpeaking(false);
    setRetriedTurnIndex(null);
  }, []);

  const resend = useCallback(() => {
    const pending = inFlight.current;
    if (!pending) {
      setError(null);
      return;
    }
    void send(pending.transcript, pending.turnIndex);
  }, [send]);

  const dismissError = useCallback(() => setError(null), []);
  const replay = useCallback((text: string) => void speak(text), [speak]);

  // The report is derived from the ended call, not stored: every number in it
  // is already recorded in CallState, so a copy could only ever drift.
  const report = useMemo<CallReport | null>(() => {
    if (!state || state.phase !== "ended" || !scenario) return null;
    return buildReport({
      state,
      now: state.endedAt ?? state.startedAt,
      targetVocabulary: scenario.targetVocabulary,
      metCriteria,
    });
  }, [state, scenario, metCriteria]);

  // Persist the finished call and fetch its prose, exactly once.
  //
  // Both live here rather than in the report component because the report view
  // is remounted by navigation: writing from there would save the same call
  // twice and pay for the prose twice. The record is written even when the
  // prose request fails — her progress must not depend on a model being up.
  const savedRef = useRef<string | null>(null);
  const [prose, setProse] = useState<CallProse | null>(null);
  useEffect(() => {
    if (!report || !state || !scenario || state.phase !== "ended") return;
    const key = `${scenario.id}:${state.startedAt}`;
    if (savedRef.current === key) return;
    savedRef.current = key;

    void repo
      .saveVirtualCall({
        scenarioId: report.scenarioId,
        mode: state.mode,
        level: state.level,
        startedAt: state.startedAt,
        endedAt: state.endedAt ?? state.startedAt,
        at: state.endedAt ?? state.startedAt,
        durationMs: report.durationMs,
        learnerTurns: report.learnerTurns,
        cleanTurns: report.cleanTurns,
        metCriteria: report.metCriteria,
        corrections: report.corrections,
        priorities: report.priorities,
        vocabularyUsed: report.vocabularyUsed,
        ...(report.pronunciation ? { pronunciation: report.pronunciation } : {}),
        retriedCount: report.retriedCount,
        retriedAcceptedCount: report.retriedAcceptedCount,
        // Offered in full; the repository strips it unless she opted in.
        transcript: entries.map((e) => ({
          role: e.kind === "clara" ? ("clara" as const) : ("learner" as const),
          text: e.text,
          at:
            e.kind === "learner"
              ? (state.turns[e.turnIndex]?.at ?? state.startedAt)
              : state.startedAt,
        })),
      })
      // A failed local write must not take the report screen down with it.
      .catch(() => {});

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/virtual-call/report", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await authHeaders()) },
          body: JSON.stringify({
            scenarioId: report.scenarioId,
            coachLanguage: lang,
            facts: {
              learnerTurns: report.learnerTurns,
              cleanTurns: report.cleanTurns,
              durationMs: report.durationMs,
              metCriteria: report.metCriteria,
              retriedAcceptedCount: report.retriedAcceptedCount,
              vocabularyUsed: report.vocabularyUsed,
              priorities: report.priorities.map((p) => ({
                corrected: p.corrected,
                explanation: p.explanation,
              })),
            },
          }),
        });
        if (!res.ok || cancelled) return;
        const payload = (await res.json()) as { prose?: CallProse };
        if (payload.prose && !cancelled) setProse(payload.prose);
      } catch {
        // The locally-assembled report already stands on its own.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [report, state, scenario, entries, lang]);

  // Did the call stop because it ran out of time, rather than because she ended
  // it? Readable straight off the ended state; the turn ceiling is not "time up".
  const timeUp =
    state?.endedAt != null && callTimeRemainingMs(state, state.endedAt) <= 0;

  const uiState = useMemo<CallUiState>(() => {
    if (!state) return "idle";
    if (state.phase === "ended") return "ended";
    if (!online) return "offline";
    if (recording) return "listening";
    if (error) return "error";
    if (connecting) return "connecting";
    if (state.phase === "processing") return "processing";
    if (state.phase === "awaiting-retry") return "awaiting-retry";
    if (speaking) return "clara-speaking";
    const last = state.turns[state.turns.length - 1];
    if (last && !last.retry && shouldShowInline(last.correction)) return "correction";
    return "your-turn";
  }, [state, online, recording, error, connecting, speaking]);

  return {
    scenario,
    mode,
    state,
    uiState,
    entries,
    prose,
    suggestions,
    report,
    elapsedMs: state ? callDurationMs(state, now) : 0,
    remainingMs: state ? callTimeRemainingMs(state, now) : 0,
    error,
    audioFailed,
    online,
    muted,
    timeUp,
    retriedTurnIndex,
    start,
    record,
    retry,
    stopRecording,
    toggleMute,
    end,
    reset,
    resend,
    dismissError,
    replay,
  };
}
