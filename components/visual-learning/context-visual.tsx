"use client";

import Image from "next/image";
import { Coffee } from "lucide-react";
import { useState } from "react";
import { CharacterIllustration } from "@/components/character";
import { resolveVisualObject } from "@/lib/visual-learning/resolve";
import type {
  VisualFallbackClass,
  VisualLanguage,
  VisualObject,
  VisualObjectId,
  VisualTopicPack,
} from "@/lib/visual-learning/types";

function ObjectFallback({ object }: { object: VisualObject }) {
  const label = `${object.label.en} · ${object.label.es}`;

  return (
    <div
      role="group"
      aria-label={label}
      className="flex size-28 flex-col items-center justify-center rounded-2xl border border-hairline bg-card px-3 text-center shadow-sm sm:size-32"
    >
      <span className="type-heading text-foreground">{object.label.en}</span>
      <span className="type-support text-muted-foreground">{object.label.es}</span>
    </div>
  );
}

export function ContextVisual({
  pack,
  moment,
  objectId,
  language,
  priority,
  onFallback,
}: {
  pack: VisualTopicPack;
  moment: keyof VisualTopicPack["moments"];
  objectId?: VisualObjectId;
  language: VisualLanguage;
  priority?: boolean;
  onFallback?: (fallback: VisualFallbackClass) => void;
}) {
  const object = resolveVisualObject(pack, objectId);
  const environmentIdentity = `${pack.environment.mobile}\u0000${pack.environment.desktop}`;
  const objectIdentity = object?.image ?? null;
  const [failedEnvironmentIdentity, setFailedEnvironmentIdentity] = useState<string | null>(null);
  const [failedObjectIdentity, setFailedObjectIdentity] = useState<string | null>(null);
  const environmentFailed = failedEnvironmentIdentity === environmentIdentity;
  const objectFailed = objectIdentity !== null && failedObjectIdentity === objectIdentity;

  function failEnvironment() {
    if (environmentFailed) return;
    setFailedEnvironmentIdentity(environmentIdentity);
    onFallback?.("environment-missing");
  }

  function failObject() {
    if (objectFailed || objectIdentity === null) return;
    setFailedObjectIdentity(objectIdentity);
    onFallback?.("object-missing");
  }

  return (
    <div
      className="relative isolate min-h-[25rem] overflow-hidden bg-card sm:min-h-[30rem] lg:min-h-[34rem]"
      aria-label={pack.story.title[language]}
    >
      {environmentFailed ? (
        <div
          role="img"
          aria-label={pack.story.title[language]}
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card px-8 text-center text-foreground"
        >
          <Coffee className="size-10 text-primary" aria-hidden="true" />
          <span className="type-title max-w-xs">{pack.story.title[language]}</span>
        </div>
      ) : (
        <picture className="absolute inset-0 block">
          <source media="(max-width: 639px)" srcSet={pack.environment.mobile} />
          <img
            src={pack.environment.desktop}
            width={2880}
            height={1800}
            alt=""
            aria-hidden="true"
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
            onError={failEnvironment}
            data-entrance-layer
            className="h-full w-full object-cover object-center animate-fade-in motion-reduce:animate-none"
          />
        </picture>
      )}

      <div
        data-entrance-layer
        className="absolute inset-y-0 left-[41%] z-10 w-[48%] animate-fade-up motion-reduce:animate-none sm:left-[48%] sm:w-[40%] lg:left-[49%] lg:w-[38%]"
      >
        <CharacterIllustration
          mode="scene"
          mood={pack.moments[moment].pose}
          priority={priority}
          onArtFallback={() => onFallback?.("outfit-pose-missing")}
        />
      </div>

      {object && (
        <div
          data-entrance-layer
          className="absolute bottom-12 left-5 z-20 animate-scale-in motion-reduce:animate-none sm:bottom-14 sm:left-8"
        >
          {objectFailed ? (
            <ObjectFallback object={object} />
          ) : (
            <div className="flex size-28 items-center justify-center rounded-2xl bg-card/95 p-2 shadow-md ring-1 ring-hairline sm:size-32">
              <Image
                src={object.image}
                alt={object.alt[language]}
                width={512}
                height={512}
                sizes="(max-width: 640px) 112px, 128px"
                priority={priority}
                onError={failObject}
                className="size-full object-contain"
              />
            </div>
          )}
        </div>
      )}

      <div
        aria-hidden="true"
        className="absolute inset-x-[-8%] bottom-0 z-30 h-9 origin-left -rotate-1 bg-primary shadow-sm sm:h-11"
      />
    </div>
  );
}
