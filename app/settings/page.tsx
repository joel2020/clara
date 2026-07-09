"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { repo } from "@/lib/db";
import { useSettings } from "@/lib/hooks/useSettings";
import { t } from "@/lib/i18n";
import { sfx } from "@/lib/sfx";
import { Splash } from "@/components/splash";

// Student-facing settings — name, coaching language, goal, sounds, and the
// sync code (the passwordless key to her progress, essential when the app is
// gifted to a new student). Instructor tools stay on their own page.

const GOALS = [20, 40, 60];

export default function SettingsPage() {
  const { settings, update, ready } = useSettings();
  const lang = settings.coachLanguage;
  const [copied, setCopied] = useState(false);
  const [armReset, setArmReset] = useState(false);

  if (!ready) return <Splash />;

  const copyCode = async () => {
    if (!settings.profileId) return;
    try {
      await navigator.clipboard.writeText(settings.profileId);
      setCopied(true);
      sfx.tap();
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard can be unavailable — the code is visible to copy by hand */
    }
  };

  const reset = async () => {
    if (!armReset) {
      setArmReset(true);
      setTimeout(() => setArmReset(false), 4000);
      return;
    }
    await repo.reset();
    window.location.href = "/";
  };

  return (
    <div className="mx-auto max-w-xl px-5 pb-24 pt-6 sm:px-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" />
        {t("navHome", lang)}
      </Link>

      <h1 className="mt-5 font-display text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">{t("settingsTitle", lang)}</h1>

      <div className="mt-8 space-y-6">
        {/* Name */}
        <section>
          <label htmlFor="s-name" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t("settingsName", lang)}
          </label>
          <input
            id="s-name"
            defaultValue={settings.studentName ?? ""}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== settings.studentName) void update({ studentName: v });
            }}
            className="mt-2 w-full rounded-2xl border border-hairline bg-card px-4 py-3 font-display text-lg font-medium outline-none transition-colors focus:border-primary"
          />
        </section>

        {/* Coaching language */}
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("settingsCoach", lang)}</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {(["es", "en"] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => void update({ coachLanguage: code })}
                className={cn(
                  "rounded-2xl border p-4 text-left transition-all active:scale-[0.99]",
                  settings.coachLanguage === code ? "border-primary bg-primary/[0.05]" : "border-hairline bg-card hover:border-foreground/30",
                )}
                aria-pressed={settings.coachLanguage === code}
              >
                <span className={cn("font-display text-lg font-medium", settings.coachLanguage === code && "text-primary")}>
                  {code === "es" ? "Español" : "English"}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Daily goal */}
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("settingsGoal", lang)}</p>
          <div className="mt-2 grid grid-cols-3 gap-3">
            {GOALS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => void update({ dailyGoal: g })}
                className={cn(
                  "rounded-2xl border py-3 text-center font-display text-lg font-medium transition-all active:scale-[0.99]",
                  settings.dailyGoal === g ? "border-primary bg-primary/[0.05] text-primary" : "border-hairline bg-card hover:border-foreground/30",
                )}
                aria-pressed={settings.dailyGoal === g}
              >
                {g}
              </button>
            ))}
          </div>
        </section>

        {/* Sounds */}
        <section className="flex items-center justify-between rounded-2xl border border-hairline bg-card px-5 py-4">
          <p className="font-medium">{t("settingsSound", lang)}</p>
          <button
            type="button"
            role="switch"
            aria-checked={settings.soundEnabled}
            onClick={() => void update({ soundEnabled: !settings.soundEnabled })}
            className={cn(
              "relative h-7 w-12 rounded-full transition-colors",
              settings.soundEnabled ? "bg-primary" : "bg-muted-foreground/30",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 size-6 rounded-full bg-white shadow-sm transition-all",
                settings.soundEnabled ? "left-[calc(100%-26px)]" : "left-0.5",
              )}
            />
          </button>
        </section>

        {/* Sync code */}
        {settings.profileId && (
          <section className="rounded-2xl border border-hairline bg-card p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("settingsSync", lang)}</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <code className="font-mono text-lg font-semibold tracking-wide">{settings.profileId}</code>
              <button
                type="button"
                onClick={copyCode}
                className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-3.5 py-2 text-sm font-medium transition-colors hover:border-primary/40"
              >
                {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                {copied ? t("settingsCopied", lang) : t("settingsCopy", lang)}
              </button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{t("settingsSyncSub", lang)}</p>
          </section>
        )}

        {/* Danger zone */}
        <section className="rounded-2xl border border-destructive/30 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-destructive">{t("settingsDanger", lang)}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t("settingsResetSub", lang)}</p>
          <button
            type="button"
            onClick={reset}
            className={cn(
              "mt-3 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all active:scale-[0.98]",
              armReset ? "bg-destructive text-white" : "border border-destructive/40 text-destructive hover:bg-destructive/5",
            )}
          >
            <Trash2 className="size-4" />
            {armReset ? t("settingsResetConfirm", lang) : t("settingsReset", lang)}
          </button>
        </section>
      </div>
    </div>
  );
}
