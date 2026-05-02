// @def.boundary sim-scenarios

import { describe, expect, it } from "vitest";
import { createCatalogStore, type FetchLike } from "./catalog-store.js";

describe("catalog-store handle", () => {
  it("getStates가 v3/v4 string을 반환한다", async () => {
    const fetchImpl: FetchLike = async (url) => {
      expect(url).toContain("/v1/catalog/states");
      return {
        ok: true,
        status: 200,
        async text() {
          return "";
        },
        async json() {
          return { v3: "stable", v4: "undeployed" };
        },
      };
    };
    const store = createCatalogStore({
      controllerUrl: "http://controller/",
      fetchImpl,
    });
    const states = await store.getStates();
    expect(states).toEqual({ v3: "stable", v4: "undeployed" });
  });

  it("invalid shape에 throw", async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: true,
      status: 200,
      async text() {
        return "";
      },
      async json() {
        return { v3: 1, v4: 2 };
      },
    });
    const store = createCatalogStore({
      controllerUrl: "http://x",
      fetchImpl,
    });
    await expect(store.getStates()).rejects.toThrow(/invalid shape/);
  });

  it("non-2xx에 throw", async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: false,
      status: 404,
      async text() {
        return "not found";
      },
      async json() {
        return {};
      },
    });
    const store = createCatalogStore({ controllerUrl: "http://x", fetchImpl });
    await expect(store.getStates()).rejects.toThrow(/status=404/);
  });
});
