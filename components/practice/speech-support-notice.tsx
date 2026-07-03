"use client";

import type { SpeechSupport } from "@/lib/speech/support";
import { useSettings } from "@/lib/hooks/useSettings";
import { t } from "@/lib/i18n";

// Honest, friendly heads-up when the browser can't do part of the loop. Playback
// and recognition degrade independently, so the message is specific.

export function SpeechSupportNotice({ support }: { support: SpeechSupport }) {
  const { settings } = useSettings();
  if (support.synthesis && support.recognition) return null;

  const lang = settings.coachLanguage;
  const message = !support.recognition ? t(!support.synthesis ? "supportNone" : "supportNoRecognition", lang)
    : "Audio playback isn't supported in this browser. You can still record. Use Google Chrome for the best experience.";

  return (
    <div className="mb-8 rounded-xl border border-warn/30 bg-warn/[0.05] px-4 py-3">
      <p className="text-sm leading-relaxed text-warn-foreground">{message}</p>
    </div>
  );
}
