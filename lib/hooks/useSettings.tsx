"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { repo } from "@/lib/db";
import { DEFAULT_SETTINGS } from "@/lib/db/repository";
import type { Settings } from "@/lib/db/types";
import { setSfxEnabled } from "@/lib/sfx";

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
    repo.getSettings().then((s) => {
      if (active) {
        setSettings(s);
        setSfxEnabled(s.soundEnabled);
        setReady(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const update = async (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch, id: "app" };
    setSettings(next);
    if (patch.soundEnabled !== undefined) setSfxEnabled(patch.soundEnabled);
    await repo.saveSettings(next);
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
