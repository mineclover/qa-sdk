// @def.boundary sim-scenarios

import { describe, expect, it } from "vitest";
import { createCatalogStore, type FetchLike } from "./catalog-store.js";

describe("catalog-store handle", () => {
  it("topology 응답을 v3/v4 state map으로 변환한다", async () => {
    // controller `/v1/catalog/states` topology shape:
    //   { stable: {value}, candidate: {value}|null, retired: [{value}...] }
    // 시나리오 기대 shape: { v3, v4 } per-version state.
    const fetchImpl: FetchLike = async (url) => {
      expect(url).toContain("/v1/catalog/states");
      expect(url).toContain("prefix=");
      return {
        ok: true,
        status: 200,
        async text() {
          return "";
        },
        async json() {
          return {
            stable: { value: 3 },
            candidate: null,
            retired: [{ value: 1 }, { value: 2 }],
          };
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

  it("invalid topology shape에 throw", async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: true,
      status: 200,
      async text() {
        return "";
      },
      async json() {
        // stable.value 누락 → invalid topology.
        return { v3: 1, v4: 2 };
      },
    });
    const store = createCatalogStore({
      controllerUrl: "http://x",
      fetchImpl,
    });
    await expect(store.getStates()).rejects.toThrow(/invalid topology shape/);
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
