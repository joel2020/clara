import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const boundaries = vi.hoisted(() => ({
  playPronunciation: vi.fn(),
  stopPronunciation: vi.fn(),
  track: vi.fn(),
}));

vi.mock("@/lib/speech/player", () => ({
  playPronunciation: boundaries.playPronunciation,
  stopPronunciation: boundaries.stopPronunciation,
}));

vi.mock("@/lib/analytics", () => ({
  track: boundaries.track,
}));

import { ObjectDiscoveryGrid } from "@/components/visual-learning/object-discovery-grid";
import { CAFE_RESTAURANT_PACK } from "@/lib/visual-learning/manifest";
import type { VisualTopicPack } from "@/lib/visual-learning/types";

type PlaybackRequest = {
  id?: string;
  text: string;
  onStart: () => void;
  onEnd: () => void;
  onError: () => void;
};

function playbackRequest(index = 0): PlaybackRequest {
  const request = boundaries.playPronunciation.mock.calls[index]?.[0] as
    | PlaybackRequest
    | undefined;
  if (!request) throw new Error(`Missing playback request ${index}`);
  return request;
}

describe("ObjectDiscoveryGrid", () => {
  beforeEach(() => {
    boundaries.playPronunciation.mockReset();
    boundaries.stopPronunciation.mockReset();
    boundaries.track.mockReset();
  });

  it("catches discovery-list drift, hidden bilingual labels, inaccessible names, or undersized targets", () => {
    const { container } = render(
      <ObjectDiscoveryGrid
        pack={CAFE_RESTAURANT_PACK}
        language="en"
        synthesisSupported
        onComplete={() => {}}
      />,
    );

    const grid = screen.getByRole("group", { name: "Explore café objects" });
    const objectButtons = within(grid).getAllByRole("button");
    expect(objectButtons).toHaveLength(4);
    expect(objectButtons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Coffee · Café",
      "Menu · Menú",
      "Table · Mesa",
      "Card · Tarjeta",
    ]);

    for (const [index, labels] of [
      ["Coffee", "Café"],
      ["Menu", "Menú"],
      ["Table", "Mesa"],
      ["Card", "Tarjeta"],
    ].entries()) {
      const button = objectButtons[index]!;
      expect(within(button).getByText(labels[0]!)).not.toBeNull();
      expect(within(button).getByText(labels[1]!)).not.toBeNull();
      expect(button.getAttribute("aria-pressed")).toBe("false");
      expect(button.style.minHeight).toBe("44px");
      expect(button.style.minWidth).toBe("44px");
      expect(button.className).toContain("focus-visible:outline-2");
      expect(button.className).toContain("focus-visible:outline-ring");
    }

    const renderedPresentation = Array.from(
      container.querySelectorAll<HTMLElement>("[class], [style]"),
    )
      .flatMap((element) => [
        element.getAttribute("class") ?? "",
        element.getAttribute("style") ?? "",
      ])
      .join(" ");
    expect(renderedPresentation).not.toMatch(/(?:#[0-9a-f]{3,8}|rgba?\(|gradient)/i);
  });

  it("catches multiple selection, missing IPA/Spanish detail, a wrong IPA font, or an incomplete playback request", async () => {
    const user = userEvent.setup();
    render(
      <ObjectDiscoveryGrid
        pack={CAFE_RESTAURANT_PACK}
        language="en"
        synthesisSupported
        onComplete={() => {}}
      />,
    );

    const coffee = screen.getByRole("button", { name: "Coffee · Café" });
    const menu = screen.getByRole("button", { name: "Menu · Menú" });
    await user.click(menu);

    expect(menu.getAttribute("aria-pressed")).toBe("true");
    expect(coffee.getAttribute("aria-pressed")).toBe("false");
    const details = screen.getByRole("region", { name: "Object details" });
    expect(within(details).getByRole("heading", { name: "Menu" })).not.toBeNull();
    expect(within(details).getByText("/ˈmɛnjuː/").className).toContain("font-ipa");
    expect(within(details).getByText("Menú")).not.toBeNull();

    expect(boundaries.playPronunciation).toHaveBeenCalledTimes(1);
    expect(playbackRequest()).toEqual({
      id: "conv-cafe:2",
      text: "Menu",
      onStart: expect.any(Function),
      onEnd: expect.any(Function),
      onError: expect.any(Function),
    });
    expect(boundaries.track).toHaveBeenCalledWith("visual_object_selected", {
      topicId: "cafe-restaurant",
      lessonId: "conv-cafe",
      objectId: "menu",
    });

    act(() => playbackRequest().onStart());
    expect(screen.getByRole("status").textContent).toBe("Playing Menu");
    act(() => playbackRequest().onEnd());
    expect(screen.getByRole("status").textContent).toBe("Menu finished");
  });

  it("catches a dropped rapid activation or stale callbacks that overwrite the replacement", async () => {
    const user = userEvent.setup();
    render(
      <ObjectDiscoveryGrid
        pack={CAFE_RESTAURANT_PACK}
        language="en"
        synthesisSupported
        onComplete={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Coffee · Café" }));
    const firstRequest = playbackRequest(0);
    await user.click(screen.getByRole("button", { name: "Menu · Menú" }));
    const replacementRequest = playbackRequest(1);

    expect(boundaries.playPronunciation).toHaveBeenCalledTimes(2);
    expect(firstRequest.id).toBe("conv-cafe:3");
    expect(replacementRequest.id).toBe("conv-cafe:2");
    expect(screen.getByRole("button", { name: "Menu · Menú" }).getAttribute("aria-pressed"))
      .toBe("true");

    act(() => replacementRequest.onStart());
    expect(screen.getByRole("status").textContent).toBe("Playing Menu");
    act(() => {
      firstRequest.onError();
      firstRequest.onEnd();
    });
    expect(screen.getByRole("status").textContent).toBe("Playing Menu");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("catches mouse-only object controls or more than one request per keyboard activation", async () => {
    const user = userEvent.setup();
    render(
      <ObjectDiscoveryGrid
        pack={CAFE_RESTAURANT_PACK}
        language="en"
        synthesisSupported
        onComplete={() => {}}
      />,
    );

    const table = screen.getByRole("button", { name: "Table · Mesa" });
    table.focus();
    await user.keyboard("{Enter}");
    expect(boundaries.playPronunciation).toHaveBeenCalledTimes(1);
    expect(playbackRequest(0).id).toBe("conv-cafe:1");

    const card = screen.getByRole("button", { name: "Card · Tarjeta" });
    card.focus();
    await user.keyboard(" ");
    expect(boundaries.playPronunciation).toHaveBeenCalledTimes(2);
    expect(playbackRequest(1).id).toBe("conv-cafe:8");
    expect(card.getAttribute("aria-pressed")).toBe("true");
    expect(table.getAttribute("aria-pressed")).toBe("false");
  });

  it("catches a silent playback failure or retry that changes the selected object metadata", async () => {
    const user = userEvent.setup();
    render(
      <ObjectDiscoveryGrid
        pack={CAFE_RESTAURANT_PACK}
        language="en"
        synthesisSupported
        onComplete={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Menu · Menú" }));
    act(() => playbackRequest(0).onError());

    expect(screen.getByRole("alert").textContent).toContain("Couldn’t play Menu. Try again.");
    const retry = screen.getByRole("button", { name: "Retry Menu" });
    expect(retry.style.minHeight).toBe("44px");
    expect(retry.className).toContain("focus-visible:outline-ring");
    await user.click(retry);

    expect(boundaries.playPronunciation).toHaveBeenCalledTimes(2);
    expect(playbackRequest(1)).toEqual({
      id: "conv-cafe:2",
      text: "Menu",
      onStart: expect.any(Function),
      onEnd: expect.any(Function),
      onError: expect.any(Function),
    });
    expect(boundaries.track).toHaveBeenNthCalledWith(2, "visual_object_replay", {
      topicId: "cafe-restaurant",
      lessonId: "conv-cafe",
      objectId: "menu",
    });
    expect(screen.getByRole("status").textContent).toBe("Starting Menu");
  });

  it("catches an entry-object gate bypass or completion with the last incidental selection", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(
      <ObjectDiscoveryGrid
        pack={CAFE_RESTAURANT_PACK}
        language="en"
        synthesisSupported
        onComplete={onComplete}
      />,
    );

    const continueButton = screen.getByRole("button", { name: "Continue to speaking" });
    expect(continueButton.hasAttribute("disabled")).toBe(true);
    expect(continueButton.style.minHeight).toBe("44px");

    await user.click(screen.getByRole("button", { name: "Menu · Menú" }));
    expect(continueButton.hasAttribute("disabled")).toBe(true);
    await user.click(screen.getByRole("button", { name: "Coffee · Café" }));
    expect(continueButton.hasAttribute("disabled")).toBe(false);
    await user.click(screen.getByRole("button", { name: "Card · Tarjeta" }));
    expect(continueButton.hasAttribute("disabled")).toBe(false);
    await user.click(continueButton);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith("coffee");
    expect(boundaries.track).toHaveBeenLastCalledWith("visual_discovery_complete", {
      topicId: "cafe-restaurant",
      lessonId: "conv-cafe",
    });
  });

  it("catches unbounded analytics properties or reward/scoring language added to discovery", async () => {
    const user = userEvent.setup();
    render(
      <ObjectDiscoveryGrid
        pack={CAFE_RESTAURANT_PACK}
        language="en"
        synthesisSupported
        onComplete={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Coffee · Café" }));
    await user.click(screen.getByRole("button", { name: "Coffee · Café" }));
    await user.click(screen.getByRole("button", { name: "Continue to speaking" }));

    expect(boundaries.track.mock.calls).toEqual([
      ["visual_object_selected", {
        topicId: "cafe-restaurant",
        lessonId: "conv-cafe",
        objectId: "coffee",
      }],
      ["visual_object_replay", {
        topicId: "cafe-restaurant",
        lessonId: "conv-cafe",
        objectId: "coffee",
      }],
      ["visual_discovery_complete", {
        topicId: "cafe-restaurant",
        lessonId: "conv-cafe",
      }],
    ]);
    expect(document.body.textContent).not.toMatch(/\b(?:xp|stars?|score|reward)\b/i);
  });

  it("catches state and callbacks leaking across a pack identity change", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const airportPack: VisualTopicPack = {
      ...CAFE_RESTAURANT_PACK,
      id: "airport-travel",
      entryObjectId: "menu",
      entryPhraseItemId: "conv-airport:2",
      objects: CAFE_RESTAURANT_PACK.objects.map((object, index) => ({
        ...object,
        audioItemId: `conv-airport:${index + 1}`,
      })),
    };
    const { rerender } = render(
      <ObjectDiscoveryGrid
        pack={CAFE_RESTAURANT_PACK}
        language="en"
        synthesisSupported
        onComplete={onComplete}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Coffee · Café" }));
    const oldRequest = playbackRequest(0);
    act(() => oldRequest.onStart());
    expect(screen.getByRole("status").textContent).toBe("Playing Coffee");
    expect(screen.getByRole("button", { name: "Continue to speaking" }).hasAttribute("disabled"))
      .toBe(false);

    rerender(
      <ObjectDiscoveryGrid
        pack={airportPack}
        language="en"
        synthesisSupported
        onComplete={onComplete}
      />,
    );

    const newGrid = screen.getByRole("group", { name: "Explore café objects" });
    expect(within(newGrid).getAllByRole("button").map((button) => button.getAttribute("aria-pressed")))
      .toEqual(["false", "false", "false", "false"]);
    const resetDetails = screen.getByRole("region", { name: "Object details" });
    expect(within(resetDetails).getByText("Select an object to listen.")).not.toBeNull();
    expect(within(resetDetails).queryByRole("heading")).toBeNull();
    expect(screen.getByRole("button", { name: "Continue to speaking" }).hasAttribute("disabled"))
      .toBe(true);
    expect(boundaries.stopPronunciation).toHaveBeenCalledTimes(1);

    act(() => oldRequest.onError());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(within(resetDetails).getByText("Select an object to listen.")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Menu · Menú" }));
    const newRequest = playbackRequest(1);
    act(() => newRequest.onStart());
    expect(screen.getByRole("status").textContent).toBe("Playing Menu");
    act(() => {
      oldRequest.onEnd();
      oldRequest.onError();
    });
    expect(screen.getByRole("status").textContent).toBe("Playing Menu");
    expect(screen.queryByRole("alert")).toBeNull();

    const continueButton = screen.getByRole("button", { name: "Continue to speaking" });
    expect(continueButton.hasAttribute("disabled")).toBe(false);
    await user.click(continueButton);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith("menu");
    expect(boundaries.track).toHaveBeenLastCalledWith("visual_discovery_complete", {
      topicId: "airport-travel",
      lessonId: "conv-airport",
    });
  });

  it("catches a broken discovery thumbnail or a failure that leaks across asset and pack changes", () => {
    const coffeeImage = CAFE_RESTAURANT_PACK.objects.find((object) => object.id === "coffee")!;
    const changedCoffeeImage = "/visual-learning/cafe-restaurant/objects/coffee-v2.webp";
    const packWithChangedAsset: VisualTopicPack = {
      ...CAFE_RESTAURANT_PACK,
      objects: CAFE_RESTAURANT_PACK.objects.map((object) => object.id === "coffee"
        ? { ...object, image: changedCoffeeImage }
        : object),
    };
    const changedPack: VisualTopicPack = {
      ...packWithChangedAsset,
      id: "airport-travel",
    };
    const { rerender } = render(
      <ObjectDiscoveryGrid
        pack={CAFE_RESTAURANT_PACK}
        language="en"
        synthesisSupported
        onComplete={() => {}}
      />,
    );

    const coffeeButton = screen.getByRole("button", { name: "Coffee · Café" });
    fireEvent.error(within(coffeeButton).getByAltText(coffeeImage.alt.en));

    expect(within(coffeeButton).queryByAltText(coffeeImage.alt.en)).toBeNull();
    const fallback = within(coffeeButton).getByRole("img", { name: "Coffee · Café" });
    expect(fallback.className).toContain("size-28");
    expect(within(coffeeButton).getByText("Coffee")).not.toBeNull();
    expect(within(coffeeButton).getByText("Café")).not.toBeNull();
    expect(coffeeButton.getAttribute("aria-pressed")).toBe("false");
    expect(coffeeButton.style.minHeight).toBe("44px");

    rerender(
      <ObjectDiscoveryGrid
        pack={packWithChangedAsset}
        language="en"
        synthesisSupported
        onComplete={() => {}}
      />,
    );
    const changedAssetButton = screen.getByRole("button", { name: "Coffee · Café" });
    expect(decodeURIComponent(
      within(changedAssetButton).getByAltText(coffeeImage.alt.en).getAttribute("src") ?? "",
    ))
      .toContain(changedCoffeeImage);

    fireEvent.error(within(changedAssetButton).getByAltText(coffeeImage.alt.en));
    expect(within(changedAssetButton).queryByAltText(coffeeImage.alt.en)).toBeNull();

    rerender(
      <ObjectDiscoveryGrid
        pack={changedPack}
        language="en"
        synthesisSupported
        onComplete={() => {}}
      />,
    );
    expect(decodeURIComponent(
      within(screen.getByRole("button", { name: "Coffee · Café" }))
        .getByAltText(coffeeImage.alt.en).getAttribute("src") ?? "",
    ))
      .toContain(changedCoffeeImage);
  });

  it("catches playback left running after the discovery grid unmounts", () => {
    const { unmount } = render(
      <ObjectDiscoveryGrid
        pack={CAFE_RESTAURANT_PACK}
        language="es"
        synthesisSupported={false}
        onComplete={() => {}}
      />,
    );

    unmount();
    expect(boundaries.stopPronunciation).toHaveBeenCalledTimes(1);
  });
});
