"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { repo } from "@/lib/db";
import { DEFAULT_SETTINGS } from "@/lib/db/repository";
import type { Settings } from "@/lib/db/types";
import { setSfxEnabled } from "@/lib/sfx";
import { ensureProfile, pushSettings } from "@/lib/sync/supabase-sync";
import { restoreProfile, hydrateFromCloud } from "@/lib/sync/restore";
import { requestPersistentStorage, rememberSyncCode, recalledSyncCode } from "@/lib/sync/durability";
import { publishVoiceConsent } from "@/lib/speech/consent";

// App-wide settings (instructor toggle, voice, rate) loaded once and shared.

interface SettingsContextValue {
  settings: Settings;
  ready: boolean;
  update: (patch: Partial<Settings>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
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
      setSettings(s);
      setSfxEnabled(s.soundEnabled);
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Mirror the persisted voice consent into the broker (lib/speech/consent.ts)
  // so the capture chokepoint can check it without touching React. The sheet
  // persists an accept through update(), which lands back here.
  useEffect(() => {
    publishVoiceConsent(settings.voiceConsent ?? null);
  }, [settings.voiceConsent]);

  // Keep the document language in sync with the coach language so a screen
  // reader announces the UI with the right pronunciation (SSR defaults to "es").
  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = settings.coachLanguage;
  }, [settings.coachLanguage]);

  const update = async (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch, id: "app" };
    setSettings(next);
    if (patch.soundEnabled !== undefined) setSfxEnabled(patch.soundEnabled);
    await repo.saveSettings(next);
    // Mirror the student's synced preferences to the cloud (no-op without sync).
    if (next.profileId) {
      rememberSyncCode(next.profileId);
      pushSettings(next.profileId, next);
      if (next.studentName && (patch.studentName !== undefined || patch.coachLanguage !== undefined)) {
        void ensureProfile({ id: next.profileId, name: next.studentName, coachLanguage: next.coachLanguage }).catch(
          () => {},
        );
      }
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, ready, update }}>{children}</SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
