"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { repo } from "@/lib/db";
import { DEFAULT_SETTINGS } from "@/lib/db/repository";
import type { Settings } from "@/lib/db/types";
import { setSfxEnabled } from "@/lib/sfx";
import { restoreProfile, hydrateFromCloud } from "@/lib/sync/restore";
import { requestPersistentStorage, rememberSyncCode, recalledSyncCode } from "@/lib/sync/durability";
import { publishVoiceConsent } from "@/lib/speech/consent";
import { flushOutbox } from "@/lib/sync/outbox";

// App-wide settings (instructor toggle, voice, rate) loaded once and shared.

type SettingsPatch = Partial<Omit<Settings, "voiceConsent">>;

interface SettingsContextValue {
  settings: Settings;
  ready: boolean;
  update: (patch: SettingsPatch) => Promise<boolean>;
  saveError: string | null;
  retryLastUpdate: () => Promise<boolean>;
  saveVoiceConsent: (consent: NonNullable<Settings["voiceConsent"]>) => Promise<void>;
  revokeVoiceConsent: () => Promise<boolean>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const currentSettings = useRef<Settings>(DEFAULT_SETTINGS);
  const persistedSettings = useRef<Settings>(DEFAULT_SETTINGS);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const lastFailedPatch = useRef<SettingsPatch | null>(null);
  const voiceRevocationNeedsRetry = useRef(false);

  useEffect(() => {
    let active = true;
    publishVoiceConsent(null);
    void requestPersistentStorage();
    void (async () => {
      let s = await repo.getSettings();
      // Supabase is the source of truth; local IndexedDB is a cache we re-seed
      // from the cloud on every launch. Two paths, both offline-safe:
      //   • Cold cache (fresh install, or iOS evicted IndexedDB): no local name.
      //     Do a full restore from the sync code — seed name, attempts, progress,
      //     player — so an evicted device rebuilds itself instead of onboarding
      //     the student as brand new.
      //   • Warm cache (she has local data): pull the authoritative player stats,
      //     progress, and settings over the local copy, so changes made in the
      //     cloud show up and a stale local cache can't win.
      const code = s.profileId ?? recalledSyncCode();
      if (code) {
        try {
          if (!s.studentName) {
            const summary = await restoreProfile(code);
            if (summary) {
              s = {
                ...s,
                studentName: summary.profile.name,
                coachLanguage: summary.profile.coachLanguage,
                profileId: summary.profile.id,
              };
              await repo.saveSettings(s);
            }
          } else {
            const hy = await hydrateFromCloud(code);
            if (hy) {
              s = { ...s, ...hy.settingsPatch, profileId: s.profileId ?? code };
              await repo.saveSettings(s);
            }
          }
        } catch {
          /* cloud unreachable or no data — keep the local cache and carry on */
        }
      }
      if (s.profileId) rememberSyncCode(s.profileId);
      if (!active) return;
      currentSettings.current = s;
      persistedSettings.current = s;
      setSettings(s);
      publishVoiceConsent(s.voiceConsent ?? null);
      setSfxEnabled(s.soundEnabled);
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Keep the document language in sync with the coach language so a screen
  // reader announces the UI with the right pronunciation (SSR defaults to "es").
  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = settings.coachLanguage;
  }, [settings.coachLanguage]);

  const persistPatch = useCallback((patch: Partial<Settings>) => {
    const operation = saveQueue.current.then(async () => {
      const next = { ...persistedSettings.current, ...patch, id: "app" };
      const binding = repo.capturePracticeBinding();
      if (!binding) throw new Error("Settings account binding unavailable");
      await repo.saveSettingsForPracticeBinding(binding, next);
      persistedSettings.current = next;
      return next;
    });
    saveQueue.current = operation.then(() => undefined, () => undefined);
    return operation;
  }, []);

  const update = useCallback(async (patch: SettingsPatch): Promise<boolean> => {
    let persisted: Settings;
    try {
      persisted = await persistPatch(patch);
    } catch {
      lastFailedPatch.current = patch;
      setSaveError("No pudimos guardar el cambio. Inténtalo de nuevo. · We couldn't save that change. Please retry.");
      return false;
    }
    currentSettings.current = persisted;
    setSettings(persisted);
    if (patch.soundEnabled !== undefined) setSfxEnabled(patch.soundEnabled);
    setSaveError(null);
    lastFailedPatch.current = null;
    if (persisted.profileId) {
      rememberSyncCode(persisted.profileId);
      await flushOutbox().catch(() => undefined);
    }
    return true;
  }, [persistPatch]);

  const revokeVoiceConsent = useCallback(async (): Promise<boolean> => {
    // Fail closed immediately: future capture is denied and every active handle
    // is cancelled before local/cloud persistence is attempted.
    publishVoiceConsent(null);
    let persisted: Settings;
    try {
      persisted = await persistPatch({ voiceConsent: null });
    } catch {
      voiceRevocationNeedsRetry.current = true;
      setSaveError("El permiso de voz quedó desactivado, pero falta guardar el retiro. · Voice is off, but saving the withdrawal needs a retry.");
      return false;
    }
    currentSettings.current = persisted;
    setSettings(persisted);
    voiceRevocationNeedsRetry.current = false;
    setSaveError(null);
    if (persisted.profileId) await flushOutbox().catch(() => undefined);
    return true;
  }, [persistPatch]);

  const retryLastUpdate = useCallback(async () => {
    if (voiceRevocationNeedsRetry.current) return revokeVoiceConsent();
    const patch = lastFailedPatch.current;
    return patch ? update(patch) : true;
  }, [revokeVoiceConsent, update]);

  const saveVoiceConsent = async (consent: NonNullable<Settings["voiceConsent"]>) => {
    if (!ready) throw new Error("Settings are not ready");
    const committed = await persistPatch({ voiceConsent: consent });
    currentSettings.current = committed;
    setSettings(committed);
    publishVoiceConsent(consent);
    if (committed.profileId) await flushOutbox().catch(() => undefined);
  };

  return (
    <SettingsContext.Provider value={{ settings, ready, update, saveError, retryLastUpdate, saveVoiceConsent, revokeVoiceConsent }}>{children}</SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
