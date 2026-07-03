"use client";

import { useEffect, useState } from "react";
import { Volume2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/lib/hooks/useSettings";
import { getEnglishVoices, loadVoices, speak } from "@/lib/speech/synthesis";
import { repo } from "@/lib/db";
import { cn } from "@/lib/utils";

// Pick the native voice and default speed used everywhere, plus a clean-slate
// reset for the local data. Voice choice is shared via settings.

export function VoiceSettings() {
  const { settings, update } = useSettings();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    loadVoices().then(() => setVoices(getEnglishVoices()));
  }, []);

  const preview = () => speak("She sells sheep by the sea", { rate: settings.speechRate, voiceURI: settings.voiceURI });

  const reset = async () => {
    if (!confirm("Erase all attempts, progress, and custom lessons on this device? This can't be undone.")) return;
    await repo.reset();
    toast.success("All local data cleared.");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="font-extrabold">Student</h3>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">
          Who this device belongs to, and the language the coaching speaks. Set these up once per student.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="student-name-setting">Name</Label>
            <input
              id="student-name-setting"
              value={settings.studentName ?? ""}
              onChange={(e) => update({ studentName: e.target.value || null })}
              placeholder="Mariana"
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
            />
          </div>
          <div>
            <Label htmlFor="coach-lang">Coaching language</Label>
            <select
              id="coach-lang"
              value={settings.coachLanguage}
              onChange={(e) => update({ coachLanguage: e.target.value as "es" | "en" })}
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
            >
              <option value="es">Español (beginners)</option>
              <option value="en">English (advanced)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="font-extrabold">Playback voice</h3>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">
          Built-in lessons play <span className="font-semibold text-foreground">Joel&apos;s recorded voice</span>. The
          settings below are the fallback browser voice, used only for custom words without a recording.
        </p>

        <div className="grid gap-4">
          <div>
            <Label htmlFor="voice">Voice</Label>
            <select
              id="voice"
              value={settings.voiceURI ?? ""}
              onChange={(e) => update({ voiceURI: e.target.value || undefined })}
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
            >
              <option value="">Auto (best English voice)</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
            {voices.length === 0 && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                No voices detected yet. Chrome on desktop has the best selection.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="rate">Default speed — {settings.speechRate.toFixed(2)}×</Label>
            <input
              id="rate"
              type="range"
              min={0.5}
              max={1.2}
              step={0.05}
              value={settings.speechRate}
              onChange={(e) => update({ speechRate: Number(e.target.value) })}
              className="mt-2 w-full accent-[var(--primary)]"
            />
          </div>

          <Button variant="secondary" onClick={preview} className="w-fit gap-2 rounded-full">
            <Volume2 className="size-4" />
            Preview
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="font-extrabold">Daily goal</h3>
        <p className="mb-3 mt-1 text-sm text-muted-foreground">
          XP target per day. Each clear word is ~10 XP (more with a combo).
        </p>
        <div className="flex flex-wrap gap-2">
          {[20, 40, 60, 100].map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => update({ dailyGoal: g })}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                settings.dailyGoal === g
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-foreground/30",
              )}
            >
              {g} XP
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
        <h3 className="font-extrabold text-destructive">Reset data</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Clears every attempt, all progress, and custom lessons stored in this browser.
        </p>
        <Button variant="destructive" onClick={reset} className="mt-3 gap-2 rounded-full">
          <RotateCcw className="size-4" />
          Erase local data
        </Button>
      </div>
    </div>
  );
}
