"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Check, Trash2, Bell, BellOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { repo } from "@/lib/db";
import { useSettings } from "@/lib/hooks/useSettings";
import { useAuth } from "@/lib/hooks/useAuth";
import { t } from "@/lib/i18n";
import { sfx } from "@/lib/sfx";
import { Splash } from "@/components/splash";
import { pushSupported, currentPushState, isSubscribed, enablePush, disablePush } from "@/lib/push";
import { forgetSyncCode } from "@/lib/sync/durability";

// Student-facing settings — name, coaching language, goal, sounds, and the
// sync code (the passwordless key to her progress, essential when the app is
// gifted to a new student). Instructor tools stay on their own page.

const GOALS = [20, 40, 60];

type PushUi = "hidden" | "needs_install" | "off" | "on" | "denied" | "error";

export default function SettingsPage() {
  const { settings, update, ready } = useSettings();
  const { required: authOn, user, signOut } = useAuth();
  const lang = settings.coachLanguage;
  const [copied, setCopied] = useState(false);
  const [armReset, setArmReset] = useState(false);
  const [pushUi, setPushUi] = useState<PushUi>("hidden");

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!pushSupported()) {
        // iOS Safari only exposes push to PWAs installed on the home screen.
        const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
        if (active && isIOS) setPushUi("needs_install");
        return;
      }
      const state = await currentPushState();
      if (!active) return;
      if (state === "not_configured" || state === "unsupported") return; // keep hidden
      if (state === "denied") setPushUi("denied");
      else setPushUi((await isSubscribed()) ? "on" : "off");
    })();
    return () => {
      active = false;
    };
  }, []);

  const togglePush = async () => {
    sfx.tap();
    try {
      if (pushUi === "on") {
        await disablePush();
        setPushUi("off");
      } else {
        await enablePush(settings.profileId, lang);
        setPushUi("on");
      }
    } catch (e) {
      setPushUi((e as Error).message === "denied" ? "denied" : "error");
    }
  };

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
    forgetSyncCode();
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

        {/* Scoring strictness */}
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("settingsDifficulty", lang)}</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {(["auto", "gentle", "normal"] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => void update({ difficulty: level })}
                className={cn(
                  "rounded-2xl border p-4 text-left transition-all active:scale-[0.99]",
                  settings.difficulty === level ? "border-primary bg-primary/[0.05]" : "border-hairline bg-card hover:border-foreground/30",
                )}
                aria-pressed={settings.difficulty === level}
              >
                <span className={cn("font-display text-lg font-medium", settings.difficulty === level && "text-primary")}>
                  {t(level === "auto" ? "diffAuto" : level === "gentle" ? "diffGentle" : "diffNormal", lang)}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                  {t(level === "auto" ? "diffAutoSub" : level === "gentle" ? "diffGentleSub" : "diffNormalSub", lang)}
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

        {/* Daily reminder */}
        {pushUi !== "hidden" && (
          <section className="rounded-2xl border border-hairline bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-medium">
                  {pushUi === "on" ? <Bell className="size-4 text-primary" /> : <BellOff className="size-4 text-muted-foreground" />}
                  {t("pushTitle", lang)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {pushUi === "needs_install"
                    ? t("pushNeedsInstall", lang)
                    : pushUi === "denied"
                      ? t("pushDenied", lang)
                      : pushUi === "on"
                        ? t("pushEnabled", lang)
                        : pushUi === "error"
                          ? t("pushError", lang)
                          : t("pushSub", lang)}
                </p>
              </div>
              {(pushUi === "off" || pushUi === "on" || pushUi === "error") && (
                <button
                  type="button"
                  onClick={togglePush}
                  className={cn(
                    "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all active:scale-[0.98]",
                    pushUi === "on"
                      ? "border border-hairline text-muted-foreground hover:text-foreground"
                      : "bg-foreground text-background hover:opacity-90",
                  )}
                >
                  {pushUi === "on" ? t("pushDisable", lang) : t("pushEnable", lang)}
                </button>
              )}
            </div>
          </section>
        )}

        {/* Account */}
        {authOn && (
          <section className="flex items-center justify-between rounded-2xl border border-hairline bg-card px-5 py-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {lang === "es" ? "Cuenta" : "Account"}
              </p>
              <p className="mt-1 truncate text-sm text-foreground/80">{user?.email ?? ""}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <a
                href="/profile"
                className="rounded-full border border-hairline px-4 py-2 text-sm font-medium transition-colors hover:border-primary/40"
              >
                {lang === "es" ? "Perfil" : "Profile"}
              </a>
              <button
                type="button"
                onClick={() => void signOut()}
                className="rounded-full border border-hairline px-4 py-2 text-sm font-medium transition-colors hover:border-foreground/30"
              >
                {lang === "es" ? "Salir" : "Sign out"}
              </button>
            </div>
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
