"use client";

import Image from "next/image";
import { ArrowRight, ImageOff, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { playPronunciation, stopPronunciation } from "@/lib/speech/player";
import { resolveVisualObject } from "@/lib/visual-learning/resolve";
import type {
  VisualLanguage,
  VisualObject,
  VisualObjectId,
  VisualTopicPack,
} from "@/lib/visual-learning/types";
import { cn } from "@/lib/utils";

type PlaybackPhase = "starting" | "playing" | "finished" | "error";

interface PlaybackState {
  objectId: VisualObjectId;
  phase: PlaybackPhase;
}

interface DiscoveryState {
  packId: VisualTopicPack["id"];
  selectedObjectId: VisualObjectId | null;
  entryObjectSeen: boolean;
  playback: PlaybackState | null;
}

const copy = {
  en: {
    title: "Explore the café",
    instruction: "Choose an object to see it and hear the English word.",
    group: "Explore café objects",
    details: "Object details",
    empty: "Select an object to listen.",
    pronunciationLabel: "Pronunciation",
    spanish: "Spanish",
    starting: (label: string) => `Starting ${label}`,
    playing: (label: string) => `Playing ${label}`,
    finished: (label: string) => `${label} finished`,
    failed: (label: string) => `Couldn’t play ${label}. Try again.`,
    retry: (label: string) => `Retry ${label}`,
    continue: "Continue to speaking",
  },
  es: {
    title: "Explora el café",
    instruction: "Elige un objeto para verlo y escuchar la palabra en inglés.",
    group: "Explora los objetos del café",
    details: "Detalles del objeto",
    empty: "Selecciona un objeto para escucharlo.",
    pronunciationLabel: "Pronunciación",
    spanish: "Español",
    starting: (label: string) => `Preparando ${label}`,
    playing: (label: string) => `Reproduciendo ${label}`,
    finished: (label: string) => `Terminó ${label}`,
    failed: (label: string) => `No se pudo reproducir ${label}. Intenta de nuevo.`,
    retry: (label: string) => `Reintentar ${label}`,
    continue: "Continuar para hablar",
  },
} as const;

function lessonIdFor(pack: VisualTopicPack): string {
  return pack.entryPhraseItemId.split(":", 1)[0] || pack.entryPhraseItemId;
}

function initialDiscoveryState(packId: VisualTopicPack["id"]): DiscoveryState {
  return {
    packId,
    selectedObjectId: null,
    entryObjectSeen: false,
    playback: null,
  };
}

function DiscoveryThumbnail({
  object,
  language,
}: {
  object: VisualObject;
  language: VisualLanguage;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        role="img"
        aria-label={`${object.label.en} · ${object.label.es}`}
        className="flex size-28 items-center justify-center rounded-xl border border-hairline bg-card text-muted-foreground"
      >
        <ImageOff className="size-8" aria-hidden="true" />
      </span>
    );
  }

  return (
    <Image
      src={object.image}
      alt={object.alt[language]}
      width={512}
      height={512}
      sizes="(max-width: 639px) 40vw, (max-width: 1023px) 22vw, 176px"
      onError={() => setFailed(true)}
      className="size-28 object-contain transition-transform duration-200 group-hover:scale-[1.03] motion-reduce:transition-none"
    />
  );
}

export function ObjectDiscoveryGrid({
  pack,
  language,
  synthesisSupported,
  onComplete,
}: {
  pack: VisualTopicPack;
  language: VisualLanguage;
  synthesisSupported: boolean;
  onComplete: (objectId: VisualObjectId) => void;
}): React.ReactNode {
  const strings = copy[language];
  const objects = pack.discoveryObjectIds
    .map((objectId) => resolveVisualObject(pack, objectId))
    .filter((object): object is VisualObject => object !== null);
  const [discoveryState, setDiscoveryState] = useState<DiscoveryState>(() =>
    initialDiscoveryState(pack.id),
  );
  const playbackRequest = useRef(0);
  const mountedPackId = useRef(pack.id);
  const stateIsCurrent = discoveryState.packId === pack.id;
  const selectedObjectId = stateIsCurrent ? discoveryState.selectedObjectId : null;
  const entryObjectSeen = stateIsCurrent && discoveryState.entryObjectSeen;
  const playback = stateIsCurrent ? discoveryState.playback : null;
  const selectedObject = resolveVisualObject(pack, selectedObjectId ?? undefined);
  const analyticsContext = {
    topicId: pack.id,
    lessonId: lessonIdFor(pack),
  };

  useEffect(() => () => {
    playbackRequest.current += 1;
    stopPronunciation();
  }, []);

  useEffect(() => {
    if (mountedPackId.current === pack.id) return;
    mountedPackId.current = pack.id;
    playbackRequest.current += 1;
    stopPronunciation();
    setDiscoveryState(initialDiscoveryState(pack.id));
  }, [pack.id]);

  function startPlayback(
    object: VisualObject,
    event: "visual_object_selected" | "visual_object_replay",
  ) {
    if (!object.audioItemId && !synthesisSupported) return;

    const request = playbackRequest.current + 1;
    playbackRequest.current = request;
    setDiscoveryState((current) => ({
      ...(current.packId === pack.id ? current : initialDiscoveryState(pack.id)),
      playback: { objectId: object.id, phase: "starting" },
    }));
    track(event, { ...analyticsContext, objectId: object.id });
    playPronunciation({
      id: object.audioItemId,
      text: object.label.en,
      onStart: () => {
        if (playbackRequest.current !== request) return;
        setDiscoveryState((current) => current.packId === pack.id
          ? { ...current, playback: { objectId: object.id, phase: "playing" } }
          : current);
      },
      onEnd: () => {
        if (playbackRequest.current !== request) return;
        setDiscoveryState((current) => current.packId === pack.id
          ? { ...current, playback: { objectId: object.id, phase: "finished" } }
          : current);
      },
      onError: () => {
        if (playbackRequest.current !== request) return;
        setDiscoveryState((current) => current.packId === pack.id
          ? { ...current, playback: { objectId: object.id, phase: "error" } }
          : current);
      },
    });
  }

  function selectObject(object: VisualObject) {
    const replay = selectedObjectId === object.id;
    setDiscoveryState((current) => {
      const next = current.packId === pack.id ? current : initialDiscoveryState(pack.id);
      return {
        ...next,
        selectedObjectId: object.id,
        entryObjectSeen: next.entryObjectSeen || object.id === pack.entryObjectId,
      };
    });
    startPlayback(object, replay ? "visual_object_replay" : "visual_object_selected");
  }

  function completeDiscovery() {
    if (!entryObjectSeen) return;
    track("visual_discovery_complete", analyticsContext);
    onComplete(pack.entryObjectId);
  }

  function playbackStatus(): string {
    if (!selectedObject || playback?.objectId !== selectedObject.id) return "";
    if (playback.phase === "starting") return strings.starting(selectedObject.label.en);
    if (playback.phase === "playing") return strings.playing(selectedObject.label.en);
    if (playback.phase === "finished") return strings.finished(selectedObject.label.en);
    return "";
  }

  return (
    <section
      aria-labelledby={`object-discovery-${pack.id}-title`}
      lang={language}
      className="rounded-[2rem] border border-hairline bg-background p-5 shadow-sm sm:p-7"
    >
      <div className="max-w-2xl">
        <h2
          id={`object-discovery-${pack.id}-title`}
          className="type-title text-foreground"
        >
          {strings.title}
        </h2>
        <p className="type-body mt-2 text-muted-foreground">{strings.instruction}</p>
      </div>

      <div
        role="group"
        aria-label={strings.group}
        className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
      >
        {objects.map((object) => {
          const selected = object.id === selectedObjectId;
          const canPlay = Boolean(object.audioItemId) || synthesisSupported;
          const assetKey = `${object.id}\u0000${object.image}`;

          return (
            <button
              key={object.id}
              type="button"
              aria-label={`${object.label.en} · ${object.label.es}`}
              aria-pressed={selected}
              disabled={!canPlay}
              onClick={() => selectObject(object)}
              style={{ minHeight: "44px", minWidth: "44px" }}
              className={cn(
                "group flex min-h-48 flex-col items-center justify-between rounded-2xl border bg-card p-3 text-center shadow-sm transition-[border-color,box-shadow,transform,background-color] duration-200",
                "hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.99] motion-reduce:transition-none",
                "disabled:cursor-not-allowed disabled:opacity-50",
                selected
                  ? "-translate-y-0.5 border-primary bg-primary/5 shadow-md ring-2 ring-primary/20 motion-reduce:translate-y-0"
                  : "border-hairline",
              )}
            >
              <span className="flex min-h-28 w-full items-center justify-center rounded-xl bg-background p-2">
                <DiscoveryThumbnail
                  key={`${pack.id}\u0000${assetKey}`}
                  object={object}
                  language={language}
                />
              </span>
              <span className="mt-3 flex flex-col">
                <span className="type-heading text-foreground">{object.label.en}</span>
                <span className="type-support text-muted-foreground">{object.label.es}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div
        role="region"
        aria-label={strings.details}
        className="mt-5 min-h-32 rounded-2xl border border-hairline bg-card p-5"
      >
        {selectedObject ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="type-heading text-foreground">{selectedObject.label.en}</h3>
              <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-2">
                <div>
                  <dt className="font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    {strings.pronunciationLabel}
                  </dt>
                  <dd className="font-ipa mt-1 text-sm text-foreground">{selectedObject.pronunciation}</dd>
                </div>
                <div>
                  <dt className="font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    {strings.spanish}
                  </dt>
                  <dd className="mt-1 text-sm text-foreground">{selectedObject.label.es}</dd>
                </div>
              </dl>
            </div>

            <div className="flex min-w-fit flex-col items-start gap-2 sm:items-end">
              <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
                {playbackStatus()}
              </p>
              {playback?.objectId === selectedObject.id && playback.phase === "error" && (
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <p role="alert" className="text-sm text-destructive">
                    {strings.failed(selectedObject.label.en)}
                  </p>
                  <button
                    type="button"
                    aria-label={strings.retry(selectedObject.label.en)}
                    onClick={() => startPlayback(selectedObject, "visual_object_replay")}
                    style={{ minHeight: "44px", minWidth: "44px" }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-hairline bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                    {strings.retry(selectedObject.label.en)}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="type-body text-muted-foreground">{strings.empty}</p>
        )}
      </div>

      <button
        type="button"
        disabled={!entryObjectSeen}
        onClick={completeDiscovery}
        style={{ minHeight: "44px" }}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground shadow-sm transition-[background-color,transform] duration-200 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none sm:w-fit"
      >
        {strings.continue}
        <ArrowRight className="size-4" aria-hidden="true" />
      </button>
    </section>
  );
}
