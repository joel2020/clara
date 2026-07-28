"use client";

// Voice-capture consent (audit P0: the app recorded a learner's voice and sent
// it to third-party processors with no disclosure or consent moment).
//
// The contract:
//   • The FIRST time any surface is about to capture the microphone,
//     `ensureVoiceConsent` opens the consent sheet and waits.
//   • Accepting stores {version, at} in Settings — per account, per device
//     (settings live in the account-scoped database) — so the sheet never
//     interrupts again unless the consent VERSION is raised.
//   • Declining blocks voice capture only; every no-mic surface keeps working.
//
// This module is a broker, not UI: SettingsProvider publishes the persisted
// value and VoiceConsentSheet registers the prompt, so the single chokepoint
// for capture (lib/speech/recognition.ts) can gate without knowing React.

export const VOICE_CONSENT_VERSION = 1;

export interface VoiceConsent {
  version: number;
  at: number;
}

let published: VoiceConsent | null = null;
let prompt: (() => Promise<boolean>) | null = null;
let pending: Promise<boolean> | null = null;

/**
 * SettingsProvider publishes the persisted consent here whenever it changes;
 * the broker never touches React state itself (the sheet persists an accept
 * through useSettings, then resolves).
 */
export function publishVoiceConsent(c: VoiceConsent | null | undefined): void {
  published = c ?? null;
}

export function registerConsentPrompt(fn: (() => Promise<boolean>) | null): void {
  prompt = fn;
}

export function hasVoiceConsent(): boolean {
  return !!published && published.version >= VOICE_CONSENT_VERSION;
}

/**
 * True when capture may proceed. Opens the sheet on first use; concurrent
 * callers share one prompt. With no UI registered (tests, non-React callers)
 * capture proceeds — the sheet is mounted app-wide in the layout, so inside
 * the real app this fallback is unreachable.
 */
export async function ensureVoiceConsent(): Promise<boolean> {
  if (hasVoiceConsent()) return true;
  if (!prompt) return true;
  if (!pending) {
    pending = prompt().finally(() => {
      pending = null;
    });
  }
  return pending;
}
