"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Play, Check, Newspaper, X, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/lib/hooks/useSettings";
import { repo } from "@/lib/db";
import { t, type CoachLang } from "@/lib/i18n";
import { sfx } from "@/lib/sfx";
import { juice } from "@/components/juice";
import { Splash } from "@/components/splash";
import { mediaByKind, youtubeEmbed, youtubeThumb, type MediaItem } from "@/lib/content/media";
import { authHeaders } from "@/lib/auth-client";

// Real American media, safely: official YouTube embeds (trailers + music
// videos) with a word-hunt listening game layered on top, and today's news
// rewritten in easy English. She watches culture she actually cares about and
// her ear does the work.

interface NewsItem {
  en: string;
  es: string;
}

export default function MediaPage() {
  const { settings, ready } = useSettings();
  const lang = settings.coachLanguage;
  const [open, setOpen] = useState<MediaItem | null>(null);
  const [news, setNews] = useState<NewsItem[] | null | "loading">("loading");

  useEffect(() => {
    let active = true;
    authHeaders()
      .then((headers) => fetch("/api/news", { headers }))
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
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">{t("mediaTitle", lang)}</h1>
        <p className="mt-2 max-w-lg text-muted-foreground">{t("mediaIntro", lang)}</p>
      </section>

      {/* Today's easy news */}
      {news !== null && (
        <section className="mt-8 rounded-3xl border border-hairline bg-card p-5">
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

      <MediaSection heading={t("mediaSongs", lang)} items={mediaByKind("song")} lang={lang} onOpen={setOpen} />
      <MediaSection heading={t("mediaTrailers", lang)} items={mediaByKind("trailer")} lang={lang} onOpen={setOpen} />

      {open && <Player item={open} lang={lang} onClose={() => setOpen(null)} />}
    </div>
  );
}

function MediaSection({
  heading,
  items,
  lang,
  onOpen,
}: {
  heading: string;
  items: MediaItem[];
  lang: CoachLang;
  onOpen: (m: MediaItem) => void;
}) {
  return (
    <section className="mt-10">
      <h2 className="border-b border-hairline pb-3 font-display text-sm font-semibold uppercase tracking-[0.16em]">{heading}</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onOpen(m)}
            className="group overflow-hidden rounded-2xl border border-hairline bg-card text-left transition-all hover:border-primary/40 active:scale-[0.99]"
          >
            <div className="relative aspect-video overflow-hidden">
              <Image
                src={youtubeThumb(m.id)}
                alt={m.title}
                fill
                sizes="(max-width: 640px) 50vw, 240px"
                unoptimized
                className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
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
  const [saidIt, setSaidIt] = useState(false);
  const [usedIt, setUsedIt] = useState(false);

  const speak = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };
  const bankStars = (n: number) =>
    void repo.getPlayerStats().then((p) => repo.savePlayerStats({ ...p, stars: (p.stars ?? 0) + n, updatedAt: Date.now() }));

  const hunt = (word: string, e: React.MouseEvent<HTMLButtonElement>) => {
    if (found.has(word)) return;
    const next = new Set(found);
    next.add(word);
    setFound(next);
    sfx.correct(1);
    const r = e.currentTarget.getBoundingClientRect();
    juice.burst(r.left + r.width / 2, r.top + r.height / 2, { count: 8, rays: false });
    juice.float(r.left + r.width / 2, r.top - 6, "+1 ★");
    // Each hunted word banks one star.
    void repo.getPlayerStats().then((p) => repo.savePlayerStats({ ...p, stars: (p.stars ?? 0) + 1, updatedAt: Date.now() }));
    if (next.size === item.focusWords.length) {
      juice.centerBurst();
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

        {/* Word hunt */}
        <div className="mt-5 rounded-2xl border border-primary/25 bg-primary/[0.05] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            {allFound ? t("mediaHuntDone", lang) : t("mediaHunt", lang)}
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
                    got
                      ? "border-success bg-success/10 text-success"
                      : "border-hairline bg-card hover:border-primary/40",
                  )}
                >
                  {got && <Check className="size-3.5" />}
                  {w}
                </button>
              );
            })}
          </div>
        </div>

        {/* Say it — an app-authored phrase tied to the video's theme (ours, not
            a quote), so she practices real speaking after watching. */}
        {item.sayIt && (
          <div className="mt-4 rounded-2xl border border-hairline bg-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              {lang === "es" ? "Dilo · Say it" : "Say it"}
            </p>
            <p className="mt-2 font-display text-xl">{item.sayIt.text}</p>
            <p className="text-sm italic text-primary/80">{item.sayIt.meaning}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => speak(item.sayIt!.text)}
                className="inline-flex items-center gap-2 rounded-full border border-hairline px-4 py-2 text-sm font-medium transition-colors hover:border-primary/40"
              >
                <Volume2 className="size-4" /> {lang === "es" ? "Escucha" : "Listen"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (saidIt) return;
                  setSaidIt(true);
                  sfx.correct(2);
                  juice.centerBurst();
                  bankStars(2);
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all active:scale-[0.98]",
                  saidIt ? "bg-success/15 text-success" : "bg-primary text-primary-foreground",
                )}
              >
                {saidIt ? <><Check className="size-4" /> {lang === "es" ? "¡Bien!" : "Nice!"}</> : lang === "es" ? "Lo dije" : "I said it"}
              </button>
            </div>
          </div>
        )}

        {/* Use it — a tiny real-world task with the phrase. */}
        {item.useIt && saidIt && (
          <div className="mt-4 rounded-2xl border border-primary/25 bg-primary/[0.05] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              {lang === "es" ? "Úsalo · Use it" : "Use it"}
            </p>
            <p className="mt-2 text-sm text-foreground/90">{item.useIt[lang]}</p>
            <button
              type="button"
              onClick={() => {
                if (usedIt) return;
                setUsedIt(true);
                juice.sweep();
                sfx.goal();
                bankStars(3);
              }}
              className={cn(
                "mt-3 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all active:scale-[0.98]",
                usedIt ? "bg-success/15 text-success" : "bg-foreground text-background",
              )}
            >
              {usedIt ? <><Check className="size-4" /> {lang === "es" ? "¡Listo!" : "Done!"}</> : lang === "es" ? "Listo, lo usé" : "Done, I used it"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
