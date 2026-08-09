"use client";

import { speak, cancelSpeech } from "./synthesis";
import { audioKey, audioUrl } from "./audio-key";
import { AUDIO_KEYS, ALT_VOICES } from "@/lib/content/audio-manifest";

// Unified pronunciation playback. Joel's recorded voice is the primary model;
// supporting voices (see ALT_VOICES) add listening variety in drills and via
// the Mix button. Browser SpeechSynthesis is the last-resort fallback for
// custom words with no recording.

const HAVE = new Set(AUDIO_KEYS);

let currentAudio: HTMLAudioElement | null = null;
let playbackGeneration = 0;

export function hasRecordedVoice(itemId?: string): boolean {
  return !!itemId && HAVE.has(audioKey(itemId));
}

export interface VoiceInfo {
  slug: string;
  name: string;
}

export const PRIMARY_VOICE: VoiceInfo = { slug: "joel", name: "Joel" };

/** All available recorded voices, primary first. */
export function allVoices(): VoiceInfo[] {
  return [PRIMARY_VOICE, ...ALT_VOICES];
}

/** A random supporting voice (never Joel). Falls back to Joel if none exist. */
export function pickAltVoice(exclude?: string): VoiceInfo {
  const pool = ALT_VOICES.filter((v) => v.slug !== exclude);
  if (!pool.length) return PRIMARY_VOICE;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Voice for a drill round: mainly Joel (the primary model she's learning from),
 * with the supporting American cast mixed in about a third of the time so her
 * ear still generalizes beyond one speaker without losing the familiar anchor.
 */
export function pickDrillVoice(joelWeight = 0.7): VoiceInfo {
  if (!ALT_VOICES.length || Math.random() < joelWeight) return PRIMARY_VOICE;
  return pickAltVoice();
}

export interface PlayOptions {
  id?: string;
  text: string;
  slow?: boolean;
  /** Voice slug to play ("joel" default). Ignored when no recording exists. */
  voice?: string;
  rate?: number; // fallback SpeechSynthesis rate at normal speed
  voiceURI?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
}

export function playPronunciation(opts: PlayOptions): void {
  stopPronunciation();
  const generation = playbackGeneration;
  const { id, text, slow, voice, rate, voiceURI, onStart, onEnd, onError } = opts;
  let terminal = false;

  const isActive = () => generation === playbackGeneration;
  const finish = (state: "end" | "error") => {
    if (!isActive() || terminal) return;
    terminal = true;
    if (state === "end") onEnd?.();
    else onError?.();
  };

  if (hasRecordedVoice(id)) {
    playFile(audioUrl(id!, voice), () => {
      // Alt clip missing/failed — retry with Joel's primary clip before TTS.
      if (voice && voice !== "joel") playFile(audioUrl(id!), fallback);
      else fallback();
    });
    return;
  }

  fallback();

  function playFile(url: string, handleError: () => void) {
    if (!isActive() || terminal) return;
    const audio = new Audio(url);
    let settled = false;
    audio.playbackRate = slow ? 0.65 : 1;
    currentAudio = audio;
    audio.onplay = () => {
      if (isActive() && !terminal && !settled) onStart?.();
    };
    audio.onended = () => {
      if (!isActive() || terminal || settled) return;
      settled = true;
      if (currentAudio === audio) currentAudio = null;
      finish("end");
    };
    const fail = () => {
      if (!isActive() || terminal || settled) return;
      settled = true;
      if (currentAudio === audio) currentAudio = null;
      handleError();
    };
    audio.onerror = fail;
    audio.play().catch(fail);
  }

  function fallback() {
    if (!isActive() || terminal) return;
    speak(text, {
      rate: slow ? 0.55 : rate ?? 0.9,
      voiceURI,
      onStart: () => {
        if (isActive() && !terminal) onStart?.();
      },
      onEnd: () => finish("end"),
      onError: () => finish("error"),
    });
  }
}

export function stopPronunciation(): void {
  playbackGeneration += 1;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  cancelSpeech();
}
