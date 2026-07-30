"use client";

import { useCallback, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, VolumeX, WifiOff } from "lucide-react";
import { Splash } from "@/components/splash";
import { getVirtualCallScenario, type VirtualCallScenario } from "@/lib/content/virtual-call-scenarios";
import { useSettings } from "@/lib/hooks/useSettings";
import { useSpeechSupport } from "@/lib/hooks/useSpeechSupport";
import { t } from "@/lib/i18n";
import type { CorrectionMode } from "@/lib/virtual-call/session";
import { CallControls } from "./call-controls";
import { CallHeader } from "./call-header";
import { CallReportView } from "./call-report";
import { CallStatus } from "./call-status";
import { ClaraStage } from "./clara-stage";
import { ScenarioPicker } from "./scenario-picker";
import { Transcript } from "./transcript";
import { RetryOutcomeNote, RetryPrompt } from "./retry-prompt";
import { useVirtualCall } from "./use-virtual-call";

// Three screens behind one route: pick a situation, hold the call, read the
// report. The controller (./use-virtual-call.ts) owns every transition; this
// component only decides which of the three is on screen and hands each piece
// the props it needs.

export function VirtualCallScreen() {
  const searchParams = useSearchParams();
  const { settings, ready } = useSettings();
  const support = useSpeechSupport();
  const lang = settings.coachLanguage;
  const level = settings.onboarding?.level ?? "A1";
  const transcriptEnabled = (settings.callTranscriptRetention ?? "session") !== "none";

  const call = useVirtualCall({ lang, level, studentName: settings.studentName ?? "" });
  const { start, scenario, state, report, reset } = call;

  // Her saved preference is the mode until she picks another one for this call.
  // Derived rather than copied into state by an effect, so a settings change in
  // another tab cannot leave a stale mode selected here.
  const [modeOverride, setModeOverride] = useState<CorrectionMode | null>(null);
  const mode = modeOverride ?? settings.callCorrectionMode ?? "natural";

  // Deep link: /virtual-call?scenario=job-interview opens the picker with that
  // situation first and highlighted — it does not dial by itself, because a URL
  // should never turn on someone's microphone. useSearchParams is why this tree
  // needs a Suspense boundary; see app/virtual-call/page.tsx.
  const highlightId = searchParams.get("scenario");
  const highlighted = highlightId ? getVirtualCallScenario(highlightId) : undefined;

  const onStart = useCallback((next: VirtualCallScenario) => start(next, mode), [start, mode]);

  if (!ready || support === null) return <Splash />;

  const micSupported = support.recognition;

  // ── Report ────────────────────────────────────────────────────────────────
  if (report && scenario) {
    return (
      <CallReportView
        report={report}
        scenario={scenario}
        lang={lang}
        conversation={transcriptEnabled ? call.entries : undefined}
        timeUp={call.timeUp}
        onReplay={call.replay}
        onAnother={reset}
        homeHref="/"
      />
    );
  }

  // ── Picker ────────────────────────────────────────────────────────────────
  if (!state || !scenario) {
    const notice = !micSupported
      ? t("vcallMicUnsupported", lang)
      : !call.online
        ? t("vcallOfflineBody", lang)
        : undefined;
    return (
      <div className="min-h-[100dvh]">
        <div className="mx-auto w-full max-w-2xl px-4 pt-6 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t("backHome", lang)}
          </Link>
        </div>
        <ScenarioPicker
          level={level}
          lang={lang}
          mode={mode}
          onModeChange={setModeOverride}
          onStart={onStart}
          disabled={!micSupported || !call.online}
          notice={notice}
          highlightId={highlighted?.id}
        />
      </div>
    );
  }

  // ── Live call ─────────────────────────────────────────────────────────────
  if (state.phase === "ended") {
    // The report is assembled synchronously the moment the call ends; this is
    // the single frame in between.
    return (
      <div role="status" className="grid min-h-[60vh] place-items-center px-4 text-sm text-muted-foreground">
        {t("vcallReportBuilding", lang)}
      </div>
    );
  }

  const retriedTurn = call.retriedTurnIndex === null ? undefined : state.turns[call.retriedTurnIndex];
  const pendingRetry = state.pendingRetry;
  const speakDisabled =
    !micSupported ||
    !call.online ||
    call.uiState === "processing" ||
    call.uiState === "connecting" ||
    call.error?.kind === "turn" ||
    pendingRetry !== null;

  return (
    // A call screen does not scroll as a page: it fills what is left below the
    // app header (3px flag bar + h-16 bar) and scrolls only the conversation.
    // That is what keeps the AI disclosure, the call state, and the controls on
    // screen for the whole call instead of scrolling away mid-conversation.
    <div className="mx-auto flex h-[calc(100dvh-4rem-3px)] w-full max-w-2xl flex-col px-4 sm:px-6">
      <div className="shrink-0 pt-4">
        <CallHeader
          scenario={scenario}
          mode={state.mode}
          lang={lang}
          elapsedMs={call.elapsedMs}
          remainingMs={call.remainingMs}
        />

        {/* Clara sits beside the status line, not above the conversation: the
            instruction is the status text and the transcript, and the artwork is
            the smaller of the two by design. */}
        <div className="flex items-center gap-3 py-3">
          <ClaraStage uiState={call.uiState} lang={lang} />
          <CallStatus uiState={call.uiState} lang={lang} className="flex-1" />
        </div>
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto py-4">
        <Transcript entries={call.entries} state={state} lang={lang} onReplay={call.replay} />
      </div>

      <div className="shrink-0 space-y-2.5 border-t border-hairline py-3">
        {!call.online && (
          <Banner tone="muted" icon={<WifiOff className="size-4 shrink-0" aria-hidden />}>
            {t("vcallOfflineBody", lang)}
          </Banner>
        )}

        {call.error && (
          <Banner tone="error" icon={<AlertTriangle className="size-4 shrink-0" aria-hidden />}>
            <span className="min-w-0 break-words">{call.error.message}</span>
            {/* A failed turn offers only "try again": dismissing it would leave
                her sentence on screen with nothing behind it. A mic error is
                dismissible, because the next recording clears it anyway. */}
            {call.error.kind === "turn" ? (
              <button
                type="button"
                onClick={call.resend}
                className="shrink-0 rounded-full border border-current px-3 py-1.5 text-xs font-semibold"
              >
                {t("vcallTryAgain", lang)}
              </button>
            ) : (
              <button
                type="button"
                onClick={call.dismissError}
                className="shrink-0 rounded-full px-2 py-1.5 text-xs font-semibold underline underline-offset-2"
              >
                {t("vcallDismiss", lang)}
              </button>
            )}
          </Banner>
        )}

        {call.audioFailed && (
          <Banner tone="muted" icon={<VolumeX className="size-4 shrink-0" aria-hidden />}>
            {t("vcallAudioFailed", lang)}
          </Banner>
        )}

        {call.muted && <p className="text-xs text-muted-foreground">{t("vcallMutedNote", lang)}</p>}

        {pendingRetry && (
          <RetryPrompt
            correction={pendingRetry}
            lang={lang}
            recording={call.uiState === "listening"}
            disabled={!micSupported || !call.online}
            onRecord={call.retry}
            onStop={call.stopRecording}
            onListen={() => call.replay(pendingRetry.corrected)}
          />
        )}

        {!pendingRetry && retriedTurn?.retry && <RetryOutcomeNote outcome={retriedTurn.retry} lang={lang} />}

        {!pendingRetry && call.suggestions.length > 0 && call.uiState === "your-turn" && (
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("vcallSuggestions", lang)}
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {call.suggestions.map((phrase) => (
                <li
                  key={phrase}
                  lang="en"
                  className="rounded-full border border-hairline bg-card px-3 py-1.5 text-sm text-muted-foreground"
                >
                  {phrase}
                </li>
              ))}
            </ul>
          </div>
        )}

        <CallControls
          lang={lang}
          recording={call.uiState === "listening"}
          muted={call.muted}
          speakDisabled={speakDisabled}
          onRecord={call.record}
          onStop={call.stopRecording}
          onToggleMute={call.toggleMute}
          onEnd={call.end}
        />
      </div>
    </div>
  );
}

function Banner({
  tone,
  icon,
  children,
}: {
  tone: "error" | "muted";
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        tone === "error"
          ? "flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/50 bg-destructive/[0.08] px-3 py-2 text-sm text-destructive"
          : "flex items-start gap-2 rounded-xl border border-hairline bg-secondary px-3 py-2 text-sm text-muted-foreground"
      }
    >
      {icon}
      {children}
    </div>
  );
}
