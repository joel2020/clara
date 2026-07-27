"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Play, Pause, SkipBack, SkipForward, Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/lib/hooks/useSettings";
import { useAllProgress } from "@/lib/hooks/useData";
import { LESSONS, ITEM_BY_ID } from "@/lib/content/lessons";
import { meaningFor } from "@/lib/content/word-es";
import { hasRecordedVoice } from "@/lib/speech/player";
import { audioUrl } from "@/lib/speech/audio-key";
import { hasEsMeaningClip, esMeaningUrl } from "@/lib/speech/es-audio";
import { isMastered } from "@/lib/srs";
import { weakness } from "@/lib/weak-items";
import { t } from "@/lib/i18n";
import { JoelAvatar } from "@/components/joel-avatar";
import { Splash } from "@/components/splash";
import type { PracticeItem, ItemProgress } from "@/lib/db/types";

// Radio de Joel — passive listening. Joel says the phrase, the Spanish meaning
// is spoken (SpeechSynthesis), then Joel says it once more, then the next item.
// Weak items lead, mastered ones follow for confidence; brand-new students get
// the first conversation units so the radio works on day one. One reused
// <audio> element keeps iOS Safari happy with chained autoplay.

const MAX_ITEMS = 40;
const GAP_MS = 900;

function buildPlaylist(progress: ItemProgress[]): PracticeItem[] {
  const practiced = progress
    .filter((p) => p.attempts > 0 && ITEM_BY_ID.has(p.itemId) && hasRecordedVoice(p.itemId))
    .sort((a, b) => playlistWeight(a) - playlistWeight(b))
    .map((p) => ITEM_BY_ID.get(p.itemId)!);
  if (practiced.length >= 8) return practiced.slice(0, MAX_ITEMS);
  // Day-one fallback: pad with the first conversation units, in course order.
  const pad = LESSONS.filter((l) => l.track === "conversation")
    .flatMap((l) => l.items)
    .filter((i) => hasRecordedVoice(i.id) && !practiced.some((p) => p.id === i.id));
  return [...practiced, ...pad].slice(0, MAX_ITEMS);
}

// Same weakness ranking the AI partner uses, plus a bump that sends mastered
// items to the back of the playlist. Shared so the "pass"/"fail" handling can
// only ever be wrong in one place.
function playlistWeight(p: ItemProgress): number {
  return (isMastered(p) ? 100 : 0) + weakness(p);
}

/**
 * Best available Spanish voice for the meaning line. iOS loads voices
 * asynchronously, so the list is cached and refreshed on `voiceschanged`.
 */
let voiceCache: SpeechSynthesisVoice[] = [];
function spanishVoice(): SpeechSynthesisVoice | null {
  if (!voiceCache.length) voiceCache = window.speechSynthesis?.getVoices() ?? [];
  return voiceCache.find((v) => v.lang.startsWith("es-CO")) ?? voiceCache.find((v) => v.lang.startsWith("es")) ?? null;
}

export default function RadioPage() {
  const { settings, ready } = useSettings();
  const lang = settings.coachLanguage;
  const progress = useAllProgress();

  const playlist = useMemo(() => (progress ? buildPlaylist(progress) : []), [progress]);

  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speakMeaning, setSpeakMeaning] = useState(true);
  const [joelSpeaking, setJoelSpeaking] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // step within the current item: 0 = say it, 1 = meaning, 2 = say it again
  const stepRef = useRef(0);
  const playingRef = useRef(false);
  const idxRef = useRef(0);

  const current = playlist[idx];
  const meaning = current ? meaningFor(current.text, current.meaning) : undefined;

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);
  useEffect(() => {
    idxRef.current = idx;
  }, [idx]);

  // Build the single reusable audio element once, and keep the iOS voice list
  // warm (it loads asynchronously and getVoices() is empty until then).
  useEffect(() => {
    const el = new Audio();
    el.preload = "auto";
    audioRef.current = el;
    const refresh = () => {
      voiceCache = window.speechSynthesis?.getVoices() ?? [];
    };
    refresh();
    window.speechSynthesis?.addEventListener("voiceschanged", refresh);
    return () => {
      el.pause();
      if (timerRef.current) clearTimeout(timerRef.current);
      window.speechSynthesis?.cancel();
      window.speechSynthesis?.removeEventListener("voiceschanged", refresh);
      wakeLockRef.current?.release().catch(() => {});
    };
  }, []);

  // Keep the screen awake while the radio plays (iOS 16.4+); reacquire when
  // she returns to the tab, since iOS releases the lock on hide.
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  useEffect(() => {
    const acquire = async () => {
      try {
        if (playing && "wakeLock" in navigator && document.visibilityState === "visible") {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
        }
      } catch {
        /* unsupported or denied — the radio still works with the screen on */
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && playingRef.current) void acquire();
    };
    if (playing) void acquire();
    else wakeLockRef.current?.release().catch(() => {});
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [playing]);

  const stopAll = () => {
    audioRef.current?.pause();
    window.speechSynthesis?.cancel();
    if (timerRef.current) clearTimeout(timerRef.current);
    setJoelSpeaking(false);
  };

  const advance = (dir: 1 | -1 = 1) => {
    stepRef.current = 0;
    setIdx((i) => (i + dir + playlist.length) % playlist.length);
  };

  // The little state machine: Joel clip → (Spanish meaning) → Joel clip → next.
  const runStep = () => {
    if (!playingRef.current) return;
    const item = playlist[idxRef.current];
    if (!item || !audioRef.current) return;
    const el = audioRef.current;
    const step = stepRef.current;

    if (step === 0 || step === 2) {
      el.src = audioUrl(item.id);
      setJoelSpeaking(true);
      el.onended = () => {
        setJoelSpeaking(false);
        stepRef.current = step === 0 ? 1 : 3;
        timerRef.current = setTimeout(runStep, step === 0 ? 350 : GAP_MS);
      };
      el.onerror = () => {
        setJoelSpeaking(false);
        stepRef.current = 3;
        timerRef.current = setTimeout(runStep, 300);
      };
      void el.play().catch(() => setPlaying(false));
      return;
    }

    if (step === 1) {
      // Prefer the pre-generated "Lisa" clip: studio quality, and it rides the
      // same <audio> element so the iOS playback chain never breaks.
      if (speakMeaning && hasEsMeaningClip(item.id)) {
        el.src = esMeaningUrl(item.id);
        el.onended = () => {
          stepRef.current = 2;
          timerRef.current = setTimeout(runStep, 350);
        };
        el.onerror = () => {
          stepRef.current = 2;
          timerRef.current = setTimeout(runStep, 200);
        };
        void el.play().catch(() => setPlaying(false));
        return;
      }
      const m = meaningFor(item.text, item.meaning);
      if (speakMeaning && m && typeof window !== "undefined" && window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(m);
        const v = spanishVoice();
        if (v) u.voice = v;
        u.lang = v?.lang ?? "es-ES";
        u.rate = 0.95;
        u.onend = () => {
          stepRef.current = 2;
          timerRef.current = setTimeout(runStep, 350);
        };
        u.onerror = () => {
          stepRef.current = 2;
          timerRef.current = setTimeout(runStep, 200);
        };
        window.speechSynthesis.speak(u);
      } else {
        stepRef.current = 2;
        timerRef.current = setTimeout(runStep, 500);
      }
      return;
    }

    // step 3 — item finished; move on.
    advance(1);
    timerRef.current = setTimeout(runStep, 250);
  };

  const toggle = () => {
    if (playing) {
      setPlaying(false);
      playingRef.current = false;
      stopAll();
    } else {
      // iOS requires speech synthesis to be unlocked inside a user gesture —
      // speak a silent utterance now so the Spanish meanings aren't muted.
      if (window.speechSynthesis) {
        const unlock = new SpeechSynthesisUtterance("");
        unlock.volume = 0;
        window.speechSynthesis.speak(unlock);
      }
      setPlaying(true);
      playingRef.current = true;
      stepRef.current = 0;
      runStep();
    }
  };

  // Lock-screen / control-center transport (Media Session), like a music app.
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    if (current) {
      ms.metadata = new MediaMetadata({
        title: current.text,
        artist: "Radio de Joel — Clara",
        artwork: [{ src: "/icon-512.png", sizes: "512x512", type: "image/png" }],
      });
    }
    ms.setActionHandler("play", () => {
      if (!playingRef.current) toggle();
    });
    ms.setActionHandler("pause", () => {
      if (playingRef.current) toggle();
    });
    ms.setActionHandler("nexttrack", () => skip(1));
    ms.setActionHandler("previoustrack", () => skip(-1));
    return () => {
      ms.setActionHandler("play", null);
      ms.setActionHandler("pause", null);
      ms.setActionHandler("nexttrack", null);
      ms.setActionHandler("previoustrack", null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const skip = (dir: 1 | -1) => {
    stopAll();
    advance(dir);
    if (playingRef.current) timerRef.current = setTimeout(runStep, 200);
  };

  if (!ready || progress === undefined) return <Splash />;

  return (
    <div className="mx-auto max-w-xl px-5 pb-28 pt-6 sm:px-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" />
        {t("navHome", lang)}
      </Link>

      <header className="mt-5 animate-fade-up">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">{t("radioTitle", lang)}</p>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{t("radioIntro", lang)}</p>
      </header>

      {/* Now playing */}
      <section className="elev-1 mt-6 rounded-3xl border border-hairline bg-card p-6 text-center">
        <div className="mx-auto w-fit">
          <JoelAvatar speaking={joelSpeaking} className="size-16" />
        </div>
        {current ? (
          <>
            <p className="mt-5 font-display text-3xl font-medium leading-tight tracking-[-0.02em]">{current.text}</p>
            <p className="mt-2 font-mono text-sm text-muted-foreground">{current.ipa}</p>
            {meaning && <p className="mt-2 text-base italic text-primary/90">{meaning}</p>}
            <p className="mt-4 font-mono text-xs tabular-nums text-muted-foreground">
              {idx + 1} {t("radioOf", lang)} {playlist.length}
            </p>
          </>
        ) : (
          <p className="mt-5 text-muted-foreground">{t("mundoEmpty", lang)}</p>
        )}

        {/* Transport */}
        <div className="mt-6 flex items-center justify-center gap-5">
          <button
            type="button"
            onClick={() => skip(-1)}
            aria-label="previous"
            className="grid size-12 place-items-center rounded-full border border-hairline text-foreground/70 transition-all hover:border-primary/40 active:scale-95"
          >
            <SkipBack className="size-5" />
          </button>
          <button
            type="button"
            onClick={toggle}
            disabled={!current}
            aria-label={playing ? t("radioPause", lang) : t("radioPlay", lang)}
            className="grid size-20 place-items-center rounded-full bg-foreground text-background shadow-md transition-all hover:scale-[1.04] active:scale-95 disabled:opacity-30"
          >
            {playing ? <Pause className="size-8" style={{ fill: "currentColor" }} /> : <Play className="ml-1 size-8" style={{ fill: "currentColor" }} />}
          </button>
          <button
            type="button"
            onClick={() => skip(1)}
            aria-label="next"
            className="grid size-12 place-items-center rounded-full border border-hairline text-foreground/70 transition-all hover:border-primary/40 active:scale-95"
          >
            <SkipForward className="size-5" />
          </button>
        </div>
      </section>

      {/* Options */}
      <section className="mt-4 flex items-center justify-between rounded-2xl border border-hairline bg-card px-5 py-3.5">
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <Languages className="size-4 text-primary" />
          {t("radioSayMeaning", lang)}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={speakMeaning}
          onClick={() => setSpeakMeaning((v) => !v)}
          className={cn("relative h-7 w-12 rounded-full transition-colors", speakMeaning ? "bg-primary" : "bg-muted-foreground/30")}
        >
          <span className={cn("absolute top-0.5 size-6 rounded-full bg-white shadow-sm transition-all", speakMeaning ? "left-[calc(100%-26px)]" : "left-0.5")} />
        </button>
      </section>
    </div>
  );
}
