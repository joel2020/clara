import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const repoMocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
  saveSettingsForPracticeBinding: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  repo: {
    getSettings: repoMocks.getSettings,
    saveSettings: repoMocks.saveSettings,
    capturePracticeBinding: vi.fn(() => ({ account: "local" })),
    saveSettingsForPracticeBinding: repoMocks.saveSettingsForPracticeBinding,
  },
}));
vi.mock("@/lib/sfx", () => ({ setSfxEnabled: vi.fn() }));
vi.mock("@/lib/sync/outbox", () => ({ flushOutbox: vi.fn() }));
vi.mock("@/lib/sync/restore", () => ({ hydrateFromCloud: vi.fn(), restoreProfile: vi.fn() }));
vi.mock("@/lib/sync/durability", () => ({
  recalledSyncCode: vi.fn(() => null),
  rememberSyncCode: vi.fn(),
  requestPersistentStorage: vi.fn(),
}));

import { SettingsProvider, useSettings } from "@/lib/hooks/useSettings";
import { DEFAULT_SETTINGS } from "@/lib/db/repository";
import { VoiceConsentSheet } from "@/components/voice-consent-sheet";
import {
  ensureVoiceConsent,
  hasVoiceConsent,
  publishVoiceConsent,
  registerConsentPrompt,
  registerVoiceConsentWithdrawalListener,
} from "@/lib/speech/consent";

function ConsentCaptureProbe({ onCapture }: { onCapture: (capture: Promise<boolean>) => void }) {
  const { ready } = useSettings();
  return (
    <>
      <button type="button" disabled={!ready} onClick={() => onCapture(ensureVoiceConsent())}>
        Start microphone
      </button>
      <VoiceConsentSheet />
    </>
  );
}

function HonestSettingsProbe() {
  const { settings, ready, update, saveError, retryLastUpdate } = useSettings();
  return <>
    <output aria-label="daily goal">{settings.dailyGoal}</output>
    <button type="button" disabled={!ready} onClick={() => void update({ dailyGoal: 60 })}>Save 60</button>
    {saveError && <p role="alert">{saveError}</p>}
    <button type="button" onClick={() => void retryLastUpdate()}>Retry settings</button>
  </>;
}

function WithdrawalProbe() {
  const { ready, revokeVoiceConsent } = useSettings();
  return <button type="button" disabled={!ready} onClick={() => void revokeVoiceConsent()}>Withdraw now</button>;
}

beforeEach(() => {
  publishVoiceConsent(null);
  registerConsentPrompt(null);
  repoMocks.getSettings.mockReset();
  repoMocks.saveSettings.mockReset();
  repoMocks.saveSettingsForPracticeBinding.mockReset();
  repoMocks.getSettings.mockResolvedValue({ ...DEFAULT_SETTINGS, voiceConsent: undefined });
});

afterEach(() => {
  registerConsentPrompt(null);
  publishVoiceConsent(null);
});

it("publishes voice consent only after durable persistence and keeps a failed capture retryable", async () => {
  let originalCapture!: Promise<boolean>;
  let originalSettled = false;

  repoMocks.saveSettingsForPracticeBinding.mockRejectedValueOnce(new Error("storage offline"));
  render(
    <SettingsProvider>
      <ConsentCaptureProbe
        onCapture={(capture) => {
          originalCapture = capture;
          void capture.then(() => { originalSettled = true; });
        }}
      />
    </SettingsProvider>,
  );

  const opener = screen.getByRole("button", { name: "Start microphone" });
  await waitFor(() => expect(opener.getAttribute("disabled")).toBeNull());
  fireEvent.click(opener);
  fireEvent.click(await screen.findByRole("button", { name: /Aceptar y hablar/ }));

  await screen.findByRole("alert");
  expect(repoMocks.saveSettingsForPracticeBinding).toHaveBeenCalledTimes(1);
  expect(hasVoiceConsent()).toBe(false);
  expect(originalSettled).toBe(false);

  const retriedCapture = ensureVoiceConsent();
  let retrySettled = false;
  void retriedCapture.then(() => { retrySettled = true; });
  expect(retrySettled).toBe(false);

  repoMocks.saveSettingsForPracticeBinding.mockResolvedValueOnce(undefined);
  fireEvent.click(screen.getByRole("button", { name: /Aceptar y hablar/ }));

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(repoMocks.saveSettingsForPracticeBinding).toHaveBeenCalledTimes(2);
  expect(hasVoiceConsent()).toBe(true);
  await expect(originalCapture).resolves.toBe(true);
  await expect(retriedCapture).resolves.toBe(true);
});

it("does not paint a preference as saved until its local account-bound commit succeeds", async () => {
  let settle!: () => void;
  repoMocks.saveSettingsForPracticeBinding.mockImplementationOnce(() => new Promise<void>((resolve) => { settle = resolve; }));
  render(<SettingsProvider><HonestSettingsProbe /></SettingsProvider>);
  const save = await screen.findByRole("button", { name: "Save 60" });
  await waitFor(() => expect(save.getAttribute("disabled")).toBeNull());
  fireEvent.click(save);
  expect(screen.getByLabelText("daily goal").textContent).toBe(String(DEFAULT_SETTINGS.dailyGoal));
  await waitFor(() => expect(repoMocks.saveSettingsForPracticeBinding).toHaveBeenCalledTimes(1));
  settle();
  await waitFor(() => expect(screen.getByLabelText("daily goal").textContent).toBe("60"));
});

it("keeps the prior value visible on failure and exposes a working retry", async () => {
  repoMocks.saveSettingsForPracticeBinding.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
  render(<SettingsProvider><HonestSettingsProbe /></SettingsProvider>);
  const save = await screen.findByRole("button", { name: "Save 60" });
  await waitFor(() => expect(save.getAttribute("disabled")).toBeNull());
  fireEvent.click(save);
  await screen.findByRole("alert");
  expect(screen.getByLabelText("daily goal").textContent).toBe(String(DEFAULT_SETTINGS.dailyGoal));
  fireEvent.click(screen.getByRole("button", { name: "Retry settings" }));
  await waitFor(() => expect(screen.getByLabelText("daily goal").textContent).toBe("60"));
});

it("withdraws consent immediately, cancels listeners, and persists a durable null", async () => {
  repoMocks.getSettings.mockResolvedValueOnce({ ...DEFAULT_SETTINGS, voiceConsent: { version: 2, at: 1 } });
  let settle!: () => void;
  repoMocks.saveSettingsForPracticeBinding.mockImplementationOnce(() => new Promise<void>((resolve) => { settle = resolve; }));
  let cancelled = 0;
  const unregister = registerVoiceConsentWithdrawalListener(() => { cancelled += 1; });
  render(<SettingsProvider><WithdrawalProbe /></SettingsProvider>);
  const withdraw = await screen.findByRole("button", { name: "Withdraw now" });
  await waitFor(() => expect(withdraw.getAttribute("disabled")).toBeNull());
  expect(hasVoiceConsent()).toBe(true);
  fireEvent.click(withdraw);
  expect(hasVoiceConsent()).toBe(false);
  expect(cancelled).toBe(1);
  await waitFor(() => expect(repoMocks.saveSettingsForPracticeBinding).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ voiceConsent: null })));
  settle();
  unregister();
});
