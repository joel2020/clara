"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Check, Trash2, Bell, BellOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { repo } from "@/lib/db";
import { lastSyncFailure } from "@/lib/sync/supabase-sync";
import { flushOutbox, pendingOutboxCount } from "@/lib/sync/outbox";
import { useSettings } from "@/lib/hooks/useSettings";
import { useAuth } from "@/lib/hooks/useAuth";
import { useAccess } from "@/lib/hooks/useAccess";
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
  // Read once on mount via a lazy initialiser rather than in an effect: this is a
  // diagnostic snapshot, not a live indicator, and a spinner for background sync
  // would worry her over nothing.
  const [syncFailure] = useState(lastSyncFailure);
  // Rows whose cloud mirror is still pending (offline practice, provider
  // hiccup). Calm and truthful: local data is safe either way; this only says
  // the cloud copy hasn't caught up, and offers a retry.
  const [pendingSync, setPendingSync] = useState(0);
  const [flushingSync, setFlushingSync] = useState(false);

  const { settings, update, ready, saveError, retryLastUpdate, revokeVoiceConsent } = useSettings();
  const { required: authOn, user, signOut } = useAuth();
  const { admin } = useAccess();
  const lang = settings.coachLanguage;
  const [copied, setCopied] = useState(false);
  const [armReset, setArmReset] = useState(false);
  // Narrower two-tap confirm for the transcript wipe: it deletes what she said
  // on her calls and nothing else, so it is deliberately NOT dressed as the
  // full reset.
  const [armWipeTranscripts, setArmWipeTranscripts] = useState(false);
  const [transcriptsWiped, setTranscriptsWiped] = useState(false);
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
    void pendingOutboxCount().then((n) => { if (active) setPendingSync(n); });
    return () => {
      active = false;
    };
  }, []);

  const retrySync = async () => {
    setFlushingSync(true);
    const res = await flushOutbox();
    setPendingSync(res.remaining);
    setFlushingSync(false);
  };

  const togglePush = async () => {
    sfx.tap();
    try {
      if (pushUi === "on") {
        await disablePush();
        setPushUi("off");
      } else {
        await enablePush(lang);
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

  const wipeTranscripts = async () => {
    if (!armWipeTranscripts) {
      setArmWipeTranscripts(true);
      setTimeout(() => setArmWipeTranscripts(false), 4000);
      return;
    }
    setArmWipeTranscripts(false);
    await repo.deleteVirtualCallTranscripts();
    sfx.tap();
    setTranscriptsWiped(true);
    setTimeout(() => setTranscriptsWiped(false), 2600);
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
        {saveError && (
          <section role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-4">
            <p className="text-sm font-medium">{saveError}</p>
            <button type="button" onClick={() => void retryLastUpdate()} className="mt-3 rounded-full border border-hairline px-4 py-2 text-xs font-medium">
              Reintentar · Retry
            </button>
          </section>
        )}

        <section className="rounded-2xl border border-hairline bg-card px-5 py-4" aria-labelledby="voice-privacy-title">
          <p id="voice-privacy-title" className="text-sm font-medium">Privacidad de voz · Voice privacy</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Puedes retirar el permiso cuando quieras. La app detendrá cualquier grabación activa y bloqueará nuevas capturas.
            {" · "}You can withdraw permission anytime. Active recording stops and future capture is blocked.
          </p>
          <button
            type="button"
            onClick={() => void revokeVoiceConsent()}
            disabled={!settings.voiceConsent}
            className="mt-3 rounded-full border border-hairline px-4 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            Retirar permiso de voz · Withdraw voice permission
          </button>
        </section>
        {pendingSync > 0 && (
          <section className="rounded-2xl border border-hairline bg-card px-5 py-4">
            <p className="text-sm font-medium">
              {lang === "en"
                ? `${pendingSync} practice ${pendingSync === 1 ? "record" : "records"} saved on this device, waiting to sync`
                : `${pendingSync} ${pendingSync === 1 ? "registro guardado" : "registros guardados"} en este dispositivo, esperando sincronizar`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {lang === "en"
                ? "Your progress is safe here; the cloud copy will catch up when the connection allows."
                : "Tu progreso está seguro aquí; la copia en la nube se pondrá al día cuando la conexión lo permita."}
            </p>
            <button
              type="button"
              onClick={() => void retrySync()}
              disabled={flushingSync}
              className="mt-3 rounded-full border border-hairline px-4 py-2 text-xs font-medium transition-colors hover:border-foreground/30 disabled:opacity-50"
            >
              {flushingSync ? (lang === "en" ? "Syncing…" : "Sincronizando…") : lang === "en" ? "Try now" : "Intentar ahora"}
            </button>
          </section>
        )}

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

        {/* Virtual call */}
        <section className="rounded-2xl border border-hairline bg-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("vcSettings", lang)}</p>

          {/* Correction mode — two different calls, not a severity slider. */}
          <p className="mt-4 text-sm font-medium">{t("vcMode", lang)}</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {(["natural", "practice"] as const).map((mode) => {
              const active = (settings.callCorrectionMode ?? "natural") === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => void update({ callCorrectionMode: mode })}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition-all active:scale-[0.99]",
                    active ? "border-primary bg-primary/[0.05]" : "border-hairline hover:border-foreground/30",
                  )}
                  aria-pressed={active}
                >
                  <span className={cn("font-display text-lg font-medium", active && "text-primary")}>
                    {t(mode === "natural" ? "vcModeNatural" : "vcModePractice", lang)}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    {t(mode === "natural" ? "vcModeNaturalSub" : "vcModePracticeSub", lang)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Humor */}
          <p className="mt-5 text-sm font-medium">{t("vcHumor", lang)}</p>
          <div className="mt-2 grid grid-cols-3 gap-3">
            {(["off", "light", "full"] as const).map((level) => {
              const active = (settings.humorLevel ?? "light") === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => void update({ humorLevel: level })}
                  className={cn(
                    "rounded-2xl border py-3 text-center text-sm font-medium transition-all active:scale-[0.99]",
                    active ? "border-primary bg-primary/[0.05] text-primary" : "border-hairline hover:border-foreground/30",
                  )}
                  aria-pressed={active}
                >
                  {t(level === "off" ? "vcHumorOff" : level === "light" ? "vcHumorLight" : "vcHumorFull", lang)}
                </button>
              );
            })}
          </div>

          {/* Transcript retention — plain language about what is stored. */}
          <p className="mt-5 text-sm font-medium">{t("vcTranscript", lang)}</p>
          <div className="mt-2 grid gap-3">
            {(["none", "session", "keep"] as const).map((choice) => {
              const active = (settings.callTranscriptRetention ?? "none") === choice;
              return (
                <button
                  key={choice}
                  type="button"
                  onClick={() => void update({ callTranscriptRetention: choice })}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition-all active:scale-[0.99]",
                    active ? "border-primary bg-primary/[0.05]" : "border-hairline hover:border-foreground/30",
                  )}
                  aria-pressed={active}
                >
                  <span className={cn("font-display text-base font-medium", active && "text-primary")}>
                    {t(choice === "none" ? "vcTranscriptNone" : choice === "session" ? "vcTranscriptSession" : "vcTranscriptKeep", lang)}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    {t(choice === "none" ? "vcTranscriptNoneSub" : choice === "session" ? "vcTranscriptSessionSub" : "vcTranscriptKeepSub", lang)}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">{t("vcDeleteTranscriptsSub", lang)}</p>
          <button
            type="button"
            onClick={() => void wipeTranscripts()}
            className={cn(
              "mt-2 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all active:scale-[0.98]",
              armWipeTranscripts ? "border-foreground bg-foreground text-background" : "border-hairline hover:border-foreground/30",
            )}
          >
            {transcriptsWiped ? <Check className="size-4 text-success" /> : <Trash2 className="size-4" />}
            {transcriptsWiped
              ? t("vcDeleteTranscriptsDone", lang)
              : armWipeTranscripts
                ? t("vcDeleteTranscriptsConfirm", lang)
                : t("vcDeleteTranscripts", lang)}
          </button>
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
        <section className="text-center text-xs text-muted-foreground">
          <Link href="/privacidad" className="underline-offset-2 hover:underline">
            Tu voz y tus datos · Privacy
          </Link>
        </section>

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
            {/* A sync that quietly stops working is indistinguishable from one that
                works, and this app promises progress follows the account. So a
                failure is stated plainly here rather than only in the console. */}
            {syncFailure && (
              <p className="mt-3 rounded-xl bg-[oklch(0.66_0.11_70_/_0.12)] p-3 text-sm">
                {lang === "es"
                  ? `No se pudo guardar en la nube (${syncFailure.label}). Tu progreso está seguro en este dispositivo; revisa tu conexión.`
                  : `Could not save to the cloud (${syncFailure.label}). Your progress is safe on this device; check your connection.`}
              </p>
            )}
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
              {admin && (
                <a
                  href="/coach"
                  className="rounded-full border border-primary/40 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
                >
                  Coach
                </a>
              )}
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
