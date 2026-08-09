import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  VOICE_CONSENT_VERSION,
  ensureVoiceConsent,
  hasVoiceConsent,
  publishVoiceConsent,
  registerConsentPrompt,
  registerVoiceConsentWithdrawalListener,
} from "./speech/consent.ts";
import * as recognition from "./speech/recognition.ts";
import * as wavRecorder from "./speech/wav-recorder.ts";
import * as callSession from "./virtual-call/session.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const consentSheet = readFileSync(join(ROOT, "components/voice-consent-sheet.tsx"), "utf8");
const examSource = readFileSync(join(ROOT, "app/exam/page.tsx"), "utf8");
const speedSource = readFileSync(join(ROOT, "components/practice/speed-round.tsx"), "utf8");
const duetSource = readFileSync(join(ROOT, "components/practice/duet-scene.tsx"), "utf8");
const settingsSource = readFileSync(join(ROOT, "app/settings/page.tsx"), "utf8");
const settingsHookSource = readFileSync(join(ROOT, "lib/hooks/useSettings.tsx"), "utf8");
let ok = 0;
let failed = 0;
const check = (actual, message) => {
  if (actual) ok += 1;
  else {
    failed += 1;
    console.error(`FAIL ${message}`);
  }
};
const TIMED_OUT = Symbol("timed out");
const settleWithin = async (promise) => {
  let timeout;
  const result = await Promise.race([
    promise,
    new Promise((resolve) => {
      timeout = setTimeout(() => resolve(TIMED_OUT), 25);
    }),
  ]);
  clearTimeout(timeout);
  return result;
};

check(VOICE_CONSENT_VERSION === 2, "automatic-capture disclosure increments the consent version to 2");
publishVoiceConsent({ version: 1, at: Date.now() });
check(!hasVoiceConsent(), "a v1 consent is invalidated and re-prompts before capture");
publishVoiceConsent({ version: 2, at: Date.now() });
check(hasVoiceConsent(), "a v2 consent permits capture");
let withdrawalNotifications = 0;
const stopListening = registerVoiceConsentWithdrawalListener(() => { withdrawalNotifications += 1; });
publishVoiceConsent(null);
check(withdrawalNotifications === 1 && !hasVoiceConsent(), "withdrawal is published synchronously so active capture can be cancelled and future capture fails closed");
stopListening();
check(settingsSource.includes("Retirar permiso de voz · Withdraw voice permission") && settingsSource.includes('aria-labelledby="voice-privacy-title"'), "settings exposes an accessible bilingual consent-withdrawal control");
check(settingsHookSource.indexOf("publishVoiceConsent(null)") < settingsHookSource.indexOf("persistPatch({ voiceConsent: null })"), "withdrawal blocks and cancels capture before its durable retry is queued");

registerConsentPrompt(null);
const missingPromptDecision = await ensureVoiceConsent();
check(
  missingPromptDecision === false,
  "capture fails closed while the consent prompt is not registered",
);
let missingPromptError;
if (missingPromptDecision === false) {
  try {
    await recognition.createRecognition().result;
  } catch (error) {
    missingPromptError = error;
  }
}
check(
  missingPromptError instanceof recognition.RecognitionError && missingPromptError.code === "consent",
  "recognition rejects with consent denial before attempting microphone capture when the prompt is absent",
);

let promptCalls = 0;
let settlePrompt;
registerConsentPrompt(() => {
  promptCalls += 1;
  return new Promise((resolve) => {
    settlePrompt = resolve;
  });
});
const firstPrompt = ensureVoiceConsent();
const concurrentPrompt = ensureVoiceConsent();
settlePrompt(true);
const promptResults = await Promise.all([firstPrompt, concurrentPrompt]);
check(
  promptCalls === 1 && promptResults.every((result) => result === true),
  "registering the prompt after an early denial restores one shared consent request for concurrent callers",
);
registerConsentPrompt(null);

let settleUnmountedPrompt;
registerConsentPrompt(
  () =>
    new Promise((resolve) => {
      settleUnmountedPrompt = resolve;
    }),
);
const unmountedRequest = ensureVoiceConsent();
registerConsentPrompt(null);
const unmountedResult = await settleWithin(unmountedRequest);
check(
  unmountedResult === false,
  "unregistering the consent sheet denies its active request instead of leaving capture pending",
);

let remountedPromptCalls = 0;
registerConsentPrompt(() => {
  remountedPromptCalls += 1;
  return Promise.resolve(true);
});
const remountedRequest = ensureVoiceConsent();
const remountedResult = await settleWithin(remountedRequest);
check(
  remountedPromptCalls === 1 && remountedResult === true,
  "a prompt mounted after an interrupted request can serve the next capture attempt",
);
settleUnmountedPrompt(false);
await Promise.allSettled([unmountedRequest, remountedRequest]);
registerConsentPrompt(null);

let settleReplacedPrompt;
registerConsentPrompt(
  () =>
    new Promise((resolve) => {
      settleReplacedPrompt = resolve;
    }),
);
const replacedRequest = ensureVoiceConsent();
let replacementPromptCalls = 0;
registerConsentPrompt(() => {
  replacementPromptCalls += 1;
  return Promise.resolve(true);
});
const replacedResult = await settleWithin(replacedRequest);
const replacementRequest = ensureVoiceConsent();
const replacementResult = await settleWithin(replacementRequest);
check(
  replacedResult === false,
  "replacing a consent prompt denies the request owned by the stale prompt generation",
);
check(
  replacementPromptCalls === 1 && replacementResult === true,
  "the replacement prompt receives the next capture attempt without reusing stale pending state",
);
settleReplacedPrompt(true);
await Promise.allSettled([replacedRequest, replacementRequest]);
registerConsentPrompt(null);

check(
  consentSheet.includes("Depending on your browser and configuration") &&
    consentSheet.includes("Microsoft Azure Speech") &&
    consentSheet.includes("ElevenLabs") &&
    consentSheet.includes("Google Chrome") &&
    consentSheet.includes("OpenAI"),
  "consent names browser-dependent Microsoft, ElevenLabs, Google, and OpenAI processing",
);
check(
  /Pronunciation scoring occurs\s+when Azure is configured/.test(consentSheet) &&
    /La calificación de pronunciación ocurre\s+cuando Azure está configurado/.test(consentSheet) &&
    !consentSheet.includes("transcription and scoring") &&
    !consentSheet.includes("transcribirlo y calificarlo"),
  "consent limits pronunciation scoring to configured Azure rather than every transcription service",
);

const exerciseCapture = recognition.recognitionCapturePolicy?.();
check(exerciseCapture?.maxDurationMs === recognition.SHORT_CAPTURE_MS && !exerciseCapture?.endOnSilence, "short exercises retain seven-second manual capture");
const virtualCallCapture = recognition.recognitionCapturePolicy?.({ autoEnd: true, maxDurationMs: recognition.VIRTUAL_CALL_CAPTURE_MS });
check(virtualCallCapture?.maxDurationMs === 30_000 && virtualCallCapture?.endOnSilence, "virtual calls select a 30-second capture that ends on silence");

let speechEnds = 0;
const automaticWav = recognition.wavRecordingOptions?.({
  autoEnd: true,
  maxDurationMs: recognition.VIRTUAL_CALL_CAPTURE_MS,
  onSpeechEnd: () => { speechEnds += 1; },
});
automaticWav?.onSpeechEnd?.();
check(automaticWav?.maxDurationMs === 30_000 && speechEnds === 1, "automatic cloud/Azure recording forwards 30 seconds and stops on speech end");
const manualWav = recognition.wavRecordingOptions?.({
  autoEnd: false,
  maxDurationMs: recognition.SHORT_CAPTURE_MS,
  onSpeechEnd: () => { speechEnds += 1; },
});
check(manualWav?.maxDurationMs === 7_000 && manualWav.onSpeechEnd === undefined, "manual exercise recording keeps its short cap without silence handoff");
check(wavRecorder.wavRecordingDurationMs?.({ maxDurationMs: 30_000 }) === 30_000, "the WAV recorder preserves a virtual-call duration rather than its default cap");

check(recognition.isTechnicalRecognitionError?.(new recognition.RecognitionError("technical-skip", "retry")) === true, "provider technical skips retain an explicit recognition status");
check(recognition.isTechnicalRecognitionError?.(new recognition.RecognitionError("no-speech", "retry")) === false, "a learner no-speech capture remains distinct from provider failure");
const noMatchError = recognition.assessmentRecognitionError?.({
  provider: "azure",
  providerStatus: "valid",
  recognitionReason: "no-match",
  recognizedText: "",
  words: [],
});
check(noMatchError?.code === "no-speech" && !recognition.isTechnicalRecognitionError?.(noMatchError), "Azure no-match maps to learner no-speech, not infrastructure failure");
const outageError = recognition.assessmentRecognitionError?.({
  provider: "azure",
  providerStatus: "technical-skip",
  recognizedText: "",
  words: [],
});
check(outageError?.code === "technical-skip" && recognition.isTechnicalRecognitionError?.(outageError), "malformed/provider outage remains a technical skip");
check(examSource.includes("interpretCaptureFailure("), "exam distinguishes provider failures from its learner-zero path");
check(speedSource.includes("isTechnicalRecognitionError(e)"), "speed round does not advance a provider failure as a miss");
check(duetSource.includes("isTechnicalRecognitionError(e)"), "duet does not render a provider failure as a learner miss");

check(callSession.shouldCancelCaptureOnMute?.(false) === true, "entering mute cancels an active capture");
check(callSession.shouldCancelCaptureOnMute?.(true) === false, "unmuting preserves an active capture");

console.log(`${ok} ok`);
process.exit(failed ? 1 : 0);
