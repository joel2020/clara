import { fireEvent, render, screen } from "@testing-library/react";
import { createElement, type ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  player: { equippedOutfit: "outfit-rosa" },
}));

vi.mock("next/image", () => ({
  default: ({ fill, priority, src, ...props }: ComponentProps<"img"> & {
    fill?: boolean;
    priority?: boolean;
  }) => {
    void fill;
    void priority;
    return createElement("img", { ...props, src: String(src) });
  },
}));

vi.mock("@/lib/hooks/usePlayer", () => ({
  usePlayer: () => mocks.player,
}));

import { CharacterIllustration } from "@/components/character/character-illustration";

describe("CharacterIllustration equipped-art fallback", () => {
  beforeEach(() => {
    mocks.player.equippedOutfit = "outfit-rosa";
  });

  it("catches fallback that changes mood, mutates the saved outfit, or leaves failed base art mounted", () => {
    const onArtFallback = vi.fn();
    render(
      <CharacterIllustration
        mode="scene"
        mood="point"
        alt="Lumi points to the coffee"
        onArtFallback={onArtFallback}
      />,
    );

    const equippedArt = screen.getByAltText("Lumi points to the coffee");
    expect(equippedArt.getAttribute("src")).toBe("/character/outfits/rosa-point.png");
    fireEvent.error(equippedArt);

    const baseArt = screen.getByAltText("Lumi points to the coffee");
    expect(baseArt.getAttribute("src")).toBe("/character/lumi-point.png");
    expect(mocks.player.equippedOutfit).toBe("outfit-rosa");
    expect(onArtFallback).toHaveBeenCalledTimes(1);

    fireEvent.error(baseArt);
    expect(screen.queryByAltText("Lumi points to the coffee")).toBeNull();
    expect(screen.getByRole("img", { name: "Lumi points to the coffee" })).not.toBeNull();
    expect(onArtFallback).toHaveBeenCalledTimes(1);
  });

  it("catches a terminal base-art failure that persists after the effective asset changes", () => {
    const { rerender } = render(
      <CharacterIllustration
        mode="scene"
        mood="point"
        alt="Lumi points to the coffee"
      />,
    );

    fireEvent.error(screen.getByAltText("Lumi points to the coffee"));
    fireEvent.error(screen.getByAltText("Lumi points to the coffee"));
    expect(screen.queryByAltText("Lumi points to the coffee")).toBeNull();

    rerender(
      <CharacterIllustration
        mode="scene"
        mood="cheer"
        alt="Lumi celebrates"
      />,
    );

    expect(screen.getByAltText("Lumi celebrates").getAttribute("src"))
      .toBe("/character/outfits/rosa-cheer.png");
    expect(screen.queryByRole("img", { name: "Lumi points to the coffee" })).toBeNull();
  });
});
