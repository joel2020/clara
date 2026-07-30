"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { PetSprite } from "@/components/pet-sprite";
import {
  AVATAR_ANCHORS,
  AVATAR_CANVAS,
  avatarRenderLayers,
  capLayout,
  type AvatarBase,
  type AvatarLoadout,
  type AvatarRenderLayer,
} from "@/lib/avatar";

// The learner's own avatar, composited. One box holding the shared canvas'
// aspect ratio; every layer is absolutely positioned in normalized percentages
// of that box, so the whole figure scales with its container and lands
// identically at 320px and at desktop width. Layers are drawn in the z-order
// lib/avatar.ts hands back — base, outfit, cap, pet — and nothing is clipped:
// the figure sheet is contain-fit, and lib/avatar.ts computes the cap and pet
// boxes so they stay inside the figure's own safe area.
//
// This is the learner's equipment only. Clara/Lumi's teaching art lives in
// components/character and components/lumi-scene and must never be mixed in
// here: the guide is not something the learner dresses.

export function AvatarStage({
  loadout,
  alt,
  priority,
  className,
}: {
  loadout: AvatarLoadout;
  /** Meaningful description of the whole figure. Omit for decorative use —
   *  never label the individual layers; one image, one name. */
  alt?: string;
  /** Preload when this stage is the page's above-the-fold hero. */
  priority?: boolean;
  className?: string;
}) {
  const decorative = !alt;
  return (
    <div
      className={cn("relative mx-auto w-full select-none", className)}
      style={{
        aspectRatio: `${AVATAR_CANVAS.width} / ${AVATAR_CANVAS.height}`,
        // Lets an emoji companion size itself against the stage, not the page.
        containerType: "inline-size",
      }}
      role={decorative ? undefined : "img"}
      aria-label={alt}
      aria-hidden={decorative || undefined}
    >
      {avatarRenderLayers(loadout).map((layer) => (
        <Layer key={layer.slot} layer={layer} base={loadout.base} priority={priority} />
      ))}
    </div>
  );
}

function Layer({
  layer,
  base,
  priority,
}: {
  layer: AvatarRenderLayer;
  base: AvatarBase;
  priority?: boolean;
}) {
  const anchors = AVATAR_ANCHORS[base];
  if (layer.place === "feet") {
    return (
      <div
        className="absolute"
        style={{
          zIndex: layer.z,
          left: `${(anchors.petCenterX - anchors.petWidth / 2) * 100}%`,
          // Bottom-anchored: the companion stands ON the ground line.
          bottom: `${(1 - anchors.petBaselineY) * 100}%`,
          width: `${anchors.petWidth * 100}%`,
          // Emoji companions have no intrinsic size — scale them off the stage.
          fontSize: `${anchors.petWidth * 50}cqw`,
        }}
      >
        <PetSprite petId={layer.id} size="" imgClass="h-auto w-full" />
      </div>
    );
  }

  if (!layer.src) return null;

  // Artwork is dropped in per item; a slot whose PNG has not landed yet leaves
  // the rest of the figure intact instead of showing a broken-image mark.
  const hideOnError = (e: { currentTarget: HTMLElement }) => {
    e.currentTarget.style.visibility = "hidden";
  };

  if (layer.place === "head") {
    // Sized to the base's head width and slid so the cap's OWN head opening
    // lands on the base's brow line. Both edges of the box are computed, so
    // the sprite's view angle no longer decides where the crown ends up.
    const cap = capLayout(base, layer.id);
    if (!cap) return null;
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={layer.src}
        alt=""
        className="absolute transition-opacity duration-200 motion-reduce:transition-none"
        style={{
          zIndex: layer.z,
          left: `${cap.left * 100}%`,
          top: `${cap.top * 100}%`,
          width: `${cap.width * 100}%`,
          height: `${cap.height * 100}%`,
        }}
        onError={hideOnError}
      />
    );
  }

  return (
    <Image
      src={layer.src}
      alt=""
      fill
      sizes="(max-width: 640px) 60vw, 320px"
      priority={priority}
      className="object-contain transition-opacity duration-200 motion-reduce:transition-none"
      style={{ zIndex: layer.z }}
      onError={hideOnError}
    />
  );
}
