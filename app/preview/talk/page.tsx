"use client";

import Image from "next/image";
import { useState } from "react";
import { Phone, ArrowLeft } from "lucide-react";
import { TabBar } from "@/components/system/tab-bar";
import { MicButton } from "@/components/system/mic-button";
import { contentIcon } from "@/lib/ui/icon-map";
import { PREVIEW_TABS } from "../tabs";
import { cn } from "@/lib/utils";

// Prototype: Hablar in two states — the entry (scenario cards with drawn icons,
// la llamada as the flagship door) and the conversation shell (Joel present:
// photo, speaking state, his message, her scaffold, mic at the thumb).

const SCENARIOS = [
  { id: "greetings", title: "Conocer a alguien", note: "Saludos e introducciones" },
  { id: "cafe", title: "En el café", note: "Pedir comida y bebida" },
  { id: "directions", title: "Pidiendo direcciones", note: "Encontrar tu camino" },
  { id: "shopping", title: "De compras", note: "Precios y tallas" },
];

export default function PreviewTalk() {
  const [mode, setMode] = useState<"entry" | "session">("entry");

  if (mode === "session") {
    return (
      <div className="safe-top flex min-h-[100dvh] flex-col">
        {/* Session header: who + where, one exit. */}
        <header className="page-gutter mx-auto flex w-full max-w-xl items-center gap-3 py-3">
          <button
            type="button"
            onClick={() => setMode("entry")}
            aria-label="Cambiar situación"
            className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </button>
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative shrink-0">
              <Image
                src="/character/joel-avatar-poster.jpg"
                alt=""
                width={40}
                height={40}
                className="rounded-full object-cover"
                style={{ width: 40, height: 40 }}
              />
              {/* Presence: speaking state visible on his portrait. */}
              <span className="absolute -bottom-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-success ring-2 ring-background">
                <span className="eq-bars text-white" style={{ height: 7 }}>
                  <i /><i /><i />
                </span>
              </span>
            </span>
            <div className="min-w-0">
              <p className="type-heading truncate">Joel</p>
              <p className="type-support truncate">En el café · está hablando…</p>
            </div>
          </div>
        </header>

        {/* The conversation: his turn, her scaffold. The middle is content, not blur. */}
        <main className="page-gutter mx-auto w-full max-w-xl flex-1 space-y-4 py-4">
          <div className="max-w-[85%] rounded-3xl rounded-tl-lg border border-hairline bg-card p-4">
            <p className="type-body font-medium" lang="en">
              Hi! Welcome in. What can I get you today?
            </p>
            <p className="type-support mt-1">¡Hola! Bienvenida. ¿Qué te preparo hoy?</p>
            <button type="button" className="type-support mt-2 inline-flex items-center gap-1.5 font-medium text-primary">
              Repetir
            </button>
          </div>

          <div className="ml-auto max-w-[85%] rounded-3xl rounded-br-lg bg-primary/8 p-4" style={{ background: "var(--surface-wash)" }}>
            <p className="type-body" lang="en">Can I have a coffee with milk, please?</p>
            <p className="type-support mt-1 text-success">Clarísimo — Joel te entendió.</p>
          </div>
        </main>

        {/* Her scaffold + mic, at the thumb. */}
        <footer
          className="page-gutter mx-auto w-full max-w-xl space-y-3 pt-2"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
        >
          <p className="type-label">Puedes decir…</p>
          <div className="flex flex-wrap gap-2">
            {["How much is it?", "For here, please.", "Do you have almond milk?"].map((c) => (
              <button
                key={c}
                type="button"
                lang="en"
                className="rounded-full border border-hairline bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:border-foreground/30"
              >
                {c}
              </button>
            ))}
          </div>
          <MicButton state="idle" label="Tu turno — toca y habla" />
        </footer>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <header className="border-b border-hairline">
        <div className="flag-bar h-[3px] w-full" aria-hidden />
        <div className="page-gutter mx-auto flex h-14 max-w-3xl items-center">
          <span className="font-display text-xl font-semibold tracking-tight">Clara</span>
        </div>
      </header>

      <main className="page-gutter mx-auto max-w-3xl pt-8">
        <p className="type-label">Hablar</p>
        <h1 className="type-display mt-3">Conversa con Joel</h1>
        <p className="type-support mt-3 max-w-[44ch]">
          Situaciones reales, su voz de verdad. Él te entiende, te responde y te da
          un empujoncito cuando lo necesitas.
        </p>

        {/* The flagship door: la llamada — the job track's speaking practice. */}
        <button
          type="button"
          onClick={() => setMode("session")}
          className="card-lift mt-7 flex w-full items-center gap-4 rounded-3xl border border-hairline bg-card p-5 text-left"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Phone className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="type-heading block">La llamada</span>
            <span className="type-support block">
              Atiende a un cliente en inglés — te califico como calidad en un BPO.
            </span>
          </span>
          <span className="type-label shrink-0 rounded-full px-2.5 py-1" style={{ background: "var(--surface-wash)", color: "var(--primary)" }}>
            Trabajo
          </span>
        </button>

        <p className="type-label mt-8">O elige una situación</p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {SCENARIOS.map((s) => {
            const Icon = contentIcon(s.id);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setMode("session")}
                  className={cn(
                    "flex w-full items-center gap-4 rounded-3xl border border-hairline bg-card p-4 text-left transition-colors hover:bg-muted",
                  )}
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl" style={{ background: "var(--surface-wash)" }}>
                    {Icon && <Icon className="size-5 text-primary" strokeWidth={1.75} aria-hidden />}
                  </span>
                  <span className="min-w-0">
                    <span className="type-heading block">{s.title}</span>
                    <span className="type-support block">{s.note}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </main>

      <TabBar items={PREVIEW_TABS} activePath="/preview/talk" />
    </div>
  );
}
