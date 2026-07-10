"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Play, Check, Newspaper, X, Sparkles, Mic2, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/lib/hooks/useSettings";
import { repo } from "@/lib/db";
import { t, type CoachLang } from "@/lib/i18n";
import { sfx } from "@/lib/sfx";
import { juice } from "@/components/juice";
import { Splash } from "@/components/splash";
import { mediaByKind, youtubeEmbed, youtubeThumb, type MediaItem } from "@/lib/content/media";

// The media zone turns a real video into a tiny learning loop:
// watch a little → catch a phrase → say it back → bank a star.
interface NewsItem {
  en: string;
  es: string;
}

export default function MediaPage() {
  const { settings, ready } = useSettings();
  const lang = settings.coachLanguage;
  const [open, setOpen] = useState<MediaItem | null>(null);
  const [news, setNews] = useState<NewsItem[] | null | "loading">("loading");
  const practice = mediaByKind("practice");

  useEffect(() => {
    let active = true;
    fetch("/api/news")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { items: NewsItem[] }) => active && setNews(d.items ?? []))
      .catch(() => active && setNews(null));
    return () => {
      active = false;
    };
  }, []);

  if (!ready) return <Splash />;

  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-6 sm:px-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" />
        {t("navHome", lang)}
      </Link>

      <section className="mt-5 animate-fade-up">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
          <Sparkles className="size-3.5" />
          {lang === "es" ? "Mira · escucha · habla" : "Watch · listen · speak"}
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
          {lang === "es" ? "Inglés que sí se usa" : "English you will actually use"}
        </h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          {lang === "es"
            ? "No es tarea. Es tu ratito de inglés: videos reales, frases que se quedan y pequeñas victorias."
            : "Not homework. Your little English moment: real videos, phrases that stick, and small wins."}
        </p>
      </section>

      {practice[0] && <FeaturedWatch item={practice[0]} lang={lang} onOpen={setOpen} />}

      {/* Today's easy news */}
      {news !== null && (
        <section className="mt-7 rounded-3xl border border-hairline bg-card p-5">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.16em]">
            <Newspaper className="size-4 text-primary" />
            {t("mediaNews", lang)}
          </h2>
          {news === "loading" ? (
            <p className="mt-3 text-sm text-muted-foreground">{t("mediaNewsLoading", lang)}</p>
          ) : (
            <ul className="mt-4 space-y-3.5">
              {news.map((n, i) => (
                <li key={i} className="border-l-2 border-primary/30 pl-3.5">
                  <p className="font-medium leading-relaxed">{n.en}</p>
                  {lang === "es" && <p className="mt-0.5 text-sm text-muted-foreground">{n.es}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <MediaSection
        heading={lang === "es" ? "Más para hablar" : "More speaking practice"}
        intro={lang === "es" ? "Elige una escena, escucha tres minutos y repite las frases en voz alta." : "Pick a scene, listen for three minutes, and repeat the phrases out loud."}
        items={practice.slice(1)}
        lang={lang}
        onOpen={setOpen}
      />
      <MediaSection heading={t("mediaSongs", lang)} items={mediaByKind("song")} lang={lang} onOpen={setOpen} />
      <MediaSection heading={t("mediaTrailers", lang)} items={mediaByKind("trailer")} lang={lang} onOpen={setOpen} />

      {open && <Player item={open} lang={lang} onClose={() => setOpen(null)} />}
    </div>
  );
}

function FeaturedWatch({ item, lang, onOpen }: { item: MediaItem; lang: CoachLang; onOpen: (m: MediaItem) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="group relative mt-8 block w-full overflow-hidden rounded-3xl bg-foreground text-left text-background shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.995]"
    >
      <div className="absolute inset-0 opacity-30">
        <Image src={youtubeThumb(item.id)} alt="" fill sizes="(max-width: 768px) 100vw, 768px" unoptimized className="object-cover" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-[#071a50] via-[#0a2b73]/95 to-[#123a93]/55" />
      <div className="relative flex min-h-56 items-end gap-4 px-6 py-6 sm:min-h-64 sm:px-8 sm:py-8">
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/90 backdrop-blur">
            <Star className="size-3 fill-current text-co-yellow" />
            {lang === "es" ? "Video de hoy · 10 minutos" : "Today's video · 10 minutes"}
          </span>
          <h2 className="mt-4 max-w-sm font-display text-3xl font-semibold leading-[1.03] tracking-[-0.03em] sm:text-4xl">
            {lang === "es" ? "Mira. Caza frases. Háblalas." : "Watch it. Catch it. Say it."}
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/75 sm:text-base">{item.blurb[lang]}</p>
          <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-[#0b2b70] transition-transform group-hover:translate-x-0.5">
            <Play className="size-4 fill-current" />
            {lang === "es" ? "Empezar el reto" : "Start the challenge"}
          </span>
        </div>
        <span className="grid size-14 shrink-0 place-items-center rounded-full border border-white/25 bg-white/10 backdrop-blur-sm sm:size-16">
          <Mic2 className="size-6" />
        </span>
      </div>
    </button>
  );
}

function MediaSection({
  heading,
  intro,
  items,
  lang,
  onOpen,
}: {
  heading: string;
  intro?: string;
  items: MediaItem[];
  lang: CoachLang;
  onOpen: (m: MediaItem) => void;
}) {
  if (!items.length) return null;
  return (
    <section className="mt-10">
      <h2 className="border-b border-hairline pb-3 font-display text-sm font-semibold uppercase tracking-[0.16em]">{heading}</h2>
      {intro && <p className="mt-2 max-w-lg text-sm text-muted-foreground">{intro}</p>}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onOpen(m)}
            className="group overflow-hidden rounded-2xl border border-hairline bg-card text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md active:scale-[0.99]"
          >
            <div className="relative aspect-video overflow-hidden">
              <Image
                src={youtubeThumb(m.id)}
                alt={m.title}
                fill
                sizes="(max-width: 640px) 50vw, 240px"
                unoptimized
                className="object-cover transition-transform duration-500 group-hover:scale-[1.07]"
              />
              <span className="absolute inset-0 grid place-items-center bg-black/25 opacity-90 transition-opacity group-hover:opacity-100">
                <span className="grid size-10 place-items-center rounded-full bg-white/90 text-foreground shadow-md">
                  <Play className="size-5 fill-current pl-0.5" />
                </span>
              </span>
            </div>
            <div className="p-3">
              <p className="truncate font-display text-[15px] font-medium leading-tight">{m.title}</p>
              <p className="truncate text-xs text-muted-foreground">{m.by}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function Player({ item, lang, onClose }: { item: MediaItem; lang: CoachLang; onClose: () => void }) {
  const [found, setFound] = useState<Set<string>>(new Set());
  const allFound = found.size === item.focusWords.length;

  const hunt = (word: string, e: React.MouseEvent<HTMLButtonElement>) => {
    if (found.has(word)) return;
    const next = new Set(found);
    next.add(word);
    setFound(next);
    sfx.correct(1);
    const r = e.currentTarget.getBoundingClientRect();
    juice.burst(r.left + r.width / 2, r.top + r.height / 2, { count: 8, rays: false });
    juice.float(r.left + r.width / 2, r.top - 6, "+1 ★");
    void repo.getPlayerStats().then((p) => repo.savePlayerStats({ ...p, stars: (p.stars ?? 0) + 1, updatedAt: Date.now() }));
    if (next.size === item.focusWords.length) {
      sfx.achievement();
      juice.centerBurst(lang === "es" ? "¡Oído de acero!" : "Sharp ears!");
      juice.sweep();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal>
      <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-background p-5 shadow-xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-xl font-semibold leading-tight">{item.title}</p>
            <p className="text-sm text-muted-foreground">{item.by}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("mediaClose", lang)}
            className="grid size-9 shrink-0 place-items-center rounded-full border border-hairline text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl bg-black ring-1 ring-border">
          <iframe
            src={`${youtubeEmbed(item.id)}?rel=0`}
            title={item.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="aspect-video w-full"
          />
        </div>

        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{item.blurb[lang]}</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-primary/25 bg-primary/[0.05] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              {allFound ? (lang === "es" ? "¡Reto completado!" : "Challenge complete!") : (lang === "es" ? "1 · Caza las frases" : "1 · Catch the phrases")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {lang === "es" ? "Tócalas cuando las escuches. Cada una suma una estrella." : "Tap them when you hear them. Each one earns a star."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.focusWords.map((w) => {
                const got = found.has(w);
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={(e) => hunt(w, e)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-all active:scale-[0.97]",
                      got ? "border-success bg-success/10 text-success" : "border-hairline bg-card hover:border-primary/40",
                    )}
                  >
                    {got && <Check className="size-3.5" />}
                    {w}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-co-yellow/40 bg-[color-mix(in_oklch,var(--co-yellow)_12%,transparent)] p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-warn-foreground">
              <Mic2 className="size-3.5" />
              {lang === "es" ? "2 · Dilo en voz alta" : "2 · Say it out loud"}
            </p>
            {item.speakBack?.length ? (
              <>
                <div className="mt-3 space-y-2">
                  {item.speakBack.map((phrase) => (
                    <p key={phrase} className="rounded-xl bg-background/75 px-3 py-2 text-sm font-medium">“{phrase}”</p>
                  ))}
                </div>
                <Link href="/talk" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                  {lang === "es" ? "Practicar con Joel →" : "Practice with Joel →"}
                </Link>
              </>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {lang === "es" ? "Pausa el video y copia una oración completa. No importa perfecto; importa intentarlo." : "Pause the video and copy one full sentence. It does not have to be perfect; it matters that you try."}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
