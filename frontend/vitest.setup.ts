import "@testing-library/jest-dom/vitest";

// jsdom implements neither of these; components that scroll or observe layout
// would otherwise throw in tests for reasons unrelated to their behaviour.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
