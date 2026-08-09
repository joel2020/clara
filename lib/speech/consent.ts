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

// v2 adds automatic, turn-by-turn virtual-call capture and its stop conditions.
// A prior v1 acknowledgement did not disclose that behavior, so it cannot stand.
export const VOICE_CONSENT_VERSION = 2;

export interface VoiceConsent {
  version: number;
  at: number;
}

let published: VoiceConsent | null = null;
let prompt: (() => Promise<boolean>) | null = null;
let promptGeneration = 0;
interface PendingConsentRequest {
  generation: number;
  promise: Promise<boolean>;
  deny: () => void;
}
let pending: PendingConsentRequest | null = null;
const withdrawalListeners = new Set<() => void>();

/**
 * SettingsProvider publishes the persisted consent here whenever it changes;
 * the broker never touches React state itself (the sheet persists an accept
 * through useSettings, then resolves).
 */
export function publishVoiceConsent(c: VoiceConsent | null | undefined): void {
  const wasGranted = hasVoiceConsent();
  published = c ?? null;
  if (wasGranted && !hasVoiceConsent()) {
    const stale = pending;
    pending = null;
    stale?.deny();
    for (const listener of withdrawalListeners) listener();
  }
}

export function registerVoiceConsentWithdrawalListener(listener: () => void): () => void {
  withdrawalListeners.add(listener);
  return () => withdrawalListeners.delete(listener);
}

export function registerConsentPrompt(fn: (() => Promise<boolean>) | null): void {
  promptGeneration += 1;
  prompt = fn;
  const stale = pending;
  if (stale) {
    pending = null;
    stale.deny();
  }
}

export function hasVoiceConsent(): boolean {
  return !!published && published.version >= VOICE_CONSENT_VERSION;
}

/**
 * True when capture may proceed. Opens the sheet on first use; concurrent
 * callers share one prompt. If the UI has not registered its prompt yet,
 * capture fails closed; a later call can retry as soon as the prompt mounts.
 */
export async function ensureVoiceConsent(): Promise<boolean> {
  if (hasVoiceConsent()) return true;
  if (!prompt) return false;
  if (pending) return pending.promise;

  const requestPrompt = prompt;
  const generation = promptGeneration;
  let deny!: () => void;
  const interrupted = new Promise<boolean>((resolve) => {
    deny = () => resolve(false);
  });

  let prompted: Promise<boolean>;
  try {
    prompted = requestPrompt();
  } catch (error) {
    prompted = Promise.reject(error);
  }

  const request: PendingConsentRequest = { generation, promise: interrupted, deny };
  request.promise = Promise.race([prompted, interrupted]).finally(() => {
    if (pending === request && promptGeneration === request.generation) pending = null;
  });
  pending = request;
  return request.promise;
}
