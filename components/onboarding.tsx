"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/lib/hooks/useSettings";
import { sfx } from "@/lib/sfx";
import { ensureProfile } from "@/lib/sync/supabase-sync";

// A short, friendly, passwordless "sync code" — name slug + 4 random chars —
// that identifies the student across devices (e.g. "mariana-7k2p").
function makeProfileId(name: string): string {
  const slug =
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 12) || "student";
  const rand = Math.abs(Date.now() ^ (Math.random() * 1e9)).toString(36).slice(-4);
  return `${slug}-${rand}`;
}

// First-run welcome. Asks the student's name and which language the coaching
// should speak — Spanish for beginners (default), English for advanced. This is
// what makes the app giftable to any student, not just one.

export function Onboarding() {
  const { settings, update, ready } = useSettings();
  const [name, setName] = useState("");
  const [lang, setLang] = useState<"es" | "en">("es");

  if (!ready || settings.studentName) return null;

  const start = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    sfx.tap();
    const profileId = settings.profileId ?? makeProfileId(trimmed);
    await update({ studentName: trimmed, coachLanguage: lang, profileId });
    // Create the cloud profile row (no-op if Supabase isn't configured).
    void ensureProfile({ id: profileId, name: trimmed, coachLanguage: lang }).catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="flag-bar h-[3px] w-full" aria-hidden />
      <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-16">
        <div className="animate-fade-up">
          <p className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            <span className="flag-dots" aria-hidden>
              <i /><i /><i />
            </span>
            Bienvenida · Welcome
          </p>
          <h1 className="mt-5 font-display text-4xl font-medium leading-[1.08] tracking-[-0.03em] sm:text-5xl">
            Tu curso de
            <br />
            <span className="text-primary">pronunciación.</span>
          </h1>
          <p className="mt-5 text-muted-foreground">
            Escucha, habla y gana puntos mientras tu inglés se vuelve claro.
            <span className="mt-1 block text-sm text-muted-foreground/70">
              Listen, speak, and earn points while your English gets clear.
            </span>
          </p>

          <div className="mt-10">
            <label htmlFor="student-name" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              ¿Cómo te llamas? · Your name
            </label>
            <input
              id="student-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && start()}
              placeholder="Mariana"
              autoFocus
              className="mt-2 w-full border-b border-border bg-transparent pb-2 font-display text-3xl font-medium tracking-[-0.02em] outline-none placeholder:text-muted-foreground/30 focus:border-primary"
            />
          </div>

          <div className="mt-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              ¿En qué idioma te explico? · Coaching language
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <LangCard
                active={lang === "es"}
                title="Español"
                sub="Las instrucciones en español — ideal para empezar"
                onClick={() => setLang("es")}
              />
              <LangCard
                active={lang === "en"}
                title="English"
                sub="All coaching in English — for advanced students"
                onClick={() => setLang("en")}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={start}
            disabled={!name.trim()}
            className="mt-10 inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-sm font-medium text-background transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-30"
          >
            Empezar · Start
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function LangCard({
  active,
  title,
  sub,
  onClick,
}: {
  active: boolean;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-4 text-left transition-all active:scale-[0.99]",
        active ? "border-primary bg-primary/[0.05]" : "border-border hover:border-foreground/30",
      )}
      aria-pressed={active}
    >
      <span className={cn("font-display text-lg font-medium", active && "text-primary")}>{title}</span>
      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{sub}</span>
    </button>
  );
}
