import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  player: { xp: 0, totalAttempts: 0 },
  ready: true,
  settings: {
    studentName: "Ana",
    coachLanguage: "es",
    onboarding: null,
  },
  update: vi.fn(),
  saveVoiceConsent: vi.fn(),
}));

vi.mock("@/lib/hooks/useSettings", () => ({
  useSettings: () => ({
    settings: mocks.settings,
    update: mocks.update,
    saveVoiceConsent: mocks.saveVoiceConsent,
    ready: mocks.ready,
  }),
}));
vi.mock("@/lib/hooks/usePlayer", () => ({ usePlayer: () => mocks.player }));
vi.mock("@/lib/sfx", () => ({
  sfx: { correct: vi.fn(), finish: vi.fn(), goal: vi.fn(), levelUp: vi.fn(), tap: vi.fn() },
}));
vi.mock("@/components/juice", () => ({
  juice: { burst: vi.fn(), centerBurst: vi.fn(), float: vi.fn(), sweep: vi.fn() },
}));

import { OnboardingFlow } from "@/components/onboarding-flow";
import { LevelUpOverlay } from "@/components/practice/level-up-overlay";
import { VoiceConsentSheet } from "@/components/voice-consent-sheet";
import { ensureVoiceConsent, publishVoiceConsent } from "@/lib/speech/consent";

function VoiceHarness({ onSettlement }: { onSettlement: (accepted: boolean) => void }) {
  return (
    <>
      <button type="button" onClick={() => void ensureVoiceConsent().then(onSettlement)}>
        Start microphone
      </button>
      <VoiceConsentSheet />
    </>
  );
}

function LevelUpHarness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Show level up</button>
      {open && <LevelUpOverlay level={2} onClose={() => { onClose(); setOpen(false); }} />}
    </>
  );
}

beforeEach(() => {
  publishVoiceConsent(null);
  mocks.update.mockReset();
  mocks.update.mockResolvedValue(undefined);
  mocks.saveVoiceConsent.mockReset();
  mocks.saveVoiceConsent.mockResolvedValue(undefined);
  mocks.ready = true;
  mocks.player = { xp: 0, totalAttempts: 0 };
  mocks.settings = { studentName: "Ana", coachLanguage: "es", onboarding: null };
});

afterEach(() => {
  vi.useRealTimers();
});

describe("voice consent dialog", () => {
  it("moves focus to the safe decline action, dismisses with Escape, and restores opener focus", async () => {
    const user = userEvent.setup();
    const settlements: boolean[] = [];
    render(<VoiceHarness onSettlement={(accepted) => settlements.push(accepted)} />);

    const opener = screen.getByRole("button", { name: "Start microphone" });
    await user.click(opener);

    const decline = await screen.findByRole("button", { name: /Ahora no/ });
    await waitFor(() => expect(document.activeElement).toBe(decline));
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(settlements).toEqual([false]);
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("dismisses from the backdrop and settles the prompt once", async () => {
    const user = userEvent.setup();
    const settlements: boolean[] = [];
    render(<VoiceHarness onSettlement={(accepted) => settlements.push(accepted)} />);

    const opener = screen.getByRole("button", { name: "Start microphone" });
    await user.click(opener);
    await screen.findByRole("dialog");
    const backdrop = document.querySelector<HTMLElement>('[data-slot="dialog-overlay"]');
    expect(backdrop).not.toBeNull();
    await user.click(backdrop!);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(settlements).toEqual([false]);
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("suppresses dismissal and duplicate settlement while acceptance persists", async () => {
    const user = userEvent.setup();
    const settlements: boolean[] = [];
    let finishUpdate!: () => void;
    mocks.saveVoiceConsent.mockReturnValue(new Promise<void>((resolve) => { finishUpdate = resolve; }));
    render(<VoiceHarness onSettlement={(accepted) => settlements.push(accepted)} />);

    await user.click(screen.getByRole("button", { name: "Start microphone" }));
    const accept = await screen.findByRole("button", { name: /Aceptar y hablar/ });
    const decline = screen.getByRole("button", { name: /Ahora no/ });
    await user.click(accept);

    expect(accept.getAttribute("disabled")).not.toBeNull();
    expect(decline.getAttribute("disabled")).not.toBeNull();
    await user.keyboard("{Escape}");
    const backdrop = document.querySelector<HTMLElement>('[data-slot="dialog-overlay"]');
    fireEvent.pointerDown(backdrop!);
    fireEvent.pointerUp(backdrop!);
    fireEvent.click(backdrop!);
    expect(screen.getByRole("dialog")).not.toBeNull();
    expect(settlements).toEqual([]);
    expect(mocks.saveVoiceConsent).toHaveBeenCalledTimes(1);

    await act(async () => finishUpdate());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(settlements).toEqual([true]);
  });

  it("keeps the prompt unresolved and usable when consent persistence fails", async () => {
    const user = userEvent.setup();
    const settlements: boolean[] = [];
    mocks.saveVoiceConsent.mockRejectedValue(new Error("storage offline"));
    render(<VoiceHarness onSettlement={(accepted) => settlements.push(accepted)} />);

    await user.click(screen.getByRole("button", { name: "Start microphone" }));
    await user.click(await screen.findByRole("button", { name: /Aceptar y hablar/ }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/No pudimos guardar/);
    const accept = screen.getByRole("button", { name: /Aceptar y hablar/ });
    const decline = screen.getByRole("button", { name: /Ahora no/ });
    expect(accept.getAttribute("disabled")).toBeNull();
    expect(decline.getAttribute("disabled")).toBeNull();
    expect(settlements).toEqual([]);

    await user.click(decline);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(settlements).toEqual([false]);
  });
});

describe("required onboarding", () => {
  it("contains focus and ignores Escape and backdrop dismissal", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <>
        <button type="button">Underlying navigation</button>
        <OnboardingFlow />
      </>,
    );

    await act(async () => vi.advanceTimersByTime(1200));
    const dialog = screen.getByRole("dialog", { name: /Configura tu perfil/ });
    const background = screen.getByRole("button", { name: "Underlying navigation", hidden: true });
    expect(background.closest('[inert], [aria-hidden="true"]')).not.toBeNull();
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);

    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: /Configura tu perfil/ })).not.toBeNull();
    const backdrop = document.querySelector<HTMLElement>('[data-slot="dialog-overlay"]');
    await user.click(backdrop!);
    expect(screen.getByRole("dialog", { name: /Configura tu perfil/ })).not.toBeNull();
    expect(within(dialog).getByRole("textbox", { name: /Tu nombre/ })).not.toBeNull();
  });
});

describe("level-up dialog", () => {
  it("focuses Close, dismisses on its informational timer, and restores opener focus", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<LevelUpHarness onClose={onClose} />);

    const opener = screen.getByRole("button", { name: "Show level up" });
    await user.click(opener);
    const close = screen.getByRole("button", { name: "Cerrar" });
    await waitFor(() => expect(document.activeElement).toBe(close));
    expect(screen.getByRole("dialog")).not.toBeNull();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), { timeout: 3000 });
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});
