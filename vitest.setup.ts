import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

if (!("PointerEvent" in globalThis)) {
  globalThis.PointerEvent = MouseEvent as typeof PointerEvent;
}

if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!("IntersectionObserver" in globalThis)) {
  globalThis.IntersectionObserver = class IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "0px";
    readonly thresholds = [0];
    disconnect() {}
    observe() {}
    takeRecords() { return []; }
    unobserve() {}
  } as typeof IntersectionObserver;
}

HTMLElement.prototype.hasPointerCapture ??= () => false;
HTMLElement.prototype.setPointerCapture ??= () => {};
HTMLElement.prototype.releasePointerCapture ??= () => {};

if (!("inert" in HTMLElement.prototype)) {
  Object.defineProperty(HTMLElement.prototype, "inert", {
    configurable: true,
    get() { return this.hasAttribute("inert"); },
    set(value: boolean) { this.toggleAttribute("inert", value); },
  });
}

afterEach(() => cleanup());
