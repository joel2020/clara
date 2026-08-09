import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

const characterProps = vi.hoisted(() => [] as Array<Record<string, unknown>>);

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

vi.mock("@/components/character", () => ({
  CharacterIllustration: (props: Record<string, unknown>) => {
    characterProps.push(props);
    return (
      <div
        data-character-layer
        data-mood={String(props.mood)}
        data-mode={String(props.mode)}
        data-has-outfit={String("outfit" in props)}
      >
        <button
          type="button"
          onClick={() => (props.onArtFallback as (() => void) | undefined)?.()}
        >
          Simulate character art failure
        </button>
      </div>
    );
  },
}));

import { ContextStoryIntro } from "@/components/visual-learning/context-story-intro";
import { ContextVisual } from "@/components/visual-learning/context-visual";
import { CAFE_RESTAURANT_PACK } from "@/lib/visual-learning/manifest";

describe("ContextStoryIntro", () => {
  it("catches a wrong responsive source or copy moved into the decorative artwork", () => {
    const { container } = render(
      <ContextStoryIntro pack={CAFE_RESTAURANT_PACK} language="en" onStart={() => {}} />,
    );

    const picture = container.querySelector("picture");
    expect(picture).not.toBeNull();
    expect(picture?.querySelector('source[media="(max-width: 639px)"]')?.getAttribute("srcset"))
      .toBe("/visual-learning/cafe-restaurant/environment-mobile.webp");
    const environment = picture?.querySelector("img");
    expect(environment?.getAttribute("src")).toBe("/visual-learning/cafe-restaurant/environment-desktop.webp");
    expect(environment?.getAttribute("alt")).toBe("");
    expect(environment?.getAttribute("aria-hidden")).toBe("true");

    const heading = screen.getByRole("heading", { name: "Order a coffee with confidence" });
    expect(picture?.parentElement?.contains(heading)).toBe(false);
    expect(screen.getByText(/Lumi is with you/)).not.toBeNull();
  });

  it("catches a duplicate Lumi layer, wrong story pose, or accidental outfit override", () => {
    characterProps.length = 0;
    const { container } = render(
      <ContextStoryIntro pack={CAFE_RESTAURANT_PACK} language="es" onStart={() => {}} />,
    );

    const layers = container.querySelectorAll("[data-character-layer]");
    expect(layers).toHaveLength(1);
    expect(layers[0]?.getAttribute("data-mood")).toBe("idle");
    expect(layers[0]?.getAttribute("data-mode")).toBe("scene");
    expect(layers[0]?.getAttribute("data-has-outfit")).toBe("false");
  });

  it("catches a CTA smaller than 44px or replaced with a non-keyboard control", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<ContextStoryIntro pack={CAFE_RESTAURANT_PACK} language="es" onStart={onStart} />);

    const button = screen.getByRole("button", { name: "Entrar al café" });
    expect(button.tagName).toBe("BUTTON");
    expect(button.style.minHeight).toBe("44px");
    button.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onStart).toHaveBeenCalledTimes(2);
  });

  it("catches removal of the CTA's explicit focus-visible treatment", () => {
    render(<ContextStoryIntro pack={CAFE_RESTAURANT_PACK} language="en" onStart={() => {}} />);

    const button = screen.getByRole("button", { name: "Enter the café" });
    expect(button.className).toContain("focus-visible:outline-2");
    expect(button.className).toContain("focus-visible:outline-ring");
    expect(button.className).toContain("focus-visible:outline-offset-2");
  });

  it("catches rendered raw colors that bypass Clara's semantic theme tokens", () => {
    const { container } = render(
      <ContextStoryIntro pack={CAFE_RESTAURANT_PACK} language="en" onStart={() => {}} />,
    );

    const renderedPresentation = Array.from(container.querySelectorAll<HTMLElement>("[class], [style]"))
      .flatMap((element) => [element.getAttribute("class") ?? "", element.getAttribute("style") ?? ""])
      .join(" ");
    expect(renderedPresentation).not.toMatch(/(?:#[0-9a-f]{3,8}|rgba?\()/i);
    expect(screen.getByRole("button", { name: "Enter the café" }).className).toContain("bg-primary");
    expect(screen.getByRole("heading", { name: "Order a coffee with confidence" }).className)
      .toContain("text-foreground");
  });
});

describe("ContextVisual", () => {
  it("catches a focused object that loses its manifest alt or intrinsic dimensions", () => {
    render(
      <ContextVisual
        pack={CAFE_RESTAURANT_PACK}
        moment="speak"
        objectId="coffee"
        language="en"
      />,
    );

    const object = screen.getByAltText("A cup of coffee");
    expect(object.getAttribute("src")).toBe("/visual-learning/cafe-restaurant/objects/coffee.webp");
    expect(object.getAttribute("width")).toBe("512");
    expect(object.getAttribute("height")).toBe("512");
  });

  it("catches missing stable bilingual object fallback or unbounded fallback classes", async () => {
    const user = userEvent.setup();
    const onFallback = vi.fn();
    const { container } = render(
      <ContextVisual
        pack={CAFE_RESTAURANT_PACK}
        moment="speak"
        objectId="coffee"
        language="en"
        onFallback={onFallback}
      />,
    );

    fireEvent.error(screen.getByAltText("A cup of coffee"));
    const objectFallback = screen.getByRole("group", { name: "Coffee · Café" });
    expect(within(objectFallback).getByText("Coffee")).not.toBeNull();
    expect(within(objectFallback).getByText("Café")).not.toBeNull();

    const environment = container.querySelector("picture img");
    expect(environment).not.toBeNull();
    fireEvent.error(environment!);
    expect(screen.getByRole("img", { name: "Order a coffee with confidence" })).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Simulate character art failure" }));
    expect(onFallback.mock.calls.map(([fallback]) => fallback)).toEqual([
      "object-missing",
      "environment-missing",
      "outfit-pose-missing",
    ]);
  });

  it("catches decorative entrance motion that ignores reduced-motion preferences", () => {
    const { container } = render(
      <ContextVisual pack={CAFE_RESTAURANT_PACK} moment="story" language="es" />,
    );

    const movingLayers = container.querySelectorAll("[data-entrance-layer]");
    expect(movingLayers.length).toBeGreaterThan(0);
    for (const layer of movingLayers) {
      expect(layer.className).toContain("motion-reduce:animate-none");
    }
  });

  it("catches a failed environment or object that stays stuck after its asset identity changes", () => {
    const onFallback = vi.fn();
    const nextPack = {
      ...CAFE_RESTAURANT_PACK,
      environment: {
        desktop: "/visual-learning/cafe-restaurant/environment-next-desktop.webp",
        mobile: "/visual-learning/cafe-restaurant/environment-next-mobile.webp",
      },
      objects: CAFE_RESTAURANT_PACK.objects.map((object) => object.id === "coffee"
        ? { ...object, image: "/visual-learning/cafe-restaurant/objects/coffee-next.webp" }
        : object),
    };
    const { container, rerender } = render(
      <ContextVisual
        pack={CAFE_RESTAURANT_PACK}
        moment="speak"
        objectId="coffee"
        language="en"
        onFallback={onFallback}
      />,
    );

    fireEvent.error(screen.getByAltText("A cup of coffee"));
    fireEvent.error(container.querySelector("picture img")!);
    expect(onFallback.mock.calls.map(([fallback]) => fallback)).toEqual([
      "object-missing",
      "environment-missing",
    ]);

    rerender(
      <ContextVisual
        pack={nextPack}
        moment="speak"
        objectId="coffee"
        language="en"
        onFallback={onFallback}
      />,
    );

    const nextObject = screen.getByAltText("A cup of coffee");
    const nextEnvironment = container.querySelector("picture img");
    expect(nextObject.getAttribute("src"))
      .toBe("/visual-learning/cafe-restaurant/objects/coffee-next.webp");
    expect(nextEnvironment?.getAttribute("src"))
      .toBe("/visual-learning/cafe-restaurant/environment-next-desktop.webp");
    expect(container.querySelector("picture source")?.getAttribute("srcset"))
      .toBe("/visual-learning/cafe-restaurant/environment-next-mobile.webp");
    expect(onFallback).toHaveBeenCalledTimes(2);

    fireEvent.error(nextObject);
    fireEvent.error(nextEnvironment!);
    expect(onFallback.mock.calls.map(([fallback]) => fallback)).toEqual([
      "object-missing",
      "environment-missing",
      "object-missing",
      "environment-missing",
    ]);
  });
});
