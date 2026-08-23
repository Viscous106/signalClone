import { beforeEach, describe, expect, it } from "vitest";

import { useFavorites } from "./favorites";

const KEY = "signal:favorites";

describe("favorites", () => {
  beforeEach(() => {
    localStorage.clear();
    useFavorites.setState({ ids: [] });
  });

  it("adds and removes on the same toggle", () => {
    useFavorites.getState().toggle(7);
    expect(useFavorites.getState().ids).toEqual([7]);

    useFavorites.getState().toggle(7);
    expect(useFavorites.getState().ids).toEqual([]);
  });

  it("survives a reload", () => {
    useFavorites.getState().toggle(3);
    useFavorites.setState({ ids: [] });

    useFavorites.getState().hydrate();
    expect(useFavorites.getState().ids).toEqual([3]);
  });

  it("starts clean on a corrupt entry rather than crashing the shell", () => {
    localStorage.setItem(KEY, "{not json");
    useFavorites.getState().hydrate();

    expect(useFavorites.getState().ids).toEqual([]);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("ignores non-numeric ids somebody hand-edited in", () => {
    localStorage.setItem(KEY, JSON.stringify([1, "2", null, 3]));
    useFavorites.getState().hydrate();
    expect(useFavorites.getState().ids).toEqual([1, 3]);
  });
});
